/**
 * Migration runner.
 *
 * Applies db/migrations/*.sql in filename order, once each, recording what ran
 * in a schema_migrations ledger. Forward-only: a migration that has already run
 * is never re-applied and never edited in place.
 *
 * Safety properties:
 *
 *  - Each migration runs inside a single transaction with ON_ERROR_STOP, so a
 *    failure leaves the database exactly as it was rather than half-migrated.
 *  - Each file's checksum is stored. If a file changes after being applied the
 *    runner refuses to continue, because the database no longer matches the
 *    migration history and silently proceeding would hide that.
 *  - Connection details come from the environment. Nothing is hardcoded and no
 *    production host is reachable by default.
 *
 * The project has no node_modules by design, so this drives `psql` rather than
 * a database driver.
 *
 * Usage:
 *   node db/migrate.ts            apply pending migrations
 *   node db/migrate.ts --status   list applied and pending, change nothing
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const migrationsDir = join(root, "db", "migrations");

/* ------------------------------ connection ------------------------------ */

export interface DbConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

export function dbConfig(): DbConfig {
  const cfg = {
    host: process.env.PGHOST ?? "127.0.0.1",
    port: process.env.PGPORT ?? "5432",
    user: process.env.PGUSER ?? "earthtrade",
    password: process.env.PGPASSWORD ?? "earthtrade_dev_only",
    database: process.env.PGDATABASE ?? "earthtrade_dev",
  };

  // Local development only. A remote host has to be opted into explicitly so
  // a stray environment variable cannot point this at something real.
  const local = ["127.0.0.1", "localhost", "::1", "/var/run/postgresql"];
  if (!local.includes(cfg.host) && process.env.EARTHTRADE_ALLOW_REMOTE_DB !== "yes") {
    throw new Error(
      `Refusing to connect to non-local host ${JSON.stringify(cfg.host)}. ` +
        `Set EARTHTRADE_ALLOW_REMOTE_DB=yes to override.`,
    );
  }
  return cfg;
}

/** Runs SQL through psql. Returns stdout. Throws with psql's message on error. */
export function psql(sql: string, opts: { file?: string; quiet?: boolean } = {}): string {
  const cfg = dbConfig();
  const args = [
    "-h", cfg.host,
    "-p", cfg.port,
    "-U", cfg.user,
    "-d", cfg.database,
    "-v", "ON_ERROR_STOP=1",
    "--no-psqlrc",
    "-X",
  ];
  if (opts.quiet) args.push("-q");
  if (opts.file) args.push("-f", opts.file);
  else args.push("-c", sql);

  try {
    return execFileSync("psql", args, {
      env: { ...process.env, PGPASSWORD: cfg.password },
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; message: string };
    throw new Error(e.stderr?.trim() || e.stdout?.trim() || e.message);
  }
}

/** Single value from a query, as text. */
export function scalar(sql: string): string {
  const cfg = dbConfig();
  const out = execFileSync(
    "psql",
    ["-h", cfg.host, "-p", cfg.port, "-U", cfg.user, "-d", cfg.database,
     "-v", "ON_ERROR_STOP=1", "--no-psqlrc", "-X", "-tA", "-c", sql],
    { env: { ...process.env, PGPASSWORD: cfg.password }, encoding: "utf8" },
  );
  return out.trim();
}

/* ------------------------------- ledger --------------------------------- */

function ensureLedger(): void {
  psql(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename    text PRIMARY KEY,
       checksum    text NOT NULL,
       applied_at  timestamptz NOT NULL DEFAULT now()
     );`,
    { quiet: true },
  );
}

interface Applied {
  filename: string;
  checksum: string;
}

function appliedMigrations(): Map<string, string> {
  const out = scalar(
    `SELECT coalesce(string_agg(filename || E'\\t' || checksum, E'\\n' ORDER BY filename), '')
       FROM schema_migrations;`,
  );
  const map = new Map<string, string>();
  for (const line of out.split("\n").filter(Boolean)) {
    const [name, sum] = line.split("\t");
    if (name && sum) map.set(name, sum);
  }
  return map;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

function migrationFiles(): { filename: string; path: string; checksum: string }[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((filename) => {
      const path = join(migrationsDir, filename);
      return { filename, path, checksum: sha(readFileSync(path, "utf8")) };
    });
}

/* --------------------------------- run ---------------------------------- */

function main(): void {
  const statusOnly = process.argv.includes("--status");
  const cfg = dbConfig();

  ensureLedger();
  const applied = appliedMigrations();
  const files = migrationFiles();

  // An applied migration whose file has changed means the database no longer
  // matches its own history. Stop rather than guess which is correct.
  const drifted = files.filter(
    (f) => applied.has(f.filename) && applied.get(f.filename) !== f.checksum,
  );
  if (drifted.length) {
    console.error("Migration files changed after being applied:\n");
    for (const d of drifted) console.error(`  ${d.filename}`);
    console.error(
      "\nMigrations are forward-only. Add a new migration rather than editing\n" +
        "one that has already run.",
    );
    process.exit(1);
  }

  const pending = files.filter((f) => !applied.has(f.filename));

  console.log(`database  ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);
  console.log(`applied   ${applied.size}`);
  console.log(`pending   ${pending.length}`);

  if (statusOnly) {
    console.log();
    for (const f of files) {
      console.log(`  ${applied.has(f.filename) ? "applied" : "PENDING"}  ${f.filename}`);
    }
    return;
  }

  if (!pending.length) {
    console.log("\nnothing to do");
    return;
  }

  console.log();
  const staging = mkdtempSync(join(tmpdir(), "et-migrate-"));
  try {
    for (const f of pending) {
      process.stdout.write(`  ${f.filename} ... `);

      // The migration and its ledger entry go in one transaction, so a failure
      // rolls back both and the file is retried cleanly next run.
      const batch = join(staging, f.filename);
      writeFileSync(
        batch,
        `BEGIN;\n${readFileSync(f.path, "utf8")}\n` +
          `INSERT INTO schema_migrations (filename, checksum) ` +
          `VALUES ('${f.filename}', '${f.checksum}');\nCOMMIT;\n`,
        "utf8",
      );
      psql("", { file: batch, quiet: true });
      console.log("ok");
    }
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  console.log(`\napplied ${pending.length} migration(s)`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  main();
}
