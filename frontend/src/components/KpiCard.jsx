// Palet warna per kategori KPI. Dipakai untuk ikon dan glow lembut di pojok kartu,
// supaya tiap kartu punya identitas visual tanpa jadi ramai.
const TONE_STYLES = {
  blue: { icon: "bg-blue-500/10 text-blue-600", glow: "bg-blue-400/25" },
  violet: {
    icon: "bg-violet-500/10 text-violet-600",
    glow: "bg-violet-400/25",
  },
  sky: { icon: "bg-sky-500/10 text-sky-600", glow: "bg-sky-400/25" },
  amber: { icon: "bg-amber-500/10 text-amber-600", glow: "bg-amber-400/25" },
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-600",
    glow: "bg-emerald-400/25",
  },
  rose: { icon: "bg-rose-500/10 text-rose-600", glow: "bg-rose-400/25" },
  teal: { icon: "bg-teal-500/10 text-teal-600", glow: "bg-teal-400/25" },
  slate: { icon: "bg-slate-500/10 text-slate-600", glow: "bg-slate-400/20" },
};

export default function KpiCard({
  label,
  icon,
  tone = "slate",
  badge,
  badgeColor = "emerald",
  value,
  suffix,
  note,
  noteIcon,
}) {
  const badgeColors = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    neutral: "bg-surface-container text-on-surface-variant border-transparent",
  };

  const t = TONE_STYLES[tone] ?? TONE_STYLES.slate;

  return (
    <div className="relative overflow-hidden p-4 rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
      {/* Glow warna lembut di pojok, memberi aksen tanpa ramai */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl ${t.glow}`}
      />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && (
            <span
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.icon}`}
            >
              <span className="material-symbols-outlined text-[19px]">
                {icon}
              </span>
            </span>
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-outline truncate">
            {label}
          </span>
        </div>

        {badge && (
          <span
            className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeColors[badgeColor]}`}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="relative mt-3 flex items-baseline gap-2">
        {/* Nominal panjang (mis. Rp 125.000.000) pakai huruf sedikit lebih kecil supaya tidak keluar kartu */}
        <span
          className={`${String(value ?? "").length > 13 ? "text-2xl" : "text-3xl"} font-bold font-tnum text-on-surface break-words`}
        >
          {value}
        </span>
        {suffix && <span className="text-sm text-outline">{suffix}</span>}
      </div>

      {note && (
        <div className="relative mt-2 text-sm text-on-surface-variant flex items-center gap-1.5">
          {noteIcon && (
            <span className="material-symbols-outlined text-[15px] text-primary">
              {noteIcon}
            </span>
          )}
          <span>{note}</span>
        </div>
      )}
    </div>
  );
}
