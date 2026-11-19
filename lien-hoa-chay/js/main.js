/**
 * LIÊN HOA CHAY HẢI DƯƠNG — SHUHARI INTERACTIVE ENGINE
 * ====================================================
 */
(() => {
  "use strict";

  const DATA = window.LIENHOA_DATA;
  if (!DATA) return;
  const I18N = window.LIENHOA_I18N || {};

  function detectDefaultLang() {
    const saved = localStorage.getItem("lienhoa_lang");
    if (saved && (saved === "vi" || I18N[saved])) return saved;
    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("zh-tw") || nav.startsWith("zh-hk") || nav.startsWith("zh-hant")) return "zh-TW";
    if (nav.startsWith("zh")) return "zh-CN";
    return "vi";
  }

  let currentLang = detectDefaultLang();
  const tPack = () => (currentLang !== "vi" ? I18N[currentLang] : null);
  const tUI = (key, fallback) => tPack()?.ui?.[key] ?? fallback;

  const getDishView = (m) => {
    const tr = tPack()?.menu?.[m.id];
    if (!tr) return m;
    return { ...m, name: tr.name, badge: tr.badge, desc: tr.desc, healthNote: tr.health };
  };

  const getSetView = (s) => {
    const tr = tPack()?.catering?.[s.id];
    if (!tr) return s;
    return { ...s, name: tr.name, guests: tr.guests, desc: tr.desc };
  };

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
     1. THỈNH CHUÔNG AN LẠC (HTML5 AUDIO MP3 + WEBAUDIO FALLBACK)
     ------------------------------------------------------------------ */
  let zenAudioCtx = null;

  function playZenBellFallback() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!zenAudioCtx) zenAudioCtx = new AudioCtx();
      if (zenAudioCtx.state === "suspended") zenAudioCtx.resume();
      const now = zenAudioCtx.currentTime;
      const master = zenAudioCtx.createGain();
      master.gain.setValueAtTime(0.55, now);
      master.connect(zenAudioCtx.destination);
      [
        { freq: 216, gain: 0.45, dur: 5.8 },
        { freq: 217.5, gain: 0.25, dur: 5.6 },
        { freq: 598, gain: 0.2, dur: 4.0 }
      ].forEach((p) => {
        const osc = zenAudioCtx.createOscillator();
        const g = zenAudioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(p.freq, now);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(p.gain, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + p.dur);
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + p.dur + 0.05);
      });
    } catch {
      /* ignore */
    }
  }

  function playZenBell() {
    const btn = $("#btnZenBell");
    if (btn) {
      btn.classList.remove("ringing");
      void btn.offsetWidth;
      btn.classList.add("ringing");
      setTimeout(() => btn.classList.remove("ringing"), 3200);
    }

    const audio = $("#zenBellAudio");
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0.9;
        const p = audio.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => playZenBellFallback());
        }
      } catch {
        playZenBellFallback();
      }
    } else {
      playZenBellFallback();
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
      .map((raw, idx) => {
        const m = getDishView(raw);
        const tag = tags[idx] || tags[0];
        const addLbl = tUI("addToTray", "+ Thêm Vào Mâm");
        return `
          <article class="spotlight-card">
            <div class="spotlight-img-wrap" data-quick-view="${m.id}">
              <img src="${m.image}" alt="${m.name}" loading="lazy">
              <span class="spotlight-tag ${tag.cls}">${m.badge || tag.label}</span>
            </div>
            <div class="spotlight-body">
              <div class="dish-title-row">
                <h3 class="dish-name" data-quick-view="${m.id}">${m.name}</h3>
                <span class="dish-price">${formatMoney(m.price)}</span>
              </div>
              <p class="dish-desc">${m.desc}</p>
              <div class="spotlight-card-footer">
                <span class="portion-info">🌿 ${m.healthNote}</span>
                <button type="button" class="btn-spotlight-add" data-add-dish="${m.id}">${addLbl}</button>
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
      .map((c) => {
        const catName = tPack()?.categories?.[c.id] || c.name;
        return `
        <button type="button" class="cat-pill ${activeCat === c.id ? "active" : ""}" data-cat="${c.id}">
          <span>${catName}</span>
          <span class="pill-badge">${countOf(c.id)}</span>
        </button>
      `;
      })
      .join("");
  }

  function renderMenu() {
    const q = stripAccents(searchQuery.trim());
    const list = DATA.menu
      .map((raw) => ({ raw, view: getDishView(raw) }))
      .filter(({ raw, view }) => {
        const okCat = activeCat === "all" || raw.category === activeCat;
        if (!okCat) return false;
        if (!q) return true;
        return stripAccents(`${raw.name} ${view.name} ${raw.desc} ${view.desc} ${view.healthNote}`).includes(q);
      });

    const grid = $("#menuGrid");
    const empty = $("#menuEmptyState");
    if (list.length === 0) {
      grid.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    const addLbl = tUI("addToTray", "+ Thêm Vào Mâm");
    empty.style.display = "none";
    grid.innerHTML = list
      .map(
        ({ view: m }) => `
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
              <button type="button" class="btn-spotlight-add" data-add-dish="${m.id}">${addLbl}</button>
            </div>
          </div>
        </article>
      `
      )
      .join("");
  }

  function renderCatering() {
    const addSetLbl = tUI("addSet", "+ Chọn Mâm Cỗ");
    $("#cateringGrid").innerHTML = DATA.cateringSets
      .map((raw) => {
        const s = getSetView(raw);
        return `
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
              <button type="button" class="btn-spotlight-add" data-add-dish="${s.id}">${addSetLbl}</button>
            </div>
          </div>
        </article>
      `;
      })
      .join("");
  }

  const MEDIA = window.LIENHOA_MEDIA || { videos: [], photoArchive: DATA.gallery };
  let galleryCat = "all";
  let galleryLimit = 12;

  function getFilteredGallery() {
    const list = MEDIA.photoArchive || DATA.gallery;
    return galleryCat === "all" ? list : list.filter((g) => g.category === galleryCat);
  }

  function updateLiveOpenStatus() {
    const el = $("#liveOpenStatus");
    if (!el) return;
    const now = new Date();
    const vnTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const mins = vnTime.getHours() * 60 + vnTime.getMinutes();
    const isOpen = (mins >= 11 * 60 && mins <= 13 * 60 + 30) || (mins >= 18 * 60 && mins <= 20 * 60 + 30);

    if (currentLang === "zh-CN") {
      el.textContent = isOpen
        ? "🟢 正在营业中 (11:00 – 13:30 & 18:00 – 20:30)"
        : "🪷 营业时间: 11:00 – 13:30 & 18:00 – 20:30（欢迎提前预订）";
    } else if (currentLang === "zh-TW") {
      el.textContent = isOpen
        ? "🟢 正在營業中 (11:00 – 13:30 & 18:00 – 20:30)"
        : "🪷 營業時間: 11:00 – 13:30 & 18:00 – 20:30（歡迎提前預訂）";
    } else {
      el.textContent = isOpen
        ? "🟢 Đang Mở Cửa Đón Khách (11:00 – 13:30 & 18:00 – 20:30)"
        : "🪷 Giờ đón khách: 11:00 – 13:30 & 18:00 – 20:30 (Nhận đặt bàn 24/7)";
    }
  }

  function renderVideos() {
    const grid = $("#videoShowcaseGrid");
    if (!grid || !MEDIA.videos) return;
    const fsLabel = currentLang === "vi" ? "⛶ Toàn Màn Hình" : "⛶ 全屏";
    grid.innerHTML = MEDIA.videos
      .map(
        (v) => `
        <article class="video-card">
          <div class="video-media-wrap">
            <video id="vid-${v.id}" controls preload="none" playsinline poster="${v.poster}">
              <source src="${v.src}" type="video/mp4">
            </video>
            <button type="button" class="btn-video-play-center" data-play-vid="vid-${v.id}" aria-label="Phát video ${v.title}">▶</button>
            <button type="button" class="btn-video-fullscreen" data-fullscreen-vid="vid-${v.id}" title="${fsLabel}">
              ${fsLabel}
            </button>
          </div>
          <div class="video-card-body">
            <div class="video-card-top">
              <span class="video-tag">🎬 ${v.tag}</span>
              <button type="button" class="btn-video-fs-inline" data-fullscreen-vid="vid-${v.id}">${fsLabel}</button>
            </div>
            <h4>${v.title}</h4>
          </div>
        </article>
      `
      )
      .join("");

    // Hide center play overlay once video plays
    $$("video", grid).forEach((vid) => {
      vid.addEventListener("play", () => {
        vid.parentElement?.classList.add("playing");
      });
      vid.addEventListener("pause", () => {
        if (vid.currentTime === 0) vid.parentElement?.classList.remove("playing");
      });
    });
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

    const getArticleView = (raw, lang = currentLang) => {
      if (lang === "vi") return raw;
      const tr = I18N[lang]?.articles?.[raw.id];
      return tr ? { ...raw, ...tr } : raw;
    };

    const readLbl = tUI("readMore", "Đọc bài viết →");
    $("#blogGrid").innerHTML = DATA.articles
      .map((raw) => {
        const a = getArticleView(raw);
        return `
        <article class="blog-card">
          <img src="${a.image}" alt="${a.title}" loading="lazy">
          <div class="blog-card-body">
            <div class="blog-tag">${a.tag} • ${a.readTime}</div>
            <h3>${a.title}</h3>
            <p>${a.excerpt}</p>
            <div class="blog-tts-row">
              <button type="button" class="btn-tts" data-speak-article="${a.id}" data-speak-lang="vi" title="Nghe đọc Tiếng Việt">🔊 VI</button>
              <button type="button" class="btn-tts" data-speak-article="${a.id}" data-speak-lang="zh-CN" title="简体中文朗读">🔊 简中</button>
              <button type="button" class="btn-tts" data-speak-article="${a.id}" data-speak-lang="zh-TW" title="繁體中文朗讀">🔊 繁中</button>
              <button type="button" class="btn-tts btn-tts-stop" data-speak-stop title="Dừng đọc">⏹</button>
            </div>
            <button type="button" class="btn-read-blog" data-article-id="${a.id}">${readLbl}</button>
          </div>
        </article>
      `;
      })
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
     4B. TEXT-TO-SPEECH (ĐỌC BÀI VIẾT BẰNG 3 NGÔN NGỮ: VI / 简中 / 繁中)
     ------------------------------------------------------------------ */
  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    $$(".btn-tts.speaking").forEach((b) => b.classList.remove("speaking"));
  }

  function speakArticle(articleId, lang, triggerBtn) {
    if (!("speechSynthesis" in window)) {
      showToast("Trình duyệt chưa hỗ trợ đọc giọng nói.");
      return;
    }
    const raw = DATA.articles.find((x) => x.id === articleId);
    if (!raw) return;

    const wasSpeaking = triggerBtn?.classList.contains("speaking");
    stopSpeaking();
    if (wasSpeaking) return;

    const tr = lang === "vi" ? raw : I18N[lang]?.articles?.[raw.id] || raw;
    const fullText = `${tr.title}. ${tr.content.join(" ")}`;
    const utter = new SpeechSynthesisUtterance(fullText);
    utter.lang = lang === "vi" ? "vi-VN" : lang;
    utter.rate = 0.96;

    const voices = window.speechSynthesis.getVoices();
    const matched = voices.find((v) => v.lang.toLowerCase().startsWith(utter.lang.toLowerCase().slice(0, 5)))
      || voices.find((v) => v.lang.toLowerCase().startsWith(utter.lang.toLowerCase().slice(0, 2)));
    if (matched) utter.voice = matched;

    if (triggerBtn) triggerBtn.classList.add("speaking");
    utter.onend = () => triggerBtn?.classList.remove("speaking");
    utter.onerror = () => triggerBtn?.classList.remove("speaking");

    window.speechSynthesis.speak(utter);
    const labelMap = { vi: "Tiếng Việt", "zh-CN": "简体中文", "zh-TW": "繁體中文" };
    showToast(`🔊 Đang đọc bài viết (${labelMap[lang] || lang})`);
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
    stopSpeaking();
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
        const raw = DATA.articles.find((x) => x.id === art.dataset.articleId);
        if (raw) {
          const a = currentLang === "vi" ? raw : I18N[currentLang]?.articles?.[raw.id] ? { ...raw, ...I18N[currentLang].articles[raw.id] } : raw;
          openDetail(`
            <span class="zen-flower-tag">${a.tag} • ${a.readTime}</span>
            <h3 style="font-family:var(--font-heading);font-size:1.35rem;margin:6px 0 12px;">${a.title}</h3>
            <div class="blog-tts-row" style="margin-bottom:14px;">
              <button type="button" class="btn-tts" data-speak-article="${a.id}" data-speak-lang="vi">🔊 Đọc Tiếng Việt</button>
              <button type="button" class="btn-tts" data-speak-article="${a.id}" data-speak-lang="zh-CN">🔊 简中朗读</button>
              <button type="button" class="btn-tts" data-speak-article="${a.id}" data-speak-lang="zh-TW">🔊 繁體朗讀</button>
              <button type="button" class="btn-tts btn-tts-stop" data-speak-stop>⏹ Dừng</button>
            </div>
            <img src="${a.image}" alt="${a.title}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;margin-bottom:14px;">
            ${a.content.map((p) => `<p style="color:var(--text-muted);margin-bottom:12px;font-size:0.92rem;">${p}</p>`).join("")}
          `);
        }
        return;
      }
      const speakBtn = e.target.closest("[data-speak-article]");
      if (speakBtn) {
        speakArticle(speakBtn.dataset.speakArticle, speakBtn.dataset.speakLang, speakBtn);
        return;
      }
      if (e.target.closest("[data-speak-stop]")) {
        stopSpeaking();
        showToast("⏹ Đã dừng đọc");
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
        return;
      }
      const playBtn = e.target.closest("[data-play-vid]");
      if (playBtn) {
        const vid = document.getElementById(playBtn.dataset.playVid);
        if (vid) vid.play().catch(() => {});
        return;
      }
      const fsBtn = e.target.closest("[data-fullscreen-vid]");
      if (fsBtn) {
        const vid = document.getElementById(fsBtn.dataset.fullscreenVid);
        if (vid) {
          vid.play().catch(() => {});
          if (vid.requestFullscreen) {
            vid.requestFullscreen().catch(() => {});
          } else if (vid.webkitRequestFullscreen) {
            vid.webkitRequestFullscreen();
          } else if (vid.webkitEnterFullscreen) {
            vid.webkitEnterFullscreen();
          }
        }
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
            entries
              .map((x) => {
                const tr = tPack()?.menu?.[x.item.id] || tPack()?.catering?.[x.item.id];
                const label = tr ? `${tr.name} (${x.item.name})` : x.item.name;
                return `- ${label} × ${x.qty}`;
              })
              .join("\n") +
            `\n💰 Tạm tính: ${formatMoney(total)}`
          : "";
      const msg = [
        "🪷 ĐẶT BÀN — LIÊN HOA CHAY HẢI DƯƠNG (海阳莲花素食)",
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
        showToast(currentLang === "vi" ? "Đã sao chép phiếu đặt bàn! Đang mở Zalo..." : "已复制双语预订单！正在打开 Zalo...");
      } catch {
        showToast("Zalo...");
      }
      closeReserve();
      setTimeout(() => window.open(DATA.brand.contact.zaloUrl, "_blank", "noopener"), 450);
    });

    // Driver / Taxi Address Card (出示给司机看)
    $("#btnDriverCard")?.addEventListener("click", () => {
      openDetail(`
        <span class="zen-flower-tag">${tUI("driverTitle", "🚕 ĐƯA TÀI XẾ TAXI / GRAB XEM")}</span>
        <p style="color:var(--text-muted);margin:8px 0 14px;font-size:0.9rem;">${tUI("driverHint", "Quý khách đưa màn hình này cho tài xế để đến đúng nhà hàng:")}</p>
        <div style="background:var(--bg-subtle);border:2px solid var(--zen-leaf);border-radius:14px;padding:20px;margin-bottom:14px;">
          <div style="font-size:0.85rem;color:var(--text-dim);font-weight:700;margin-bottom:6px;">NHÀ HÀNG CHAY LIÊN HOA</div>
          <div style="font-size:1.25rem;font-weight:800;line-height:1.45;color:var(--text-main);">
            Lô 94.7 Đường Trường Chinh (Đối diện đường Hoàng Quốc Việt), Phường Tứ Minh, Thành phố Hải Dương
          </div>
          <div style="margin-top:12px;font-size:1rem;color:var(--text-gold);font-weight:700;">
            📞 0933.286.133 (Ms. Thạo) – 090.418.4986
          </div>
        </div>
        <p style="font-size:0.82rem;color:var(--text-muted);">${tUI("driverNote", "Giờ đón khách: 11:00 – 13:30 & 18:00 – 20:30")}</p>
      `);
    });

    // Language Switcher (VI | 简 | 繁)
    $$(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyLanguage(btn.dataset.lang);
      });
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

    // Smart Phone / Hotline Click (works on both Mobile dialer & Desktop PC)
    document.addEventListener("click", async (e) => {
      const telLink = e.target.closest('a[href^="tel:"]');
      if (!telLink) return;
      const num = telLink.getAttribute("href").replace("tel:", "").trim();
      try {
        await navigator.clipboard.writeText(num);
      } catch {
        /* ignore */
      }

      // On Desktop (or floating call button), also show Hotline + QR modal so user gets clear visual feedback
      const isDesktop = window.innerWidth >= 768;
      if (isDesktop || telLink.classList.contains("fab-call")) {
        e.preventDefault();
        openDetail(`
          <span class="zen-flower-tag">📞 HOTLINE ĐẶT BÀN &amp; TƯ VẤN MÂM CỖ CHAY</span>
          <h3 style="font-family:var(--font-heading);font-size:1.35rem;margin:6px 0 12px;">Liên Hệ Trực Tiếp Nhà Hàng Chay Liên Hoa</h3>
          <div style="display:grid;gap:10px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--bg-subtle);padding:12px 14px;border-radius:12px;border:1px solid var(--border-subtle);">
              <div>
                <div style="font-size:0.78rem;color:var(--text-muted);">Hotline chính (Ms. Thạo)</div>
                <strong style="font-size:1.15rem;color:var(--text-gold);">0933.286.133</strong>
              </div>
              <div style="display:flex;gap:8px;">
                <button type="button" class="btn-copy-loc" onclick="navigator.clipboard.writeText('0933286133');this.textContent='✓ Đã chép'">📋 Sao chép</button>
                <a href="tel:0933286133" class="btn-spotlight-add">📞 Gọi</a>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--bg-subtle);padding:12px 14px;border-radius:12px;border:1px solid var(--border-subtle);">
              <div>
                <div style="font-size:0.78rem;color:var(--text-muted);">Hotline &amp; Zalo đặt bàn</div>
                <strong style="font-size:1.15rem;color:var(--text-gold);">090.418.4986</strong>
              </div>
              <div style="display:flex;gap:8px;">
                <button type="button" class="btn-copy-loc" onclick="navigator.clipboard.writeText('0904184986');this.textContent='✓ Đã chép'">📋 Sao chép</button>
                <a href="tel:0904184986" class="btn-spotlight-add">📞 Gọi</a>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:14px;background:var(--bg-subtle);padding:12px;border-radius:12px;">
            <img src="./assets/images/qr-phone.png" alt="Mã QR gọi 0933.286.133" style="width:84px;height:84px;background:#fff;padding:4px;border-radius:8px;flex-shrink:0;">
            <div style="font-size:0.84rem;color:var(--text-muted);">
              <strong style="color:var(--text-main);display:block;margin-bottom:3px;">Đang xem trên máy tính?</strong>
              Mở camera điện thoại quét mã QR bên cạnh để gọi ngay số <strong>0933.286.133</strong>, hoặc bấm <strong>Sao chép</strong> ở trên.
            </div>
          </div>
        `);
      } else {
        showToast(`📞 Đang mở trình gọi & đã sao chép số ${num}`);
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

  // Snapshot original Vietnamese UI once so switching back to VI is instant (no page reload!)
  const viSnapshot = {};
  function captureViSnapshot() {
    if (viSnapshot.ready) return;
    viSnapshot.ready = true;
    viSnapshot.topAddress = $("#topAddress")?.textContent;
    viSnapshot.topHotline = $("#topPhoneLink span")?.textContent;
    viSnapshot.brandName = $(".brand-name")?.textContent;
    viSnapshot.brandSub = $(".brand-sub")?.textContent;
    viSnapshot.navTexts = $$("#navLinks .nav-item").map((el) => el.textContent);
    viSnapshot.bellBtn = $(".bell-text")?.textContent;
    viSnapshot.mapsBtn = $("#headerMapsLink .btn-nav-text")?.textContent;
    viSnapshot.reserveBtn = $("#btnOpenReserveModal .btn-nav-text")?.textContent;
    viSnapshot.pill1 = $(".pill-leaf")?.textContent;
    viSnapshot.pill2 = $(".pill-city")?.textContent;
    viSnapshot.heroTitle = $(".hero-title")?.innerHTML;
    viSnapshot.heroDesc = $("#heroDesc")?.innerHTML;
    viSnapshot.heroMenuCta = $(".btn-zen-primary span")?.textContent;
    viSnapshot.heroBookCta = $("#btnHeroReserve span")?.textContent;
    viSnapshot.heroMapCta = $("#heroMapsBtn span")?.textContent;
    viSnapshot.metrics = $$(".metric-item").map((el) => [
      el.querySelector(".metric-number")?.textContent,
      el.querySelector(".metric-label")?.textContent
    ]);
    viSnapshot.heroQuote = $(".hero-floating-quote .quote-text")?.textContent;
    viSnapshot.heroQuoteSign = $(".hero-floating-quote .quote-sign")?.textContent;
    viSnapshot.pillars = $$("#storySection .pillar-card").map((el) => ({
      title: el.querySelector(".pillar-title")?.textContent,
      desc: el.querySelector(".pillar-desc")?.textContent
    }));
    viSnapshot.spotSub = $("#spotlightSection .section-subtitle")?.textContent;
    viSnapshot.spotTitle = $("#spotlightSection .section-title")?.textContent;
    viSnapshot.spotDesc = $("#spotlightSection .section-desc")?.textContent;
    viSnapshot.menuSub = $("#menuSection .section-subtitle")?.textContent;
    viSnapshot.menuTitle = $("#menuSection .section-title")?.textContent;
    viSnapshot.searchPh = $("#menuSearchInput")?.placeholder;
    viSnapshot.catSub = $("#cateringSection .section-subtitle")?.textContent;
    viSnapshot.catTitle = $("#cateringSection .section-title")?.textContent;
    viSnapshot.catDesc = $("#cateringSection .section-desc")?.textContent;
    viSnapshot.spaceSub = $("#spaceSection .section-subtitle")?.textContent;
    viSnapshot.spaceTitle = $("#spaceSection .section-title")?.textContent;
    viSnapshot.spaceText = $(".space-text")?.innerHTML;
    viSnapshot.spaceFeats = $$(".s-feat-item").map((el) => ({
      title: el.querySelector("strong")?.textContent,
      desc: el.querySelector("p")?.textContent
    }));
    viSnapshot.spaceBook = $("#btnSpaceReserve span")?.textContent;
    viSnapshot.spaceCall = $(".btn-space-call span")?.textContent;
    viSnapshot.mindSub = $("#mindfulSection .zen-flower-badge")?.textContent;
    viSnapshot.mindTitle = $("#mindfulSection .mindful-title")?.textContent;
    viSnapshot.mindDesc = $("#mindfulSection .mindful-sub")?.textContent;
    viSnapshot.mindBtn = $("#btnDrawCard span:last-child")?.textContent;
    viSnapshot.revSub = $("#reviewsSection .section-subtitle")?.textContent;
    viSnapshot.revTitle = $("#reviewsSection .section-title")?.textContent;
    viSnapshot.revBadge = $(".rating-badge-pill span:last-child")?.innerHTML;
    viSnapshot.blogSub = $(".blog-block .section-subtitle")?.textContent;
    viSnapshot.blogTitle = $(".blog-block .section-title")?.textContent;
    viSnapshot.locSub = $("#locationSection .section-subtitle")?.textContent;
    viSnapshot.locTitle = $("#locationSection .loc-title")?.textContent;
    viSnapshot.locHours = $("#locHoursText")?.textContent;
    viSnapshot.locMap = $(".btn-maps-action span")?.textContent;
    viSnapshot.locCopy = $("#btnCopyAddress span")?.textContent;
    viSnapshot.locDriver = $("#btnDriverCard span")?.textContent;
    viSnapshot.aiBadge = $("#aiConsultantSection .zen-flower-badge")?.textContent;
    viSnapshot.aiTitle = $("#aiConsultantSection .mindful-title")?.textContent;
    viSnapshot.aiSub = $("#aiConsultantSection .mindful-sub")?.textContent;
    viSnapshot.aiPh = $("#aiChatInput")?.placeholder;
    viSnapshot.aiBtn = $("#aiChatForm button[type='submit']")?.textContent;
  }

  function restoreViSnapshot() {
    const s = viSnapshot;
    if (!s.ready) return;
    $("#topAddress").textContent = s.topAddress;
    $("#topPhoneLink span").textContent = s.topHotline;
    $(".brand-name").textContent = s.brandName;
    $(".brand-sub").textContent = s.brandSub;
    $$("#navLinks .nav-item").forEach((el, i) => { if (s.navTexts[i]) el.textContent = s.navTexts[i]; });
    $(".bell-text").textContent = s.bellBtn;
    $("#headerMapsLink .btn-nav-text").textContent = s.mapsBtn;
    $("#btnOpenReserveModal .btn-nav-text").textContent = s.reserveBtn;
    $(".pill-leaf").textContent = s.pill1;
    $(".pill-city").textContent = s.pill2;
    $(".hero-title").innerHTML = s.heroTitle;
    $("#heroDesc").innerHTML = s.heroDesc;
    $(".btn-zen-primary span").textContent = s.heroMenuCta;
    $("#btnHeroReserve span").textContent = s.heroBookCta;
    $("#heroMapsBtn span").textContent = s.heroMapCta;
    $$(".metric-item").forEach((el, i) => {
      if (s.metrics[i]) {
        el.querySelector(".metric-number").textContent = s.metrics[i][0];
        el.querySelector(".metric-label").textContent = s.metrics[i][1];
      }
    });
    $(".hero-floating-quote .quote-text").textContent = s.heroQuote;
    $(".hero-floating-quote .quote-sign").textContent = s.heroQuoteSign;
    $$("#storySection .pillar-card").forEach((el, i) => {
      if (s.pillars[i]) {
        el.querySelector(".pillar-title").textContent = s.pillars[i].title;
        el.querySelector(".pillar-desc").textContent = s.pillars[i].desc;
      }
    });
    $("#spotlightSection .section-subtitle").textContent = s.spotSub;
    $("#spotlightSection .section-title").textContent = s.spotTitle;
    $("#spotlightSection .section-desc").textContent = s.spotDesc;
    $("#menuSection .section-subtitle").textContent = s.menuSub;
    $("#menuSection .section-title").textContent = s.menuTitle;
    $("#menuSearchInput").placeholder = s.searchPh;
    $("#cateringSection .section-subtitle").textContent = s.catSub;
    $("#cateringSection .section-title").textContent = s.catTitle;
    $("#cateringSection .section-desc").textContent = s.catDesc;
    $("#spaceSection .section-subtitle").textContent = s.spaceSub;
    $("#spaceSection .section-title").textContent = s.spaceTitle;
    $(".space-text").innerHTML = s.spaceText;
    $$(".s-feat-item").forEach((el, i) => {
      if (s.spaceFeats[i]) {
        el.querySelector("strong").textContent = s.spaceFeats[i].title;
        el.querySelector("p").textContent = s.spaceFeats[i].desc;
      }
    });
    $("#btnSpaceReserve span").textContent = s.spaceBook;
    $(".btn-space-call span").textContent = s.spaceCall;
    $("#mindfulSection .zen-flower-badge").textContent = s.mindSub;
    $("#mindfulSection .mindful-title").textContent = s.mindTitle;
    $("#mindfulSection .mindful-sub").textContent = s.mindDesc;
    $("#btnDrawCard span:last-child").textContent = s.mindBtn;
    $("#reviewsSection .section-subtitle").textContent = s.revSub;
    $("#reviewsSection .section-title").textContent = s.revTitle;
    $(".rating-badge-pill span:last-child").innerHTML = s.revBadge;
    $(".blog-block .section-subtitle").textContent = s.blogSub;
    $(".blog-block .section-title").textContent = s.blogTitle;
    $("#locationSection .section-subtitle").textContent = s.locSub;
    $("#locationSection .loc-title").textContent = s.locTitle;
    $("#locHoursText").textContent = s.locHours;
    $(".btn-maps-action span").textContent = s.locMap;
    $("#btnCopyAddress span").textContent = s.locCopy;
    $("#btnDriverCard span").textContent = s.locDriver;
    if ($("#aiConsultantSection")) {
      $("#aiConsultantSection .zen-flower-badge").textContent = s.aiBadge;
      $("#aiConsultantSection .mindful-title").textContent = s.aiTitle;
      $("#aiConsultantSection .mindful-sub").textContent = s.aiSub;
      $("#aiChatInput").placeholder = s.aiPh;
      $("#aiChatForm button[type='submit']").textContent = s.aiBtn;
    }
  }

  function applyLanguage(lang) {
    captureViSnapshot();
    currentLang = lang === "zh-CN" || lang === "zh-TW" ? lang : "vi";
    try {
      localStorage.setItem("lienhoa_lang", currentLang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = currentLang;
    $$(".lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === currentLang));

    const pack = tPack();
    const u = pack?.ui;
    if (u) {
      $("#liveOpenStatus").textContent = u.topHours;
      $("#topAddress").textContent = u.topAddress;
      $("#topPhoneLink span").textContent = u.topHotline;
      $(".brand-name").textContent = u.brandName;
      $(".brand-sub").textContent = u.brandSub;

      const navTexts = [u.navHome, u.navSpotlight, u.navMenu, u.navCatering, u.navSpace, u.navMindful, u.navLocation];
      $$("#navLinks .nav-item").forEach((el, i) => {
        if (navTexts[i]) el.textContent = navTexts[i];
      });
      $(".bell-text").textContent = u.bellBtn;
      $("#headerMapsLink .btn-nav-text").textContent = u.mapsBtn;
      $("#btnOpenReserveModal .btn-nav-text").textContent = u.reserveBtn;

      $(".pill-leaf").textContent = u.heroPill1;
      $(".pill-city").textContent = u.heroPill2;
      $(".hero-title").innerHTML = `${u.heroTitle1} <br><span class="gradient-zen">${u.heroTitle2}</span>`;
      $("#heroDesc").innerHTML = u.heroDesc;
      $(".btn-zen-primary span").textContent = u.heroMenuCta;
      $("#btnHeroReserve span").textContent = u.heroBookCta;
      $("#heroMapsBtn span").textContent = u.heroMapCta;

      const mPairs = [[u.m1Num, u.m1Lbl], [u.m2Num, u.m2Lbl], [u.m3Num, u.m3Lbl], [u.m4Num, u.m4Lbl]];
      $$(".metric-item").forEach((el, i) => {
        if (mPairs[i]) {
          el.querySelector(".metric-number").textContent = mPairs[i][0];
          el.querySelector(".metric-label").textContent = mPairs[i][1];
        }
      });
      $(".hero-floating-quote .quote-text").textContent = u.heroQuote;
      $(".hero-floating-quote .quote-sign").textContent = u.heroQuoteSign;

      $$("#storySection .pillar-card").forEach((el, i) => {
        if (u.pillars[i]) {
          el.querySelector(".pillar-title").textContent = u.pillars[i].title;
          el.querySelector(".pillar-desc").textContent = u.pillars[i].desc;
        }
      });

      $("#spotlightSection .section-subtitle").textContent = u.spotSub;
      $("#spotlightSection .section-title").textContent = u.spotTitle;
      $("#spotlightSection .section-desc").textContent = u.spotDesc;

      $("#menuSection .section-subtitle").textContent = u.menuSub;
      $("#menuSection .section-title").textContent = u.menuTitle;
      $("#menuSearchInput").placeholder = u.searchPlaceholder;
      $("#menuEmptyState h3").textContent = u.emptyTitle;
      $("#menuEmptyState p").textContent = u.emptyDesc;
      $("#btnResetMenu").textContent = u.resetMenu;

      $("#cateringSection .section-subtitle").textContent = u.catSub;
      $("#cateringSection .section-title").textContent = u.catTitle;
      $("#cateringSection .section-desc").textContent = u.catDesc;

      $("#spaceSection .section-subtitle").textContent = u.spaceSub;
      $("#spaceSection .section-title").textContent = u.spaceTitle;
      $(".space-text").innerHTML = u.spaceText;
      $$(".s-feat-item").forEach((el, i) => {
        if (u.spaceFeats[i]) {
          el.querySelector("strong").textContent = u.spaceFeats[i].title;
          el.querySelector("p").textContent = u.spaceFeats[i].desc;
        }
      });
      $("#btnSpaceReserve span").textContent = u.spaceBookBtn;
      $(".btn-space-call span").textContent = u.spaceCallBtn;

      const mediaSubs = $$("#spaceSection .media-subsection");
      if (mediaSubs[0]) {
        mediaSubs[0].querySelector(".section-subtitle").textContent = u.vidSub;
        mediaSubs[0].querySelector(".section-title").textContent = u.vidTitle;
      }
      if (mediaSubs[1]) {
        mediaSubs[1].querySelector(".section-subtitle").textContent = u.galSub;
        mediaSubs[1].querySelector(".section-title").textContent = u.galTitle;
      }

      $("#mindfulSection .zen-flower-badge").textContent = u.mindSub;
      $("#mindfulSection .mindful-title").textContent = u.mindTitle;
      $("#mindfulSection .mindful-sub").textContent = u.mindDesc;
      $("#btnDrawCard span:last-child").textContent = u.mindDrawBtn;

      if (u.aiBadge && $("#aiConsultantSection")) {
        $("#headerAiStatusText").textContent = u.aiKeyBtn;
        $("#aiConsultantSection .zen-flower-badge").textContent = u.aiBadge;
        $("#aiConsultantSection .mindful-title").textContent = u.aiTitle;
        $("#aiConsultantSection .mindful-sub").textContent = u.aiSub;
        $("#aiChatInput").placeholder = u.aiInputPh;
        $("#aiChatForm button[type='submit']").textContent = u.aiSubmitBtn;
      }
      if (pack.quotes?.[0]) {
        $("#activeQuoteText").textContent = pack.quotes[0].quote;
        $("#activeQuoteAuthor").textContent = `— ${pack.quotes[0].author}`;
      }

      $("#reviewsSection .section-subtitle").textContent = u.revSub;
      $("#reviewsSection .section-title").textContent = u.revTitle;
      $(".rating-badge-pill span:last-child").textContent = u.revBadge;
      $(".blog-block .section-subtitle").textContent = u.blogSub;
      $(".blog-block .section-title").textContent = u.blogTitle;

      $("#locationSection .section-subtitle").textContent = u.locSub;
      $("#locationSection .loc-title").textContent = u.locTitle;
      $("#locHoursText").textContent = u.locHoursVal;
      $(".btn-maps-action span").textContent = u.locMapBtn;
      $("#btnCopyAddress span").textContent = u.locCopyBtn;
      $("#btnDriverCard span").textContent = u.locDriverBtn;

      const qrs = $$(".qr-box");
      if (qrs[0]) {
        qrs[0].querySelector("strong").textContent = u.qrZaloTitle;
        qrs[0].querySelector("span").textContent = u.qrZaloSub;
      }
      if (qrs[1]) {
        qrs[1].querySelector("strong").textContent = u.qrCallTitle;
        qrs[1].querySelector("span").textContent = u.qrCallSub;
      }

      $("#cartDrawerTitle").textContent = u.cartTitle;
      $(".cart-split-line label").textContent = u.cartPeopleLbl;
      $(".cart-total-line span:first-child").textContent = u.cartTotalLbl;
      $(".cart-per-line span").textContent = u.cartPerLbl;
      $(".cart-zen-note").textContent = u.cartZenNote;
      $("#btnCheckoutZalo span:last-child").textContent = u.cartZaloBtn;
      $("#btnDrawerToReserve span").textContent = u.cartReserveBtn;

      $(".zen-flower-tag").textContent = u.resTag;
      $("#modalReserveTitle").textContent = u.resTitle;
      $("label[for='resName']").textContent = u.resNameLbl;
      $("label[for='resPhone']").textContent = u.resPhoneLbl;
      $("label[for='resGuests']").textContent = u.resGuestsLbl;
      $("label[for='resType']").textContent = u.resTypeLbl;
      $("label[for='resTime']").textContent = u.resTimeLbl;
      $("label[for='resNote']").textContent = u.resNoteLbl;
      $(".btn-submit-reserve").textContent = u.resSubmitBtn;

      const mb = $$(".mobile-bottom-bar a, .mobile-bottom-bar button");
      if (mb[0]) mb[0].querySelector("span:last-child").textContent = u.mbCall;
      if (mb[1]) mb[1].querySelector("span:last-child").textContent = u.mbMenu;
      if (mb[2]) mb[2].querySelector("span:last-child").textContent = u.mbBook;
    } else {
      restoreViSnapshot();
    }

    updateLiveOpenStatus();
    renderSpotlight();
    renderCategoryPills();
    renderMenu();
    renderCatering();
    renderVideos();
    renderReviewsAndBlog();
    renderTray();
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
  updateLiveOpenStatus();
  bindEvents();
  $("#btnPrintMenu")?.addEventListener("click", () => window.print());
  if (currentLang !== "vi") {
    applyLanguage(currentLang);
  }
})();
