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

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new WriteError("Request body is too large", 413);
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {};

  const text = Buffer.concat(chunks).toString("utf8");
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

export interface ServeOptions {
  router: Router;
  port?: number;
  host?: string;
  /** Called for each completed request. Defaults to a one-line log. */
  onRequest?: (line: string) => void;
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
          status = 404;
          send(res, 404, { error: `No such endpoint: ${req.method} ${url.pathname}` });
          return;
        }

        const body = req.method === "GET" || req.method === "DELETE" ? {} : await readBody(req);
        const result = await match.handler({
          params: match.params,
          query: url.searchParams,
          body,
          method: req.method ?? "GET",
          path: url.pathname,
        });

        if (result === NoContent) {
          status = 204;
          res.writeHead(204).end();
        } else if (result instanceof Created) {
          status = 201;
          send(res, 201, result.value);
        } else {
          send(res, 200, result);
        }
      } catch (err) {
        if (err instanceof WriteError) {
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
