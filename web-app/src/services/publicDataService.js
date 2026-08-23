import { normalizeBusinessLocation } from '../utils/location';

const hasDatabaseConfiguration = Boolean(
  import.meta.env.VITE_SUPABASE_URL?.trim()
  && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim(),
);

export const loadStaticBusinesses = async () => {
  const response = await fetch('/data/umkm.json');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Gagal memuat data UMKM`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Format data UMKM tidak valid.');
  return data.map(normalizeBusinessLocation);
};

export const loadPublicBusinesses = async () => {
  if (!hasDatabaseConfiguration) return loadStaticBusinesses();
  const { loadPublishedBusinesses } = await import('./umkmService');
  return loadPublishedBusinesses();
};
