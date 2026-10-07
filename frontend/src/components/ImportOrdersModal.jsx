import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import Modal from "./Modal";
import { ORDER_READERS } from "../utils/orderImport";

const CHUNK = 100; // pesanan per kirim saat menyimpan
const ACTIONABLE = ["ready", "complete"];

function formatRupiah(n) {
  return `Rp ${Math.round(Number(n ?? 0)).toLocaleString("id-ID")}`;
}

function errorText(err, fallback) {
  const data = err?.response?.data;
  const first = data?.errors ? Object.values(data.errors).flat()[0] : null;
  return first ?? data?.message ?? fallback;
}

const TILES = [
  { key: "ready", label: "Siap diimpor", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { key: "complete", label: "Ditandai selesai", tone: "bg-primary/10 text-primary border-primary/30" },
  { key: "unmapped", label: "Produk belum terhubung", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  { key: "no_stock", label: "Stok kurang", tone: "bg-error-container/50 text-on-error-container border-error/30" },
  { key: "duplicate", label: "Sudah ada", tone: "bg-surface-container-low text-on-surface-variant border-outline-variant" },
  { key: "skipped", label: "Batal / dilewati", tone: "bg-surface-container-low text-on-surface-variant border-outline-variant" },
];

export default function ImportOrdersModal({ open, onClose, onImported }) {
  const [marketplaces, setMarketplaces] = useState([]);
  const [marketplaceId, setMarketplaceId] = useState("");
  const [parsed, setParsed] = useState(null); // { fileName, orders, lineCount, skippedRows }
  const [autoAdjust, setAutoAdjust] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  // Reset setiap kali dibuka
  useEffect(() => {
    if (!open) return;

    setParsed(null);
    setPreview(null);
    setResult(null);
    setAutoAdjust(false);
    setError("");
    setProgress(null);

    client
      .get("/marketplaces")
      .then((res) => {
        const list = res.data?.data ?? res.data ?? [];
        setMarketplaces(list);
        const first = list.find((m) => ORDER_READERS[m.code]) ?? list[0];
        setMarketplaceId((current) => current || (first ? String(first.id) : ""));
      })
      .catch(() => setError("Gagal memuat daftar marketplace."));
  }, [open]);

  const marketplace = marketplaces.find((m) => String(m.id) === String(marketplaceId));
  const reader = ORDER_READERS[marketplace?.code];
  const supportedNames = Object.keys(ORDER_READERS)
    .map((code) => marketplaces.find((m) => m.code === code)?.name ?? code)
    .join(", ");

  async function runPreview(data, adjust) {
    setBusy("preview");
    setError("");

    try {
      const res = await client.post("/sales/import/preview", {
        marketplace_id: Number(marketplaceId),
        auto_adjust: adjust,
        orders: data.orders,
      });
      setPreview(res.data);
    } catch (err) {
      setPreview(null);
      setError(errorText(err, "Gagal mengecek file."));
    } finally {
      setBusy("");
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError("");
    setPreview(null);

    if (!reader) {
      setError(`Format file pesanan ${marketplace?.name ?? "marketplace ini"} belum didukung.`);
      return;
    }

    try {
      const data = await reader(file);

      if (!data.orders.length) {
        setError("File tidak berisi pesanan.");
        return;
      }

      const next = { fileName: file.name, ...data };
      setParsed(next);
      await runPreview(next, autoAdjust);
    } catch (err) {
      setError(err.message || "File tidak bisa dibaca.");
    }
  }

  function toggleAdjust(checked) {
    setAutoAdjust(checked);
    if (parsed) runPreview(parsed, checked);
  }

  async function handleImport() {
    if (!parsed || !preview) return;

    // Kirim hanya pesanan yang lolos cek, tetap urut dari yang paling lama
    // "ready" = pesanan baru, "complete" = sudah ada & di marketplace sudah selesai
    const readyNumbers = new Set(
      preview.orders.filter((o) => ACTIONABLE.includes(o.status)).map((o) => o.order_number),
    );
    const orders = parsed.orders.filter((o) => readyNumbers.has(o.order_number));

    setBusy("import");
    setError("");

    const total = { imported: 0, completed: 0, failed: [] };

    try {
      for (let i = 0; i < orders.length; i += CHUNK) {
        setProgress({ done: i, total: orders.length });

        const res = await client.post("/sales/import", {
          marketplace_id: Number(marketplaceId),
          auto_adjust: autoAdjust,
          orders: orders.slice(i, i + CHUNK),
        });

        total.imported += res.data.summary?.imported ?? 0;
        total.completed += res.data.summary?.completed ?? 0;
        total.failed.push(...(res.data.failed ?? []));
        // Yang lolos cek tapi ternyata berubah (mis. stok habis karena penjualan lain) ikut dilaporkan
        total.failed.push(
          ...(res.data.skipped ?? []).map((s) => ({ order_number: s.order_number, message: s.message })),
        );
      }

      setProgress({ done: orders.length, total: orders.length });
      setResult({ ...total, notImported: (preview.summary?.total ?? 0) - orders.length });
      if (total.imported + total.completed > 0) onImported?.(total);
    } catch (err) {
      setError(
        `${errorText(err, "Gagal menyimpan.")} ${total.imported + total.completed} pesanan sudah diproses; impor ulang file yang sama aman (yang sudah ada dilewati).`,
      );
      const done = total.imported + total.completed;
      setResult(done ? { ...total, notImported: 0, partial: true } : null);
      if (done > 0) onImported?.(total);
    } finally {
      setBusy("");
    }
  }

  const summary = preview?.summary;
  const readyCount = summary?.ready ?? 0;
  const completeCount = summary?.complete ?? 0;
  const actionCount = readyCount + completeCount;
  const sumOf = (status) =>
    (preview?.orders ?? []).filter((o) => o.status === status).reduce((sum, o) => sum + Number(o.total || 0), 0);
  const readyTotal = sumOf("ready");
  const completeTotal = sumOf("complete");

  let actionLabel = `Impor ${readyCount} pesanan`;
  if (completeCount && !readyCount) actionLabel = `Tandai ${completeCount} pesanan selesai`;
  if (completeCount && readyCount) actionLabel = `Proses ${actionCount} pesanan`;

  const footer = result ? (
    <button
      type="button"
      onClick={onClose}
      className="h-9 px-4 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold"
    >
      Selesai
    </button>
  ) : (
    <>
      <button
        type="button"
        onClick={onClose}
        disabled={busy === "import"}
        className="h-9 px-4 rounded-lg border border-outline-variant text-sm hover:bg-surface-container-low disabled:opacity-40"
      >
        Batal
      </button>
      <button
        type="button"
        onClick={handleImport}
        disabled={!preview || actionCount === 0 || Boolean(busy)}
        className="h-9 px-4 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy === "import"
          ? `Memproses ${progress?.done ?? 0}/${progress?.total ?? actionCount}...`
          : actionLabel}
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={busy === "import" ? () => {} : onClose} title="Impor Pesanan" size="lg" footer={footer}>
      {result ? (
        <ResultView result={result} />
      ) : (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
            <label className="block">
              <span className="block mb-1 font-medium text-on-surface">Marketplace</span>
              <select
                value={marketplaceId}
                onChange={(e) => {
                  setMarketplaceId(e.target.value);
                  setParsed(null);
                  setPreview(null);
                }}
                disabled={Boolean(busy)}
                className="h-9 w-full px-3 rounded-lg border border-outline-variant bg-surface-container-lowest outline-none focus:border-primary"
              >
                {marketplaces.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block mb-1 font-medium text-on-surface">File pesanan (.xlsx)</span>
              <span
                className={`flex items-center gap-2 h-9 px-3 rounded-lg border border-dashed border-outline-variant ${
                  reader && !busy ? "cursor-pointer hover:border-primary hover:bg-surface-container-low" : "opacity-50"
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-primary">upload_file</span>
                <span className="truncate text-on-surface-variant">
                  {parsed ? parsed.fileName : "Pilih file..."}
                </span>
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                disabled={!reader || Boolean(busy)}
                className="sr-only"
                aria-label="File pesanan"
              />
            </label>
          </div>

          {!reader && marketplace && (
            <p className="px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              File pesanan {marketplace.name} belum didukung. Saat ini: {supportedNames || "-"}.
            </p>
          )}

          {!parsed && reader && (
            <p className="text-on-surface-variant">
              Ambil file dari Seller Centre: <b>Pesanan Saya → Ekspor</b>. Stok dipotong sesuai isi paket di
              Produk Marketplace. Pesanan yang sudah pernah diimpor otomatis dilewati.
              <span className="block mt-1.5">
                <b>Menyelesaikan transaksi:</b> ekspor pesanan berstatus <b>Selesai</b> lalu impor di sini. Nomor
                pesanan yang sudah ada dan masih Diproses otomatis jadi <b>Dana Dicairkan</b> (stok tidak dipotong
                lagi).
              </span>
            </p>
          )}

          {error && (
            <p role="alert" className="px-3 py-2 rounded-lg bg-error-container text-on-error-container">
              {error}
            </p>
          )}

          {busy === "preview" && <p className="text-on-surface-variant">Mengecek pesanan...</p>}

          {preview && busy !== "preview" && (
            <>
              <p className="text-on-surface-variant">
                {summary.total} pesanan ({parsed.lineCount} baris produk) dibaca dari file.
                {parsed.skippedRows > 0 && ` ${parsed.skippedRows} baris tidak terbaca dilewati.`}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TILES.map((t) => (
                  <div key={t.key} className={`rounded-lg border px-3 py-2 ${t.tone}`}>
                    <p className="text-xl font-bold font-tnum" data-testid={`count-${t.key}`}>
                      {summary[t.key] ?? 0}
                    </p>
                    <p className="text-xs leading-tight">{t.label}</p>
                  </div>
                ))}
              </div>

              {readyCount > 0 && (
                <p className="text-on-surface">
                  Omzet pesanan baru: <b className="font-tnum">{formatRupiah(readyTotal)}</b>. Status
                  &quot;Selesai&quot; dicatat <b>Dana Dicairkan</b>, lainnya <b>Diproses</b>.
                </p>
              )}

              {completeCount > 0 && (
                <p className="text-on-surface">
                  <b>{completeCount}</b> pesanan yang sudah ada akan ditandai <b>Dana Dicairkan</b> (
                  <span className="font-tnum">{formatRupiah(completeTotal)}</span>). Stoknya tidak dipotong lagi.
                </p>
              )}

              {preview.problems.length > 0 && <ProblemList problems={preview.problems} />}

              {(preview.shortages.length > 0 || autoAdjust) && (
                <ShortageList shortages={preview.shortages} autoAdjust={autoAdjust} onToggle={toggleAdjust} />
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

function ProblemList({ problems }) {
  return (
    <div className="rounded-lg border border-amber-200">
      <div className="px-3 py-2 bg-amber-50 text-amber-900 flex flex-wrap items-center justify-between gap-2 rounded-t-lg">
        <span className="font-semibold">Produk belum terhubung ke stok ({problems.length})</span>
        <Link to="/listings" className="text-xs font-semibold text-primary hover:underline">
          Buka Produk Marketplace →
        </Link>
      </div>
      <p className="px-3 pt-2 text-xs text-on-surface-variant">
        Pesanan berisi produk ini tidak diimpor. Hubungkan dulu ke stok lokal, lalu impor ulang file yang sama.
      </p>
      <ul className="max-h-48 overflow-y-auto custom-scroll divide-y divide-surface-container-high">
        {problems.map((p, i) => (
          <li key={i} className="px-3 py-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-on-surface" title={p.product_name}>
                {p.product_name}
              </p>
              <p className="text-xs text-on-surface-variant">
                {[p.variation_name, p.sku && `SKU ${p.sku}`].filter(Boolean).join(" · ") || "Tanpa variasi"} ·{" "}
                {p.reason === "unmapped" ? "isi paket belum diatur" : "belum ada di Produk Marketplace"}
              </p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-amber-800">{p.orders} pesanan</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShortageList({ shortages, autoAdjust, onToggle }) {
  return (
    <div className="rounded-lg border border-outline-variant">
      <div className="px-3 py-2 bg-surface-container-low font-semibold text-on-surface rounded-t-lg">
        Kebutuhan stok melebihi stok saat ini ({shortages.length} varian)
      </div>
      {shortages.length > 0 && (
        <div className="max-h-48 overflow-y-auto custom-scroll">
          <table className="w-full text-xs">
            <thead className="text-outline uppercase">
              <tr>
                <th className="text-left px-3 py-1.5">Varian</th>
                <th className="text-right px-2 py-1.5">Stok</th>
                <th className="text-right px-2 py-1.5">Butuh</th>
                <th className="text-right px-3 py-1.5">Kurang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {shortages.map((s) => (
                <tr key={s.product_variant_id}>
                  <td className="px-3 py-1.5 text-on-surface">{s.label}</td>
                  <td className="px-2 py-1.5 text-right font-tnum">{s.stock}</td>
                  <td className="px-2 py-1.5 text-right font-tnum">{s.needed}</td>
                  <td className="px-3 py-1.5 text-right font-tnum font-semibold text-error">{s.short}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <label className="flex items-start gap-2 px-3 py-2.5 border-t border-surface-container-high cursor-pointer">
        <input
          type="checkbox"
          checked={autoAdjust}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-0.5 accent-primary"
        />
        <span>
          <span className="font-medium text-on-surface">Tambah stok otomatis sebesar kekurangannya</span>
          <span className="block text-xs text-on-surface-variant">
            Untuk stok yang belum pernah diisi di aplikasi. Tercatat sebagai &quot;Penyesuaian&quot; di Histori Stok.
            Kalau barangnya memang dibeli, lebih baik catat di Pembelian dulu.
          </span>
        </span>
      </label>
    </div>
  );
}

function ResultView({ result }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
        <span className="material-symbols-outlined text-[28px]">task_alt</span>
        <div>
          {result.imported > 0 && (
            <p className="font-semibold" data-testid="imported-count">
              {result.imported} pesanan baru berhasil diimpor
            </p>
          )}
          {result.completed > 0 && (
            <p className="font-semibold" data-testid="completed-count">
              {result.completed} pesanan ditandai selesai (Dana Dicairkan)
            </p>
          )}
          {!result.imported && !result.completed && <p className="font-semibold">Tidak ada pesanan yang diproses</p>}
          {result.imported > 0 && <p className="text-xs">Stok sudah dipotong dan tercatat di Histori Stok.</p>}
        </div>
      </div>

      {result.notImported > 0 && (
        <p className="text-on-surface-variant">
          {result.notImported} pesanan lain tidak diimpor (sudah ada, batal, produk belum terhubung, atau stok
          kurang). Setelah diperbaiki, impor ulang file yang sama — yang sudah ada otomatis dilewati.
        </p>
      )}

      {result.failed.length > 0 && (
        <div className="rounded-lg border border-error/30">
          <p className="px-3 py-2 font-semibold text-on-error-container bg-error-container/50 rounded-t-lg">
            Gagal disimpan ({result.failed.length})
          </p>
          <ul className="max-h-48 overflow-y-auto custom-scroll divide-y divide-surface-container-high">
            {result.failed.map((f) => (
              <li key={f.order_number} className="px-3 py-2">
                <span className="font-tnum font-medium">{f.order_number}</span>
                <span className="text-on-surface-variant"> — {f.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
