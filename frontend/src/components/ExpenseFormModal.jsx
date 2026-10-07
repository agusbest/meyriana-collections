import { useEffect, useMemo, useState } from "react";
import client from "../api/client";
import Modal from "./Modal";

// Saran kategori bawaan; kategori yang pernah kamu pakai ikut muncul di atasnya
const DEFAULT_CATEGORIES = [
  "Kemasan",
  "Kertas Thermal",
  "Lakban & Isolasi",
  "Alat Tulis",
  "Listrik & Internet",
  "Upah",
  "Transportasi",
  "Lain-lain",
];

const NEW_CATEGORY = "__new__"; // nilai opsi "+ Kategori baru..." di dropdown

const UNIT_SUGGESTIONS = ["pcs", "roll", "pack", "box", "lembar", "kg", "meter"];

const inputBase =
  "w-full h-10 px-3 rounded-lg border bg-surface-container-lowest text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

// Tanggal hari ini menurut jam lokal (bukan UTC), format YYYY-MM-DD
function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyForm() {
  return { expense_date: today(), category: "", name: "", qty: "", unit: "", amount: "", notes: "" };
}

function toForm(expense) {
  if (!expense) return emptyForm();

  return {
    expense_date: String(expense.expense_date ?? "").slice(0, 10),
    category: expense.category ?? "",
    name: expense.name ?? "",
    qty: expense.qty !== null && expense.qty !== undefined ? String(Number(expense.qty)) : "",
    unit: expense.unit ?? "",
    amount: String(Number(expense.amount ?? 0)),
    notes: expense.notes ?? "",
  };
}

