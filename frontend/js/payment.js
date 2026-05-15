/* ══════════════════════════════════════════
   PAYMENT.JS — Payment session flow
══════════════════════════════════════════ */

"use strict";

let _paySession = null;
let _payCountdownTimer = null;
let _selectedPayMethod = "qris";

/* ── Payment method catalogue ── */
const PAYMENT_METHODS = [
  { id: "qris", label: "QRIS", icon: "⊞", color: "#E4002B" },
  { id: "shopeepay", label: "ShopeePay", icon: "🛍️", color: "#EE4D2D" },
  { id: "gopay", label: "GoPay", icon: "💚", color: "#00AA13" },
  { id: "ovo", label: "OVO", icon: "💜", color: "#4C3494" },
  { id: "dana", label: "DANA", icon: "💙", color: "#118EEA" },
  { id: "bca", label: "BCA", icon: "🏦", color: "#0066AE" },
  { id: "mandiri", label: "Mandiri", icon: "🏦", color: "#003D79" },
  { id: "bni", label: "BNI", icon: "🏦", color: "#E65F00" },
  { id: "topup", label: "Saldo", icon: "💰", color: "#7C3AED" },
];

function renderPaymentMethodSelector() {
  return (
    '<div class="pay-method-section">' +
    '<div class="pay-method-title">Metode Pembayaran</div>' +
    '<div class="pay-method-grid">' +
    PAYMENT_METHODS.map(
      (m) =>
        '<button class="pay-method-btn' +
        (_selectedPayMethod === m.id ? " active" : "") +
        '" onclick="selectPayMethod(\'' +
        m.id +
        '\')" data-method="' +
        m.id +
        '">' +
        '<span class="pay-method-icon">' +
        m.icon +
        "</span>" +
        '<span class="pay-method-name">' +
        m.label +
        "</span>" +
        "</button>",
    ).join("") +
    "</div></div>"
  );
}

function selectPayMethod(methodId) {
  _selectedPayMethod = methodId;
  document.querySelectorAll(".pay-method-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.method === methodId);
  });
}

/* ── Initiate payment from checkout modal ── */
async function initiatePayment() {
  if (!S.cart.length) {
    toast("Keranjang masih kosong.", "err");
    return;
  }
  const btn = $id("place-btn");
  if (btn) setLoad(btn, true);

  const total = S.cart.reduce((s, c) => s + c.product.price * c.qty, 0);
  const cartItems = S.cart.map((c) => ({
    product_id: c.product.id,
    quantity: c.qty,
    unit_price: c.product.price,
    name: c.product.name,
  }));

  try {
    const resp = await api("POST", "/payments/initiate", {
      method: _selectedPayMethod,
      amount: total,
      cart_items: cartItems,
      user_id: S.userId,
    });
    _paySession = resp;
    closeCheckout();
    openPaymentModal();
  } catch (e) {
    toast(e.message, "err");
  } finally {
    if (btn) setLoad(btn, false, "💳 Bayar Sekarang");
  }
}

/* ── Payment modal open / close ── */
function openPaymentModal() {
  if (!_paySession) return;
  const m = PAYMENT_METHODS.find((x) => x.id === _paySession.method) || {};
  const title = $id("pay-modal-title");
  if (title)
    title.textContent = "Pembayaran via " + (m.label || _paySession.method);
  renderPaymentDetails();
  $id("pay-scrim").classList.add("vis");
  startPayCountdown();
}

function closePayment() {
  $id("pay-scrim").classList.remove("vis");
  if (_payCountdownTimer) clearInterval(_payCountdownTimer);
}

