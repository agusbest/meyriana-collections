import { useEffect, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import client from "../api/client";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const COLOR_OMZET = "#a7d7cf";
const COLOR_LABA = "#00685f";

function formatRupiah(n) {
  const v = Math.round(Number(n ?? 0));
  return `${v < 0 ? "-" : ""}Rp ${Math.abs(v).toLocaleString("id-ID")}`;
}

/** Angka ringkas untuk sumbu: 1.250.000 -> "1,3 jt", 450.000 -> "450 rb" */
export function formatShort(n) {
  const v = Number(n ?? 0);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3).toLocaleString("id-ID")} rb`;
  return `${sign}${abs}`;
}

/** "2026-10-03" -> "3 Okt" (tanpa konversi zona waktu) */
export function formatDay(iso) {
  const [, m, d] = String(iso).split("-").map(Number);
  return m && d ? `${d} ${BULAN[m - 1]}` : iso;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-on-surface mb-1">{formatDay(label)}</p>
      <p className="text-on-surface-variant">Omzet: <b className="text-on-surface">{formatRupiah(row.omzet)}</b></p>
      <p className="text-on-surface-variant">Laba: <b className={row.laba < 0 ? "text-error" : "text-primary"}>{formatRupiah(row.laba)}</b></p>
      <p className="text-outline mt-0.5">{row.orders} pesanan selesai</p>
    </div>
  );
}

/**
 * Grafik tren harian omzet & laba (pesanan Dana Dicairkan).
 * filters = { date_from, date_to, marketplace_id } sama dengan filter Dashboard.
 */
export default function ProfitChart({ filters = {} }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const key = JSON.stringify(filters ?? {});

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");

    const params = Object.fromEntries(Object.entries(JSON.parse(key)).filter(([, v]) => v !== "" && v != null));

    client
      .get("/dashboard/trend", { params })
      .then((res) => {
        if (!ignore) setDays(res.data?.days ?? []);
      })
      .catch(() => {
        if (!ignore) setError("Gagal memuat grafik tren.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [key]);

  const totalOmzet = days.reduce((s, d) => s + d.omzet, 0);
  const totalLaba = days.reduce((s, d) => s + d.laba, 0);
  const hasData = days.some((d) => d.orders > 0);

  return (
    <div className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm h-full flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display font-semibold text-on-surface">Tren Harian Omzet & Laba</h2>
          <p className="text-sm text-on-surface-variant">Pesanan berstatus Dana Dicairkan, per tanggal pesanan</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <div className="flex items-center gap-1.5 text-outline">
              <span className="w-3 h-3 rounded-sm" style={{ background: COLOR_OMZET }} />
              Omzet
            </div>
            <p className="font-tnum font-semibold text-on-surface" data-testid="total-omzet">{formatRupiah(totalOmzet)}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-outline">
              <span className="w-3 h-0.5 rounded" style={{ background: COLOR_LABA }} />
              Laba
            </div>
            <p className={`font-tnum font-semibold ${totalLaba < 0 ? "text-error" : "text-primary"}`} data-testid="total-laba">
              {formatRupiah(totalLaba)}
            </p>
          </div>
        </div>
      </div>

      {loading && <p className="py-20 text-center text-sm text-outline">Memuat grafik...</p>}
      {!loading && error && <p className="py-20 text-center text-sm text-error">{error}</p>}
      {!loading && !error && !hasData && (
        <p className="py-20 text-center text-sm text-outline">Belum ada pesanan selesai di periode ini.</p>
      )}

      {!loading && !error && hasData && (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={days} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tick={{ fontSize: 11 }}
              minTickGap={16}
              tickLine={false}
            />
            <YAxis tickFormatter={formatShort} tick={{ fontSize: 11 }} width={64} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,104,95,0.06)" }} />
            <ReferenceLine y={0} stroke="#9ca3af" />
            <Bar dataKey="omzet" name="Omzet" fill={COLOR_OMZET} radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Line dataKey="laba" name="Laba" stroke={COLOR_LABA} strokeWidth={2.5} dot={days.length <= 31 ? { r: 2.5 } : false} type="linear" />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
