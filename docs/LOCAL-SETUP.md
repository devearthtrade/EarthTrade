# Running EarthTrade on your own machine

Everything in this guide was executed and verified on a clean database and a
brand-new PostgreSQL role before being written down. Nothing here is assumed.

## Why a Claude session's "localhost" is not yours

A claude.ai/code web session runs in a remote container in the cloud. Servers
started there bind inside that container, and `localhost` always means "this
machine" — so a URL like `http://localhost:4173` printed by the session refers
to the container, not to your computer. The project itself is fully portable;
it just has to be cloned and started on the machine whose browser you are using.

---

## Path 1 — review the site (Node only, no database)

The repository carries a catalog snapshot (`src/data/generated/catalog.json`),
and the build can render from it directly. Two commands, one prerequisite.

**Requires:** [Node.js](https://nodejs.org) 22.18 or newer. Nothing else — the
project has zero npm dependencies, so there is no `npm install` step at all.

```sh
git clone -b claude/earthtrade-premium-redesign-ucf0x6 https://github.com/devearthtrade/EarthTrade.git
cd EarthTrade

EARTHTRADE_CATALOG_SOURCE=json node src/build.ts
node src/serve.ts
```

Open **http://localhost:4173**. All 164 pages, 106 products, every image.

The JSON snapshot differs from the PostgreSQL catalog in exactly five product
pages (a duplicate-image quirk documented in `docs/DATA-LAYER-VERIFICATION.md`).
For reviewing the site, it is the same site.

> On Windows, set the variable first (`set EARTHTRADE_CATALOG_SOURCE=json` in
> cmd, `$env:EARTHTRADE_CATALOG_SOURCE="json"` in PowerShell), or use WSL.

---

## Path 2 — the full application (storefront + Admin Dashboard)

Adds the database, which the Dashboard requires and which is the real source of
truth for the catalog.

**Requires, in addition to Node:**

- **PostgreSQL 14 or newer** (developed and tested on 16), running locally.
- The `psql` command on your PATH (the migration runner and seeder drive it;
  the application itself does not).
- Password authentication must be `scram-sha-256` — the default since
  PostgreSQL 14. The project's database client deliberately does not speak the
  legacy `md5` scheme; if your server was configured for md5, set
  `password_encryption = scram-sha-256` and update `pg_hba.conf`.

### One-time setup

Create the role and database (as the `postgres` superuser):

```sql
CREATE ROLE earthtrade LOGIN PASSWORD 'earthtrade_dev_only';
CREATE DATABASE earthtrade_dev OWNER earthtrade;
```

That password is a local development credential, not a secret. To use different
values, set `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PGDATABASE`
(defaults documented in `docs/DATA-LAYER.md`). Non-local hosts are refused by
design unless explicitly overridden.

Then, from the repository:

```sh
node db/migrate.ts             # applies all 14 migrations
node db/seed.ts                # loads the 110-product catalog (idempotent)
node db/seed-presentation.ts   # brand stories, collection copy, curation
node db/verify.ts              # optional: confirms parity, "all checks passed"
```

### Day to day

```sh
node src/build.ts              # builds dist/ from PostgreSQL
node src/serve.ts              # storefront  -> http://localhost:4173
```

and in a second terminal:

```sh
node src/server/api/serve.ts   # Dashboard   -> http://127.0.0.1:4000/admin
```

The Dashboard binds to loopback only and refuses anything else. After editing
products there, re-run `node src/build.ts` to see the change on the storefront.

`./verify.sh` runs the entire verification suite (migrations, seeds, 79
data-layer checks, 153 tests, both builds and their diff). It uses
Debian-style `pg_ctlcluster` to start PostgreSQL if needed; on other systems,
start PostgreSQL yourself first and the rest is portable.

### If you see "Read-only snapshot"

That message never comes from your local Dashboard — it comes from the hosted
**snapshot** of the Dashboard on claude.ai, which shows the data but disables
every form by construction. The two are easy to confuse because they look
identical:

| | URL | Can edit? |
|---|---|---|
| Live Dashboard | `http://127.0.0.1:4000/admin` — started by *you*, above | Yes |
| Hosted snapshot | `https://claude.ai/code/artifact/…` | Never |

If a page refuses to save and shows that message, check the address bar: you
are on claude.ai. Start the live Dashboard with the command above and use
`127.0.0.1:4000` instead.

---

## Working on the branch from two places

The branch `claude/earthtrade-premium-redesign-ucf0x6` is ordinary git. A
cloud Claude session and your local machine can both work on it with the usual
discipline: **pull before starting, push when done**, so neither side builds on
a stale copy.

Two things are worth knowing:

**Code and catalog travel in git; database *edits* do not.** Today the entire
database is reproducible from the repository — migrations plus the two seed
files rebuild it identically, which is verified from empty on every run. But a
change made through the Dashboard (editing a product, resolving a curation gap,
counting stock) lives only in the database of the machine where it was made.
Until an export step exists, do real content editing on one machine — yours —
and treat the other's database as disposable.

**Claude can also work directly on your machine.** The web session always runs
in the cloud, but Claude Code also runs as a CLI, a desktop app, and IDE
extensions. Opened in your local clone, it works on the same machine your
browser is on — `localhost` is then genuinely yours, and the same branch keeps
the history in one place.

---

## Review environments and hosting

Nothing is deployed anywhere, and no hosting access is needed for any of the
above. When the project reaches the stage where a shared review link is wanted:

- The **storefront** is a static `dist/` folder. Any static host can serve it
  as-is; no Node or database runs in production for it.
- The **Admin Dashboard** is a Node process plus PostgreSQL, and must never be
  exposed without authentication being built first — it is loopback-only today
  for exactly that reason.

Both are decisions to make deliberately, not prerequisites for local work.
