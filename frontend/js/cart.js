/* ══════════════════════════════════════════
   CART.JS — Cart, checkout & order placement
══════════════════════════════════════════ */

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
      "Rp\u00a0" + fmt(S.cart.reduce((s, c) => s + c.product.price * c.qty, 0));
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
        (c.product.image
          ? '<img src="' +
            esc(c.product.image) +
            '" alt="' +
            esc(c.product.name) +
            '" style="width:100%;height:100%;object-fit:contain;padding:4px" onerror="this.style.display=\'none\'">'
          : icon) +
        "</div>" +
        '<div class="cart-info">' +
        '<div class="cart-name">' +
        esc(c.product.name) +
        "</div>" +
        '<div class="cart-price">Rp\u00a0' +
        fmt(c.product.price) +
        " \xd7 " +
        c.qty +
        " = Rp\u00a0" +
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

  // Order summary HTML
  const summaryHTML =
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
          '<div class="os-price">Rp\u00a0' +
          fmt(c.product.price * c.qty) +
          "</div>" +
          "</div>",
      )
      .join("") +
    "</div>" +
    '<div class="grand-box">' +
    '<div class="grand-lbl">Total Pembayaran</div>' +
    '<div class="grand-val">Rp\u00a0' +
    fmt(total) +
    "</div>" +
    "</div>";

  // Payment method selector (defined in payment.js, loaded after cart.js)
  const payMethodHTML =
    typeof renderPaymentMethodSelector === "function"
      ? renderPaymentMethodSelector()
      : "";

  $id("modal-body").innerHTML = summaryHTML + payMethodHTML;
  $id("modal-scrim").classList.add("vis");
}
function closeCheckout() {
  $id("modal-scrim").classList.remove("vis");
}

// placeOrder is kept for backward compat with tests; UI uses initiatePayment() from payment.js.
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
