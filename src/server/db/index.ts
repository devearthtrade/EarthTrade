/**
 * The database entry point. Everything above this line talks to Postgres
 * through these three functions and never touches the wire protocol directly.
 *
 * All SQL here and in the repositories uses `$1`-style placeholders. Values are
 * sent as separate protocol messages and are never spliced into statement
 * text, so a product title containing a quote is a product title, not SQL.
 */

import { dbConfig } from "./config.ts";
import { Pool } from "./pool.ts";
import type { Connection, QueryResult } from "./protocol.ts";

export { PgError } from "./protocol.ts";
export type { QueryResult } from "./protocol.ts";

let pool: Pool | null = null;

function get(): Pool {
  if (!pool) {
    const cfg = dbConfig();
    pool = new Pool(
      {
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
      },
      cfg.poolSize,
    );
  }
  return pool;
}

/** Runs a parameterised query and returns all rows. */
export function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return get().use((c) => c.query<T>(sql, params));
}

/** Rows only, for the common case. */
export async function rows<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await query<T>(sql, params)).rows;
}

/** A single row, or null. More than one row is a bug in the caller's SQL. */
export async function one<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const r = await query<T>(sql, params);
  if (r.rows.length > 1) {
    throw new Error(`expected at most one row, got ${r.rows.length}`);
  }
  return r.rows[0] ?? null;
}

/**
 * Runs several statements on one connection. Reads that must agree with each
 * other belong in here rather than in separate `query` calls, which may land on
 * different connections and therefore different snapshots.
 */
export function withConnection<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
  return get().use(fn);
}

/** Releases every connection. Call before a script exits. */
export async function close(): Promise<void> {
  await pool?.close();
  pool = null;
}
