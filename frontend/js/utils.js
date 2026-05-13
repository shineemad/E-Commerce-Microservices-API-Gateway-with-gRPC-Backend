/* ══════════════════════════════════════════
   UTILS.JS — Utility functions & API helper
══════════════════════════════════════════ */

function smartEmoji(name) {
  for (const [re, em] of KEYWORD_EMOJI) if (re.test(name)) return em;
  return null;
}

/* ── API Helper ── */
async function api(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (S.token) opts.headers["Authorization"] = "Bearer " + S.token;
  if (body !== undefined) opts.body = JSON.stringify(body);
  let res;
  try {
    res = await fetch(BASE + path, opts);
  } catch (networkErr) {
    // Re-throw as a plain Error so callers can inspect e.message
    throw new Error("Failed to fetch");
  }
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
  Number(n || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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
