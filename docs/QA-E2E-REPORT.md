# End-to-end QA — local Dashboard and storefront

Driven as a store administrator would: real HTML forms posted to the running
server, the database inspected after each step, the storefront rebuilt and read,
and every page rendered in Chromium at 390 / 768 / 1024 px.

**~150 checks across 30 workflows. Two defects found and fixed. Two limitations
recorded that are decisions rather than bugs.**

---

## Results by workflow

| # | Workflow | Result |
|---|---|---|
| 1 | Access behaviour | **PASS** — loopback only; unreachable from the container IP; refuses to bind `0.0.0.0`. No login, by design |
| 2 | List, search, filters, pagination | **PASS** — search, brand/category/status/stock filters, combinations, empty state, paging both directions |
| 3 | Open an existing product | **PASS** — all seven panels render |
| 4 | Edit title, description, price, SKU, weight, tags | **PASS** |
| 5 | Save without changing anything | **PASS** — title, copy, tags, SEO and held-back copy all identical; no audit row |
| 6 | Save after changing one field | **PASS** — only that field moves |
| 7 | Held-back copy preserved | **PASS** |
| 8 | Edit and release held-back copy | **PASS** — rewording releases it into the description; restoring the wording re-holds it |
| 9 | Create a product | **PASS** — draft, unpublished, nothing invented |
| 10 | Create / edit / deactivate a variant | **PASS** — deactivated row is kept |
| 11 | Change variant price | **PASS** — public reference unchanged |
| 12 | Add inventory | **PASS** |
| 13 | Change inventory | **PASS** — including → 0 (counted) and → uncounted, which stay distinct |
| 14 | Invalid inventory values | **PASS** — negative, fractional, non-numeric and empty-with-Set all refused; count untouched |
| 15 | Upload a product image | **PASS** — external URLs and missing alt text refused |
| 16 | Change primary image | **PASS** |
| 17 | Reorder images | **PASS** |
| 18 | Remove an image | **PASS** |
| 19 | Create / edit a brand | **PASS** — including SEO fields and duplicate-slug refusal |
| 20 | Create / edit a collection | **PASS** |
| 21 | Add / remove products from collections | **PASS** |
| 22 | Collection ordering | **PASS** |
| 23 | Publish / unpublish | **PASS** — unpublishing without a reason refused |
| 24 | Archive / unarchive | **PASS** — archived cannot be published; unarchive returns to draft, not to the storefront |
| 25 | Compliance review | **PASS** — all five views; dry-run screen writes nothing; a banned name blocks publication |
| 26 | The 61 curation gaps | **PASS** — all 61 listed; mapping with no product named refused; map, reopen and remove all behave |
| 27 | Audit after every mutation | **PASS** — all 25 action types recorded, each naming the actor |
| 28 | Changes appear on the storefront | **PASS** — create, edit, image order, collection membership, publish and unpublish all round-trip through a rebuild |
| 29 | Search after adding / editing | **PASS** — new products, renames and new tags all findable; withheld products stay out of the public index |
| 30 | Mobile layout | **FIXED** — see defect 2 |

---

## Defects found and fixed

### 1. A draft could become permanently undeletable — DATA / UX

Creating a product to try something out, typing a stock count into it, then
deleting it was refused: *"1 stock movement(s) are recorded against it."*

The guard came from the previous QA pass and was too broad. Its reasoning holds
for a real product with real stock history; for a draft that was never published
it does not. No order can reference it and no customer ever saw it — the
movement is somebody counting stock on a product that did not exist publicly.

The effect was that ordinary experimentation left permanent clutter with no way
to clear it.

*Fixed:* a never-published draft deletes, and its movements go with it. What the
count was is written into the audit record first, and `audit_log` does not
reference products, so it survives the deletion. Anything that has ever been
published is still archived, never deleted.

### 2. Untyped inputs were unstyled, and pushed the page sideways on a phone — UI

The stylesheet listed input types individually — `input[type=text]`,
`input[type=number]`, and so on. Several controls are written without a `type`
attribute: the image alt-text field, the variant row fields, the curation
replacement field, the unpublish reason field. None of them matched, so they
rendered with browser defaults.

Worse, they kept the intrinsic width a text input carries from its `size`
attribute — about 185 px — which outranks `width: 100%` and refuses to shrink.
In the media grid's 155 px column that pushed the whole page 5 px wider than the
viewport, so the product editor scrolled sideways on a 390 px screen.

*Fixed:* the rule matches every text-like control, and sets `min-width: 0`. The
exclusions sit inside `:where()` so the rule keeps element-level specificity —
written as a bare `:not()` chain it outranked `input:disabled`, and the
read-only handle field stopped looking read-only. That regression appeared
during the fix and is covered by its own test.

**Verified:** 13 pages × 3 widths (390 / 768 / 1024) — **0 of 39 overflow**.

---

## Limitations recorded, not fixed

### A product that has ever been published cannot be removed

Only archived. That is the right default for a commerce catalog — links,
bookmarks and later order lines may reference it, and archiving removes it from
the storefront just as completely while keeping all of them resolvable.

It does mean a product published by mistake is permanent, and that restoring
this QA run's baseline had to go outside the application. Worth deciding, once
orders exist to check against, whether to add a narrow path for discarding
something that was live briefly and never ordered.

### `GET /api/inventory` truncates silently

Defaults to 100 rows and does not report the total, so a caller cannot tell a
short page from the end of the data. The Dashboard's own inventory screen uses
300 and says when it has capped. Minor, and only affects direct API callers.

---

## Two of my own checks were wrong

Worth recording, because both nearly became false defect reports.

**Chromium's headless viewport floors at about 500 px.** `--window-size=390`
produced a 390 px *image* of a 500 px *layout*, so screenshots showed navigation
and form fields clipped at the edge. That reads exactly like horizontal
overflow and is not. Every measurement here therefore renders the page inside an
iframe of the width under test, which gets a real viewport, and reads
`scrollWidth` back out of the DOM rather than off a picture.

**`innerWidth` counts the vertical scrollbar and `scrollWidth` does not**, so a
page that fits reads as `-15`. Asserting `== 0` failed all 39 combinations at
first. Only a positive value means content is pushing the page sideways.

---

## Tooling added

`tools/check-layout.py` — renders every Dashboard page at 390 / 768 / 1024 px and
reports any element pushing the page sideways, ignoring anything inside a scroll
container. Horizontal overflow is the one responsive failure a screenshot will
not show you, and a single control with an intrinsic minimum reintroduces it.

```sh
QA_BASE=http://127.0.0.1:4000 python3 tools/check-layout.py
```

It needs Chromium, so it is a tool rather than part of the test suite.

---

## State after the run

Restored to **110 products / 110 variants / 60 held-back blocks / 61 open
curation gaps / 0 inventory levels**. Storefront builds 164 pages and still
differs from the JSON build only in the five documented duplicate-image pages.

`./verify.sh`: 79 data-layer checks, 67 catalog tests, **86 Dashboard tests**
(82 → 86, four added for the two defects), all passing.
