import { LOCATION_ACCURACY } from '../../utils/location.js';

// Urutan kolom tetap agar file ekspor dapat diimpor kembali tanpa pemetaan ulang.
export const CSV_COLUMNS = [
  'id',
  'name',
  'sumber_data',
  'bpjph',
  'brand',
  'owner',
  'nama_pemilik',
  'product_type',
  'product_label',
  'address',
  'analysis_lat',
  'analysis_lng',
  'display_lat',
  'display_lng',
  'location_accuracy',
  'location_area',
  'is_active',
  'published',
];

const ALLOWED_LOCATION_ACCURACY = new Set(Object.values(LOCATION_ACCURACY));
// Membedakan angka negatif yang valid dari formula spreadsheet berbahaya.
const NEGATIVE_NUMBER_PATTERN = /^-(?:(?:\d+(?:[.,]\d*)?)|(?:[.,]\d+))(?:[eE][+-]?\d+)?$/;

// Mendeteksi pemisah kolom CSV secara otomatis (koma, titik-koma, atau tab).
export const detectDelimiter = (text) => {
  const firstLine = text.split(/\r\n|\r|\n/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  if (semicolonCount > commaCount && semicolonCount > tabCount) return ';';
  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  return ',';
};

// Membaca CSV karakter demi karakter agar tanda kutip dan baris baru aman.
export const parseCsvRows = (text, delimiter = ',') => {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    // Dua tanda kutip di dalam nilai CSV mewakili satu karakter kutip literal.
    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  if (quoted) {
    throw new Error('CSV memiliki tanda kutip yang tidak ditutup.');
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
};

const TRUE_VALUES = new Set(['true', '1', 'ya', 'yes', 'y', 'aktif', 'on']);
const FALSE_VALUES = new Set(['false', '0', 'tidak', 'no', 'n', 'nonaktif', 'off']);

// Mengubah variasi teks boolean menjadi nilai yang konsisten untuk database.
const booleanValue = (value, label, rowNumber, errors, defaultValue = true) => {
  if (value === undefined || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  errors.push(`Baris ${rowNumber}: ${label} harus berupa true/false, ya/tidak, aktif/nonaktif, atau 1/0.`);
  return defaultValue;
};

const isBlank = (value) => value === undefined || value === null || value === '';

// Memvalidasi angka koordinat sekaligus menambahkan pesan kesalahan per baris.
const parseCoordinate = (rawValue, label, minimum, maximum, rowNumber, errors) => {
  if (isBlank(rawValue)) return null;

  // Mendukung format koma desimal Indonesia ("1,4858" -> 1.4858)
  const normalizedRaw = String(rawValue).trim().replace(',', '.');
  const value = Number(normalizedRaw);
  if (!Number.isFinite(value)) {
    errors.push(`Baris ${rowNumber}: ${label} tidak valid.`);
    return null;
  }

  if (value < minimum || value > maximum) {
    errors.push(`Baris ${rowNumber}: ${label} di luar rentang ${minimum} sampai ${maximum}.`);
  }

  return value;
};

const parseId = (rawValue, rowNumber, errors) => {
  // ID kosong berarti database dapat membuat ID baru saat impor.
  if (isBlank(rawValue)) return undefined;

  const trimmed = String(rawValue).trim();
  if (!/^\d+$/.test(trimmed)) {
    errors.push(`Baris ${rowNumber}: ID harus berupa bilangan bulat non-negatif.`);
    return undefined;
  }

  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 0) {
    errors.push(`Baris ${rowNumber}: ID harus berupa bilangan bulat non-negatif yang valid.`);
    return undefined;
  }

  return value;
};

const hasValidCoordinatePair = (lat, lng) => (
  // Memastikan koordinat berada dalam batas geografis dunia.
  Number.isFinite(lat)
  && lat >= -90
  && lat <= 90
  && Number.isFinite(lng)
  && lng >= -180
  && lng <= 180
);

// Menyelaraskan variasi header bahasa Indonesia dan Inggris ke nama kolom baku.
const normalizeHeader = (rawHeader) => {
  const h = String(rawHeader || '').trim().toLowerCase().replace(/[\s_-]+/g, '_');
  if (['id', 'no', 'nomor', 'kode_id'].includes(h)) return 'id';
  if (['name', 'nama_sumber', 'sumber', 'sumber_data', 'source', 'source_name', 'fac_name'].includes(h)) return 'name';
  if (['bpjph', 'no_bpjph', 'nomor_bpjph'].includes(h)) return 'bpjph';
  if (['brand', 'merek', 'merek_dagang', 'nama_usaha', 'usaha', 'nama_umkm', 'business_name'].includes(h)) return 'brand';
  if (['owner', 'nama_pemilik', 'pemilik', 'nama_pu', 'owner_name'].includes(h)) return 'owner';
  if (['address', 'alamat', 'alamat_usaha', 'alamat_pu', 'lokasi_alamat'].includes(h)) return 'address';
  if (['product_type', 'jenis_produk', 'kode_kategori', 'category_code', 'category', 'kategori'].includes(h)) return 'product_type';
  if (['product_label', 'nama_kategori', 'label_kategori', 'category_label'].includes(h)) return 'product_label';
  if (['analysis_lat', 'lat', 'latitude', 'lintang', 'garis_lintang'].includes(h)) return 'analysis_lat';
  if (['analysis_lng', 'lng', 'longitude', 'bujur', 'garis_bujur'].includes(h)) return 'analysis_lng';
  if (['display_lat', 'lat_tampilan', 'latitude_tampilan'].includes(h)) return 'display_lat';
  if (['display_lng', 'lng_tampilan', 'longitude_tampilan'].includes(h)) return 'display_lng';
  if (['location_accuracy', 'akurasi_lokasi', 'status_lokasi', 'status_verifikasi', 'accuracy'].includes(h)) return 'location_accuracy';
  if (['location_area', 'wilayah', 'kecamatan', 'area'].includes(h)) return 'location_area';
  if (['is_active', 'aktif', 'status_aktif', 'active'].includes(h)) return 'is_active';
  if (['published', 'publikasi', 'tampil_publik', 'is_published'].includes(h)) return 'published';
  return h;
};

export const parseBusinessCsv = (text) => {
  // Mengubah CSV menjadi record UMKM dan mengumpulkan semua kesalahan validasi.
  if (typeof text !== 'string') throw new Error('Isi CSV tidak valid.');

  const cleanText = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(cleanText);
  const rows = parseCsvRows(cleanText, delimiter);
  if (rows.length < 2) throw new Error('CSV tidak memiliki baris data.');

  // Header dinormalisasi agar perbedaan kapital dan istilah tidak menggagalkan impor.
  const headers = rows[0].map(normalizeHeader);
  const emptyHeaderIndexes = headers
    .map((header, index) => (header ? null : index + 1))
    .filter((index) => index !== null);
  if (emptyHeaderIndexes.length) {
    throw new Error(`Nama header CSV kosong pada kolom ${emptyHeaderIndexes.join(', ')}.`);
  }

  const duplicateHeaders = headers.filter(
    (header, index) => headers.indexOf(header) !== index,
  );
  if (duplicateHeaders.length) {
    throw new Error(`Header CSV duplikat ditemukan: ${[...new Set(duplicateHeaders)].join(', ')}.`);
  }

  // Setidaknya harus ada informasi alamat atau usaha
  const hasAddress = headers.includes('address');
  const hasIdentity = headers.includes('name') || headers.includes('brand');
  if (!hasAddress && !hasIdentity) {
    throw new Error('Kolom wajib belum tersedia: minimal sertakan nama usaha (brand/name) dan alamat.');
  }

  const errors = [];
  const businesses = rows.slice(1).map((cells, rowIndex) => {
    const rowNumber = rowIndex + 2;
    if (cells.length > headers.length) {
      errors.push(`Baris ${rowNumber}: terdapat ${cells.length - headers.length} kolom berlebih.`);
    }

    // Setiap baris dipetakan ke nama kolom standar
    const rawRecord = Object.fromEntries(
      headers.map((header, index) => [header, cells[index]?.trim() ?? '']),
    );

    const address = rawRecord.address || '';
    const brand = rawRecord.brand || (rawRecord.name !== '.' ? rawRecord.name : '') || '';
    // Kolom privat disesuaikan dengan nilai titik (.) bila kosong atau diisi tanda titik
    const rawName = rawRecord.name || rawRecord.sumber_data || '.';
    const name = rawName.trim() || '.';
    const bpjph = rawRecord.bpjph ? rawRecord.bpjph.trim() : '.';
    const owner = rawRecord.owner ? rawRecord.owner.trim() : '.';

    if (!address && !brand) {
      errors.push(`Baris ${rowNumber}: alamat atau nama usaha wajib diisi.`);
    }

    const id = parseId(rawRecord.id, rowNumber, errors);
    const hasAnalysisLat = !isBlank(rawRecord.analysis_lat);
    const hasAnalysisLng = !isBlank(rawRecord.analysis_lng);
    const hasDisplayLat = !isBlank(rawRecord.display_lat);
    const hasDisplayLng = !isBlank(rawRecord.display_lng);

    if (hasAnalysisLat !== hasAnalysisLng) {
      errors.push(`Baris ${rowNumber}: latitude dan longitude analisis harus diisi berpasangan.`);
    }
    if (hasDisplayLat !== hasDisplayLng) {
      errors.push(`Baris ${rowNumber}: latitude dan longitude tampilan harus diisi berpasangan.`);
    }

    const parsedAnalysisLat = parseCoordinate(rawRecord.analysis_lat, 'latitude analisis', -90, 90, rowNumber, errors);
    const parsedAnalysisLng = parseCoordinate(rawRecord.analysis_lng, 'longitude analisis', -180, 180, rowNumber, errors);
    const parsedDisplayLat = parseCoordinate(rawRecord.display_lat, 'latitude tampilan', -90, 90, rowNumber, errors);
    const parsedDisplayLng = parseCoordinate(rawRecord.display_lng, 'longitude tampilan', -180, 180, rowNumber, errors);

    const lat = parsedAnalysisLat ?? parsedDisplayLat ?? null;
    const lng = parsedAnalysisLng ?? parsedDisplayLng ?? null;
    const displayLat = parsedDisplayLat ?? lat;
    const displayLng = parsedDisplayLng ?? lng;

    const rawLocationAccuracy = String(rawRecord.location_accuracy ?? '').toLowerCase().trim();
    let locationAccuracy = rawLocationAccuracy || (hasValidCoordinatePair(lat, lng) ? LOCATION_ACCURACY.APPROXIMATE : LOCATION_ACCURACY.UNKNOWN);

    if (rawLocationAccuracy && !ALLOWED_LOCATION_ACCURACY.has(rawLocationAccuracy)) {
      // Normalisasi sebutan akurasi umum
      if (['verified', 'tepat', 'exact'].includes(rawLocationAccuracy)) {
        locationAccuracy = LOCATION_ACCURACY.EXACT;
      } else if (['approximate', 'perkiraan', 'perkiraan_kecamatan'].includes(rawLocationAccuracy)) {
        locationAccuracy = LOCATION_ACCURACY.APPROXIMATE;
      } else {
        errors.push(
          `Baris ${rowNumber}: status lokasi (${rawLocationAccuracy}) harus salah satu dari ${[...ALLOWED_LOCATION_ACCURACY].join(', ')}.`,
        );
      }
    }

    if (
      locationAccuracy !== LOCATION_ACCURACY.UNKNOWN
      && !hasValidCoordinatePair(lat, lng)
    ) {
      errors.push(`Baris ${rowNumber}: status lokasi selain belum terverifikasi memerlukan koordinat yang valid.`);
    }

    // Mengembalikan struktur kolom yang konsisten dan lengkap (sesuai B.4)
    return {
      ...rawRecord,
      id,
      name,
      sumber_data: name,
      bpjph,
      brand,
      owner,
      nama_pemilik: owner,
      product_type: rawRecord.product_type || '',
      product_label: rawRecord.product_label || '',
      address,
      analysis_lat: lat,
      analysis_lng: lng,
      display_lat: displayLat,
      display_lng: displayLng,
      lat: displayLat ?? lat,
      lng: displayLng ?? lng,
      location_accuracy: ALLOWED_LOCATION_ACCURACY.has(locationAccuracy)
        ? locationAccuracy
        : LOCATION_ACCURACY.UNKNOWN,
      location_area: rawRecord.location_area || '',
      is_active: booleanValue(rawRecord.is_active, 'is_active', rowNumber, errors),
      published: booleanValue(rawRecord.published, 'published', rowNumber, errors),
    };
  });

  // ID duplikat dihentikan sebelum data dikirim ke transaksi impor.
  const duplicateIds = businesses
    .map((business) => business.id)
    .filter((id) => id !== undefined)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateIds.length) {
    errors.push(`ID duplikat ditemukan: ${[...new Set(duplicateIds)].slice(0, 10).join(', ')}.`);
  }

  return { businesses, errors };
};

const spreadsheetSafeText = (value) => {
  // Prefiks apostrof mencegah spreadsheet menjalankan nilai sebagai formula.
  const text = String(value ?? '');
  if (typeof value !== 'string') return text;

  const candidate = text.trimStart();
  const beginsWithFormulaCharacter = /^[=+\-@]/.test(candidate);
  const isNegativeNumber = candidate.startsWith('-')
    && NEGATIVE_NUMBER_PATTERN.test(candidate.trim());

  return beginsWithFormulaCharacter && !isNegativeNumber ? `'${text}` : text;
};

const csvCell = (value) => {
  // Nilai dengan koma, kutip, atau baris baru harus dibungkus tanda kutip CSV.
  const text = spreadsheetSafeText(value);
  return /[",\r\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const businessesToCsv = (businesses) => [
  // Header dan setiap record dirakit menjadi teks CSV standar.
  CSV_COLUMNS.join(','),
  ...businesses.map((business) =>
    CSV_COLUMNS.map((column) => csvCell(business[column] ?? '')).join(','),
  ),
].join('\r\n');

export const downloadCsv = (filename, contents) => {
  // Blob sementara memicu unduhan browser tanpa mengirim data ke server lain.
  const blob = new Blob([`\uFEFF${contents}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
