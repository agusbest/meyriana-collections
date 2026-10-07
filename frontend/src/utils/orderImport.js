import * as XLSX from "xlsx";

// Judul kolom di file "Pesanan Saya -> Ekspor" Shopee Seller Centre
const COLUMNS = {
  order_number: "no. pesanan",
  status: "status pesanan",
  created_at: "waktu pesanan dibuat",
  product_name: "nama produk",
  variation_name: "nama variasi",
  sku: "nomor referensi sku",
  parent_sku: "sku induk",
  price: "harga setelah diskon",
  original_price: "harga awal",
  qty: "jumlah",
  returned: "returned quantity",
};

const REQUIRED = ["order_number", "product_name", "qty"];

function cellText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }
  return String(value).replace(/ /g, " ").trim();
}

/** "31.500" -> 31500, "1.234,50" -> 1234.5, angka asli tetap angka. */
export function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  let s = String(value ?? "").replace(/rp/gi, "").replace(/\s/g, "");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

const pad = (n) => String(n).padStart(2, "0");

/** Tanggal pesanan -> "YYYY-MM-DD" (tanggal lokal, tanpa geser zona waktu). */
export function toDate(value) {
  if (typeof value === "number" && value > 20000) {
    const d = XLSX.SSF.parse_date_code(value);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }

  const s = cellText(value);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;

  return null;
}

/**
 * rows = array 2 dimensi dari sheet. Satu baris = satu produk dalam pesanan;
 * baris dengan No. Pesanan sama digabung jadi satu pesanan.
 */
export function parseShopeeOrderRows(rows) {
  const headerIndex = rows.findIndex(
    (row, i) => i < 15 && row.some((c) => cellText(c).toLowerCase() === COLUMNS.order_number),
  );

  if (headerIndex === -1) {
    throw new Error(
      'Kolom "No. Pesanan" tidak ditemukan. Pastikan ini file ekspor pesanan (Pesanan Saya → Ekspor).',
    );
  }

  const header = rows[headerIndex].map((c) => cellText(c).toLowerCase());
  const col = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, label]) => [key, header.indexOf(label)]),
  );

  const missing = REQUIRED.filter((key) => col[key] === -1);
  if (missing.length) {
    throw new Error(`Kolom wajib tidak ada: ${missing.map((k) => `"${COLUMNS[k]}"`).join(", ")}.`);
  }

  const byNumber = new Map();
  let lineCount = 0;
  let skippedRows = 0;

  for (const row of rows.slice(headerIndex + 1)) {
    const get = (key) => (col[key] === -1 ? "" : row[col[key]]);
    const number = cellText(get("order_number"));
    const productName = cellText(get("product_name"));

    if (!number && !productName) continue; // baris kosong

    const saleDate = toDate(get("created_at"));

    if (!number || !productName || !saleDate) {
      skippedRows += 1;
      continue;
    }

    const qty = Math.max(0, Math.trunc(toNumber(get("qty"))) - Math.trunc(toNumber(get("returned"))));
    const unitPrice = col.price !== -1 ? toNumber(get("price")) : toNumber(get("original_price"));

    if (!byNumber.has(number)) {
      byNumber.set(number, {
        order_number: number,
        sale_date: saleDate,
        status: cellText(get("status")) || null,
        lines: [],
      });
    }

    byNumber.get(number).lines.push({
      product_name: productName,
      variation_name: cellText(get("variation_name")) || null,
      sku: cellText(get("sku")) || cellText(get("parent_sku")) || null,
      qty,
      total: Math.round(unitPrice * qty * 100) / 100,
    });
    lineCount += 1;
  }

  // Paling lama dulu, supaya stok terpotong sesuai urutan pesanan
  const orders = [...byNumber.values()].sort(
    (a, b) => a.sale_date.localeCompare(b.sale_date) || a.order_number.localeCompare(b.order_number),
  );

  return { orders, lineCount, skippedRows };
}

export async function readShopeeOrderFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });

  // File Shopee bisa punya beberapa sheet (mis. "Advance Fulfilment"); cari yang berisi No. Pesanan
  let lastError = null;
  for (const name of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: "" });
    try {
      return parseShopeeOrderRows(rows);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("File kosong.");
}

// Pembaca per marketplace (berdasarkan kode marketplace). Tambah di sini saat contoh file tersedia.
export const ORDER_READERS = {
  shopee: readShopeeOrderFile,
};