/* ── Render payment details based on method ── */
function renderPaymentDetails() {
  const sess = _paySession;
  if (!sess) return;
  const amount = sess.amount;

  let html =
    '<div class="pay-amount-box">' +
    '<div class="pay-amount-lbl">Total Pembayaran</div>' +
    '<div class="pay-amount-val">Rp\u00a0' +
    fmt(amount) +
    "</div></div>" +
    '<div class="pay-countdown-row">' +
    "<span>Selesaikan dalam:</span>" +
    '<span class="pay-countdown" id="pay-countdown">05:00</span>' +
    "</div>";

  switch (sess.method) {
    case "qris":
      html +=
        '<div class="pay-qris-box">' +
        '<div class="pay-qris-label">📱 Scan QR Code</div>' +
        (sess.qr_code
          ? '<img class="pay-qris-img" src="' +
            esc(sess.qr_code) +
            '" alt="QRIS" loading="lazy"/>'
          : '<div class="pay-qris-img" style="display:flex;align-items:center;justify-content:center;font-size:32px">⊞</div>') +
        '<div class="pay-qris-note">Scan dengan aplikasi e-wallet atau mobile banking apapun yang mendukung QRIS</div>' +
        "</div>";
      break;

    case "bca":
    case "mandiri":
    case "bni":
      html +=
        '<div class="pay-va-box">' +
        '<div class="pay-va-bank">' +
        esc(sess.bank_name || "") +
        "</div>" +
        '<div class="pay-va-label">Nomor Virtual Account</div>' +
        '<div class="pay-va-number" id="pay-va-number">' +
        esc(sess.va_number || "") +
        "</div>" +
        '<button class="btn btn-outline btn-sm" onclick="copyVA()">📋 Salin Nomor VA</button>' +
        '<div class="pay-va-steps">' +
        '<div class="pay-va-step">1. Buka aplikasi mobile banking atau ATM</div>' +
        '<div class="pay-va-step">2. Pilih Transfer &rarr; Virtual Account</div>' +
        '<div class="pay-va-step">3. Masukkan nomor VA di atas</div>' +
        '<div class="pay-va-step">4. Konfirmasi jumlah <strong>Rp\u00a0' +
        fmt(amount) +
        "</strong></div>" +
        "</div></div>";
      break;

    case "shopeepay":
    case "gopay":
    case "ovo":
    case "dana": {
      const eWalletInfo = {
        shopeepay: { color: "#EE4D2D", app: "Shopee", logo: "🛍️" },
        gopay: { color: "#00AA13", app: "Gojek", logo: "💚" },
        ovo: { color: "#4C3494", app: "OVO", logo: "💜" },
        dana: { color: "#118EEA", app: "DANA", logo: "💙" },
      };
      const info = eWalletInfo[sess.method] || {};
      html +=
        '<div class="pay-ewallet-box">' +
        '<div class="pay-ewallet-logo" style="background:' +
        info.color +
        '">' +
        info.logo +
        " " +
        info.app +
        "</div>" +
        '<div class="pay-ewallet-steps">' +
        '<div class="pay-ewallet-step">1. Buka aplikasi <strong>' +
        info.app +
        "</strong> di ponsel Anda</div>" +
        '<div class="pay-ewallet-step">2. Pilih menu <strong>Bayar</strong></div>' +
        '<div class="pay-ewallet-step">3. Nomor terdaftar: <strong>' +
        esc(sess.phone_hint || "+62 8xx-xxxx-xxxx") +
        "</strong></div>" +
        '<div class="pay-ewallet-step">4. Konfirmasi <strong>Rp\u00a0' +
        fmt(amount) +
        "</strong></div>" +
        "</div></div>";
      break;
    }

    case "topup":
    default:
      html +=
        '<div class="pay-topup-box">' +
        '<div class="pay-topup-icon">💰</div>' +
        '<div class="pay-topup-text">Saldo ShopGo Anda akan dikurangi sebesar</div>' +
        '<div class="pay-topup-amount">Rp\u00a0' +
        fmt(amount) +
        "</div>" +
        '<div style="font-size:12px;color:var(--txt-3)">Klik tombol di bawah untuk konfirmasi</div>' +
        "</div>";
  }

  $id("pay-modal-body").innerHTML = html;
}

function copyVA() {
  const el = $id("pay-va-number");
  if (!el) return;
  navigator.clipboard
    .writeText(el.textContent.trim())
    .then(() => toast("Nomor VA disalin!", "ok"))
    .catch(() => toast("Gagal menyalin.", "err"));
}

/* ── Countdown timer ── */
function startPayCountdown() {
  if (_payCountdownTimer) clearInterval(_payCountdownTimer);
  const expiry = new Date(_paySession.expires_at).getTime();

  function tick() {
    const diff = Math.max(0, expiry - Date.now());
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const el = $id("pay-countdown");
    if (el)
      el.textContent =
        String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
    if (diff === 0) {
      clearInterval(_payCountdownTimer);
      closePayment();
      toast("Waktu pembayaran habis. Silakan coba lagi.", "err");
    }
  }

  tick();
  _payCountdownTimer = setInterval(tick, 1000);
}

/* ── Confirm payment ── */
async function confirmPayment() {
  if (!_paySession) return;
  const btn = $id("pay-confirm-btn");
  if (btn) setLoad(btn, true);

  try {
    await api("POST", "/payments/" + _paySession.id + "/confirm", {});
    if (_payCountdownTimer) clearInterval(_payCountdownTimer);
    closePayment();
    S.cart = [];
    updateCartBadge();
    toast("🎉 Pembayaran berhasil! Pesanan sedang diproses.", "ok");
    goPage("orders");
    setTimeout(loadOrders, 600);
  } catch (e) {
    toast(e.message, "err");
  } finally {
    if (btn) setLoad(btn, false, "✔ Konfirmasi Sudah Bayar");
  }
}
