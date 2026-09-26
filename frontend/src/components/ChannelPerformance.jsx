function formatRupiah(n) {
  return 'Rp ' + Number(n ?? 0).toLocaleString('id-ID');
}

// Warna badge per marketplace, disamakan dengan brand color masing-masing
// platform di desain referensi (Shopee oranye, Tokopedia hijau, dst).
const MARKETPLACE_STYLE = {
  shopee: { badge: 'bg-[#FFF1EE] text-[#EE4D2D] border-[#EE4D2D]/30', card: 'border-[#EE4D2D]/20 bg-[#FFF1EE]/40 hover:bg-[#FFF1EE]' },
  tokopedia: { badge: 'bg-[#F0FAF1] text-[#03AC0E] border-[#03AC0E]/30', card: 'border-[#03AC0E]/20 bg-[#F0FAF1]/40 hover:bg-[#F0FAF1]' },
  tiktok_shop: { badge: 'bg-white text-on-surface border-outline-variant', card: 'border-slate-200 bg-slate-50 hover:bg-slate-100', dot: '#FE2C55' },
  lazada: { badge: 'bg-[#EEF2FF] text-[#002C9C] border-[#002C9C]/30', card: 'border-[#002C9C]/20 bg-[#EEF2FF]/40 hover:bg-[#EEF2FF]' },
};

function ChannelBadge({ code, name }) {
  const style = MARKETPLACE_STYLE[code] ?? { badge: 'bg-surface-container text-on-surface-variant border-outline-variant' };

  if (style.dot) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${style.badge}`}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
        {name}
      </span>
    );
  }

  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${style.badge}`}>
      {name}
    </span>
  );
}

export default function ChannelPerformance({ channels }) {
  return (
    <div className="lg:col-span-4 p-5 rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold text-on-surface">Performa Channel</h2>
        <span className="text-xs text-outline">{channels.length} Channel Terhubung</span>
      </div>
      <p className="text-sm text-on-surface-variant mb-4">
        Kontribusi laba bersih per platform e-commerce.
      </p>

      {channels.length === 0 ? (
        <p className="text-sm text-outline">Belum ada transaksi completed pada periode ini.</p>
      ) : (
        <div className="space-y-3">
          {channels.map((ch) => {
            const style = MARKETPLACE_STYLE[ch.code] ?? {};
            return (
              <div key={ch.id} className={`p-2.5 rounded-lg border transition-colors ${style.card ?? 'border-outline-variant bg-surface-container-low/40'}`}>
                <div className="flex items-center justify-between mb-1">
                  <ChannelBadge code={ch.code} name={ch.name} />
                  <span className="text-sm font-bold text-emerald-800 font-tnum">
                    Profit: {formatRupiah(ch.profit)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-on-surface-variant font-tnum">
                  <span>Omzet: {formatRupiah(ch.omzet)}</span>
                  <span className="text-outline">Biaya: {formatRupiah(ch.fee)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
