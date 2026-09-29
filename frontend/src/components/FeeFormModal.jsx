import { useEffect, useState } from "react";
import client from "../api/client";
import Modal from "./Modal";

// Saran nama biaya yang umum di marketplace (tetap bisa diketik bebas)
const NAME_SUGGESTIONS = [
  "Biaya Admin",
  "Biaya Layanan",
  "Biaya Transaksi",
  "Biaya Proses Pesanan",
  "Komisi",
  "Gratis Ongkir Xtra",
  "Cashback Xtra",
  "Biaya Affiliate",
  "Biaya Tetap per Pesanan",
];

const SAMPLE_REVENUE = 100000;

const EMPTY_FORM = { name: "", type: "percentage", value: "", is_active: true };

const inputBase =
  "w-full h-10 px-3 rounded-lg border bg-surface-container-lowest text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function formatRupiah(n) {
  return `Rp ${Number(n ?? 0).toLocaleString("id-ID")}`;
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

export default function FeeFormModal({
  open,
  marketplace,
  fee,
  onClose,
  onSaved,
}) {
  const isEdit = Boolean(fee);

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form setiap modal dibuka
  useEffect(() => {
    if (!open) return;

    setForm(
      fee
        ? {
            name: fee.name ?? "",
            type: fee.type ?? "percentage",
            value: String(Number(fee.value ?? 0)),
            is_active: Boolean(fee.is_active),
          }
        : EMPTY_FORM,
    );

    setErrors({});
    setFormError("");
  }, [open, fee]);

  const setField = (key) => (e) =>
    setForm((current) => ({ ...current, [key]: e.target.value }));

  const fieldClass = (key) =>
    `${inputBase} ${errors[key] ? "border-error" : "border-outline-variant"}`;

  const isPercentage = form.type === "percentage";
  const value = Number(form.value || 0);

  const sampleFee = isPercentage ? (SAMPLE_REVENUE * value) / 100 : value;

  async function handleSubmit(e) {
    e.preventDefault();

    setSaving(true);
    setErrors({});
    setFormError("");

    const payload = {
      name: form.name.trim(),
      type: form.type,
      value,
      is_active: form.is_active,
    };

    try {
      const res = isEdit
        ? await client.put(`/fees/${fee.id}`, payload)
        : await client.post(`/marketplaces/${marketplace.id}/fees`, payload);

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
      title={isEdit ? "Edit Biaya" : `Tambah Biaya ${marketplace?.name ?? ""}`}
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
            form="fee-form"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Biaya"}
          </button>
        </>
      }
    >
      <form id="fee-form" onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <p className="px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {formError}
          </p>
        )}

        <Field label="Nama Biaya" error={errors.name}>
          <input
            value={form.name}
            onChange={setField("name")}
            list="fee-name-list"
            placeholder="Contoh: Biaya Admin"
            className={fieldClass("name")}
            required
            autoFocus={!isEdit}
          />

          <datalist id="fee-name-list">
            {NAME_SUGGESTIONS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>

        <div>
          <span className="block text-sm font-medium text-on-surface-variant mb-1">
            Tipe Biaya
          </span>

          <div className="grid grid-cols-2 gap-2">
            {[
              ["percentage", "Persentase (%)", "Dihitung dari omzet"],
              ["fixed", "Nominal Tetap (Rp)", "Sama untuk tiap pesanan"],
            ].map(([type, label, hint]) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm((current) => ({ ...current, type }))}
                className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                  form.type === type
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-outline-variant hover:bg-surface-container-low"
                }`}
              >
                <span className="block text-sm font-semibold text-on-surface">
                  {label}
                </span>

                <span className="block text-xs text-outline">{hint}</span>
              </button>
            ))}
          </div>

          {errors.type && (
            <span className="block mt-1 text-xs text-error">{errors.type}</span>
          )}
        </div>

        <Field label="Nilai" error={errors.value}>
          <div className="relative">
            {!isPercentage && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-outline">
                Rp
              </span>
            )}

            <input
              type="number"
              min="0"
              max={isPercentage ? 100 : undefined}
              step="any"
              value={form.value}
              onChange={setField("value")}
              placeholder="0"
              className={`${fieldClass("value")} ${isPercentage ? "pr-9" : "pl-9"}`}
              required
            />

            {isPercentage && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-outline">
                %
              </span>
            )}
          </div>
        </Field>

        {form.value !== "" && (
          <p className="text-xs px-3 py-2 rounded-lg bg-surface-container-low text-on-surface-variant">
            Contoh: dari omzet {formatRupiah(SAMPLE_REVENUE)}, biaya ini menjadi{" "}
            <span className="font-semibold text-on-surface">
              {formatRupiah(sampleFee)}
            </span>
            .
          </p>
        )}

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
              Biaya aktif
            </span>

            <span className="block text-xs text-outline">
              Hanya biaya aktif yang dihitung saat membuat penjualan baru.
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
}
