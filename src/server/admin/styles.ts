/**
 * Admin styles.
 *
 * Deliberately separate from `src/site/styles.css`. The storefront's design is
 * finished and must not move; this is a tool for one person at a desk, and it
 * has different priorities — density, scannability, unambiguous state.
 *
 * It borrows the EarthTrade palette so the two feel related, and nothing else.
 */

export const ADMIN_CSS = `
:root {
  --deep-green: #26382F;
  --dark-earth: #202722;
  --forest: #3F5547;
  --warm-earth: #8A755E;
  --clay: #A58B72;
  --stone: #D9D4C9;
  --warm-white: #FAF9F5;
  --cream: #F3F0E8;
  --sand: #E9E4D9;
  --brass: #B69A62;

  --danger: #8C2F22;
  --danger-bg: #FBEEEC;
  --warn: #7A5B18;
  --warn-bg: #FBF4E2;
  --ok: #2F5D3A;
  --ok-bg: #EDF4EE;

  --sans: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --serif: "Cormorant Garamond", Georgia, serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;

  --radius: 6px;
  --sidebar: 232px;
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  font-family: var(--sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--dark-earth);
  background: var(--warm-white);
  -webkit-font-smoothing: antialiased;
}

a { color: var(--forest); text-decoration: none; }
a:hover { text-decoration: underline; }

/* Every interactive element must show focus. This is a keyboard-heavy tool. */
:focus-visible { outline: 2px solid var(--brass); outline-offset: 2px; }

/* ------------------------------- structure ------------------------------- */

.shell { display: grid; grid-template-columns: var(--sidebar) 1fr; min-height: 100vh; }

.sidebar {
  background: var(--dark-earth);
  color: var(--sand);
  padding: 1.25rem 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.sidebar__brand {
  font-family: var(--serif);
  font-size: 1.35rem;
  letter-spacing: .02em;
  color: var(--warm-white);
  padding: 0 1.25rem 1rem;
  display: block;
}
.sidebar__brand:hover { text-decoration: none; }
.sidebar__brand small {
  display: block;
  font-family: var(--sans);
  font-size: .68rem;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--clay);
  margin-top: .15rem;
}

.sidebar__group {
  font-size: .66rem;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--warm-earth);
  padding: 1rem 1.25rem .35rem;
}

.sidebar a.nav {
  display: flex;
  justify-content: space-between;
  gap: .5rem;
  padding: .45rem 1.25rem;
  color: var(--sand);
  border-left: 3px solid transparent;
}
.sidebar a.nav:hover { background: rgba(255,255,255,.05); text-decoration: none; }
.sidebar a.nav[aria-current="page"] {
  background: rgba(255,255,255,.08);
  border-left-color: var(--brass);
  color: var(--warm-white);
}
.sidebar .count {
  font-variant-numeric: tabular-nums;
  font-size: .78rem;
  color: var(--clay);
}
.sidebar .count[data-tone="warn"] { color: #E0B75F; }

.main { min-width: 0; }

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: .85rem 1.5rem;
  border-bottom: 1px solid var(--sand);
  background: var(--warm-white);
  position: sticky;
  top: 0;
  z-index: 5;
}
.topbar h1 { font-size: 1.05rem; margin: 0; font-weight: 600; }
.topbar .crumb { color: var(--warm-earth); font-size: .8rem; }

.content { padding: 1.5rem; max-width: 1400px; }
.content > * + * { margin-top: 1.25rem; }

/* --------------------------------- cards --------------------------------- */

.card {
  background: #fff;
  border: 1px solid var(--sand);
  border-radius: var(--radius);
  padding: 1.1rem 1.25rem;
}
.card > h2 { margin: 0 0 .75rem; font-size: .82rem; letter-spacing: .1em; text-transform: uppercase; color: var(--warm-earth); }
.card > h2 + p { margin-top: -.4rem; }

.grid { display: grid; gap: 1rem; }
.grid--stats { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
.grid--2 { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }

.stat { display: block; }
.stat .n { font-family: var(--serif); font-size: 2rem; line-height: 1.1; display: block; }
.stat .label { font-size: .78rem; color: var(--warm-earth); }
.stat[data-tone="warn"] .n { color: var(--warn); }
.stat[data-tone="danger"] .n { color: var(--danger); }

/* -------------------------------- tables --------------------------------- */

.table-wrap { overflow-x: auto; border: 1px solid var(--sand); border-radius: var(--radius); background: #fff; }
table { width: 100%; border-collapse: collapse; font-size: .84rem; }
thead th {
  text-align: left;
  font-size: .68rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--warm-earth);
  padding: .6rem .75rem;
  border-bottom: 1px solid var(--sand);
  background: var(--cream);
  white-space: nowrap;
}
tbody td { padding: .55rem .75rem; border-bottom: 1px solid var(--cream); vertical-align: top; }
tbody tr:last-child td { border-bottom: 0; }
tbody tr:hover { background: var(--warm-white); }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
td .sub { display: block; color: var(--warm-earth); font-size: .76rem; }

.thumb {
  width: 34px; height: 34px; object-fit: cover;
  border-radius: 4px; border: 1px solid var(--sand); background: var(--cream);
  display: block;
}
.thumb--lg { width: 84px; height: 84px; }

/* --------------------------------- pills --------------------------------- */

.pill {
  display: inline-block;
  font-size: .68rem;
  letter-spacing: .04em;
  padding: .12rem .45rem;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;
}
.pill--ok      { background: var(--ok-bg);     color: var(--ok);     border-color: #CADCCE; }
.pill--warn    { background: var(--warn-bg);   color: var(--warn);   border-color: #E8D9AE; }
.pill--danger  { background: var(--danger-bg); color: var(--danger); border-color: #EBC9C2; }
.pill--muted   { background: var(--cream);     color: var(--warm-earth); border-color: var(--sand); }

.pill + .pill { margin-left: .25rem; }

code, .mono { font-family: var(--mono); font-size: .78em; }
.handle { color: var(--warm-earth); }

/* --------------------------------- forms --------------------------------- */

form .field { margin-bottom: .9rem; }
label { display: block; font-size: .76rem; font-weight: 600; margin-bottom: .25rem; }
label .hint { display: block; font-weight: 400; color: var(--warm-earth); font-size: .74rem; margin-top: .1rem; }

input[type=text], input[type=number], input[type=search], input[type=url], select, textarea {
  width: 100%;
  font: inherit;
  font-size: .85rem;
  padding: .42rem .55rem;
  border: 1px solid var(--stone);
  border-radius: 4px;
  background: #fff;
  color: inherit;
}
textarea { min-height: 7rem; resize: vertical; line-height: 1.55; }
input:disabled, textarea:disabled, select:disabled { background: var(--cream); color: var(--warm-earth); }

.row { display: flex; gap: .75rem; flex-wrap: wrap; }
.row > * { flex: 1 1 180px; min-width: 0; }

.actions { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; margin-top: 1rem; }
.actions--inline { margin-top: 0; }

button, .btn {
  font: inherit;
  font-size: .82rem;
  font-weight: 500;
  padding: .42rem .85rem;
  border-radius: 4px;
  border: 1px solid var(--deep-green);
  background: var(--deep-green);
  color: var(--warm-white);
  cursor: pointer;
}
button:hover, .btn:hover { background: var(--forest); border-color: var(--forest); text-decoration: none; }
.btn--ghost, button.ghost {
  background: #fff; color: var(--deep-green); border-color: var(--stone);
}
.btn--ghost:hover, button.ghost:hover { background: var(--cream); border-color: var(--warm-earth); color: var(--deep-green); }
.btn--danger, button.danger { background: #fff; color: var(--danger); border-color: #E0BDB6; }
.btn--danger:hover, button.danger:hover { background: var(--danger-bg); border-color: var(--danger); color: var(--danger); }
.btn--sm, button.sm { font-size: .74rem; padding: .25rem .55rem; }

button:disabled { opacity: .5; cursor: not-allowed; }

/* -------------------------------- notices -------------------------------- */

.notice {
  border-left: 3px solid var(--warm-earth);
  background: var(--cream);
  padding: .7rem .9rem;
  border-radius: 0 var(--radius) var(--radius) 0;
  font-size: .85rem;
}
.notice--ok     { border-color: var(--ok);     background: var(--ok-bg); }
.notice--warn   { border-color: var(--warn);   background: var(--warn-bg); }
.notice--danger { border-color: var(--danger); background: var(--danger-bg); }
.notice p { margin: .25rem 0; }
.notice p:first-child { margin-top: 0; }
.notice p:last-child { margin-bottom: 0; }

.toolbar {
  display: flex; gap: .6rem; flex-wrap: wrap; align-items: flex-end;
  padding: .85rem 1rem; background: #fff;
  border: 1px solid var(--sand); border-radius: var(--radius);
}
.toolbar .field { margin: 0; }
.toolbar .grow { flex: 1 1 220px; }

.pager { display: flex; gap: .5rem; align-items: center; justify-content: space-between; font-size: .8rem; color: var(--warm-earth); }

.empty { padding: 2rem 1rem; text-align: center; color: var(--warm-earth); }

/* --------------------------------- misc ---------------------------------- */

.quarantined {
  border-left: 3px solid var(--danger);
  background: var(--danger-bg);
  padding: .6rem .8rem;
  border-radius: 0 4px 4px 0;
  font-size: .82rem;
}
.quarantined + .quarantined { margin-top: .5rem; }

.diff { font-family: var(--mono); font-size: .74rem; white-space: pre-wrap; word-break: break-word; margin: 0; }
.diff .was { color: var(--danger); }
.diff .now { color: var(--ok); }

.media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: .75rem; }
.media-item { border: 1px solid var(--sand); border-radius: var(--radius); padding: .5rem; background: #fff; }
.media-item img { width: 100%; aspect-ratio: 1; object-fit: contain; background: var(--cream); border-radius: 4px; }
.media-item .primary { font-size: .68rem; color: var(--brass); font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }

dl.meta { display: grid; grid-template-columns: max-content 1fr; gap: .3rem .9rem; margin: 0; font-size: .82rem; }
dl.meta dt { color: var(--warm-earth); }
dl.meta dd { margin: 0; }

.u-right { text-align: right; }
.u-muted { color: var(--warm-earth); }
.u-nowrap { white-space: nowrap; }
.u-mt { margin-top: 1rem; }

/* ------------------------------ responsive ------------------------------- */

@media (max-width: 1024px) {
  .shell { grid-template-columns: 1fr; }
  .sidebar {
    position: static; height: auto;
    display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0 .5rem; padding: .85rem 1rem;
  }
  .sidebar__brand { grid-column: 1 / -1; padding: 0 0 .5rem; }
  .sidebar__group { display: none; }
  .sidebar a.nav { border-left: 0; border-radius: 4px; padding: .35rem .6rem; }
  .sidebar a.nav[aria-current="page"] { background: rgba(255,255,255,.12); }
  .content { padding: 1rem; }
}

@media (max-width: 640px) {
  .topbar { flex-direction: column; align-items: flex-start; gap: .25rem; }
  .content { padding: .85rem; }
  .row > * { flex-basis: 100%; }
  /* Tables stay scrollable rather than reflowing: an admin comparing rows
     needs the columns to stay aligned. */
  table { font-size: .8rem; }
}

@media print {
  .sidebar, .topbar, .actions, .toolbar { display: none; }
  .shell { grid-template-columns: 1fr; }
}
`;
