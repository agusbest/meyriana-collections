import { useEffect, useState } from 'react';
import client from '../api/client';

function formatRupiah(n) {
  return 'Rp ' + Number(n ?? 0).toLocaleString('id-ID');
}

const STATUS_STYLE = {
  pending: { label: 'Diproses', icon: 'autorenew', color: 'bg-surface-container-high text-on-secondary-container' },
  completed: { label: 'Dana Dicairkan', icon: 'check_circle', color: 'bg-emerald-50 text-emerald-800 border border-emerald-200' },
  cancelled: { label: 'Dibatalkan', icon: 'cancel', color: 'bg-error-container text-on-error-container' },
};

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    client.get('/sales').then((res) => {
      setSales(res.data.data ?? res.data);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  async function handleComplete(id) {
    setBusyId(id);
    await client.post(`/sales/${id}/complete`);
    await load();
    setBusyId(null);
  }

  async function handleCancel(id) {
    setBusyId(id);
    await client.post(`/sales/${id}/cancel`);
    await load();
    setBusyId(null);
  }

  return (
    <section className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
      <div className="p-4 border-b border-surface-container-high">
        <h1 className="font-display font-semibold text-lg text-on-surface">Penjualan Marketplace</h1>
        <p className="text-sm text-on-surface-variant">Kalkulasi profit riil per transaksi setelah potongan fee marketplace.</p>
      </div>

      <div className="overflow-x-auto custom-scroll">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low/70 border-b border-outline-variant text-xs text-outline uppercase tracking-wider">
              <th className="py-3 px-4">No. Pesanan</th>
              <th className="py-3 px-4">Marketplace</th>
              <th className="py-3 px-4 text-right">Omzet</th>
              <th className="py-3 px-4 text-right">Modal</th>
              <th className="py-3 px-4 text-right">Fee</th>
              <th className="py-3 px-4 text-right">Profit</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-high text-sm">
            {loading && (
              <tr><td colSpan={8} className="py-6 text-center text-outline">Memuat...</td></tr>
            )}
            {!loading && sales.length === 0 && (
              <tr><td colSpan={8} className="py-6 text-center text-outline">Belum ada transaksi penjualan.</td></tr>
            )}
            {sales.map((s) => {
              const status = STATUS_STYLE[s.status] ?? STATUS_STYLE.pending;
              return (
                <tr key={s.id} className="hover:bg-surface-container-low/40 transition-colors">
                  <td className="py-3 px-4 font-tnum font-medium text-on-surface">{s.order_number}</td>
                  <td className="py-3 px-4 text-on-surface">{s.marketplace?.name ?? '-'}</td>
                  <td className="py-3 px-4 text-right font-tnum text-on-surface">{formatRupiah(s.total_sales)}</td>
                  <td className="py-3 px-4 text-right font-tnum text-on-surface-variant">{formatRupiah(s.total_cost)}</td>
                  <td className="py-3 px-4 text-right font-tnum text-amber-700">{formatRupiah(s.marketplace_fee)}</td>
                  <td className="py-3 px-4 text-right font-tnum font-bold text-emerald-800">{formatRupiah(s.profit)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.color}`}>
                      <span className="material-symbols-outlined text-[13px]">{status.icon}</span>
                      {status.label}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {s.status === 'pending' && (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          disabled={busyId === s.id}
                          onClick={() => handleComplete(s.id)}
                          className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container disabled:opacity-50"
                        >
                          Selesaikan
                        </button>
                        <button
                          disabled={busyId === s.id}
                          onClick={() => handleCancel(s.id)}
                          className="px-2.5 py-1 rounded-lg border border-error text-error text-xs font-semibold hover:bg-error-container/20 disabled:opacity-50"
                        >
                          Batalkan
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
