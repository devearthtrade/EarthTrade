# SolutionsHOCL compliance

Governing rule set: Rick Cabados, **"Standard copy rules for Solutions HOCL"** (18 Jul 2026),
"Site cleanup: everything still open, priority order" (20 Jul 2026), and the
E-Com Cabin SEO Audit of solutionshocl.com (5 Aug 2026).

Every line of customer-facing copy about HOCL, cistern, catchment, tank, toilet,
RV, boat or household cleaning in this repository follows these rules. Treat this
file as the source of truth before editing any of:

- `src/data/products-hocl.ts`
- `src/data/articles.ts` (rainwater, home and sustainability categories)
- `src/data/catalog.ts` (SolutionsHOCL, cistern-catchment, water-tank-care,
  rv-marine and household-cleaning collections)
- `src/pages/home.ts` (the SolutionsHOCL editorial section)

## The two hard rules

1. **Never delete, always upgrade.** When a banned word comes out, a *stronger
   selling word* goes in, not a flat technical one. If you are unsure, flag it
   and leave the space. Never guess.
2. **One official oxidation phrase.** `Powerful Deep Cleaning Oxidation Technology™`
   for headline and feature use, or `Powerful Oxidation` in-line. No other
   variants. HOCL is never called "natural".

## Approved language

**Power words:** powerful, deep cleaning, high-performance, advanced,
professional-grade, fast-acting, concentrated, tough on, fast-dissolving.

**Sell on the "free of" angle:** bleach-free, ammonia-free, alcohol-free,
phosphate-free, biodegradable, Made in Hawaii, Made in USA.

**Performance claims:** cleans; removes dirt, residue and buildup; breaks down
contaminant residue; contaminant buildup; cleans mildew stains; removes mold and
mildew stains; cleans algae stains; deodorizes; neutralizes odors at the source;
eliminates and controls odors; cuts grease and grime; removes tough stains;
non-abrasive.

> We clean the **stain**. We never claim to act on the living thing.

**Approved standard sentences, used verbatim.** Both live as exported constants
in `src/data/products-hocl.ts` so they cannot drift:

- `OXIDATION_SENTENCE` — "HOCL works through a Powerful Deep Cleaning Oxidation
  Technology™ to break down contaminant residue."
- `ingredientSentence(surface)` — "Uses a sodium-based ingredient that generates
  HOCL when dissolved in water. HOCL is an oxidizer that breaks down contaminant
  residue, buildup, and odor-causing soil on *[the surface]*."

Rules for the ingredient sentence: say **generates** (not creates, not produces);
always include **"when dissolved in water"**; land the sentence on oxidation
breaking down soil on a **named surface**, never on the water itself; write the
molecule as `HOCL` with a capital L. The sentence *after* "generates HOCL" is
where mistakes happen: describe the dirt, name the surface, stop. Do not follow
it with an organism, a study, an agency, or the immune system.

**Naming soil:** you may plainly name real dirt (proteins, fats, oils, sulfur
compounds). Use "contaminant residue" / "contaminant buildup", never "organic
residue" or "organic matter" in a cleaning context, because "organic" reads as
positive and natural, which is wrong for a cleaner.

> Note: "organic" and "organic matter" *are* correct and used deliberately in
> Hawaiian Volcanic Organic gardening copy, where the word describes compost and
> living soil rather than a cleaner. Never carry that vocabulary into HOCL copy.

## Banned language

| Category | Never use |
|---|---|
| Kill / germ | disinfect, sanitize, sterilize, kill, antimicrobial, antibacterial, antiviral, antifungal, biocide, pathogen, germ, bacteria, virus, spores |
| Organisms alone | mold, algae, fungus, microbe (say "mildew stains", "mold and mildew stains", "algae stains") |
| Safety claims | non-toxic, food safe, safe for kids, safe for pets, safe for families, safe for your skin, gentle enough for families, Kid & Pet Friendly |
| Water claims | purify, purification, potable, makes water safe to drink, water safety, super purify |
| Regulatory, both directions | EPA registered/certified, FDA approved/certified, not yet certified, pending, in process, being evaluated, NSF/ANSI 60 certified ingredients |
| Authority and "natural" | WHO, CDC, NIH, immune system, natural, naturally derived, naturally occurring, Natural Oxidation Technology |
| Chemical names | NaDCC, dichlor, sodium dichloroisocyanurate |
| Application methods | fogger, mister, cold humidifier, atomizer (describe direct surface cleaning only: mix, apply, wait, wipe or drain) |
| Retired comparisons | "103 times more effective than bleach", 103x, 100x |
| Style | em dashes, ALL-CAPS CTAs, `HOCl` / `hocl` with a lowercase L |

