import { useEffect, useState } from "react";
import client from "../api/client";
import KpiCard from "../components/KpiCard";
import ProfitChart from "../components/ProfitChart";
import ChannelPerformance from "../components/ChannelPerformance";
import FilterBar from "../components/FilterBar";

function formatRupiah(n) {
  return "Rp " + Number(n ?? 0).toLocaleString("id-ID");
}

const STATUS_LABEL = {
  pending: "Diproses",
  completed: "Dana Dicairkan",
  cancelled: "Dibatalkan",
};

// Bungkus tiap sel CSV supaya koma/kutip/baris baru di dalam nilai tidak merusak format
function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename, rows) {
  const content = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  // BOM di depan supaya Excel membaca karakter (Rp, huruf besar-kecil) dengan benar
  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [marketplaces, setMarketplaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  function loadDashboard(nextFilters = {}) {
    setLoading(true);
    setFilters(nextFilters);
    client.get("/dashboard", { params: nextFilters }).then((res) => {
      setSummary(res.data);
      setLoading(false);
    });
  }

  useEffect(() => {
    loadDashboard();
    client.get("/marketplaces").then((res) => setMarketplaces(res.data));
  }, []);

  async function handleExport() {
    setExporting(true);
    setExportError("");

    try {
      const res = await client.get("/sales", {
        params: { ...filters, all: 1 },
      });

      const sales = res.data.data ?? res.data;

      if (!sales.length) {
        setExportError("Tidak ada transaksi pada rentang filter saat ini.");
        return;
      }

      const header = [
        "No. Pesanan",
        "Tanggal",
        "Marketplace",
        "Status",
        "Omzet",
        "Modal (HPP)",
        "Fee Marketplace",
        "Biaya Lain",
        "Profit",
      ];

      const rows = sales.map((sale) => [
        sale.order_number,
        sale.sale_date,
        sale.marketplace?.name ?? "-",
        STATUS_LABEL[sale.status] ?? sale.status,
        Number(sale.total_sales ?? 0),
        Number(sale.total_cost ?? 0),
        Number(sale.marketplace_fee ?? 0),
        Number(sale.other_fee ?? 0),
        Number(sale.profit ?? 0),
      ]);

      const totalRow = [
        "TOTAL",
        "",
        "",
        "",
        sales.reduce((sum, s) => sum + Number(s.total_sales ?? 0), 0),
        sales.reduce((sum, s) => sum + Number(s.total_cost ?? 0), 0),
        sales.reduce((sum, s) => sum + Number(s.marketplace_fee ?? 0), 0),
        sales.reduce((sum, s) => sum + Number(s.other_fee ?? 0), 0),
        sales.reduce((sum, s) => sum + Number(s.profit ?? 0), 0),
      ];

      const today = new Date().toISOString().slice(0, 10);
      const rangeLabel =
        filters.date_from && filters.date_to
          ? `${filters.date_from}_${filters.date_to}`
          : today;

      downloadCsv(`laporan-penjualan_${rangeLabel}.csv`, [
        header,
        ...rows,
        totalRow,
      ]);
    } catch (err) {
      setExportError(
        err.response?.data?.message ?? "Gagal membuat laporan. Coba lagi.",
      );
    } finally {
      setExporting(false);
    }
  }

  if (loading || !summary) {
    return <p className="text-on-surface-variant">Memuat dashboard...</p>;
  }

  return (
    <>
      {/* Judul + Aksi */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-on-surface tracking-tight">
            Dashboard Profit Real Marketplace
          </h1>
          <p className="text-on-surface-variant mt-1">
            Ringkasan performa penjualan kotor, estimasi potongan biaya
            admin/layanan, dan laba bersih.
          </p>
        </div>
        {/* <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-sm hover:bg-surface-container-low transition-colors shadow-sm active:scale-[0.98] disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px] text-outline">
                {exporting ? "hourglass_top" : "file_download"}
              </span>
              {exporting ? "Menyiapkan..." : "Export Laporan Excel/CSV"}
            </button>
          </div>
          {exportError && (
            <span className="text-xs text-error">{exportError}</span>
          )}
        </div> */}
      </section>

      {/* Filter Bar */}
      <FilterBar marketplaces={marketplaces} onApply={loadDashboard} />

      {/* KPI Cards - Baris 1: Aset & Inventori */}
      {/* KPI Cards - Baris 1: Aset gudang (nilai saat ini, tidak ikut filter tanggal/marketplace) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="Total Produk"
          icon="inventory_2"
          tone="blue"
          value={summary.total_products}
          suffix="SKU aktif"
        />
        <KpiCard
          label="Total Stok"
          icon="package_2"
          tone="violet"
          value={Number(summary.total_stock ?? 0).toLocaleString("id-ID")}
          suffix="pcs di gudang"
        />
        <KpiCard
          label="Nilai Stok Gudang"
          icon="warehouse"
          tone="teal"
          value={formatRupiah(summary.stock_value)}
          badge={
            summary.stock_without_hpp > 0
              ? `${summary.stock_without_hpp} tanpa HPP`
              : "Stok × HPP"
          }
          badgeColor={summary.stock_without_hpp > 0 ? "amber" : "neutral"}
          note={
            summary.stock_without_hpp > 0
              ? `${summary.stock_without_hpp} varian berstok belum ada HPP, isi di menu Produk`
              : "Modal yang tertanam di stok saat ini"
          }
          noteIcon={summary.stock_without_hpp > 0 ? "warning" : "info"}
        />
      </section>

      {/* KPI Cards - Baris 2: Penjualan & profit (ikut filter) */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Penjualan (Gross)"
          icon="payments"
          tone="sky"
          value={formatRupiah(summary.total_sales)}
          note="Omzet transaksi completed"
        />
        <KpiCard
          label="Biaya Marketplace"
          icon="percent"
          tone="amber"
          value={formatRupiah(summary.marketplace_fee)}
          badge="Fee"
          badgeColor="amber"
        />
        <KpiCard
          label="Profit Real (Net Profit)"
          icon="savings"
          tone="emerald"
          value={formatRupiah(summary.real_profit)}
          badge="Bersih"
          badgeColor="emerald"
          note="Setelah potong HPP & fee"
          noteIcon="verified"
        />
        <KpiCard
          label="Transaksi Pending"
          icon="hourglass_top"
          tone="rose"
          value={summary.pending_transactions}
          suffix="menunggu settlement"
        />
      </section>

      {/* Chart + Performa Channel */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8">
          <ProfitChart
            data={[
              { date: "1", gross: 4000000, profit: 900000 },
              { date: "2", gross: 3000000, profit: 700000 },
              { date: "3", gross: 5000000, profit: 1200000 },
            ]}
          />
        </div>
        <ChannelPerformance channels={summary.by_marketplace ?? []} />
      </section>
    </>
  );
}
