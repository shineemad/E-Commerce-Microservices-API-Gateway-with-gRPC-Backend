/* ══════════════════════════════════════════
   MANAGE.JS — Seller product management (CRUD)
══════════════════════════════════════════ */

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
        const stock = p.stock != null ? p.stock : null;
        const totalStock = p.total_stock || 0;
        const stockPct =
          totalStock > 0 ? Math.round((stock / totalStock) * 100) : 0;
        const stockColor =
          stockPct > 50 ? "green" : stockPct > 20 ? "yellow" : "red";
        const badgeHTML = badge
          ? '<div class="prod-badge prod-badge--' +
            badge.toLowerCase().replace(/\s/g, "-") +
            '">' +
            esc(badge) +
            "</div>"
          : "";
        const stockBarHTML =
          stock != null
            ? '<div class="stock-bar-wrap">' +
              '<div class="stock-bar-label"><span>Stok</span><span>' +
              stock +
              " / " +
              totalStock +
              "</span></div>" +
              '<div class="stock-bar-track"><div class="stock-bar-fill ' +
              stockColor +
              '" style="width:' +
              stockPct +
              '%"></div></div>' +
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
          (p.image
            ? '<img class="prod-img" src="' +
              esc(p.image) +
              '" alt="' +
              esc(p.name) +
              '" loading="lazy" onerror="this.style.display=\'none\'">'
            : '<div class="prod-emoji">' + emoji + "</div>") +
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
          '<div class="prod-price">Rp\u00a0' +
          fmt(p.price) +
          "</div>" +
          '<div class="prod-meta"><span class="prod-sold">Terjual ' +
          sold +
          "+</span></div>" +
          stockBarHTML +
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
    description = v("np-desc"),
    image_url = v("np-image"),
    stock = parseInt($id("np-stock")?.value || "0") || 0,
    category = $id("np-cat")?.value || "other";
  if (!name) {
    toast("Masukkan nama produk.", "err");
    return;
  }
  try {
    await api("POST", "/products", {
      name,
      price,
      description,
      image_url,
      stock,
      total_stock: stock,
      category,
    });
    toast('"' + name + '" berhasil ditambahkan!', "ok");
    ["np-name", "np-price", "np-desc", "np-image", "np-stock"].forEach((x) => {
      const el = $id(x);
      if (el) el.value = "";
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
  const imgEl = $id("edit-image");
  if (imgEl) imgEl.value = p.image_url || p.image || "";
  const stockEl = $id("edit-stock");
  if (stockEl) stockEl.value = p.stock != null ? p.stock : "";
  const catEl = $id("edit-cat");
  if (catEl) catEl.value = p.category || "other";
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
  const image_url = v("edit-image");
  const stockVal = $id("edit-stock")?.value;
  const stock = stockVal !== "" && stockVal != null ? parseInt(stockVal) : undefined;
  const category = $id("edit-cat")?.value || "";
  if (!id) return;
  const btn = $id("edit-save-btn");
  setLoad(btn, true);
  try {
    const body = { name, price, description };
    if (image_url) body.image_url = image_url;
    if (stock !== undefined) body.stock = stock;
    if (category) body.category = category;
    await api("PUT", "/products/" + id, body);
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
