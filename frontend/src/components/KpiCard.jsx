export default function KpiCard({ label, badge, badgeColor = 'emerald', value, suffix, note, noteIcon }) {
  const badgeColors = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    neutral: 'bg-surface-container text-on-surface-variant border-transparent',
  };

  return (
    <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-outline">{label}</span>
        {badge && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeColors[badgeColor]}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-3xl font-bold font-tnum text-on-surface">{value}</span>
        {suffix && <span className="text-sm text-outline">{suffix}</span>}
      </div>
      {note && (
        <div className="mt-2 text-sm text-on-surface-variant flex items-center gap-1.5">
          {noteIcon && <span className="material-symbols-outlined text-[15px] text-primary">{noteIcon}</span>}
          <span>{note}</span>
        </div>
      )}
    </div>
  );
}
