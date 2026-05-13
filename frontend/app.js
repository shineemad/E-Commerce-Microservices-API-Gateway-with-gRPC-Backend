"use strict";

const BASE = window.location.origin;

const S = {
  token: sessionStorage.getItem("v_tok") || null,
  userId: sessionStorage.getItem("v_uid") || null,
  username: sessionStorage.getItem("v_user") || null,
  role: sessionStorage.getItem("v_role") || "buyer",
  products: [],
  cart: [],
};

/* ── Dummy product catalogue (shown when API has no data) ── */
const DUMMY_PRODUCTS = [
  {
    id: "dp-001",
    name: "Phone Holder Sakti",
    price: 29.9,
    description: "Adjustable aluminium phone & tablet stand",
    category: "phone",
    badge: "New",
    rating: "5.0",
    reviews: "1.2k",
    sold: 340,
    loc: "Jakarta",
  },
  {
    id: "dp-002",
    name: "Headsound Pro",
    price: 12.0,
    description: "Wireless over-ear headphone, 40h battery",
    category: "music",
    badge: "Music",
    rating: "5.0",
    reviews: "1.2k",
    sold: 870,
    loc: "Bandung",
  },
  {
    id: "dp-003",
    name: "Adudu Cleaner",
    price: 29.9,
    description: "Smart robot vacuum with auto-dock",
    category: "home",
    badge: "Other",
    rating: "4.4",
    reviews: "1k",
    sold: 520,
    loc: "Surabaya",
  },
  {
    id: "dp-004",
    name: "CCTV Maling",
    price: 50.0,
    description: "360° Pan-Tilt security camera, 4K",
    category: "home",
    badge: "Home",
    rating: "4.8",
    reviews: "120",
    sold: 210,
    loc: "Bekasi",
  },
  {
    id: "dp-005",
    name: "Stuffus Peker 32",
    price: 9.9,
    description: "32GB ultra-fast USB 3.2 flash drive",
    category: "storage",
    badge: "Other",
    rating: "5.0",
    reviews: "1.2k",
    sold: 960,
    loc: "Depok",
  },
  {
    id: "dp-006",
    name: "Stuffus R175",
    price: 34.1,
    description: "True wireless earbuds, ANC + 36h",
    category: "music",
    badge: "Music",
    rating: "4.8",
    reviews: "2.4k",
    sold: 745,
    loc: "Tangerang",
  },
  {
    id: "dp-007",
    name: "TWS Bujug",
    price: 29.9,
    description: "Open-ear sport earbuds, IP67",
    category: "music",
    badge: "Other",
    rating: "5.0",
    reviews: "1.1k",
    sold: 412,
    loc: "Semarang",
  },
  {
    id: "dp-008",
    name: "Headsound Baptis",
    price: 12.0,
    description: "Studio monitor headphone, flat response",
    category: "music",
    badge: null,
    rating: "5.0",
    reviews: "1.2k",
    sold: 633,
    loc: "Medan",
  },
  {
    id: "dp-009",
    name: "Flexi Desk Mat XL",
    price: 18.5,
    description: "900×400mm non-slip extended desk pad",
    category: "home",
    badge: "Home",
    rating: "4.7",
    reviews: "890",
    sold: 288,
    loc: "Jakarta",
  },
  {
    id: "dp-010",
    name: "Snapclick S1",
    price: 22.0,
    description: "MagSafe phone case with card wallet",
    category: "phone",
    badge: "Phone",
    rating: "4.6",
    reviews: "540",
    sold: 310,
    loc: "Bandung",
  },
  {
    id: "dp-011",
    name: "NovaDrive SSD 1TB",
    price: 64.99,
    description: "Portable NVMe SSD, read 1050 MB/s",
    category: "storage",
    badge: "Sale",
    rating: "4.9",
    reviews: "3.1k",
    sold: 1120,
    loc: "Surabaya",
  },
  {
    id: "dp-012",
    name: "GlamRing Light",
    price: 15.9,
    description: '12" ring light with tripod & phone clip',
    category: "phone",
    badge: "New",
    rating: "4.5",
    reviews: "760",
    sold: 580,
    loc: "Bekasi",
  },
];

/* Category meta */
const CATEGORIES = ["Other", "Home", "Music", "Phone", "Storage"];
const CAT_KEY = {
  all: "all",
  home: "home",
  music: "music",
  phone: "phone",
  storage: "storage",
};
const RATINGS = ["4.5", "4.8", "5.0", "4.4", "4.7", "4.9"];

/* Smart emoji lookup by keywords */
const KEYWORD_EMOJI = [
  [/(vacuum|cleaner|robot)/i, "🤖"],
  [/(headphone|headset)/i, "🎧"],
  [/(earbuds?|tws|earphone)/i, "🎧"],
  [/(speaker)/i, "🔊"],
  [/(cctv|camera|security)/i, "📷"],
  [/(phone|holder|stand|ring)/i, "📱"],
  [/(ssd|drive|flash|storage)/i, "💾"],
  [/(keyboard|keypad)/i, "⌨️"],
  [/(desk|mat|pad)/i, "🖥️"],
  [/(case|cover|wallet)/i, "📦"],
  [/(light|lamp|ring light)/i, "💡"],
  [/(watch|band)/i, "⌚"],
  [/(piano|guitar|keyboard)/i, "🎹"],
];
function smartEmoji(name) {
  for (const [re, em] of KEYWORD_EMOJI) if (re.test(name)) return em;
  return null;
}

