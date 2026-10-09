import Modal from "./Modal";

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
    month: "long",
    year: "numeric",
  });
}

const STATUS_LABEL = {
  pending: "Diproses",
  completed: "Dana Dicairkan",
  cancelled: "Dibatalkan",
  returned: "Retur",
};

export default function SaleDetailModal({ open, sale, onClose }) {
  if (!sale) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Detail Penjualan"
      size="lg"
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-outline">No. Pesanan</p>
            <p className="font-semibold text-on-surface mt-1 break-all">
              {sale.order_number}
            </p>
          </div>

          <div>
            <p className="text-xs text-outline">Marketplace</p>
            <p className="font-semibold text-on-surface mt-1">
              {sale.marketplace?.name ?? "-"}
            </p>
          </div>

          <div>
            <p className="text-xs text-outline">Tanggal</p>
            <p className="font-semibold text-on-surface mt-1">
              {formatDate(sale.sale_date)}
            </p>
          </div>

          <div>
            <p className="text-xs text-outline">Status</p>
            <p className="font-semibold text-on-surface mt-1">
              {STATUS_LABEL[sale.status] ?? sale.status}
            </p>
          </div>
        </div>

        <div className="border border-outline-variant rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface-container-low">
                <tr className="text-xs uppercase tracking-wider text-outline">
                  <th className="px-4 py-3 text-left">Produk</th>
                  <th className="px-4 py-3 text-left">Variasi</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Harga Jual</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">Modal</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-surface-container-high">
                {(sale.items ?? []).map((item) => {
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
                        {formatRupiah(item.selling_price)}
                      </td>

                      <td className="px-4 py-3 text-right font-tnum font-semibold">
                        {formatRupiah(item.subtotal)}
                      </td>

                      <td className="px-4 py-3 text-right font-tnum text-on-surface-variant">
                        {formatRupiah(item.cost_total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {(sale.fees ?? []).length > 0 && (
          <div>
            <h3 className="font-display font-semibold text-sm text-on-surface mb-2">
              Rincian Fee Marketplace
            </h3>

            <div className="border border-outline-variant rounded-xl divide-y divide-surface-container-high">
              {sale.fees.map((fee) => (
                <div
                  key={fee.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <div>
                    <p className="text-on-surface">{fee.name}</p>

                    <p className="text-xs text-outline">
                      {fee.type === "percentage"
                        ? `${Number(fee.value)}% dari omzet`
                        : "Biaya tetap"}
                    </p>
                  </div>

                  <span className="font-tnum text-amber-700">
                    {formatRupiah(fee.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl bg-surface-container-low p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant">Omzet</span>
            <span className="font-tnum font-medium">
              {formatRupiah(sale.total_sales)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant">Modal (HPP)</span>
            <span className="font-tnum">- {formatRupiah(sale.total_cost)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant">Fee marketplace</span>
            <span className="font-tnum text-amber-700">
              - {formatRupiah(sale.marketplace_fee)}
            </span>
          </div>

          {Number(sale.other_fee) > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">Biaya lain</span>
              <span className="font-tnum">
                - {formatRupiah(sale.other_fee)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-outline-variant pt-2">
            <span className="font-semibold text-on-surface">Profit</span>
            <span
              className={`text-lg font-bold font-tnum ${
                Number(sale.profit) < 0 ? "text-error" : "text-emerald-800"
              }`}
            >
              {formatRupiah(sale.profit)}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
