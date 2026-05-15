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
  $id("modal-scrim").classList.add("vis");
}
function closeCheckout() {
  clearTimeout(_checkoutSuccessTimer);
  $id("modal-scrim").classList.remove("vis");
  // Reset modal box ke struktur awal agar bisa dibuka lagi
  const box = $id("modal-scrim")?.querySelector(".modal-box");
  if (box && box.querySelector(".checkout-success")) {
    box.innerHTML =
      '<div class="modal-hdr">' +
      '<div class="modal-ttl">Konfirmasi Pesanan</div>' +
      '<button class="close-btn" onclick="closeCheckout()">&#x2715;</button>' +
      '</div>' +
      '<div class="modal-body" id="modal-body"></div>' +
      '<div class="modal-foot">' +
      '<button class="btn btn-outline" style="flex:1" onclick="closeCheckout()">Batal</button>' +
      '<button class="btn btn-primary" style="flex:2" id="place-btn" onclick="placeOrder()">&#x2714; Buat Pesanan</button>' +
      '</div>';
  }
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

  if (placed.length) {
    S.cart = [];
    updateCartBadge();
    // Tampilkan success state di dalam modal — tidak redirect paksa ke halaman lain
    _showCheckoutSuccess(placed.length);
  } else {
    closeCheckout();
  }
  errors.forEach((e) => toast(e, "err"));
}

function _showCheckoutSuccess(count) {
  const box = $id("modal-scrim").querySelector(".modal-box");
  if (!box) { closeCheckout(); return; }
  box.innerHTML =
    '<div class="checkout-success">' +
    '<div class="cs-check">&#x2714;</div>' +
    '<div class="cs-title">Pesanan Berhasil!</div>' +
    '<div class="cs-sub">' + count + ' produk telah dipesan dan menunggu konfirmasi toko.</div>' +
    '<div class="cs-actions">' +
    '<button class="btn btn-outline cs-stay-btn" onclick="closeCheckout()">Lanjut Belanja</button>' +
    '<button class="btn btn-primary cs-view-btn" onclick="closeCheckout();goPage(\'orders\')">Lihat Pesanan &rarr;</button>' +
    '</div>' +
    '</div>';
  // Auto-tutup setelah 3.5 detik jika user tidak klik
  clearTimeout(_checkoutSuccessTimer);
  _checkoutSuccessTimer = setTimeout(closeCheckout, 3500);
}

let _checkoutSuccessTimer = null;

