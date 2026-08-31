/**
 * Local management API.
 *
 * A small HTTP server over the repository layer, so products, variants, media
 * and collections can be created and edited without changing source code. It is
 * what the Admin Dashboard will call; the Dashboard itself does not exist yet.
 *
 * **Local only, and unauthenticated.** It binds to the loopback interface and
 * refuses to start on any other address. There is no authentication, no
 * authorisation and no rate limiting, because there is no one else on the
 * network to authenticate — every request comes from this machine. That is a
 * property of the binding, not a decision to skip security: the moment this is
 * meant to be reachable from anywhere else, it needs all three, and the check
 * below is there to make sure that conversation happens first.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WriteError } from "../repositories/writes.ts";
import { PgError } from "../db/index.ts";
import { asActor } from "../audit.ts";

export type Handler = (ctx: RequestContext) => Promise<unknown>;

export interface RequestContext {
  params: Record<string, string>;
  query: URLSearchParams;
  body: Record<string, unknown>;
  method: string;
  path: string;
}

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

/** Marks a response as "created" rather than "ok". */
export class Created {
  readonly value: unknown;

  constructor(value: unknown) {
    this.value = value;
  }
}

/** Marks a response as "nothing to return". */
export const NoContent = Symbol("no content");

/** An HTML response, for the admin pages. */
export class Html {
  readonly body: string;
  readonly status: number;

  constructor(body: string, status = 200) {
    this.body = body;
    this.status = status;
  }
}

/**
 * A redirect, which is how every admin form submission ends.
 *
 * Post-redirect-get: the browser lands on a GET it can safely reload, and
 * refreshing the page cannot repeat the write.
 */
export class Redirect {
  readonly location: string;
  readonly status: number;

  constructor(location: string, status = 303) {
    this.location = location;
    this.status = status;
  }
}

/** A file response with an explicit content type. */
export class Asset {
  readonly body: string | Buffer;
  readonly contentType: string;

  constructor(body: string | Buffer, contentType: string) {
    this.body = body;
    this.contentType = contentType;
  }
}

export class Router {
  private readonly routes: Route[] = [];

  add(method: string, path: string, handler: Handler): this {
    const keys: string[] = [];
    const pattern = new RegExp(
      "^" +
        path.replace(/:([A-Za-z]+)/g, (_, k: string) => {
          keys.push(k);
          // A path segment, percent-decoded later. `*` is excluded so a handle
          // cannot swallow the rest of the path.
          return "([^/]+)";
        }) +
        "$",
    );
    this.routes.push({ method, pattern, keys, handler });
    return this;
  }

  get(path: string, h: Handler): this { return this.add("GET", path, h); }
  post(path: string, h: Handler): this { return this.add("POST", path, h); }
  patch(path: string, h: Handler): this { return this.add("PATCH", path, h); }
  put(path: string, h: Handler): this { return this.add("PUT", path, h); }
  delete(path: string, h: Handler): this { return this.add("DELETE", path, h); }

  match(method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
    let pathExists = false;
    for (const r of this.routes) {
      const m = r.pattern.exec(path);
      if (!m) continue;
      pathExists = true;
      if (r.method !== method) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]!)));
      return { handler: r.handler, params };
    }
    // Distinguishing "wrong method" from "no such path" saves whoever is
    // integrating from guessing which they got wrong.
    if (pathExists) throw new WriteError(`${method} is not allowed on ${path}`, 405);
    return null;
  }
}

const MAX_BODY_BYTES = 1024 * 1024;

async function rawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new WriteError("Request body is too large", 413);
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * Reads the request body as JSON, or as an HTML form.
 *
 * Forms arrive from the admin pages and carry everything as strings, so a
 * field named `priceCents` comes through as `"1999"`. Coercion happens in the
 * admin route that knows what the field means, never here: guessing that a
 * numeric-looking string is a number is how a SKU of "007" becomes 7.
 *
 * A repeated field name collects into an array, which is how multi-select and
 * ordered lists post.
 */
async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const type = (req.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
  const buffer = await rawBody(req);
  if (!buffer.length) return {};

  const text = buffer.toString("utf8");

  if (type === "application/x-www-form-urlencoded") {
    const params = new URLSearchParams(text);
    const out: Record<string, unknown> = {};
    for (const key of new Set(params.keys())) {
      const values = params.getAll(key);
      out[key] = values.length > 1 ? values : values[0];
    }
    return out;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new WriteError("Request body must be a JSON object", 400);
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    if (err instanceof WriteError) throw err;
    throw new WriteError("Request body is not valid JSON", 400);
  }
}

function send(res: ServerResponse, status: number, payload: unknown): void {
  const body = payload === undefined ? "" : JSON.stringify(payload, null, 2) + "\n";
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    // Nothing here should ever be cached, including by a browser someone
    // pointed at it while poking around.
    "cache-control": "no-store",
  });
  res.end(body);
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

function defaultActorName(path: string): string {
  return path.startsWith("/admin") ? "local-admin" : "api-client";
}

