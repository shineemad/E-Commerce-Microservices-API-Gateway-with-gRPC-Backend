/* ══════════════════════════════════════════
   FEATURES.JS — Flash sale, categories, wishlist, detail modal & dashboard
══════════════════════════════════════════ */

/* ── Hero Background Mosaic ── */
// Foto latar dari Unsplash — gadget/tech vibes
const HERO_BG_PHOTOS = [
  "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&q=75&auto=format&fit=crop", // laptop open
  "https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=600&q=75&auto=format&fit=crop", // phone in hand
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=75&auto=format&fit=crop", // headphones
  "https://images.unsplash.com/photo-1527814050087-3793815479db?w=600&q=75&auto=format&fit=crop", // mouse
  "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=75&auto=format&fit=crop", // keyboard
  "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=600&q=75&auto=format&fit=crop", // code/screen
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=75&auto=format&fit=crop", // watch
  "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=600&q=75&auto=format&fit=crop", // dark tech setup
  "https://images.unsplash.com/photo-1496181091800-b9e8d6fd17a4?w=600&q=75&auto=format&fit=crop", // macbook
];

function renderHeroBg() {
  const el = $id("sh-bg-mosaic");
  if (!el) return;
  // 9 tiles (first spans 2col×2row visually via CSS)
  el.innerHTML = HERO_BG_PHOTOS.map(
    (url, i) =>
      '<div class="sh-bg-tile">' +
      '<img src="' +
      url +
      '" alt="" loading="' +
      (i < 3 ? "eager" : "lazy") +
      '" decoding="async">' +
      "</div>",
  ).join("");
}

const FLASH_PRODUCTS = [
  { id: "dp-011", disc: 20 },
  { id: "dp-001", disc: 15 },
  { id: "dp-003", disc: 25 },
  { id: "dp-008", disc: 18 },
  { id: "dp-009", disc: 30 },
];

/* ── Flash Sale Renderer ── */
function renderFlashSale() {
  const el = $id("flash-products");
  if (!el) return;
  const source = S.products.length ? S.products : DUMMY_PRODUCTS;
  el.innerHTML = FLASH_PRODUCTS.map((fp) => {
    const p = source.find((x) => x.id === fp.id) || source[0];
    if (!p) return "";
    const emoji =
      smartEmoji(p.name) || ICONS[hash(p.id || p.name) % ICONS.length];
    const origPrice = p.price;
    const discPrice = origPrice * (1 - fp.disc / 100);
    return (
      '<div class="flash-card" onclick="openProductDetail(\'' +
      esc(p.id) +
      "')\">" +
      '<div class="flash-disc-badge">-' +
      fp.disc +
      "%</div>" +
      '<div class="flash-card-visual">' +
      '<img class="flash-card-img" src="' +
      productImage(p) +
      '" alt="' +
      esc(p.name) +
      '" loading="lazy" onerror="this.outerHTML=\'<div style=&quot;font-size:48px&quot;>' +
      emoji +
      "</div>'\">" +
      "</div>" +
      '<div class="flash-card-name">' +
      esc(p.name) +
      "</div>" +
      '<div class="flash-card-prices">' +
      '<span class="flash-price-original">Rp\u00a0' +
      fmt(origPrice) +
      "</span>" +
      '<span class="flash-price-disc">Rp\u00a0' +
      fmt(discPrice) +
      "</span>" +
      "</div>" +
      '<button class="flash-card-btn" onclick="event.stopPropagation();addToCart(\'' +
      esc(p.id) +
      "')\">Beli Sekarang</button>" +
      "</div>"
    );
  }).join("");
}

/* ── Category Visual Cards ── */
const CAT_VISUAL = [
  { key: "all", label: "Semua Produk", icon: "🛒", cls: "cat-vc-all" },
  {
    key: "laptop",
    label: "Laptop & Monitor",
    icon: "💻",
    cls: "cat-vc-laptop",
  },
  { key: "phone", label: "Smartphone", icon: "📱", cls: "cat-vc-phone" },
  { key: "audio", label: "Audio", icon: "🎧", cls: "cat-vc-audio" },
  {
    key: "peripheral",
    label: "Peripheral",
    icon: "🖱️",
    cls: "cat-vc-peripheral",
  },
  { key: "storage", label: "Storage", icon: "💾", cls: "cat-vc-storage" },
];

