import * as XLSX from "xlsx";

// Judul kolom di template Shopee "Mass Update - Info Penjualan"
const COLUMNS = {
  external_product_id: "kode produk",
  product_name: "nama produk",
  external_variation_id: "kode variasi",
  variation_name: "nama variasi",
  parent_sku: "sku induk",
  sku: "sku",
  price: "harga",
  stock: "stok",
};

function cellText(value) {
  if (value === null || value === undefined) return "";
  // Angka besar (Kode Produk) jangan sampai jadi notasi 2.5e+11
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }
  return String(value).trim();
}

function toNumber(text) {
  let s = String(text ?? "").replace(/rp/gi, "").replace(/\s/g, "");
  // Format Indonesia "60.000" atau "60.000,50"
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * rows = array 2 dimensi (baris x kolom) dari sheet.
 * Mengembalikan listing siap dikirim ke backend.
 */
export function parseShopeeRows(rows) {
  const headerIndex = rows.findIndex(
    (row, i) => i < 15 && row.some((c) => cellText(c).toLowerCase() === "kode produk"),
  );

  if (headerIndex === -1) {
    throw new Error(
      'Kolom "Kode Produk" tidak ditemukan. Pastikan ini file ekspor produk Shopee (Mass Update - Info Penjualan).',
    );
  }

  const header = rows[headerIndex].map((c) => cellText(c).toLowerCase());
  const col = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, label]) => [key, header.indexOf(label)]),
  );

  const missing = ["external_product_id", "product_name", "external_variation_id"].filter(
    (key) => col[key] === -1,
  );

  if (missing.length) {
    throw new Error(`Kolom wajib tidak ditemukan: ${missing.map((k) => COLUMNS[k]).join(", ")}.`);
  }

  const listings = [];
  const seen = new Set();
  let skipped = 0;

  for (const row of rows.slice(headerIndex + 1)) {
    const get = (key) => (col[key] >= 0 ? cellText(row[col[key]]) : "");
    const productId = get("external_product_id");

    // Baris keterangan template ("Wajib") dan baris kosong dilewati tanpa dihitung
    if (productId === "") continue;

    if (!/^\d+$/.test(productId)) {
      skipped++;
      continue;
    }

    const variationId = get("external_variation_id") || "0";
    const key = `${productId}:${variationId}`;

    if (seen.has(key)) {
      skipped++;
      continue;
    }

    seen.add(key);

    listings.push({
      external_product_id: productId,
      external_variation_id: variationId,
      product_name: get("product_name"),
      variation_name: get("variation_name") || null,
      parent_sku: get("parent_sku") || null,
      sku: get("sku") || null,
      price: toNumber(get("price")),
      stock: Math.max(0, Math.trunc(toNumber(get("stock")))),
    });
  }

  return {
    listings,
    productCount: new Set(listings.map((l) => l.external_product_id)).size,
    skipped,
  };
}

export async function readShopeeFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  return parseShopeeRows(rows);
}

/**
 * Sama persis dengan ListingMappingService::parseVariation di backend.
 * "Coklat Rainbow,XL" -> { color: "Coklat Rainbow", size: "XL" }
 */
export function parseVariation(name) {
  const clean = (v) => {
    const t = String(v ?? "").trim();
    return t === "" || t === "-" ? null : t;
  };

  const text = String(name ?? "").trim();

  if (text === "" || text === "-") return { color: null, size: null };

  const comma = text.indexOf(",");

  if (comma === -1) return { color: clean(text), size: null };

  return { color: clean(text.slice(0, comma)), size: clean(text.slice(comma + 1)) };
}

/**
 * Saran nama pendek barang lokal dari judul listing yang panjang.
 * Judul paket "... Baju X dan Celana Y ..." dipecah jadi 2 barang.
 */
