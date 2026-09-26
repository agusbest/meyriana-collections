import { useEffect, useState } from "react";
import client from "../api/client";
import KpiCard from "../components/KpiCard";
import ProfitChart from "../components/ProfitChart";
import ChannelPerformance from "../components/ChannelPerformance";
import FilterBar from "../components/FilterBar";

function formatRupiah(n) {
  return "Rp " + Number(n ?? 0).toLocaleString("id-ID");
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [marketplaces, setMarketplaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  function loadDashboard(filters = {}) {
    setLoading(true);
    client.get("/dashboard", { params: filters }).then((res) => {
      setSummary(res.data);
      setLoading(false);
    });
  }

  useEffect(() => {
    loadDashboard();
    client.get("/marketplaces").then((res) => setMarketplaces(res.data));
  }, []);

  // Placeholder: ganti dengan panggilan endpoint sync order marketplace
  // kalau/ketika integrasi API Shopee/Tokopedia/dst sudah tersedia di backend.
  function handleSync() {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 800);
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
            Ringkasan performa penjualan kotor, estimasi potongan biaya admin/layanan, dan laba bersih riil.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-sm hover:bg-surface-container-low transition-colors shadow-sm active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px] text-outline">file_download</span>
            Export Laporan Excel/CSV
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            {syncing ? "Menyinkronkan..." : "Sinkronisasi Pesanan Baru"}
          </button>
        </div>
      </section>

      {/* Filter Bar */}
      <FilterBar marketplaces={marketplaces} onApply={loadDashboard} />

      {/* KPI Cards - Baris 1: Aset & Inventori */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="Total Produk"
          value={summary.total_products}
          suffix="SKU aktif"
          badge="+4 produk baru"
          badgeColor="emerald"
          note="Terdistribusi di beberapa marketplace"
          noteIcon="inventory"
        />
        <KpiCard
          label="Total Stok"
          value={summary.total_stock.toLocaleString("id-ID")}
          suffix="Unit siap kirim"
        />
        <KpiCard
          label="Penjualan (Gross)"
          value={formatRupiah(summary.total_sales)}
          note="Total omzet dari transaksi completed"
        />
      </section>

      {/* KPI Cards - Baris 2: Finansial & Profit */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="Biaya Marketplace"
          value={formatRupiah(summary.marketplace_fee)}
          badge="Fee"
          badgeColor="amber"
        />
        <KpiCard
          label="Profit Real (Net Profit)"
          value={formatRupiah(summary.real_profit)}
          badge="Bersih"
          badgeColor="emerald"
          note="Bersih setelah potong HPP & fee platform"
          noteIcon="verified"
        />
        <KpiCard
          label="Transaksi Pending"
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
