import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import client from "../api/client";
import ProductFormModal from "../components/ProductFormModal";
import ConfirmDialog from "../components/ConfirmDialog";
import ActionButtons from "../components/ActionButtons";

function formatRupiah(n) {
  return "Rp " + Number(n ?? 0).toLocaleString("id-ID");
}

function stockClass(stock) {
  if (stock === 0) return "text-error font-semibold";
  if (stock <= 5) return "text-amber-700 font-semibold";
  return "text-on-surface";
}

function getTotalStock(product) {
  return (product.variants ?? []).reduce(
    (total, variant) => total + Number(variant.stock ?? 0),
    0,
  );
}

function getActiveVariants(product) {
  return (product.variants ?? []).filter((variant) => variant.is_active);
}

function getPriceRange(product) {
  const variants = getActiveVariants(product);

  if (!variants.length) {
    return "-";
  }

  const prices = variants.map((variant) => Number(variant.selling_price ?? 0));

  const min = Math.min(...prices);
  const max = Math.max(...prices);

  if (min === max) {
    return formatRupiah(min);
  }

  return `${formatRupiah(min)} – ${formatRupiah(max)}`;
}

function getFirstImage(product) {
  const variant = getActiveVariants(product).find((item) => item.image_url);

  return variant?.image_url ?? null;
}

/**
 * Modal detail produk
 */