let _activeCategory = "all";
let _searchQuery = "";
let _sortMode = "default";
let _wishlist = new Set();
let _detailQty = 1;

function filterByCategory(cat) {
  _activeCategory = cat;
  document.querySelectorAll(".cat-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.cat === cat);
  });
  // update per-category counts in sidebar
  const counts = {};
  S.products.forEach((p) => {
    counts[p.category || "other"] = (counts[p.category || "other"] || 0) + 1;
  });
  document.querySelectorAll(".cat-item[data-cat]").forEach((el) => {
    const c = el.dataset.cat;
    const span = el.querySelector(".cat-count");
    if (span && c !== "all") span.textContent = counts[c] || 0;
  });
  renderProducts();
}

function filterProducts() {
  _searchQuery = ($id("store-search")?.value ?? "").trim().toLowerCase();
  renderProducts();
}

function filterSort(type) {
  /* no-op: can extend later */ renderProducts();
}

function scrollReco(dir) {
  const el = $id("reco-scroll");
  if (el) el.scrollBy({ left: dir * 280, behavior: "smooth" });
}

function changePage(d) {
  /* pagination placeholder */
}

const ICONS = [
  "\u{1F4BB}",
  "\u{1F5B1}",
  "\u2328\uFE0F",
  "\u{1F5A5}",
  "\u{1F4F1}",
  "\u{1F3A7}",
  "\u{1F4F7}",
  "\u{1F5A8}",
  "\u231A",
  "\u{1F50B}",
  "\u{1F579}",
  "\u{1F4E1}",
  "\u{1F3AE}",
  "\u{1F58A}",
  "\u{1F4E6}",
  "\u{1F527}",
  "\u{1F392}",
  "\u{1F4DA}",
  "\u{1F3A8}",
  "\u{1F52E}",
];
const EB = ["eb-0", "eb-1", "eb-2", "eb-3", "eb-4", "eb-5"];
const LOCS = [
  "Jakarta",
  "Bandung",
  "Surabaya",
  "Bekasi",
  "Depok",
  "Tangerang",
  "Semarang",
  "Medan",
];

/* ── Init ── */
window.addEventListener("DOMContentLoaded", () => {
  selectRole(S.role, false);
  if (S.token) enterApp();
  bindEnter(["l-user", "l-pass"], doLogin);
  bindEnter(["r-user", "r-email", "r-pass"], doRegister);
});

function bindEnter(ids, fn) {
  ids.forEach((id) => {
    const el = $id(id);
    if (el)
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") fn();
      });
  });
}

/* ── Role / Tab ── */
function selectRole(role, save = true) {
  S.role = role;
  if (save) sessionStorage.setItem("v_role", role);
  $id("role-buyer").className =
    "role-btn" + (role === "buyer" ? " active-buyer" : "");
  $id("role-seller").className =
    "role-btn" + (role === "seller" ? " active-seller" : "");
  const isSeller = role === "seller";
  $id("login-title").textContent = isSeller
    ? "Dashboard Penjual"
    : "Selamat Datang!";
  $id("login-sub").textContent = isSeller
    ? "Masuk untuk mengelola toko Anda."
    : "Masuk ke akun Anda untuk mulai berbelanja.";
  $id("reg-title").textContent = isSeller
    ? "Daftar sebagai Penjual"
    : "Buat Akun Baru";
  $id("reg-sub").textContent = isSeller
    ? "Buat akun dan mulai berjualan hari ini."
    : "Bergabung dan mulai berbelanja hari ini.";
}

function switchTab(tab) {
  ["login", "register"].forEach((t) => {
    $id("tab-" + t).classList.toggle("on", t === tab);
    $id("sf-" + t).classList.toggle("on", t === tab);
  });
  clearErrs();
}
function clearErrs() {
  ["login-err", "reg-err"].forEach((id) => {
    const el = $id(id);
    el.textContent = "";
    el.classList.remove("on");
  });
}
function showErr(id, msg) {
  const el = $id(id);
  el.textContent = msg;
  el.classList.add("on");
}

/* ── API Helper ── */
async function api(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (S.token) opts.headers["Authorization"] = "Bearer " + S.token;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }
  if (!res.ok) throw new Error(data.error || data.message || "Request gagal");
  return data;
}

/* ── Auth ── */
/* ── Quick login for demo accounts ── */
async function quickLogin(username, password, role) {
  selectRole(role, true);
  switchTab("login");
  $id("l-user").value = username;
  $id("l-pass").value = password;
  await doLogin();
}

