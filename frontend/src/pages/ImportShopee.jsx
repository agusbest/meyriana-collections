import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import client from "../api/client";
import {
  readShopeeFile,
  buildAutoRecipe,
  guessCategory,
  listingVariant,
  colorForItem,
  colorFromSku,
} from "../utils/shopeeImport";

const STEPS = ["Upload file", "Barang gudang", "Isi paket", "Simpan"];

// Format file per marketplace. Tambahkan pembaca baru di sini saat contoh file tersedia.
const READERS = {
  shopee: readShopeeFile,
};

const GUIDES = {
  shopee: [
    "Buka Shopee Seller Centre, masuk ke menu produk.",
    "Pilih fitur ubah/update massal, lalu download file Info Penjualan.",
    "File yang benar berisi kolom Kode Produk, Kode Variasi, SKU, Harga, Stok.",
  ],
};
const CHUNK = 40; // jumlah kelompok per kiriman, supaya tidak timeout
const ITEMS_PER_PAGE = 50;
const GROUPS_PER_PAGE = 20;

const norm = (s) => String(s ?? "").trim().toLowerCase();
const uid = (prefix) => prefix + Math.random().toString(36).slice(2, 10);
const draftKey = (marketplaceId) => `simpro-impor-v4-${marketplaceId}`;

function variantLabel(v) {
  return [v.color, v.size].filter(Boolean).join(" / ") || "tanpa warna/ukuran";
}

// Gaya dasar TANPA lebar: lebar ditentukan di tiap pemakaian (w-full, w-20, w-auto, ...)
const fieldBase =
  "h-9 px-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const inputClass = `${fieldBase} w-full`;

function formatNumber(n) {
  return Number(n ?? 0).toLocaleString("id-ID");
}

// Susun barang gudang + kelompok produk Shopee dari listing yang belum terhubung
export function buildModel(listings, products) {
  const itemsByName = new Map();
  const items = [];

  function ensureItem(name) {
    const key = norm(name);

    if (itemsByName.has(key)) return itemsByName.get(key).id;

    const existing = products.find((p) => norm(p.name) === key);
    const hpp = existing?.variants?.find((v) => Number(v.purchase_price) > 0)?.purchase_price;

    const item = {
      id: uid("b"),
      name: existing?.name ?? name,
      supplierId: existing?.supplier_id ? String(existing.supplier_id) : "",
      hpp: hpp ? String(Number(hpp)) : "",
      existing: Boolean(existing),
    };

    itemsByName.set(key, item);
    items.push(item);

    return item.id;
  }

  const groupMap = new Map();

  for (const listing of listings) {
    const recipe = buildAutoRecipe(listing.product_name, listing.marketplace_sku, listing.variation_name);
    const lines = recipe.items.map((it) => ({ id: uid("l"), itemId: ensureItem(it.name), qty: it.qty }));
    const signature = `${listing.external_product_id}|${lines.map((l) => `${l.itemId}:${l.qty}`).join(",")}`;

    let group = groupMap.get(signature);

    if (!group) {
      group = {
        id: uid("g"),
        productName: listing.product_name,
        listingIds: [],
        variations: [],
        variants: [],
        skus: [],
        lines,
        notes: [],
        reviewed: false,
        skipped: false,
      };
      groupMap.set(signature, group);
    }

    group.listingIds.push(listing.id);
    group.variations.push(listing.variation_name || "Tanpa variasi");

    const parsed = listingVariant(listing.variation_name, listing.product_name);
    const variationText = String(listing.variation_name ?? "").trim();

    // Warna/ukuran per variasi: hasil tebakan, bisa diubah pengguna sebelum disimpan
    group.variants.push({
      id: listing.id,
      name: variationText || "Tanpa variasi",
      sku: listing.marketplace_sku ?? "",
      color: parsed.color,
      size: parsed.size,
      skuColor: parsed.color ? null : colorFromSku(listing.marketplace_sku),
      hasVariation: variationText !== "" && variationText !== "-",
      edited: false,
    });
    if (listing.marketplace_sku && group.skus.length < 3) group.skus.push(listing.marketplace_sku);

    for (const note of recipe.notes) {
      if (!group.notes.includes(note)) group.notes.push(note);
    }
  }

  const groups = [...groupMap.values()].sort((a, b) => a.productName.localeCompare(b.productName, "id"));

  // Variasi tanpa warna ikut masuk daftar "Perlu dicek"
  for (const group of groups) {
    if (group.variants.some((v) => v.hasVariation && !v.color)) group.notes.push("ada variasi tanpa warna");
  }

  return { items, groups };
}

// Kiriman ke backend: barang digabung berdasarkan nama (nama sama = 1 barang, stok jadi satu)
export function buildPayload(usedItems, activeGroups) {
  const itemById = new Map(usedItems.map((it) => [it.id, it]));
  const merged = new Map();

  for (const it of usedItems) {
    const key = norm(it.name);
    const current = merged.get(key);

    if (!current) {
      merged.set(key, {
        key,
        name: it.name.trim(),
        supplier_id: Number(it.supplierId),
        category: guessCategory(it.name),
        purchase_price: it.hpp === "" ? null : Number(it.hpp),
      });
    } else if (current.purchase_price === null && it.hpp !== "") {
      current.purchase_price = Number(it.hpp);
    }
  }

  const jobs = activeGroups.map((g) => ({
    listing_ids: g.listingIds,
    reviewed: g.reviewed || !g.notes.length,
    // dipakai backend apa adanya (termasuk kosong yang disengaja)
    variants: (g.variants ?? []).map((v) => ({
      listing_id: v.id,
      color: String(v.color ?? "").trim() || null,
      size: String(v.size ?? "").trim() || null,
    })),
    lines: g.lines.map((l) => ({ item: norm(itemById.get(l.itemId)?.name), qty: Number(l.qty) })),
  }));

  return { merged, jobs };
}

