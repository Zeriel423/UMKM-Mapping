import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { LOCATION_ACCURACY, normalizeBusinessLocation } from '../utils/location';

// Batas halaman Supabase agar seluruh dataset dapat dimuat bertahap.
const PAGE_SIZE = 1000;
// Kolom yang aman dan diperlukan untuk halaman publik.
const PUBLIC_FIELDS = [
  'id',
  'name',
  'product_type',
  'product_label',
  'brand',
  'owner',
  'address',
  'lat',
  'lng',
  'analysis_lat',
  'analysis_lng',
  'display_lat',
  'display_lng',
  'location_accuracy',
  'location_area',
].join(',');

const ensureConfigured = () => {
  // Operasi database tidak boleh berjalan tanpa kredensial Supabase.
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase belum dikonfigurasi.');
  }
};

const fetchAllPages = async ({ table, fields = '*', applyFilters }) => {
  // Membaca semua halaman tanpa melampaui batas hasil default Supabase.
  ensureConfigured();
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    // Membuat query halaman berikutnya dengan urutan ID yang stabil.
    let query = supabase
      .from(table)
      .select(fields)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    // Filter opsional dipakai oleh pembaca data publik.
    if (applyFilters) query = applyFilters(query);

    const { data, error } = await query;
    if (error) throw error;

    rows.push(...(data || []));
    // Berhenti ketika halaman terakhir berisi kurang dari batas halaman.
    if (!data || data.length < PAGE_SIZE) break;
  }

  return rows;
};

export const loadPublishedBusinesses = async () => {
  // Hanya data aktif dan dipublikasikan yang boleh tampil di halaman publik.
  const rows = await fetchAllPages({
    table: 'umkm',
    fields: PUBLIC_FIELDS,
    applyFilters: (query) => query.eq('is_active', true).eq('published', true),
  });
  return rows.map(normalizeBusinessLocation);
};

export const loadAdminBusinesses = async () => {
  // Admin membaca seluruh data untuk keperluan pengelolaan.
  const rows = await fetchAllPages({ table: 'umkm' });
  return rows.map(normalizeBusinessLocation);
};

const nullableNumber = (value) => {
  // Form kosong harus menjadi null agar tidak tersimpan sebagai angka palsu.
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const cleanText = (value) => String(value ?? '').trim();

// Set membuat validasi status lokasi konsisten dan cepat.
const LOCATION_ACCURACY_VALUES = new Set(Object.values(LOCATION_ACCURACY));

const validateCoordinatePair = (lat, lng, label) => {
  // Latitude dan longitude selalu disimpan sebagai pasangan lengkap.
  if ((lat === null) !== (lng === null)) {
    throw new Error(`${label} harus memiliki latitude dan longitude sekaligus.`);
  }
  if (lat !== null && (lat < -90 || lat > 90)) {
    throw new Error(`Latitude ${label.toLowerCase()} harus berada di antara -90 dan 90.`);
  }
  if (lng !== null && (lng < -180 || lng > 180)) {
    throw new Error(`Longitude ${label.toLowerCase()} harus berada di antara -180 dan 180.`);
  }
};

export const businessToDatabase = (business) => {
  // Menyatukan bentuk data form, data JSON lama, dan skema database.
  const analysisLat = nullableNumber(business.analysis_lat ?? business.lat);
  const analysisLng = nullableNumber(business.analysis_lng ?? business.lng);
  const displayLat = nullableNumber(business.display_lat ?? business.lat ?? analysisLat);
  const displayLng = nullableNumber(business.display_lng ?? business.lng ?? analysisLng);
  const accuracy = business.location_accuracy || LOCATION_ACCURACY.UNKNOWN;
  const name = cleanText(business.name);
  const address = cleanText(business.address);

  // Data minimum diperlukan agar record dapat dicari dan ditampilkan kembali.
  if (!name) throw new Error('Nama data/sumber wajib diisi.');
  if (!address) throw new Error('Alamat wajib diisi.');
  if (!LOCATION_ACCURACY_VALUES.has(accuracy)) throw new Error('Status lokasi tidak dikenal.');
  validateCoordinatePair(analysisLat, analysisLng, 'Koordinat analisis');
  validateCoordinatePair(displayLat, displayLng, 'Koordinat tampilan');
  if (accuracy !== LOCATION_ACCURACY.UNKNOWN && (analysisLat === null || analysisLng === null)) {
    throw new Error('Lokasi tepat atau perkiraan harus memiliki sepasang koordinat.');
  }

  // Payload berikut memakai nama kolom yang sesuai dengan tabel umkm.
  const payload = {
    name,
    product_type: cleanText(business.product_type),
    product_label: cleanText(business.product_label),
    brand: cleanText(business.brand),
    owner: cleanText(business.owner),
    address,
    lat: displayLat,
    lng: displayLng,
    analysis_lat: analysisLat,
    analysis_lng: analysisLng,
    display_lat: displayLat,
    display_lng: displayLng,
    location_accuracy: accuracy,
    location_area: cleanText(business.location_area),
    is_active: business.is_active !== false,
    published: business.published !== false,
  };

  // ID hanya disertakan untuk pembaruan record yang sudah ada.
  if (business.id !== '' && business.id !== null && business.id !== undefined) {
    const id = Number(business.id);
    if (!Number.isSafeInteger(id) || id < 0) throw new Error(`ID UMKM tidak valid: ${business.id}`);
    payload.id = id;
  }

  return payload;
};

export const saveBusiness = async (business) => {
  // Memilih update atau insert dari keberadaan ID pada payload.
  ensureConfigured();
  const payload = businessToDatabase(business);
  const hasId = payload.id !== undefined;
  const query = hasId
    ? supabase.from('umkm').update(payload).eq('id', payload.id)
    : supabase.from('umkm').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return normalizeBusinessLocation(data);
};

export const setBusinessActive = async (id, isActive) => {
  // Menonaktifkan data tanpa menghapus riwayatnya dari database.
  ensureConfigured();
  const { data, error } = await supabase
    .from('umkm')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id,is_active')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Data tidak ditemukan atau akun tidak memiliki izin mengubahnya.');
  return data;
};

