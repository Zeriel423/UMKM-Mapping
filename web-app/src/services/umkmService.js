import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { LOCATION_ACCURACY, normalizeBusinessLocation } from '../utils/location';

const PAGE_SIZE = 1000;
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
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase belum dikonfigurasi.');
  }
};

const fetchAllPages = async ({ table, fields = '*', applyFilters }) => {
  ensureConfigured();
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from(table)
      .select(fields)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (applyFilters) query = applyFilters(query);

    const { data, error } = await query;
    if (error) throw error;

    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return rows;
};

export const loadPublishedBusinesses = async () => {
  const rows = await fetchAllPages({
    table: 'umkm',
    fields: PUBLIC_FIELDS,
    applyFilters: (query) => query.eq('is_active', true).eq('published', true),
  });
  return rows.map(normalizeBusinessLocation);
};

export const loadAdminBusinesses = async () => {
  const rows = await fetchAllPages({ table: 'umkm' });
  return rows.map(normalizeBusinessLocation);
};

const nullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const cleanText = (value) => String(value ?? '').trim();

const LOCATION_ACCURACY_VALUES = new Set(Object.values(LOCATION_ACCURACY));

const validateCoordinatePair = (lat, lng, label) => {
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
  const analysisLat = nullableNumber(business.analysis_lat ?? business.lat);
  const analysisLng = nullableNumber(business.analysis_lng ?? business.lng);
  const displayLat = nullableNumber(business.display_lat ?? business.lat ?? analysisLat);
  const displayLng = nullableNumber(business.display_lng ?? business.lng ?? analysisLng);
  const accuracy = business.location_accuracy || LOCATION_ACCURACY.UNKNOWN;
  const name = cleanText(business.name);
  const address = cleanText(business.address);

  if (!name) throw new Error('Nama data/sumber wajib diisi.');
  if (!address) throw new Error('Alamat wajib diisi.');
  if (!LOCATION_ACCURACY_VALUES.has(accuracy)) throw new Error('Status lokasi tidak dikenal.');
  validateCoordinatePair(analysisLat, analysisLng, 'Koordinat analisis');
  validateCoordinatePair(displayLat, displayLng, 'Koordinat tampilan');
  if (accuracy !== LOCATION_ACCURACY.UNKNOWN && (analysisLat === null || analysisLng === null)) {
    throw new Error('Lokasi tepat atau perkiraan harus memiliki sepasang koordinat.');
  }

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

  if (business.id !== '' && business.id !== null && business.id !== undefined) {
    const id = Number(business.id);
    if (!Number.isSafeInteger(id) || id < 0) throw new Error(`ID UMKM tidak valid: ${business.id}`);
    payload.id = id;
  }

  return payload;
};

export const saveBusiness = async (business) => {
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
  ensureConfigured();
  if (businesses.some((business) => business.location_accuracy === LOCATION_ACCURACY.EXACT)) {
    throw new Error('Impor tidak boleh menetapkan status lokasi tepat. Gunakan menu Verifikasi Lokasi.');
  }
  const payloads = businesses.map(businessToDatabase);
  onProgress?.(0, payloads.length);
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
  ensureConfigured();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
};
