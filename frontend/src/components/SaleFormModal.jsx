import { useEffect, useMemo, useState } from "react";
import client from "../api/client";
import Modal from "./Modal";

let itemSeed = 0;
const nextKey = () => ++itemSeed;

const newItem = () => ({
  _key: nextKey(),
  product_variant_id: "",
  qty: 1,
  selling_price: "",
});

const inputClass =
  "w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-surface-container disabled:cursor-not-allowed";

function formatRupiah(n) {
  const value = Number(n ?? 0);
  const sign = value < 0 ? "-" : "";

  return `${sign}Rp ${Math.abs(value).toLocaleString("id-ID")}`;
}

// Tanggal hari ini menurut jam lokal (bukan UTC), format YYYY-MM-DD
function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());

  return d.toISOString().slice(0, 10);
}

function emptyForm() {
  return {
    marketplace_id: "",
    order_number: "",
    sale_date: today(),
    other_fee: "",
    items: [newItem()],
  };
}

function variantText(variant) {
  return `${variant.product?.name ?? "Produk"} • ${variant.color || "-"} • ${variant.size || "-"}`;
}

function VariantSearch({ value, options, excludeIds, error, onSelect }) {
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
          placeholder="Ketik nama produk / warna / ukuran..."
          className={`${inputClass} pl-10 ${error ? "border-error" : ""}`}
        />
      </div>

      {selected && !open && (
        <div className="mt-1 text-xs text-outline">
          Stok tersedia:{" "}
          <span className="text-on-surface font-semibold">
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
            filtered.map((variant) => {
              const soldOut = Number(variant.stock ?? 0) <= 0;

              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={soldOut}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!soldOut) selectVariant(variant);
                  }}
                  className="w-full text-left px-3 py-2.5 hover:bg-surface-container-low transition-colors border-b border-surface-container-high last:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
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
                      <p className="text-xs text-outline">
                        {soldOut ? "Status" : "Stok"}
                      </p>

                      <p
                        className={
                          soldOut
                            ? "text-xs font-semibold text-error"
                            : "text-xs font-semibold text-on-surface"
                        }
                      >
                        {soldOut ? "Habis" : variant.stock}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {error && <span className="text-xs text-error mt-1 block">{error}</span>}
    </div>
  );
}

