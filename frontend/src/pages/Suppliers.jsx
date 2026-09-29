import { useEffect, useState } from "react";
import client from "../api/client";
import SupplierFormModal from "../components/SupplierFormModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { Link } from "react-router-dom";

// Ubah nomor lokal (0812...) jadi link WhatsApp internasional (62812...)
function waLink(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const intl = digits.startsWith("0") ? "62" + digits.slice(1) : digits;
  return `https://wa.me/${intl}`;
}

function PhoneLink({ phone }) {
  if (!phone) return <span className="text-outline">-</span>;
  const link = waLink(phone);
  if (!link) return <span>{phone}</span>;
  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      title="Chat via WhatsApp"
      className="font-tnum text-primary hover:underline"
    >
      {phone}
    </a>
  );
}

export default function Suppliers() {
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
  const [query, setQuery] = useState({ search: "", page: 1 });
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [toast, setToast] = useState("");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setLoadError("");

    const params = { page: query.page };
    if (query.search) params.search = query.search;

    client
      .get("/suppliers", { params })
      .then((res) => {
        if (ignore) return;
        const body = res.data;
        const rows = body.data ?? body;
        setSuppliers(rows);
        setMeta({
          current_page: body.current_page ?? 1,
          last_page: body.last_page ?? 1,
          total: body.total ?? rows.length,
          from: body.from ?? 0,
          to: body.to ?? 0,
        });
      })
      .catch(() => {
        if (!ignore)
          setLoadError(
            "Gagal memuat data supplier. Pastikan backend sedang berjalan.",
          );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [query, reloadKey]);

  // Toast hilang otomatis
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  function handleSearch(e) {
    e.preventDefault();
    setQuery({ search: searchInput.trim(), page: 1 });
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(supplier) {
    setEditing(supplier);
    setFormOpen(true);
  }

  function handleSaved(saved, isEdit) {
    setFormOpen(false);
    setToast(
      isEdit
        ? `Supplier "${saved.name}" berhasil diperbarui`
        : `Supplier "${saved.name}" berhasil ditambahkan`,
    );
    reload();
  }

  function askDelete(supplier) {
    setDeleteError("");
    setToDelete(supplier);
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await client.delete(`/suppliers/${toDelete.id}`);
      const name = toDelete.name;
      setToDelete(null);
      setToast(`Supplier "${name}" dihapus`);
      if (suppliers.length === 1 && query.page > 1) {
        setQuery((q) => ({ ...q, page: q.page - 1 }));
      } else {
        reload();
      }
    } catch (err) {
      setDeleteError(
        err.response?.data?.message ?? "Gagal menghapus supplier.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const emptyMessage = query.search
    ? "Supplier tidak ditemukan."
    : "Belum ada supplier. Klik tombol tambah untuk memulai.";

  return (
    <>
      <section className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-semibold text-lg text-on-surface">
              Supplier
            </h1>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <form
              onSubmit={handleSearch}
              className="relative flex-1 min-w-0 sm:flex-none"
            >
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari nama atau telepon..."
                className="h-9 pl-9 pr-3 rounded-lg border border-outline-variant text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none w-full sm:w-64"
              />
              <span className="material-symbols-outlined text-[18px] text-outline absolute left-2.5 top-2">
                search
              </span>
            </form>

            <button
              type="button"
              onClick={openCreate}
              title="Tambah Supplier"
              aria-label="Tambah Supplier"
              className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span className="hidden sm:inline">Tambah Supplier</span>
            </button>
          </div>
        </div>

        {loadError && (
          <p className="mx-4 mt-4 px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {loadError}
          </p>
        )}

        <div className="overflow-x-auto custom-scroll">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/70 border-b border-outline-variant text-xs text-outline uppercase tracking-wider">
                <th className="py-3 px-4">Nama Supplier</th>
                <th className="py-3 px-4 hidden sm:table-cell">Telepon</th>
                <th className="py-3 px-4 hidden md:table-cell">Alamat</th>
                <th className="py-3 px-4 text-center hidden lg:table-cell">
                  Produk
                </th>
                <th className="py-3 px-4 text-center hidden lg:table-cell">
                  Pembelian
                </th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high text-sm">
              {loading && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-outline">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && !loadError && suppliers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-outline">
                    {emptyMessage}
                  </td>
                </tr>
              )}
              {!loading &&
                suppliers.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-surface-container-low/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-on-surface">{s.name}</p>
                      {/* Di HP kolom telepon disembunyikan, jadi tampil di bawah nama */}
                      <p className="sm:hidden text-xs mt-0.5">
                        <PhoneLink phone={s.phone} />
                      </p>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <PhoneLink phone={s.phone} />
                    </td>
                    <td
                      className="py-3 px-4 hidden md:table-cell text-on-surface-variant max-w-xs truncate"
                      title={s.address ?? ""}
                    >
                      {s.address || "-"}
                    </td>
                    <td className="py-3 px-4 text-center hidden lg:table-cell">
                      <Link
                        to={`/products?supplier_id=${s.id}`}
                        title="Lihat produk supplier ini"
                        className="font-tnum text-primary hover:underline"
                      >
                        {s.products_count ?? 0}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-center font-tnum text-on-surface-variant hidden lg:table-cell">
                      {s.purchases_count ?? 0}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            edit
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => askDelete(s)}
                          title="Hapus"
                          className="p-1.5 rounded-lg text-on-surface-variant hover:bg-error-container/40 hover:text-error transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            delete
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-surface-container-high flex flex-wrap items-center justify-between gap-2 text-sm text-on-surface-variant">
          <span>
            {meta.total === 0
              ? "Tidak ada data"
              : `Menampilkan ${meta.from}–${meta.to} dari ${meta.total} supplier`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || meta.current_page <= 1}
              onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}
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
              onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}
              className="px-3 py-1 rounded-lg border border-outline-variant hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </section>

      <SupplierFormModal
        open={formOpen}
        supplier={editing}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Hapus Supplier"
        message={
          toDelete
            ? `Hapus supplier "${toDelete.name}"? Tindakan ini tidak bisa dibatalkan.`
            : ""
        }
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-2.5 rounded-lg bg-inverse-surface text-inverse-on-surface text-sm shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
