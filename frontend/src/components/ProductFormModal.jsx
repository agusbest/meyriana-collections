import { useEffect, useRef, useState } from "react";
import client from "../api/client";
import Modal from "./Modal";

const CATEGORY_SUGGESTIONS = [
  "Romper",
  "Jumper",
  "Setelan",
  "Piyama",
  "Kaos",
  "Celana",
  "Bedong",
  "Topi",
  "Sarung Tangan & Kaki",
  "Newborn Set",
];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // sama dengan batas di ProductRequest (5 MB)

const EMPTY_FORM = {
  supplier_id: "",
  sku: "",
  name: "",
  category: "",
  is_active: true,
};
const EMPTY_GEN = { colors: "", sizes: "", purchase: "", selling: "" };

const inputBase =
  "w-full px-3 rounded-lg border bg-surface-container-lowest text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

let keySeed = 0;
const nextKey = () => ++keySeed;

function blankVariant() {
  return {
    key: nextKey(),
    id: null,
    color: "",
    size: "",
    purchase_price: "",
    selling_price: "",
    stock: 0,
    imageFile: null,
    imagePreview: null,
    imageError: "",
  };
}

function toVariantForm(v) {
  return {
    key: nextKey(),
    id: v.id,
    color: v.color ?? "",
    size: v.size ?? "",
    purchase_price: String(Number(v.purchase_price ?? 0)),
    selling_price: String(Number(v.selling_price ?? 0)),
    stock: Number(v.stock ?? 0),
    imageFile: null,
    imagePreview: v.image_url ?? null,
    imageError: "",
  };
}

const splitList = (text) =>
  text
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const comboKey = (v) =>
  `${v.color.trim().toLowerCase()}|${v.size.trim().toLowerCase()}`;

const isBlankRow = (v) =>
  !v.id &&
  !v.color &&
  !v.size &&
  !v.purchase_price &&
  !v.selling_price &&
  !v.imageFile;

// Perkecil foto dari HP (maks sisi 1200px, JPEG) supaya ringan diunggah
async function compressImage(file, maxSize = 1200, quality = 0.85) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-on-surface-variant mb-1">
        {label}
      </span>
      {children}
      {error ? (
        <span className="block mt-1 text-xs text-error">{error}</span>
      ) : (
        hint && <span className="block mt-1 text-xs text-outline">{hint}</span>
      )}
    </label>
  );
}

function MiniField({ label, error, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-on-surface-variant mb-1">
        {label}
      </span>
      {children}
      {error && <span className="block mt-1 text-xs text-error">{error}</span>}
    </label>
  );
}

