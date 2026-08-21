/**
 * Database connection settings.
 *
 * Everything comes from the environment; nothing about a real deployment is
 * written down here. The default is a local development database that only
 * exists on a developer's own machine.
 */

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  /** Maximum simultaneous connections. The build is a burst of reads. */
  poolSize: number;
}

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "/var/run/postgresql"]);

export function dbConfig(): DbConfig {
  const host = process.env.PGHOST ?? "127.0.0.1";

  // A guard, not a formality. This layer is under active development and is
  // one environment variable away from talking to something real. Pointing it
  // at a non-local host has to be a decision someone made on purpose.
  if (!LOCAL_HOSTS.has(host) && process.env.EARTHTRADE_ALLOW_REMOTE_DB !== "yes") {
    throw new Error(
      `Refusing to connect to non-local database host ${JSON.stringify(host)}.\n` +
        `This layer is for local development. Set EARTHTRADE_ALLOW_REMOTE_DB=yes to override.`,
    );
  }

  return {
    host,
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? "earthtrade",
    password: process.env.PGPASSWORD ?? "earthtrade_dev_only",
    database: process.env.PGDATABASE ?? "earthtrade_dev",
    poolSize: Math.max(1, Number(process.env.PGPOOL_SIZE ?? 4)),
  };
}

/** Where the catalog is read from. Postgres unless explicitly overridden. */
export function catalogSource(): "postgres" | "json" {
  const s = process.env.EARTHTRADE_CATALOG_SOURCE ?? "postgres";
  if (s !== "postgres" && s !== "json") {
    throw new Error(`EARTHTRADE_CATALOG_SOURCE must be "postgres" or "json", got ${JSON.stringify(s)}`);
  }
  return s;
}
