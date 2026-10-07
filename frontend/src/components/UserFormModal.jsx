import { useEffect, useState } from 'react';
import client from '../api/client';
import Modal from './Modal';

const inputClass =
  'w-full px-3 rounded-lg border bg-surface-container-lowest text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-surface-container-low disabled:text-outline';

const ROLES = [
  { value: 'staff', label: 'Staf', hint: 'Semua menu kecuali Dashboard dan Pengguna.' },
  { value: 'admin', label: 'Admin', hint: 'Semua menu, termasuk Dashboard dan kelola pengguna.' },
];

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

export default function UserFormModal({ open, user, isSelf, onClose, onSaved }) {
  const isEdit = Boolean(user);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', is_active: true });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: user?.name ?? '',
      email: user?.email ?? '',
      password: '',
      role: user?.role ?? 'staff',
      is_active: user?.is_active ?? true,
    });
    setShowPassword(false);
    setErrors({});
    setFormError('');
  }, [open, user]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const fieldClass = (key) => `${inputClass} h-10 ${errors[key] ? 'border-error' : 'border-outline-variant'}`;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError('');

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      is_active: form.is_active,
    };
    if (form.password) payload.password = form.password;

    try {
      const res = isEdit
        ? await client.put(`/users/${user.id}`, payload)
        : await client.post('/users', payload);
      onSaved(res.data, isEdit);
    } catch (err) {
      if (err.response?.status === 422) {
        const raw = err.response.data.errors ?? {};
        setErrors(Object.fromEntries(Object.entries(raw).map(([key, msgs]) => [key, msgs[0]])));
        if (!Object.keys(raw).length) setFormError(err.response.data.message ?? 'Data tidak valid.');
      } else {
        setFormError(err.response?.data?.message ?? 'Terjadi kesalahan. Silakan coba lagi.');
      }
    } finally {
      setSaving(false);
    }
  }

  const roleHint = ROLES.find((r) => r.value === form.role)?.hint;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Pengguna' : 'Tambah Pengguna'}
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
            form="user-form"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Pengguna'}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <p role="alert" className="px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {formError}
          </p>
        )}

        <Field label="Nama" error={errors.name}>
          <input
            value={form.name}
            onChange={set('name')}
            placeholder="Contoh: Siti (Admin Gudang)"
            className={fieldClass('name')}
            required
            autoFocus={!isEdit}
          />
        </Field>

        <Field label="Email (untuk login)" error={errors.email}>
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="nama@contoh.com"
            className={fieldClass('email')}
            required
          />
        </Field>

        <Field
          label="Password"
          error={errors.password}
          hint={isEdit ? 'Kosongkan kalau tidak diganti. Minimal 8 karakter.' : 'Minimal 8 karakter.'}
        >
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              className={`${fieldClass('password')} pr-10`}
              required={!isEdit}
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[20px]">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </Field>

        <Field
          label="Peran"
          error={errors.role}
          hint={isSelf ? 'Peran akun sendiri tidak bisa diubah.' : roleHint}
        >
          <select
            value={form.role}
            onChange={set('role')}
            disabled={isSelf}
            className={`${fieldClass('role')} cursor-pointer`}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        {isEdit && !isSelf && (
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="mt-0.5 accent-primary"
            />
            <span className="text-sm">
              <span className="font-medium text-on-surface">Akun aktif</span>
              <span className="block text-xs text-outline">
                Kalau dimatikan, pengguna ini tidak bisa login dan langsung keluar dari semua perangkat.
              </span>
            </span>
          </label>
        )}
      </form>
    </Modal>
  );
}
