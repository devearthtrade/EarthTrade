# Database security considerations

Covers the local development foundation as built, and what must change before
anything touches real customers or money. Nothing here is deployed; there is no
production database, domain, or external service connected.

## What is in place now

**Local-only by default, with an explicit guard.** Connection details come from
the environment and default to `127.0.0.1`. A non-local host is *refused* unless
`EARTHTRADE_ALLOW_REMOTE_DB=yes` is set, so a stray `PGHOST` cannot point local
tooling at something real.

**No secrets in the repository.** The development password
(`earthtrade_dev_only`) is a placeholder, not a credential: it protects nothing,
reaches nothing, and is overridden by the environment. No API key, token or
production connection string exists in the codebase.

**Migrations cannot silently diverge.** Each migration runs with
`ON_ERROR_STOP` inside one transaction alongside its ledger entry, so a failure
rolls back both. Each file's checksum is stored; if an applied migration is
later edited the runner refuses to continue rather than leaving the database
disagreeing with its own history.

**Money is integer cents with database-level guards.** `price_cents >= 0`, and
`compare_at_cents >= price_cents` because a strike-through below the real price
is a pricing error rather than a sale. Float arithmetic never touches the money
path.

**Inventory cannot go impossible.** `on_hand >= 0`, `reserved >= 0`, and
`reserved <= on_hand`. Reservations are designed to be taken with a conditional
update guarded on sellable quantity, so two concurrent checkouts cannot both
claim the last unit.

**Compliance is enforced structurally, not by convention.** `publishable`,
`withheld_reason`, `product_title_matches` and `product_quarantined_copy` are
columns and tables. A product withheld for a banned claim cannot be published by
forgetting a filter, and `products_withheld_has_reason` requires a stated reason
for any withheld product.

**No third-party host can enter the data.** `media_assets.storage_key` carries a
CHECK rejecting anything matching `^[a-z]+://`, so an absolute URL, including a
foreign CDN, cannot be inserted.

**The seeder builds SQL with escaped literals.** Every interpolated value goes
through a quoting helper that doubles single quotes. This is seed tooling run by
hand against a local database, not a request path.

## What must change before production

**Parameterised queries, not string building.** The seeder's literal-quoting
approach is acceptable for a one-way local seed of data we control. It is *not*
acceptable for anything handling request input. Application code must use bound
parameters, which also means adopting a real driver once `npm` is available.

**Least privilege.** `earthtrade` currently owns its database, which suits
migrations. Runtime should connect as a separate role with `SELECT`, `INSERT`,
`UPDATE`, `DELETE` on application tables and no DDL rights. Migrations run as
the owner in a deploy step, not by the application at boot.

**Credential handling.** Secrets from a secret manager or environment injection,
never a file in the repository. Separate credentials per environment, rotated
independently.

**Transport.** TLS required, certificate verification on, no plaintext
connections between the API and the database.

**Backups and recovery.** Point-in-time recovery, with a restore actually
rehearsed. An untested backup is a hypothesis.

## Considerations that arrive with later phases

These are not gaps in what was built; the tables do not exist yet.

**Customer PII.** When `customers` lands: encryption at rest, IP addresses
stored hashed, retention limits, and export and deletion paths for GDPR and
CCPA. Sessions must be opaque server-side tokens stored hashed, in httpOnly
cookies, revocable server-side — not JWTs in `localStorage`, where an XSS bug
hands out a portable unrevokable credential.

**Passwords.** Argon2id, constant-time comparison, progressive lockout, and
login responses identical for unknown-email and wrong-password so the endpoint
is not an account-enumeration oracle.

**Payments.** Card data must never reach our servers. A provider's hosted
fields keep the deployment in PCI SAQ-A scope. The authoritative order total is
computed server-side from the database; the browser sends variant and quantity
and nothing else. Webhooks verify signatures and are idempotent on the
provider's event id.

**Admin access.** Separate auth surface on its own subdomain, mandatory MFA for
privileged roles, and every price, stock and publication change written to
`audit_log` in the same transaction as the change so the log cannot drift.

## Known limitation in the current tooling

The migration runner and seeder shell out to `psql` because this project has no
`node_modules` and the package registry is unreachable from the build
environment. That is sound for local schema work, and the executed SQL is
generated from data we control rather than from user input.

It is not the shape production application code should take. When a driver can
be installed, the runtime data layer should use it with bound parameters and a
connection pool. The migration runner may reasonably keep driving `psql`.
