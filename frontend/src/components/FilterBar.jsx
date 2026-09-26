import { useState } from 'react';

const PRESETS = [
  { key: 'today', label: 'Hari Ini' },
  { key: '7days', label: '7 Hari' },
  { key: 'month', label: 'Bulan Ini' },
  { key: 'custom', label: 'Custom' },
];

function presetToRange(key) {
  const now = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);

  if (key === 'today') {
    return { date_from: fmt(now), date_to: fmt(now) };
  }
  if (key === '7days') {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { date_from: fmt(from), date_to: fmt(now) };
  }
  // 'month' (default)
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { date_from: fmt(from), date_to: fmt(to) };
}

export default function FilterBar({ marketplaces = [], onApply }) {
  const [preset, setPreset] = useState('month');
  const [range, setRange] = useState(presetToRange('month'));
  const [marketplaceId, setMarketplaceId] = useState('');

  function handlePreset(key) {
    setPreset(key);
    if (key !== 'custom') {
      setRange(presetToRange(key));
    }
  }

  function handleApply() {
    onApply({
      date_from: range.date_from,
      date_to: range.date_to,
      marketplace_id: marketplaceId || undefined,
    });
  }

  return (
    <section className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Quick Presets */}
        <div className="flex items-center p-0.5 rounded-lg bg-surface-container-low border border-outline-variant/60 text-sm">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => handlePreset(p.key)}
              className={`px-2.5 py-1 rounded transition-colors ${
                preset === p.key
                  ? 'bg-surface-container-lowest text-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date Range */}
        {preset === 'custom' ? (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={range.date_from}
              onChange={(e) => setRange((r) => ({ ...r, date_from: e.target.value }))}
              className="px-2 py-1.5 rounded-lg border border-outline-variant text-sm"
            />
            <span className="text-outline text-sm">—</span>
            <input
              type="date"
              value={range.date_to}
              onChange={(e) => setRange((r) => ({ ...r, date_to: e.target.value }))}
              className="px-2 py-1.5 rounded-lg border border-outline-variant text-sm"
            />
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline-variant text-sm font-medium font-tnum">
            <span className="material-symbols-outlined text-[18px] text-outline">calendar_today</span>
            {range.date_from} - {range.date_to}
          </div>
        )}

        {/* Marketplace Dropdown */}
        <select
          value={marketplaceId}
          onChange={(e) => setMarketplaceId(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest cursor-pointer hover:border-primary transition-colors"
        >
          <option value="">Semua Marketplace</option>
          {marketplaces.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={handleApply}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold transition-all active:scale-[0.98]"
      >
        <span className="material-symbols-outlined text-[18px]">filter_alt</span>
        Terapkan Filter
      </button>
    </section>
  );
}
