/**
 * Compliance screening for EarthTrade product copy.
 *
 * This is the single implementation. The CSV importer uses it, and the Admin
 * Dashboard must use it too: a product created by hand that bypassed this
 * screen could publish a claim `docs/COMPLIANCE.md` forbids, which is exactly
 * the failure the rule set exists to prevent.
 *
 * Two tiers, matching how COMPLIANCE.md is actually scoped.
 *
 * The kill, organism, safety, water and application-method rules govern
 * SolutionsHOCL cleaning copy. They are not general prohibitions: a water
 * filter legitimately filters, and COMPLIANCE.md explicitly permits "naturally
 * occurring" in Hawaiian Volcanic Organic gardening copy, where it describes
 * minerals rather than a cleaner. Applying the HOCL list to every brand would
 * quarantine accurate product names.
 *
 * The sitewide tier carries the brief's own rules, which bind every brand: no
 * invented certifications, no medical claims, no unsupported environmental
 * claims.
 *
 * The regulatory acronym rule is deliberately case-sensitive. COMPLIANCE.md
 * warns about this directly: a case-insensitive `WHO` matches the word "who".
 */

export interface ComplianceMatch {
  reason: string;
  term: string;
}

export interface ScreenedBlock {
  text: string;
  matches: ComplianceMatch[];
}

export interface ScreenedCopy {
  /** Blocks that cleared the screen and may be rendered. */
  clean: string[];
  /** Blocks held back, with the terms that held them. */
  quarantined: ScreenedBlock[];
}

interface Rule {
  pattern: RegExp;
  reason: string;
}

/** Binds every brand. Drawn from the project brief, not the HOCL rule set. */
export const SITEWIDE_RULES: readonly Rule[] = [
  { pattern: /\b(EPA|FDA|NSF|WHO|CDC|NIH)\b/g, reason: "regulatory or certification claim" },
  { pattern: /\b(eco-?friendly|environmentally friendly)\b/gi, reason: "unsupported environmental claim" },
  { pattern: /\bimmune system\b/gi, reason: "medical claim" },
  { pattern: /\b(cures?|treats?|prevents?) (disease|illness|infection)/gi, reason: "medical claim" },
];

/** Governs SolutionsHOCL copy only. See docs/COMPLIANCE.md. */
export const HOCL_RULES: readonly Rule[] = [
  { pattern: /\b(disinfect\w*|sanitiz\w*|steriliz\w*)\b/gi, reason: "kill claim" },
  { pattern: /\b(antimicrobial|antibacterial|antiviral|antifungal|biocide)\b/gi, reason: "kill claim" },
  { pattern: /\b(pathogens?|germs?|bacteria|viruses?|virus|spores)\b/gi, reason: "organism claim" },
  { pattern: /\bkills?\b/gi, reason: "kill claim" },
  { pattern: /\b(non-?toxic|food safe|safe for (kids|pets|families))\b/gi, reason: "safety claim" },
  { pattern: /\b(purif\w*|makes water safe to drink)\b/gi, reason: "water claim" },
  { pattern: /\bnatural(ly)?[- ](derived|occurring)\b/gi, reason: "natural claim" },
  { pattern: /\b(NaDCC|dichlor|sodium dichloroisocyanurate)\b/gi, reason: "chemical name" },
  { pattern: /\b(fogger|misters?|atomizers?)\b/gi, reason: "application method" },
  { pattern: /\b103\s?(x|times)\b/gi, reason: "retired comparison" },
];

/** The brand whose copy the stricter tier governs. */
export const GOVERNED_BRAND = "solutionshocl";

export function rulesFor(brandId: string): readonly Rule[] {
  return brandId === GOVERNED_BRAND ? [...SITEWIDE_RULES, ...HOCL_RULES] : SITEWIDE_RULES;
}

/**
 * Returns every distinct banned term in `text` under the brand's rule set.
 * An empty array means the text may be published.
 */
export function screen(text: string, brandId: string): ComplianceMatch[] {
  const found: ComplianceMatch[] = [];
  const seen = new Set<string>();
  for (const { pattern, reason } of rulesFor(brandId)) {
    // matchAll needs a fresh lastIndex; the literals are module-level and
    // carry /g, so reuse across calls would skip matches without this.
    for (const m of text.matchAll(new RegExp(pattern.source, pattern.flags))) {
      const key = `${reason}:${m[0].toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ reason, term: m[0] });
    }
  }
  return found;
}

/** True when the text states nothing the brand's rule set forbids. */
export function isPublishable(text: string, brandId: string): boolean {
  return screen(text, brandId).length === 0;
}

/**
 * Screens a body of copy block by block. Clean blocks publish; matched blocks
 * are quarantined with their terms rather than discarded, so a reviewer can see
 * what was held and why.
 */
export function screenCopy(blocks: string[], brandId: string): ScreenedCopy {
  const clean: string[] = [];
  const quarantined: ScreenedBlock[] = [];
  for (const text of blocks) {
    const matches = screen(text, brandId);
    if (matches.length) quarantined.push({ text, matches });
    else clean.push(text);
  }
  return { clean, quarantined };
}

/**
 * Screens a product name. A name cannot be reworded without misdescribing the
 * product, so a match here withholds the whole record for a human decision
 * rather than being silently rewritten.
 */
export function screenTitle(title: string, brandId: string): ComplianceMatch[] {
  return screen(title, brandId);
}
