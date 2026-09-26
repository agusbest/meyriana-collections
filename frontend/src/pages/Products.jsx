import { useEffect, useState } from 'react';
import client from '../api/client';

function formatRupiah(n) {
  return 'Rp ' + Number(n ?? 0).toLocaleString('id-ID');
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  function load(params = {}) {
    setLoading(true);
    client.get('/products', { params }).then((res) => {
      setProducts(res.data.data ?? res.data);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  function handleSearch(e) {
    e.preventDefault();
    load({ search });
  }

  return (
    <section className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
      <div className="p-4 border-b border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-semibold text-lg text-on-surface">Produk</h1>
          <p className="text-sm text-on-surface-variant">Daftar SKU, harga jual, dan stok saat ini.</p>
        </div>
        <form onSubmit={handleSearch} className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau SKU..."
            className="h-9 pl-9 pr-3 rounded-lg border border-outline-variant text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none w-64"
          />
          <span className="material-symbols-outlined text-[18px] text-outline absolute left-2.5 top-2">search</span>
        </form>
      </div>

      <div className="overflow-x-auto custom-scroll">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low/70 border-b border-outline-variant text-xs text-outline uppercase tracking-wider">
              <th className="py-3 px-4">SKU</th>
              <th className="py-3 px-4">Nama Produk</th>
              <th className="py-3 px-4">Kategori</th>
              <th className="py-3 px-4 text-right">Modal (HPP)</th>
              <th className="py-3 px-4 text-right">Harga Jual</th>
              <th className="py-3 px-4 text-right">Stok</th>
              <th className="py-3 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-high text-sm">
            {loading && (
              <tr><td colSpan={7} className="py-6 text-center text-outline">Memuat...</td></tr>
            )}
            {!loading && products.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-outline">Belum ada produk.</td></tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-surface-container-low/40 transition-colors">
                <td className="py-3 px-4 font-tnum text-on-surface">{p.sku}</td>
                <td className="py-3 px-4 font-medium text-on-surface">{p.name}</td>
                <td className="py-3 px-4 text-on-surface-variant">{p.category ?? '-'}</td>
                <td className="py-3 px-4 text-right font-tnum text-on-surface-variant">{formatRupiah(p.purchase_price)}</td>
                <td className="py-3 px-4 text-right font-tnum font-medium text-on-surface">{formatRupiah(p.selling_price)}</td>
                <td className="py-3 px-4 text-right font-tnum">{p.stock}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                    p.is_active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-surface-container text-on-surface-variant border-transparent'
                  }`}>
                    {p.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
