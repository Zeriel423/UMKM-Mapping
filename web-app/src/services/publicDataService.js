import { normalizeBusinessLocation } from '../utils/location';

// Memeriksa apakah sumber data utama adalah database Supabase.
const hasDatabaseConfiguration = Boolean(
  import.meta.env.VITE_SUPABASE_URL?.trim()
  && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim(),
);

export const loadStaticBusinesses = async () => {
  // Menggunakan JSON lokal saat database belum dikonfigurasi.
  // Menyaring hanya atribut publik agar data privat tidak berada pada memori publik.
  const response = await fetch('/data/umkm.json');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Gagal memuat data UMKM`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Format data UMKM tidak valid.');
  return data.map((item) => {
    const normalized = normalizeBusinessLocation(item);
    return {
      id: normalized.id,
      brand: normalized.brand || (normalized.name && normalized.name !== '.' ? normalized.name : '') || 'UMKM',
      product_type: normalized.product_type,
      product_label: normalized.product_label,
      address: normalized.address,
      lat: normalized.lat,
      lng: normalized.lng,
      analysis_lat: normalized.analysis_lat,
      analysis_lng: normalized.analysis_lng,
      display_lat: normalized.display_lat,
      display_lng: normalized.display_lng,
      location_accuracy: normalized.location_accuracy,
      location_area: normalized.location_area,
    };
  });
};

export const loadRawStaticBusinesses = async () => {
  // Dipakai secara internal oleh panel admin untuk keperluan penyemaian data awal.
  const response = await fetch('/data/umkm.json');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Gagal memuat data UMKM`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Format data UMKM tidak valid.');
  return data.map(normalizeBusinessLocation);
};

export const loadPublicBusinesses = async () => {
  // Website publik tetap dapat berjalan tanpa konfigurasi Supabase.
  if (!hasDatabaseConfiguration) return loadStaticBusinesses();
  // Lazy import mencegah kode admin/database masuk ke bundle statis awal.
  const { loadPublishedBusinesses } = await import('./umkmService');
  return loadPublishedBusinesses();
};
