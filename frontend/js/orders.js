/* ══════════════════════════════════════════
   ORDERS.JS — Order loading, status updates & timeline
══════════════════════════════════════════ */

// Simpan review lokal (session) — key: orderId
const _reviews = {};

// State modal review yang sedang aktif
let _reviewState = {
  orderId: null,
  productId: null,
  productName: null,
  rating: 0,
};

// Ambil nama produk dari product_id, cari di S.products dulu lalu fallback ke DUMMY_PRODUCTS
function _resolveProductName(productId) {
  const p =
    (S.products || []).find((x) => x.id === productId) ||
    DUMMY_PRODUCTS.find((x) => x.id === productId);
  return p ? p.name : productId;
}

// Ambil username dari user_id — backend format: "user-{username}"
function _resolveUsername(userId) {
  if (!userId) return "-";
  return userId.startsWith("user-") ? userId.slice(5) : userId;
}

async function loadOrders() {
  const el = $id("orders-area");
  if (!el) return;
  el.innerHTML =
    '<div class="orders-empty"><div class="oe-ttl">Memuat\u2026</div></div>';
  try {
    // Seller melihat semua pesanan via GET /orders
    // Buyer melihat pesanan milik sendiri via GET /users/{id}/orders
    const endpoint =
      S.role === "seller"
        ? "/orders"
        : "/users/" + encodeURIComponent(S.userId) + "/orders";

    const d = await api("GET", endpoint);
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

    // Label status dalam Bahasa Indonesia untuk dropdown seller
    const STATUS_OPTS = [
      { v: "pending", l: "Menunggu" },
      { v: "processing", l: "Diproses" },
      { v: "shipped", l: "Dikirim" },
      { v: "delivered", l: "Diterima" },
      { v: "cancelled", l: "Dibatalkan" },
    ];

    el.innerHTML = orders
      .map((o) => {
        const cls = badgeCls(o.status);
        const productName = _resolveProductName(o.product_id);
        const unitPrice = o.quantity > 0 ? o.total_price / o.quantity : 0;

        // Header kanan: seller = dropdown ganti status, buyer = badge status
        const headerRight =
          S.role === "seller"
            ? '<select class="status-select" onchange="doUpdateStatus(\'' +
              esc(o.id) +
              "',this.value)\">" +
              STATUS_OPTS.map(
                (s) =>
                  '<option value="' +
                  s.v +
                  '"' +
                  (o.status === s.v ? " selected" : "") +
                  ">" +
                  s.l +
                  "</option>",
              ).join("") +
              "</select>"
            : '<span class="status-badge ' +
              cls +
              '">' +
              esc((o.status || "pending").toUpperCase()) +
              "</span>";

        // Grid info: kolom berbeda untuk seller vs buyer
        const gridRows =
          S.role === "seller"
            ? '<div><div class="odg-lbl">Produk</div><div class="odg-val">' +
              esc(productName) +
              "</div></div>" +
              '<div><div class="odg-lbl">Pembeli</div><div class="odg-val">' +
              esc(_resolveUsername(o.user_id)) +
              "</div></div>" +
              '<div><div class="odg-lbl">Jumlah</div><div class="odg-val">' +
              o.quantity +
              " pcs</div></div>" +
              '<div><div class="odg-lbl">Status</div><div><span class="status-badge ' +
              cls +
              '">' +
              esc((o.status || "pending").toUpperCase()) +
              "</span></div></div>"
            : '<div><div class="odg-lbl">Produk</div><div class="odg-val">' +
              esc(productName) +
              "</div></div>" +
              '<div><div class="odg-lbl">Jumlah</div><div class="odg-val">' +
              o.quantity +
              " pcs</div></div>" +
              '<div><div class="odg-lbl">Harga Satuan</div><div class="odg-val">Rp\u00a0' +
              fmt(unitPrice) +
              "</div></div>" +
              '<div><div class="odg-lbl">Status</div><div><span class="status-badge ' +
              cls +
              '">' +
              esc((o.status || "pending").toUpperCase()) +
              "</span></div></div>";

        return (
          '<div class="order-card">' +
          '<div class="order-card-hdr">' +
          "<div>" +
          '<div class="order-lbl">ID Pesanan</div>' +
          '<div class="order-id-val">' +
          esc(o.id) +
          "</div>" +
          "</div>" +
          headerRight +
          "</div>" +
          '<div class="order-card-body">' +
          '<div class="order-data-grid">' +
          gridRows +
          "</div>" +
          (S.role !== "seller"
            ? orderTimelineHTML(o.status || "pending")
            : "") +
          // Tombol konfirmasi diterima — hanya muncul saat status=delivered dan belum direview
          (S.role !== "seller" && o.status === "delivered" && !_reviews[o.id]
            ? '<div class="order-confirm-row">' +
              '<button class="btn btn-primary btn-confirm-order" onclick="openReview(\'' +
              esc(o.id) +
              "','" +
              esc(o.product_id) +
              "','" +
              esc(productName) +
              "')\">&#x2714; Konfirmasi Pesanan Diterima</button>" +
              "</div>"
            : "") +
          // Tampilkan review yang sudah dikirim
          (S.role !== "seller" && _reviews[o.id]
            ? '<div class="order-review-done">' +
              '<div class="ord-stars">' +
              "★".repeat(_reviews[o.id].rating) +
              "☆".repeat(5 - _reviews[o.id].rating) +
              "</div>" +
              '<div class="ord-review-txt">' +
              esc(_reviews[o.id].comment) +
              "</div>" +
              "</div>"
            : "") +
          '<div class="order-total-row">' +
          '<div class="ot-lbl">Total Pesanan</div>' +
          '<div class="ot-val">Rp\u00a0' +
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
  const STATUS_LABEL = {
    pending: "Menunggu",
    processing: "Diproses",
    shipped: "Dikirim",
    delivered: "Diterima",
    cancelled: "Dibatalkan",
  };
  try {
    await api("PATCH", "/orders/" + orderId + "/status", { status: newStatus });
    toast("Status diperbarui: " + (STATUS_LABEL[newStatus] || newStatus), "ok");
  } catch (e) {
    toast(e.message, "err");
    loadOrders();
  }
}

// ── Review functions ──────────────────────────────────────────────

function openReview(orderId, productId, productName) {
  _reviewState = { orderId, productId, productName, rating: 0 };

  const icons = ICONS || ["📦"];
  const icon = icons[hash(productId) % icons.length];

  $id("review-body").innerHTML =
    '<div class="review-product-banner">' +
    '<div class="rpb-icon">' +
    icon +
    "</div>" +
    '<div class="rpb-info">' +
    '<div class="rpb-name">' +
    esc(productName) +
    "</div>" +
    '<div class="rpb-meta">Pesanan dikonfirmasi diterima</div>' +
    "</div></div>" +
    '<div class="review-section-lbl">Penilaian Toko</div>' +
    '<div class="star-row" id="star-row">' +
    [1, 2, 3, 4, 5]
      .map(
        (n) =>
          '<button class="star-btn" data-val="' +
          n +
          '" onclick="setReviewStar(' +
          n +
          ')">&#9733;</button>',
      )
      .join("") +
    "</div>" +
    '<div class="review-section-lbl">Ulasan Produk</div>' +
    '<textarea class="review-textarea" id="review-comment" maxlength="300" ' +
    'placeholder="Bagaimana pengalaman belanja kamu?" ' +
    "oninput=\"$id('review-char').textContent=this.value.length+'/300'\"></textarea>" +
    '<div class="review-char-count"><span id="review-char">0</span>/300</div>';

  $id("review-scrim").classList.add("vis");
}

function setReviewStar(val) {
  _reviewState.rating = val;
  const btns = $id("star-row").querySelectorAll(".star-btn");
  btns.forEach((b) => {
    const n = Number(b.dataset.val);
    b.classList.toggle("active", n <= val);
  });
}

async function submitReview() {
  const { orderId, productId, productName, rating } = _reviewState;
  if (!rating) {
    toast("Pilih bintang dulu ya 😊", "err");
    return;
  }
  const comment = ($id("review-comment")?.value || "").trim();
  const btn = $id("review-submit-btn");
  setLoad(btn, true);

  try {
    // Konfirmasi status ke completed via gRPC gateway
    await api("PATCH", "/orders/" + orderId + "/status", {
      status: "completed",
    });
  } catch (_) {
    // Jika backend offline, tetap simpan review secara lokal
  }

  // Simpan review lokal
  _reviews[orderId] = { rating, comment, productId, productName };

  setLoad(btn, false, "✔ Kirim Ulasan");
  closeReview();
  toast("Terima kasih! Ulasan berhasil dikirim ⭐", "ok");
  // Reload agar status kartu berubah ke completed
  loadOrders();
}

function closeReview() {
  $id("review-scrim").classList.remove("vis");
  _reviewState = {
    orderId: null,
    productId: null,
    productName: null,
    rating: 0,
  };
}

// ── Order steps ───────────────────────────────────────────────────

const ORDER_STEPS = [
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
