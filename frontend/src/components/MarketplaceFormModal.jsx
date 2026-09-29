import { useEffect, useState } from "react";
import client from "../api/client";
import Modal from "./Modal";

const inputBase =
  "w-full h-10 px-3 rounded-lg border bg-surface-container-lowest text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

// "TikTok Shop" -> "tiktok_shop"
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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

export default function MarketplaceFormModal({
  open,
  marketplace,
  onClose,
  onSaved,
}) {
  const isEdit = Boolean(marketplace);

  const [form, setForm] = useState({ name: "", code: "", is_active: true });
  const [codeTouched, setCodeTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form setiap modal dibuka
  useEffect(() => {
    if (!open) return;

    setForm({
      name: marketplace?.name ?? "",
      code: marketplace?.code ?? "",
      is_active: marketplace ? Boolean(marketplace.is_active) : true,
    });

    // Saat edit, kode yang sudah ada tidak ditimpa otomatis
    setCodeTouched(isEdit);
    setErrors({});
    setFormError("");
  }, [open, marketplace, isEdit]);

  const fieldClass = (key) =>
    `${inputBase} ${errors[key] ? "border-error" : "border-outline-variant"}`;

  function handleNameChange(e) {
    const name = e.target.value;

    setForm((current) => ({
      ...current,
      name,
      // Kode mengikuti nama sampai kamu mengubah kode secara manual
      code: codeTouched ? current.code : slugify(name),
    }));
  }

  function handleCodeChange(e) {
    setCodeTouched(true);

    setForm((current) => ({
      ...current,
      code: e.target.value.toLowerCase().replace(/\s+/g, "_"),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setSaving(true);
    setErrors({});
    setFormError("");

    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      is_active: form.is_active,
    };

    try {
      const res = isEdit
        ? await client.put(`/marketplaces/${marketplace.id}`, payload)
        : await client.post("/marketplaces", payload);

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
          err.response?.data?.message ?? "Terjadi kesalahan. Silakan coba lagi.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Marketplace" : "Tambah Marketplace"}
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
            form="marketplace-form"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {saving
              ? "Menyimpan..."
              : isEdit
                ? "Simpan Perubahan"
                : "Simpan Marketplace"}
          </button>
        </>
      }
    >
      <form id="marketplace-form" onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <p className="px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {formError}
          </p>
        )}

        <Field label="Nama Marketplace" error={errors.name}>
          <input
            value={form.name}
            onChange={handleNameChange}
            placeholder="Contoh: Shopee"
            className={fieldClass("name")}
            required
            autoFocus={!isEdit}
          />
        </Field>

        <Field
          label="Kode"
          error={errors.code}
          hint="Huruf kecil tanpa spasi. Dipakai untuk warna di dashboard (shopee, tokopedia, lazada, tiktok_shop)."
        >
          <input
            value={form.code}
            onChange={handleCodeChange}
            placeholder="shopee"
            className={`${fieldClass("code")} font-mono`}
            required
          />
        </Field>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) =>
              setForm((current) => ({ ...current, is_active: e.target.checked }))
            }
            className="mt-0.5 w-4 h-4 accent-primary"
          />

          <span>
            <span className="block text-sm font-medium text-on-surface">
              Marketplace aktif
            </span>

            <span className="block text-xs text-outline">
              Marketplace nonaktif tidak muncul di form penjualan.
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
}
