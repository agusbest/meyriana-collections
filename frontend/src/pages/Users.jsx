import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import UserFormModal from '../components/UserFormModal';
import ConfirmDialog from '../components/ConfirmDialog';

const ROLE_BADGE = {
  admin: { label: 'Admin', className: 'bg-primary/10 text-primary border border-primary/30' },
  staff: { label: 'Staf', className: 'bg-surface-container-high text-on-surface-variant' },
};

export default function Users() {
  const { user: me, setUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [toast, setToast] = useState('');

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setLoadError('');

    client
      .get('/users')
      .then((res) => {
        if (!ignore) setUsers(res.data?.data ?? res.data ?? []);
      })
      .catch((err) => {
        if (!ignore) setLoadError(err.response?.data?.message ?? 'Gagal memuat data pengguna.');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const isSelf = (u) => u && me && u.id === me.id;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(u) {
    setEditing(u);
    setFormOpen(true);
  }

  function handleSaved(saved, isEdit) {
    setFormOpen(false);
    if (isSelf(saved)) setUser((current) => ({ ...current, ...saved }));
    setToast(isEdit ? `Pengguna "${saved.name}" diperbarui` : `Pengguna "${saved.name}" ditambahkan`);
    setReloadKey((k) => k + 1);
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await client.delete(`/users/${toDelete.id}`);
      setToast(`Pengguna "${toDelete.name}" dihapus`);
      setToDelete(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setDeleteError(err.response?.data?.message ?? 'Gagal menghapus pengguna.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <section className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-container-high flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-lg text-on-surface">Pengguna</h1>
            <p className="text-sm text-on-surface-variant">
              Admin bisa membuka semua menu. Staf bisa membuka semua menu kecuali Dashboard dan Pengguna.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            title="Tambah Pengguna"
            aria-label="Tambah Pengguna"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span className="hidden sm:inline">Tambah Pengguna</span>
          </button>
        </div>

        {loadError && (
          <p className="mx-4 mt-4 px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
            {loadError}
          </p>
        )}

        <div className="overflow-x-auto custom-scroll">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/70 border-b border-outline-variant text-xs text-outline uppercase tracking-wider">
                <th className="py-3 px-4">Nama</th>
                <th className="py-3 px-4 hidden sm:table-cell">Email</th>
                <th className="py-3 px-4 text-center">Peran</th>
                <th className="py-3 px-4 text-center hidden sm:table-cell">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high text-sm">
              {loading && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-outline">Memuat...</td>
                </tr>
              )}
              {!loading && !loadError && users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-outline">Belum ada pengguna.</td>
                </tr>
              )}
              {!loading &&
                users.map((u) => {
                  const badge = ROLE_BADGE[u.role] ?? ROLE_BADGE.staff;
                  const self = isSelf(u);

                  return (
                    <tr key={u.id} className={`hover:bg-surface-container-low/40 transition-colors ${u.is_active ? '' : 'opacity-60'}`}>
                      <td className="py-3 px-4">
                        <p className="font-medium text-on-surface">
                          {u.name}
                          {self && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800">
                              Anda
                            </span>
                          )}
                        </p>
                        <p className="sm:hidden text-xs text-on-surface-variant">{u.email}</p>
                        {!u.is_active && <p className="sm:hidden text-xs text-error">Nonaktif</p>}
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell text-on-surface-variant">{u.email}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center hidden sm:table-cell">
                        {u.is_active ? (
                          <span className="text-xs font-semibold text-emerald-700">Aktif</span>
                        ) : (
                          <span className="text-xs font-semibold text-error">Nonaktif</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            title="Edit"
                            aria-label={`Edit ${u.name}`}
                            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError('');
                              setToDelete(u);
                            }}
                            disabled={self}
                            title={self ? 'Tidak bisa menghapus akun sendiri' : 'Hapus'}
                            aria-label={`Hapus ${u.name}`}
                            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-error-container/40 hover:text-error transition-colors disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      <UserFormModal
        open={formOpen}
        user={editing}
        isSelf={isSelf(editing)}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Hapus Pengguna"
        message={
          toDelete
            ? `Hapus pengguna "${toDelete.name}"? Akun ini tidak bisa login lagi. Kalau hanya sementara, lebih baik nonaktifkan lewat Edit.`
            : ''
        }
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-2.5 rounded-lg bg-inverse-surface text-inverse-on-surface text-sm shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
