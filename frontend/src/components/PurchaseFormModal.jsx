import { useEffect, useMemo, useState } from "react";
import client from "../api/client";
import Modal from "./Modal";

let itemSeed = 0;
const nextKey = () => ++itemSeed;

const newItem = () => ({
  _key: nextKey(),
  product_variant_id: "",
  qty: 1,
  price: "",
});

const inputClass =
  "w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-surface-container disabled:cursor-not-allowed";

function formatRupiah(n) {
  return `Rp ${Number(n ?? 0).toLocaleString("id-ID")}`;
}

// Tanggal hari ini menurut jam lokal (bukan UTC), format YYYY-MM-DD
function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());

  return d.toISOString().slice(0, 10);
}

function variantText(variant) {
  return `${variant.product?.name ?? "Produk"} • ${variant.color || "-"} • ${variant.size || "-"}`;
}

function toForm(purchase) {
  if (!purchase) {
    return {
      supplier_id: "",
      purchase_date: today(),
      items: [newItem()],
    };
  }

  return {
    supplier_id: purchase.supplier_id ? String(purchase.supplier_id) : "",
    purchase_date: purchase.purchase_date
      ? String(purchase.purchase_date).slice(0, 10)
      : "",
    items: purchase.items?.length
      ? purchase.items.map((item) => ({
          _key: nextKey(),
          product_variant_id: String(item.product_variant_id),
          qty: Number(item.qty ?? 1),
          price: Number(item.price ?? 0),
        }))
      : [newItem()],
  };
}

