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

