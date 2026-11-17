/**
 * LIÊN HOA CHAY HẢI DƯƠNG — SHUHARI INTERACTIVE ENGINE
 * ====================================================
 */
(() => {
  "use strict";

  const DATA = window.LIENHOA_DATA;
  if (!DATA) return;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const formatMoney = (val) =>
    typeof val === "number" && val > 0 ? val.toLocaleString("vi-VN") + "đ" : "Liên hệ";

  const stripAccents = (str = "") =>
    str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();

  function showToast(msg) {
    const box = $("#toastContainer");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "toast-msg";
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  /* ------------------------------------------------------------------
     1. WEBAUDIO TIBETAN SINGING BOWL (THỈNH CHUÔNG AN LẠC NGÂN VANG)
     ------------------------------------------------------------------ */
  let zenAudioCtx = null;

  async function playZenBell() {
    const btn = $("#btnZenBell");
    if (btn) {
      btn.classList.remove("ringing");
      void btn.offsetWidth; // trigger reflow to restart animation
      btn.classList.add("ringing");
      setTimeout(() => btn.classList.remove("ringing"), 3200);
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!zenAudioCtx) {
        zenAudioCtx = new AudioCtx();
      }
      if (zenAudioCtx.state === "suspended") {
        await zenAudioCtx.resume();
      }

      const now = zenAudioCtx.currentTime;
      const master = zenAudioCtx.createGain();
      master.gain.setValueAtTime(0.55, now);
      master.connect(zenAudioCtx.destination);

      // Rich singing bowl partials (fundamental + inharmonic overtones + gentle beating)
      const partials = [
        { freq: 216, gain: 0.45, dur: 5.8 },
        { freq: 217.6, gain: 0.25, dur: 5.6 }, // subtle warm shimmer/beating
        { freq: 596, gain: 0.22, dur: 4.2 },
        { freq: 1166, gain: 0.12, dur: 2.8 },
        { freq: 1928, gain: 0.06, dur: 1.8 }
      ];

      partials.forEach((p) => {
        const osc = zenAudioCtx.createOscillator();
        const g = zenAudioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(p.freq, now);

        // Soft mallet attack (18ms) -> long resonant exponential decay
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(p.gain, now + 0.018);
        g.gain.exponentialRampToValueAtTime(0.0001, now + p.dur);

        osc.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + p.dur + 0.05);
      });
    } catch {
      /* ignore if audio blocked by browser policy */
    }
    showToast("🔔 Tiếng chuông an lạc đang ngân vang — Thân tâm thanh tịnh");
  }

  /* ------------------------------------------------------------------
     2. CART / TRAY STATE (LOCALSTORAGE)
     ------------------------------------------------------------------ */
  const STORAGE_KEY = "lienhoa_tray_v2";
  let tray = {};
  try {
    tray = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    tray = {};
  }

  const allOrderable = () => [
    ...DATA.menu,
    ...DATA.cateringSets.map((s) => ({
      id: s.id,
      name: `${s.name} (${s.guests})`,
      price: s.price,
      image: s.image,
      desc: s.desc
    }))
  ];

  function saveTray() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tray));
    } catch {
      /* ignore */
    }
    renderTray();
  }

  function addToTray(id) {
    const item = allOrderable().find((x) => x.id === id);
    if (!item) return;
    tray[id] = (tray[id] || 0) + 1;
    saveTray();
    showToast(`Đã thêm "${item.name}" vào mâm`);
  }

  function updateQty(id, delta) {
    const next = (tray[id] || 0) + delta;
    if (next <= 0) delete tray[id];
    else tray[id] = next;
    saveTray();
  }

  function getTrayEntries() {
    const map = new Map(allOrderable().map((x) => [x.id, x]));
    return Object.entries(tray)
      .filter(([id, qty]) => qty > 0 && map.has(id))
      .map(([id, qty]) => ({ item: map.get(id), qty }));
  }

  function renderTray() {
    const entries = getTrayEntries();
    const totalCount = entries.reduce((s, e) => s + e.qty, 0);
    const totalAmount = entries.reduce((s, e) => s + e.item.price * e.qty, 0);

    ["#cartCountBadge", "#mbCartCount"].forEach((sel) => {
      const el = $(sel);
      if (el) el.textContent = totalCount;
    });

    const container = $("#cartItemsContainer");
    if (container) {
      if (entries.length === 0) {
        container.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:36px 12px;">Mâm món ăn đang trống.<br>Hãy chọn món từ Thực đơn hoặc Set Cỗ nhé!</p>`;
      } else {
        container.innerHTML = entries
          .map(
            ({ item, qty }) => `
            <div class="cart-item-row">
              <div class="cart-item-info">
                <strong>${item.name}</strong>
                <span>${formatMoney(item.price)} × ${qty} = ${formatMoney(item.price * qty)}</span>
              </div>
              <div class="qty-ctrl">
                <button type="button" data-qty-id="${item.id}" data-delta="-1">−</button>
                <span>${qty}</span>
                <button type="button" data-qty-id="${item.id}" data-delta="1">+</button>
              </div>
            </div>
          `
          )
          .join("");
      }
    }

    const people = Math.max(1, parseInt($("#cartPeopleInput")?.value || "4", 10) || 1);
    if ($("#cartTotalAmount")) $("#cartTotalAmount").textContent = formatMoney(totalAmount);
    if ($("#cartPerPersonAmount")) {
      $("#cartPerPersonAmount").textContent = formatMoney(Math.round(totalAmount / people));
    }

    const preview = $("#reserveTrayPreview");
    if (preview) {
      if (entries.length === 0) {
        preview.style.display = "none";
      } else {
        preview.style.display = "block";
        preview.innerHTML =
          `<strong>Mâm đã chọn (${totalCount} món • ${formatMoney(totalAmount)}):</strong><br>` +
          entries.map((e) => `• ${e.item.name} × ${e.qty}`).join("<br>");
      }
    }
  }

  /* ------------------------------------------------------------------
     3. RENDER SECTIONS
     ------------------------------------------------------------------ */
  function renderSpotlight() {
    const ids = DATA.spotlightIds || [];
    const tags = [
      { label: "Món Ký Danh Số 1", cls: "" },
      { label: "Thanh Tao Bổ Dưỡng", cls: "pink" },
      { label: "Tinh Hoa Thực Dưỡng", cls: "gold" }
    ];
    const items = ids.map((id) => DATA.menu.find((m) => m.id === id)).filter(Boolean);

    $("#spotlightGrid").innerHTML = items
      .map((m, idx) => {
        const tag = tags[idx] || tags[0];
        return `
          <article class="spotlight-card">
            <div class="spotlight-img-wrap" data-quick-view="${m.id}">
              <img src="${m.image}" alt="${m.name}" loading="lazy">
              <span class="spotlight-tag ${tag.cls}">${tag.label}</span>
            </div>
            <div class="spotlight-body">
              <div class="dish-title-row">
                <h3 class="dish-name" data-quick-view="${m.id}">${m.name}</h3>
                <span class="dish-price">${formatMoney(m.price)}</span>
              </div>
              <p class="dish-desc">${m.desc}</p>
              <div class="spotlight-card-footer">
                <span class="portion-info">🌿 ${m.healthNote}</span>
                <button type="button" class="btn-spotlight-add" data-add-dish="${m.id}">+ Thêm Vào Mâm</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  let activeCat = "all";
  let searchQuery = "";

  function renderCategoryPills() {
    const countOf = (id) =>
      id === "all" ? DATA.menu.length : DATA.menu.filter((m) => m.category === id).length;

    $("#categoryPills").innerHTML = DATA.categories
      .map(
        (c) => `
        <button type="button" class="cat-pill ${activeCat === c.id ? "active" : ""}" data-cat="${c.id}">
          <span>${c.name}</span>
          <span class="pill-badge">${countOf(c.id)}</span>
        </button>
      `
      )
      .join("");
  }

  function renderMenu() {
    const q = stripAccents(searchQuery.trim());
    const list = DATA.menu.filter((m) => {
      const okCat = activeCat === "all" || m.category === activeCat;
      if (!okCat) return false;
      if (!q) return true;
      return stripAccents(`${m.name} ${m.desc} ${m.healthNote}`).includes(q);
    });

    const grid = $("#menuGrid");
    const empty = $("#menuEmptyState");
    if (list.length === 0) {
      grid.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    grid.innerHTML = list
      .map(
        (m) => `
        <article class="menu-card">
          <div class="menu-card-media" data-quick-view="${m.id}">
            <img src="${m.image}" alt="${m.name}" loading="lazy">
            ${m.badge ? `<span class="menu-card-badge">${m.badge}</span>` : ""}
          </div>
          <div class="menu-card-body">
            <h3 data-quick-view="${m.id}">${m.name}</h3>
            <p>${m.desc}</p>
            <div class="menu-card-foot">
              <span class="dish-price">${formatMoney(m.price)}</span>
              <button type="button" class="btn-spotlight-add" data-add-dish="${m.id}">+ Thêm Vào Mâm</button>
            </div>
          </div>
        </article>
      `
      )
      .join("");
  }

  function renderCatering() {
    $("#cateringGrid").innerHTML = DATA.cateringSets
      .map(
        (s) => `
        <article class="menu-card">
          <div class="menu-card-media" data-lb-src="${s.image}" data-lb-cap="${s.name} (${s.guests})">
            <img src="${s.image}" alt="${s.name}" loading="lazy">
            <span class="menu-card-badge">👥 ${s.guests}</span>
          </div>
          <div class="menu-card-body">
            <h3>${s.name}</h3>
            <p>${s.desc}</p>
            <div class="menu-card-foot">
              <span class="dish-price">${formatMoney(s.price)}</span>
              <button type="button" class="btn-spotlight-add" data-add-dish="${s.id}">+ Chọn Mâm Cỗ</button>
            </div>
          </div>
        </article>
      `
      )
      .join("");
  }

  const MEDIA = window.LIENHOA_MEDIA || { videos: [], photoArchive: DATA.gallery };
  let galleryCat = "all";
  let galleryLimit = 12;

  function getFilteredGallery() {
    const list = MEDIA.photoArchive || DATA.gallery;
    return galleryCat === "all" ? list : list.filter((g) => g.category === galleryCat);
  }

  function renderVideos() {
    const grid = $("#videoShowcaseGrid");
    if (!grid || !MEDIA.videos) return;
    grid.innerHTML = MEDIA.videos
      .map(
        (v) => `
        <article class="video-card">
          <video controls preload="metadata" playsinline poster="${v.poster}">
            <source src="${v.src}" type="video/mp4">
          </video>
          <div class="video-card-body">
            <span class="video-tag">🎬 ${v.tag}</span>
            <h4>${v.title}</h4>
          </div>
        </article>
      `
      )
      .join("");
  }

  function renderGalleryTabs() {
    const tabs = $("#galleryFilterTabs");
    if (!tabs) return;
    const all = MEDIA.photoArchive || DATA.gallery;
    const cats = ["all", ...new Set(all.map((g) => g.category))];
    tabs.innerHTML = cats
      .map((c) => {
        const count = c === "all" ? all.length : all.filter((g) => g.category === c).length;
        const label = c === "all" ? "Tất cả ảnh" : c;
        return `
          <button type="button" class="cat-pill ${galleryCat === c ? "active" : ""}" data-gcat="${c}">
            <span>${label}</span>
            <span class="pill-badge">${count}</span>
          </button>
        `;
      })
      .join("");
  }

  function renderGallery() {
    const filtered = getFilteredGallery();
    const visible = filtered.slice(0, galleryLimit);
    $("#galleryGrid").innerHTML = visible
      .map(
        (g, idx) => `
        <figure class="gallery-thumb" data-lb-index="${idx}">
          <img src="${g.src}" alt="${g.title}" loading="lazy">
          <figcaption>${g.title}</figcaption>
        </figure>
      `
      )
      .join("");

    const moreBtn = $("#btnLoadMoreGallery");
    if (moreBtn) {
      const rem = filtered.length - visible.length;
      if (rem > 0) {
        moreBtn.style.display = "inline-flex";
        moreBtn.textContent = `Xem Thêm Ảnh (còn ${rem} ảnh)`;
      } else {
        moreBtn.style.display = "none";
      }
    }
  }

  function renderReviewsAndBlog() {
    $("#reviewsGrid").innerHTML = DATA.testimonials
      .map(
        (t) => `
        <article class="review-card">
          <div class="stars-gold">${"★".repeat(t.rating)}</div>
          <p class="review-quote">“${t.quote}”</p>
          <div class="review-author">
            <strong>${t.name}</strong>
            <span>${t.role}</span>
          </div>
        </article>
      `
      )
      .join("");

    $("#blogGrid").innerHTML = DATA.articles
      .map(
        (a) => `
        <article class="blog-card">
          <img src="${a.image}" alt="${a.title}" loading="lazy">
          <div class="blog-card-body">
            <div class="blog-tag">${a.tag} • ${a.readTime}</div>
            <h3>${a.title}</h3>
            <p>${a.excerpt}</p>
            <button type="button" class="btn-read-blog" data-article-id="${a.id}">Đọc bài viết →</button>
          </div>
        </article>
      `
      )
      .join("");
  }

  /* ------------------------------------------------------------------
     4. MINDFUL QUOTE DRAWING (RÚT THẺ BÌNH AN)
     ------------------------------------------------------------------ */
  let quoteIdx = 0;
  function drawMindfulQuote() {
    const quotes = DATA.mindfulQuotes || [];
    if (quotes.length === 0) return;
    quoteIdx = (quoteIdx + 1 + Math.floor(Math.random() * (quotes.length - 1))) % quotes.length;
    const q = quotes[quoteIdx];
    $("#activeQuoteText").textContent = q.quote;
    $("#activeQuoteAuthor").textContent = `— ${q.author}`;

    const dish = DATA.menu.find((m) => m.id === q.dishId);
    const box = $("#mindfulDishSuggest");
    if (dish && box) {
      box.innerHTML = `
        <span>Gợi ý hợp duyên: <strong>${dish.name}</strong> (${formatMoney(dish.price)})</span>
        <button type="button" class="btn-spotlight-add" data-add-dish="${dish.id}">+ Thêm món gợi ý</button>
      `;
    }
  }

  /* ------------------------------------------------------------------
     5. DRAWER, MODALS & LIGHTBOX
     ------------------------------------------------------------------ */
  const cartOverlay = $("#cartDrawerOverlay");
  const reserveOverlay = $("#reserveModalOverlay");
  const detailOverlay = $("#detailModalOverlay");
  const lbOverlay = $("#lightboxOverlay");
  let lbIdx = 0;

  const openCart = () => {
    cartOverlay.classList.add("open");
    cartOverlay.setAttribute("aria-hidden", "false");
  };
  const closeCart = () => {
    cartOverlay.classList.remove("open");
    cartOverlay.setAttribute("aria-hidden", "true");
  };

  const openReserve = () => {
    renderTray();
    reserveOverlay.classList.add("open");
    reserveOverlay.setAttribute("aria-hidden", "false");
  };
  const closeReserve = () => {
    reserveOverlay.classList.remove("open");
    reserveOverlay.setAttribute("aria-hidden", "true");
  };

  const openDetail = (html) => {
    $("#detailModalBody").innerHTML = html;
    detailOverlay.classList.add("open");
    detailOverlay.setAttribute("aria-hidden", "false");
  };
  const closeDetail = () => {
    detailOverlay.classList.remove("open");
    detailOverlay.setAttribute("aria-hidden", "true");
  };

  function openLightboxIdx(idx) {
    const list = getFilteredGallery();
    if (list.length === 0) return;
    lbIdx = (idx + list.length) % list.length;
    const g = list[lbIdx];
    $("#lbImg").src = g.src;
    $("#lbCaption").textContent = `${g.title} (${lbIdx + 1}/${list.length})`;
    lbOverlay.classList.add("open");
    lbOverlay.setAttribute("aria-hidden", "false");
  }
  function openLightboxCustom(src, cap) {
    $("#lbImg").src = src;
    $("#lbCaption").textContent = cap;
    lbOverlay.classList.add("open");
    lbOverlay.setAttribute("aria-hidden", "false");
  }
  const closeLightbox = () => {
    lbOverlay.classList.remove("open");
    lbOverlay.setAttribute("aria-hidden", "true");
  };

  /* ------------------------------------------------------------------
     6. EVENTS
     ------------------------------------------------------------------ */
  function bindEvents() {
    // Theme persistence
    const savedTheme = localStorage.getItem("lienhoa_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);

    $("#btnThemeToggle")?.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme");
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("lienhoa_theme", next);
    });

    // Font toggle A / A+
    $("#btnFontToggle")?.addEventListener("click", (e) => {
      const on = document.documentElement.classList.toggle("large-font");
      e.currentTarget.setAttribute("aria-pressed", String(on));
      showToast(on ? "Đã bật cỡ chữ lớn dễ đọc" : "Đã về cỡ chữ tiêu chuẩn");
    });

    // Zen Bell
    $("#btnZenBell")?.addEventListener("click", playZenBell);

    // Mobile Nav
    $("#btnHamburger")?.addEventListener("click", () => {
      $("#navLinks")?.classList.toggle("open");
    });
    $$(".nav-item").forEach((a) =>
      a.addEventListener("click", () => $("#navLinks")?.classList.remove("open"))
    );

    // Search & Category
    $("#menuSearchInput")?.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderMenu();
    });
    $("#btnResetMenu")?.addEventListener("click", () => {
      searchQuery = "";
      activeCat = "all";
      $("#menuSearchInput").value = "";
      renderCategoryPills();
      renderMenu();
    });
    $("#categoryPills")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cat]");
      if (!btn) return;
      activeCat = btn.dataset.cat;
      renderCategoryPills();
      renderMenu();
    });

    // Gallery Filter & Load More
    $("#galleryFilterTabs")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-gcat]");
      if (!btn) return;
      galleryCat = btn.dataset.gcat;
      galleryLimit = 12;
      renderGalleryTabs();
      renderGallery();
    });
    $("#btnLoadMoreGallery")?.addEventListener("click", () => {
      galleryLimit += 18;
      renderGallery();
    });

    // Mindful Quote
    $("#btnDrawCard")?.addEventListener("click", drawMindfulQuote);

    // Delegated clicks
    document.addEventListener("click", (e) => {
      const add = e.target.closest("[data-add-dish]");
      if (add) {
        addToTray(add.dataset.addDish);
        return;
      }
      const qty = e.target.closest("[data-qty-id]");
      if (qty) {
        updateQty(qty.dataset.qtyId, parseInt(qty.dataset.delta, 10));
        return;
      }
      const qv = e.target.closest("[data-quick-view]");
      if (qv) {
        const m = DATA.menu.find((x) => x.id === qv.dataset.quickView);
        if (m) {
          openDetail(`
            <img src="${m.image}" alt="${m.name}" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:12px;margin-bottom:14px;">
            <h3 style="font-family:var(--font-heading);font-size:1.35rem;margin-bottom:6px;">${m.name}</h3>
            <p style="color:var(--text-gold);font-weight:800;font-size:1.1rem;margin-bottom:10px;">${formatMoney(m.price)}</p>
            <p style="color:var(--text-muted);margin-bottom:12px;">${m.desc}</p>
            <div style="background:var(--bg-subtle);padding:10px 12px;border-radius:10px;font-size:0.86rem;margin-bottom:16px;">🌿 <strong>Dưỡng sinh:</strong> ${m.healthNote}</div>
            <button type="button" class="btn-submit-reserve" data-add-dish="${m.id}">+ Thêm Vào Mâm Món Ăn</button>
          `);
        }
        return;
      }
      const art = e.target.closest("[data-article-id]");
      if (art) {
        const a = DATA.articles.find((x) => x.id === art.dataset.articleId);
        if (a) {
          openDetail(`
            <span class="zen-flower-tag">${a.tag} • ${a.readTime}</span>
            <h3 style="font-family:var(--font-heading);font-size:1.35rem;margin:6px 0 12px;">${a.title}</h3>
            <img src="${a.image}" alt="${a.title}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;margin-bottom:14px;">
            ${a.content.map((p) => `<p style="color:var(--text-muted);margin-bottom:12px;font-size:0.92rem;">${p}</p>`).join("")}
          `);
        }
        return;
      }
      const lbIdxEl = e.target.closest("[data-lb-index]");
      if (lbIdxEl) {
        openLightboxIdx(parseInt(lbIdxEl.dataset.lbIndex, 10));
        return;
      }
      const lbCustom = e.target.closest("[data-lb-src]");
      if (lbCustom) {
        openLightboxCustom(lbCustom.dataset.lbSrc, lbCustom.dataset.lbCap);
      }
    });

    // Cart Drawer
    $("#btnOpenCartDrawer")?.addEventListener("click", openCart);
    $("#mbCartBtn")?.addEventListener("click", openCart);
    $("#btnCloseCartDrawer")?.addEventListener("click", closeCart);
    cartOverlay?.addEventListener("click", (e) => {
      if (e.target === cartOverlay) closeCart();
    });
    $("#cartPeopleInput")?.addEventListener("input", renderTray);

    $("#btnDrawerToReserve")?.addEventListener("click", () => {
      closeCart();
      openReserve();
    });

    $("#btnCheckoutZalo")?.addEventListener("click", async () => {
      const entries = getTrayEntries();
      if (entries.length === 0) {
        showToast("Mâm món đang trống, hãy chọn ít nhất 1 món nhé!");
        return;
      }
      const total = entries.reduce((s, e) => s + e.item.price * e.qty, 0);
      const msg =
        "🪷 ĐẶT MÓN — LIÊN HOA CHAY HẢI DƯƠNG\n" +
        entries.map((e) => `• ${e.item.name} × ${e.qty}`).join("\n") +
        `\n💰 Tổng tạm tính: ${formatMoney(total)}`;
      try {
        await navigator.clipboard.writeText(msg);
        showToast("Đã sao chép thực đơn! Đang mở Zalo...");
      } catch {
        showToast("Đang mở Zalo nhà hàng...");
      }
      setTimeout(() => window.open(DATA.brand.contact.zaloUrl, "_blank", "noopener"), 400);
    });

    // Reserve Modal
    ["#btnOpenReserveModal", "#btnHeroReserve", "#btnSpaceReserve", "#mbReserveBtn"].forEach((s) => {
      $(s)?.addEventListener("click", openReserve);
    });
    $("#btnCloseReserveModal")?.addEventListener("click", closeReserve);
    reserveOverlay?.addEventListener("click", (e) => {
      if (e.target === reserveOverlay) closeReserve();
    });

    // Default datetime-local
    const resTime = $("#resTime");
    if (resTime && !resTime.value) {
      const d = new Date(Date.now() + 3600000);
      d.setMinutes(0, 0, 0);
      resTime.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }

    $("#reserveForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const entries = getTrayEntries();
      const total = entries.reduce((s, x) => s + x.item.price * x.qty, 0);
      const trayTxt =
        entries.length > 0
          ? "\n📋 Món đã chọn:\n" +
            entries.map((x) => `- ${x.item.name} × ${x.qty}`).join("\n") +
            `\n💰 Tạm tính: ${formatMoney(total)}`
          : "";
      const msg = [
        "🪷 ĐẶT BÀN — LIÊN HOA CHAY HẢI DƯƠNG",
        `• Khách hàng: ${$("#resName").value.trim()} (${$("#resPhone").value.trim()})`,
        `• Số khách: ${$("#resGuests").value} người`,
        `• Loại hình: ${$("#resType").value}`,
        `• Thời gian: ${$("#resTime").value.replace("T", " ")}`,
        $("#resNote").value.trim() ? `• Ghi chú: ${$("#resNote").value.trim()}` : "",
        trayTxt
      ]
        .filter(Boolean)
        .join("\n");

      try {
        await navigator.clipboard.writeText(msg);
        showToast("Đã sao chép phiếu đặt bàn! Đang mở Zalo...");
      } catch {
        showToast("Đang mở Zalo nhà hàng...");
      }
      closeReserve();
      setTimeout(() => window.open(DATA.brand.contact.zaloUrl, "_blank", "noopener"), 450);
    });

    // Detail & Lightbox
    $("#btnCloseDetailModal")?.addEventListener("click", closeDetail);
    detailOverlay?.addEventListener("click", (e) => {
      if (e.target === detailOverlay) closeDetail();
    });
    $("#lbClose")?.addEventListener("click", closeLightbox);
    $("#lbPrev")?.addEventListener("click", () => openLightboxIdx(lbIdx - 1));
    $("#lbNext")?.addEventListener("click", () => openLightboxIdx(lbIdx + 1));
    lbOverlay?.addEventListener("click", (e) => {
      if (e.target === lbOverlay) closeLightbox();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeCart();
        closeReserve();
        closeDetail();
        closeLightbox();
      }
    });

    // Copy Address
    $("#btnCopyAddress")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(DATA.brand.contact.address);
        showToast("Đã sao chép địa chỉ Liên Hoa Chay!");
      } catch {
        showToast(DATA.brand.contact.address);
      }
    });

    $("#yearNow").textContent = new Date().getFullYear();
  }

  renderSpotlight();
  renderCategoryPills();
  renderMenu();
  renderCatering();
  renderVideos();
  renderGalleryTabs();
  renderGallery();
  renderReviewsAndBlog();
  renderTray();
  bindEvents();
})();
