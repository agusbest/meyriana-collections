import { useEffect, useState } from "react";
import client from "../api/client";
import Modal from "./Modal";
import {
  readPack,
  listingVariant,
  colorForItem,
  suggestComponentNames,
  suggestQty,
} from "../utils/shopeeImport";

const NEW = "__new__";

let lineSeed = 0;

const norm = (s) => String(s ?? "").trim().toLowerCase();

const inputClass =
  "w-full h-9 px-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function newLine(patch = {}) {
  return {
    key: ++lineSeed,
    product_id: "",
    new_product_name: "",
    supplier_id: "",
    category: "",
    qty: 1,
    variant_mode: "follow",
    color: "",
    size: "",
    hpp: "",
    ...patch,
  };
}

function variantText(color, size) {
  return [color, size].filter(Boolean).join(" / ");
}

function componentLabel(component) {
  const v = component.product_variant ?? component.productVariant;
  const opt = variantText(v?.color, v?.size);

  return `${v?.product?.name ?? "Produk"}${opt ? ` (${opt})` : ""} ×${component.qty}`;
}

function productHpp(product) {
  const hpp = product?.variants?.find((v) => Number(v.purchase_price) > 0)?.purchase_price;
  return hpp ? String(Number(hpp)) : "";
}

// Isi awal resep: dari pemetaan yang sudah ada, atau dari saran nama judul listing
function initialLines(group, products) {
  const mapped = group.listings.find((l) => l.components?.length);

  if (mapped) {
    const parsed = listingVariant(mapped.variation_name, mapped.product_name);

    return mapped.components.map((c) => {
      const v = c.product_variant ?? c.productVariant;
      const follow =
        norm(v?.color) === norm(colorForItem(v?.product?.name, parsed.color)) &&
        norm(v?.size) === norm(parsed.size);

      return newLine({
        product_id: String(v?.product_id ?? ""),
        hpp: productHpp(products.find((p) => String(p.id) === String(v?.product_id))),
        qty: c.qty,
        variant_mode: follow ? "follow" : "fixed",
        color: v?.color ?? "",
        size: v?.size ?? "",
      });
    });
  }

  const qty = suggestQty(group.listings[0]?.marketplace_sku);

  return suggestComponentNames(group.product_name).map((name) => {
    const existing = products.find((p) => norm(p.name) === norm(name));

    return existing
      ? newLine({ product_id: String(existing.id), qty, hpp: productHpp(existing) })
      : newLine({ product_id: NEW, new_product_name: name, qty });
  });
}