function renderCategoryCards() {
  const el = $id("cat-cards-grid");
  if (!el) return;
  const source = S.products.length ? S.products : DUMMY_PRODUCTS;
  el.innerHTML = CAT_VISUAL.map((c) => {
    const count =
      c.key === "all"
        ? source.length
        : source.filter((p) => (p.category || "") === c.key).length;
    return (
      '<div class="cat-visual-card ' +
      c.cls +
      '" onclick="filterByCategory(\'' +
      c.key +
      "');goPage('store')\">" +
      '<div class="cat-vc-icon">' +
      c.icon +
      "</div>" +
      '<div class="cat-vc-name">' +
      c.label +
      "</div>" +
      '<div class="cat-vc-count">' +
      count +
      " produk</div>" +
      "</div>"
    );
  }).join("");
}

/* ── Flash Sale Countdown ── */
function startCountdown() {
  if (_countdownTimer) clearInterval(_countdownTimer);
  // End time: 6h 23m 47s from now (demo: resets on each login)
  const endTime = Date.now() + (6 * 3600 + 23 * 60 + 47) * 1000;
  function tick() {
    const diff = Math.max(0, endTime - Date.now());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const pad = (n) => String(n).padStart(2, "0");
    const elH = $id("cd-h"),
      elM = $id("cd-m"),
      elS = $id("cd-s");
    if (elH) elH.textContent = pad(h);
    if (elM) elM.textContent = pad(m);
    if (elS) elS.textContent = pad(s);
    if (diff === 0) clearInterval(_countdownTimer);
  }
  tick();
  _countdownTimer = setInterval(tick, 1000);
}

/* ── Sort Products ── */
function sortProducts(mode) {
  _sortMode = mode;
  document.querySelectorAll(".sort-chip").forEach((el) => {
    el.classList.remove("active");
  });
  const active = $id("sort-" + mode);
  if (active) active.classList.add("active");
  renderProducts();
}

/* ── Wishlist ── */
function toggleWishlist(productId) {
  if (_wishlist.has(productId)) {
    _wishlist.delete(productId);
    toast("Dihapus dari wishlist", "");
  } else {
    _wishlist.add(productId);
    toast("Ditambahkan ke wishlist ❤️", "ok");
  }
  updateWishBadge();
  renderProducts();
}

function updateWishBadge() {
  const badge = $id("wish-badge");
  if (!badge) return;
  const count = _wishlist.size;
  badge.textContent = count;
  badge.style.display = count > 0 ? "flex" : "none";
}

function openWishlist() {
  if (!_wishlist.size) {
    toast("Wishlist masih kosong", "");
    return;
  }
  const items = [..._wishlist].map((id) => {
    const p =
      S.products.find((x) => x.id === id) ||
      DUMMY_PRODUCTS.find((x) => x.id === id);
    return p ? p.name + " (Rp\u00a0" + fmt(p.price) + ")" : id;
  });
  toast("Wishlist: " + items.join(", "), "ok");
}