function escapeText(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export interface ServeOptions {
  router: Router;
  port?: number;
  host?: string;
  /** Called for each completed request. Defaults to a one-line log. */
  onRequest?: (line: string) => void;
  /** Renders a refusal as a page, for browsers rather than API clients. */
  errorPage?: (message: string, status: number, url: URL) => string;
}

export function createApi(options: ServeOptions) {
  const host = options.host ?? "127.0.0.1";
  if (!LOOPBACK.has(host)) {
    throw new Error(
      `Refusing to bind the management API to ${host}. It has no authentication and is ` +
        `intended for local development only.`,
    );
  }

  const log = options.onRequest ?? ((line: string) => console.log(line));

  const server = createServer((req, res) => {
    void (async () => {
      const started = Date.now();
      const url = new URL(req.url ?? "/", `http://${host}`);
      let status = 200;

      try {
        const match = options.router.match(req.method ?? "GET", url.pathname);
        if (!match) {
          // Thrown rather than sent directly so the catch below picks the
          // audience: a browser on /admin gets the styled error page, an API
          // client gets the same JSON shape as before.
          throw new WriteError(`No such endpoint: ${req.method} ${url.pathname}`, 404);
        }

        const body = req.method === "GET" || req.method === "DELETE" ? {} : await readBody(req);
        const context = {
          params: match.params,
          query: url.searchParams,
          body,
          method: req.method ?? "GET",
          path: url.pathname,
        };

        // Attribution happens here, once, rather than in each handler. A
        // mutation with no recorded actor is worse than useless — it looks
        // like an answer while telling you nothing — and the surest way to
        // avoid one is to leave no handler in a position to forget.
        //
        // There is no authentication, so the name is a declaration rather than
        // a proof. Recording that a change arrived through the Dashboard rather
        // than a script is most of the value at this stage, and the field is
        // ready for a real identity when there is one.
        const declared = body["__actor"];
        const result = await asActor(
          {
            name: typeof declared === "string" && declared.trim() ? declared.trim() : defaultActorName(url.pathname),
            via: url.pathname.startsWith("/admin") ? "dashboard" : "api",
          },
          () => match.handler(context),
        );

        if (result === NoContent) {
          status = 204;
          res.writeHead(204).end();
        } else if (result instanceof Redirect) {
          status = result.status;
          res.writeHead(result.status, { location: result.location, "cache-control": "no-store" }).end();
        } else if (result instanceof Html) {
          status = result.status;
          const body = Buffer.from(result.body, "utf8");
          res.writeHead(result.status, {
            "content-type": "text/html; charset=utf-8",
            "content-length": body.length,
            "cache-control": "no-store",
            // The admin renders catalog copy that people paste in. Even on
            // loopback, a page that cannot be framed and cannot sniff types is
            // one fewer way for pasted markup to do something surprising.
            "x-content-type-options": "nosniff",
            "x-frame-options": "DENY",
            "referrer-policy": "no-referrer",
          });
          res.end(body);
        } else if (result instanceof Asset) {
          status = 200;
          const body = Buffer.isBuffer(result.body) ? result.body : Buffer.from(result.body, "utf8");
          res.writeHead(200, {
            "content-type": result.contentType,
            "content-length": body.length,
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          });
          res.end(body);
        } else if (result instanceof Created) {
          status = 201;
          send(res, 201, result.value);
        } else {
          send(res, 200, result);
        }
      } catch (err) {
        // A person using the admin gets a page they can read and act on; an API
        // client gets the JSON it can handle. Same error, two audiences.
        const wantsHtml =
          url.pathname.startsWith("/admin") &&
          (req.headers.accept ?? "").includes("text/html");

        if (err instanceof WriteError && wantsHtml) {
          status = err.status;
          const page = options.errorPage?.(err.message, err.status, url) ?? escapeText(err.message);
          const body = Buffer.from(page, "utf8");
          res.writeHead(err.status, {
            "content-type": "text/html; charset=utf-8",
            "content-length": body.length,
            "cache-control": "no-store",
          });
          res.end(body);
        } else if (err instanceof WriteError) {
          status = err.status;
          send(res, err.status, {
            error: err.message,
            ...(err.detail ? { detail: err.detail } : {}),
          });
        } else if (err instanceof PgError) {
          // A constraint the write layer did not check is still a refusal, and
          // the database's message says what it was.
          status = 422;
          send(res, 422, { error: err.message, constraint: err.code });
        } else {
          status = 500;
          const message = err instanceof Error ? err.message : String(err);
          console.error(`500 ${req.method} ${url.pathname}:`, err);
          send(res, 500, { error: message });
        }
      } finally {
        log(`${status} ${req.method} ${url.pathname} ${Date.now() - started}ms`);
      }
    })();
  });

  return {
    server,
    listen(): Promise<number> {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(options.port ?? 4000, host, () => {
          const address = server.address();
          resolve(typeof address === "object" && address ? address.port : (options.port ?? 4000));
        });
      });
    },
    close(): Promise<void> {
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
