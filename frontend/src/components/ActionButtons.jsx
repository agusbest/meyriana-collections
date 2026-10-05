const base =
  "w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors";

const tones = {
  view: "text-sky-600 bg-sky-50 hover:bg-sky-100",
  edit: "text-amber-600 bg-amber-50 hover:bg-amber-100",
  delete: "text-red-600 bg-red-50 hover:bg-red-100",
};

function ActionButton({ tone, icon, title, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`${base} ${tones[tone]}`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
}

export default function ActionButtons({ onView, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-center gap-1">
      {onView && (
        <ActionButton
          tone="view"
          icon="visibility"
          title="Lihat Detail"
          onClick={onView}
        />
      )}
      {onEdit && (
        <ActionButton tone="edit" icon="edit" title="Edit" onClick={onEdit} />
      )}
      {onDelete && (
        <ActionButton
          tone="delete"
          icon="delete"
          title="Hapus"
          onClick={onDelete}
        />
      )}
    </div>
  );
}
