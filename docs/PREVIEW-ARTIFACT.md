# The review URL

The complete storefront is published as a claude.ai Artifact — a private,
persistent page the owner can open in any browser and share from its own menu:

> **https://claude.ai/code/artifact/0fd14fd9-3ae1-44af-b0c8-9adb5bbf4b9d**

It carries **all 164 pages** with working navigation, breadcrumbs and live
search, built from the PostgreSQL catalog. It exists because a Claude cloud
session cannot expose a port to the owner's browser; this URL is the one
Claude-native surface that persists across sessions.

## The standing rule

**After any change that affects the storefront, this URL gets republished.**
That is a maintained promise, not an automatic mechanism — there is no watcher
on the git branch. Concretely:

- In any Claude session where the site changes, updating this artifact is part
  of finishing the change, alongside tests.
- After changes made *outside* a Claude session (edited locally and pushed),
  tell any Claude session: *"update the EarthTrade preview artifact"* — with
  this file in the repo, that is a two-minute operation from a fresh container.

## How it is rebuilt

```sh
node src/build.ts                        # current site into dist/
node tools/build-preview-artifact.ts     # dist/ -> earthtrade-preview.html
```

Then Claude publishes `earthtrade-preview.html` **to the URL above** (the
Artifact tool's `url` parameter). Publishing without that parameter from a new
conversation creates a *separate* artifact with a different link — the URL
above is the one to keep alive.

## How 32 MB of site fits in an 8 MB page

An artifact is a single file capped at 16 MB, with no external requests. The
builder closes the gap two ways, both explained in the tool's own header
comment: every page travels deflate-compressed and is decompressed natively in
the viewer's browser, and every image is re-encoded at display resolution by
headless Chromium acting as the codec (no image library exists in these
environments; a browser always does). The repository's original images are
untouched — the artifact carries preview renditions.

The build refuses to produce a file over the limit, and audits every internal
link and image reference across all pages before writing anything.

## What the preview is not

It is a faithful rendition for review, not the production architecture. Cart
and wishlist state live in the viewer's browser only, images are
display-resolution copies, and the Admin Dashboard is deliberately absent — it
stays loopback-only until it has authentication.
