import { useEffect, useState } from "react";
import client from "../api/client";

function formatRupiah(n) {
  return `Rp ${Math.round(Number(n ?? 0)).toLocaleString("id-ID")}`;
}

/** Setting -> Biaya per Pesanan */
export default function OrderCost() {
  const [amount, setAmount] = useState("");
  const [covered, setCovered] = useState([]);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [toast, setToast] = useState("");

  function apply(data) {
    setAmount(String(Math.round(Number(data.packing_cost_per_order ?? 0))));
    setCovered(data.covered_categories ?? []);
    setAvailable(data.available_categories ?? []);
  }

  useEffect(() => {
    client
      .get("/settings/order-cost")
      .then((res) => apply(res.data))
      .catch(() =>
        setError("Gagal memuat pengaturan. Pastikan backend sedang berjalan."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Kategori yang dicentang tapi sudah tidak dipakai lagi tetap ditampilkan
  const categories = [...new Set([...available, ...covered])].sort((a, b) =>
    a.localeCompare(b),
  );
  const isCovered = (c) =>
    covered.some((x) => x.toLowerCase() === c.toLowerCase());

  function toggle(c) {
    setCovered((list) =>
      isCovered(c)
        ? list.filter((x) => x.toLowerCase() !== c.toLowerCase())
        : [...list, c],
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setFieldError("");

    try {
      const res = await client.put("/settings/order-cost", {
        packing_cost_per_order: Number(amount || 0),
        covered_categories: covered,
      });
      apply(res.data);
      setToast("Biaya per pesanan disimpan");
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors?.packing_cost_per_order)
        setFieldError(errors.packing_cost_per_order[0]);
      else setError(err.response?.data?.message ?? "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  const value = Number(amount || 0);

  return (
    <>
      <section className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden max-w-3xl">
        <div className="p-4 border-b border-surface-container-high">
          <h1 className="font-display font-semibold text-lg text-on-surface">
            Biaya per Pesanan
          </h1>
          <p className="text-sm text-on-surface-variant">
            Biaya packing (plastik, kertas thermal, dll) yang otomatis
            dibebankan ke setiap pesanan baru, supaya laba per pesanan dan per
            produk lebih akurat.
          </p>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-outline">Memuat...</p>
        ) : (
          <form onSubmit={handleSave} className="p-4 space-y-5 text-sm">
            {error && (
              <p
                role="alert"
                className="px-3 py-2 rounded-lg bg-error-container text-on-error-container"
              >
                {error}
              </p>
            )}

            <label className="block max-w-xs">
              <span className="block font-medium text-on-surface-variant mb-1">
                Biaya per pesanan (Rp)
              </span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="Biaya per pesanan"
                className={`w-full h-10 px-3 rounded-lg border bg-surface-container-lowest outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                  fieldError ? "border-error" : "border-outline-variant"
                }`}
              />
              {fieldError ? (
                <span className="block mt-1 text-xs text-error">
                  {fieldError}
                </span>
              ) : (
                <span className="block mt-1 text-xs text-outline">
                  Contoh: plastik Rp120 + thermal Rp80 + lakban Rp50 = Rp250.
                  Isi 0 untuk mematikan.
                </span>
              )}
            </label>

            <div>
              <p className="font-medium text-on-surface-variant mb-1">
                Kategori Biaya Operasional yang sudah tercakup
              </p>
              <p className="text-xs text-outline mb-2">
                Belanja kategori yang dicentang tidak memotong lagi Laba Bersih
                di Dashboard, karena biayanya sudah dihitung per pesanan. Ini
                mencegah biaya terhitung dua kali.
              </p>

              {categories.length === 0 ? (
                <p className="text-xs text-outline italic">
                  Belum ada kategori di Biaya Operasional.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <label
                      key={c}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer ${
                        isCovered(c)
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-outline-variant"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isCovered(c)}
                        onChange={() => toggle(c)}
                        className="accent-primary"
                      />
                      {c}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg bg-surface-container-low px-3 py-2.5 text-on-surface-variant">
              {value > 0 ? (
                <>
                  Setiap pesanan baru (manual maupun impor) akan dipotong{" "}
                  <b className="text-on-surface">{formatRupiah(value)}</b> dari
                  labanya. Pesanan lama tidak berubah.
                </>
              ) : (
                <>
                  Biaya per pesanan tidak aktif. Semua Biaya Operasional
                  memotong Laba Bersih di Dashboard.
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary-container transition-colors disabled:opacity-60"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </form>
        )}
      </section>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-2.5 rounded-lg bg-inverse-surface text-inverse-on-surface text-sm shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
