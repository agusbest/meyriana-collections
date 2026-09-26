import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function ProfitChart({ data }) {
  // data contoh: [{ date: '01', gross: 1500000, profit: 400000 }, ...]
  return (
    <div className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-semibold text-on-surface">Tren Harian Profit Real vs Omzet Kotor</h2>
          <p className="text-sm text-on-surface-variant">Diperbarui secara real-time</p>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-secondary" />
            <span className="text-outline">Gross Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-primary" />
            <span className="text-primary font-bold">Profit Real</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => `Rp ${Number(v).toLocaleString('id-ID')}`} />
          <Bar dataKey="gross" fill="#cbdbf5" radius={[4, 4, 0, 0]} name="Gross Revenue" />
          <Bar dataKey="profit" fill="#00685f" radius={[4, 4, 0, 0]} name="Profit Real" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