We also never say what we are *not* registered for. We present the product as a
cleaner and stop.

## Swap table

| Do not write | Write instead |
|---|---|
| Natural Oxidation Technology™ | Powerful Deep Cleaning Oxidation Technology™ |
| Oxidation (bare) | Powerful Oxidation |
| organic residue / organic matter | contaminant residue / contaminant buildup |
| kills mold | removes mold and mildew stains |
| kills algae | cleans algae stains |
| disinfects / sanitizes surfaces | deep cleans surfaces, removes buildup |
| germ-free | deep cleaned, residue-free |
| non-toxic, safe for kids & pets | bleach-free, ammonia-free, phosphate-free |
| purifies your water | cleans tank walls and surfaces |
| naturally occurring HOCL | generates HOCL when dissolved in water |
| ready for use | your tank is clean |
| creates / produces HOCL | generates HOCL |

## Disclaimer policy

A clean cleaner page needs **no disclaimer**. If the copy makes no killing or
water-safety claim, we add nothing. We do not advertise what we are not.

**The one exception** is cistern and catchment products, because they touch
stored water. One short line only, exported as `TANK_DISCLAIMER`:

> This is a cleaning product for tank walls and surfaces, for use in non-potable
> water systems.

It renders on the product page via the `disclaimer` field and appears once in the
cistern-catchment collection editorial and once per cistern/catchment article.
No other disclaimer belongs anywhere unless Rick says otherwise.

## Products deliberately excluded

These are on compliance hold and are **intentionally absent** from
`src/data/products-hocl.ts`. Do not add them back without sign-off:

- **Produce Cleaner line** (`/collections/produce-cleaner`,
  `/products/veg-fruit-cleaner`, `/products/vegetable-and-fruit-cleaner`) —
  301 redirect only, no restore until compliant copy is signed off.
- **Pool Bomb, Spa Bomb, Cold Plunge** — pulled from sale on all channels.
  The legacy `pool-and-spa-cleaner` and `pool-spa` collections are therefore not
  built, and nothing links to them.
- **`/collections/liquid-hocl`** — fogger and spore liquid line. Draft, no nav links.
- **`/pages/scientific-studies`** — down and stays down, no redirect, no links.
- **Wholesale / distributor pages** — remain noindex until the copy clears the scrub.

## Verifying a change

Product copy now arrives through `scripts/import-catalog.ts` and lands in
`src/data/generated/catalog.json`, so the checks below must cover that file as
well as `src/`. The importer screens every imported paragraph and every product
title before writing, and quarantines anything that matches; these greps confirm
that nothing slipped past it.

Screening is scoped the way this document is scoped. The kill, organism, safety,
water and application-method rules govern SolutionsHOCL copy. Every brand is
screened for regulatory or certification claims, medical claims and unsupported
environmental claims. Applying the HOCL list to all brands would quarantine
accurate product names, since a water filter legitimately filters and
"naturally occurring" is correct in Hawaiian Volcanic Organic gardening copy.

The most reliable check is the rendered output, because that is what a customer
and a regulator actually see:

```bash
node src/build.ts
# then screen dist/ for banned terms under each product's governing rule set
```

Run these from the repository root. The first three must return nothing.

```bash
# Kill/germ, safety, chemical, method and retired claims. Case-insensitive.
# Excludes the rule-listing comment block in products-hocl.ts.
grep -rnEi "disinfect|sanitiz|steriliz|antimicrobial|antibacter|antivir|antifung|biocide|pathogen|\bgerm|bacteri|\bvirus|spores|non-toxic|food safe|immune system|NaDCC|dichlor|fogger|mister|atomizer|103x|103 times|purif" src/

# Regulatory and authority acronyms. Case-SENSITIVE, or "who" matches "WHO".
grep -rnE "\b(EPA|FDA|WHO|CDC|NIH|NSF)\b" src/

# Style: em dashes and the lowercase molecule.
grep -rn "—" src/
grep -rn "HOCl" src/

# Expected: only the approved tank disclaimer, which contains "non-potable".
grep -rn "potable" src/
```

At the time of writing, all of the above return nothing except the `potable`
check, which returns exactly six occurrences of the approved disclaimer (one
constant, two collection editorials, three cistern/catchment articles).

`grep -rniE "\bsafe\b|\bsafety\b"` returns only code identifiers (`SafeHtml`,
`env(safe-area-inset-bottom)`, a path-traversal guard variable in `serve.ts`) and
never customer copy. Keep it that way.

If you hit a sentence you are not sure how to fix, send it to Rick. Do not guess.
