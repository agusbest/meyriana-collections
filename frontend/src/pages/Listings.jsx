import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import ListingMappingModal from "../components/ListingMappingModal";

function formatRupiah(n) {
  return `Rp ${Number(n ?? 0).toLocaleString("id-ID")}`;
}

function componentLabel(component) {
  const v = component.product_variant ?? component.productVariant;
  const opt = [v?.color, v?.size].filter(Boolean).join(" / ");

  return `${v?.product?.name ?? "Barang"}${opt ? ` (${opt})` : ""} ×${component.qty}`;
}

export default function Listings() {
  const [marketplaces, setMarketplaces] = useState([]);
  const [marketplaceId, setMarketplaceId] = useState("");

  const [groups, setGroups] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
  const [stats, setStats] = useState({ total: 0, mapped: 0, unmapped: 0, auto: 0 });

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState({ search: "", status: "", page: 1 });
  const [reloadKey, setReloadKey] = useState(0);

  const [editingGroup, setEditingGroup] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    client
      .get("/marketplaces")
      .then((res) => {
        const rows = res.data.data ?? res.data;
        const list = Array.isArray(rows) ? rows : [];

        setMarketplaces(list);

        const shopee = list.find((m) => m.code === "shopee") ?? list[0];
        if (shopee) setMarketplaceId(String(shopee.id));
      })
      .catch(() => setLoadError("Gagal memuat data marketplace."));
  }, []);

  useEffect(() => {
    if (!marketplaceId) return;

    let ignore = false;

    setLoading(true);
    setLoadError("");

    const params = { marketplace_id: marketplaceId, page: query.page };
    if (query.search) params.search = query.search;
    if (query.status) params.status = query.status;

    client
      .get("/marketplace-listings", { params })
      .then((res) => {
        if (ignore) return;

        const body = res.data;

        setGroups(body.data ?? []);
        setStats(body.stats ?? { total: 0, mapped: 0, unmapped: 0, auto: 0 });
        setMeta({
          current_page: body.current_page ?? 1,
          last_page: body.last_page ?? 1,
          total: body.total ?? 0,
          from: body.from ?? 0,
          to: body.to ?? 0,
        });
      })
      .catch(() => {
        if (!ignore) setLoadError("Gagal memuat data. Pastikan backend sedang berjalan.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [marketplaceId, query, reloadKey]);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(null), 3500);

    return () => clearTimeout(timer);
  }, [toast]);

  const marketplace = marketplaces.find((m) => String(m.id) === String(marketplaceId));
  const importLink = `/listings/import${marketplaceId ? `?marketplace_id=${marketplaceId}` : ""}`;

  function handleSearch(e) {
    e.preventDefault();
    setQuery((q) => ({ ...q, search: searchInput.trim(), page: 1 }));
  }

  function handleSaved(message) {
    setEditingGroup(null);
    setToast(message);
    setReloadKey((k) => k + 1);
  }

  return (
    <>
      <section className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-container-high flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 basis-80">
            <h1 className="font-display font-semibold text-lg text-on-surface">Produk Marketplace</h1>
            <p className="text-sm text-on-surface-variant">
              Daftar produk yang dijual di marketplace dan isinya di gudang. Setiap pesanan akan mengurangi stok
              barang sesuai isinya.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {marketplaces.length > 1 && (
              <select
                value={marketplaceId}
                onChange={(e) => {
                  setMarketplaceId(e.target.value);
                  setQuery((q) => ({ ...q, page: 1 }));
                }}
                className="h-9 px-3 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest cursor-pointer outline-none focus:border-primary"
              >
                {marketplaces.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}

            <Link
              to={importLink}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              Impor Produk
            </Link>
          </div>
        </div>

        {/* Ringkasan */}
        <div className="px-4 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            ["", "Semua variasi", stats.total, "text-on-surface"],
            ["mapped", "Sudah terhubung", stats.mapped, "text-emerald-700"],
            ["unmapped", "Belum terhubung", stats.unmapped, "text-amber-700"],
            ["auto", "Perlu dicek", stats.auto ?? 0, "text-sky-700"],
          ].map(([status, label, value, color]) => (
            <button
              key={label}
              type="button"
              onClick={() => setQuery((q) => ({ ...q, status, page: 1 }))}
              className={`text-left p-3 rounded-lg border transition-colors ${
                query.status === status ? "border-primary bg-primary/5" : "border-outline-variant hover:bg-surface-container-low"
              }`}
            >
              <span className="block text-xs text-outline">{label}</span>
              <span className={`block text-xl font-bold font-tnum ${color}`}>
                {Number(value).toLocaleString("id-ID")}
              </span>
            </button>
          ))}
        </div>

        {stats.unmapped > 0 && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-sm flex flex-wrap items-center justify-between gap-2">
            <span>
              {Number(stats.unmapped).toLocaleString("id-ID")} variasi belum terhubung ke barang gudang, jadi
              pesanannya belum bisa mengurangi stok.
            </span>
            <Link to={importLink} className="font-semibold hover:underline">
              Atur sekarang
            </Link>
          </div>
        )}

        <form onSubmit={handleSearch} className="px-4 pt-3 relative">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari nama produk, variasi, atau SKU..."
            className="h-9 pl-9 pr-3 w-full rounded-lg border border-outline-variant text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          />
          <span className="material-symbols-outlined text-[18px] text-outline absolute left-6.5 top-5">search</span>
        </form>

        {loadError && (
          <p className="mx-4 mt-4 px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">{loadError}</p>
        )}

        <div className="mt-3 divide-y divide-surface-container-high border-t border-surface-container-high">
          {loading && <div className="py-8 text-center text-sm text-outline">Memuat...</div>}

          {!loading && !loadError && groups.length === 0 && (
            <div className="py-10 px-4 text-center text-sm text-outline">
              {stats.total === 0
                ? `Belum ada produk ${marketplace?.name ?? ""}. Klik "Impor Produk" untuk mulai.`
                : "Tidak ada yang cocok dengan filter."}
            </div>
          )}

          {!loading &&
            groups.map((group) => {
              const linked = group.listings.filter((l) => l.components?.length).length;
              const allLinked = linked === group.listings.length;

              return (
                <div key={group.external_product_id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-on-surface leading-snug line-clamp-2">{group.product_name}</p>
                      <p className="text-xs text-outline mt-1">
                        {group.listings.length} variasi •{" "}
                        <span className={allLinked ? "text-emerald-700" : "text-amber-700"}>
                          {linked}/{group.listings.length} terhubung
                        </span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditingGroup(group)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-sm font-semibold text-on-surface hover:bg-surface-container-low"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                      {allLinked ? "Ubah isi" : "Atur isi"}
                    </button>
                  </div>

                  <div className="mt-3 overflow-x-auto custom-scroll rounded-lg border border-outline-variant">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-surface-container-low/70 text-xs text-outline uppercase tracking-wider">
                        <tr>
                          <th className="py-2 px-3">Variasi</th>
                          <th className="py-2 px-3">SKU</th>
                          <th className="py-2 px-3 text-right">Harga</th>
                          <th className="py-2 px-3">Isi 1 paket (barang gudang)</th>
                          <th className="py-2 px-3 text-right">Stok siap jual</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container-high">
                        {group.listings.map((listing) => (
                          <tr key={listing.id}>
                            <td className="py-2 px-3 font-medium text-on-surface">{listing.variation_name || "-"}</td>
                            <td className="py-2 px-3 text-on-surface-variant">{listing.marketplace_sku || "-"}</td>
                            <td className="py-2 px-3 text-right font-tnum">{formatRupiah(listing.price)}</td>
                            <td className="py-2 px-3">
                              {listing.components?.length ? (
                                <span className="text-on-surface-variant">
                                  {listing.components.map(componentLabel).join(" + ")}
                                  {listing.mapping_source === "auto" && (
                                    <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                                      perlu dicek
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  Belum terhubung
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-tnum font-semibold">
                              {listing.available_stock === null || listing.available_stock === undefined ? (
                                <span className="text-outline">-</span>
                              ) : (
                                <span className={listing.available_stock === 0 ? "text-error" : "text-on-surface"}>
                                  {listing.available_stock}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
        </div>

        <div className="px-4 py-3 border-t border-surface-container-high flex flex-wrap items-center justify-between gap-2 text-sm text-on-surface-variant">
          <span>{meta.total === 0 ? "Tidak ada data" : `Produk ${meta.from}–${meta.to} dari ${meta.total}`}</span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || meta.current_page <= 1}
              onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}
              className="px-3 py-1 rounded-lg border border-outline-variant hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Sebelumnya
            </button>
            <span className="font-tnum">
              {meta.current_page} / {meta.last_page}
            </span>
            <button
              type="button"
              disabled={loading || meta.current_page >= meta.last_page}
              onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}
              className="px-3 py-1 rounded-lg border border-outline-variant hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </section>

      <ListingMappingModal
        open={Boolean(editingGroup)}
        group={editingGroup}
        onClose={() => setEditingGroup(null)}
        onSaved={handleSaved}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[80] px-4 py-2.5 rounded-lg bg-inverse-surface text-inverse-on-surface text-sm shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