/* ── Product Detail Modal ── */
function openProductDetail(productId) {
  const p =
    S.products.find((x) => x.id === productId) ||
    DUMMY_PRODUCTS.find((x) => x.id === productId);
  if (!p) return;
  _detailQty = 1;
  const _stock = p.stock != null ? p.stock : 999;
  window._detailMaxStock = _stock;
  const emoji =
    smartEmoji(p.name) || ICONS[hash(p.id || p.name) % ICONS.length];
  const eb = EB[hash((p.name || "") + (p.id || "")) % EB.length];
  const rating = p.rating || RATINGS[hash(p.id || p.name) % RATINGS.length];
  const rCount = p.reviews || String(100 + (hash(p.id || p.name) % 1200));
  const loc = p.loc || LOCS[hash(p.id || p.name) % LOCS.length];
  const sold = p.sold || soldCount(p.id || p.name);
  const badge = p.badge;
  const badgeHTML = badge
    ? '<span class="detail-visual-badge prod-badge prod-badge--' +
      badge.toLowerCase() +
      '">' +
      esc(badge) +
      "</span>"
    : "";

  // Dummy reviews
  const REVIEW_DATA = [
    ["Andi S.", "Produk sesuai deskripsi, pengiriman cepat!"],
    ["Rizky P.", "Kualitas bagus, worth it banget harganya."],
    ["Siti N.", "Sudah beli 2x, selalu memuaskan ✨"],
    ["Bagas W.", "Kemasan aman, produk original."],
    ["Dinda K.", "Responsif penjualnya, fast respon!"],
  ];
  const numReviews = 3 + (hash(p.id || p.name) % 3);
  const reviewsHTML = REVIEW_DATA.slice(0, numReviews)
    .map((r, i) => {
      const stars = i < 2 ? "★★★★★" : "★★★★";
      return (
        '<div class="review-item">' +
        '<div class="review-avatar">' +
        r[0].charAt(0) +
        "</div>" +
        '<div class="review-body">' +
        '<div class="review-name">' +
        esc(r[0]) +
        ' <span class="review-stars">' +
        stars +
        "</span></div>" +
        '<div class="review-txt">' +
        esc(r[1]) +
        "</div>" +
        "</div></div>"
      );
    })
    .join("");

  const catLabel =
    (p.category || "other").charAt(0).toUpperCase() +
    (p.category || "other").slice(1);
  const desc =
    p.description ||
    "Produk berkualitas tinggi dengan performa terbaik di kelasnya.";

  const el = $id("detail-modal-inner");
  el.innerHTML =
    '<div class="detail-visual-col ' +
    eb +
    '">' +
    '<img class="detail-visual-img" src="' +
    productImage(p) +
    '" alt="' +
    esc(p.name) +
    '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
    '<div class="detail-visual-emoji" style="display:none">' + emoji + "</div>" +
    badgeHTML +
    "</div>" +
    '<div class="detail-info-col">' +
    '<div class="detail-category">' +
    esc(catLabel) +
    "</div>" +
    '<div class="detail-name">' +
    esc(p.name) +
    "</div>" +
    '<div class="detail-rating-row">' +
    '<span class="detail-stars">★★★★★</span>' +
    '<span class="detail-rating-txt">' +
    rating +
    " (" +
    rCount +
    " ulasan)</span>" +
    "</div>" +
    '<div class="detail-price-block">' +
    '<span class="detail-price">Rp\u00a0' +
    fmt(p.price) +
    "</span>" +
    "</div>" +
    '<div class="detail-desc">' +
    esc(desc) +
    "</div>" +
    '<div class="detail-meta-row">' +
    '<div class="detail-meta-item">📍 <strong>' +
    esc(loc) +
    "</strong></div>" +
    '<div class="detail-meta-item">📦 Terjual <strong>' +
    sold +
    "+</strong></div>" +
    (_stock === 0
      ? '<div class="detail-meta-item"><span class="stock-badge out-of-stock">Stok Habis</span></div>'
      : _stock < 10
        ? '<div class="detail-meta-item"><span class="stock-badge low-stock">Sisa ' +
          _stock +
          " tersisa</span></div>"
        : '<div class="detail-meta-item">🏷️ Stok <strong>' +
          _stock +
          "</strong></div>") +
    "</div>" +
    '<div class="detail-qty-row">' +
    '<span class="detail-qty-label">Jumlah:</span>' +
    '<div class="detail-qty-ctrl">' +
    '<button class="detail-qty-btn" onclick="changeDetailQty(-1)">−</button>' +
    '<span class="detail-qty-n" id="detail-qty-n">1</span>' +
    '<button class="detail-qty-btn" onclick="changeDetailQty(1)">+</button>' +
    "</div>" +
    "</div>" +
    '<div class="detail-actions">' +
    '<button class="add-cart-btn" onclick="addToCartQty(\'' +
    esc(p.id) +
    "')\">+ Keranjang</button>" +
    '<button class="buy-now-btn" onclick="addToCartQty(\'' +
    esc(p.id) +
    "');closeProductDetail();openCart()\">Beli Sekarang</button>" +
    "</div>" +
    '<div class="detail-reviews">' +
    '<div class="detail-reviews-title">Ulasan Pembeli</div>' +
    reviewsHTML +
    "</div>" +
    "</div>";

  $id("detail-scrim").classList.add("vis");
}

