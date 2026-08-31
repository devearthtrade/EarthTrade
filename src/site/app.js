/**
 * EarthTrade storefront runtime.
 *
 * Dependency-free, progressive enhancement only: every page is fully
 * readable and navigable with this file blocked. Written as plain modern
 * JavaScript (the generator itself is TypeScript) so the browser bundle
 * needs no build step.
 *
 * Modules: analytics, cart, wishlist, recently viewed, search, navigation,
 * accordions, product options, quiz, filter finder, collection filtering,
 * reveal animations.
 */

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const money = (n) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: Math.round(n * 100) % 100 === 0 ? 0 : 2,
      maximumFractionDigits: Math.round(n * 100) % 100 === 0 ? 0 : 2,
    }).format(n);

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage unavailable (private mode, quota) - degrade silently */
      }
    },
  };

  /* --------------------------- image fallbacks ---------------------------- */

  /**
   * Product photography is served from the commerce CDN, so one missing asset
   * would otherwise render a broken-image icon inside an otherwise finished
   * card. Hiding the img reveals the typographic tile sitting behind it.
   *
   * Registered here rather than in boot() because it must survive a failure in
   * any other module, and because "error" does not bubble (capture phase).
   */
  document.addEventListener(
    "error",
    (e) => {
      const el = e.target;
      if (el instanceof HTMLImageElement && el.hasAttribute("data-img-fallback")) {
        el.hidden = true;
        // Hand the space back to the typographic tile behind it.
        el.closest(".card__media, .gallery__main")?.classList.remove("has-image");
      }
    },
    true,
  );

  /* ------------------------------ analytics ------------------------------ */

  /**
   * Single funnel for commerce events. Pushes to dataLayer (GA4 via GTM) and
   * mirrors to Meta and TikTok pixels when those are present, so adding a
   * vendor later means editing one file.
   */
  const track = (event, payload = {}) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...payload });

    const fbMap = {
      view_item: "ViewContent",
      add_to_cart: "AddToCart",
      begin_checkout: "InitiateCheckout",
      purchase: "Purchase",
      search: "Search",
      add_to_wishlist: "AddToWishlist",
      sign_up: "CompleteRegistration",
    };
    if (typeof window.fbq === "function" && fbMap[event]) {
      window.fbq("track", fbMap[event], payload);
    }
    const ttMap = {
      view_item: "ViewContent",
      add_to_cart: "AddToCart",
      begin_checkout: "InitiateCheckout",
      purchase: "CompletePayment",
      search: "Search",
      add_to_wishlist: "AddToWishlist",
    };
    if (typeof window.ttq === "object" && window.ttq && ttMap[event]) {
      window.ttq.track(ttMap[event], payload);
    }
  };
  window.etTrack = track;

  /* -------------------------------- toast -------------------------------- */

  let toastEl = null;
  let toastTimer = 0;
  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.dataset.show = "true";
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastEl.dataset.show = "false";
    }, 3200);
  }

  /* --------------------------------- cart -------------------------------- */

  const CART_KEY = "et:cart:v1";
  const FREE_SHIP = 75;

  const cart = {
    lines: store.get(CART_KEY, []),
    save() {
      store.set(CART_KEY, this.lines);
      this.render();
    },
    count() {
      return this.lines.reduce((n, l) => n + l.qty, 0);
    },
    subtotal() {
      return this.lines.reduce((n, l) => n + l.price * l.qty, 0);
    },
    add(line, quiet) {
      const existing = this.lines.find(
        (l) => l.handle === line.handle && l.variantId === line.variantId,
      );
      if (existing) existing.qty += line.qty;
      else this.lines.push({ ...line });
      this.save();
      track("add_to_cart", {
        currency: "USD",
        value: line.price * line.qty,
        items: [{ item_id: line.variantId, item_name: line.title, price: line.price, quantity: line.qty }],
      });
      if (!quiet) {
        toast(`${line.title} added to cart`);
        openDrawer("cart");
      }
    },
    setQty(index, qty) {
      const line = this.lines[index];
      if (!line) return;
      if (qty <= 0) this.lines.splice(index, 1);
      else line.qty = qty;
      this.save();
    },
    render() {
      const count = this.count();
      $$("[data-cart-count]").forEach((el) => {
        el.textContent = String(count);
        el.dataset.empty = count === 0 ? "true" : "false";
      });

      const body = $("[data-cart-body]");
      if (!body) return;
      const subtotal = this.subtotal();

      if (!this.lines.length) {
        body.innerHTML = `
          <div class="empty">
            <h3>Your cart is empty</h3>
            <p>Start with the products customers reorder most, or let the quiz narrow the range down for you.</p>
            <div class="u-flex u-mt" style="justify-content:center">
              <a class="btn" href="/collections/best-sellers">Shop best sellers</a>
              <a class="btn btn--ghost" href="/quiz">Find your solution</a>
            </div>
          </div>`;
      } else {
        body.innerHTML = this.lines
          .map(
            (l, i) => `
          <div class="cart-line">
            <div class="cart-line__media">${
              l.image
                ? `<img src="${escapeAttr(l.image)}" alt="" loading="lazy" width="72" height="72">`
                : ""
            }</div>
            <div>
              <div class="cart-line__title"><a href="/products/${escapeAttr(l.handle)}">${escapeHtml(l.title)}</a></div>
              ${l.variantTitle && l.variantTitle !== "Default Title" ? `<div class="cart-line__variant">${escapeHtml(l.variantTitle)}</div>` : ""}
              <div class="cart-line__row">
                <div class="cart-line__qty">
                  <button type="button" data-qty="${i}" data-delta="-1" aria-label="Decrease quantity of ${escapeAttr(l.title)}">&minus;</button>
                  <span>${l.qty}</span>
                  <button type="button" data-qty="${i}" data-delta="1" aria-label="Increase quantity of ${escapeAttr(l.title)}">+</button>
                </div>
                <strong>${money(l.price * l.qty)}</strong>
              </div>
              <button type="button" class="cart-line__remove" data-remove="${i}">Remove</button>
            </div>
          </div>`,
          )
          .join("");
      }

      const foot = $("[data-cart-foot]");
      if (foot) {
        foot.hidden = this.lines.length === 0;
        const away = Math.max(0, FREE_SHIP - subtotal);
        const pct = Math.min(100, (subtotal / FREE_SHIP) * 100);
        const bar = $("[data-progress-fill]", foot);
        const msg = $("[data-progress-msg]", foot);
        if (bar) bar.style.width = `${pct}%`;
        if (msg) {
          msg.textContent =
            away > 0
              ? `You are ${money(away)} away from free shipping.`
              : "Your order qualifies for free shipping.";
        }
        const total = $("[data-cart-total]", foot);
        if (total) total.textContent = money(subtotal);
      }
    },
  };

  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    const qtyBtn = target.closest("[data-qty]");
    if (qtyBtn) {
      const i = Number(qtyBtn.getAttribute("data-qty"));
      const delta = Number(qtyBtn.getAttribute("data-delta"));
      const line = cart.lines[i];
      if (line) cart.setQty(i, line.qty + delta);
      return;
    }

    const removeBtn = target.closest("[data-remove]");
    if (removeBtn) {
      cart.setQty(Number(removeBtn.getAttribute("data-remove")), 0);
      return;
    }

    const addBtn = target.closest("[data-add-to-cart]");
    if (addBtn) {
      e.preventDefault();
      const data = JSON.parse(addBtn.getAttribute("data-add-to-cart") || "{}");
      const qtyInput = $("[data-qty-input]");
      const qty = addBtn.hasAttribute("data-use-qty") && qtyInput ? Math.max(1, Number(qtyInput.value) || 1) : 1;

      // On a product page the selected variant wins over the card default.
      const selected = $('[data-variant][aria-pressed="true"]');
      if (selected && addBtn.hasAttribute("data-use-qty")) {
        const v = JSON.parse(selected.getAttribute("data-variant") || "{}");
        data.variantId = v.id;
        data.variantTitle = v.title;
        data.price = v.price;
      }

      cart.add({ ...data, qty });
      if (!addBtn.hasAttribute("data-use-qty")) {
        addBtn.dataset.added = "true";
        addBtn.textContent = "Added";
        window.setTimeout(() => {
          addBtn.dataset.added = "false";
          addBtn.textContent = "Quick add";
        }, 1800);
      }
      if (addBtn.hasAttribute("data-buy-now")) {
        track("begin_checkout", { currency: "USD", value: cart.subtotal() });
      }
    }
  });

  /* ------------------------------ wishlist ------------------------------- */

  const WISH_KEY = "et:wishlist:v1";
  const wishlist = {
    items: store.get(WISH_KEY, []),
    has(handle) {
      return this.items.includes(handle);
    },
    toggle(handle, title) {
      const i = this.items.indexOf(handle);
      if (i >= 0) {
        this.items.splice(i, 1);
        toast("Removed from wishlist");
      } else {
        this.items.push(handle);
        toast(`${title} saved to wishlist`);
        track("add_to_wishlist", { items: [{ item_id: handle, item_name: title }] });
      }
      store.set(WISH_KEY, this.items);
      this.render();
    },
    render() {
      $$("[data-wish]").forEach((btn) => {
        btn.setAttribute("aria-pressed", this.has(btn.getAttribute("data-wish")) ? "true" : "false");
      });
      $$("[data-wish-count]").forEach((el) => {
        el.textContent = String(this.items.length);
        el.dataset.empty = this.items.length === 0 ? "true" : "false";
      });
    },
  };

  document.addEventListener("click", (e) => {
    const btn = e.target instanceof Element ? e.target.closest("[data-wish]") : null;
    if (!btn) return;
    e.preventDefault();
    wishlist.toggle(btn.getAttribute("data-wish"), btn.getAttribute("data-wish-title") || "Product");
  });

  /* -------------------------- recently viewed ---------------------------- */

  const RECENT_KEY = "et:recent:v1";
  function recordRecentlyViewed() {
    const el = $("[data-product-view]");
    if (!el) return;
    const item = JSON.parse(el.getAttribute("data-product-view") || "{}");
    if (!item.handle) return;

    const list = store.get(RECENT_KEY, []).filter((r) => r.handle !== item.handle);
    list.unshift(item);
    store.set(RECENT_KEY, list.slice(0, 8));

    track("view_item", {
      currency: "USD",
      value: item.price,
      items: [{ item_id: item.handle, item_name: item.title, price: item.price }],
    });
  }

  function renderRecentlyViewed() {
    const host = $("[data-recent-host]");
    if (!host) return;
    const current = $("[data-product-view]");
    const currentHandle = current ? JSON.parse(current.getAttribute("data-product-view") || "{}").handle : null;
    const list = store.get(RECENT_KEY, []).filter((r) => r.handle !== currentHandle);
    if (!list.length) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    const grid = $("[data-recent-grid]", host);
    if (!grid) return;
    grid.innerHTML = list
      .slice(0, 4)
      .map(
        (r) => `
      <a class="post" href="/products/${escapeAttr(r.handle)}">
        <div class="post__media">${r.image ? `<img src="${escapeAttr(r.image)}" alt="" loading="lazy">` : ""}</div>
        <div>
          <h3 style="font-size:1.1rem">${escapeHtml(r.title)}</h3>
          <p class="post__meta">${money(r.price)}</p>
        </div>
      </a>`,
      )
      .join("");
  }

  /* -------------------------------- search ------------------------------- */

  let searchIndex = null;
  let indexPromise = null;

  function loadIndex() {
    if (searchIndex) return Promise.resolve(searchIndex);
    if (!indexPromise) {
      indexPromise = fetch("/search-index.json")
        .then((r) => r.json())
        .then((data) => {
          searchIndex = data;
          return data;
        })
        .catch(() => {
          searchIndex = [];
          return searchIndex;
        });
    }
    return indexPromise;
  }

  function runSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q || !searchIndex) return [];
    const words = q.split(/\s+/).filter(Boolean);

    return searchIndex
      .map((doc) => {
        let score = 0;
        for (const w of words) {
          if (!doc.terms.includes(w)) return null;
          score += 1;
          if (doc.title.toLowerCase().includes(w)) score += 3;
          if (doc.title.toLowerCase().startsWith(w)) score += 2;
        }
        if (doc.type === "product") score += 1.5;
        return { doc, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((r) => r.doc);
  }

  function initSearch() {
    const overlay = $("[data-search]");
    if (!overlay) return;
    const input = $("[data-search-input]", overlay);
    const results = $("[data-search-results]", overlay);
    if (!input || !results) return;

    let debounce = 0;
    const render = () => {
      const hits = runSearch(input.value);
      if (!input.value.trim()) {
        results.innerHTML = "";
        return;
      }
      if (!hits.length) {
        results.innerHTML = `<p class="muted" style="padding:1rem .5rem">No matches for “${escapeHtml(input.value)}”. Try a model number, a product name, or the problem you are solving.</p>`;
        return;
      }
      results.innerHTML = hits
        .map(
          (h) => `
        <a class="result" href="${escapeAttr(h.href)}">
          <span class="result__type">${escapeHtml(h.type)}</span>
          <span class="result__title">${escapeHtml(h.title)}</span>
          <span class="result__meta">${escapeHtml(h.meta || "")}</span>
        </a>`,
        )
        .join("");
    };

    input.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        loadIndex().then(() => {
          render();
          if (input.value.trim().length > 2) track("search", { search_term: input.value.trim() });
        });
      }, 140);
    });

    $$("[data-search-suggest]").forEach((btn) => {
      btn.addEventListener("click", () => {
        input.value = btn.textContent.trim();
        loadIndex().then(render);
        input.focus();
      });
    });

    /* Deep links. /search/?q=term opens the overlay pre-filled and runs the
       query, so a shared or bookmarked search address actually searches; and
       typing on the search page keeps the address bar shareable. Other pages
       leave the address alone. */
    if (location.pathname.replace(/\/+$/, "") === "/search") {
      const q = new URLSearchParams(location.search).get("q");
      if (q && q.trim()) {
        const opener = $('[data-open-drawer="search"]');
        if (opener instanceof HTMLElement) opener.click();
        input.value = q.trim();
        loadIndex().then(render);
      }
      input.addEventListener("input", () => {
        const term = input.value.trim();
        history.replaceState(null, "", term ? `?q=${encodeURIComponent(term)}` : location.pathname);
      });
    }
  }

  /* ------------------------------- drawers ------------------------------- */

  let lastFocused = null;

  function openDrawer(name) {
    const el = $(`[data-drawer="${name}"]`);
    if (!el) return;
    lastFocused = document.activeElement;
    el.dataset.open = "true";
    document.body.style.overflow = "hidden";
    const focusable = el.querySelector("input, button, a[href]");
    if (focusable) window.setTimeout(() => focusable.focus(), 120);
  }

  function closeDrawers() {
    $$("[data-drawer]").forEach((el) => (el.dataset.open = "false"));
    const overlay = $("[data-search]");
    if (overlay) overlay.dataset.open = "false";
    document.body.style.overflow = "";
    if (lastFocused instanceof HTMLElement) lastFocused.focus();
  }

  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    const opener = target.closest("[data-open-drawer]");
    if (opener) {
      e.preventDefault();
      const name = opener.getAttribute("data-open-drawer");
      if (name === "search") {
        const overlay = $("[data-search]");
        if (overlay) {
          lastFocused = document.activeElement;
          overlay.dataset.open = "true";
          document.body.style.overflow = "hidden";
          loadIndex();
          const input = $("[data-search-input]", overlay);
          if (input) window.setTimeout(() => input.focus(), 80);
        }
      } else {
        openDrawer(name);
      }
      return;
    }

    if (target.closest("[data-close-drawer]")) {
      e.preventDefault();
      closeDrawers();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawers();
    if (e.key === "/" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || "")) {
      e.preventDefault();
      const opener = $('[data-open-drawer="search"]');
      if (opener instanceof HTMLElement) opener.click();
    }
  });

  // Focus trap for whichever surface is open.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const open = $('[data-drawer][data-open="true"]') || $('[data-search][data-open="true"]');
    if (!open) return;
    const nodes = $$(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      open,
    ).filter((n) => n.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  /* ----------------------------- mobile nav ------------------------------ */

  function initMobileNav() {
    $$("[data-mnav-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const panel = btn.nextElementSibling;
        if (!panel) return;
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        panel.dataset.open = String(!open);
      });
    });
  }

  /* ----------------------------- accordions ------------------------------ */

  function initAccordions() {
    $$("[data-acc-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const panel = document.getElementById(btn.getAttribute("aria-controls") || "");
        if (!panel) return;
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        panel.dataset.open = String(!open);
      });
    });
  }

  /* --------------------------- product options --------------------------- */

  function initProductOptions() {
    const buttons = $$("[data-variant]");
    if (!buttons.length) return;

    const priceEl = $("[data-price]");
    const stickyPrice = $("[data-sticky-price]");

    const select = (btn) => {
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      const v = JSON.parse(btn.getAttribute("data-variant") || "{}");
      if (priceEl) priceEl.textContent = money(v.price);
      if (stickyPrice) stickyPrice.textContent = money(v.price);
    };

    buttons.forEach((btn) => btn.addEventListener("click", () => select(btn)));
    select(buttons[0]);

    const qtyInput = $("[data-qty-input]");
    $$("[data-qty-step]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!qtyInput) return;
        const delta = Number(btn.getAttribute("data-qty-step"));
        qtyInput.value = String(Math.max(1, (Number(qtyInput.value) || 1) + delta));
      });
    });

    // Gallery
    $$("[data-gallery-thumb]").forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const main = $("[data-gallery-main]");
        const src = thumb.getAttribute("data-gallery-thumb");
        if (main && src) {
          // Give a previously failed main image a fresh chance to load.
          main.hidden = false;
          main.setAttribute("src", src);
        }
        $$("[data-gallery-thumb]").forEach((t) => t.setAttribute("aria-current", String(t === thumb)));
      });
    });

    // Sticky mobile buy bar appears once the main add button scrolls away.
    const sticky = $("[data-sticky-buy]");
    const anchor = $("[data-buy-anchor]");
    if (sticky && anchor && "IntersectionObserver" in window) {
      new IntersectionObserver(
        ([entry]) => {
          sticky.dataset.show = String(!entry.isIntersecting && entry.boundingClientRect.top < 0);
        },
        { threshold: 0 },
      ).observe(anchor);
    }
  }

  /* -------------------------------- quiz --------------------------------- */

  function initQuiz() {
    const quiz = $("[data-quiz]");
    if (!quiz) return;

    const steps = $$("[data-quiz-step]", quiz);
    const bars = $$("[data-quiz-bar] i", quiz);
    const resultHost = $("[data-quiz-result]", quiz);
    const results = JSON.parse(quiz.getAttribute("data-quiz-results") || "[]");
    const picked = [];
    let index = 0;

    const show = (i) => {
      steps.forEach((s, n) => (s.dataset.active = String(n === i)));
      bars.forEach((b, n) => (b.dataset.done = String(n <= i)));
      if (resultHost) resultHost.hidden = true;
      const heading = steps[i] ? $("h2", steps[i]) : null;
      if (heading instanceof HTMLElement) heading.focus();
    };

    const finish = () => {
      steps.forEach((s) => (s.dataset.active = "false"));
      bars.forEach((b) => (b.dataset.done = "true"));
      if (!resultHost) return;

      // Best match wins: the result matching the most of the chosen tags.
      let best = null;
      let bestScore = -1;
      for (const r of results) {
        if (!r.match.every((t) => picked.includes(t))) continue;
        if (r.match.length > bestScore) {
          best = r;
          bestScore = r.match.length;
        }
      }
      if (!best) best = results[results.length - 1];

      resultHost.hidden = false;
      resultHost.innerHTML = `
        <p class="eyebrow">Your recommendation</p>
        <h2>${escapeHtml(best.title)}</h2>
        <p class="lede u-mt">${escapeHtml(best.text)}</p>
        <div class="grid grid--3 u-mt-lg">${best.cards}</div>
        <div class="u-flex u-mt-lg">
          ${best.collectionHandle ? `<a class="btn" href="/collections/${escapeAttr(best.collectionHandle)}">Explore the full range</a>` : ""}
          <button class="btn btn--ghost" type="button" data-quiz-restart>Start over</button>
        </div>`;
      resultHost.setAttribute("tabindex", "-1");
      resultHost.focus();
      track("generate_lead", { method: "solution_quiz", result: best.id });
    };

    $$("[data-quiz-opt]", quiz).forEach((btn) => {
      btn.addEventListener("click", () => {
        const tags = (btn.getAttribute("data-quiz-opt") || "").split(",").filter(Boolean);
        picked.length = index; // truncate if the visitor went back
        picked.splice(index, 0, ...tags);
        index += 1;
        if (index >= steps.length) finish();
        else show(index);
      });
    });

    $$("[data-quiz-back]", quiz).forEach((btn) => {
      btn.addEventListener("click", () => {
        if (index > 0) {
          index -= 1;
          picked.length = index;
          show(index);
        }
      });
    });

    quiz.addEventListener("click", (e) => {
      if (e.target instanceof Element && e.target.closest("[data-quiz-restart]")) {
        picked.length = 0;
        index = 0;
        show(0);
      }
    });

    show(0);
  }

  /* ---------------------------- filter finder ---------------------------- */

  function initFinder() {
    const finder = $("[data-finder]");
    if (!finder) return;

    const steps = $$("[data-finder-step]", finder);
    const showStep = (id) => {
      steps.forEach((s) => (s.dataset.active = String(s.getAttribute("data-finder-step") === id)));
      const target = steps.find((s) => s.getAttribute("data-finder-step") === id);
      const heading = target ? $("h2", target) : null;
      if (heading instanceof HTMLElement) heading.focus();
    };

    $$("[data-finder-go]", finder).forEach((btn) => {
      btn.addEventListener("click", () => showStep(btn.getAttribute("data-finder-go") || "brand"));
    });

    showStep("brand");
  }

  /* --------------------------- collection filter -------------------------- */

  function initCollectionFilters() {
    const grid = $("[data-filter-grid]");
    if (!grid) return;

    const cards = $$("[data-card]", grid);
    const chips = $$("[data-filter]");
    const sort = $("[data-sort]");
    const countEl = $("[data-filter-count]");
    const emptyEl = $("[data-filter-empty]");
    const active = new Set();

    const apply = () => {
      let shown = 0;
      cards.forEach((card) => {
        const tags = (card.getAttribute("data-tags") || "").split(" ");
        const ok = active.size === 0 || Array.from(active).every((t) => tags.includes(t));
        card.hidden = !ok;
        if (ok) shown += 1;
      });
      if (countEl) countEl.textContent = `${shown} ${shown === 1 ? "product" : "products"}`;
      if (emptyEl) emptyEl.hidden = shown !== 0;
    };

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const tag = chip.getAttribute("data-filter");
        const on = chip.getAttribute("aria-pressed") === "true";
        chip.setAttribute("aria-pressed", String(!on));
        if (on) active.delete(tag);
        else active.add(tag);
        apply();
      });
    });

    if (sort) {
      sort.addEventListener("change", () => {
        const mode = sort.value;
        const sorted = cards.slice().sort((a, b) => {
          const pa = Number(a.getAttribute("data-price"));
          const pb = Number(b.getAttribute("data-price"));
          const na = a.getAttribute("data-name") || "";
          const nb = b.getAttribute("data-name") || "";
          if (mode === "price-asc") return pa - pb;
          if (mode === "price-desc") return pb - pa;
          if (mode === "name") return na.localeCompare(nb);
          return Number(a.getAttribute("data-order")) - Number(b.getAttribute("data-order"));
        });
        sorted.forEach((c) => grid.appendChild(c));
      });
    }

    apply();
  }

  /* ------------------------------- reveal -------------------------------- */

  function initReveal() {
    const nodes = $$("[data-reveal]");
    if (!nodes.length) return;
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((n) => n.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
    );
    nodes.forEach((n) => io.observe(n));
  }

  /** Images that failed before this script ran never fire the event again. */
  function sweepFailedImages() {
    $$("img[data-img-fallback]").forEach((img) => {
      if (img.complete && img.naturalWidth === 0) {
        img.hidden = true;
        img.closest(".card__media, .gallery__main")?.classList.remove("has-image");
      }
    });
  }

  /* --------------------------- header + progress -------------------------- */

  function initHeader() {
    const header = $(".header--over");
    const rail = $("[data-scroll-rail]");
    if (!header && !rail) return;

    const onScroll = () => {
      if (header) header.classList.toggle("is-stuck", window.scrollY > 40);
      if (rail) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        rail.style.width = max > 0 ? `${(window.scrollY / max) * 100}%` : "0%";
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ------------------------------- forms --------------------------------- */

  function initForms() {
    $$("[data-newsletter]").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = $("input[type=email]", form);
        if (!input || !input.value) return;
        track("sign_up", { method: "newsletter" });
        form.innerHTML = `<p class="u-mt">Thank you. Look for a note from us shortly.</p>`;
      });
    });

    $$("[data-demo-form]").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        toast("This is a design preview. No message was sent.");
      });
    });
  }

  /* ------------------------------- helpers -------------------------------- */

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }

  /* --------------------------------- boot --------------------------------- */

  /**
   * Each module owns one surface, so a failure in one must not leave the rest
   * of the page inert. Isolate them rather than letting the first throw stop
   * every later init.
   */
  function run(name, fn) {
    try {
      fn();
    } catch (err) {
      console.error(`EarthTrade: ${name} failed to initialise`, err);
    }
  }

  function boot() {
    run("cart", () => cart.render());
    run("wishlist", () => wishlist.render());
    run("recentlyViewed", () => {
      recordRecentlyViewed();
      renderRecentlyViewed();
    });
    run("search", initSearch);
    run("mobileNav", initMobileNav);
    run("accordions", initAccordions);
    run("productOptions", initProductOptions);
    run("quiz", initQuiz);
    run("finder", initFinder);
    run("collectionFilters", initCollectionFilters);
    run("reveal", initReveal);
    run("imageFallbacks", sweepFailedImages);
    run("header", initHeader);
    run("forms", initForms);

    const checkout = $("[data-checkout]");
    if (checkout) {
      checkout.addEventListener("click", (e) => {
        e.preventDefault();
        if (!cart.lines.length) return;
        track("begin_checkout", {
          currency: "USD",
          value: cart.subtotal(),
          items: cart.lines.map((l) => ({
            item_id: l.variantId,
            item_name: l.title,
            price: l.price,
            quantity: l.qty,
          })),
        });
        toast("Checkout is not connected in this design preview.");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
