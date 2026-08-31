"""Checks that no Dashboard or storefront page scrolls sideways at phone or
tablet width — and that the storefront header's essential controls are really
visible, not clipped away.

Run both servers, then:
  QA_BASE=http://127.0.0.1:4000 QA_SITE=http://127.0.0.1:4173 python3 tools/check-layout.py

Horizontal overflow is the one responsive failure a screenshot will not show
you: the page looks right, and content is simply off to the side. It is also
easy to reintroduce — a single control with an intrinsic minimum width does it,
which is exactly how it happened here.

The visibility check exists because overflow tests alone once passed while the
mobile header was clipping the cart and menu buttons: the page-level
overflow-x:hidden removed the scroll the test looks for, and amputated the
controls with it. So for storefront pages at pre-nav widths the burger and the
cart button must exist, be displayed, and sit fully inside the viewport.

Chromium's headless window floors at ~500px, so the page is rendered inside an
iframe of the exact width under test — that iframe gets a real viewport of that
size. The document is inlined so the measuring script is same-origin, and the
result is read back out of the DOM rather than off a screenshot.
"""
import subprocess, sys, urllib.request, os, tempfile, json, re
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
BASE = os.environ.get("QA_BASE", "http://127.0.0.1:4000")
SITE = os.environ.get("QA_SITE", "http://127.0.0.1:4173")

def check(base, path, width, css_link, css_path, must_see=()):
    doc = urllib.request.urlopen(base + path).read().decode()
    css = urllib.request.urlopen(base + css_path).read().decode()
    doc = doc.replace(css_link, f"<style>{css}</style>")
    # srcdoc (attribute-escaped) rather than document.write: written content
    # would need its </script> tags escaped, which breaks pages that carry
    # real script elements — srcdoc parses them normally.
    srcdoc = doc.replace("&", "&amp;").replace('"', "&quot;")
    host = """<!doctype html><body><pre id="out">pending</pre>
<iframe id="f" style="width:%dpx;height:900px;border:0" srcdoc="%s"></iframe>
<script>
const f=document.getElementById('f');
setTimeout(()=>{
  const w=f.contentWindow, d=f.contentDocument.documentElement, vw=w.innerWidth;
  const scrolls=e=>{for(let p=e.parentElement;p;p=p.parentElement){
    const o=w.getComputedStyle(p).overflowX; if(o==='auto'||o==='scroll'||o==='hidden')return true;} return false;};
  const bad=[...f.contentDocument.querySelectorAll('*')]
    .filter(e=>e.getBoundingClientRect().right>vw+1 && !scrolls(e))
    .map(e=>e.tagName.toLowerCase()+(typeof e.className==='string'&&e.className?'.'+e.className.trim().split(/\\s+/)[0]:'')
            +(e.name?'['+e.name+']':''));
  const missing=[];
  for (const sel of %s) {
    const e=f.contentDocument.querySelector(sel);
    if(!e){ missing.push(sel+' absent'); continue; }
    const cs=w.getComputedStyle(e), r=e.getBoundingClientRect();
    if(cs.display==='none'||cs.visibility==='hidden'||r.width===0) missing.push(sel+' hidden');
    else if(r.right>vw+1||r.left<-1) missing.push(sel+' clipped at '+Math.round(r.right)+'/'+vw);
  }
  document.getElementById('out').textContent='RESULT'+JSON.stringify(
    {overflow:d.scrollWidth-vw, offenders:[...new Set(bad)].slice(0,5), missing:missing});
},700);
</script></body>""" % (width, srcdoc, json.dumps(list(must_see)))
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as fh:
        fh.write(host); tmp=fh.name
    out = subprocess.run([CHROME,"--headless","--disable-gpu","--no-sandbox","--dump-dom",
                          "--window-size=1100,1000","--virtual-time-budget=5000", f"file://{tmp}"],
                         capture_output=True, text=True).stdout
    m = re.search(r'RESULT(\{.*?\})</pre>', out)
    return json.loads(m.group(1)) if m else {"overflow":"?", "offenders":["could not measure"], "missing":[]}

ADMIN_PAGES = [
    "/admin",
    "/admin/products",
    "/admin/products/new",
    "/admin/products/toilet-bomb-organic-lemon",
    "/admin/inventory",
    "/admin/compliance",
    "/admin/compliance?view=screen",
    "/admin/curation",
    "/admin/collections",
    "/admin/collections/water",
    "/admin/brands",
    "/admin/brands/solutionshocl",
    "/admin/audit",
]
SITE_PAGES = [
    "/",
    "/collections/water-filtration/",
    "/products/borosilicate-glass-pitcher-of-life-alkaline-water-purifier/",
    "/brands/life-ionizers/",
    "/journal/",
    "/search/",
]
# Below the 62rem nav breakpoint these must be present, displayed, and inside
# the viewport on every storefront page.
ESSENTIAL = ('.burger', '[data-open-drawer="cart"]')

if __name__ == "__main__":
    fails = 0
    def run(base, pages, css_link, css_path, widths, must_see_below_nav=False):
        global fails
        for w in widths:
            print(f"\n  viewport {w}px  ({base})")
            for p in pages:
                see = ESSENTIAL if (must_see_below_nav and w < 992) else ()
                r = check(base, p, w, css_link, css_path, see)
                # innerWidth counts the vertical scrollbar, scrollWidth does not,
                # so a page that fits reads as slightly negative. Only a positive
                # value means content is pushing the page sideways.
                ok = r["overflow"] <= 0 and not r["offenders"] and not r["missing"]
                fails += 0 if ok else 1
                print(f"    {'ok  ' if ok else 'FAIL'} {p:60s} overflow {r['overflow']}"
                      + (f"  {r['offenders']}" if r["offenders"] else "")
                      + (f"  {r['missing']}" if r["missing"] else ""))
    run(BASE, ADMIN_PAGES, '<link rel="stylesheet" href="/admin/admin.css">', "/admin/admin.css",
        (390, 768, 1024))
    run(SITE, SITE_PAGES, '<link rel="stylesheet" href="/styles.css">', "/styles.css",
        (320, 390, 768, 1024), must_see_below_nav=True)
    print(f"\n  {fails} page/width combination(s) failed")
    sys.exit(1 if fails else 0)