export default function ListingMappingModal({ open, group, onClose, onSaved }) {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [lines, setLines] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!open || !group) return;

    let ignore = false;

    setErrors([]);
    setLoading(true);

    // Default: variasi yang belum dipetakan; kalau semua sudah, pilih semua
    const unmapped = group.listings.filter((l) => !l.components?.length);
    setSelected(new Set((unmapped.length ? unmapped : group.listings).map((l) => l.id)));

    Promise.all([
      client.get("/products", { params: { all: 1 } }),
      client.get("/suppliers", { params: { all: 1 } }),
    ])
      .then(([productRes, supplierRes]) => {
        if (ignore) return;

        const productRows = productRes.data.data ?? productRes.data;
        const supplierRows = supplierRes.data.data ?? supplierRes.data;
        const productList = Array.isArray(productRows) ? productRows : [];

        setProducts(productList);
        setSuppliers(Array.isArray(supplierRows) ? supplierRows : []);
        setLines(initialLines(group, productList));
      })
      .catch((err) => {
        if (!ignore) {
          setErrors([err.response?.data?.message ?? "Gagal memuat produk dan supplier."]);
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [open, group]);

  if (!group) return null;

  const updateLine = (key, patch) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key) =>
    setLines((current) => (current.length > 1 ? current.filter((l) => l.key !== key) : current));

  function toggleListing(id) {
    setSelected((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Produk yang akan dipakai baris ini (produk baru dengan nama yang sudah ada = produk itu)
  function resolveProduct(line) {
    if (line.product_id && line.product_id !== NEW) {
      return products.find((p) => String(p.id) === String(line.product_id)) ?? null;
    }

    return products.find((p) => norm(p.name) === norm(line.new_product_name)) ?? null;
  }

  function lineName(line) {
    return resolveProduct(line)?.name ?? (line.new_product_name.trim() || "Produk baru");
  }

  function previewFor(listing) {
    const parsed = listingVariant(listing.variation_name, listing.product_name);

    return lines.map((line) => {
      const color =
        line.variant_mode === "follow" ? colorForItem(lineName(line), parsed.color) : line.color.trim() || null;
      const size = line.variant_mode === "follow" ? parsed.size : line.size.trim() || null;
      const product = resolveProduct(line);
      const exists = (product?.variants ?? []).some(
        (v) => norm(v.color) === norm(color) && norm(v.size) === norm(size),
      );

      return {
        key: line.key,
        text: `${lineName(line)}${variantText(color, size) ? ` (${variantText(color, size)})` : ""} ×${line.qty || 0}`,
        isNew: !exists,
      };
    });
  }

  function validate() {
    const problems = [];

    if (selected.size === 0) problems.push("Centang minimal satu variasi.");

    lines.forEach((line, i) => {
      const label = `Barang ${i + 1}`;

      if (!line.product_id) problems.push(`${label}: pilih barang gudang atau buat barang baru.`);

      if (line.product_id === NEW) {
        if (!line.new_product_name.trim()) problems.push(`${label}: nama barang baru wajib diisi.`);
        if (!line.supplier_id) problems.push(`${label}: supplier wajib dipilih untuk barang baru.`);
      }

      if (!(Number(line.qty) >= 1)) problems.push(`${label}: jumlah minimal 1.`);
      if (line.hpp !== "" && Number(line.hpp) < 0) problems.push(`${label}: HPP tidak boleh minus.`);
    });

    return problems;
  }

  async function handleSave() {
    const problems = validate();

    if (problems.length) {
      setErrors(problems);
      return;
    }

    setSaving(true);
    setErrors([]);

    const payload = {
      listing_ids: [...selected],
      lines: lines.map((line) => {
        const isNew = line.product_id === NEW;
        const fixed = line.variant_mode === "fixed";

        return {
          product_id: isNew ? null : Number(line.product_id),
          new_product_name: isNew ? line.new_product_name.trim() : null,
          supplier_id: isNew ? Number(line.supplier_id) : null,
          category: isNew ? line.category.trim() || null : null,
          qty: Number(line.qty),
          purchase_price: line.hpp === "" ? null : Number(line.hpp),
          variant_mode: line.variant_mode,
          color: fixed ? line.color.trim() || null : null,
          size: fixed ? line.size.trim() || null : null,
        };
      }),
    };

    try {
      await client.post("/marketplace-listings/mapping", payload);

      onSaved(`Isi ${selected.size} variasi berhasil disimpan`);
    } catch (err) {
      if (err.response?.status === 422) {
        const raw = err.response.data.errors ?? {};
        setErrors([...new Set(Object.values(raw).flat())]);
      } else {
        setErrors([err.response?.data?.message ?? "Gagal menyimpan isi produk."]);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUnmap() {
    const ids = group.listings
      .filter((l) => selected.has(l.id) && l.components?.length)
      .map((l) => l.id);

    if (!ids.length) return;

    if (!window.confirm(`Lepas hubungan ${ids.length} variasi dari barang gudang? Pesanannya tidak akan mengurangi stok sampai diatur lagi.`)) return;

    setSaving(true);

    try {
      await client.post("/marketplace-listings/unmap", { listing_ids: ids });
      onSaved(`${ids.length} variasi dilepas dari barang gudang`);
    } catch (err) {
      setErrors([err.response?.data?.message ?? "Gagal melepas hubungan."]);
    } finally {
      setSaving(false);
    }
  }

  const selectedListings = group.listings.filter((l) => selected.has(l.id));
  const canUnmap = selectedListings.some((l) => l.components?.length);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Atur Isi Produk"
      size="lg"
      footer={
        <>
          {canUnmap && (
            <button
              type="button"
              onClick={handleUnmap}
              disabled={saving}
              className="mr-auto px-3 py-2 rounded-lg text-sm text-error hover:bg-error-container/40 transition-colors disabled:opacity-50"
            >
              Lepas hubungan
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-outline-variant text-sm text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : `Simpan untuk ${selected.size} variasi`}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="font-medium text-on-surface leading-snug">{group.product_name}</p>
          <p className="text-xs text-outline mt-0.5">Kode Produk {group.external_product_id}</p>
        </div>

        {errors.length > 0 && (
          <ul className="px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm list-disc list-inside space-y-0.5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        {/* 1. Pilih variasi */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-semibold text-sm text-on-surface">
              1. Variasi yang diatur
            </h3>

            <div className="flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => setSelected(new Set(group.listings.map((l) => l.id)))}
                className="text-primary hover:underline"
              >
                Pilih semua
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-outline hover:underline"
              >
                Kosongkan
              </button>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto custom-scroll rounded-lg border border-outline-variant divide-y divide-surface-container-high">
            {group.listings.map((listing) => (
              <label
                key={listing.id}
                className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-surface-container-low/50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(listing.id)}
                  onChange={() => toggleListing(listing.id)}
                  className="mt-0.5 w-4 h-4 accent-primary"
                />

                <span className="min-w-0 text-sm">
                  <span className="font-medium text-on-surface">
                    {listing.variation_name || "Tanpa variasi"}
                  </span>
                  {listing.marketplace_sku && (
                    <span className="text-outline"> • {listing.marketplace_sku}</span>
                  )}
                  <span className="block text-xs mt-0.5">
                    {listing.components?.length ? (
                      <span className="text-emerald-700">
                        {listing.components.map(componentLabel).join(" + ")}
                      </span>
                    ) : (
                      <span className="text-amber-700">Belum terhubung</span>
                    )}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {new Set(selectedListings.map((l) => readPack(l.variation_name)?.n ?? 0)).size > 1 && (
          <p className="px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs">
            Variasi yang dicentang punya ukuran paket berbeda (misal 3 PCS dan 6 PCS), padahal jumlah di bawah
            berlaku untuk semuanya. Simpan per ukuran paket supaya jumlahnya benar, atau pakai Impor Produk yang
            memisahkannya otomatis.
          </p>
        )}

        {/* 2. Resep */}
        <div>
          <h3 className="font-display font-semibold text-sm text-on-surface">
            2. Isi 1 paket (barang yang keluar dari gudang tiap 1 pesanan)
          </h3>
          <p className="text-xs text-outline mt-0.5 mb-2">
            Contoh "3 SETEL" = Baju ×3 + Celana ×3. Warna/ukuran otomatis mengikuti variasi di marketplace.
          </p>

          {loading ? (
            <div className="py-6 text-center text-sm text-outline">Memuat barang gudang...</div>
          ) : (
            <div className="space-y-3">
              {lines.map((line, i) => {
                const product = resolveProduct(line);
                const isNew = line.product_id === NEW;

                return (
                  <div key={line.key} className="rounded-lg border border-outline-variant p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-on-surface-variant">
                        Barang {i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        disabled={lines.length === 1}
                        title="Hapus barang"
                        className="p-1 rounded-lg text-outline hover:text-error hover:bg-error-container/40 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-[1fr_80px_130px] gap-2.5">
                      <label className="block col-span-2 sm:col-span-1">
                        <span className="block text-xs font-medium text-on-surface-variant mb-1">
                          Barang gudang
                        </span>
                        <select
                          value={line.product_id}
                          onChange={(e) => {
                            const value = e.target.value;
                            const picked = products.find((p) => String(p.id) === value);
                            updateLine(line.key, {
                              product_id: value,
                              hpp: picked ? productHpp(picked) : line.hpp,
                            });
                          }}
                          className={`${inputClass} cursor-pointer`}
                        >
                          <option value="">Pilih barang...</option>
                          <option value={NEW}>+ Barang baru</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="block text-xs font-medium text-on-surface-variant mb-1">
                          Jumlah
                        </span>
                        <input
                          type="number"
                          min="1"
                          value={line.qty}
                          onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                          className={inputClass}
                        />
                      </label>

                      <label className="block">
                        <span className="block text-xs font-medium text-on-surface-variant mb-1">
                          HPP / potong
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.hpp}
                          onChange={(e) => updateLine(line.key, { hpp: e.target.value })}
                          placeholder="Opsional"
                          className={inputClass}
                        />
                      </label>
                    </div>

                    {isNew && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-2.5 rounded-lg bg-surface-container-low/60">
                        <label className="block sm:col-span-3">
                          <span className="block text-xs font-medium text-on-surface-variant mb-1">
                            Nama barang baru (singkat)
                          </span>
                          <input
                            value={line.new_product_name}
                            onChange={(e) => updateLine(line.key, { new_product_name: e.target.value })}
                            placeholder="Contoh: Baju Kutung"
                            className={inputClass}
                          />
                          {product && (
                            <span className="block mt-1 text-xs text-emerald-700">
                              Nama ini sudah ada di gudang, barang itu yang akan dipakai.
                            </span>
                          )}
                        </label>

                        <label className="block sm:col-span-2">
                          <span className="block text-xs font-medium text-on-surface-variant mb-1">
                            Supplier
                          </span>
                          <select
                            value={line.supplier_id}
                            onChange={(e) => updateLine(line.key, { supplier_id: e.target.value })}
                            className={`${inputClass} cursor-pointer`}
                          >
                            <option value="">Pilih supplier...</option>
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="block text-xs font-medium text-on-surface-variant mb-1">
                            Kategori
                          </span>
                          <input
                            value={line.category}
                            onChange={(e) => updateLine(line.key, { category: e.target.value })}
                            placeholder="Opsional"
                            className={inputClass}
                          />
                        </label>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                      {[
                        ["follow", "Warna/ukuran ikut marketplace"],
                        ["fixed", "Warna/ukuran tetap"],
                      ].map(([mode, label]) => (
                        <label key={mode} className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`mode-${line.key}`}
                            checked={line.variant_mode === mode}
                            onChange={() => updateLine(line.key, { variant_mode: mode })}
                            className="accent-primary"
                          />
                          {label}
                        </label>
                      ))}
                    </div>

                    {line.variant_mode === "fixed" && (
                      <div className="grid grid-cols-2 gap-2.5">
                        <input
                          value={line.color}
                          onChange={(e) => updateLine(line.key, { color: e.target.value })}
                          placeholder="Warna (opsional)"
                          list={`colors-${line.key}`}
                          className={inputClass}
                        />
                        <input
                          value={line.size}
                          onChange={(e) => updateLine(line.key, { size: e.target.value })}
                          placeholder="Ukuran (opsional)"
                          list={`sizes-${line.key}`}
                          className={inputClass}
                        />
                        <datalist id={`colors-${line.key}`}>
                          {[...new Set((product?.variants ?? []).map((v) => v.color).filter(Boolean))].map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                        <datalist id={`sizes-${line.key}`}>
                          {[...new Set((product?.variants ?? []).map((v) => v.size).filter(Boolean))].map((s) => (
                            <option key={s} value={s} />
                          ))}
                        </datalist>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setLines((current) => [...current, newLine()])}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-outline-variant text-sm text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Tambah barang ke paket
              </button>
            </div>
          )}
        </div>

        {/* 3. Pratinjau */}
        {!loading && selectedListings.length > 0 && (
          <div className="rounded-lg bg-surface-container-low p-3">
            <h3 className="font-display font-semibold text-sm text-on-surface mb-2">
              3. Contoh hasil (stok yang berkurang tiap 1 pesanan)
            </h3>

            <div className="space-y-1.5 text-sm">
              {selectedListings.slice(0, 6).map((listing) => (
                <div key={listing.id}>
                  <span className="font-medium text-on-surface">
                    {listing.variation_name || "Tanpa variasi"}
                  </span>
                  <span className="text-outline"> → </span>
                  {previewFor(listing).map((p, idx) => (
                    <span key={p.key}>
                      {idx > 0 && <span className="text-outline"> + </span>}
                      <span className="text-on-surface-variant">{p.text}</span>
                      {p.isNew && (
                        <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          baru
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              ))}

              {selectedListings.length > 6 && (
                <p className="text-xs text-outline">
                  ...dan {selectedListings.length - 6} variasi lainnya dengan pola yang sama.
                </p>
              )}
            </div>

            <p className="text-xs text-outline mt-2">
              Label "baru" = warna/ukuran ini belum ada di gudang dan akan dibuat otomatis dengan stok 0.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
