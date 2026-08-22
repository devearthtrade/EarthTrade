# Management API

A local HTTP API over the catalog, so products, variants, media and collection
membership can be created and edited without touching source code. It is what
the Admin Dashboard will call. The Dashboard itself does not exist yet.

```sh
node src/server/api/serve.ts            # http://127.0.0.1:4000
node src/server/api/serve.ts --port 4100
```

## Security posture

**Loopback only, and unauthenticated.** The server refuses to bind to any
address other than `127.0.0.1`. There is no authentication, no authorisation and
no rate limiting, because there is nobody else on the network to authenticate —
every request originates on this machine.

That is a consequence of the binding, not a decision to skip security. Before
this is reachable from anywhere else it needs all three, plus a review of what
each endpoint should be allowed to do and by whom. The bind check exists so that
conversation has to happen before the exposure does.

## Conventions

- JSON in, JSON out. Bodies are capped at 1 MB.
- Money is always **integer cents**. `1999`, never `19.99`. A non-integer is
  rejected rather than rounded.
- `PATCH` distinguishes **absent** from **null**. A key you do not send is left
  alone; a key you send as `null` is cleared.
- Nothing is invented. A field you do not supply stays empty — no generated SKU,
  no placeholder price, no filler description.

### Status codes

| Code | Meaning |
|---|---|
| 200 | Read or update succeeded |
| 201 | Created |
| 204 | Done, nothing to return |
| 400 | The body was not JSON, or not an object |
| 404 | No such product, variant, collection or endpoint |
| 405 | The path exists but not for that method |
| 409 | Refused because of the current state (duplicate handle, unpublishable product) |
| 413 | Body too large |
| 422 | The input was understood and rejected |

Errors are `{"error": "...", "detail": {...}}`, where `detail` carries structured
context when there is any — publication blockers, for instance.

## Endpoints

### Products

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/products` | `?published=true\|false&brand=&category=&q=&limit=&offset=` |
| `POST` | `/api/products` | Requires `handle`, `title`, `brandSlug` |
| `GET` | `/api/products/:handle` | Full record, including variants, media and compliance |
| `PATCH` | `/api/products/:handle` | Any subset of the creatable fields |
| `POST` | `/api/products/:handle/publish` | Refuses, with reasons, if it cannot |
| `POST` | `/api/products/:handle/unpublish` | Requires `reason` |
| `POST` | `/api/products/:handle/archive` | |
| `POST` | `/api/products/:handle/unarchive` | Returns it to draft, not to the storefront |

### Variants

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/products/:handle/variants` | |
| `POST` | `/api/products/:handle/variants` | Requires `title`, `priceCents` |
| `GET` | `/api/variants/:ref` | |
| `PATCH` | `/api/variants/:ref` | |
| `DELETE` | `/api/variants/:ref` | Deactivates; the row stays |

### Media

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/products/:handle/media` | Images, and images referenced but not yet supplied |
| `POST` | `/api/products/:handle/media` | Requires `src` (relative path) and `alt` |
| `PUT` | `/api/products/:handle/media/order` | `order` must list every image |
| `DELETE` | `/api/products/:handle/media/:src` | |

### Collections, brands, compliance

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/collections`, `/api/collections/:handle` | |
| `PUT` | `/api/products/:handle/collections` | Sets curated membership |
| `GET` | `/api/brands`, `/api/brands/:slug` | |
| `POST` | `/api/compliance/screen` | Dry run — writes nothing |
| `GET` | `/api/compliance/summary` | |
| `GET` | `/api/withheld` | Withheld products and why |
| `GET` | `/api/health` | |

## Rules the API enforces

### Compliance is not skippable

Every write of a product name or description is screened by `src/lib/compliance.ts` —
the same module the CSV importer uses. There is no flag to bypass it.

- **Copy that fails** is stored in `product_quarantined_copy` and left out of the
  description. Kept, auditable, reversible; not rendered.
- **A name that fails** withholds the product. A product name cannot be quietly
  omitted from a page, so the record is held back instead.
- **Editing a published product's name into a banned claim** withdraws it
  immediately, rather than recording a problem and leaving the page up.

`POST /api/compliance/screen` runs the same screen and writes nothing, so an
editor can see what would be held back before committing to it.

### Publication has to be earned

`POST /api/products/:handle/publish` refuses, and names every reason, when the
product is archived, its name states a banned claim, it has no variant, or it
has no price above zero. None of these can be overridden through the API,
because each is a fact about the product rather than a preference.

Unpublishing requires a reason. The schema requires one on every withheld
product, and a product that vanished from the storefront with no explanation is
a support ticket nobody can answer.

### Media stays local

`src` must be a path this site serves. An absolute URL is refused — media on
someone else's host is a dependency on that host staying up, staying free, and
continuing to want to serve us. Alt text is required: a product image without it
is unusable to anyone reading the page with a screen reader.

### Nothing is deleted

`DELETE /api/variants/:ref` deactivates. Archiving a product hides it. In both
cases the row remains, so a cart or an order that references it stays
resolvable, and reversing the decision is an edit rather than a restore.

The one exception is `DELETE .../media/:src`, which removes a link between a
product and an image. The image asset itself stays.

## Worked example

```sh
API=http://127.0.0.1:4000

curl -sX POST $API/api/products -H 'content-type: application/json' -d '{
  "handle": "example-product",
  "title": "Example Product",
  "brandSlug": "solutionshocl",
  "categorySlug": "cleaning",
  "description": ["What it is and what it does."]
}'

curl -sX POST $API/api/products/example-product/variants \
  -H 'content-type: application/json' \
  -d '{"title": "500 g", "priceCents": 2495, "sku": "EX-500", "weightGrams": 500}'

curl -sX POST $API/api/products/example-product/media \
  -H 'content-type: application/json' \
  -d '{"src": "/images/example.jpg", "alt": "The product on a kitchen counter"}'

curl -sX PUT $API/api/products/example-product/collections \
  -H 'content-type: application/json' -d '{"collections": ["household-cleaning"]}'

curl -sX POST $API/api/products/example-product/publish
```

The product then appears in the next `node src/build.ts`.

## Tests

`node tests/catalog.test.ts` — 67 tests covering create, read, update, archive,
publish and unpublish, variants, media, collection assignment, compliance
enforcement, and the HTTP layer. They run against the real local database, clean
up after themselves, and end by asserting the 110 imported products are
unchanged.
