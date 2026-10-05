import { useEffect, useMemo, useState } from "react";
import client from "../api/client";
import Modal from "./Modal";
import { buildAutoRecipe, guessCategory } from "../utils/shopeeImport";

const norm = (s) => String(s ?? "").trim().toLowerCase();

const CHUNK_SIZE = 40; // jumlah kelompok per request, supaya tidak timeout

export default function AutoMapModal({ open, marketplace, onClose, onDone }) {
  const [listings, setListings] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [supplierId, setSupplierId] = useState("");
  const [renames, setRenames] = useState({});
  const [filter, setFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !marketplace) return;

    let ignore = false;

    setRenames({});
    setFilter("");
    setError("");
    setProgress({ done: 0, total: 0 });
    setLoading(true);

    Promise.all([
      client.get("/marketplace-listings/unmapped", { params: { marketplace_id: marketplace.id } }),
      client.get("/products", { params: { all: 1 } }),
      client.get("/suppliers", { params: { all: 1 } }),
    ])
      .then(([listingRes, productRes, supplierRes]) => {
        if (ignore) return;

        const supplierRows = supplierRes.data.data ?? supplierRes.data;
        const productRows = productRes.data.data ?? productRes.data;
        const supplierList = Array.isArray(supplierRows) ? supplierRows : [];

        setListings(Array.isArray(listingRes.data) ? listingRes.data : []);
        setProducts(Array.isArray(productRows) ? productRows : []);
        setSuppliers(supplierList);
        setSupplierId(supplierList.length === 1 ? String(supplierList[0].id) : "");
      })
      .catch((err) => {
        if (!ignore) setError(err.response?.data?.message ?? "Gagal memuat data.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [open, marketplace]);

  // Tebakan isi tiap listing
  const drafts = useMemo(
    () =>
      listings.map((listing) => ({
        listing,
        ...buildAutoRecipe(listing.product_name, listing.marketplace_sku),
      })),
    [listings],
  );

  // Daftar nama barang unik hasil tebakan (yang ditinjau user)
  const items = useMemo(() => {
    const map = new Map();

    for (const draft of drafts) {
      for (const item of draft.items) {
        const entry = map.get(item.name) ?? { name: item.name, count: 0 };
        entry.count += 1;
        map.set(item.name, entry);
      }
    }

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [drafts]);

  const finalName = (name) => (renames[name] ?? name).trim();

  const existingNames = useMemo(() => new Set(products.map((p) => norm(p.name))), [products]);

  // Berapa baris yang memakai nama akhir yang sama (untuk penanda "digabung")
  const finalUsage = useMemo(() => {
    const map = new Map();

    for (const item of items) {
      const key = norm(renames[item.name] ?? item.name);
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    return map;
  }, [items, renames]);

  const groupCount = useMemo(
    () => new Set(listings.map((l) => l.external_product_id)).size,
    [listings],
  );

  const flaggedGroups = useMemo(
    () => new Set(drafts.filter((d) => d.notes.length).map((d) => d.listing.external_product_id)).size,
    [drafts],
  );

  const newProductCount = [...finalUsage.keys()].filter((key) => key && !existingNames.has(key)).length;

  const visibleItems = filter.trim()
    ? items.filter(
        (item) =>
          norm(item.name).includes(norm(filter)) || norm(renames[item.name]).includes(norm(filter)),
      )
    : items;

  async function handleApply() {
    setError("");

    if (!supplierId) {
      setError("Pilih supplier untuk produk lokal yang baru dibuat.");
      return;
    }

    const empty = items.find((item) => !finalName(item.name));

    if (empty) {
      setError(`Nama barang untuk "${empty.name}" tidak boleh kosong.`);
      return;
    }

    // Kelompokkan: listing dari produk Shopee yang sama dengan isi resep yang sama -> 1 job
    const jobMap = new Map();

    for (const draft of drafts) {
      const lines = draft.items.map((item) => {
        const name = finalName(item.name);

        return { new_product_name: name, category: guessCategory(name), qty: item.qty };
      });

      const key = `${draft.listing.external_product_id}|${JSON.stringify(lines)}`;
      const job = jobMap.get(key) ?? { listing_ids: [], lines };

      job.listing_ids.push(draft.listing.id);
      jobMap.set(key, job);
    }

    const jobs = [...jobMap.values()];
    const total = drafts.length;

    let done = 0;
    let mapped = 0;
    let skipped = 0;

    setRunning(true);
    setProgress({ done: 0, total });

    try {
      for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
        const chunk = jobs.slice(i, i + CHUNK_SIZE);

        const res = await client.post("/marketplace-listings/auto-map", {
          supplier_id: Number(supplierId),
          jobs: chunk,
        });

        mapped += res.data.mapped ?? 0;
        skipped += res.data.skipped ?? 0;
        done += chunk.reduce((sum, job) => sum + job.listing_ids.length, 0);

        setProgress({ done, total });
      }

      onDone({ mapped, skipped });
    } catch (err) {
      const message = err.response?.data?.message ?? "Gagal menerapkan pemetaan otomatis.";

      setError(
        `${message} ${done} dari ${total} variasi sudah terproses. Jalankan lagi untuk melanjutkan sisanya ` +
          "(yang sudah terpetakan tidak akan diproses ulang).",
      );
    } finally {
      setRunning(false);
    }
  }

  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Modal
      open={open}
      onClose={() => !running && onClose()}
      title="Petakan Otomatis"
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="px-4 py-2 rounded-lg border border-outline-variant text-sm text-on-surface hover:bg-surface-container-low disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={running || loading || drafts.length === 0}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container disabled:opacity-60"
          >
            {running ? `Memproses ${percent}%...` : `Terapkan ke ${drafts.length} variasi`}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="py-10 text-center text-sm text-outline">Menyusun tebakan pemetaan...</div>
      ) : drafts.length === 0 ? (
        <div className="py-10 text-center text-sm text-outline">
          Semua listing sudah dipetakan. Tidak ada yang perlu diproses.
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              ["Produk Shopee", groupCount],
              ["Variasi", drafts.length],
              ["Barang lokal", finalUsage.size],
              ["Produk baru", newProductCount],
            ].map(([label, value]) => (
              <div key={label} className="p-3 rounded-lg bg-surface-container-low">
                <span className="block text-xs text-outline">{label}</span>
                <span className="block text-xl font-bold font-tnum text-on-surface">
                  {Number(value).toLocaleString("id-ID")}
                </span>
              </div>
            ))}
          </div>

          <p className="flex items-start gap-2 px-3 py-2 rounded-lg bg-surface-container-low text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-primary">info</span>
            <span>
              Isi tiap listing ditebak dari judul dan SKU Shopee (misal "3 SETEL" = baju ×3 + celana ×3),
              warna/ukuran dari nama variasi. Semua hasil ditandai <b>Otomatis</b> supaya bisa kamu cek
              belakangan lewat filter "Otomatis (perlu dicek)". {flaggedGroups} produk Shopee punya tebakan
              yang sebaiknya dicek lebih teliti.
            </span>
          </p>

          <label className="block">
            <span className="block text-xs font-medium text-on-surface-variant mb-1">
              Supplier untuk produk lokal baru
            </span>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              disabled={running}
              className="w-full h-9 px-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm cursor-pointer outline-none focus:border-primary"
            >
              <option value="">Pilih supplier...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <span className="block mt-1 text-xs text-outline">
              Bisa diganti per produk nanti di menu Produk. Produk yang namanya sudah ada tidak diubah.
            </span>
          </label>

          <div>
            <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
              <div>
                <h3 className="font-display font-semibold text-on-surface">Tinjau nama barang lokal</h3>
                <p className="text-xs text-outline">
                  Ubah nama di sini berlaku untuk semua listing yang memakainya. Beri nama yang sama ke dua
                  baris untuk menggabungkannya jadi satu barang (stok jadi satu).
                </p>
              </div>

              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Cari nama..."
                className="h-8 w-44 px-2.5 rounded-lg border border-outline-variant text-sm outline-none focus:border-primary"
              />
            </div>

            <div className="max-h-80 overflow-y-auto custom-scroll rounded-lg border border-outline-variant divide-y divide-surface-container-high">
              {visibleItems.map((item) => {
                const final = renames[item.name] ?? item.name;
                const key = norm(final);
                const exists = existingNames.has(key);
                const merged = (finalUsage.get(key) ?? 0) > 1;

                return (
                  <div key={item.name} className="flex items-center gap-2.5 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <input
                        value={final}
                        onChange={(e) =>
                          setRenames((current) => ({ ...current, [item.name]: e.target.value }))
                        }
                        disabled={running}
                        className={`w-full h-8 px-2 rounded-md border text-sm outline-none focus:border-primary ${
                          final.trim() ? "border-outline-variant" : "border-error"
                        }`}
                      />
                      {final !== item.name && (
                        <span className="block mt-0.5 text-[11px] text-outline truncate">
                          Tebakan awal: {item.name}
                        </span>
                      )}
                    </div>

                    <span className="shrink-0 text-xs text-outline font-tnum w-20 text-right">
                      {item.count} variasi
                    </span>

                    <span className="shrink-0 w-24 text-right">
                      {exists ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          sudah ada
                        </span>
                      ) : merged ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                          digabung
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          baru
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}

              {visibleItems.length === 0 && (
                <div className="py-6 text-center text-xs text-outline">Tidak ada nama yang cocok.</div>
              )}
            </div>
          </div>

          {running && (
            <div>
              <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-1 text-xs text-outline font-tnum">
                {progress.done} dari {progress.total} variasi diproses
              </p>
            </div>
          )}

          {error && (
            <p className="px-3 py-2 rounded-lg bg-error-container text-on-error-container">{error}</p>
          )}
        </div>
      )}
    </Modal>
  );
}
