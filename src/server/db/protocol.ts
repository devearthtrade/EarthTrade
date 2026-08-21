/**
 * Minimal PostgreSQL frontend/backend protocol v3 client.
 *
 * Why this exists: the project has no `node_modules` and the package registry
 * is unreachable from this environment, so `pg` cannot be installed. Shelling
 * out to `psql` is not acceptable for application code, because building SQL as
 * text is exactly the shape that invites injection.
 *
 * This speaks the wire protocol directly and uses the **extended query
 * protocol** (Parse / Bind / Execute), where parameter values travel in their
 * own protocol messages, separate from the SQL text. The server never parses
 * user data as SQL, so injection is structurally impossible rather than
 * defended against by escaping.
 *
 * Scope is deliberately narrow: connect, authenticate, run parameterised
 * queries, decode the handful of column types this schema uses. It is not a
 * general-purpose driver. Swap it for `pg` once the registry is reachable; the
 * repository layer above it will not need to change.
 */

import { createConnection, type Socket } from "node:net";
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";

/* ------------------------------ wire buffers ---------------------------- */

class Writer {
  private chunks: Buffer[] = [];

  int32(n: number): this {
    const b = Buffer.alloc(4);
    b.writeInt32BE(n);
    this.chunks.push(b);
    return this;
  }
  int16(n: number): this {
    const b = Buffer.alloc(2);
    b.writeInt16BE(n);
    this.chunks.push(b);
    return this;
  }
  byte(n: number): this {
    this.chunks.push(Buffer.from([n]));
    return this;
  }
  /** Null-terminated string, as the protocol requires. */
  cstr(s: string): this {
    this.chunks.push(Buffer.from(s, "utf8"), Buffer.from([0]));
    return this;
  }
  raw(b: Buffer): this {
    this.chunks.push(b);
    return this;
  }
  body(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

/** Frames a message: type byte, then length-prefixed body. */
function frame(type: string | null, body: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeInt32BE(body.length + 4);
  return type ? Buffer.concat([Buffer.from(type, "ascii"), len, body]) : Buffer.concat([len, body]);
}

interface ServerMessage {
  type: string;
  body: Buffer;
}

/** Splits a stream buffer into whole protocol messages. */
function* readMessages(buf: Buffer): Generator<ServerMessage, number> {
  let off = 0;
  while (buf.length - off >= 5) {
    const type = String.fromCharCode(buf[off]!);
    const len = buf.readInt32BE(off + 1);
    if (buf.length - off < len + 1) break;
    yield { type, body: buf.subarray(off + 5, off + 1 + len) };
    off += 1 + len;
  }
  return off;
}

/* -------------------------------- SCRAM --------------------------------- */

/**
 * SCRAM-SHA-256, the default for PostgreSQL 14+. The password never crosses
 * the wire; both sides prove knowledge of it through HMAC signatures.
 */
class Scram {
  readonly clientNonce = randomBytes(18).toString("base64");
  private authMessage = "";
  private saltedPassword = Buffer.alloc(0);

  firstMessage(): string {
    return `n,,n=,r=${this.clientNonce}`;
  }

  finalMessage(serverFirst: string, password: string): string {
    const parts = Object.fromEntries(
      serverFirst.split(",").map((kv) => [kv.slice(0, 1), kv.slice(2)]),
    ) as Record<string, string>;

    const serverNonce = parts["r"] ?? "";
    const salt = Buffer.from(parts["s"] ?? "", "base64");
    const iterations = Number(parts["i"] ?? "4096");

    if (!serverNonce.startsWith(this.clientNonce)) {
      throw new Error("SCRAM: server nonce does not extend the client nonce");
    }

    this.saltedPassword = pbkdf2Sync(password, salt, iterations, 32, "sha256");
    const clientKey = createHmac("sha256", this.saltedPassword).update("Client Key").digest();
    const storedKey = createHash("sha256").update(clientKey).digest();

    const withoutProof = `c=biws,r=${serverNonce}`;
    this.authMessage = `n=,r=${this.clientNonce},${serverFirst},${withoutProof}`;

    const clientSignature = createHmac("sha256", storedKey).update(this.authMessage).digest();
    const proof = Buffer.alloc(clientKey.length);
    for (let i = 0; i < clientKey.length; i++) proof[i] = clientKey[i]! ^ clientSignature[i]!;

    return `${withoutProof},p=${proof.toString("base64")}`;
  }

  /** Confirms the server also knows the password, closing off impersonation. */
  verify(serverFinal: string): void {
    const sig = serverFinal.split(",").find((p) => p.startsWith("v="))?.slice(2);
    const serverKey = createHmac("sha256", this.saltedPassword).update("Server Key").digest();
    const expected = createHmac("sha256", serverKey).update(this.authMessage).digest("base64");
    if (sig !== expected) throw new Error("SCRAM: server signature mismatch");
  }
}

/* ------------------------------- decoding ------------------------------- */

/** Object identifiers for the column types this schema actually uses. */
const OID = {
  bool: 16,
  int8: 20,
  int2: 21,
  int4: 23,
  text: 25,
  json: 114,
  float4: 700,
  float8: 701,
  bpchar: 1042,
  varchar: 1043,
  timestamp: 1114,
  timestamptz: 1184,
  uuid: 2950,
  jsonb: 3802,
  textArray: 1009,
  varcharArray: 1015,
} as const;

/** Parses a Postgres array literal such as {a,"b,c",NULL}. */
function parseArray(raw: string): (string | null)[] {
  if (!raw.startsWith("{") || !raw.endsWith("}")) return [];
  const inner = raw.slice(1, -1);
  if (!inner) return [];

  const out: (string | null)[] = [];
  let cur = "";
  let quoted = false;
  let escaped = false;

  for (const ch of inner) {
    if (escaped) {
      cur += ch;
      escaped = false;
    } else if (ch === "\\") escaped = true;
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      out.push(cur === "NULL" ? null : cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur === "NULL" ? null : cur);
  return out;
}

function decode(oid: number, raw: string | null): unknown {
  if (raw === null) return null;
  switch (oid) {
    case OID.bool:
      return raw === "t";
    case OID.int2:
    case OID.int4:
    case OID.int8:
      return Number(raw);
    case OID.float4:
    case OID.float8:
      return Number(raw);
    case OID.json:
    case OID.jsonb:
      return JSON.parse(raw);
    case OID.textArray:
    case OID.varcharArray:
      return parseArray(raw);
    case OID.timestamp:
    case OID.timestamptz:
      return new Date(raw);
    default:
      return raw;
  }
}

/* ------------------------------ connection ------------------------------ */

export interface ConnectOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectTimeoutMs?: number;
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

interface Field {
  name: string;
  oid: number;
}

export class PgError extends Error {
  readonly code: string;
  constructor(fields: Record<string, string>) {
    super(fields["M"] ?? "postgres error");
    this.name = "PgError";
    this.code = fields["C"] ?? "";
  }
}

export class Connection {
  private socket: Socket | null = null;
  private buffer = Buffer.alloc(0);
  private waiters: ((m: ServerMessage) => void)[] = [];
  private queue: ServerMessage[] = [];
  private fatal: Error | null = null;

  private readonly opts: ConnectOptions;

  constructor(opts: ConnectOptions) {
    this.opts = opts;
  }

  /* --- plumbing --- */

  private onData = (chunk: Buffer): void => {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const it = readMessages(this.buffer);
    let consumed = 0;
    for (;;) {
      const next = it.next();
      if (next.done) {
        consumed = next.value;
        break;
      }
      const msg = next.value;
      const waiter = this.waiters.shift();
      if (waiter) waiter(msg);
      else this.queue.push(msg);
    }
    this.buffer = this.buffer.subarray(consumed);
  };

  private next(): Promise<ServerMessage> {
    if (this.fatal) return Promise.reject(this.fatal);
    const queued = this.queue.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private send(buf: Buffer): void {
    if (!this.socket) throw new Error("not connected");
    this.socket.write(buf);
  }

  /* --- lifecycle --- */

  async connect(): Promise<void> {
    const { host, port, connectTimeoutMs = 5000 } = this.opts;

    await new Promise<void>((resolve, reject) => {
      const sock = createConnection({ host, port });
      const timer = setTimeout(() => {
        sock.destroy();
        reject(new Error(`connection to ${host}:${port} timed out`));
      }, connectTimeoutMs);

      sock.once("connect", () => {
        clearTimeout(timer);
        sock.setNoDelay(true);
        this.socket = sock;
        sock.on("data", this.onData);
        sock.on("error", (e) => {
          this.fatal = e;
        });
        resolve();
      });
      sock.once("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });

    await this.startup();
  }

  private async startup(): Promise<void> {
    const w = new Writer()
      .int32(196608) // protocol 3.0
      .cstr("user").cstr(this.opts.user)
      .cstr("database").cstr(this.opts.database)
      .cstr("client_encoding").cstr("UTF8")
      .byte(0);
    this.send(frame(null, w.body()));

    const scram = new Scram();

    for (;;) {
      const msg = await this.next();

      if (msg.type === "E") throw new PgError(errorFields(msg.body));

      if (msg.type === "R") {
        const kind = msg.body.readInt32BE(0);
        if (kind === 0) continue; // AuthenticationOk

        if (kind === 3) {
          // Cleartext. Only reachable on a server configured to ask for it.
          this.send(frame("p", new Writer().cstr(this.opts.password).body()));
          continue;
        }

        if (kind === 10) {
          // SASL: pick SCRAM-SHA-256 from the offered mechanisms.
          const mechanisms = msg.body.subarray(4).toString("utf8").split("\0").filter(Boolean);
          if (!mechanisms.includes("SCRAM-SHA-256")) {
            throw new Error(`no supported SASL mechanism in ${mechanisms.join(", ")}`);
          }
          const first = scram.firstMessage();
          const body = new Writer()
            .cstr("SCRAM-SHA-256")
            .int32(Buffer.byteLength(first))
            .raw(Buffer.from(first, "utf8"))
            .body();
          this.send(frame("p", body));
          continue;
        }

        if (kind === 11) {
          const serverFirst = msg.body.subarray(4).toString("utf8");
          const final = scram.finalMessage(serverFirst, this.opts.password);
          this.send(frame("p", Buffer.from(final, "utf8")));
          continue;
        }

        if (kind === 12) {
          scram.verify(msg.body.subarray(4).toString("utf8"));
          continue;
        }

        throw new Error(`unsupported authentication request ${kind}`);
      }

      // ReadyForQuery: startup complete.
      if (msg.type === "Z") return;
    }
  }

  async end(): Promise<void> {
    if (!this.socket) return;
    try {
      this.send(frame("X", Buffer.alloc(0)));
    } catch {
      /* already gone */
    }
    this.socket.destroy();
    this.socket = null;
  }

  /* --- queries --- */

  /**
   * Runs a parameterised query. `$1`, `$2` ... in `sql` are bound from
   * `params`, which travel as separate protocol messages and are never
   * concatenated into the statement text.
   */
  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    // Parse (unnamed statement) / Bind / Describe / Execute / Sync
    const parse = new Writer().cstr("").cstr(sql).int16(0).body();

    const bind = new Writer();
    bind.cstr("").cstr("");
    bind.int16(0); // all parameters as text
    bind.int16(params.length);
    for (const p of params) {
      if (p === null || p === undefined) {
        bind.int32(-1);
      } else {
        const text =
          typeof p === "object" ? JSON.stringify(p) : typeof p === "boolean" ? (p ? "t" : "f") : String(p);
        const buf = Buffer.from(text, "utf8");
        bind.int32(buf.length).raw(buf);
      }
    }
    bind.int16(0); // all results as text

    this.send(
      Buffer.concat([
        frame("P", parse),
        frame("B", bind.body()),
        frame("D", new Writer().byte(0x50).cstr("").body()), // describe portal
        frame("E", new Writer().cstr("").int32(0).body()),
        frame("S", Buffer.alloc(0)),
      ]),
    );

    let fields: Field[] = [];
    const rows: T[] = [];
    let error: PgError | null = null;

    for (;;) {
      const msg = await this.next();

      switch (msg.type) {
        case "T": {
          fields = [];
          const count = msg.body.readInt16BE(0);
          let off = 2;
          for (let i = 0; i < count; i++) {
            const end = msg.body.indexOf(0, off);
            const name = msg.body.subarray(off, end).toString("utf8");
            off = end + 1;
            const oid = msg.body.readInt32BE(off + 6);
            off += 18;
            fields.push({ name, oid });
          }
          break;
        }
        case "D": {
          const count = msg.body.readInt16BE(0);
          let off = 2;
          const row: Record<string, unknown> = {};
          for (let i = 0; i < count; i++) {
            const len = msg.body.readInt32BE(off);
            off += 4;
            const f = fields[i]!;
            if (len === -1) {
              row[f.name] = null;
            } else {
              row[f.name] = decode(f.oid, msg.body.subarray(off, off + len).toString("utf8"));
              off += len;
            }
          }
          rows.push(row as T);
          break;
        }
        case "E":
          error = new PgError(errorFields(msg.body));
          break;
        case "Z":
          if (error) throw error;
          return { rows, rowCount: rows.length };
        default:
          break; // ParseComplete, BindComplete, CommandComplete, NoData, notices
      }
    }
  }
}

function errorFields(body: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  let off = 0;
  while (off < body.length) {
    const code = String.fromCharCode(body[off]!);
    if (code === "\0") break;
    const end = body.indexOf(0, off + 1);
    out[code] = body.subarray(off + 1, end).toString("utf8");
    off = end + 1;
  }
  return out;
}
