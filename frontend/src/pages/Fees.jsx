import { useEffect, useState } from "react";
import client from "../api/client";
import FeeFormModal from "../components/FeeFormModal";
import MarketplaceFormModal from "../components/MarketplaceFormModal";
import ConfirmDialog from "../components/ConfirmDialog";

function formatRupiah(n) {
  return `Rp ${Number(n ?? 0).toLocaleString("id-ID")}`;
}

function formatFeeValue(fee) {
  return fee.type === "percentage"
    ? `${Number(fee.value)}%`
    : formatRupiah(fee.value);
}

// Rumus yang sama dengan backend (MarketplaceFeeService)
// function calcFee(fee, revenue) {
//   return fee.type === "percentage"
//     ? (revenue * Number(fee.value)) / 100
//     : Number(fee.value);
// }
function calcFee(fee, revenue) {
  if (fee.type !== "percentage") {
    return Number(fee.value);
  }

  return Math.round(Number(((revenue * Number(fee.value)) / 100).toFixed(6)));
}

function Switch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-outline-variant"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function Fees() {
  const [marketplaces, setMarketplaces] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [marketplaceFormOpen, setMarketplaceFormOpen] = useState(false);
  const [editingMarketplace, setEditingMarketplace] = useState(null);

  const [feeFormOpen, setFeeFormOpen] = useState(false);
  const [editingFee, setEditingFee] = useState(null);

  const [toDelete, setToDelete] = useState(null); // { kind: "fee" | "marketplace", item }
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [simulation, setSimulation] = useState("100000");
  const [busyKey, setBusyKey] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setLoadError("");

    client
      .get("/marketplaces")
      .then((res) => {
        if (ignore) return;

        const rows = res.data.data ?? res.data;
        const list = Array.isArray(rows) ? rows : [];

        setMarketplaces(list);

        // Pertahankan marketplace yang sedang dipilih; kalau sudah tidak ada, pilih yang pertama
        setSelectedId((current) =>
          list.some((m) => m.id === current) ? current : (list[0]?.id ?? null),
        );
      })
      .catch(() => {
        if (!ignore) {
          setLoadError(
            "Gagal memuat data marketplace. Pastikan backend sedang berjalan.",
          );
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  // Toast hilang otomatis
  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(null), 3000);

    return () => clearTimeout(timer);
  }, [toast]);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  const selected = marketplaces.find((m) => m.id === selectedId) ?? null;
  const fees = selected?.fees ?? [];

  // Simulasi potongan dari contoh omzet
  const revenue = Number(simulation || 0);
  const simulated = fees
    .filter((fee) => fee.is_active)
    .map((fee) => ({ fee, amount: calcFee(fee, revenue) }));
  const totalFee = simulated.reduce((total, row) => total + row.amount, 0);
  const effectiveRate = revenue > 0 ? (totalFee / revenue) * 100 : 0;

  function openCreateMarketplace() {
    setEditingMarketplace(null);
    setMarketplaceFormOpen(true);
  }

  function openEditMarketplace(marketplace) {
    setEditingMarketplace(marketplace);
    setMarketplaceFormOpen(true);
  }

  function handleMarketplaceSaved(saved, isEdit) {
    setMarketplaceFormOpen(false);
    setSelectedId(saved.id);

    setToast({
      text: isEdit
        ? `Marketplace "${saved.name}" berhasil diperbarui`
        : `Marketplace "${saved.name}" berhasil ditambahkan`,
    });

    reload();
  }

  function openCreateFee() {
    setEditingFee(null);
    setFeeFormOpen(true);
  }

  function openEditFee(fee) {
    setEditingFee(fee);
    setFeeFormOpen(true);
  }

  function handleFeeSaved(saved, isEdit) {
    setFeeFormOpen(false);

    setToast({
      text: isEdit
        ? `Biaya "${saved.name}" berhasil diperbarui`
        : `Biaya "${saved.name}" berhasil ditambahkan`,
    });

    reload();
  }

  async function toggleFee(fee) {
    setBusyKey(`fee-${fee.id}`);

    try {
      await client.put(`/fees/${fee.id}`, {
        name: fee.name,
        type: fee.type,
        value: Number(fee.value),
        is_active: !fee.is_active,
      });

      reload();
    } catch (err) {
      setToast({
        text: err.response?.data?.message ?? "Gagal mengubah status biaya.",
        error: true,
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleMarketplace(marketplace) {
    setBusyKey(`marketplace-${marketplace.id}`);

    try {
      await client.put(`/marketplaces/${marketplace.id}`, {
        name: marketplace.name,
        code: marketplace.code,
        is_active: !marketplace.is_active,
      });

      reload();
    } catch (err) {
      setToast({
        text:
          err.response?.data?.message ?? "Gagal mengubah status marketplace.",
        error: true,
      });
    } finally {
      setBusyKey(null);
    }
  }

  function askDelete(kind, item) {
    setDeleteError("");
    setToDelete({ kind, item });
  }

  async function confirmDelete() {
    if (!toDelete) return;

    setDeleting(true);
    setDeleteError("");

    const { kind, item } = toDelete;

    try {
      await client.delete(
        kind === "fee" ? `/fees/${item.id}` : `/marketplaces/${item.id}`,
      );

      setToDelete(null);

      setToast({
        text:
          kind === "fee"
            ? `Biaya "${item.name}" dihapus`
            : `Marketplace "${item.name}" dihapus`,
      });

      reload();
    } catch (err) {
      setDeleteError(err.response?.data?.message ?? "Gagal menghapus data.");
    } finally {
      setDeleting(false);
    }
  }

  const deleteMessage = toDelete
    ? toDelete.kind === "fee"
      ? `Hapus biaya "${toDelete.item.name}" dari ${selected?.name}? Penjualan yang sudah tercatat tidak terpengaruh.`
      : `Hapus marketplace "${toDelete.item.name}" beserta ${
          toDelete.item.fees?.length ?? 0
        } biayanya? Tindakan ini tidak bisa dibatalkan.`
    : "";

  return (
    <>
      <section className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-container-high flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-semibold text-lg text-on-surface">
              Fee Marketplace
            </h1>

            <p className="text-sm text-on-surface-variant">
              Atur biaya potongan tiap marketplace. Biaya aktif dihitung
              otomatis saat membuat penjualan.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateMarketplace}
            title="Tambah Marketplace"
            aria-label="Tambah Marketplace"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>

            <span className="hidden sm:inline">Tambah Marketplace</span>
          </button>
        </div>

        {loadError && (
          <p className="mx-4 mt-4 px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {loadError}
          </p>
        )}

        {loading && marketplaces.length === 0 ? (
          <div className="py-10 text-center text-sm text-outline">
            Memuat...
          </div>
        ) : marketplaces.length === 0 ? (
          <div className="py-10 px-4 text-center text-sm text-outline">
            Belum ada marketplace. Klik tombol tambah untuk memulai.
          </div>
        ) : (
          <>
            {/* Pilih marketplace */}
            <div className="px-4 pt-4 flex gap-2 overflow-x-auto custom-scroll pb-1">
              {marketplaces.map((marketplace) => {
                const active = marketplace.id === selectedId;

                return (
                  <button
                    key={marketplace.id}
                    type="button"
                    onClick={() => setSelectedId(marketplace.id)}
                    className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                      active
                        ? "bg-primary text-on-primary border-primary"
                        : "bg-surface-container-lowest text-on-surface border-outline-variant hover:bg-surface-container-low"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        marketplace.is_active ? "bg-emerald-400" : "bg-outline"
                      }`}
                    />

                    {marketplace.name}

                    <span
                      className={`text-xs font-normal ${
                        active ? "text-on-primary/80" : "text-outline"
                      }`}
                    >
                      {marketplace.fees?.length ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className="p-4 space-y-5">
                {/* Info marketplace terpilih */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display font-semibold text-lg text-on-surface">
                        {selected.name}
                      </h2>

                      <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-surface-container text-on-surface-variant">
                        {selected.code}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          selected.is_active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-surface-container text-on-surface-variant border-transparent"
                        }`}
                      >
                        {selected.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>

                    <p className="text-xs text-outline mt-1">
                      {selected.sales_count ?? 0} penjualan tercatat
                      {!selected.is_active &&
                        " • tidak muncul di form penjualan"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={Boolean(selected.is_active)}
                      onChange={() => toggleMarketplace(selected)}
                      disabled={busyKey === `marketplace-${selected.id}`}
                      label={
                        selected.is_active
                          ? "Nonaktifkan marketplace"
                          : "Aktifkan marketplace"
                      }
                    />

                    <button
                      type="button"
                      onClick={() => openEditMarketplace(selected)}
                      title="Edit marketplace"
                      className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        edit
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => askDelete("marketplace", selected)}
                      title="Hapus marketplace"
                      className="p-1.5 rounded-lg text-on-surface-variant hover:bg-error-container/40 hover:text-error transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete
                      </span>
                    </button>
                  </div>
                </div>

                <p className="flex items-start gap-2 px-3 py-2 rounded-lg bg-surface-container-low text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] text-primary">
                    info
                  </span>
                  Perubahan fee hanya berlaku untuk penjualan baru. Penjualan
                  yang sudah tercatat tetap memakai fee saat transaksi dibuat.
                </p>

                {/* Daftar biaya */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-display font-semibold text-base text-on-surface">
                        Biaya {selected.name}
                      </h3>

                      <p className="text-xs text-outline mt-0.5">
                        {fees.length} biaya terdaftar
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={openCreateFee}
                      title="Tambah Biaya"
                      aria-label="Tambah Biaya"
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold transition-all active:scale-[0.98]"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        add
                      </span>

                      <span className="hidden sm:inline">Tambah Biaya</span>
                    </button>
                  </div>

                  <div className="border border-outline-variant rounded-xl overflow-hidden">
                    <div className="overflow-x-auto custom-scroll">
                      <table className="w-full min-w-[560px] text-left border-collapse">
                        <thead>
                          <tr className="bg-surface-container-low/70 border-b border-outline-variant text-xs text-outline uppercase tracking-wider">
                            <th className="py-3 px-4">Nama Biaya</th>
                            <th className="py-3 px-4">Tipe</th>
                            <th className="py-3 px-4 text-right">Nilai</th>
                            <th className="py-3 px-4 text-center">Aktif</th>
                            <th className="py-3 px-4 text-center">Aksi</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-surface-container-high text-sm">
                          {fees.length === 0 && (
                            <tr>
                              <td
                                colSpan={5}
                                className="py-6 text-center text-outline"
                              >
                                Belum ada biaya untuk marketplace ini. Klik
                                tombol tambah untuk memulai.
                              </td>
                            </tr>
                          )}

                          {fees.map((fee) => (
                            <tr
                              key={fee.id}
                              className="hover:bg-surface-container-low/40 transition-colors"
                            >
                              <td
                                className={`py-3 px-4 font-medium ${
                                  fee.is_active
                                    ? "text-on-surface"
                                    : "text-outline"
                                }`}
                              >
                                {fee.name}
                              </td>

                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-container text-on-surface-variant">
                                  {fee.type === "percentage"
                                    ? "Persentase"
                                    : "Tetap"}
                                </span>
                              </td>

                              <td
                                className={`py-3 px-4 text-right font-tnum font-semibold ${
                                  fee.is_active
                                    ? "text-amber-700"
                                    : "text-outline"
                                }`}
                              >
                                {formatFeeValue(fee)}
                              </td>

                              <td className="py-3 px-4">
                                <div className="flex justify-center">
                                  <Switch
                                    checked={Boolean(fee.is_active)}
                                    onChange={() => toggleFee(fee)}
                                    disabled={busyKey === `fee-${fee.id}`}
                                    label={
                                      fee.is_active
                                        ? "Nonaktifkan biaya"
                                        : "Aktifkan biaya"
                                    }
                                  />
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditFee(fee)}
                                    title="Edit"
                                    className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">
                                      edit
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => askDelete("fee", fee)}
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
                  </div>
                </div>

                {/* Simulasi */}
                <div className="rounded-xl bg-surface-container-low p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display font-semibold text-base text-on-surface">
                        Simulasi Potongan
                      </h3>

                      <p className="text-xs text-outline mt-0.5">
                        Hitung total potongan dari contoh omzet (hanya biaya
                        aktif).
                      </p>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                      Omzet
                      <span className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-outline">
                          Rp
                        </span>

                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={simulation}
                          onChange={(e) => setSimulation(e.target.value)}
                          className="h-9 w-40 pl-9 pr-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </span>
                    </label>
                  </div>

                  {simulated.length === 0 ? (
                    <p className="text-sm text-outline">
                      Belum ada biaya aktif untuk disimulasikan.
                    </p>
                  ) : (
                    <div className="space-y-1.5 text-sm">
                      {simulated.map(({ fee, amount }) => (
                        <div
                          key={fee.id}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="text-on-surface-variant">
                            {fee.name}{" "}
                            <span className="text-outline">
                              ({formatFeeValue(fee)})
                            </span>
                          </span>

                          <span className="font-tnum text-amber-700">
                            {formatRupiah(amount)}
                          </span>
                        </div>
                      ))}

                      <div className="flex items-center justify-between gap-3 border-t border-outline-variant pt-2 font-semibold">
                        <span className="text-on-surface">
                          Total potongan
                          {revenue > 0 && (
                            <span className="ml-1.5 font-normal text-outline">
                              ({effectiveRate.toFixed(1)}% dari omzet)
                            </span>
                          )}
                        </span>

                        <span className="font-tnum text-amber-700">
                          {formatRupiah(totalFee)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3 font-semibold text-emerald-800">
                        <span>Diterima penjual (sebelum modal)</span>

                        <span className="font-tnum">
                          {formatRupiah(revenue - totalFee)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <MarketplaceFormModal
        open={marketplaceFormOpen}
        marketplace={editingMarketplace}
        onClose={() => setMarketplaceFormOpen(false)}
        onSaved={handleMarketplaceSaved}
      />

      <FeeFormModal
        open={feeFormOpen}
        marketplace={selected}
        fee={editingFee}
        onClose={() => setFeeFormOpen(false)}
        onSaved={handleFeeSaved}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={toDelete?.kind === "fee" ? "Hapus Biaya" : "Hapus Marketplace"}
        message={deleteMessage}
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
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
