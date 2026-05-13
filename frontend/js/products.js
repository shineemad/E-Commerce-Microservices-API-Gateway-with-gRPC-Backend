/* ══════════════════════════════════════════
   PRODUCTS.JS — Product loading, rendering & filtering
══════════════════════════════════════════ */

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
          (p.image
            ? '<img class="prod-img" src="' +
              esc(p.image) +
              '" alt="' +
              esc(p.name) +
              '" loading="lazy" onerror="this.style.display=\'none\'">' +
              '<div class="prod-emoji" style="display:none">' +
              emoji +
              "</div>"
            : '<div class="prod-emoji">' + emoji + "</div>") +
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
          " ulasan)</span>" +
          "</div>" +
          '<div class="prod-name" onclick="openProductDetail(\'' +
          esc(p.id) +
          '\')" style="cursor:pointer">' +
          esc(p.name) +
          "</div>" +
          '<div class="prod-price">Rp\u00a0' +
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
          "')\">+ Keranjang</button>" +
          '<button class="buy-now-btn"  onclick="quickBuy(\'' +
          esc(p.id) +
          "')\">Beli Sekarang</button>" +
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
        '<div class="prod-price">Rp\u00a0' +
        fmt(p.price) +
        "</div>" +
        '<button class="add-cart-btn" onclick="addToCart(\'' +
        esc(p.id) +
        "')\">+ Keranjang</button>" +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}
