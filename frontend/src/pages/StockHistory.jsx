import { useEffect, useState } from "react";
import client from "../api/client";

const TYPE_LABEL = {
  purchase_in: {
    label: "Pembelian Masuk",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  sale_out: {
    label: "Penjualan Keluar",
    color: "bg-amber-50 text-amber-800 border-amber-200",
  },
  sale_cancel_in: {
    label: "Pembatalan (Masuk)",
    color: "bg-secondary-container text-on-surface border-transparent",
  },
  adjustment: {
    label: "Penyesuaian",
    color: "bg-surface-container text-on-surface-variant border-transparent",
  },
};

const REFERENCE_LABEL = {
  Purchase: "Pembelian",
  Sale: "Penjualan",
};

function referenceText(history) {
  if (!history.reference_type) return "";

  const name = String(history.reference_type).split("\\").pop();

  return `${REFERENCE_LABEL[name] ?? name} #${history.reference_id}`;
}

export default function StockHistory() {
  const [histories, setHistories] = useState([]);

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
  const [query, setQuery] = useState({ search: "", type: "", page: 1 });

  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setLoadError("");

    const params = { page: query.page };

    if (query.search) params.search = query.search;
    if (query.type) params.type = query.type;

    client
      .get("/stock-histories", { params })
      .then((res) => {
        if (ignore) return;

        const body = res.data;
        const rows = body.data ?? body;

        setHistories(rows);

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
            "Gagal memuat histori stok. Pastikan backend sedang berjalan.",
          );
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [query]);

  function handleSearch(e) {
    e.preventDefault();

    setQuery((current) => ({
      ...current,
      search: searchInput.trim(),
      page: 1,
    }));
  }

  const emptyMessage =
    query.search || query.type
      ? "Histori stok tidak ditemukan."
      : "Belum ada histori stok.";

  return (
    <section className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
      <div className="p-4 border-b border-surface-container-high flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-semibold text-lg text-on-surface">
            Histori Stok
          </h1>

          <p className="text-sm text-on-surface-variant">
            Jejak audit setiap pergerakan stok per variasi produk.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full lg:w-auto">
          <form
            onSubmit={handleSearch}
            className="relative flex-1 min-w-0 lg:flex-none"
          >
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari produk, SKU, warna, ukuran..."
              className="h-9 pl-9 pr-3 rounded-lg border border-outline-variant text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none w-full lg:w-72"
            />

            <span className="material-symbols-outlined text-[18px] text-outline absolute left-2.5 top-2">
              search
            </span>
          </form>

          <select
            value={query.type}
            onChange={(e) =>
              setQuery((current) => ({
                ...current,
                type: e.target.value,
                page: 1,
              }))
            }
            className="shrink-0 h-9 px-3 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest cursor-pointer outline-none focus:border-primary"
          >
            <option value="">Semua Tipe</option>

            {Object.entries(TYPE_LABEL).map(([value, item]) => (
              <option key={value} value={value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadError && (
        <p className="mx-4 mt-4 px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
          {loadError}
        </p>
      )}

      <div className="overflow-x-auto custom-scroll">
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="bg-surface-container-low/70 border-b border-outline-variant text-xs text-outline uppercase tracking-wider">
              <th className="py-3 px-4">Waktu</th>
              <th className="py-3 px-4">Produk</th>
              <th className="py-3 px-4">Tipe</th>
              <th className="py-3 px-4 text-right">Qty</th>
              <th className="py-3 px-4 text-right">Stok Sebelum</th>
              <th className="py-3 px-4 text-right">Stok Sesudah</th>
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

            {!loading && !loadError && histories.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-outline">
                  {emptyMessage}
                </td>
              </tr>
            )}

            {!loading &&
              histories.map((history) => {
                const variant = history.product_variant ?? history.productVariant;

                const type = TYPE_LABEL[history.type] ?? {
                  label: history.type,
                  color:
                    "bg-surface-container text-on-surface-variant border-transparent",
                };

                const reference = referenceText(history);

                return (
                  <tr
                    key={history.id}
                    className="hover:bg-surface-container-low/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-tnum text-on-surface-variant whitespace-nowrap">
                      {new Date(history.created_at).toLocaleString("id-ID")}
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-medium text-on-surface">
                        {variant?.product?.name ?? "-"}
                      </p>

                      <p className="text-xs text-on-surface-variant">
                        {variant?.color || "-"}
                        {" / "}
                        {variant?.size || "-"}
                        {variant?.product?.sku && ` • ${variant.product.sku}`}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${type.color}`}
                      >
                        {type.label}
                      </span>

                      {reference && (
                        <p className="mt-1 text-xs text-outline">{reference}</p>
                      )}
                    </td>

                    <td
                      className={`py-3 px-4 text-right font-tnum font-semibold ${
                        history.qty < 0 ? "text-error" : "text-emerald-700"
                      }`}
                    >
                      {history.qty > 0 ? `+${history.qty}` : history.qty}
                    </td>

                    <td className="py-3 px-4 text-right font-tnum text-on-surface-variant">
                      {history.stock_before}
                    </td>

                    <td className="py-3 px-4 text-right font-tnum font-semibold text-on-surface">
                      {history.stock_after}
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
            : `Menampilkan ${meta.from}–${meta.to} dari ${meta.total} catatan`}
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
  );
}
