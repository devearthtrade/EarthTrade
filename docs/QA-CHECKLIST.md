# Manual QA checklist — local Dashboard and storefront

Written before running anything, so the checks are chosen by what could plausibly
be wrong rather than by what happens to pass.

The automated suites (67 catalog + 71 Dashboard + 79 data-layer) already cover
the happy paths and the main refusals. This checklist deliberately targets what
they do **not**: round-trip fidelity, edge-case input, states the tests never
construct, and interactions between features.

Legend: **PASS** · **FAIL** (defect found) · **RISK** (works, but fragile)

---

## A. Product editor round-trip fidelity

The editor renders a form from the database and posts it back. Anything the form
does not carry is at risk of being silently dropped on save.

- **A1** Product with quarantined copy → open editor → Save without editing →
  is the quarantined copy still there?
- **A2** Product with `subscription = true` → Save → still true?
- **A3** Product with `card_title` → Save → preserved?
- **A4** Tag order preserved through a save?
- **A5** Save with no changes → no audit row written?
- **A6** Product whose handle contains `®` (`superthrive®`) → editor loads, saves,
  and its links resolve?
- **A7** Withheld product (zero price) → open → Save → still withheld for the
  same reason?

## B. Pricing

- **B1** Price of 0 → publish refused
- **B2** compare-at below price → refused
- **B3** compare-at cleared by submitting an empty field
- **B4** Very large price (≥ 2^31) → refused rather than silently wrapped
- **B5** List page shows the lowest variant price
- **B6** Price survives an unrelated product edit

## C. Variants

- **C1** Duplicate SKU → clean refusal, not a raw database error
- **C2** Deactivate the last variant of a published product → refused
- **C3** Deactivate a variant, then build → storefront still renders the product
- **C4** Deactivate *all* variants of an unpublished product, then publish → refused
- **C5** Variant `ref` unchanged by an edit
- **C6** Two variants with the same title but no SKU → distinct refs

## D. Media

- **D1** `src` with surrounding whitespace
- **D2** `src` with a query string or fragment
- **D3** Same image attached to two products → both keep it
- **D4** Remove the primary image → the next one becomes primary
- **D5** Reorder posting a duplicate entry → refused
- **D6** Alt text containing markup → escaped, not rendered
- **D7** Removing an image leaves the asset row for other products

## E. Brands

- **E1** Brand with no products → its admin page renders
- **E2** Uppercase slug → refused
- **E3** Move a product to another brand → both brands' counts update
- **E4** Brand story with irregular blank lines → paragraphs split sensibly
- **E5** Brand SEO fields round-trip
- **E6** Duplicate slug → refused

## F. Collections

- **F1** Collection with no members → admin page renders
- **F2** Curated order naming a non-existent handle → refused, nothing written
- **F3** Curated order with a duplicate handle → does not create two rows
- **F4** Hiding a collection removes its storefront page
- **F5** Uppercase handle → refused
- **F6** Curating an unpublished product → does not appear on the storefront
- **F7** Changing role does not disturb membership

## G. Publication

- **G1** Publish → appears on the next build
- **G2** Unpublish without a reason → refused
- **G3** Archive → unarchive → publish
- **G4** Publish an archived product → refused
- **G5** Publish with no variants → refused

## H. Compliance

- **H1** Quarantined copy survives an unrelated edit
- **H2** Banned name blocks publication from every route
- **H3** HOCL rules apply only to the governed brand
- **H4** Screen preview with a long body → does the redirect survive?
- **H5** Screen preview writes nothing
- **H6** Moving a product to the governed brand re-screens its copy

## I. Inventory

- **I1** unknown → 0 → unknown (zero never becomes "not counted" by accident)
- **I2** Negative quantity → refused
- **I3** Non-integer quantity → refused
- **I4** Movement ledger records each change
- **I5** Reserved stock blocks an uncount
- **I6** Setting the same number twice → no spurious movement row

## J. Curation gaps

- **J1** Map to a product already curated into that collection
- **J2** Map, then reopen → is the mapped product left behind in the collection?
- **J3** Settle the same gap twice → refused
- **J4** Map to an unpublished product
- **J5** Reopening an open gap → refused

## K. Audit

- **K1** A row for every mutation type
- **K2** A very large before/after renders without breaking the page
- **K3** Filters work and combine
- **K4** Deleting a product keeps its history

## L. Cross-cutting

- **L1** Pagination offset beyond the end → empty, not an error
- **L2** Negative offset → treated as zero
- **L3** Unicode and emoji in every text field → stored and rendered intact
- **L4** Very long field values → stored or refused, never truncated silently
- **L5** Markup in every rendered field → escaped
- **L6** Unknown query parameters ignored
- **L7** Storefront builds after every mutation in this checklist