function ProductDetailModal({ product, onClose }) {
  const variants = product.variants ?? [];
  const activeVariants = variants.filter((variant) => variant.is_active);
  const totalStock = getTotalStock(product);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl bg-surface-container-lowest border border-outline-variant shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-surface-container-high">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-lg text-on-surface truncate">
              {product.name}
            </h2>

            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm text-on-surface-variant">
                SKU: <strong>{product.sku}</strong>
              </span>

              <span className="text-outline">•</span>

              <span className="text-sm text-on-surface-variant">
                Supplier: <strong>{product.supplier?.name ?? "-"}</strong>
              </span>

              {product.category && (
                <>
                  <span className="text-outline">•</span>

                  <span className="text-sm text-on-surface-variant">
                    {product.category}
                  </span>
                </>
              )}

              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                  product.is_active
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-surface-container text-on-surface-variant border-transparent"
                }`}
              >
                {product.is_active ? "Aktif" : "Nonaktif"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors shrink-0"
            title="Tutup"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-5 border-b border-surface-container-high">
          <div className="rounded-lg bg-surface-container-low p-3">
            <p className="text-xs text-outline">Variasi Aktif</p>

            <p className="mt-1 text-lg font-semibold text-on-surface font-tnum">
              {activeVariants.length}
            </p>
          </div>

          <div className="rounded-lg bg-surface-container-low p-3">
            <p className="text-xs text-outline">Total Stok</p>

            <p
              className={`mt-1 text-lg font-semibold font-tnum ${stockClass(
                totalStock,
              )}`}
            >
              {totalStock}
            </p>
          </div>

          <div className="rounded-lg bg-surface-container-low p-3 col-span-2 sm:col-span-1">
            <p className="text-xs text-outline">Harga Jual</p>

            <p className="mt-1 text-lg font-semibold text-on-surface font-tnum">
              {getPriceRange(product)}
            </p>
          </div>
        </div>

        {/* Variants */}
        <div className="p-4 overflow-y-auto max-h-[48vh] custom-scroll">
          <div className="mb-3">
            <h3 className="font-display font-semibold text-base text-on-surface">
              Detail Variasi
            </h3>

            <p className="text-xs text-outline mt-0.5">
              Warna, ukuran, harga, stok, dan gambar setiap variasi.
            </p>
          </div>

          {activeVariants.length === 0 ? (
            <div className="py-10 text-center text-sm text-outline">
              Belum ada variasi aktif.
            </div>
          ) : (
            <div className="overflow-x-auto custom-scroll">
              <table className="w-full min-w-[650px] text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant text-xs text-outline uppercase tracking-wider">
                    <th className="py-3 px-3">Gambar</th>
                    <th className="py-3 px-3">Warna</th>
                    <th className="py-3 px-3">Ukuran</th>
                    <th className="py-3 px-3 text-right">HPP</th>
                    <th className="py-3 px-3 text-right">Harga Jual</th>
                    <th className="py-3 px-3 text-right">Stok</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-surface-container-high text-sm">
                  {activeVariants.map((variant) => (
                    <tr
                      key={variant.id}
                      className="hover:bg-surface-container-low/40 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="w-14 h-14 rounded-lg overflow-hidden border border-outline-variant bg-surface-container flex items-center justify-center">
                          {variant.image_url ? (
                            <img
                              src={variant.image_url}
                              alt={`${variant.color ?? ""} ${
                                variant.size ?? ""
                              }`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-outline">
                              image
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-medium text-on-surface">
                        {variant.color || "-"}
                      </td>

                      <td className="py-3 px-3 text-on-surface-variant">
                        {variant.size || "-"}
                      </td>

                      <td className="py-3 px-3 text-right font-tnum text-on-surface-variant">
                        {formatRupiah(variant.purchase_price)}
                      </td>

                      <td className="py-3 px-3 text-right font-tnum font-medium text-on-surface">
                        {formatRupiah(variant.selling_price)}
                      </td>

                      <td
                        className={`py-3 px-3 text-right font-tnum ${stockClass(
                          Number(variant.stock ?? 0),
                        )}`}
                      >
                        {variant.stock ?? 0}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Aktif
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Products() {
  // Filter supplier bisa datang dari link, misalnya /products?supplier_id=3
  const [searchParams] = useSearchParams();
  const urlSupplier = searchParams.get("supplier_id") ?? "";

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [meta, setMeta] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
    from: 0,
    to: 0,
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [searchInput, setSearchInput] = useState("");

  const [query, setQuery] = useState({
    search: "",
    status: "",
    supplier_id: urlSupplier,
    page: 1,
  });

  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [viewing, setViewing] = useState(null);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [toast, setToast] = useState("");

  // Ikuti perubahan ?supplier_id= di URL (misalnya klik menu Produk lagi)
  useEffect(() => {
    setQuery((current) =>
      current.supplier_id === urlSupplier
        ? current
        : { ...current, supplier_id: urlSupplier, page: 1 },
    );
  }, [urlSupplier]);

  // Daftar supplier untuk filter dan form produk
  useEffect(() => {
    client
      .get("/suppliers", { params: { all: 1 } })
      .then((res) => setSuppliers(res.data.data ?? res.data))
      .catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setLoadError("");

    const params = {
      page: query.page,
    };

    if (query.search) {
      params.search = query.search;
    }

    if (query.status !== "") {
      params.is_active = query.status;
    }

    if (query.supplier_id) {
      params.supplier_id = query.supplier_id;
    }

    client
      .get("/products", { params })
      .then((res) => {
        if (ignore) return;

        const body = res.data;
        const rows = body.data ?? body;

        setProducts(rows);

        setMeta({
          current_page: body.current_page ?? 1,
          last_page: body.last_page ?? 1,
          total: body.total ?? rows.length,
          from: body.from ?? 0,
          to: body.to ?? 0,
        });
      })
      .catch(() => {
        if (!ignore) {
          setLoadError(
            "Gagal memuat data produk. Pastikan backend sedang berjalan.",
          );
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [query, reloadKey]);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(""), 3000);

    return () => clearTimeout(timer);
  }, [toast]);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function handleSearch(e) {
    e.preventDefault();

    setQuery((current) => ({
      ...current,
      search: searchInput.trim(),
      page: 1,
    }));
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(product) {
    setEditing(product);
    setFormOpen(true);
  }

  function openView(product) {
    setViewing(product);
  }

  function handleSaved(saved, isEdit) {
    setFormOpen(false);

    setToast(
      isEdit
        ? `Produk "${saved.name}" berhasil diperbarui`
        : `Produk "${saved.name}" berhasil ditambahkan`,
    );

    if (!isEdit && query.page !== 1) {
      setQuery((current) => ({
        ...current,
        page: 1,
      }));
    } else {
      reload();
    }
  }

  function askDelete(product) {
    setDeleteError("");
    setToDelete(product);
  }

  async function confirmDelete() {
    if (!toDelete) return;

    setDeleting(true);
    setDeleteError("");

    try {
      await client.delete(`/products/${toDelete.id}`);

      const name = toDelete.name;

      setToDelete(null);

      setToast(`Produk "${name}" dihapus`);

      if (products.length === 1 && query.page > 1) {
        setQuery((current) => ({
          ...current,
          page: current.page - 1,
        }));
      } else {
        reload();
      }
    } catch (err) {
      setDeleteError(err.response?.data?.message ?? "Gagal menghapus produk.");
    } finally {
      setDeleting(false);
    }
  }

  const emptyMessage =
    query.search || query.supplier_id
      ? "Produk tidak ditemukan."
      : 'Belum ada produk. Klik "Tambah Produk" untuk memulai.';

  return (
    <>
      <section className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-surface-container-high flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-semibold text-lg text-on-surface">
              Produk
            </h1>

            <p className="text-sm text-on-surface-variant">
              Daftar produk per supplier, lengkap dengan variasi warna, ukuran,
              harga, dan stok.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <form
              onSubmit={handleSearch}
              className="order-1 relative flex-1 min-w-[180px] lg:flex-none"
            >
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari nama, SKU, warna..."
                className="h-9 pl-9 pr-3 rounded-lg border border-outline-variant text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none w-full lg:w-56"
              />

              <span className="material-symbols-outlined text-[18px] text-outline absolute left-2.5 top-2">
                search
              </span>
            </form>

            <select
              value={query.supplier_id}
              onChange={(e) =>
                setQuery((current) => ({
                  ...current,
                  supplier_id: e.target.value,
                  page: 1,
                }))
              }
              className="order-3 lg:order-2 shrink-0 max-w-[170px] h-9 px-3 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest cursor-pointer outline-none focus:border-primary"
            >
              <option value="">Semua Supplier</option>

              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>

            <select
              value={query.status}
              onChange={(e) =>
                setQuery((current) => ({
                  ...current,
                  status: e.target.value,
                  page: 1,
                }))
              }
              className="order-4 lg:order-3 shrink-0 h-9 px-3 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest cursor-pointer outline-none focus:border-primary"
            >
              <option value="">Semua Status</option>
              <option value="1">Aktif</option>
              <option value="0">Nonaktif</option>
            </select>

            <button
              type="button"
              onClick={openCreate}
              title="Tambah Produk"
              aria-label="Tambah Produk"
              className="order-2 lg:order-4 shrink-0 inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>

              <span className="hidden sm:inline">Tambah Produk</span>
            </button>
          </div>
        </div>

        {/* Error */}
        {loadError && (
          <p className="mx-4 mt-4 px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {loadError}
          </p>
        )}

        {/* Table */}
        <div className="overflow-x-auto custom-scroll">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface-container-low/70 border-b border-outline-variant text-xs text-outline uppercase tracking-wider">
                <th className="py-3 px-4">Produk</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4 text-center">Varian</th>
                <th className="py-3 px-4 text-right">Harga Jual</th>
                <th className="py-3 px-4 text-right">Total Stok</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-2 text-center w-px whitespace-nowrap">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-surface-container-high text-sm">
              {loading && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-outline">
                    Memuat...
                  </td>
                </tr>
              )}

              {!loading && !loadError && products.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-outline">
                    {emptyMessage}
                  </td>
                </tr>
              )}

              {!loading &&
                products.map((product) => {
                  const totalStock = getTotalStock(product);
                  const variants = getActiveVariants(product);
                  const image = getFirstImage(product);

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-surface-container-low/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-lg overflow-hidden border border-outline-variant bg-surface-container flex items-center justify-center shrink-0">
                            {image ? (
                              <img
                                src={image}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="material-symbols-outlined text-outline text-[20px]">
                                image
                              </span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="font-medium text-on-surface truncate max-w-[230px]">
                              {product.name}
                            </p>

                            {/* <p className="text-xs text-on-surface-variant">
                              {variants.length} variasi aktif
                            </p> */}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-tnum text-on-surface">
                        {product.sku}
                      </td>

                      <td className="py-3 px-4 text-on-surface">
                        {product.supplier?.name ?? (
                          <span className="text-outline">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-on-surface-variant">
                        {product.category ?? "-"}
                      </td>

                      <td className="py-3 px-4 text-center font-tnum">
                        {variants.length}
                      </td>

                      <td className="py-3 px-4 text-right font-tnum font-medium text-on-surface">
                        {getPriceRange(product)}
                      </td>

                      <td
                        className={`py-3 px-4 text-right font-tnum ${stockClass(
                          totalStock,
                        )}`}
                      >
                        {totalStock}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            product.is_active
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-surface-container text-on-surface-variant border-transparent"
                          }`}
                        >
                          {product.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-2 w-px whitespace-nowrap">
                        <ActionButtons
                          onView={() => openView(product)}
                          onEdit={() => openEdit(product)}
                          onDelete={() => askDelete(product)}
                        />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-surface-container-high flex flex-wrap items-center justify-between gap-2 text-sm text-on-surface-variant">
          <span>
            {meta.total === 0
              ? "Tidak ada data"
              : `Menampilkan ${meta.from}–${meta.to} dari ${meta.total} produk`}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || meta.current_page <= 1}
              onClick={() =>
                setQuery((current) => ({
                  ...current,
                  page: current.page - 1,
                }))
              }
              className="px-3 py-1 rounded-lg border border-outline-variant hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Sebelumnya
            </button>

            <span className="font-tnum">
              {meta.current_page} / {meta.last_page}
            </span>

            <button
              type="button"
              disabled={loading || meta.current_page >= meta.last_page}
              onClick={() =>
                setQuery((current) => ({
                  ...current,
                  page: current.page + 1,
                }))
              }
              className="px-3 py-1 rounded-lg border border-outline-variant hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </section>

      {/* Detail Produk */}
      {viewing && (
        <ProductDetailModal
          product={viewing}
          onClose={() => setViewing(null)}
        />
      )}

      {/* Form Produk */}
      <ProductFormModal
        open={formOpen}
        product={editing}
        suppliers={suppliers}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Hapus Produk"
        message={
          toDelete
            ? `Hapus produk "${toDelete.name}" (${toDelete.sku})? Tindakan ini tidak bisa dibatalkan.`
            : ""
        }
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[80] px-4 py-2.5 rounded-lg bg-inverse-surface text-inverse-on-surface text-sm shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
