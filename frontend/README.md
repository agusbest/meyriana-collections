# OmniProfit Analytics — Frontend (React + Vite + Tailwind)

Skeleton React yang mereplikasi desain referensi (`code.html`): sidebar teal-dark,
KPI cards, chart tren, performa channel per marketplace, dan tabel data — terhubung
ke backend Laravel yang sudah dibuat sebelumnya.

## Cara pakai

1. Install dependency:
   ```bash
   npm install
   ```

2. Copy `.env.example` ke `.env`, sesuaikan URL backend:
   ```bash
   cp .env.example .env
   ```
   ```env
   VITE_API_URL=http://127.0.0.1:8000/api
   ```

3. Pastikan backend Laravel sudah jalan (`php artisan serve`) dan CORS-nya
   mengizinkan origin `http://localhost:5173` (lihat `config/cors.php` di backend).

4. Jalankan dev server:
   ```bash
   npm run dev
   ```

5. Buka `http://localhost:5173`, login dengan akun dari seeder backend:
   - Email: `admin@example.com`
   - Password: `password`

## Struktur

```text
src/
├── api/client.js            axios instance + interceptor token Bearer
├── context/AuthContext.jsx  login/logout/me, simpan token di localStorage
├── layouts/
│   └── DashboardLayout.jsx  Sidebar + Topbar + <Outlet/>
├── components/
│   ├── Sidebar.jsx          menu: Dashboard, Produk, Histori Stok, dst
│   ├── Topbar.jsx           badge V1 Pro, notifikasi, profil user
│   ├── KpiCard.jsx          kartu metrik reusable
│   ├── ProfitChart.jsx      bar chart Gross vs Profit (recharts)
│   ├── ChannelPerformance.jsx  breakdown profit per marketplace
│   └── FilterBar.jsx        preset tanggal + dropdown marketplace
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx        halaman utama, gabungan semua komponen di atas
│   ├── Products.jsx         tabel produk + search
│   ├── StockHistory.jsx     tabel histori stok
│   ├── Purchases.jsx        tabel pembelian supplier
│   └── Sales.jsx            tabel penjualan + tombol Selesaikan/Batalkan
├── App.jsx                  routing (protected route via token check)
└── main.jsx
```

## Design tokens

Semua warna, font (Inter + Plus Jakarta Sans), dan style diambil 1:1 dari
`tailwind.config` pada `code.html` referensi, didefinisikan di `src/index.css`
memakai sintaks `@theme` (Tailwind v4). Kalau project kamu pakai Tailwind v3,
pindahkan isi `@theme` itu ke `tailwind.config.js` → `theme.extend.colors`
dengan format yang sama.

## Yang masih perlu kamu lengkapi

- **Chart tren harian** di `Dashboard.jsx` masih pakai data dummy. Tambahkan
  endpoint `GET /api/dashboard/trend` di backend yang meng-group `sales`
  berdasarkan tanggal, lalu ganti data dummy di `ProfitChart` dengan hasil fetch.
- **Tombol "Sinkronisasi Pesanan Baru"** di Dashboard masih dummy (`setTimeout`).
  Ganti dengan panggilan endpoint sync begitu integrasi API marketplace
  (Shopee/Tokopedia/dst) tersedia di backend.
- **Form tambah data** (produk baru, pembelian baru, penjualan baru) belum
  dibuat — halaman saat ini baru menampilkan data (read-only + aksi
  selesaikan/batalkan untuk sales). Beri tahu saya kalau mau saya lanjutkan
  buatkan form-nya.
- **Export Laporan Excel/CSV** di Dashboard baru tombol statis, belum ada
  logic export.
