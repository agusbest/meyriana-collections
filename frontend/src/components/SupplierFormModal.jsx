import { useEffect, useState } from 'react';
import client from '../api/client';
import Modal from './Modal';

const EMPTY_FORM = { name: '', phone: '', address: '' };

const inputClass =
  'w-full px-3 rounded-lg border bg-surface-container-lowest text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

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

export default function SupplierFormModal({ open, supplier, onClose, onSaved }) {
  const isEdit = Boolean(supplier);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form setiap modal dibuka
  useEffect(() => {
    if (open) {
      setForm({
        name: supplier?.name ?? '',
        phone: supplier?.phone ?? '',
        address: supplier?.address ?? '',
      });
      setErrors({});
      setFormError('');
    }
  }, [open, supplier]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const fieldClass = (key, height = 'h-10') =>
    `${inputClass} ${height} ${errors[key] ? 'border-error' : 'border-outline-variant'}`;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError('');

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    };

    try {
      const res = isEdit
        ? await client.put(`/suppliers/${supplier.id}`, payload)
        : await client.post('/suppliers', payload);
      onSaved(res.data, isEdit);
    } catch (err) {
      if (err.response?.status === 422) {
        const raw = err.response.data.errors ?? {};
        setErrors(Object.fromEntries(Object.entries(raw).map(([key, msgs]) => [key, msgs[0]])));
      } else {
        setFormError(err.response?.data?.message ?? 'Terjadi kesalahan. Silakan coba lagi.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Supplier' : 'Tambah Supplier'}
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
            form="supplier-form"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Supplier'}
          </button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <p className="px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {formError}
          </p>
        )}

        <Field label="Nama Supplier" error={errors.name}>
          <input
            value={form.name}
            onChange={set('name')}
            placeholder="Contoh: Konveksi Bunda Bandung"
            className={fieldClass('name')}
            required
            autoFocus={!isEdit}
          />
        </Field>

        <Field
          label="No. Telepon / WhatsApp"
          error={errors.phone}
          hint="Boleh diawali 0 atau +62, nanti otomatis jadi link WhatsApp."
        >
          <input
            type="tel"
            value={form.phone}
            onChange={set('phone')}
            placeholder="0812xxxxxxxx"
            className={fieldClass('phone')}
          />
        </Field>

        <Field label="Alamat" error={errors.address}>
          <textarea
            value={form.address}
            onChange={set('address')}
            rows={3}
            placeholder="Alamat lengkap supplier (opsional)"
            className={`${fieldClass('address', 'py-2')} resize-none`}
          />
        </Field>
      </form>
    </Modal>
  );
}
