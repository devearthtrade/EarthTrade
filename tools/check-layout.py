"""Checks that no Dashboard page scrolls sideways at phone or tablet width.

Run the Dashboard, then:  QA_BASE=http://127.0.0.1:4000 python3 tools/check-layout.py

Horizontal overflow is the one responsive failure a screenshot will not show
you: the page looks right, and content is simply off to the side. It is also
easy to reintroduce — a single control with an intrinsic minimum width does it,
which is exactly how it happened here.

Reports horizontal overflow for admin pages at a given viewport width.

Chromium's headless window floors at ~500px, so the page is rendered inside an
iframe of the exact width under test — that iframe gets a real viewport of that
size. The document is inlined so the measuring script is same-origin, and the
result is read back out of the DOM rather than off a screenshot.
"""
import subprocess, sys, urllib.request, os, tempfile, json, re
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
BASE = os.environ.get("QA_BASE", "http://127.0.0.1:4000")

def check(path, width):
    doc = urllib.request.urlopen(BASE + path).read().decode()
    css = urllib.request.urlopen(BASE + "/admin/admin.css").read().decode()
    doc = doc.replace('<link rel="stylesheet" href="/admin/admin.css">', f"<style>{css}</style>")
    host = """<!doctype html><body><pre id="out">pending</pre>
<iframe id="f" style="width:%dpx;height:900px;border:0"></iframe>
<script>
const f=document.getElementById('f');
f.contentDocument.open(); f.contentDocument.write(%s); f.contentDocument.close();
setTimeout(()=>{
  const w=f.contentWindow, d=f.contentDocument.documentElement, vw=w.innerWidth;
  const scrolls=e=>{for(let p=e.parentElement;p;p=p.parentElement){
    const o=w.getComputedStyle(p).overflowX; if(o==='auto'||o==='scroll'||o==='hidden')return true;} return false;};
  const bad=[...f.contentDocument.querySelectorAll('*')]
    .filter(e=>e.getBoundingClientRect().right>vw+1 && !scrolls(e))
    .map(e=>e.tagName.toLowerCase()+(typeof e.className==='string'&&e.className?'.'+e.className.trim().split(/\\s+/)[0]:'')
            +(e.name?'['+e.name+']':''));
  document.getElementById('out').textContent='RESULT'+JSON.stringify(
    {overflow:d.scrollWidth-vw, offenders:[...new Set(bad)].slice(0,5)});
},700);
</script></body>""" % (width, json.dumps(doc.replace("</scr","<\\/scr")))
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as fh:
        fh.write(host); tmp=fh.name
    out = subprocess.run([CHROME,"--headless","--disable-gpu","--no-sandbox","--dump-dom",
                          "--window-size=1100,1000","--virtual-time-budget=5000", f"file://{tmp}"],
                         capture_output=True, text=True).stdout
    m = re.search(r'RESULT(\{.*?\})</pre>', out)
    return json.loads(m.group(1)) if m else {"overflow":"?", "offenders":["could not measure"]}

PAGES = [
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
if __name__ == "__main__":
    fails = 0
    for w in (390, 768, 1024):
        print(f"\n  viewport {w}px")
        for p in PAGES:
            r = check(p, w)
            # innerWidth counts the vertical scrollbar, scrollWidth does not,
            # so a page that fits reads as slightly negative. Only a positive
            # value means content is pushing the page sideways.
            ok = r["overflow"] <= 0 and not r["offenders"]
            fails += 0 if ok else 1
            print(f"    {'ok  ' if ok else 'FAIL'} {p:42s} overflow {r['overflow']}"
                  + (f"  {r['offenders']}" if not ok else ""))
    print(f"\n  {fails} page/width combination(s) overflow")
    sys.exit(1 if fails else 0)