---

# Results

Run against the live server on `127.0.0.1`, driving real HTML forms, with the
database inspected after each step. 61 checks executed.

## Defects found and fixed

### 1. Saving a product destroyed its held-back copy — CRITICAL

Opening any product with quarantined copy and pressing **Save**, changing
nothing, deleted the held-back blocks. The page then said "Saved."

The editor rendered held-back copy read-only, so the form never carried it. On
save the screen re-ran against only the published half and concluded there was
nothing to hold back. **60 blocks across 41 products** were one click each from
being lost, and the text is not recoverable from anywhere else.

The same gap meant held-back copy could not be *fixed* through the Dashboard at
all — you could see it and not edit it, so the compliance workflow dead-ended.

*Fixed:* the editor has a **Held back by the screen** field. Both halves are
submitted together and screened as one document; fixing the wording releases a
block into the description on save. Sending one half without the other reads the
missing half from the database rather than treating it as empty.

### 2. A partial POST erased fields it never mentioned — HIGH

Posting only a name to `/admin/brands/:slug` cleared the tagline and the story.
Posting only a title to a product cleared the description and tags. Every route
passed every possible key on every request, so an absent field arrived looking
like a deliberately emptied one.

The Dashboard's own forms submit everything they own, so this was invisible in
normal use — and permanent for anything else that posts, including any future
inline edit or script.

*Fixed:* patches are now built only from keys the request actually sent. An
empty box that *was* sent still clears the field; one that was not sent is left
alone. Applied to products, brands, collections and variants.

### 3. Reopening a mapped curation gap left the replacement on the storefront — MEDIUM

Mapping a broken reference to a product curated it into the collection.
Reopening the gap marked it unresolved again but left the product there — the
queue showed work outstanding while its former answer sat on the storefront
under that heading.

Fixing that surfaced a second problem: mapping onto a product *already* curated
into the collection overwrote the position somebody had chosen, and reopening
could not tell that curation apart from the curation the mapping added.

*Fixed:* reopening withdraws the curation the mapping added and restores a
tag-derived member's position. Mapping onto an already-curated product is
refused, pointing at **Remove** — the collection already contains it, so there
is nothing to put there.

### 4. The Dashboard supplied a hollow unpublish reason — MEDIUM

The write layer requires a reason for unpublishing, and the Dashboard defeated
it by hard-coding "Unpublished from the Dashboard" — which is exactly the
non-explanation the requirement exists to prevent.

*Fixed:* the form asks for a reason and the route refuses without one.

### 5. The compliance preview round-tripped the whole body through a URL — MEDIUM

The dry-run screen redirected with the submitted copy in the query string. A
realistic product description produced an **11 KB URL**; plenty of things in
front of a server refuse one that size.

*Fixed:* the result renders in place. Post-redirect-get exists to stop a refresh
repeating a write, and this writes nothing.

### 6. `verify.sh` checked a stale build — MEDIUM

`db/verify-data-layer.ts` inspects the rendered site as well as the database,
but ran *before* the build step, so it was reading whatever `dist/` happened to
contain. It passed only because the directory was usually current.

*Fixed:* the build now runs first, and the JSON comparison rebuilds both sides.

## Checks that passed

Handles containing `®`; unicode and emoji round-tripping; 20 KB field values
stored intact; markup escaped in every rendered field; pagination past the end
and with a negative offset; unknown query parameters; prices at 2³¹ refused;
duplicate SKU refused cleanly rather than as a raw database error; media paths
trimmed, absolute URLs refused, duplicate reorder entries refused, removing the
primary promoting the next; brands and collections with no members rendering;
uppercase and duplicate slugs refused; curated orders naming unknown handles
refused with nothing written; duplicate handles in a curated order not
double-inserting; publication refused for zero price, no variants and archived;
moving a product to the governed brand re-screening its copy; negative and
fractional stock refused; setting the same count twice writing one movement; a
6 KB audit diff rendering; audit filters combining; a no-op save writing no
audit row.

## Two of my own checks were wrong

An escaping check matched the *escaped* text and reported a false failure — the
output was correct. A publish check deactivated the only variant and then
expected publication to succeed; refusing was right.

## State after the audit

The database was restored between runs and finishes at **110 products, 110
variants, 60 held-back blocks, 61 open curation gaps, 0 inventory levels** —
identical to before. Both test suites now leave the storefront byte-identical,
which a check was added for.
