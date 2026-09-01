import { normalizeBusinessLocation } from '../utils/location';

// Memeriksa apakah sumber data utama adalah database Supabase.
const hasDatabaseConfiguration = Boolean(
  import.meta.env.VITE_SUPABASE_URL?.trim()
  && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim(),
);

export const loadStaticBusinesses = async () => {
  // Menggunakan JSON lokal saat database belum dikonfigurasi.
  const response = await fetch('/data/umkm.json');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Gagal memuat data UMKM`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Format data UMKM tidak valid.');
  // Menyamakan format lokasi data lama dengan format database.
  return data.map(normalizeBusinessLocation);
};

export const loadPublicBusinesses = async () => {
  // Website publik tetap dapat berjalan tanpa konfigurasi Supabase.
  if (!hasDatabaseConfiguration) return loadStaticBusinesses();
  // Lazy import mencegah kode admin/database masuk ke bundle statis awal.
  const { loadPublishedBusinesses } = await import('./umkmService');
  return loadPublishedBusinesses();
};
