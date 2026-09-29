import Modal from "./Modal";

function formatRupiah(n) {
  return `Rp ${Number(n ?? 0).toLocaleString("id-ID")}`;
}

function formatDate(date) {
  if (!date) return "-";

  return new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function PurchaseDetailModal({ open, purchase, onClose }) {
  if (!purchase) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Detail Pembelian"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-outline-variant text-sm text-on-surface hover:bg-surface-container-low"
        >
          Tutup
        </button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-outline">No. Invoice</p>
            <p className="font-semibold text-on-surface mt-1">
              {purchase.invoice_number}
            </p>
          </div>

          <div>
            <p className="text-xs text-outline">Supplier</p>
            <p className="font-semibold text-on-surface mt-1">
              {purchase.supplier?.name ?? "-"}
            </p>
          </div>

          <div>
            <p className="text-xs text-outline">Tanggal</p>
            <p className="font-semibold text-on-surface mt-1">
              {formatDate(purchase.purchase_date)}
            </p>
          </div>
        </div>

        <div className="border border-outline-variant rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead className="bg-surface-container-low">
                <tr className="text-xs uppercase tracking-wider text-outline">
                  <th className="px-4 py-3 text-left">Produk</th>
                  <th className="px-4 py-3 text-left">Variant</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Harga</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-surface-container-high">
                {(purchase.items ?? []).map((item) => {
                  const variant = item.product_variant ?? item.productVariant;

                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium">
                        {variant?.product?.name ?? "-"}
                      </td>

                      <td className="px-4 py-3 text-on-surface-variant">
                        {variant?.color || "-"}
                        {" / "}
                        {variant?.size || "-"}
                      </td>

                      <td className="px-4 py-3 text-right font-tnum">
                        {item.qty}
                      </td>

                      <td className="px-4 py-3 text-right font-tnum">
                        {formatRupiah(item.price)}
                      </td>

                      <td className="px-4 py-3 text-right font-tnum font-semibold">
                        {formatRupiah(item.subtotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="text-right">
            <p className="text-xs text-outline">Total Pembelian</p>

            <p className="text-xl font-bold font-tnum">
              {formatRupiah(purchase.total_amount)}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
