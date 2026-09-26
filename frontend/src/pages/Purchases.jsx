import { useEffect, useState } from 'react';
import client from '../api/client';

function formatRupiah(n) {
  return 'Rp ' + Number(n ?? 0).toLocaleString('id-ID');
}

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/purchases').then((res) => {
      setPurchases(res.data.data ?? res.data);
      setLoading(false);
    });
  }, []);

  return (
    <section className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
      <div className="p-4 border-b border-surface-container-high">
        <h1 className="font-display font-semibold text-lg text-on-surface">Pembelian Supplier</h1>
        <p className="text-sm text-on-surface-variant">Riwayat pembelian stok dari supplier.</p>
      </div>

      <div className="overflow-x-auto custom-scroll">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low/70 border-b border-outline-variant text-xs text-outline uppercase tracking-wider">
              <th className="py-3 px-4">No. Invoice</th>
              <th className="py-3 px-4">Supplier</th>
              <th className="py-3 px-4">Tanggal</th>
              <th className="py-3 px-4">Jumlah Item</th>
              <th className="py-3 px-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-high text-sm">
            {loading && (
              <tr><td colSpan={5} className="py-6 text-center text-outline">Memuat...</td></tr>
            )}
            {!loading && purchases.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-outline">Belum ada pembelian.</td></tr>
            )}
            {purchases.map((p) => (
              <tr key={p.id} className="hover:bg-surface-container-low/40 transition-colors">
                <td className="py-3 px-4 font-tnum font-medium text-on-surface">{p.invoice_number}</td>
                <td className="py-3 px-4 text-on-surface">{p.supplier?.name ?? '-'}</td>
                <td className="py-3 px-4 font-tnum text-on-surface-variant">{p.purchase_date}</td>
                <td className="py-3 px-4 font-tnum">{p.items?.length ?? 0} item</td>
                <td className="py-3 px-4 text-right font-tnum font-semibold text-on-surface">{formatRupiah(p.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