export default function SaleFormModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [marketplaces, setMarketplaces] = useState([]);
  const [variants, setVariants] = useState([]);

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset form + muat marketplace dan produk setiap modal dibuka
  useEffect(() => {
    if (!open) return;

    setForm(emptyForm());
    setErrors({});
    setFormError("");

    let ignore = false;

    setLoading(true);

    Promise.all([
      client.get("/marketplaces"),
      client.get("/products", { params: { is_active: 1, all: 1 } }),
    ])
      .then(([marketplaceRes, productRes]) => {
        if (ignore) return;

        const marketplaceRows = marketplaceRes.data.data ?? marketplaceRes.data;

        setMarketplaces(
          (Array.isArray(marketplaceRows) ? marketplaceRows : []).filter(
            (marketplace) => marketplace.is_active,
          ),
        );

        const productRows = productRes.data.data ?? productRes.data;
        const list = [];

        (Array.isArray(productRows) ? productRows : []).forEach((product) => {
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
            err.response?.data?.message ??
              "Gagal memuat data marketplace dan produk.",
          );
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [open]);

  const variantById = useMemo(() => {
    const map = new Map();

    variants.forEach((variant) => map.set(String(variant.id), variant));

    return map;
  }, [variants]);

  // Estimasi memakai rumus yang sama dengan backend (fee persen dari omzet, fee tetap apa adanya)
  const summary = useMemo(() => {
    const revenue = form.items.reduce(
      (total, item) =>
        total + Number(item.qty || 0) * Number(item.selling_price || 0),
      0,
    );

    const cost = form.items.reduce((total, item) => {
      const variant = variantById.get(String(item.product_variant_id));

      return total + Number(item.qty || 0) * Number(variant?.purchase_price ?? 0);
    }, 0);

    const marketplace = marketplaces.find(
      (m) => String(m.id) === String(form.marketplace_id),
    );

    const fee = (marketplace?.fees ?? [])
      .filter((f) => f.is_active)
      .reduce(
        (total, f) =>
          total +
          (f.type === "percentage"
            ? (revenue * Number(f.value)) / 100
            : Number(f.value)),
        0,
      );

    const other = Number(form.other_fee || 0);

    return {
      revenue,
      cost,
      fee,
      other,
      profit: revenue - cost - fee - other,
      hasMarketplace: Boolean(marketplace),
    };
  }, [form, variantById, marketplaces]);

  function setField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
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
    const stock = Number(variant.stock ?? 0);

    updateItem(index, {
      product_variant_id: String(variant.id),
      // Harga jual terisi otomatis dari harga variasi, tetap bisa diubah
      selling_price: Number(variant.selling_price ?? 0),
      qty: Math.max(1, Math.min(Number(item.qty || 1), stock)),
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

  async function handleSubmit(e) {
    e.preventDefault();

    setErrors({});
    setFormError("");

    if (form.items.some((item) => !item.product_variant_id)) {
      setFormError("Pilih produk / variasi untuk setiap item penjualan.");
      return;
    }

    const overStock = form.items.find((item) => {
      const variant = variantById.get(String(item.product_variant_id));

      return variant && Number(item.qty) > Number(variant.stock ?? 0);
    });

    if (overStock) {
      const variant = variantById.get(String(overStock.product_variant_id));

      setFormError(
        `Qty ${variantText(variant)} melebihi stok (tersisa ${variant.stock}).`,
      );
      return;
    }

    setSaving(true);

    const payload = {
      order_number: form.order_number.trim(),
      marketplace_id: Number(form.marketplace_id),
      sale_date: form.sale_date,
      other_fee: Number(form.other_fee || 0),
      items: form.items.map((item) => ({
        product_variant_id: Number(item.product_variant_id),
        qty: Number(item.qty),
        selling_price: Number(item.selling_price),
      })),
    };

    try {
      const res = await client.post("/sales", payload);

      onSaved(res.data);
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

  const chosenIds = form.items
    .map((item) => item.product_variant_id)
    .filter(Boolean);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tambah Penjualan"
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
            form="sale-form"
            disabled={saving || loading}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : "Simpan Penjualan"}
          </button>
        </>
      }
    >
      <form id="sale-form" onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label>
            <span className="block text-sm font-medium text-on-surface-variant mb-1">
              Marketplace
            </span>

            <select
              value={form.marketplace_id}
              onChange={(e) => setField("marketplace_id", e.target.value)}
              className={`${inputClass} cursor-pointer ${
                getError("marketplace_id") ? "border-error" : ""
              }`}
              required
            >
              <option value="">
                {loading ? "Memuat..." : "Pilih marketplace"}
              </option>

              {marketplaces.map((marketplace) => (
                <option key={marketplace.id} value={marketplace.id}>
                  {marketplace.name}
                </option>
              ))}
            </select>

            {getError("marketplace_id") && (
              <span className="text-xs text-error mt-1 block">
                {getError("marketplace_id")}
              </span>
            )}
          </label>

          <label>
            <span className="block text-sm font-medium text-on-surface-variant mb-1">
              No. Pesanan
            </span>

            <input
              value={form.order_number}
              onChange={(e) => setField("order_number", e.target.value)}
              placeholder="Nomor pesanan dari marketplace"
              className={`${inputClass} ${
                getError("order_number") ? "border-error" : ""
              }`}
              required
            />

            {getError("order_number") && (
              <span className="text-xs text-error mt-1 block">
                {getError("order_number")}
              </span>
            )}
          </label>

          <label>
            <span className="block text-sm font-medium text-on-surface-variant mb-1">
              Tanggal Penjualan
            </span>

            <input
              type="date"
              value={form.sale_date}
              onChange={(e) => setField("sale_date", e.target.value)}
              className={`${inputClass} ${
                getError("sale_date") ? "border-error" : ""
              }`}
              required
            />

            {getError("sale_date") && (
              <span className="text-xs text-error mt-1 block">
                {getError("sale_date")}
              </span>
            )}
          </label>

          <label>
            <span className="block text-sm font-medium text-on-surface-variant mb-1">
              Biaya Lain (opsional)
            </span>

            <input
              type="number"
              min="0"
              step="any"
              value={form.other_fee}
              onChange={(e) => setField("other_fee", e.target.value)}
              placeholder="0"
              className={`${inputClass} ${
                getError("other_fee") ? "border-error" : ""
              }`}
            />

            {getError("other_fee") ? (
              <span className="text-xs text-error mt-1 block">
                {getError("other_fee")}
              </span>
            ) : (
              <span className="text-xs text-outline mt-1 block">
                Contoh: subsidi ongkir atau voucher toko.
              </span>
            )}
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <div>
            <h2 className="font-display font-semibold text-base text-on-surface">
              Item Penjualan
            </h2>

            <p className="text-xs text-outline mt-0.5">
              Stok berkurang otomatis dan harga modal dicatat saat disimpan.
            </p>
          </div>

          <button
            type="button"
            onClick={addItem}
            disabled={loading}
            title="Tambah item"
            aria-label="Tambah item"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span className="hidden sm:inline">Tambah Item</span>
          </button>
        </div>

        {(getError("items") || getError("stock")) && (
          <p className="px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {getError("items") || getError("stock")}
          </p>
        )}

        {loading ? (
          <div className="py-8 text-center text-sm text-outline">
            Memuat data...
          </div>
        ) : (
          <div className="space-y-3">
            {form.items.map((item, index) => {
              const variant = variantById.get(String(item.product_variant_id));
              const stock = Number(variant?.stock ?? 0);
              const subtotal =
                Number(item.qty || 0) * Number(item.selling_price || 0);

              return (
                <div
                  key={item._key}
                  className="rounded-xl border border-outline-variant p-3"
                >
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_90px_150px_auto] gap-3 items-start">
                    <VariantSearch
                      value={item.product_variant_id}
                      options={variants}
                      excludeIds={chosenIds.filter(
                        (id) => id !== item.product_variant_id,
                      )}
                      error={getItemError(index, "product_variant_id")}
                      onSelect={(picked) => pickVariant(index, picked)}
                    />

                    <label>
                      <span className="block text-sm font-medium text-on-surface-variant mb-1">
                        Qty
                      </span>

                      <input
                        type="number"
                        min="1"
                        max={variant ? stock : undefined}
                        value={item.qty}
                        onChange={(e) =>
                          updateItem(index, { qty: e.target.value })
                        }
                        className={`${inputClass} ${
                          getItemError(index, "qty") ||
                          (variant && Number(item.qty) > stock)
                            ? "border-error"
                            : ""
                        }`}
                        required
                      />

                      {getItemError(index, "qty") ? (
                        <span className="text-xs text-error mt-1 block">
                          {getItemError(index, "qty")}
                        </span>
                      ) : (
                        variant &&
                        Number(item.qty) > stock && (
                          <span className="text-xs text-error mt-1 block">
                            Stok {stock}
                          </span>
                        )
                      )}
                    </label>

                    <label>
                      <span className="block text-sm font-medium text-on-surface-variant mb-1">
                        Harga Jual
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.selling_price}
                        onChange={(e) =>
                          updateItem(index, { selling_price: e.target.value })
                        }
                        className={`${inputClass} ${
                          getItemError(index, "selling_price")
                            ? "border-error"
                            : ""
                        }`}
                        placeholder="0"
                        required
                      />

                      {getItemError(index, "selling_price") && (
                        <span className="text-xs text-error mt-1 block">
                          {getItemError(index, "selling_price")}
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

        <div className="rounded-xl bg-surface-container-low p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant">Omzet</span>
            <span className="font-tnum font-medium text-on-surface">
              {formatRupiah(summary.revenue)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant">Modal (HPP)</span>
            <span className="font-tnum text-on-surface">
              - {formatRupiah(summary.cost)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant">
              Fee marketplace (estimasi)
            </span>
            <span className="font-tnum text-amber-700">
              {summary.hasMarketplace
                ? `- ${formatRupiah(summary.fee)}`
                : "Pilih marketplace"}
            </span>
          </div>

          {summary.other > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">Biaya lain</span>
              <span className="font-tnum text-on-surface">
                - {formatRupiah(summary.other)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-outline-variant pt-2">
            <span className="font-semibold text-on-surface">
              Profit (estimasi)
            </span>
            <span
              className={`text-lg font-bold font-tnum ${
                summary.profit < 0 ? "text-error" : "text-emerald-800"
              }`}
            >
              {formatRupiah(summary.profit)}
            </span>
          </div>
        </div>
      </form>
    </Modal>
  );
}
