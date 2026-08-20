/**
 * Minimal, dependency-free HTML templating.
 *
 * `html` is a tagged template that escapes interpolated values by default.
 * Wrap trusted markup in `raw()` (or nest another `html` result, which is
 * already marked safe) to include it verbatim. Arrays are joined; `null`,
 * `undefined` and `false` render as nothing, which enables conditional
 * fragments: html`${cond && html`<b>yes</b>`}`.
 */

const SAFE: unique symbol = Symbol("safe-html");

export type SafeHtml = { [SAFE]: true; value: string };

export type Child =
  | string
  | number
  | boolean
  | null
  | undefined
  | SafeHtml
  | Child[];

export function esc(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function raw(value: string): SafeHtml {
  return { [SAFE]: true, value };
}

function isSafe(v: unknown): v is SafeHtml {
  return typeof v === "object" && v !== null && SAFE in v;
}

function renderChild(child: Child): string {
  if (child === null || child === undefined || child === false || child === true) return "";
  if (typeof child === "string") return esc(child);
  if (typeof child === "number") return String(child);
  if (Array.isArray(child)) return child.map(renderChild).join("");
  if (isSafe(child)) return child.value;
  return "";
}

export function html(strings: TemplateStringsArray, ...values: Child[]): SafeHtml {
  let out = "";
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) out += renderChild(values[i]);
  }
  return raw(out);
}

/** Join an array of fragments (or map over items) without separators. */
export function join(parts: Child[]): SafeHtml {
  return raw(parts.map(renderChild).join(""));
}

/** Render a SafeHtml (or plain string, escaped) to a final string. */
export function render(node: Child): string {
  return renderChild(node);
}

/** Build an HTML attribute string from a record, skipping null/false. */
export function attrs(map: Record<string, string | number | boolean | null | undefined>): SafeHtml {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(map)) {
    if (value === null || value === undefined || value === false) continue;
    if (value === true) {
      parts.push(key);
    } else {
      parts.push(`${key}="${esc(String(value))}"`);
    }
  }
  return raw(parts.join(" "));
}