async function doLogin() {
  clearErrs();
  const username = v("l-user"),
    password = v("l-pass");
  if (!username || !password) {
    showErr("login-err", "Isi semua kolom.");
    return;
  }
  const btn = $id("login-btn");
  setLoad(btn, true);
  try {
    const d = await api("POST", "/auth/login", { username, password });
    saveAuth(d.token, d.user_id, username);
    enterApp();
    toast("Selamat datang, " + username + "!", "ok");
  } catch (e) {
    showErr("login-err", e.message);
  } finally {
    setLoad(btn, false, "Masuk");
  }
}

async function doRegister() {
  clearErrs();
  const username = v("r-user"),
    email = v("r-email"),
    password = v("r-pass");
  if (!username || !email || !password) {
    showErr("reg-err", "Isi semua kolom.");
    return;
  }
  const btn = $id("reg-btn");
  setLoad(btn, true);
  try {
    const d = await api("POST", "/auth/register", {
      username,
      password,
      email,
    });
    saveAuth(d.token, d.user_id, username);
    enterApp();
    toast("Akun berhasil dibuat. Selamat datang, " + username + "!", "ok");
  } catch (e) {
    showErr("reg-err", e.message);
  } finally {
    setLoad(btn, false, "Daftar Sekarang");
  }
}

function saveAuth(token, uid, username) {
  S.token = token;
  S.userId = uid;
  S.username = username;
  sessionStorage.setItem("v_tok", token);
  sessionStorage.setItem("v_uid", uid);
  sessionStorage.setItem("v_user", username);
  sessionStorage.setItem("v_role", S.role);
}

function logout() {
  Object.assign(S, {
    token: null,
    userId: null,
    username: null,
    cart: [],
    products: [],
  });
  sessionStorage.clear();
  S.role = "buyer";
  $id("topnav").classList.remove("vis");
  $id("bottom-nav").classList.remove("vis");
  document
    .querySelectorAll(".inner-page")
    .forEach((p) => p.classList.remove("active"));
  $id("page-auth").style.display = "";
  $id("page-auth").classList.add("active");
  updateCartBadge();
  selectRole("buyer", false);
  toast("Anda telah keluar.");
}

function enterApp() {
  $id("page-auth").style.display = "none";
  $id("page-auth").classList.remove("active");
  $id("topnav").classList.add("vis");
  $id("bottom-nav").classList.add("vis");

  const initials = (S.username || "?").charAt(0).toUpperCase();
  $id("u-avatar").textContent = initials;
  $id("u-name").textContent = S.username || "User";
  $id("bn-username").textContent = S.username
    ? S.username.substring(0, 8)
    : "Akun";

  if (S.role === "seller") {
    $id("seller-badge").style.display = "";
    $id("cart-btn-top").style.display = "none";
    const wb = $id("wish-nav-btn");
    if (wb) wb.style.display = "none";
    $id("nl-manage").style.display = "";
    $id("nl-store").style.display = "none";
    $id("bn-manage").style.display = "";
    $id("bn-cart").style.display = "none";
    $id("orders-eyebrow").textContent = "Manajemen Pesanan";
    $id("orders-title").textContent = "Semua Pesanan";
    goPage("manage");
  } else {
    $id("seller-badge").style.display = "none";
    $id("cart-btn-top").style.display = "";
    const wb = $id("wish-nav-btn");
    if (wb) wb.style.display = "";
    $id("nl-manage").style.display = "none";
    $id("nl-store").style.display = "";
    $id("bn-manage").style.display = "none";
    $id("bn-cart").style.display = "";
    $id("orders-eyebrow").textContent = "Riwayat Belanja";
    $id("orders-title").textContent = "Pesanan Saya";
    renderFlashSale();
    renderCategoryCards();
    startCountdown();
    goPage("store");
  }
}