export function suggestComponentNames(productName) {
  let s = ` ${productName ?? ""} `;

  s = s.replace(/^\s*(promo|new|ready|best\s*seller|seri\s+[^-]{1,25})\s*-\s*/i, " ");
  s = s.replace(/\b\d+\s*(pcs|setel|setelan|stel|set|pasang|psg|lusin)\b/gi, " ");
  s = s.replace(/\bmeyriana\s+collections?\b/gi, " ");
  s = s.replace(/\bbaru\s+lahir\b|\bnew\s*born\b/gi, " ");
  s = s.replace(/\b(usia|umur)\s+\d+\s*-\s*\d+\s*(bulan|bln|tahun|thn)?\b/gi, " ");
  s = s.replace(/\b\d{1,2}\s*-\s*\d{1,2}\s*(bulan|bln|tahun|thn|m)?\b/gi, " ");
  s = s.replace(/\bseri\s+warna\s+\S+/gi, " ");
  s = s.replace(/\b(murah|terlaris|termurah|premium|original|ori|grosir)\b/gi, " ");
  s = s.replace(/\bbayi\b/gi, " ");
  s = s.replace(/\s+/g, " ").trim();

  const parts = s
    .split(/\s+(?:dan|&|\+)\s+/i)
    .map((part) =>
      part
        .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "") // buang tanda baca di awal/akhir ("/ Baju" -> "Baju")
        .split(" ")
        .slice(0, 4)
        .join(" ")
        .trim(),
    )
    .filter(Boolean);

  return parts.length ? parts.slice(0, 4) : [String(productName ?? "").slice(0, 40)];
}

/**
 * Saran qty per barang: angka di depan SKU Shopee ("3 SETEL ..." -> 3), kalau tidak ada -> 1.
 */
export function suggestQty(sku) {
  const match = String(sku ?? "").trim().match(/^(\d{1,3})\b/);
  const n = match ? Number(match[1]) : 1;

  return n >= 1 ? n : 1;
}


// ===================== Pemetaan otomatis (inisiasi awal) =====================

const SET_WORDS = /\b(setel|setelan|stel|set|piyama|pajamas?)\b/i;
const PIECE_UNITS = /^(pcs|pc|potong|ptg)$/i;

const CATEGORY_WORDS = [
  "Baju", "Celana", "Jumper", "Piyama", "Kaos", "Singlet", "Topi", "Bedong",
  "Handuk", "Gurita", "Popok", "Gamis", "Romper", "Sarung", "Kaus", "Rok", "Dress",
];

function readCount(text) {
  const m = String(text ?? "").trim().match(/^(\d{1,3})\s*([a-zA-Z]+)?/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? "").toLowerCase();
  return n >= 1 ? { n: unit === "lusin" ? n * 12 : n, unit } : null;
}

/**
 * Tebakan isi 1 kali penjualan listing, per potong.
 * Mengembalikan { items: [{ name, qty }], notes: [alasan perlu dicek] }
 */
export function buildAutoRecipe(productName, sku) {
  const notes = [];
  let names = suggestComponentNames(productName);

  // "Setelan baju celana" / "Piyama" tanpa kata "dan" -> pecah jadi baju + celana
  if (names.length === 1) {
    const base = names[0];
    const lower = base.toLowerCase();
    const isSet =
      SET_WORDS.test(productName ?? "") ||
      (/\bbaju\b/.test(lower) && /\bcelana\b/.test(lower));

    if (isSet && !/^celana\b/i.test(base) === true) {
      const desc = base
        .split(/\s+/)
        .filter((w) => !/^(baju|celana|setel|set[ae]lan|stel|set)$/i.test(w))
        .slice(0, 3)
        .join(" ");
      // "Lengan Pendek" -> baju "Lengan Pendek", celana cukup "Pendek"
      const celanaDesc = desc.replace(/\blengan\s+/i, "").trim();
      names = [`Baju ${desc}`.trim(), `Celana ${celanaDesc}`.trim()];
      if (!desc) notes.push("nama terlalu umum");
      notes.push("setelan dipecah jadi baju + celana");
    }
  }

  // Jumlah: dari angka di depan SKU, kalau tidak ada dari judul
  let count = readCount(sku);
  if (!count) {
    const m = String(productName ?? "").match(/\b(\d{1,3})\s*(pcs|pc|setel|setelan|stel|set|pasang|psg|lusin)\b/i);
    if (m) {
      count = { n: m[2].toLowerCase() === "lusin" ? Number(m[1]) * 12 : Number(m[1]), unit: m[2].toLowerCase() };
      notes.push("jumlah diambil dari judul");
    }
  }
  if (!sku) notes.push("SKU kosong");

  let qty = count ? count.n : 1;

  // "6 PCS baju + celana" = 3 + 3
  if (count && PIECE_UNITS.test(count.unit) && names.length > 1) {
    if (count.n % names.length === 0) {
      qty = count.n / names.length;
    } else {
      notes.push("jumlah pcs tidak habis dibagi");
    }
  }

  return { items: names.map((name) => ({ name, qty: Math.max(1, qty) })), notes };
}

export function guessCategory(name) {
  const first = String(name ?? "").trim().split(/\s+/)[0] ?? "";
  return CATEGORY_WORDS.find((c) => c.toLowerCase() === first.toLowerCase()) ?? null;
}
