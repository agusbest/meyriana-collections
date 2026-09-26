# Meyriana Collections — Inventori & Profit Marketplace

Aplikasi web untuk mengelola inventori baju bayi dan menghitung **profit riil** dari
penjualan di berbagai marketplace (Shopee, Tokopedia, Lazada, TikTok Shop), setelah
dikurangi modal (HPP) dan biaya/fee masing-masing marketplace.

---

## Tech Stack

### Backend

| Komponen        | Teknologi                                 |
| --------------- | ----------------------------------------- |
| Framework       | Laravel 12                                |
| Bahasa          | PHP >= 8.2                                |
| Database        | MySQL                                     |
| Autentikasi API | Laravel Sanctum (token-based)             |
| Arsitektur      | REST API, business logic di Service layer |

### Frontend

| Komponen    | Teknologi       |
| ----------- | --------------- |
| Framework   | React 18        |
| Build tool  | Vite            |
| Styling     | Tailwind CSS v4 |
| Routing     | React Router v6 |
| HTTP client | Axios           |
| Chart       | Recharts        |

<!-- ### Desain
Referensi tampilan (mockup statis) ada di `desain/dashboard_marketplace_profit_monitoring/code.html`.
Semua warna, font, dan spacing di frontend React diambil langsung dari file ini. -->

---

## Struktur Folder

```text
meyriana-collections/
├── backend/          # API Laravel
├── frontend/         # SPA React (Vite)
├── desain/           # Mockup HTML referensi tampilan
└── README.md         # File ini
```

---

## Prasyarat

Pastikan sudah terinstall di komputer lokal:

```bash
php -v        # >= 8.2
composer -v
mysql --version
node -v       # >= 18
npm -v
```

---

## Cara Menjalankan di Lokal

### 1. Setup Database

```bash
mysql -u root -p -e "CREATE DATABASE meyriana_collections;"
```

### 2. Setup Backend (Laravel)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Edit `.env`, sesuaikan kredensial database:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=meyriana_collections
DB_USERNAME=root
DB_PASSWORD=
```

Migrasi & seed data awal (akun admin + 4 marketplace):

```bash
php artisan migrate
php artisan db:seed
```

Jalankan server:

```bash
php artisan serve
```

Backend akan aktif di **http://127.0.0.1:8000**, API bisa diakses di `http://127.0.0.1:8000/api`.

### 3. Setup Frontend (React)

Buka terminal baru:

```bash
cd frontend
npm install
cp .env.example .env
```

Pastikan isi `.env` menunjuk ke backend:

```env
VITE_API_URL=http://127.0.0.1:8000/api
```

Jalankan dev server:

```bash
npm run dev
```

Frontend akan aktif di **http://localhost:5173**.

### 4. Login

Buka `http://localhost:5173`, login dengan akun dari seeder:

| Email             | Password |
| ----------------- | -------- |
| admin@example.com | password |

---

## Menjalankan Keduanya Sekaligus

Butuh **2 terminal terpisah** (backend dan frontend tidak digabung jadi satu proses):

```bash
# Terminal 1
cd backend && php artisan serve

# Terminal 2
cd frontend && npm run dev
```

---

## Alur Data Singkat

1. **Pembelian Supplier** → menambah stok produk + tercatat di histori stok.
2. **Penjualan Marketplace** → mengurangi stok, snapshot harga modal & fee marketplace saat itu, status awal `pending`.
3. **Settlement** → transaksi `pending` ditandai `completed` (dana cair) atau `cancelled` (stok dikembalikan).
4. **Dashboard** → menjumlahkan transaksi `completed` sebagai profit riil, dengan breakdown per marketplace.

---

## Endpoint API Utama

Semua endpoint (kecuali `/login`) butuh header:

```
Authorization: Bearer <token>
```

| Method   | Endpoint                   | Keterangan                               |
| -------- | -------------------------- | ---------------------------------------- |
| POST     | `/api/login`               | Login, dapat token                       |
| GET      | `/api/dashboard`           | Ringkasan profit + breakdown channel     |
| GET/POST | `/api/products`            | CRUD produk                              |
| GET/POST | `/api/suppliers`           | CRUD supplier                            |
| GET/POST | `/api/purchases`           | Pembelian (stok bertambah)               |
| GET/POST | `/api/marketplaces`        | CRUD marketplace + fee                   |
| GET/POST | `/api/sales`               | Penjualan (stok berkurang, fee dihitung) |
| POST     | `/api/sales/{id}/complete` | Tandai transaksi selesai                 |
| POST     | `/api/sales/{id}/cancel`   | Batalkan transaksi (stok kembali)        |
| GET      | `/api/stock-histories`     | Jejak audit pergerakan stok              |

---

## Testing API Manual

Ada script `test-api.sh` (lihat riwayat chat sebelumnya) untuk mencoba alur lengkap:
login → buat produk → buat pembelian → buat penjualan → settlement → cek dashboard.

```bash
bash test-api.sh
```

---

## Yang Masih Dalam Pengembangan

- [ ] Endpoint tren harian (`/api/dashboard/trend`) untuk chart — saat ini masih data dummy di frontend
- [ ] Form tambah/edit data dari UI (saat ini sebagian besar halaman masih read-only)
- [ ] Export laporan Excel/CSV
- [ ] Integrasi sinkronisasi pesanan otomatis dari API marketplace (Shopee/Tokopedia/dst)

---

## Troubleshooting Singkat

| Gejala                                                                | Kemungkinan Penyebab                                                                                                                                       |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ikon di sidebar muncul sebagai teks (`dashboard`, `inventory_2`, dst) | Font Material Symbols gagal dimuat — cek `index.html` sudah punya `<link>` font, dan `.material-symbols-outlined` di `index.css` sudah punya `font-family` |
| Dashboard menampilkan `Rp 0` semua                                    | Belum ada transaksi `sales` berstatus `completed` dalam rentang filter tanggal aktif                                                                       |
| `Table 'products' already exists` saat migrate                        | Ada migration duplikat (nama sama, timestamp beda) — hapus salah satu                                                                                      |
| CORS error di browser saat frontend fetch API                         | Cek `backend/config/cors.php`, pastikan `http://localhost:5173` ada di `allowed_origins`                                                                   |