export default function ProductFormModal({
  open,
  product,
  suppliers = [],
  onClose,
  onSaved,
}) {
  const isEdit = Boolean(product);

  const [form, setForm] = useState(EMPTY_FORM);
  const [variants, setVariants] = useState([blankVariant()]);
  const [gen, setGen] = useState(EMPTY_GEN);
  const [showGen, setShowGen] = useState(true);
  const [genError, setGenError] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Semua blob URL preview dicatat supaya bisa dilepas saat modal ditutup
  const blobUrls = useRef(new Set());

  function releaseBlobUrls() {
    blobUrls.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrls.current.clear();
  }

  useEffect(() => releaseBlobUrls, []);

  // Reset form setiap modal dibuka
  useEffect(() => {
    if (!open) return;

    releaseBlobUrls();

    setForm({
      supplier_id: product?.supplier_id ? String(product.supplier_id) : "",
      sku: product?.sku ?? "",
      name: product?.name ?? "",
      category: product?.category ?? "",
      is_active: product ? Boolean(product.is_active) : true,
    });

    // Hanya variasi aktif yang dimuat; variasi yang dihapus dari form akan dinonaktifkan oleh backend
    const activeVariants = (product?.variants ?? []).filter((v) => v.is_active);
    setVariants(
      activeVariants.length
        ? activeVariants.map(toVariantForm)
        : [blankVariant()],
    );

    setGen(EMPTY_GEN);
    setGenError("");
    setShowGen(!product);
    setErrors({});
    setFormError("");
  }, [open, product]);

  const setField = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const fieldClass = (key, height = "h-10") =>
    `${inputBase} ${height} ${errors[key] ? "border-error" : "border-outline-variant"}`;

  const miniClass = (hasError) =>
    `${inputBase} h-9 px-2.5 ${hasError ? "border-error" : "border-outline-variant"}`;

  const updateVariant = (key, field, value) =>
    setVariants((vs) =>
      vs.map((v) => (v.key === key ? { ...v, [field]: value } : v)),
    );

  const addVariant = () => setVariants((vs) => [...vs, blankVariant()]);

  const removeVariant = (key) =>
    setVariants((vs) => (vs.length > 1 ? vs.filter((v) => v.key !== key) : vs));

  async function handlePickImage(key, e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      updateVariant(key, "imageError", "File harus berupa gambar.");
      return;
    }

    const compressed = await compressImage(file);

    if (compressed.size > MAX_IMAGE_BYTES) {
      updateVariant(key, "imageError", "Gambar lebih dari 5 MB.");
      return;
    }

    const url = URL.createObjectURL(compressed);
    blobUrls.current.add(url);

    // Gambar juga dipakai untuk ukuran lain dengan warna yang sama (yang belum punya gambar)
    setVariants((vs) => {
      const target = vs.find((v) => v.key === key);
      const color = (target?.color ?? "").trim().toLowerCase();

      return vs.map((v) => {
        if (v.key === key) {
          return {
            ...v,
            imageFile: compressed,
            imagePreview: url,
            imageError: "",
          };
        }

        const sameColor = color && v.color.trim().toLowerCase() === color;

        if (sameColor && !v.imagePreview) {
          return {
            ...v,
            imageFile: compressed,
            imagePreview: url,
            imageError: "",
          };
        }

        return v;
      });
    });
  }

  // Buat semua kombinasi warna x ukuran sekaligus
  function generate() {
    const colors = splitList(gen.colors);
    const sizes = splitList(gen.sizes);

    if (!colors.length && !sizes.length) {
      setGenError("Isi minimal satu warna atau satu ukuran.");
      return;
    }

    setGenError("");

    const existing = new Set(variants.map(comboKey));
    const rows = [];

    for (const color of colors.length ? colors : [""]) {
      for (const size of sizes.length ? sizes : [""]) {
        const row = {
          ...blankVariant(),
          color,
          size,
          purchase_price: gen.purchase,
          selling_price: gen.selling,
        };

        if (!existing.has(comboKey(row))) {
          existing.add(comboKey(row));
          rows.push(row);
        }
      }
    }

    setVariants((vs) => [...vs.filter((v) => !isBlankRow(v)), ...rows]);
  }

  const onGenKeyDown = (e) => {
    // Enter di kolom generator tidak boleh menyimpan seluruh form
    if (e.key === "Enter") {
      e.preventDefault();
      generate();
    }
  };

  const genCount =
    splitList(gen.colors).length || splitList(gen.sizes).length
      ? (splitList(gen.colors).length || 1) * (splitList(gen.sizes).length || 1)
      : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setFormError("");

    const seen = new Set();
    for (const v of variants) {
      const key = comboKey(v);
      if (seen.has(key)) {
        const label =
          [v.color, v.size].filter(Boolean).join(" / ") ||
          "tanpa warna & ukuran";
        setFormError(
          `Variasi ganda: ${label}. Setiap kombinasi warna dan ukuran harus unik.`,
        );
        return;
      }
      seen.add(key);
    }

    setSaving(true);

    const fd = new FormData();
    fd.append("supplier_id", form.supplier_id);
    fd.append("sku", form.sku.trim());
    fd.append("name", form.name.trim());
    fd.append("category", form.category.trim());
    fd.append("is_active", form.is_active ? "1" : "0");

    variants.forEach((v, i) => {
      if (v.id) fd.append(`variants[${i}][id]`, v.id);
      fd.append(`variants[${i}][color]`, v.color.trim());
      fd.append(`variants[${i}][size]`, v.size.trim());
      fd.append(`variants[${i}][purchase_price]`, v.purchase_price || 0);
      fd.append(`variants[${i}][selling_price]`, v.selling_price || 0);
      fd.append(`variants[${i}][is_active]`, "1");
      if (v.imageFile) fd.append(`variants[${i}][image]`, v.imageFile);
    });

    // PHP tidak membaca multipart pada PUT, jadi kirim POST + _method
    if (isEdit) fd.append("_method", "PUT");

    try {
      const res = isEdit
        ? await client.post(`/products/${product.id}`, fd)
        : await client.post("/products", fd);
      onSaved(res.data, isEdit);
    } catch (err) {
      if (err.response?.status === 422) {
        const raw = err.response.data.errors ?? {};
        setErrors(
          Object.fromEntries(
            Object.entries(raw).map(([key, msgs]) => [key, msgs[0]]),
          ),
        );
      } else {
        setFormError(
          err.response?.data?.message ??
            "Terjadi kesalahan. Silakan coba lagi.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  const noSuppliers = suppliers.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Produk" : "Tambah Produk"}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-outline-variant text-sm text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={saving || noSuppliers}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {saving
              ? "Menyimpan..."
              : isEdit
                ? "Simpan Perubahan"
                : "Simpan Produk"}
          </button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <p className="px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {formError}
          </p>
        )}

        {errors.variants && (
          <p className="px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {errors.variants}
          </p>
        )}

        {noSuppliers && (
          <p className="px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-sm">
            Belum ada supplier. Tambahkan dulu di menu Supplier sebelum membuat
            produk.
          </p>
        )}

        <Field label="Supplier" error={errors.supplier_id}>
          <select
            value={form.supplier_id}
            onChange={setField("supplier_id")}
            className={`${fieldClass("supplier_id")} cursor-pointer`}
            required
          >
            <option value="">Pilih supplier...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="SKU" error={errors.sku}>
            <input
              value={form.sku}
              onChange={setField("sku")}
              placeholder="Contoh: ROMPER-001"
              className={fieldClass("sku")}
              required
            />
          </Field>

          <Field label="Kategori" error={errors.category}>
            <input
              value={form.category}
              onChange={setField("category")}
              list="product-category-list"
              placeholder="Pilih atau ketik"
              className={fieldClass("category")}
            />
            <datalist id="product-category-list">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>

        <Field label="Nama Produk" error={errors.name}>
          <input
            value={form.name}
            onChange={setField("name")}
            placeholder="Contoh: Romper Bayi Motif Beruang"
            className={fieldClass("name")}
            required
          />
        </Field>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) =>
              setForm((f) => ({ ...f, is_active: e.target.checked }))
            }
            className="mt-0.5 w-4 h-4 accent-primary"
          />
          <span>
            <span className="block text-sm font-medium text-on-surface">
              Produk aktif
            </span>
            <span className="block text-xs text-outline">
              Nonaktifkan produk yang tidak dijual lagi. Lebih aman daripada
              menghapus.
            </span>
          </span>
        </label>

        {/* ===== Variasi ===== */}
        <div className="pt-2 border-t border-surface-container-high space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display font-semibold text-on-surface">
                Variasi Produk ({variants.length})
              </h3>
              <p className="text-xs text-outline">
                Warna, ukuran, harga, dan gambar. Stok terisi otomatis dari
                Pembelian &amp; Penjualan.
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowGen((s) => !s)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">
                  auto_awesome
                </span>
                <span className="hidden sm:inline">Buat Otomatis</span>
              </button>
              <button
                type="button"
                onClick={addVariant}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">
                  add
                </span>
                <span className="hidden sm:inline">Tambah</span>
              </button>
            </div>
          </div>

          {showGen && (
            <div
              onKeyDown={onGenKeyDown}
              className="rounded-lg border border-outline-variant bg-surface-container-low/50 p-3 space-y-3"
            >
              <p className="text-xs text-on-surface-variant">
                Isi beberapa warna dan/atau ukuran (pisahkan dengan koma), semua
                kombinasinya dibuatkan otomatis.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <MiniField label="Warna">
                  <input
                    value={gen.colors}
                    onChange={(e) =>
                      setGen((g) => ({ ...g, colors: e.target.value }))
                    }
                    placeholder="Pink, Biru, Putih"
                    className={miniClass(false)}
                  />
                </MiniField>
                <MiniField label="Ukuran">
                  <input
                    value={gen.sizes}
                    onChange={(e) =>
                      setGen((g) => ({ ...g, sizes: e.target.value }))
                    }
                    placeholder="S, M, L, XL"
                    className={miniClass(false)}
                  />
                </MiniField>
                <MiniField label="HPP (semua variasi)">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={gen.purchase}
                    onChange={(e) =>
                      setGen((g) => ({ ...g, purchase: e.target.value }))
                    }
                    placeholder="0"
                    className={miniClass(false)}
                  />
                </MiniField>
                <MiniField label="Harga jual (semua variasi)">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={gen.selling}
                    onChange={(e) =>
                      setGen((g) => ({ ...g, selling: e.target.value }))
                    }
                    placeholder="0"
                    className={miniClass(false)}
                  />
                </MiniField>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  ["S, M, L, XL", "S M L XL"],
                  ["0-6, 6-12, 12-18", "0-6 · 6-12 · 12-18"],
                  ["1 stel, 2 stel", "1 stel · 2 stel"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGen((g) => ({ ...g, sizes: value }))}
                    className="px-2 py-0.5 rounded-full border border-outline-variant text-[11px] text-on-surface-variant hover:bg-surface-container transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-outline">
                  {genCount > 0
                    ? `Akan membuat sampai ${genCount} variasi`
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={generate}
                  className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors"
                >
                  Buat Kombinasi
                </button>
              </div>

              {genError && <p className="text-xs text-error">{genError}</p>}
            </div>
          )}

          <div className="space-y-3">
            {variants.map((v, i) => {
              const imageError = errors[`variants.${i}.image`] || v.imageError;

              return (
                <div
                  key={v.key}
                  className="rounded-lg border border-outline-variant p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-on-surface-variant">
                      Variasi {i + 1}
                      {v.id && (
                        <span className="ml-2 font-normal text-outline">
                          · stok {v.stock}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeVariant(v.key)}
                      disabled={variants.length === 1}
                      title="Hapus variasi"
                      className="p-1 rounded-lg text-outline hover:text-error hover:bg-error-container/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete
                      </span>
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <div className="shrink-0 w-20">
                      <label className="block cursor-pointer">
                        <div className="w-20 h-20 rounded-lg border border-outline-variant bg-surface-container-low flex items-center justify-center overflow-hidden hover:border-primary transition-colors">
                          {v.imagePreview ? (
                            <img
                              src={v.imagePreview}
                              alt="Gambar variasi"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-outline">
                              add_photo_alternate
                            </span>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handlePickImage(v.key, e)}
                        />
                        <span className="block mt-1 text-center text-[11px] font-semibold text-primary">
                          {v.imagePreview ? "Ganti" : "Gambar"}
                        </span>
                      </label>
                      {imageError && (
                        <p className="mt-1 text-[11px] text-error">
                          {imageError}
                        </p>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 grid grid-cols-2 gap-3">
                      <MiniField
                        label="Warna"
                        error={errors[`variants.${i}.color`]}
                      >
                        <input
                          value={v.color}
                          onChange={(e) =>
                            updateVariant(v.key, "color", e.target.value)
                          }
                          placeholder="Pink"
                          className={miniClass(errors[`variants.${i}.color`])}
                        />
                      </MiniField>
                      <MiniField
                        label="Ukuran"
                        error={errors[`variants.${i}.size`]}
                      >
                        <input
                          value={v.size}
                          onChange={(e) =>
                            updateVariant(v.key, "size", e.target.value)
                          }
                          placeholder="M / 0-6"
                          className={miniClass(errors[`variants.${i}.size`])}
                        />
                      </MiniField>
                      <MiniField
                        label="HPP"
                        error={errors[`variants.${i}.purchase_price`]}
                      >
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={v.purchase_price}
                          onChange={(e) =>
                            updateVariant(
                              v.key,
                              "purchase_price",
                              e.target.value,
                            )
                          }
                          placeholder="0"
                          className={miniClass(
                            errors[`variants.${i}.purchase_price`],
                          )}
                          required
                        />
                      </MiniField>
                      <MiniField
                        label="Harga Jual"
                        error={errors[`variants.${i}.selling_price`]}
                      >
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={v.selling_price}
                          onChange={(e) =>
                            updateVariant(
                              v.key,
                              "selling_price",
                              e.target.value,
                            )
                          }
                          placeholder="0"
                          className={miniClass(
                            errors[`variants.${i}.selling_price`],
                          )}
                          required
                        />
                      </MiniField>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-outline">
            Variasi yang dihapus dari form akan dinonaktifkan (bukan dihapus
            permanen) supaya histori transaksi tetap aman.
          </p>
        </div>
      </form>
    </Modal>
  );
}
