import Modal from './Modal';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Hapus',
  busy = false,
  error = '',
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-outline-variant text-sm text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-error text-on-error text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {busy ? 'Memproses...' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-on-surface-variant">{message}</p>
      {error && (
        <p className="mt-3 px-3 py-2 rounded-lg bg-error-container text-on-error-container text-sm">
          {error}
        </p>
      )}
    </Modal>
  );
}