export const verifyBusinessLocation = async (id, values) => {
  // Verifikasi lokasi diproses oleh fungsi database agar audit dan izin konsisten.
  ensureConfigured();
  const lat = nullableNumber(values.lat);
  const lng = nullableNumber(values.lng);
  validateCoordinatePair(lat, lng, 'Koordinat verifikasi');
  if (lat === null || lng === null) throw new Error('Koordinat belum valid.');
  if (![LOCATION_ACCURACY.EXACT, LOCATION_ACCURACY.APPROXIMATE].includes(values.location_accuracy)) {
    throw new Error('Pilih hasil verifikasi lokasi yang valid.');
  }

  const { data, error } = await supabase.rpc('verify_umkm_location', {
    p_umkm_id: id,
    p_lat: lat,
    p_lng: lng,
    p_location_accuracy: values.location_accuracy,
    p_location_area: cleanText(values.location_area),
  });
  if (error) throw error;
  return normalizeBusinessLocation(data);
};

export const importBusinessesAtomically = async (businesses, sourceName, onProgress) => {
  // Impor batch menolak status tepat karena harus diverifikasi per lokasi.
  ensureConfigured();
  if (businesses.some((business) => business.location_accuracy === LOCATION_ACCURACY.EXACT)) {
    throw new Error('Impor tidak boleh menetapkan status lokasi tepat. Gunakan menu Verifikasi Lokasi.');
  }
  const payloads = businesses.map(businessToDatabase);
  onProgress?.(0, payloads.length);
  // RPC menjalankan seluruh impor sebagai satu transaksi database.
  const { data, error } = await supabase.rpc('import_umkm_batch', {
    p_source_name: cleanText(sourceName) || 'Impor admin',
    p_records: payloads,
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.message || 'Transaksi impor dibatalkan oleh database.');
  onProgress?.(payloads.length, payloads.length);
  return data;
};

export const loadAdminProfile = async (userId) => {
  // Mengambil profil aktif untuk menentukan peran pengguna yang login.
  ensureConfigured();
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('user_id,full_name,role,is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const saveKMeansRun = async (run) => {
  // Menyimpan hasil analisis agar dapat ditelusuri kembali.
  ensureConfigured();
  const { data, error } = await supabase
    .from('kmeans_runs')
    .insert(run)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const loadKMeansRuns = async () => {
  // Riwayat dibatasi untuk menjaga halaman admin tetap ringan.
  ensureConfigured();
  const { data, error } = await supabase
    .from('kmeans_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data || [];
};

export const loadAuditLogs = async () => {
  // Riwayat audit terbaru dipakai pada halaman Riwayat admin.
  ensureConfigured();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
};
