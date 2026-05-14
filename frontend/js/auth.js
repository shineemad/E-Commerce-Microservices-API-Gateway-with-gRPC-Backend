/* ══════════════════════════════════════════
   AUTH.JS — Authentication, roles & navigation
══════════════════════════════════════════ */

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
    if (_isNetworkError(e)) {
      showErr(
        "login-err",
        "Server tidak tersedia. Pastikan semua service berjalan.",
      );
    } else {
      showErr("login-err", e.message);
    }
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
    if (_isNetworkError(e)) {
      showErr(
        "reg-err",
        "Server tidak tersedia. Pastikan semua service berjalan.",
      );
    } else {
      showErr("reg-err", e.message);
    }
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
  document.body.classList.remove("app-ready", "buyer-mode");
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
  document.body.classList.add("app-ready");
  $id("topnav").classList.add("vis");
  // Bottom nav hanya untuk penjual (buyer pakai top navbar)
  $id("bottom-nav").classList.remove("vis");

  const initials = (S.username || "?").charAt(0).toUpperCase();
  $id("u-avatar").textContent = initials;
  $id("u-name").textContent = S.username || "User";
  $id("bn-username").textContent = S.username
    ? S.username.substring(0, 8)
    : "Akun";

  if (S.role === "seller") {
    document.body.classList.remove("buyer-mode");
    $id("seller-badge").style.display = "";
    $id("cart-btn-top").style.display = "none";
    const wb = $id("wish-nav-btn");
    if (wb) wb.style.display = "none";
    $id("nl-manage").style.display = "";
    $id("nl-store").style.display = "none";
    $id("bn-manage").style.display = "";
    $id("bn-cart").style.display = "none";
    $id("bottom-nav").classList.add("vis");
    $id("orders-eyebrow").textContent = "Manajemen Pesanan";
    $id("orders-title").textContent = "Semua Pesanan";
    goPage("manage");
  } else {
    document.body.classList.add("buyer-mode");
    $id("bottom-nav").classList.add("vis"); // CSS controls visibility by screen size
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
    renderHeroBg();
    renderFlashSale();
    renderCategoryCards();
    startCountdown();
    renderHeroFeatured();
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
    renderHeroBg();
    renderFlashSale();
    renderCategoryCards();
    renderHeroFeatured();
  }
  if (name === "orders") loadOrders();
}

/* ── Products ── */