function formatRupiahDec(n) {
  return `Rp ${Number(n ?? 0).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-on-surface-variant mb-1">{label}</span>

      {children}

      {error ? (
        <span className="block mt-1 text-xs text-error">{error}</span>
      ) : (
        hint && <span className="block mt-1 text-xs text-outline">{hint}</span>
      )}
    </label>
  );
}

export default function ExpenseFormModal({ open, expense, categories = [], onClose, onSaved }) {
  const isEdit = Boolean(expense);

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [customMode, setCustomMode] = useState(false); // true = pengguna mengetik nama kategori baru

  // Reset form setiap modal dibuka
  useEffect(() => {
    if (!open) return;

    setForm(toForm(expense));
    setErrors({});
    setFormError("");
    setCustomMode(false);
  }, [open, expense]);

  // Kategori yang pernah dipakai di depan, lalu bawaan; tanpa duplikat (tidak peka huruf besar/kecil)
  const suggestions = useMemo(() => {
    const seen = new Set();

    return [...categories, ...DEFAULT_CATEGORIES].filter((c) => {
      const key = String(c).trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [categories]);

  // Opsi dropdown. Kategori biaya yang sedang diedit tetap tampil walau tidak ada di daftar.
  const options = useMemo(() => {
    const list = [...suggestions];
    const current = form.category.trim();

    if (!customMode && current && !list.some((c) => c.toLowerCase() === current.toLowerCase())) {
      list.unshift(current);
    }

    return list;
  }, [suggestions, form.category, customMode]);

  const selectedCategory = customMode
    ? NEW_CATEGORY
    : (options.find((c) => c.toLowerCase() === form.category.trim().toLowerCase()) ?? "");

  function handleCategoryChange(e) {
    const value = e.target.value;

    if (value === NEW_CATEGORY) {
      setCustomMode(true);
      setForm((f) => ({ ...f, category: "" }));
      return;
    }

    setCustomMode(false);
    setForm((f) => ({ ...f, category: value }));
  }

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const fieldClass = (key) => `${inputBase} ${errors[key] ? "border-error" : "border-outline-variant"}`;

  const qty = Number(form.qty);
  const amount = Number(form.amount);
  const unitPrice = qty > 0 && amount > 0 ? amount / qty : null;

  async function handleSubmit(e) {
    e.preventDefault();

    setSaving(true);
    setErrors({});
    setFormError("");

    const payload = {
      expense_date: form.expense_date,
      category: form.category.trim(),
      name: form.name.trim(),
      qty: form.qty === "" ? null : Number(form.qty),
      unit: form.unit.trim() || null,
      amount: Number(form.amount),
      notes: form.notes.trim() || null,
    };

    try {
      const res = isEdit
        ? await client.put(`/operational-expenses/${expense.id}`, payload)
        : await client.post("/operational-expenses", payload);

      onSaved(res.data, isEdit);
    } catch (err) {
      if (err.response?.status === 422) {
        const raw = err.response.data.errors ?? {};

        setErrors(Object.fromEntries(Object.entries(raw).map(([key, msgs]) => [key, msgs[0]])));
      } else {
        setFormError(err.response?.data?.message ?? "Terjadi kesalahan. Silakan coba lagi.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Biaya Operasional" : "Tambah Biaya Operasional"}
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
            form="expense-form"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Biaya"}
          </button>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <p className="px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">{formError}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tanggal" error={errors.expense_date}>
            <input
              type="date"
              value={form.expense_date}
              onChange={setField("expense_date")}
              className={fieldClass("expense_date")}
              required
            />
          </Field>

          <Field label="Kategori" error={customMode ? undefined : errors.category}>
            <select
              value={selectedCategory}
              onChange={handleCategoryChange}
              className={`${fieldClass("category")} cursor-pointer`}
              required={!customMode}
            >
              <option value="">Pilih kategori</option>
              {options.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={NEW_CATEGORY}>+ Kategori baru...</option>
            </select>
          </Field>
        </div>

        {customMode && (
          <Field label="Nama kategori baru" error={errors.category}>
            <input
              value={form.category}
              onChange={setField("category")}
              placeholder="Contoh: Gaji Karyawan"
              maxLength={100}
              className={fieldClass("category")}
              required
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                setCustomMode(false);
                setForm((f) => ({ ...f, category: "" }));
              }}
              className="mt-1 text-xs text-primary hover:underline"
            >
              Batal, pilih dari daftar
            </button>
          </Field>
        )}

        <Field label="Nama Biaya" error={errors.name}>
          <input
            value={form.name}
            onChange={setField("name")}
            placeholder="Contoh: Plastik packing 25x35"
            maxLength={255}
            className={fieldClass("name")}
            required
            autoFocus={!isEdit}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Jumlah dibeli (opsional)" error={errors.qty}>
            <input
              type="number"
              min="0"
              step="any"
              value={form.qty}
              onChange={setField("qty")}
              placeholder="Contoh: 500"
              className={fieldClass("qty")}
            />
          </Field>

          <Field label="Satuan (opsional)" error={errors.unit}>
            <input
              value={form.unit}
              onChange={setField("unit")}
              list="expense-unit-list"
              placeholder="pcs, roll, pack"
              maxLength={30}
              className={fieldClass("unit")}
            />
            <datalist id="expense-unit-list">
              {UNIT_SUGGESTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Field>
        </div>

        <Field label="Total harga" error={errors.amount}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-outline">Rp</span>
            <input
              type="number"
              min="0"
              step="any"
              value={form.amount}
              onChange={setField("amount")}
              placeholder="0"
              className={`${fieldClass("amount")} pl-9`}
              required
            />
          </div>
        </Field>

        {unitPrice !== null && (
          <p className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 text-xs">
            Harga per satuan: <span className="font-semibold">{formatRupiahDec(unitPrice)}</span>
            {form.unit.trim() ? ` per ${form.unit.trim()}` : ""}
          </p>
        )}

        <Field label="Catatan (opsional)" error={errors.notes}>
          <textarea
            value={form.notes}
            onChange={setField("notes")}
            rows={2}
            maxLength={1000}
            placeholder="Contoh: beli di toko A, nota no. 123"
            className={`${fieldClass("notes")} h-auto py-2 resize-none`}
          />
        </Field>
      </form>
    </Modal>
  );
}
