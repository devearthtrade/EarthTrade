/**
 * One icon system: 24x24 grid, 1.4 stroke, round caps, no fills.
 * Mixing icon styles is the fastest way to make a premium layout look
 * assembled from parts, so every glyph in the site comes from here.
 */

import { raw, type SafeHtml } from "../lib/html.ts";

const paths: Record<string, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  bag: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  heart: '<path d="M12 20s-7-4.5-7-9.5A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.5C19 15.5 12 20 12 20Z"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  arrow: '<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/>',
  arrowDown: '<path d="M12 4v15"/><path d="M6 13l6 6 6-6"/>',
  check: '<path d="M5 12.5 10 17.5 19 7"/>',
  // Category and benefit icons
  water: '<path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3Z"/>',
  drop: '<path d="M12 4c3 3.6 4.5 6.2 4.5 8.3a4.5 4.5 0 0 1-9 0C7.5 10.2 9 7.6 12 4Z"/>',
  filter: '<path d="M4 6h16l-6 7v6l-4-2v-4L4 6Z"/>',
  home: '<path d="M4 11 12 4l8 7"/><path d="M6.5 10v9h11v-9"/>',
  leaf: '<path d="M20 4C12 4 6 8 6 14a5 5 0 0 0 5 5c6 0 9-6 9-15Z"/><path d="M6 19c2.5-4 5.5-7 10-9"/>',
  sparkle: '<path d="M12 4v6M12 14v6M4 12h6M14 12h6"/><path d="M7.5 7.5 10 10M14 14l2.5 2.5M16.5 7.5 14 10M10 14l-2.5 2.5"/>',
  ship: '<path d="M3 15h18"/><path d="M5 15V9h9l3 3v3"/><circle cx="8" cy="18" r="1.6"/><circle cx="16" cy="18" r="1.6"/>',
  support: '<circle cx="12" cy="12" r="8"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.2-1.2.8-1.2 1.6"/><path d="M12 17h.01"/>',
  recycle: '<path d="M7 8 5 11.5l3.5.5"/><path d="M17 8l2 3.5-3.5.5"/><path d="M12 20l-2-3h4l-2 3Z"/><path d="M8.5 12 12 6l3.5 6"/>',
  shield: '<path d="M12 4l7 2.5V12c0 4-3 6.8-7 8-4-1.2-7-4-7-8V6.5L12 4Z"/>',
  refresh: '<path d="M20 7a8 8 0 1 0 1 5"/><path d="M20 3v4h-4"/>',
  layers: '<path d="M12 4 4 8.5l8 4.5 8-4.5L12 4Z"/><path d="M4 13.5 12 18l8-4.5"/>',
  beaker: '<path d="M9 4h6"/><path d="M10 4v6l-4.5 7.5A2 2 0 0 0 7.2 21h9.6a2 2 0 0 0 1.7-3.5L14 10V4"/><path d="M7.5 15h9"/>',
  tank: '<rect x="5" y="6" width="14" height="14" rx="2"/><path d="M5 11h14"/><path d="M8 6V4h8v2"/>',
  spray: '<path d="M10 8h5v12h-5z"/><path d="M10 8V5h3"/><path d="M17 5h.01M19 7h.01M17 9h.01"/>',
  star: '<path d="m12 4 2.3 4.9 5.2.7-3.8 3.7.9 5.3L12 16l-4.6 2.6.9-5.3L4.5 9.6l5.2-.7L12 4Z"/>',
};

export function icon(name: keyof typeof paths | string, size = 24): SafeHtml {
  const body = paths[name];
  if (!body) return raw("");
  return raw(
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`,
  );
}

/** The site favicon: an EarthTrade mark, a drop over a horizon line. */
export const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<rect width="32" height="32" rx="5" fill="#26382F"/>
<path d="M16 7c3.6 4.3 5.4 7.4 5.4 9.9a5.4 5.4 0 0 1-10.8 0C10.6 14.4 12.4 11.3 16 7Z" fill="none" stroke="#B69A62" stroke-width="1.6"/>
<path d="M7 24h18" stroke="#FAF9F5" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;