function closeProductDetail() {
  $id("detail-scrim").classList.remove("vis");
}

function changeDetailQty(d) {
  const maxStock =
    window._detailMaxStock != null ? window._detailMaxStock : 999;
  _detailQty = Math.max(1, Math.min(maxStock, _detailQty + d));
  const el = $id("detail-qty-n");
  if (el) el.textContent = _detailQty;
  // Disable + button if at max stock
  const btns = document.querySelectorAll(".detail-qty-btn");
  btns.forEach((btn) => {
    if (btn.textContent === "+") btn.disabled = _detailQty >= maxStock;
  });
}

function addToCartQty(productId) {
  const p =
    S.products.find((x) => x.id === productId) ||
    DUMMY_PRODUCTS.find((x) => x.id === productId);
  if (!p) return;
  const ex = S.cart.find((c) => c.product.id === productId);
  if (ex) ex.qty += _detailQty;
  else S.cart.push({ product: p, qty: _detailQty });
  updateCartBadge();
  toast(p.name + " ×" + _detailQty + " ditambahkan ke keranjang", "ok");
}

/* ── Hero Featured Products (desktop panel) ── */
function renderHeroFeatured() {
  const el = $id("sh-featured");
  if (!el) return;
  const source = S.products.length ? S.products : DUMMY_PRODUCTS;
  // Pick 3 products: prefer items with badge or image
  const withBadge = source.filter((p) => p.badge);
  const picks = [];
  if (withBadge.length >= 3) {
    picks.push(...withBadge.slice(0, 3));
  } else {
    picks.push(...withBadge);
    for (const p of source) {
      if (picks.length >= 3) break;
      if (!picks.find((x) => x.id === p.id)) picks.push(p);
    }
  }
  el.innerHTML = picks
    .slice(0, 3)
    .map((p) => {
      const emoji =
        smartEmoji(p.name) || ICONS[hash(p.id || p.name) % ICONS.length];
      return (
        '<div class="sh-feat-card" onclick="openProductDetail(\'' +
        esc(p.id) +
        "')\">" +
        (p.badge
          ? '<div class="sh-feat-badge">' + esc(p.badge) + "</div>"
          : "") +
        (p.image
          ? '<img class="sh-feat-img" src="' +
            esc(p.image) +
            '" alt="' +
            esc(p.name) +
            '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'">' +
            '<div class="sh-feat-emoji" style="display:none">' +
            emoji +
            "</div>"
          : '<div class="sh-feat-emoji">' + emoji + "</div>") +
        '<div class="sh-feat-name">' +
        esc(p.name) +
        "</div>" +
        '<div class="sh-feat-price">Rp\u00a0' +
        fmt(p.price) +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}

/* ── Dashboard Stats (Seller) ── */
function renderDashboardStats() {
  const products = S.products.length ? S.products : DUMMY_PRODUCTS;
  const totalProducts = products.length;
  const totalSold = products.reduce(
    (s, p) => s + (p.sold || soldCount(p.id || p.name)),
    0,
  );
  const revenue = products.reduce(
    (s, p) => s + p.price * (p.sold || soldCount(p.id || p.name)),
    0,
  );
  const avgRating = (
    products.reduce((s, p) => s + parseFloat(p.rating || 4.5), 0) /
    totalProducts
  ).toFixed(1);

  const el = $id("ds-products");
  if (el) el.textContent = totalProducts;
  const el2 = $id("ds-revenue");
  if (el2) el2.textContent = "$" + Math.round(revenue / 1000) + "K";
  const el3 = $id("ds-sold");
  if (el3) el3.textContent = totalSold.toLocaleString();
  const el4 = $id("ds-rating");
  if (el4) el4.textContent = avgRating + "★";
}