function VariantSearch({
  value,
  options,
  excludeIds,
  disabled,
  error,
  onSelect,
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const selected = options.find(
    (variant) => String(variant.id) === String(value),
  );

  const keyword = search.trim().toLowerCase();

  const filtered = options
    // Variasi yang sudah dipilih di baris lain tidak ditampilkan lagi
    .filter((variant) => !excludeIds.includes(String(variant.id)))
    .filter((variant) => {
      if (!keyword) return true;

      return `${variant.product?.name ?? ""} ${variant.color ?? ""} ${
        variant.size ?? ""
      } ${variant.product?.sku ?? ""}`
        .toLowerCase()
        .includes(keyword);
    })
    .slice(0, 20);

  function selectVariant(variant) {
    onSelect(variant);
    setSearch("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <span className="block text-sm font-medium text-on-surface-variant mb-1">
        Produk / Variasi
      </span>

      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[19px]">
          search
        </span>

        <input
          value={open ? search : selected ? variantText(selected) : search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setSearch("");
            setOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 150);
          }}
          disabled={disabled}
          placeholder={
            disabled
              ? "Pilih supplier dulu"
              : "Ketik nama produk / warna / ukuran..."
          }
          className={`${inputClass} pl-10 ${error ? "border-error" : ""}`}
        />
      </div>

      {selected && !open && (
        <div className="mt-1 text-xs text-outline">
          Stok saat ini:{" "}
          <span
            className={
              Number(selected.stock ?? 0) <= 0
                ? "text-error font-semibold"
                : "text-on-surface font-semibold"
            }
          >
            {selected.stock ?? 0} pcs
          </span>
        </div>
      )}

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-center text-outline">
              Variasi tidak ditemukan.
            </div>
          ) : (
            filtered.map((variant) => (
              <button
                key={variant.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectVariant(variant);
                }}
                className="w-full text-left px-3 py-2.5 hover:bg-surface-container-low transition-colors border-b border-surface-container-high last:border-b-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">
                      {variant.product?.name ?? "Produk"}
                    </p>

                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {variant.color || "-"}
                      {" • "}
                      {variant.size || "-"}
                      {variant.product?.sku && (
                        <>
                          {" • SKU: "}
                          {variant.product.sku}
                        </>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs text-outline">Stok</p>

                    <p
                      className={
                        Number(variant.stock ?? 0) <= 0
                          ? "text-xs font-semibold text-error"
                          : "text-xs font-semibold text-on-surface"
                      }
                    >
                      {variant.stock ?? 0}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {error && <span className="text-xs text-error mt-1 block">{error}</span>}
    </div>
  );
}

export default function PurchaseFormModal({
  open,
  purchase,
  onClose,
  onSaved,
}) {
  const isEdit = Boolean(purchase);

  const [form, setForm] = useState(() => toForm(null));
  const [suppliers, setSuppliers] = useState([]);
  const [variants, setVariants] = useState([]);

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset form + muat daftar supplier setiap modal dibuka
  useEffect(() => {
    if (!open) return;

    setForm(toForm(purchase));
    setErrors({});
    setFormError("");
    setNotice("");

    let ignore = false;

    setLoadingSuppliers(true);

    client
      .get("/suppliers", { params: { all: 1 } })
      .then((res) => {
        if (ignore) return;

        const rows = res.data.data ?? res.data;

        setSuppliers(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        if (!ignore) {
          setFormError(
            err.response?.data?.message ?? "Gagal memuat data supplier.",
          );
        }
      })
      .finally(() => {
        if (!ignore) setLoadingSuppliers(false);
      });

    return () => {
      ignore = true;
    };
  }, [open, purchase]);

  // Muat produk milik supplier yang dipilih
  useEffect(() => {
    if (!open || !form.supplier_id) {
      setVariants([]);
      return;
    }

    let ignore = false;

    setLoadingVariants(true);

    client
      .get("/products", {
        params: {
          supplier_id: form.supplier_id,
          is_active: 1,
          all: 1,
        },
      })
      .then((res) => {
        if (ignore) return;

        const rows = res.data.data ?? res.data;
        const list = [];

        (Array.isArray(rows) ? rows : []).forEach((product) => {
          (product.variants ?? [])
            .filter((variant) => variant.is_active)
            .forEach((variant) => {
              list.push({ ...variant, product });
            });
        });

        setVariants(list);
      })
      .catch((err) => {
        if (!ignore) {
          setFormError(
            err.response?.data?.message ?? "Gagal memuat produk supplier.",
          );
        }
      })
      .finally(() => {
        if (!ignore) setLoadingVariants(false);
      });

    return () => {
      ignore = true;
    };
  }, [open, form.supplier_id]);

  // Saat edit, variasi yang sudah ada di pembelian ini tetap bisa tampil
  // walaupun sekarang sudah dinonaktifkan (selama supplier tidak diganti).
  const options = useMemo(() => {
    const map = new Map();

    variants.forEach((variant) => map.set(variant.id, variant));

    if (purchase && String(purchase.supplier_id) === String(form.supplier_id)) {
      (purchase.items ?? []).forEach((item) => {
        const pv = item.product_variant ?? item.productVariant;

        if (pv && !map.has(pv.id)) {
          map.set(pv.id, { ...pv, product: pv.product });
        }
      });
    }

    return Array.from(map.values());
  }, [variants, purchase, form.supplier_id]);

  function setField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSupplierChange(value) {
    const hadSelection = form.items.some((item) => item.product_variant_id);

    setForm((current) => ({
      ...current,
      supplier_id: value,
      // Item lama milik supplier sebelumnya, jadi dikosongkan
      items: hadSelection ? [newItem()] : current.items,
    }));

    setNotice(
      hadSelection ? "Item pembelian dikosongkan karena supplier diganti." : "",
    );
  }

  function updateItem(index, patch) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function pickVariant(index, variant) {
    const item = form.items[index];

    updateItem(index, {
      product_variant_id: String(variant.id),
      // Harga beli terisi otomatis dari HPP variasi, tetap bisa diubah
      price:
        item.price === "" ? Number(variant.purchase_price ?? 0) : item.price,
    });
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, newItem()],
    }));
  }

  function removeItem(index) {
    setForm((current) => {
      if (current.items.length <= 1) {
        return current;
      }

      return {
        ...current,
        items: current.items.filter((_, i) => i !== index),
      };
    });
  }

  function getError(field) {
    return errors[field] ?? "";
  }

  function getItemError(index, field) {
    return errors[`items.${index}.${field}`] ?? "";
  }

  function calculateTotal() {
    return form.items.reduce((total, item) => {
      return total + Number(item.qty || 0) * Number(item.price || 0);
    }, 0);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setErrors({});
    setFormError("");

    if (form.items.some((item) => !item.product_variant_id)) {
      setFormError("Pilih produk / variasi untuk setiap item pembelian.");
      return;
    }

    setSaving(true);

    // invoice_number sengaja tidak dikirim: dibuat otomatis oleh backend saat tambah,
    // dan nomor lama dipertahankan saat edit.
    const payload = {
      supplier_id: Number(form.supplier_id),
      purchase_date: form.purchase_date,
      items: form.items.map((item) => ({
        product_variant_id: Number(item.product_variant_id),
        qty: Number(item.qty),
        price: Number(item.price),
      })),
    };

    try {
      const res = isEdit
        ? await client.put(`/purchases/${purchase.id}`, payload)
        : await client.post("/purchases", payload);

      onSaved(res.data, isEdit);
    } catch (err) {
      if (err.response?.status === 422) {
        const raw = err.response.data.errors ?? {};

        setErrors(
          Object.fromEntries(
            Object.entries(raw).map(([key, msgs]) => [
              key,
              Array.isArray(msgs) ? msgs[0] : msgs,
            ]),
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

  const supplierChosen = Boolean(form.supplier_id);
  const noProducts = supplierChosen && !loadingVariants && options.length === 0;
  const chosenIds = form.items
    .map((item) => item.product_variant_id)
    .filter(Boolean);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isEdit
          ? `Edit Pembelian — ${purchase.invoice_number ?? "-"}`
          : "Tambah Pembelian"
      }
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
            form="purchase-form"
            disabled={saving || loadingSuppliers || loadingVariants}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {saving
              ? "Menyimpan..."
              : isEdit
                ? "Simpan Perubahan"
                : "Simpan Pembelian"}
          </button>
        </>
      }
    >
      <form id="purchase-form" onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {formError}
          </div>
        )}

        {notice && (
          <div className="px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-sm">
            {notice}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label>
            <span className="block text-sm font-medium text-on-surface-variant mb-1">
              Supplier
            </span>

            <select
              value={form.supplier_id}
              onChange={(e) => handleSupplierChange(e.target.value)}
              className={`${inputClass} cursor-pointer ${
                getError("supplier_id") ? "border-error" : ""
              }`}
              required
            >
              <option value="">
                {loadingSuppliers ? "Memuat..." : "Pilih supplier"}
              </option>

              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>

            {getError("supplier_id") ? (
              <span className="text-xs text-error mt-1 block">
                {getError("supplier_id")}
              </span>
            ) : (
              supplierChosen &&
              !loadingVariants && (
                <span className="text-xs text-outline mt-1 block">
                  {options.length} variasi produk tersedia
                </span>
              )
            )}
          </label>

          {/* <label>
            <span className="block text-sm font-medium text-on-surface-variant mb-1">
              No. Invoice
            </span>

            <input
              value={isEdit ? (purchase.invoice_number ?? "") : ""}
              placeholder="Otomatis"
              disabled
              readOnly
              className={inputClass}
            />

            {getError("invoice_number") ? (
              <span className="text-xs text-error mt-1 block">
                {getError("invoice_number")}
              </span>
            ) : (
              !isEdit && (
                <span className="text-xs text-outline mt-1 block">
                  Dibuat otomatis saat disimpan.
                </span>
              )
            )}
          </label> */}

          <label>
            <span className="block text-sm font-medium text-on-surface-variant mb-1">
              Tanggal Pembelian
            </span>

            <input
              type="date"
              value={form.purchase_date}
              onChange={(e) => setField("purchase_date", e.target.value)}
              className={`${inputClass} ${
                getError("purchase_date") ? "border-error" : ""
              }`}
              required
            />

            {getError("purchase_date") && (
              <span className="text-xs text-error mt-1 block">
                {getError("purchase_date")}
              </span>
            )}
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <div>
            <h2 className="font-display font-semibold text-base text-on-surface">
              Item Pembelian
            </h2>

            <p className="text-xs text-outline mt-0.5">
              Hanya produk milik supplier yang dipilih yang bisa ditambahkan.
            </p>
          </div>

          <button
            type="button"
            onClick={addItem}
            disabled={!supplierChosen || options.length === 0}
            title="Tambah item"
            aria-label="Tambah item"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span className="hidden sm:inline">Tambah Item</span>
          </button>
        </div>

        {getError("items") && (
          <p className="px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {getError("items")}
          </p>
        )}

        {!supplierChosen ? (
          <div className="py-8 text-center text-sm text-outline rounded-xl border border-dashed border-outline-variant">
            Pilih supplier dulu untuk menampilkan produknya.
          </div>
        ) : loadingVariants ? (
          <div className="py-8 text-center text-sm text-outline">
            Memuat produk supplier...
          </div>
        ) : noProducts ? (
          <div className="py-8 px-4 text-center text-sm text-outline rounded-xl border border-dashed border-outline-variant">
            Supplier ini belum punya produk aktif. Tambahkan produknya dulu di
            menu Produk.
          </div>
        ) : (
          <div className="space-y-3">
            {form.items.map((item, index) => {
              const subtotal = Number(item.qty || 0) * Number(item.price || 0);

              return (
                <div
                  key={item._key}
                  className="rounded-xl border border-outline-variant p-3"
                >
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_90px_150px_auto] gap-3 items-start">
                    <VariantSearch
                      value={item.product_variant_id}
                      options={options}
                      excludeIds={chosenIds.filter(
                        (id) => id !== item.product_variant_id,
                      )}
                      error={getItemError(index, "product_variant_id")}
                      onSelect={(variant) => pickVariant(index, variant)}
                    />

                    <label>
                      <span className="block text-sm font-medium text-on-surface-variant mb-1">
                        Qty
                      </span>

                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) =>
                          updateItem(index, { qty: e.target.value })
                        }
                        className={`${inputClass} ${
                          getItemError(index, "qty") ? "border-error" : ""
                        }`}
                        required
                      />

                      {getItemError(index, "qty") && (
                        <span className="text-xs text-error mt-1 block">
                          {getItemError(index, "qty")}
                        </span>
                      )}
                    </label>

                    <label>
                      <span className="block text-sm font-medium text-on-surface-variant mb-1">
                        Harga Beli
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.price}
                        onChange={(e) =>
                          updateItem(index, { price: e.target.value })
                        }
                        className={`${inputClass} ${
                          getItemError(index, "price") ? "border-error" : ""
                        }`}
                        placeholder="0"
                        required
                      />

                      {getItemError(index, "price") && (
                        <span className="text-xs text-error mt-1 block">
                          {getItemError(index, "price")}
                        </span>
                      )}
                    </label>

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={form.items.length <= 1}
                      className="md:mt-6 h-10 px-3 rounded-lg border border-error text-error hover:bg-error-container/30 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Hapus item"
                    >
                      <span className="material-symbols-outlined text-[19px]">
                        delete
                      </span>
                    </button>
                  </div>

                  <div className="mt-2 text-right text-xs text-outline">
                    Subtotal:{" "}
                    <span className="font-semibold text-on-surface">
                      {formatRupiah(subtotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end border-t border-outline-variant pt-4">
          <div className="text-right">
            <p className="text-xs text-outline">Total Pembelian</p>

            <p className="text-xl font-bold font-tnum text-on-surface">
              {formatRupiah(calculateTotal())}
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
}
