import { useEffect, useState } from 'react';
import client from '../api/client';

const TYPE_LABEL = {
  purchase_in: { label: 'Pembelian Masuk', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  sale_out: { label: 'Penjualan Keluar', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  sale_cancel_in: { label: 'Pembatalan (Masuk)', color: 'bg-secondary-container text-on-secondary-container border-transparent' },
  adjustment: { label: 'Penyesuaian', color: 'bg-surface-container text-on-surface-variant border-transparent' },
};

export default function StockHistory() {
  const [histories, setHistories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/stock-histories').then((res) => {
      setHistories(res.data.data ?? res.data);
      setLoading(false);
    });
  }, []);

  return (
    <section className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
      <div className="p-4 border-b border-surface-container-high">
        <h1 className="font-display font-semibold text-lg text-on-surface">Histori Stok</h1>
        <p className="text-sm text-on-surface-variant">Jejak audit setiap pergerakan stok produk.</p>
      </div>

      <div className="overflow-x-auto custom-scroll">
        <table className="w-full text-left border-collapse">
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
              <tr><td colSpan={6} className="py-6 text-center text-outline">Memuat...</td></tr>
            )}
            {!loading && histories.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-outline">Belum ada histori stok.</td></tr>
            )}
            {histories.map((h) => {
              const type = TYPE_LABEL[h.type] ?? { label: h.type, color: 'bg-surface-container text-on-surface-variant border-transparent' };
              return (
                <tr key={h.id} className="hover:bg-surface-container-low/40 transition-colors">
                  <td className="py-3 px-4 font-tnum text-on-surface-variant">
                    {new Date(h.created_at).toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 font-medium text-on-surface">{h.product?.name ?? '-'}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${type.color}`}>
                      {type.label}
                    </span>
                  </td>
                  <td className={`py-3 px-4 text-right font-tnum font-semibold ${h.qty < 0 ? 'text-error' : 'text-emerald-700'}`}>
                    {h.qty > 0 ? `+${h.qty}` : h.qty}
                  </td>
                  <td className="py-3 px-4 text-right font-tnum text-on-surface-variant">{h.stock_before}</td>
                  <td className="py-3 px-4 text-right font-tnum font-semibold text-on-surface">{h.stock_after}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
