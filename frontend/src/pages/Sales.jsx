import { useEffect, useState } from "react";
import client from "../api/client";
import SaleFormModal from "../components/SaleFormModal";
import SaleDetailModal from "../components/SaleDetailModal";
import ConfirmDialog from "../components/ConfirmDialog";

function formatRupiah(n) {
  const value = Number(n ?? 0);
  const sign = value < 0 ? "-" : "";

  return `${sign}Rp ${Math.abs(value).toLocaleString("id-ID")}`;
}

function formatDate(value) {
  if (!value) return "-";

  const str = String(value);
  const date = str.includes("T") ? new Date(str) : new Date(`${str}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STATUS_STYLE = {
  pending: {
    label: "Diproses",
    icon: "autorenew",
    color: "bg-surface-container-high text-on-secondary-container",
  },
  completed: {
    label: "Dana Dicairkan",
    icon: "check_circle",
    color: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  },
  cancelled: {
    label: "Dibatalkan",
    icon: "cancel",
    color: "bg-error-container text-on-error-container",
  },
};

export default function Sales() {
  const [sales, setSales] = useState([]);

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
  const [query, setQuery] = useState({ search: "", status: "", page: 1 });
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState(null);

  const [busyId, setBusyId] = useState(null);

  const [toCancel, setToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const [toast, setToast] = useState(null);

  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setLoadError("");

    const params = { page: query.page };

    if (query.search) params.search = query.search;
    if (query.status) params.status = query.status;

    client
      .get("/sales", { params })
      .then((res) => {
        if (ignore) return;

        const body = res.data;
        const rows = body.data ?? body;

        setSales(rows);

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
            "Gagal memuat data penjualan. Pastikan backend sedang berjalan.",
          );
        }
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

    const timer = setTimeout(() => setToast(null), 3500);

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

  function handleSaved(saved) {
    setFormOpen(false);

    setToast({ text: `Penjualan ${saved.order_number} berhasil disimpan` });

    if (query.page !== 1) {
      setQuery((current) => ({ ...current, page: 1 }));
    } else {
      reload();
    }
  }

  async function openView(sale) {
    try {
      const res = await client.get(`/sales/${sale.id}`);

      setViewing(res.data);
    } catch (err) {
      setToast({
        text: err.response?.data?.message ?? "Gagal memuat detail penjualan.",
        error: true,
      });
    }
  }

  async function handleComplete(sale) {
    setBusyId(sale.id);

    try {
      await client.post(`/sales/${sale.id}/complete`);

      setToast({ text: `Pesanan ${sale.order_number} ditandai selesai` });

      reload();
    } catch (err) {
      setToast({
        text: err.response?.data?.message ?? "Gagal menyelesaikan pesanan.",
        error: true,
      });
    } finally {
      setBusyId(null);
    }
  }

  function askCancel(sale) {
    setCancelError("");
    setToCancel(sale);
  }

  async function confirmCancel() {
    if (!toCancel) return;

    setCancelling(true);
    setCancelError("");

    try {
      await client.post(`/sales/${toCancel.id}/cancel`);

      const order = toCancel.order_number;

      setToCancel(null);

      setToast({ text: `Pesanan ${order} dibatalkan, stok dikembalikan` });

      reload();
    } catch (err) {
      setCancelError(
        err.response?.data?.message ?? "Gagal membatalkan pesanan.",
      );
    } finally {
      setCancelling(false);
    }
  }

  const emptyMessage =
    query.search || query.status
      ? "Penjualan tidak ditemukan."
      : "Belum ada transaksi penjualan.";

  return (
    <>
      <section className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-container-high flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-lg text-on-surface">
              Penjualan Marketplace
            </h1>

            <p className="text-sm text-on-surface-variant">
              Kalkulasi profit riil per transaksi setelah potongan fee
              marketplace.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full lg:w-auto lg:shrink-0">
            <form
              onSubmit={handleSearch}
              className="relative flex-1 min-w-0 lg:flex-none"
            >
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari no. pesanan / marketplace..."
                className="h-9 pl-9 pr-3 rounded-lg border border-outline-variant text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none w-full lg:w-56"
              />

              <span className="material-symbols-outlined text-[18px] text-outline absolute left-2.5 top-2">
                search
              </span>
            </form>

            <select
              value={query.status}
              onChange={(e) =>
                setQuery((current) => ({
                  ...current,
                  status: e.target.value,
                  page: 1,
                }))
              }
              className="shrink-0 h-9 px-3 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest cursor-pointer outline-none focus:border-primary"
            >
              <option value="">Semua Status</option>
              <option value="pending">Diproses</option>
              <option value="completed">Dana Dicairkan</option>
              <option value="cancelled">Dibatalkan</option>
            </select>

            <button
              type="button"
              onClick={() => setFormOpen(true)}
              title="Tambah Penjualan"
              aria-label="Tambah Penjualan"
              className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>

              <span className="hidden sm:inline">Tambah</span>
            </button>
          </div>
        </div>

        {loadError && (
          <p className="mx-4 mt-4 px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {loadError}
          </p>
        )}

        <div className="overflow-x-auto custom-scroll">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-surface-container-low/70 border-b border-outline-variant text-xs text-outline uppercase tracking-wider">
                <th className="py-3 px-4">No. Pesanan</th>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Marketplace</th>
                <th className="py-3 px-4 text-right">Omzet</th>
                <th className="py-3 px-4 text-right">Modal</th>
                <th className="py-3 px-4 text-right">Fee</th>
                <th className="py-3 px-4 text-right">Profit</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
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

              {!loading && !loadError && sales.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-outline">
                    {emptyMessage}
                  </td>
                </tr>
              )}

              {!loading &&
                sales.map((sale) => {
                  const status =
                    STATUS_STYLE[sale.status] ?? STATUS_STYLE.pending;

                  return (
                    <tr
                      key={sale.id}
                      className="hover:bg-surface-container-low/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="font-tnum font-medium text-on-surface">
                          {sale.order_number}
                        </p>

                        {/* <p className="text-xs text-on-surface-variant">
                          {sale.items_count ?? 0} item
                        </p> */}
                      </td>

                      <td className="py-3 px-4 font-tnum text-on-surface-variant">
                        {formatDate(sale.sale_date)}
                      </td>

                      <td className="py-3 px-4 text-on-surface">
                        {sale.marketplace?.name ?? "-"}
                      </td>

                      <td className="py-3 px-4 text-right font-tnum text-on-surface">
                        {formatRupiah(sale.total_sales)}
                      </td>

                      <td className="py-3 px-4 text-right font-tnum text-on-surface-variant">
                        {formatRupiah(sale.total_cost)}
                      </td>

                      <td className="py-3 px-4 text-right font-tnum text-amber-700">
                        {formatRupiah(sale.marketplace_fee)}
                      </td>

                      <td
                        className={`py-3 px-4 text-right font-tnum font-bold ${
                          Number(sale.profit) < 0
                            ? "text-error"
                            : "text-emerald-800"
                        }`}
                      >
                        {formatRupiah(sale.profit)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.color}`}
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {status.icon}
                          </span>

                          {status.label}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openView(sale)}
                            title="Lihat detail"
                            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              visibility
                            </span>
                          </button>

                          {sale.status === "pending" && (
                            <>
                              <button
                                type="button"
                                disabled={busyId === sale.id}
                                onClick={() => handleComplete(sale)}
                                title="Selesaikan (dana sudah cair)"
                                aria-label="Selesaikan"
                                className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-40"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  check_circle
                                </span>
                              </button>

                              <button
                                type="button"
                                disabled={busyId === sale.id}
                                onClick={() => askCancel(sale)}
                                title="Batalkan pesanan"
                                aria-label="Batalkan"
                                className="p-1.5 rounded-lg text-error hover:bg-error-container/40 transition-colors disabled:opacity-40"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  cancel
                                </span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-surface-container-high flex flex-wrap items-center justify-between gap-2 text-sm text-on-surface-variant">
          <span>
            {meta.total === 0
              ? "Tidak ada data"
              : `Menampilkan ${meta.from}–${meta.to} dari ${meta.total} penjualan`}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || meta.current_page <= 1}
              onClick={() =>
                setQuery((current) => ({ ...current, page: current.page - 1 }))
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
                setQuery((current) => ({ ...current, page: current.page + 1 }))
              }
              className="px-3 py-1 rounded-lg border border-outline-variant hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </section>

      <SaleFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <SaleDetailModal
        open={Boolean(viewing)}
        sale={viewing}
        onClose={() => setViewing(null)}
      />

      <ConfirmDialog
        open={Boolean(toCancel)}
        title="Batalkan Pesanan"
        message={
          toCancel
            ? `Batalkan pesanan ${toCancel.order_number}? Stok semua item akan dikembalikan.`
            : ""
        }
        confirmLabel="Batalkan Pesanan"
        busy={cancelling}
        error={cancelError}
        onConfirm={confirmCancel}
        onClose={() => setToCancel(null)}
      />

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[80] px-4 py-2.5 rounded-lg text-sm shadow-lg ${
            toast.error
              ? "bg-error text-on-error"
              : "bg-inverse-surface text-inverse-on-surface"
          }`}
        >
          {toast.text}
        </div>
      )}
    </>
  );
}
