# Admin Dashboard

A local, server-rendered dashboard over the same PostgreSQL database and write
layer the management API uses.

```sh
node src/server/api/serve.ts     # http://127.0.0.1:4000/admin
```

## Security posture

**Loopback only, unauthenticated.** The server refuses to bind to any address
other than `127.0.0.1`; a test asserts this. There is no login, because there is
nobody else on the network to authenticate.

That follows from the binding, not from a decision to skip security. Before this
is reachable from anywhere else it needs authentication, authorisation and rate
limiting, plus a review of which roles may do what.

What is in place regardless:

- **All validation is server-side.** Forms post strings; the server decides what
  they mean and refuses anything it cannot accept. A test posts malformed
  prices, weights and titles and asserts each is rejected and nothing written.
- **No SQL from UI code.** Every screen and every action goes through
  `repositories/`. The Dashboard issues no queries of its own.
- **Escape by default.** Pages are built with the same `html` helper the
  storefront uses. Catalog copy — which people paste in from anywhere — is
  escaped, never rendered as markup.
- **`noindex`, `X-Frame-Options: DENY`, `nosniff`, `no-store`** on every page.
- **Post-redirect-get.** Every action ends in a redirect, so refreshing cannot
  repeat a write.

## Screens

| Path | What it does |
|---|---|
| `/admin` | Counts, what is being withheld, inventory states, recent changes |
| `/admin/products` | Search, filter by brand, category, status and stock; paginated |
| `/admin/products/new` | Create |
| `/admin/products/:handle` | Full editor: details, SEO, publication, compliance, collections, variants, media, history |
| `/admin/inventory` | Stock across all variants, filtered by state |
| `/admin/collections` | List and create |
| `/admin/collections/:handle` | Copy, SEO, curated order, membership with its origin |
| `/admin/brands` | List and create |
| `/admin/brands/:slug` | Copy, SEO, logo, hero image, products |
| `/admin/compliance` | Quarantined copy, banned names, withheld products, review flags, and a dry-run screen |
| `/admin/curation` | The unresolved curated references, and how to settle each |
| `/admin/audit` | The full trail, filterable by actor, action and entity |

## Rules the Dashboard cannot break

### Compliance

`src/lib/compliance.ts` is the only screen, and the Dashboard has no way past
it. Copy is screened on every save; a name that states a banned claim withholds
the product; editing a live product's name into one withdraws it immediately.
Publication refuses — naming every reason — when a product is archived,
unnamed-safe, variantless or unpriced.

A test tries every route that touches publication against a product whose name
fails the screen, and asserts none of them publishes it.

### Inventory has three states

`unknown` (no level row), `zero` (a row saying none), `positive`. Setting a
count creates a row; **Uncount** deletes it. Nothing converts unknown into zero:
there is no value meaning "unknown" inside a row, because a nullable integer
would invite exactly that confusion.

An empty field with **Set** pressed is refused rather than read as uncount.

### Nothing is deleted that anyone might still reach

Deactivating a variant keeps the row, so a cart holding it still resolves.
Archiving a product keeps everything. Deletion is offered only for a product
that has never been published *and* has no recorded stock movements — a draft
created by mistake. Anything else is archived.

### Broken curation is never guessed

61 curated references name products the catalog no longer has. Each can be
**mapped** to a product you name, **removed**, or **reviewed**. Similar handles
are listed to shorten the search; no code path acts on them. A wrong guess would
put the wrong product under a heading somebody chose by hand, and a similar
handle is not evidence.

### Every mutation is audited

The audit row is written on the same connection, inside the same transaction, as
the change — so a change that rolls back takes its record with it. An update
that changed nothing writes no row. The log is append-only: nothing updates or
deletes from it, including test cleanup.

Actor is recorded as `name (via)` — `local-admin (dashboard)`, `api-client
(api)`, `seed`. There is no authentication, so it is a declaration rather than a
proof, but it makes an unexpected change traceable and the column is ready for a
real identity.

## Layout

Three breakpoints. Above 1024px, a fixed sidebar. Below, the sidebar becomes a
horizontal chip row. Below 640px the topbar stacks; tables stay horizontally
scrollable rather than reflowing, because an admin comparing rows needs the
columns to stay aligned.

The stylesheet is separate from `src/site/styles.css` and borrows only the
palette. **No storefront file was changed.**

## Tests

`node tests/admin.test.ts` — 71 tests. They drive real HTML forms against the
real server and check the database, and where it matters the built storefront
catalog. Covered: create to storefront, edit, publish, unpublish, archive;
variants create to edit to deactivate; media upload and reorder reaching the
storefront; collections create, assign and remove; brands create and edit;
compliance flagging, blocking and approval; inventory across all four
transitions; and an audit record for every mutation.