// Nilai yang paling sering dipakai, untuk saran isian (mencegah "Autum" vs "Autumn" jadi dua warna)
function topValues(values, limit = 150) {
  const counts = new Map();

  for (const raw of values) {
    const v = String(raw ?? "").trim();
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([v]) => v);
}

// Tabel isian warna & ukuran per variasi, dengan pengisian massal
function VariantEditor({ group, onChange, onApplyAll, onFillFromSku }) {
  const [bulk, setBulk] = useState({ color: "", size: "" });
  const withSuggestion = group.variants.filter((v) => !v.color && v.skuColor).length;
  const canApply = bulk.color.trim() !== "" || bulk.size.trim() !== "";

  return (
    <div className="mt-2 space-y-2 text-sm">
      <div className="flex flex-wrap items-end gap-2 p-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest">
        <label className="block">
          <span className="block text-[11px] text-outline mb-0.5">Warna untuk semua variasi</span>
          <input
            list="warna-umum"
            value={bulk.color}
            onChange={(e) => setBulk((b) => ({ ...b, color: e.target.value }))}
            placeholder="mis. Autumn"
            maxLength={100}
            className={`${fieldBase} w-40`}
          />
        </label>
        <label className="block">
          <span className="block text-[11px] text-outline mb-0.5">Ukuran untuk semua variasi</span>
          <input
            list="ukuran-umum"
            value={bulk.size}
            onChange={(e) => setBulk((b) => ({ ...b, size: e.target.value }))}
            placeholder="mis. 0-3 Bulan"
            maxLength={100}
            className={`${fieldBase} w-40`}
          />
        </label>
        <button
          type="button"
          disabled={!canApply}
          onClick={() =>
            onApplyAll({
              ...(bulk.color.trim() ? { color: bulk.color.trim() } : {}),
              ...(bulk.size.trim() ? { size: bulk.size.trim() } : {}),
            })
          }
          className="px-3 py-2 rounded-lg border border-primary text-primary font-semibold hover:bg-primary/5 disabled:opacity-40"
        >
          Terapkan ke semua
        </button>
        {withSuggestion > 0 && (
          <button
            type="button"
            onClick={onFillFromSku}
            title="Warna diambil dari SKU penjual. Ini tebakan, jadi periksa hasilnya."
            className="px-3 py-2 rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container-low"
          >
            Isi yang kosong dari SKU ({withSuggestion})
          </button>
        )}
      </div>

      <div className="max-h-72 overflow-y-auto custom-scroll rounded-lg border border-outline-variant">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="bg-surface-container-low text-outline uppercase tracking-wider sticky top-0">
            <tr>
              <th className="py-2 px-2">Variasi di marketplace</th>
              <th className="py-2 px-2">Warna</th>
              <th className="py-2 px-2">Ukuran</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-high bg-surface-container-lowest">
            {group.variants.map((v) => (
              <tr key={v.id}>
                <td className="py-1.5 px-2 align-top text-on-surface-variant">
                  {v.name}
                  {v.sku && <span className="block text-[11px] text-outline">SKU: {v.sku}</span>}
                </td>
                <td className="py-1.5 px-2 align-top">
                  <input
                    list="warna-umum"
                    aria-label={`Warna untuk ${v.name}`}
                    value={v.color ?? ""}
                    onChange={(e) => onChange(v.id, { color: e.target.value })}
                    placeholder="tanpa warna"
                    maxLength={100}
                    className={`${fieldBase} w-full ${v.edited ? "border-emerald-400" : ""}`}
                  />
                  {!v.color && v.skuColor && (
                    <button
                      type="button"
                      onClick={() => onChange(v.id, { color: v.skuColor })}
                      className="mt-0.5 text-[11px] text-primary hover:underline"
                    >
                      Saran dari SKU: {v.skuColor}
                    </button>
                  )}
                </td>
                <td className="py-1.5 px-2 align-top">
                  <input
                    list="ukuran-umum"
                    aria-label={`Ukuran untuk ${v.name}`}
                    value={v.size ?? ""}
                    onChange={(e) => onChange(v.id, { size: e.target.value })}
                    placeholder="tanpa ukuran"
                    maxLength={100}
                    className={`${fieldBase} w-full ${v.edited ? "border-emerald-400" : ""}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-outline">
        Kosongkan kalau barangnya memang tidak punya warna/ukuran. Warna dan ukuran yang sama dihitung satu stok,
        jadi samakan penulisannya (mis. "Autumn", bukan "Autum").
      </p>
    </div>
  );
}

// Pratinjau warna/ukuran per kartu + tombol untuk mengubahnya
function VariantPanel({ g, itemById, open, onToggle, onChange, onApplyAll, onFillFromSku }) {
  const distinct = new Set(g.variants.map((v) => `${norm(v.color)}|${norm(v.size)}`)).size;
  const emptyCount = g.variants.filter((v) => v.hasVariation && !v.color).length;

  return (
    <div className="mt-2 rounded-lg bg-surface-container-low/60 px-3 py-2 text-xs space-y-0.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-on-surface-variant">
          Warna/ukuran barang yang akan dibuat (ukuran dari nama variasi, atau usia di judul):
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-primary text-primary font-semibold hover:bg-primary/5"
        >
          <span className="material-symbols-outlined text-[16px]">{open ? "expand_less" : "edit"}</span>
          {open ? "Tutup" : "Ubah warna/ukuran"}
        </button>
      </div>

      {!open && (
        <>
          {g.variants.slice(0, 4).map((v) => {
            // label per barang: "Singlet" tidak dipasang ke celana, jadi bisa berbeda antar barang
            const perItem = g.lines.map((l) => {
              const name = itemById.get(l.itemId)?.name ?? "";
              return { name, label: variantLabel({ color: colorForItem(name, v.color), size: v.size }) };
            });
            const same = perItem.every((p) => p.label === perItem[0]?.label);

            return (
              <div key={v.id}>
                <span className="text-on-surface-variant">{v.name}</span>
                <span className="text-outline"> → </span>
                {same ? (
                  <b className="text-on-surface">{variantLabel(v)}</b>
                ) : (
                  perItem.map((p, i) => (
                    <span key={`${p.name}-${i}`}>
                      {i > 0 && <span className="text-outline"> • </span>}
                      <span className="text-on-surface-variant">{p.name || "Barang"}:</span>{" "}
                      <b className="text-on-surface">{p.label}</b>
                    </span>
                  ))
                )}
                {v.edited && <span className="ml-1 text-[10px] text-emerald-700">(diubah)</span>}
              </div>
            );
          })}

          {g.variants.length > 4 && (
            <div className="text-outline">+{g.variants.length - 4} variasi lainnya dengan pola serupa</div>
          )}

          {emptyCount > 0 && (
            <div className="text-amber-700">
              {emptyCount} variasi belum punya warna. Klik "Ubah warna/ukuran" kalau perlu diisi.
            </div>
          )}

          {g.variants.length > 1 && distinct === 1 && (
            <div className="text-emerald-700">
              Semua variasi ini memakai satu stok yang sama, hanya jumlah per paketnya yang berbeda.
            </div>
          )}
        </>
      )}

      {open && <VariantEditor group={g} onChange={onChange} onApplyAll={onApplyAll} onFillFromSku={onFillFromSku} />}
    </div>
  );
}

function Stepper({ step }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;

        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                done
                  ? "bg-primary text-on-primary"
                  : active
                    ? "bg-primary/10 text-primary border border-primary"
                    : "bg-surface-container text-outline"
              }`}
            >
              {done ? <span className="material-symbols-outlined text-[16px]">check</span> : n}
            </span>
            <span className={active ? "font-semibold text-on-surface" : "text-on-surface-variant"}>
              {label}
            </span>
            {n < STEPS.length && <span className="hidden sm:inline text-outline mx-1">—</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Pager({ page, pages, onChange }) {
  if (pages <= 1) return null;

  return (
    <div className="flex items-center justify-end gap-2 text-sm text-on-surface-variant">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="px-3 py-1 rounded-lg border border-outline-variant hover:bg-surface-container-low disabled:opacity-40"
      >
        Sebelumnya
      </button>
      <span className="font-tnum">
        {page} / {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        className="px-3 py-1 rounded-lg border border-outline-variant hover:bg-surface-container-low disabled:opacity-40"
      >
        Berikutnya
      </button>
    </div>
  );
}

export default function ImportShopee() {
  const fileRef = useRef(null);
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [marketplaces, setMarketplaces] = useState([]);
  const [marketplaceId, setMarketplaceId] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);

  const [parsed, setParsed] = useState(null);
  const [draft, setDraft] = useState(null);

  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [defaultSupplier, setDefaultSupplier] = useState("");

  const [itemFilter, setItemFilter] = useState({ text: "", type: "all", page: 1 });
  const [groupFilter, setGroupFilter] = useState({ type: "check", page: 1 });
  // Kartu yang ditampilkan di tab "Perlu dicek". Ditetapkan saat tab dibuka, supaya kartu yang baru
  // ditandai tetap terlihat (dengan tanda hijau) dan tidak langsung menghilang.
  const [checkIds, setCheckIds] = useState(() => new Set());
  const [openEditors, setOpenEditors] = useState(() => new Set()); // kartu yang tabel warna/ukurannya terbuka

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);

  // Data awal: marketplace (default Shopee), supplier, produk yang sudah ada
  useEffect(() => {
    Promise.all([
      client.get("/marketplaces"),
      client.get("/suppliers", { params: { all: 1 } }),
      client.get("/products", { params: { all: 1 } }),
    ])
      .then(([mpRes, supRes, prodRes]) => {
        const mps = mpRes.data.data ?? mpRes.data;
        const sups = supRes.data.data ?? supRes.data;
        const prods = prodRes.data.data ?? prodRes.data;

        setMarketplaces(Array.isArray(mps) ? mps : []);
        setSuppliers(Array.isArray(sups) ? sups : []);
        setProducts(Array.isArray(prods) ? prods : []);

        const list = Array.isArray(mps) ? mps : [];
        const fromLink = list.find((m) => String(m.id) === searchParams.get("marketplace_id"));
        const initial = fromLink ?? list.find((m) => m.code === "shopee") ?? list[0];
        if (initial) setMarketplaceId(String(initial.id));
        if (Array.isArray(sups) && sups.length === 1) setDefaultSupplier(String(sups[0].id));
      })
      .catch(() => setError("Gagal memuat data awal. Pastikan backend sedang berjalan."));
  }, []);

  // Cek draf tersimpan untuk marketplace ini
  useEffect(() => {
    if (!marketplaceId) return;

    try {
      const raw = localStorage.getItem(draftKey(marketplaceId));
      setDraft(raw ? JSON.parse(raw) : null);
    } catch {
      setDraft(null);
    }
  }, [marketplaceId]);

  // Simpan draf otomatis selama langkah 2 & 3 (jeda 0,5 detik setelah berhenti mengetik)
  useEffect(() => {
    if (!marketplaceId || step < 2 || step > 3 || !groups.length) return;

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey(marketplaceId),
          JSON.stringify({ savedAt: new Date().toISOString(), items, groups, defaultSupplier }),
        );
      } catch {
        // penyimpanan browser penuh / dimatikan: lanjut tanpa draf
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [marketplaceId, step, items, groups, defaultSupplier]);

  // ---------- turunan ----------
  const marketplace = marketplaces.find((m) => String(m.id) === String(marketplaceId));
  const mpName = marketplace?.name ?? "marketplace";
  const supported = Boolean(READERS[marketplace?.code]);
  const supportedNames = Object.keys(READERS)
    .map((code) => marketplaces.find((m) => m.code === code)?.name ?? code)
    .join(", ");

  const itemById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);

  // Berapa variasi Shopee yang memakai tiap barang (produk yang dilewati tidak dihitung)
  const usage = useMemo(() => {
    const map = new Map();

    for (const g of groups) {
      if (g.skipped) continue;
      for (const line of g.lines) {
        map.set(line.itemId, (map.get(line.itemId) ?? 0) + g.listingIds.length);
      }
    }

    return map;
  }, [groups]);

  const usedItems = useMemo(() => items.filter((it) => usage.has(it.id)), [items, usage]);

  const nameCount = useMemo(() => {
    const map = new Map();
    for (const it of usedItems) map.set(norm(it.name), (map.get(norm(it.name)) ?? 0) + 1);
    return map;
  }, [usedItems]);

  const commonColors = useMemo(() => topValues(groups.flatMap((g) => g.variants ?? []).map((v) => v.color)), [groups]);
  const commonSizes = useMemo(() => topValues(groups.flatMap((g) => g.variants ?? []).map((v) => v.size)), [groups]);

  const missingSupplier = usedItems.filter((it) => !it.supplierId).length;
  const missingHpp = usedItems.filter((it) => it.hpp === "").length;
  const activeGroups = groups.filter((g) => !g.skipped);
  const needsCheck = (g) => !g.skipped && g.notes.length > 0 && !g.reviewed;
  const checkGroups = groups.filter(needsCheck);
  const checkTotal = groups.filter((g) => !g.skipped && g.notes.length > 0).length;
  const checkDone = checkTotal - checkGroups.length;

  function refreshCheckList() {
    setCheckIds(new Set(groups.filter(needsCheck).map((g) => g.id)));
  }

  // ---------- langkah 1 ----------
  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError("");
    setInfo("");

    try {
      const reader = READERS[marketplace?.code];

      if (!reader) {
        setError(`Format file ${marketplace?.name ?? "marketplace ini"} belum didukung.`);
        return;
      }

      const data = await reader(file);

      if (!data.listings.length) {
        setError("File tidak berisi data produk.");
        return;
      }

      setParsed({ fileName: file.name, ...data });
    } catch (err) {
      setError(err.message || "File tidak bisa dibaca.");
    }
  }

  async function startFromFile() {
    setBusy(true);
    setError("");

    try {
      await client.post("/marketplace-listings/import", {
        marketplace_id: Number(marketplaceId),
        deactivate_missing: false,
        rows: parsed.listings,
      });

      const res = await client.get("/marketplace-listings/unmapped", {
        params: { marketplace_id: marketplaceId },
      });

      const listings = Array.isArray(res.data) ? res.data : [];

      if (!listings.length) {
        setInfo("Semua produk di file ini sudah terhubung ke barang gudang. Tidak ada yang perlu diatur lagi.");
        return;
      }

      const model = buildModel(listings, products);

      setItems(model.items);
      setGroups(model.groups);
      setItemFilter({ text: "", type: "all", page: 1 });
      setGroupFilter({ type: "check", page: 1 });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message ?? "Gagal membaca data dari server. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  function continueDraft() {
    setItems(draft.items ?? []);
    setGroups(draft.groups ?? []);
    setDefaultSupplier(draft.defaultSupplier ?? "");
    setStep(2);
  }

  function discardDraft() {
    try {
      localStorage.removeItem(draftKey(marketplaceId));
    } catch {
      // abaikan
    }
    setDraft(null);
  }

  // ---------- langkah 2 ----------
  const updateItem = (id, patch) =>
    setItems((current) => current.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  function fillDefaultSupplier() {
    if (!defaultSupplier) {
      setError("Pilih supplier dulu di kotak sebelah tombol.");
      return;
    }

    setError("");
    setItems((current) => current.map((it) => (it.supplierId ? it : { ...it, supplierId: defaultSupplier })));
  }

  const filteredItems = usedItems.filter((it) => {
    if (itemFilter.type === "supplier" && it.supplierId) return false;
    if (itemFilter.type === "hpp" && it.hpp !== "") return false;
    if (itemFilter.text && !norm(it.name).includes(norm(itemFilter.text))) return false;
    return true;
  });

  const itemPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const itemPage = Math.min(itemFilter.page, itemPages);
  const pagedItems = filteredItems.slice((itemPage - 1) * ITEMS_PER_PAGE, itemPage * ITEMS_PER_PAGE);

  function nextFromItems() {
    const emptyName = usedItems.find((it) => !it.name.trim());

    if (emptyName) {
      setError("Ada nama barang yang kosong. Isi dulu namanya.");
      return;
    }

    if (missingSupplier) {
      setError(`${missingSupplier} barang belum dipilih suppliernya. Gunakan tombol "Isi ke semua" supaya cepat.`);
      setItemFilter((f) => ({ ...f, type: "supplier", page: 1 }));
      return;
    }

    setError("");
    refreshCheckList();
    setGroupFilter({ type: checkGroups.length ? "check" : "all", page: 1 });
    setStep(3);
  }

  // ---------- langkah 3 ----------
  const updateGroup = (id, patch) =>
    setGroups((current) => current.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  const updateLine = (groupId, lineId, patch) =>
    setGroups((current) =>
      current.map((g) =>
        g.id === groupId
          ? { ...g, reviewed: true, lines: g.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }
          : g,
      ),
    );

  // Warna/ukuran per variasi. Mengubahnya juga otomatis menandai kartu sebagai sudah dicek.
  const updateVariant = (groupId, listingId, patch) =>
    setGroups((current) =>
      current.map((g) =>
        g.id === groupId
          ? {
              ...g,
              reviewed: true,
              variants: g.variants.map((v) => (v.id === listingId ? { ...v, ...patch, edited: true } : v)),
            }
          : g,
      ),
    );

  const applyToAllVariants = (groupId, patch) =>
    setGroups((current) =>
      current.map((g) =>
        g.id === groupId
          ? { ...g, reviewed: true, variants: g.variants.map((v) => ({ ...v, ...patch, edited: true })) }
          : g,
      ),
    );

  const fillEmptyColorsFromSku = (groupId) =>
    setGroups((current) =>
      current.map((g) =>
        g.id === groupId
          ? {
              ...g,
              reviewed: true,
              variants: g.variants.map((v) => (!v.color && v.skuColor ? { ...v, color: v.skuColor, edited: true } : v)),
            }
          : g,
      ),
    );

  function toggleEditor(id) {
    setOpenEditors((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Nama barang diketik: cocokkan ke barang yang ada; kalau tidak ada, buat barang baru saat kolom ditinggalkan
  function commitLineName(groupId, line) {
    const text = (line.text ?? "").trim();

    if (line.text === undefined) return;

    if (!text) {
      updateLine(groupId, line.id, { text: undefined });
      return;
    }

    const found = items.find((it) => norm(it.name) === norm(text));

    if (found) {
      updateLine(groupId, line.id, { itemId: found.id, text: undefined });
      return;
    }

    const existing = products.find((p) => norm(p.name) === norm(text));
    const newItem = {
      id: uid("b"),
      name: existing?.name ?? text,
      supplierId: existing?.supplier_id ? String(existing.supplier_id) : defaultSupplier,
      hpp: "",
      existing: Boolean(existing),
    };

    setItems((current) => [...current, newItem]);
    updateLine(groupId, line.id, { itemId: newItem.id, text: undefined });
  }

  const filteredGroups = groups.filter((g) => {
    if (groupFilter.type === "check") return checkIds.size ? checkIds.has(g.id) : needsCheck(g);
    if (groupFilter.type === "skipped") return g.skipped;
    return true;
  });

  const groupPages = Math.max(1, Math.ceil(filteredGroups.length / GROUPS_PER_PAGE));
  const groupPage = Math.min(groupFilter.page, groupPages);
  const pagedGroups = filteredGroups.slice((groupPage - 1) * GROUPS_PER_PAGE, groupPage * GROUPS_PER_PAGE);

  function nextFromGroups() {
    const broken = activeGroups.find((g) => !g.lines.length || g.lines.some((l) => !l.itemId || !(Number(l.qty) >= 1)));

    if (broken) {
      setError(`Isi paket "${broken.productName.slice(0, 60)}..." belum lengkap (barang kosong atau jumlah kurang dari 1).`);
      return;
    }

    const noSupplier = usedItems.filter((it) => !it.supplierId);

    if (noSupplier.length) {
      setError(`Barang baru "${noSupplier[0].name}" belum punya supplier. Kembali ke langkah 2 untuk memilihnya.`);
      return;
    }

    if (!activeGroups.length) {
      setError("Semua produk dilewati. Tidak ada yang disimpan.");
      return;
    }

    setError("");
    setStep(4);
  }

  // ---------- langkah 4 ----------
  async function saveAll() {
    setBusy(true);
    setError("");

    const { merged, jobs } = buildPayload(usedItems, activeGroups);

    const total = jobs.reduce((sum, j) => sum + j.listing_ids.length, 0);
    let done = 0;
    let mapped = 0;
    let skipped = 0;

    setProgress({ done: 0, total });

    try {
      for (let i = 0; i < jobs.length; i += CHUNK) {
        const chunk = jobs.slice(i, i + CHUNK);
        const keys = new Set(chunk.flatMap((j) => j.lines.map((l) => l.item)));

        const res = await client.post("/marketplace-listings/setup", {
          items: [...keys].map((k) => merged.get(k)),
          jobs: chunk,
        });

        mapped += res.data.mapped ?? 0;
        skipped += res.data.skipped ?? 0;
        done += chunk.reduce((sum, j) => sum + j.listing_ids.length, 0);
        setProgress({ done, total });
      }

      try {
        localStorage.removeItem(draftKey(marketplaceId));
      } catch {
        // abaikan
      }

      setResult({ mapped, skipped, items: merged.size, later: groups.filter((g) => g.skipped).length });
    } catch (err) {
      const message = err.response?.data?.message ?? "Gagal menyimpan.";
      setError(
        `${message} ${done} dari ${total} variasi sudah tersimpan. Klik "Simpan Semua" lagi untuk melanjutkan sisanya.`,
      );
    } finally {
      setBusy(false);
    }
  }

  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  // ================= RENDER =================
  return (
    <section className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm">
      <div className="p-4 sm:p-5 border-b border-surface-container-high space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display font-semibold text-lg text-on-surface">Impor Produk dari Marketplace</h1>
            <p className="text-sm text-on-surface-variant">
              Buat data barang gudang otomatis dari file ekspor marketplace, tanpa input satu per satu.
            </p>
          </div>
          <Link to="/listings" className="text-sm text-primary hover:underline">
            Kembali ke daftar
          </Link>
        </div>

        <Stepper step={result ? 5 : step} />
      </div>

      <div className="p-4 sm:p-5 space-y-4 text-sm">
        {error && (
          <p className="px-3 py-2 rounded-lg bg-error-container text-on-error-container">{error}</p>
        )}

        {/* ================= LANGKAH 1 ================= */}
        {step === 1 && (
          <>
            {draft && (
              <div className="p-4 rounded-xl border border-primary/40 bg-primary/5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-on-surface">Ada pekerjaan yang belum selesai</p>
                  <p className="text-xs text-on-surface-variant">
                    Tersimpan {new Date(draft.savedAt).toLocaleString("id-ID")} •{" "}
                    {formatNumber(draft.groups?.length)} produk {mpName}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={discardDraft}
                    className="px-3 py-2 rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container-low"
                  >
                    Mulai baru
                  </button>
                  <button
                    type="button"
                    onClick={continueDraft}
                    className="px-3 py-2 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary-container"
                  >
                    Lanjutkan
                  </button>
                </div>
              </div>
            )}

            <label className="flex flex-wrap items-center gap-2.5">
              <span className="font-medium text-on-surface">Marketplace:</span>
              <select
                value={marketplaceId}
                onChange={(e) => {
                  setMarketplaceId(e.target.value);
                  setParsed(null);
                  setError("");
                  setInfo("");
                }}
                disabled={busy}
                className={`${fieldBase} w-auto min-w-[180px] cursor-pointer`}
              >
                {marketplaces.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            {supported ? (
              <div className="rounded-xl bg-surface-container-low p-4 space-y-2">
                <p className="font-semibold text-on-surface">Cara mendapatkan file dari {mpName}</p>
                <ol className="list-decimal list-inside space-y-1 text-on-surface-variant">
                  {(GUIDES[marketplace?.code] ?? []).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="rounded-xl p-4 bg-amber-50 text-amber-800 border border-amber-200 space-y-1">
                <p className="font-semibold">Format file {mpName} belum didukung</p>
                <p>
                  Saat ini yang bisa dibaca baru file dari {supportedNames}. Kirim contoh file ekspor produk dari{" "}
                  {mpName} ke pengembang supaya formatnya bisa ditambahkan.
                </p>
              </div>
            )}

            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={!marketplaceId || busy || !supported}
              className="w-full py-10 rounded-xl border-2 border-dashed border-outline-variant hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[40px] text-primary">upload_file</span>
              <span className="font-semibold text-on-surface">
                {parsed ? "Ganti file" : `Pilih file Excel dari ${mpName}`}
              </span>
              <span className="text-xs text-outline">Format .xlsx</span>
            </button>

            {parsed && (
              <div className="p-4 rounded-xl border border-outline-variant space-y-3">
                <p className="text-on-surface-variant break-all">
                  <span className="material-symbols-outlined text-[16px] align-middle text-emerald-600">
                    check_circle
                  </span>{" "}
                  {parsed.fileName}
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-lg bg-surface-container-low">
                    <span className="block text-xs text-outline">Produk {mpName}</span>
                    <span className="block text-xl font-bold font-tnum">{formatNumber(parsed.productCount)}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-container-low">
                    <span className="block text-xs text-outline">Variasi (warna/ukuran)</span>
                    <span className="block text-xl font-bold font-tnum">{formatNumber(parsed.listings.length)}</span>
                  </div>
                </div>
                <p className="text-xs text-outline">
                  Data akan dibaca untuk {marketplace?.name ?? "marketplace"}. Stok di gudang tidak berubah
                  pada proses ini.
                </p>
              </div>
            )}

            {info && (
              <div className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex flex-wrap items-center justify-between gap-2">
                <span>{info}</span>
                <Link to="/listings" className="font-semibold hover:underline">
                  Lihat daftar
                </Link>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={startFromFile}
                disabled={!parsed || busy}
                className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary-container disabled:opacity-50"
              >
                {busy ? "Membaca..." : "Lanjut"}
              </button>
            </div>
          </>
        )}

        {/* ================= LANGKAH 2 ================= */}
        {step === 2 && (
          <>
            <div>
              <h2 className="font-display font-semibold text-base text-on-surface">
                Cek daftar barang di gudang
              </h2>
              <p className="text-on-surface-variant">
                Sistem menemukan <b>{formatNumber(usedItems.length)} barang</b> dari judul produk {mpName}. Pastikan
                nama, supplier, dan HPP (harga modal per potong) sudah benar. Barang dengan nama sama otomatis
                jadi satu stok.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                ["all", "Semua barang", usedItems.length, "text-on-surface"],
                ["supplier", "Belum ada supplier", missingSupplier, missingSupplier ? "text-error" : "text-emerald-700"],
                ["hpp", "HPP masih kosong", missingHpp, missingHpp ? "text-amber-700" : "text-emerald-700"],
              ].map(([type, label, value, color]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setItemFilter((f) => ({ ...f, type, page: 1 }))}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    itemFilter.type === type ? "border-primary bg-primary/5" : "border-outline-variant hover:bg-surface-container-low"
                  }`}
                >
                  <span className="block text-xs text-outline">{label}</span>
                  <span className={`block text-xl font-bold font-tnum ${color}`}>{formatNumber(value)}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-lg bg-surface-container-low">
              <span className="text-on-surface-variant">Supplier cepat:</span>
              <select
                value={defaultSupplier}
                onChange={(e) => setDefaultSupplier(e.target.value)}
                className={`${fieldBase} w-auto min-w-[180px] cursor-pointer`}
              >
                <option value="">Pilih supplier...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={fillDefaultSupplier}
                className="px-3 py-2 rounded-lg border border-primary text-primary font-semibold hover:bg-primary/5"
              >
                Isi ke semua yang kosong
              </button>
              <input
                value={itemFilter.text}
                onChange={(e) => setItemFilter((f) => ({ ...f, text: e.target.value, page: 1 }))}
                placeholder="Cari nama barang..."
                className={`${fieldBase} w-full sm:w-56 sm:ml-auto`}
              />
            </div>

            <div className="overflow-x-auto custom-scroll rounded-lg border border-outline-variant">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-surface-container-low/70 text-xs text-outline uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Nama barang</th>
                    <th className="py-2.5 px-3 text-right">Dipakai di</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3">HPP / potong</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {pagedItems.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 px-3">
                        <input
                          value={it.name}
                          onChange={(e) => updateItem(it.id, { name: e.target.value })}
                          className={`${inputClass} ${it.name.trim() ? "" : "border-error"}`}
                        />
                        <span className="block mt-1 text-[11px]">
                          {it.existing ? (
                            <span className="text-emerald-700">Sudah ada di gudang</span>
                          ) : (nameCount.get(norm(it.name)) ?? 0) > 1 ? (
                            <span className="text-sky-700">Digabung dengan barang bernama sama</span>
                          ) : (
                            <span className="text-outline">Barang baru</span>
                          )}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-on-surface-variant font-tnum whitespace-nowrap align-top pt-4">
                        {formatNumber(usage.get(it.id))} variasi
                      </td>
                      <td className="py-2 px-3 align-top">
                        <select
                          value={it.supplierId}
                          onChange={(e) => updateItem(it.id, { supplierId: e.target.value })}
                          className={`${inputClass} cursor-pointer ${it.supplierId ? "" : "border-error"}`}
                        >
                          <option value="">Pilih supplier...</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3 align-top">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline">Rp</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={it.hpp}
                            onChange={(e) => updateItem(it.id, { hpp: e.target.value })}
                            placeholder="0"
                            className={`${inputClass} pl-9`}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}

                  {pagedItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-outline">
                        Tidak ada barang di filter ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pager page={itemPage} pages={itemPages} onChange={(page) => setItemFilter((f) => ({ ...f, page }))} />

            <p className="text-xs text-outline">
              HPP boleh dikosongkan dulu dan diisi nanti di menu Produk. HPP yang diisi di sini berlaku untuk semua
              warna/ukuran barang tersebut.
            </p>

            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container-low"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={nextFromItems}
                className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary-container"
              >
                Lanjut
              </button>
            </div>
          </>
        )}

        {/* ================= LANGKAH 3 ================= */}
        {step === 3 && (
          <>
            <div>
              <h2 className="font-display font-semibold text-base text-on-surface">Cek isi tiap produk {mpName}</h2>
              <p className="text-on-surface-variant">
                Isi 1 paket = barang apa saja yang keluar dari gudang setiap 1 pesanan. Contoh "3 SETEL KUTUNG"
                isinya Baju Kutung ×3 + Celana Pop ×3, jadi tiap 1 pesanan stok baju dan celana masing-masing
                berkurang 3. Warna dan ukuran dibaca dari nama variasi di {mpName}; tulisan jumlah paket seperti "3 PCS" tidak dianggap warna.
                Kalau warnanya belum sesuai, klik <b>Ubah warna/ukuran</b> di kartunya dan isi sendiri sebelum disimpan.
              </p>
              <p className="text-on-surface-variant mt-1.5">
                Kalau isi paket sudah sesuai, klik <b>Tandai sudah benar</b>. Produk yang sudah ditandai tidak diberi
                label "perlu dicek" lagi setelah disimpan. Mengubah isinya juga otomatis menandainya.
              </p>
            </div>

            {checkTotal > 0 && (
              <div className="p-3 rounded-lg bg-surface-container-low">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
                  <span className="font-medium text-on-surface">
                    Sudah dicek {formatNumber(checkDone)} dari {formatNumber(checkTotal)} produk yang perlu dicek
                  </span>
                  {checkDone >= checkTotal ? (
                    <span className="text-emerald-700 font-semibold">Semua sudah dicek, klik Lanjut</span>
                  ) : (
                    <span className="text-outline">sisa {formatNumber(checkTotal - checkDone)}</span>
                  )}
                </div>
                <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.round((checkDone / checkTotal) * 100)}%` }}
                  />
                </div>
                {groupFilter.type === "check" && checkDone > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      refreshCheckList();
                      setGroupFilter((f) => ({ ...f, page: 1 }));
                    }}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Sembunyikan yang sudah dicek
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {[
                ["check", `Perlu dicek (${formatNumber(checkGroups.length)})`],
                ["all", `Semua (${formatNumber(groups.length)})`],
                ["skipped", `Dilewati (${formatNumber(groups.filter((g) => g.skipped).length)})`],
              ].map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    if (type === "check") refreshCheckList();
                    setGroupFilter({ type, page: 1 });
                  }}
                  className={`px-3 py-1.5 rounded-full border text-sm ${
                    groupFilter.type === type
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <datalist id="barang-gudang">
              {usedItems.map((it) => (
                <option key={it.id} value={it.name} />
              ))}
            </datalist>
            <datalist id="warna-umum">
              {commonColors.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <datalist id="ukuran-umum">
              {commonSizes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>

            {pagedGroups.length === 0 && (
              <div className="py-8 text-center text-outline rounded-xl border border-dashed border-outline-variant">
                {groupFilter.type === "check"
                  ? "Tidak ada lagi yang perlu dicek. Klik Lanjut untuk menyimpan."
                  : "Tidak ada produk di filter ini."}
              </div>
            )}

            <div className="space-y-3">
              {pagedGroups.map((g) => (
                <div
                  key={g.id}
                  className={`rounded-xl border p-3.5 space-y-3 ${
                    g.skipped
                      ? "border-outline-variant opacity-60"
                      : g.reviewed
                        ? "border-emerald-400 bg-emerald-50/40"
                        : "border-outline-variant"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-on-surface leading-snug line-clamp-2">{g.productName}</p>
                      {!g.skipped && g.notes.length > 0 && (
                        g.reviewed ? (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-600 text-white">
                            <span className="material-symbols-outlined text-[14px]">check</span>
                            Sudah dicek
                          </span>
                        ) : (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Perlu dicek
                          </span>
                        )
                      )}
                    </div>
                    <p className="text-xs text-outline mt-0.5">
                      {g.variations.length} variasi: {g.variations.slice(0, 4).join(", ")}
                      {g.variations.length > 4 ? `, +${g.variations.length - 4} lagi` : ""}
                      {g.skus[0] ? ` • SKU: ${g.skus[0]}` : ""}
                    </p>
                    {!g.skipped && g.variants?.length > 0 && (
                      <VariantPanel
                        g={g}
                        itemById={itemById}
                        open={openEditors.has(g.id)}
                        onToggle={() => toggleEditor(g.id)}
                        onChange={(listingId, patch) => updateVariant(g.id, listingId, patch)}
                        onApplyAll={(patch) => applyToAllVariants(g.id, patch)}
                        onFillFromSku={() => fillEmptyColorsFromSku(g.id)}
                      />
                    )}
                    {g.notes.length > 0 && !g.reviewed && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {g.notes.map((n) => (
                          <span
                            key={n}
                            className="px-2 py-0.5 rounded-full text-[11px] bg-amber-50 text-amber-800 border border-amber-200"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {!g.skipped && (
                    <div className="space-y-2">
                      <span className="block text-xs font-semibold text-on-surface-variant">
                        Isi 1 paket (keluar dari gudang tiap 1 pesanan):
                      </span>

                      <div className="grid grid-cols-[minmax(0,1fr)_110px_36px] gap-2 text-xs text-outline px-0.5">
                        <span>Barang gudang</span>
                        <span>Jumlah</span>
                        <span />
                      </div>

                      {g.lines.map((line) => (
                        <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_110px_36px] items-center gap-2">
                          <input
                            list="barang-gudang"
                            value={line.text ?? itemById.get(line.itemId)?.name ?? ""}
                            onChange={(e) => updateLine(g.id, line.id, { text: e.target.value })}
                            onBlur={() => commitLineName(g.id, line)}
                            placeholder="Ketik atau pilih nama barang..."
                            title={line.text ?? itemById.get(line.itemId)?.name ?? ""}
                            className={`${inputClass} font-medium`}
                          />
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              value={line.qty}
                              onChange={(e) => updateLine(g.id, line.id, { qty: e.target.value })}
                              className={`${fieldBase} w-16 text-center`}
                            />
                            <span className="text-outline text-xs">pcs</span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              g.lines.length > 1 &&
                              updateGroup(g.id, { reviewed: true, lines: g.lines.filter((l) => l.id !== line.id) })
                            }
                            disabled={g.lines.length === 1}
                            title="Hapus barang dari paket"
                            className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/40 disabled:opacity-30"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          updateGroup(g.id, {
                            reviewed: true,
                            lines: [...g.lines, { id: uid("l"), itemId: "", qty: 1, text: "" }],
                          })
                        }
                        className="text-primary text-sm hover:underline"
                      >
                        + Tambah barang
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-surface-container-high">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-on-surface-variant">
                      <input
                        type="checkbox"
                        checked={g.skipped}
                        onChange={(e) => updateGroup(g.id, { skipped: e.target.checked })}
                        className="w-4 h-4 accent-primary"
                      />
                      Lewati dulu (atur nanti)
                    </label>

                    {!g.skipped && (
                      <button
                        type="button"
                        onClick={() => updateGroup(g.id, { reviewed: !g.reviewed })}
                        aria-pressed={g.reviewed}
                        title={g.reviewed ? "Klik lagi untuk membatalkan tanda" : "Klik kalau isi paket di atas sudah sesuai"}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                          g.reviewed
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "border border-primary text-primary hover:bg-primary/5"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {g.reviewed ? "check_circle" : "radio_button_unchecked"}
                        </span>
                        {g.reviewed ? "Sudah benar" : "Tandai sudah benar"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Pager page={groupPage} pages={groupPages} onChange={(page) => setGroupFilter((f) => ({ ...f, page }))} />

            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container-low"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={nextFromGroups}
                className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary-container"
              >
                Lanjut
              </button>
            </div>
          </>
        )}

        {/* ================= LANGKAH 4 ================= */}
        {step === 4 && !result && (
          <>
            <h2 className="font-display font-semibold text-base text-on-surface">Siap disimpan</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                [`Produk ${mpName}`, activeGroups.length],
                ["Variasi terhubung", activeGroups.reduce((s, g) => s + g.listingIds.length, 0)],
                ["Barang gudang", nameCount.size],
                ["Dilewati", groups.length - activeGroups.length],
              ].map(([label, value]) => (
                <div key={label} className="p-3 rounded-lg bg-surface-container-low">
                  <span className="block text-xs text-outline">{label}</span>
                  <span className="block text-xl font-bold font-tnum text-on-surface">{formatNumber(value)}</span>
                </div>
              ))}
            </div>

            <ul className="space-y-1.5 text-on-surface-variant">
              <li>• Barang gudang baru dibuat dengan stok 0. Stok bertambah lewat Pembelian Supplier.</li>
              <li>
                • {missingHpp ? `${formatNumber(missingHpp)} barang belum ada HPP-nya, bisa diisi nanti di menu Produk.` : "Semua barang sudah ada HPP-nya."}
              </li>
              <li>• Produk yang belum ditandai "sudah benar" tetap tersimpan dan bisa dicek lagi nanti.</li>
            </ul>

            {busy && (
              <div>
                <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-1 text-xs text-outline font-tnum">
                  Menyimpan {formatNumber(progress.done)} dari {formatNumber(progress.total)} variasi...
                </p>
              </div>
            )}

            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={busy}
                className="px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container-low disabled:opacity-50"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={saveAll}
                disabled={busy}
                className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary-container disabled:opacity-60"
              >
                {busy ? `Menyimpan ${percent}%...` : "Simpan Semua"}
              </button>
            </div>
          </>
        )}

        {/* ================= SELESAI ================= */}
        {result && (
          <div className="py-6 text-center space-y-3">
            <span className="material-symbols-outlined text-[48px] text-emerald-600">task_alt</span>
            <h2 className="font-display font-semibold text-lg text-on-surface">Selesai!</h2>
            <p className="text-on-surface-variant">
              {formatNumber(result.mapped)} variasi {mpName} sudah terhubung ke {formatNumber(result.items)} barang
              gudang.
              {result.later ? ` ${formatNumber(result.later)} produk dilewati dan bisa diatur nanti.` : ""}
            </p>
            <p className="text-on-surface-variant">
              Langkah berikutnya: isi stok awal barang, lalu pesanan dari {mpName} bisa langsung mengurangi stok.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Link
                to="/products"
                className="px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container-low"
              >
                Lihat Produk
              </Link>
              <Link
                to="/listings"
                className="px-4 py-2.5 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary-container"
              >
                Lihat Daftar Produk Marketplace
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