/* ── Navigation ── */
function goPage(name) {
  document
    .querySelectorAll(".inner-page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".navlink")
    .forEach((l) => l.classList.remove("on"));
  document
    .querySelectorAll(".bnav-item")
    .forEach((l) => l.classList.remove("on"));
  $id("page-" + name)?.classList.add("active");
  const nl = $id("nl-" + name);
  if (nl) nl.classList.add("on");
  const bn = $id("bn-" + name);
  if (bn) bn.classList.add("on");
  if (name === "store" || name === "manage") loadProducts();
  if (name === "store") {
    renderFlashSale();
    renderCategoryCards();
  }
  if (name === "orders") loadOrders();
}

/* ── Products ── */
async function loadProducts() {
  const isSeller = S.role === "seller";
  const tid = isSeller ? "manage-area" : "prod-area";
  const el = $id(tid);
  if (!el) return;

  // Show dummy products immediately for great visual first impression
  if (!S.products.length) {
    S.products = DUMMY_PRODUCTS.map((p) => ({ ...p }));
    updateProductCounts();
    if (isSeller) {
      renderManageProducts();
      renderDashboardStats();
    } else renderProducts();
  } else {
    el.innerHTML = skelHTML();
  }

  try {
    const d = await api("GET", "/products");
    const apiProducts = d.products || [];
    if (apiProducts.length) {
      // Enrich API products with dummy metadata where missing
      S.products = apiProducts.map((p) => {
        const dummy = DUMMY_PRODUCTS.find(
          (dp) =>
            dp.name.toLowerCase().slice(0, 6) ===
            (p.name || "").toLowerCase().slice(0, 6),
        );
        return dummy ? { ...dummy, ...p } : p;
      });
      updateProductCounts();
      if (isSeller) {
        renderManageProducts();
        renderDashboardStats();
      } else renderProducts();
    }
    // else keep the already-rendered dummy data
  } catch (e) {
    // Dummy data is already showing — no need to show an error
    if (!S.products.length) {
      S.products = DUMMY_PRODUCTS.map((p) => ({ ...p }));
      updateProductCounts();
      if (isSeller) {
        renderManageProducts();
        renderDashboardStats();
      } else renderProducts();
    }
  }
}

function updateProductCounts() {
  const total = S.products.length;
  const sc = $id("store-count");
  if (sc) sc.textContent = "(" + total + ")";
  const mc = $id("manage-count");
  if (mc) mc.textContent = "(" + total + ")";
  const ac = $id("all-count");
  if (ac) ac.textContent = total;

  // Per-category sidebar counts
  const counts = {};
  S.products.forEach((p) => {
    const c = p.category || "other";
    counts[c] = (counts[c] || 0) + 1;
  });
  document.querySelectorAll(".cat-item[data-cat]").forEach((el) => {
    const c = el.dataset.cat;
    const span = el.querySelector(".cat-count");
    if (span && c !== "all") span.textContent = counts[c] || 0;
  });
}

/* Deterministic sold count from product id */
function soldCount(id) {
  const n = hash(id);
  const bases = [10, 50, 100, 200, 500, 1000];
  return bases[n % bases.length] + ((n >> 3) % 100);
}

function renderProducts() {
  if (!S.products.length) {
    $id("prod-area").innerHTML = emptyHTML(
      "🛍",
      "Belum ada produk.",
      "Tunggu penjual menambahkan produk.",
    );
    return;
  }

  const all = $id("all-count");
  if (all) all.textContent = S.products.length;

  let filtered = S.products;
  if (_activeCategory !== "all") {
    filtered = S.products.filter((p) => (p.category || "") === _activeCategory);
  }
  if (_searchQuery) {
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(_searchQuery) ||
        (p.description || "").toLowerCase().includes(_searchQuery),
    );
  }

  // Apply sort
  filtered = [...filtered];
  if (_sortMode === "popular")
    filtered.sort((a, b) => (b.sold || 0) - (a.sold || 0));
  else if (_sortMode === "price-asc")
    filtered.sort((a, b) => a.price - b.price);
  else if (_sortMode === "price-desc")
    filtered.sort((a, b) => b.price - a.price);
  else if (_sortMode === "rating")
    filtered.sort(
      (a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0),
    );

  if (!filtered.length) {
    $id("prod-area").innerHTML = emptyHTML(
      "🔍",
      "Tidak ditemukan.",
      "Coba kata kunci lain.",
    );
    renderReco();
    return;
  }

  $id("prod-area").innerHTML =
    '<div class="prod-grid">' +
    filtered
      .map((p, i) => {
        const emoji =
          smartEmoji(p.name) || ICONS[hash(p.id || p.name) % ICONS.length];
        const eb = EB[hash((p.name || "") + (p.id || "")) % EB.length];
        const loc = p.loc || LOCS[hash(p.id || p.name) % LOCS.length];
        const sold = p.sold || soldCount(p.id || p.name);
        const badge = p.badge;
        const rating =
          p.rating || RATINGS[hash(p.id || p.name) % RATINGS.length];
        const rCount = p.reviews || String(100 + (hash(p.id || p.name) % 1200));
        const badgeHTML = badge
          ? '<div class="prod-badge prod-badge--' +
            badge.toLowerCase().replace(/\s/g, "-") +
            '">' +
            esc(badge) +
            "</div>"
          : "";
        return (
          '<div class="prod-card" style="animation-delay:' +
          i * 45 +
          'ms">' +
          badgeHTML +
          '<div class="prod-visual ' +
          eb +
          '" onclick="openProductDetail(\'' +
          esc(p.id) +
          '\')" style="cursor:pointer">' +
          '<div class="prod-emoji">' +
          emoji +
          "</div>" +
          '<button class="wish-btn' +
          (_wishlist.has(p.id) ? " wished" : "") +
          '" onclick="event.stopPropagation();toggleWishlist(\'' +
          esc(p.id) +
          '\')" title="Tambah ke Wishlist">' +
          (_wishlist.has(p.id) ? "❤️" : "🤍") +
          "</button>" +
          "</div>" +
          '<div class="prod-info">' +
          '<div class="prod-rating">' +
          '<span class="prod-stars">★★★★★</span>' +
          '<span class="prod-rating-txt">' +
          rating +
          " (" +
          rCount +
          " Reviews)</span>" +
          "</div>" +
          '<div class="prod-name" onclick="openProductDetail(\'' +
          esc(p.id) +
          '\')" style="cursor:pointer">' +
          esc(p.name) +
          "</div>" +
          '<div class="prod-price">$' +
          fmt(p.price) +
          "</div>" +
          '<div class="prod-meta">' +
          '<span class="prod-sold">Terjual ' +
          sold +
          "+</span>" +
          '<span class="prod-loc">📍 ' +
          loc +
          "</span>" +
          "</div>" +
          '<div class="prod-card-actions">' +
          '<button class="add-cart-btn" onclick="addToCart(\'' +
          esc(p.id) +
          "')\">Add to Cart</button>" +
          '<button class="buy-now-btn"  onclick="quickBuy(\'' +
          esc(p.id) +
          "')\">Buy Now</button>" +
          "</div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("") +
    "</div>";

  renderReco();
}

function quickBuy(productId) {
  addToCart(productId);
  openCart();
}

function renderReco() {
  const el = $id("reco-scroll");
  if (!el) return;
  const source = S.products.length ? S.products : DUMMY_PRODUCTS;
  const picks = source
    .slice()
    .sort(() => 0.5 - Math.random())
    .slice(0, 8);
  el.innerHTML = picks
    .map((p) => {
      const emoji =
        smartEmoji(p.name) || ICONS[hash(p.id || p.name) % ICONS.length];
      const eb = EB[hash((p.name || "") + (p.id || "")) % EB.length];
      const rating = p.rating || RATINGS[hash(p.id || p.name) % RATINGS.length];
      const rCount = p.reviews || String(100 + (hash(p.id || p.name) % 1200));
      const badge = p.badge;
      const badgeHTML = badge
        ? '<div class="prod-badge prod-badge--' +
          badge.toLowerCase().replace(/\s/g, "-") +
          '" style="font-size:9px;padding:2px 8px">' +
          esc(badge) +
          "</div>"
        : "";
      return (
        '<div class="reco-card">' +
        '<div class="reco-visual ' +
        eb +
        '" style="position:relative">' +
        badgeHTML +
        '<div class="prod-emoji">' +
        emoji +
        "</div>" +
        "</div>" +
        '<div class="reco-info">' +
        '<div class="prod-rating">' +
        '<span class="prod-stars" style="font-size:10px">★★★★★</span>' +
        '<span class="prod-rating-txt"> ' +
        rating +
        " (" +
        rCount +
        ")</span>" +
        "</div>" +
        '<div class="prod-name">' +
        esc(p.name) +
        "</div>" +
        '<div class="prod-price">$' +
        fmt(p.price) +
        "</div>" +
        '<button class="add-cart-btn" onclick="addToCart(\'' +
        esc(p.id) +
        "')\">Add to Chart</button>" +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}

function renderManageProducts() {
  if (!S.products.length) {
    $id("manage-area").innerHTML = emptyHTML(
      "📦",
      "Belum ada produk.",
      "Tambahkan produk pertama Anda di atas.",
    );
    return;
  }
  $id("manage-area").innerHTML =
    '<div class="prod-grid">' +
    S.products
      .map((p, i) => {
        const emoji =
          smartEmoji(p.name) || ICONS[hash(p.id || p.name) % ICONS.length];
        const eb = EB[hash((p.name || "") + (p.id || "")) % EB.length];
        const sold = p.sold || soldCount(p.id || p.name);
        const badge = p.badge;
        const rating =
          p.rating || RATINGS[hash(p.id || p.name) % RATINGS.length];
        const rCount = p.reviews || String(100 + (hash(p.id || p.name) % 1200));
        const badgeHTML = badge
          ? '<div class="prod-badge prod-badge--' +
            badge.toLowerCase().replace(/\s/g, "-") +
            '">' +
            esc(badge) +
            "</div>"
          : "";
        return (
          '<div class="prod-card" style="animation-delay:' +
          i * 35 +
          'ms">' +
          badgeHTML +
          '<div class="prod-visual ' +
          eb +
          '">' +
          '<div class="prod-emoji">' +
          emoji +
          "</div>" +
          '<div class="prod-actions">' +
          '<button class="btn-icon" onclick="openEdit(\'' +
          esc(p.id) +
          '\')" title="Edit">✏️</button>' +
          '<button class="btn-icon del" onclick="doDeleteProduct(\'' +
          esc(p.id) +
          "','" +
          esc(p.name) +
          '\')" title="Hapus">🗑</button>' +
          "</div>" +
          "</div>" +
          '<div class="prod-info">' +
          '<div class="prod-rating">' +
          '<span class="prod-stars">★★★★★</span>' +
          '<span class="prod-rating-txt"> ' +
          rating +
          " (" +
          rCount +
          ")</span>" +
          "</div>" +
          '<div class="prod-name">' +
          esc(p.name) +
          "</div>" +
          '<div class="prod-price">$' +
          fmt(p.price) +
          "</div>" +
          '<div class="prod-meta"><span class="prod-sold">Terjual ' +
          sold +
          "+</span></div>" +
          '<div style="font-size:10px;color:var(--txt-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;margin-top:6px">' +
          esc(p.id) +
          "</div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("") +
    "</div>";
}

async function doAddProduct() {
  const name = v("np-name"),
    price = parseFloat(v("np-price")) || 0,
    description = v("np-desc");
  if (!name) {
    toast("Masukkan nama produk.", "err");
    return;
  }
  try {
    await api("POST", "/products", { name, price, description });
    toast('"' + name + '" berhasil ditambahkan!', "ok");
    ["np-name", "np-price", "np-desc"].forEach((x) => {
      $id(x).value = "";
    });
    await loadProducts();
  } catch (e) {
    toast(e.message, "err");
  }
}

function openEdit(productId) {
  const p = S.products.find((x) => x.id === productId);
  if (!p) return;
  $id("edit-id").value = p.id;
  $id("edit-name").value = p.name;
  $id("edit-price").value = p.price;
  $id("edit-desc").value = p.description || "";
  $id("edit-scrim").classList.add("vis");
}
function closeEdit() {
  $id("edit-scrim").classList.remove("vis");
}

async function doUpdateProduct() {
  const id = $id("edit-id").value;
  const name = v("edit-name");
  const price = parseFloat($id("edit-price").value) || 0;
  const description = v("edit-desc");
  if (!id) return;
  const btn = $id("edit-save-btn");
  setLoad(btn, true);
  try {
    await api("PUT", "/products/" + id, { name, price, description });
    toast("Produk berhasil diperbarui!", "ok");
    closeEdit();
    await loadProducts();
  } catch (e) {
    toast(e.message, "err");
  } finally {
    setLoad(btn, false, "Simpan Perubahan");
  }
}

async function doDeleteProduct(id, name) {
  if (!confirm('Hapus produk "' + name + '"?')) return;
  try {
    await api("DELETE", "/products/" + id);
    toast('"' + name + '" telah dihapus.', "err");
    await loadProducts();
  } catch (e) {
    toast(e.message, "err");
  }
}

/* ── Cart ── */
function addToCart(productId) {
  // find in S.products first, then fallback to DUMMY_PRODUCTS
  const p =
    S.products.find((x) => x.id === productId) ||
    DUMMY_PRODUCTS.find((x) => x.id === productId);
  if (!p) return;
  const ex = S.cart.find((c) => c.product.id === productId);
  if (ex) ex.qty++;
  else S.cart.push({ product: p, qty: 1 });
  updateCartBadge();
  toast(p.name + " ditambahkan ke keranjang", "ok");
}
function changeQty(idx, d) {
  S.cart[idx].qty += d;
  if (S.cart[idx].qty <= 0) S.cart.splice(idx, 1);
  updateCartBadge();
  renderCartBody();
}
function removeItem(idx) {
  S.cart.splice(idx, 1);
  updateCartBadge();
  renderCartBody();
}

function updateCartBadge() {
  const count = S.cart.reduce((s, c) => s + c.qty, 0);
  const badge = $id("cart-badge");
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle("pop", count > 0);
  }
  const bn = $id("bnav-badge");
  if (bn) {
    bn.textContent = count;
    bn.classList.toggle("vis", count > 0);
  }
  const total = $id("cart-total");
  if (total)
    total.textContent =
      "$" + fmt(S.cart.reduce((s, c) => s + c.product.price * c.qty, 0));
}

function renderCartBody() {
  const el = $id("cart-body");
  if (!S.cart.length) {
    el.innerHTML =
      '<div class="cart-empty">' +
      '<div class="cart-empty-ico">\u{1F6D2}</div>' +
      '<div class="cart-empty-txt">Keranjang masih kosong</div>' +
      "</div>";
    return;
  }
  el.innerHTML = S.cart
    .map((c, i) => {
      const icon = ICONS[hash(c.product.id) % ICONS.length];
      const eb = EB[hash(c.product.name) % EB.length];
      return (
        '<div class="cart-item">' +
        '<div class="cart-thumb ' +
        eb +
        '">' +
        icon +
        "</div>" +
        '<div class="cart-info">' +
        '<div class="cart-name">' +
        esc(c.product.name) +
        "</div>" +
        '<div class="cart-price">$' +
        fmt(c.product.price) +
        " \xd7 " +
        c.qty +
        " = $" +
        fmt(c.product.price * c.qty) +
        "</div>" +
        "</div>" +
        '<div class="qty-ctrl">' +
        '<button class="qty-btn" onclick="changeQty(' +
        i +
        ',-1)">\u2212</button>' +
        '<span class="qty-n">' +
        c.qty +
        "</span>" +
        '<button class="qty-btn" onclick="changeQty(' +
        i +
        ',1)">+</button>' +
        "</div>" +
        '<button class="rm-btn" onclick="removeItem(' +
        i +
        ')">\u2715</button>' +
        "</div>"
      );
    })
    .join("");
}

function openCart() {
  renderCartBody();
  $id("cart-scrim").classList.add("vis");
  $id("cart-drawer").classList.add("vis");
}
function closeCart() {
  $id("cart-scrim").classList.remove("vis");
  $id("cart-drawer").classList.remove("vis");
}

/* ── Checkout ── */
function openCheckout() {
  if (!S.cart.length) {
    toast("Keranjang masih kosong.", "err");
    return;
  }
  closeCart();
  const total = S.cart.reduce((s, c) => s + c.product.price * c.qty, 0);
  $id("modal-body").innerHTML =
    '<div class="order-summary">' +
    S.cart
      .map(
        (c) =>
          '<div class="os-row">' +
          "<div>" +
          '<div class="os-name">' +
          esc(c.product.name) +
          "</div>" +
          '<div class="os-meta">' +
          esc(c.product.id) +
          " \xb7 Qty: " +
          c.qty +
          "</div>" +
          "</div>" +
          '<div class="os-price">$' +
          fmt(c.product.price * c.qty) +
          "</div>" +
          "</div>",
      )
      .join("") +
    "</div>" +
    '<div class="grand-box">' +
    '<div class="grand-lbl">Total Pembayaran</div>' +
    '<div class="grand-val">$' +
    fmt(total) +
    "</div>" +
    "</div>";
  $id("modal-scrim").classList.add("vis");
}
function closeCheckout() {
  $id("modal-scrim").classList.remove("vis");
}

async function placeOrder() {
  if (!S.cart.length) return;
  const btn = $id("place-btn");
  setLoad(btn, true);
  const placed = [],
    errors = [];
  for (const c of S.cart) {
    try {
      await api("POST", "/orders", {
        user_id: S.userId,
        product_id: c.product.id,
        quantity: c.qty,
        unit_price: c.product.price,
      });
      placed.push(c);
    } catch (e) {
      errors.push(c.product.name + ": " + e.message);
    }
  }
  setLoad(btn, false, "\u2714 Buat Pesanan");
  closeCheckout();
  if (placed.length) {
    S.cart = [];
    updateCartBadge();
    toast(placed.length + " pesanan berhasil dibuat!", "ok");
    goPage("orders");
  }
  errors.forEach((e) => toast(e, "err"));
}

/* ── Orders ── */
async function loadOrders() {
  const el = $id("orders-area");
  if (!el) return;
  el.innerHTML =
    '<div class="orders-empty"><div class="oe-ttl">Memuat\u2026</div></div>';
  try {
    const d = await api(
      "GET",
      "/users/" + encodeURIComponent(S.userId) + "/orders",
    );
    const orders = d.orders || [];
    if (!orders.length) {
      el.innerHTML = emptyHTML(
        "\u{1F4CB}",
        "Belum ada pesanan.",
        S.role === "seller"
          ? "Belum ada pesanan masuk."
          : "Mulai belanja di toko kami.",
      );
      return;
    }
    const badgeCls = (s) =>
      ({
        pending: "sb-pending",
        processing: "sb-processing",
        shipped: "sb-shipped",
        delivered: "sb-delivered",
        completed: "sb-completed",
        cancelled: "sb-cancelled",
      })[s] || "sb-pending";

    el.innerHTML = orders
      .map((o) => {
        const cls = badgeCls(o.status);
        const ctrl =
          S.role === "seller"
            ? '<select class="status-select" onchange="doUpdateStatus(\'' +
              esc(o.id) +
              "',this.value)\">" +
              ["pending", "processing", "shipped", "delivered", "cancelled"]
                .map(
                  (s) =>
                    '<option value="' +
                    s +
                    '"' +
                    (o.status === s ? " selected" : "") +
                    ">" +
                    s +
                    "</option>",
                )
                .join("") +
              "</select>"
            : '<span class="status-badge ' +
              cls +
              '">' +
              esc(o.status || "pending") +
              "</span>";

        return (
          '<div class="order-card">' +
          '<div class="order-card-hdr">' +
          "<div>" +
          '<div class="order-lbl">ID Pesanan</div>' +
          '<div class="order-id-val">' +
          esc(o.id) +
          "</div>" +
          "</div>" +
          ctrl +
          "</div>" +
          '<div class="order-card-body">' +
          '<div class="order-data-grid">' +
          '<div><div class="odg-lbl">Product ID</div><div class="odg-val">' +
          esc(o.product_id) +
          "</div></div>" +
          '<div><div class="odg-lbl">Jumlah</div><div class="odg-val">' +
          o.quantity +
          " pcs</div></div>" +
          '<div><div class="odg-lbl">User ID</div><div class="odg-val">' +
          esc(o.user_id) +
          "</div></div>" +
          '<div><div class="odg-lbl">Status</div><div><span class="status-badge ' +
          cls +
          '">' +
          esc(o.status || "pending") +
          "</span></div></div>" +
          "</div>" +
          (S.role !== "seller"
            ? orderTimelineHTML(o.status || "pending")
            : "") +
          '<div class="order-total-row">' +
          '<div class="ot-lbl">Total Pesanan</div>' +
          '<div class="ot-val">$' +
          fmt(o.total_price) +
          "</div>" +
          "</div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  } catch (e) {
    el.innerHTML = emptyHTML(
      "\u26A0\uFE0F",
      "Gagal memuat pesanan.",
      esc(e.message),
    );
  }
}

async function doUpdateStatus(orderId, newStatus) {
  try {
    await api("PATCH", "/orders/" + orderId + "/status", { status: newStatus });
    toast("Status diperbarui: " + newStatus, "ok");
  } catch (e) {
    toast(e.message, "err");
    loadOrders();
  }
}

/* ── Utilities ── */
const $id = (x) => document.getElementById(x);
const v = (x) => ($id(x)?.value ?? "").trim();
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const fmt = (n) =>
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++)
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function setLoad(btn, loading, label) {
  btn.disabled = loading;
  btn.innerHTML = loading ? '<span class="spinner"></span>' : label;
}

function toast(msg, type) {
  const el = document.createElement("div");
  el.className =
    "toast" + (type === "err" ? " err" : type === "ok" ? " ok" : "");
  el.innerHTML =
    '<span class="toast-ico">' +
    (type === "err" ? "\u2715" : "\u2713") +
    "</span><span>" +
    esc(msg) +
    "</span>";
  $id("toasts").appendChild(el);
  setTimeout(() => {
    el.style.cssText =
      "opacity:0;transform:translateY(8px);transition:.22s ease";
    setTimeout(() => el.remove(), 240);
  }, 3200);
}

function skelHTML() {
  return (
    '<div class="skel-grid">' +
    Array(6)
      .fill(0)
      .map(
        () =>
          '<div class="skel-card">' +
          '<div class="skel-img"></div>' +
          '<div class="skel-body">' +
          '<div class="skel-line w70"></div>' +
          '<div class="skel-line"></div>' +
          '<div class="skel-line w50"></div>' +
          "</div>" +
          "</div>",
      )
      .join("") +
    "</div>"
  );
}

function errHTML(msg) {
  return emptyHTML(
    "\u26A0\uFE0F",
    "Gagal memuat produk.",
    msg +
      '<br><span style="font-size:11px;color:var(--txt-3)">Pastikan semua service berjalan.</span>',
  );
}

function emptyHTML(ico, title, sub) {
  return (
    '<div class="orders-empty">' +
    '<div class="oe-ico">' +
    ico +
    "</div>" +
    '<div class="oe-ttl">' +
    title +
    "</div>" +
    '<div class="oe-sub">' +
    sub +
    "</div>" +
    "</div>"
  );
}

/* ══════════════════════════════════════════
   SHOPGO ENHANCED — New Features
══════════════════════════════════════════ */

/* ── Flash Sale Data ── */
const FLASH_PRODUCTS = [
  { id: "dp-011", disc: 30 },
  { id: "dp-004", disc: 25 },
  { id: "dp-006", disc: 20 },
  { id: "dp-001", disc: 15 },
  { id: "dp-009", disc: 18 },
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
      emoji +
      "</div>" +
      '<div class="flash-card-name">' +
      esc(p.name) +
      "</div>" +
      '<div class="flash-card-prices">' +
      '<span class="flash-price-original">$' +
      fmt(origPrice) +
      "</span>" +
      '<span class="flash-price-disc">$' +
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
  { key: "all", label: "All Products", icon: "🛍️", cls: "cat-vc-all" },
  { key: "home", label: "For Home", icon: "🏠", cls: "cat-vc-home" },
  { key: "music", label: "For Music", icon: "🎧", cls: "cat-vc-music" },
  { key: "phone", label: "For Phone", icon: "📱", cls: "cat-vc-phone" },
  { key: "storage", label: "For Storage", icon: "💾", cls: "cat-vc-storage" },
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
let _countdownTimer = null;
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
    return p ? p.name + " ($" + fmt(p.price) + ")" : id;
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
    '<div class="detail-visual-emoji">' +
    emoji +
    "</div>" +
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
    '<span class="detail-price">$' +
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
  _detailQty = Math.max(1, _detailQty + d);
  const el = $id("detail-qty-n");
  if (el) el.textContent = _detailQty;
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

/* ── Enhanced Orders Rendering with Status Timeline ── */
const ORDER_STEPS = [
  { key: "pending", label: "Menunggu" },
  { key: "processing", label: "Diproses" },
  { key: "shipped", label: "Dikirim" },
  { key: "delivered", label: "Diterima" },
  { key: "completed", label: "Selesai" },
];

function orderTimelineHTML(status) {
  const currentIdx = ORDER_STEPS.findIndex((s) => s.key === status);
  if (currentIdx < 0 || status === "cancelled") {
    return '<div style="font-size:12px;color:var(--accent-red);font-weight:600;padding:8px 0">⚠️ Pesanan dibatalkan</div>';
  }
  return (
    '<div class="order-status-timeline">' +
    ORDER_STEPS.map((step, i) => {
      const done = i < currentIdx;
      const current = i === currentIdx;
      const cls = done
        ? "ost-step done"
        : current
          ? "ost-step current"
          : "ost-step";
      const icon = done ? "✓" : i + 1;
      return (
        '<div class="' +
        cls +
        '">' +
        '<div class="ost-dot">' +
        icon +
        "</div>" +
        '<div class="ost-lbl">' +
        step.label +
        "</div>" +
        "</div>"
      );
    }).join("") +
    "</div>"
  );
}
