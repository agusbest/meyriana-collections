import { useEffect, useState } from "react";
import client from "../api/client";
import PurchaseFormModal from "../components/PurchaseFormModal";
import PurchaseDetailModal from "../components/PurchaseDetailModal";
import ActionButtons from "../components/ActionButtons";

function formatRupiah(n) {
  return "Rp " + Number(n ?? 0).toLocaleString("id-ID");
}

// function formatDate(date) {
//   if (!date) return "-";

//   return new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
//     day: "2-digit",
//     month: "short",
//     year: "numeric",
//   });
// }
const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [viewing, setViewing] = useState(null);

  async function loadPurchases() {
    setLoading(true);
    setError("");

    try {
      const res = await client.get("/purchases");

      setPurchases(res.data.data ?? res.data);
    } catch (err) {
      setError(err.response?.data?.message ?? "Gagal memuat data pembelian.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPurchases();
  }, []);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(purchase) {
    setEditing(purchase);
    setFormOpen(true);
  }

  async function openView(purchase) {
    try {
      const res = await client.get(`/purchases/${purchase.id}`);

      setViewing(res.data);
    } catch (err) {
      alert(err.response?.data?.message ?? "Gagal memuat detail pembelian.");
    }
  }

  async function handleDelete(purchase) {
    const confirmed = window.confirm(
      `Hapus pembelian ${purchase.invoice_number}?\n\nStok dari pembelian ini juga akan dikurangi kembali.`,
    );

    if (!confirmed) return;

    try {
      await client.delete(`/purchases/${purchase.id}`);

      await loadPurchases();
    } catch (err) {
      alert(err.response?.data?.message ?? "Pembelian tidak dapat dihapus.");
    }
  }

  async function handleSaved() {
    setFormOpen(false);
    setEditing(null);

    await loadPurchases();
  }

  return (
    <>
      <section className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-container-high flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-semibold text-lg text-on-surface">
              Pembelian Supplier
            </h1>

            <p className="text-sm text-on-surface-variant">
              Kelola pembelian stok dari supplier.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            title="Tambah Pembelian"
            aria-label="Tambah Pembelian"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors"
          >
            <span className="material-symbols-outlined text-[19px]">add</span>
            <span className="hidden sm:inline">Tambah Pembelian</span>
          </button>
        </div>

        {error && (
          <div className="m-4 px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {error}
          </div>
        )}

        <div className="overflow-x-auto custom-scroll">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/70 border-b border-outline-variant text-xs text-outline uppercase tracking-wider">
                <th className="py-3 px-4">No. Invoice</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4 text-center">Jumlah Item</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-2 text-center w-px whitespace-nowrap">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-surface-container-high text-sm">
              {loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-outline">
                    Memuat...
                  </td>
                </tr>
              )}

              {!loading && purchases.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-outline">
                    Belum ada pembelian.
                  </td>
                </tr>
              )}

              {!loading &&
                purchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    className="hover:bg-surface-container-low/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-tnum font-medium text-on-surface">
                      {purchase.invoice_number}
                    </td>

                    <td className="py-3 px-4 text-on-surface">
                      {purchase.supplier?.name ?? "-"}
                    </td>

                    <td className="py-3 px-4 font-tnum text-on-surface-variant">
                      {formatDate(purchase.purchase_date)}
                    </td>
                    {/* <td className="py-3 px-4 font-tnum text-on-surface-variant">
                      {JSON.stringify(purchase.purchase_date)}
                    </td> */}

                    <td className="py-3 px-4 text-center font-tnum">
                      {purchase.items?.length ?? 0}
                    </td>

                    <td className="py-3 px-4 text-right font-tnum font-semibold text-on-surface">
                      {formatRupiah(purchase.total_amount)}
                    </td>

                    {/* <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openView(purchase)}
                          className="p-2 rounded-lg text-primary hover:bg-primary-container/40 transition-colors"
                          title="Lihat detail"
                        >
                          <span className="material-symbols-outlined text-[19px]">
                            visibility
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openEdit(purchase)}
                          className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-[19px]">
                            edit
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(purchase)}
                          className="p-2 rounded-lg text-error hover:bg-error-container/40 transition-colors"
                          title="Hapus"
                        >
                          <span className="material-symbols-outlined text-[19px]">
                            delete
                          </span>
                        </button>
                      </div>
                    </td> */}
                    <td className="py-3 px-2 w-px whitespace-nowrap">
                      <ActionButtons
                        onView={() => openView(purchase)}
                        onEdit={() => openEdit(purchase)}
                        onDelete={() => handleDelete(purchase)}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <PurchaseFormModal
        open={formOpen}
        purchase={editing}
        onClose={() => {
          if (!loading) {
            setFormOpen(false);
            setEditing(null);
          }
        }}
        onSaved={handleSaved}
      />

      <PurchaseDetailModal
        open={Boolean(viewing)}
        purchase={viewing}
        onClose={() => setViewing(null)}
      />
    </>
  );
}
