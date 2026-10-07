import { useEffect, useState } from "react";
import client from "../api/client";
import ExpenseFormModal from "../components/ExpenseFormModal";
import ConfirmDialog from "../components/ConfirmDialog";

function formatRupiah(n) {
  return `Rp ${Number(n ?? 0).toLocaleString("id-ID")}`;
}

function formatRupiahDec(n) {
  return `Rp ${Number(n ?? 0).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatQty(n) {
  return Number(n).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

// Tanggal menurut jam lokal (BUKAN toISOString, yang memakai UTC dan bisa bergeser sehari)
function localDate(d) {
  const pad = (n) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const PRESETS = [
  ["month", "Bulan Ini"],
  ["last", "Bulan Lalu"],
  ["30", "30 Hari"],
  ["all", "Semua"],
];

function presetRange(key) {
  const now = new Date();

  if (key === "month") {
    return {
      date_from: localDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      date_to: localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }

  if (key === "last") {
    return {
      date_from: localDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      date_to: localDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }

  if (key === "30") {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);

    return { date_from: localDate(from), date_to: localDate(now) };
  }

  return { date_from: "", date_to: "" };
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ total: 0, count: 0, by_category: [] });
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState(() => ({
    search: "",
    category: "",
    preset: "month",
    ...presetRange("month"),
    page: 1,
  }));
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
    if (query.category) params.category = query.category;
    if (query.date_from) params.date_from = query.date_from;
    if (query.date_to) params.date_to = query.date_to;

    client
      .get("/operational-expenses", { params })
      .then((res) => {
        if (ignore) return;

        const body = res.data;

        setExpenses(body.data ?? []);
        setSummary(body.summary ?? { total: 0, count: 0, by_category: [] });
        setCategories(body.categories ?? []);
        setMeta({
          current_page: body.current_page ?? 1,
          last_page: body.last_page ?? 1,
          total: body.total ?? 0,
          from: body.from ?? 0,
          to: body.to ?? 0,
        });
      })
      .catch(() => {
        if (!ignore) setLoadError("Gagal memuat data biaya. Pastikan backend sedang berjalan.");
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

    const timer = setTimeout(() => setToast(""), 3000);

    return () => clearTimeout(timer);
  }, [toast]);

  const reload = () => setReloadKey((k) => k + 1);

  function handleSearch(e) {
    e.preventDefault();
    setQuery((q) => ({ ...q, search: searchInput.trim(), page: 1 }));
  }

  function choosePreset(key) {
    setQuery((q) => ({ ...q, preset: key, ...presetRange(key), page: 1 }));
  }

  function setDate(field, value) {
    setQuery((q) => ({ ...q, preset: "custom", [field]: value, page: 1 }));
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(expense) {
    setEditing(expense);
    setFormOpen(true);
  }

  function handleSaved(saved, isEdit) {
    setFormOpen(false);
    setToast(isEdit ? `"${saved.name}" berhasil diperbarui` : `"${saved.name}" berhasil dicatat`);

    if (!isEdit && query.page !== 1) {
      setQuery((q) => ({ ...q, page: 1 }));
    } else {
      reload();
    }
  }

  function askDelete(expense) {
    setDeleteError("");
    setToDelete(expense);
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError("");

    try {
      await client.delete(`/operational-expenses/${toDelete.id}`);

      const name = toDelete.name;

      setToDelete(null);
      setToast(`"${name}" dihapus`);

      if (expenses.length === 1 && query.page > 1) {
        setQuery((q) => ({ ...q, page: q.page - 1 }));
      } else {
        reload();
      }
    } catch (err) {
      setDeleteError(err.response?.data?.message ?? "Gagal menghapus biaya.");
    } finally {
      setDeleting(false);
    }
  }

  const topCategory = summary.by_category?.[0];
  const hasFilter = Boolean(query.search || query.category);

  return (
    <>
      <section className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-container-high flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 basis-80">
            <h1 className="font-display font-semibold text-lg text-on-surface">Biaya Operasional</h1>
            <p className="text-sm text-on-surface-variant">
              Catat pengeluaran seperti plastik packing dan kertas thermal. Totalnya mengurangi laba bersih di
              Dashboard.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            title="Tambah Biaya"
            aria-label="Tambah Biaya"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span className="hidden sm:inline">Tambah Biaya</span>
          </button>
        </div>

        {/* Periode */}
        <div className="px-4 pt-4 flex flex-wrap items-center gap-2">
          {PRESETS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => choosePreset(key)}
              className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                query.preset === key
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant text-on-surface hover:bg-surface-container-low"
              }`}
            >
              {label}
            </button>
          ))}

          <div className="flex items-center gap-1.5 text-sm text-on-surface-variant sm:ml-auto">
            <input
              type="date"
              aria-label="Dari tanggal"
              value={query.date_from}
              onChange={(e) => setDate("date_from", e.target.value)}
              className="h-9 px-2 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest outline-none focus:border-primary"
            />
            <span>s/d</span>
            <input
              type="date"
              aria-label="Sampai tanggal"
              value={query.date_to}
              onChange={(e) => setDate("date_to", e.target.value)}
              className="h-9 px-2 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Ringkasan */}
        <div className="px-4 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="p-3 rounded-lg border border-outline-variant">
            <span className="block text-xs text-outline">Total biaya{hasFilter ? " (sesuai filter)" : ""}</span>
            <span className="block text-xl font-bold font-tnum text-amber-700">{formatRupiah(summary.total)}</span>
          </div>
          <div className="p-3 rounded-lg border border-outline-variant">
            <span className="block text-xs text-outline">Jumlah catatan</span>
            <span className="block text-xl font-bold font-tnum text-on-surface">
              {Number(summary.count ?? 0).toLocaleString("id-ID")}
            </span>
          </div>
          <div className="p-3 rounded-lg border border-outline-variant">
            <span className="block text-xs text-outline">Kategori terbesar</span>
            <span className="block text-sm font-semibold text-on-surface truncate">
              {topCategory ? topCategory.category : "-"}
            </span>
            {topCategory && (
              <span className="block text-xs text-outline font-tnum">{formatRupiah(topCategory.total)}</span>
            )}
          </div>
        </div>

        {/* Per kategori (klik untuk menyaring) */}
        {summary.by_category?.length > 0 && (
          <div className="px-4 pt-3 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setQuery((q) => ({ ...q, category: "", page: 1 }))}
              className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
                !query.category
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              Semua kategori
            </button>

            {summary.by_category.map((c) => (
              <button
                key={c.category}
                type="button"
                onClick={() => setQuery((q) => ({ ...q, category: c.category, page: 1 }))}
                className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
                  query.category === c.category
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                }`}
              >
                {c.category} <span className="font-tnum text-outline">• {formatRupiah(c.total)}</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSearch} className="px-4 pt-3 relative">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari nama biaya, kategori, atau catatan..."
            className="h-9 pl-9 pr-3 w-full rounded-lg border border-outline-variant text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          />
          <span className="material-symbols-outlined text-[18px] text-outline absolute left-6.5 top-5">search</span>
        </form>

        {loadError && (
          <p className="mx-4 mt-4 px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {loadError}
          </p>
        )}

        <div className="mt-3 overflow-x-auto custom-scroll border-t border-surface-container-high">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/70 border-b border-outline-variant text-xs text-outline uppercase tracking-wider">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Biaya</th>
                <th className="py-3 px-4 hidden md:table-cell">Jumlah</th>
                <th className="py-3 px-4 text-right hidden md:table-cell">Harga satuan</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-surface-container-high text-sm">
              {loading && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-outline">
                    Memuat...
                  </td>
                </tr>
              )}

              {!loading && !loadError && expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-outline">
                    {hasFilter || query.preset !== "all"
                      ? "Belum ada biaya pada periode atau filter ini."
                      : 'Belum ada biaya yang dicatat. Klik "Tambah Biaya" untuk memulai.'}
                  </td>
                </tr>
              )}

              {!loading &&
                expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3 px-4 font-tnum whitespace-nowrap text-on-surface-variant align-top">
                      {formatDate(expense.expense_date)}
                    </td>

                    <td className="py-3 px-4 align-top">
                      <p className="font-medium text-on-surface">{expense.name}</p>
                      <p className="mt-0.5 text-xs flex flex-wrap items-center gap-x-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                          {expense.category}
                        </span>
                        {expense.notes && (
                          <span className="text-outline truncate max-w-[260px]" title={expense.notes}>
                            {expense.notes}
                          </span>
                        )}
                      </p>
                    </td>

                    <td className="py-3 px-4 hidden md:table-cell align-top font-tnum text-on-surface-variant">
                      {expense.qty ? `${formatQty(expense.qty)}${expense.unit ? ` ${expense.unit}` : ""}` : "-"}
                    </td>

                    <td className="py-3 px-4 hidden md:table-cell align-top text-right font-tnum text-on-surface-variant">
                      {expense.unit_price !== null && expense.unit_price !== undefined
                        ? formatRupiahDec(expense.unit_price)
                        : "-"}
                    </td>

                    <td className="py-3 px-4 align-top text-right font-tnum font-semibold text-amber-700">
                      {formatRupiah(expense.amount)}
                    </td>

                    <td className="py-3 px-4 align-top">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(expense)}
                          title="Edit"
                          aria-label={`Edit ${expense.name}`}
                          className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => askDelete(expense)}
                          title="Hapus"
                          aria-label={`Hapus ${expense.name}`}
                          className="p-1.5 rounded-lg text-on-surface-variant hover:bg-error-container/40 hover:text-error transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
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
            {meta.total === 0 ? "Tidak ada data" : `Menampilkan ${meta.from}–${meta.to} dari ${meta.total} catatan`}
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

      <ExpenseFormModal
        open={formOpen}
        expense={editing}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Hapus Biaya"
        message={
          toDelete
            ? `Hapus "${toDelete.name}" (${formatRupiah(toDelete.amount)})? Laba bersih periode itu akan naik sebesar jumlah ini.`
            : ""
        }
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[80] px-4 py-2.5 rounded-lg bg-inverse-surface text-inverse-on-surface text-sm shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
