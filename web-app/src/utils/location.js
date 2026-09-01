export const LOCATION_ACCURACY = {
  EXACT: 'tepat',
  APPROXIMATE: 'perkiraan_kecamatan',
  UNKNOWN: 'belum_terverifikasi',
};

// Mengubah nilai koordinat menjadi number valid atau null.
const finiteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const normalizeBusinessLocation = (business) => {
  // Koordinat lama dipakai sebagai fallback untuk data sebelum pemisahan lokasi.
  const legacyLat = finiteNumber(business.lat);
  const legacyLng = finiteNumber(business.lng);
  const analysisLat = finiteNumber(business.analysis_lat) ?? legacyLat;
  const analysisLng = finiteNumber(business.analysis_lng) ?? legacyLng;
  const displayLat = finiteNumber(business.display_lat) ?? legacyLat ?? analysisLat;
  const displayLng = finiteNumber(business.display_lng) ?? legacyLng ?? analysisLng;

  return {
    ...business,
    analysis_lat: analysisLat,
    analysis_lng: analysisLng,
    display_lat: displayLat,
    display_lng: displayLng,
    // Data lama dihasilkan dari pencocokan alamat/wilayah, jadi jangan
    // menganggap koordinatnya sebagai titik GPS yang presisi.
    location_accuracy: business.location_accuracy || LOCATION_ACCURACY.APPROXIMATE,
    location_area: business.location_area || '',
  };
};

export const getAnalysisCoordinates = (business) => {
  // Analisis spasial memakai pasangan koordinat analisis bila tersedia.
  const lat = finiteNumber(business.analysis_lat ?? business.lat);
  const lng = finiteNumber(business.analysis_lng ?? business.lng);
  return lat === null || lng === null ? null : { lat, lng };
};

export const getDisplayCoordinates = (business) => {
  // Peta publik memakai koordinat tampilan bila admin sudah mengoreksinya.
  const lat = finiteNumber(business.display_lat ?? business.lat ?? business.analysis_lat);
  const lng = finiteNumber(business.display_lng ?? business.lng ?? business.analysis_lng);
  return lat === null || lng === null ? null : { lat, lng };
};

export const isExactLocation = (business) =>
  business.location_accuracy === LOCATION_ACCURACY.EXACT;

export const isMappableLocation = (business) =>
  business.location_accuracy !== LOCATION_ACCURACY.UNKNOWN
  && getAnalysisCoordinates(business) !== null;

export const locationAccuracyLabel = (business) => {
  // Mengubah status internal menjadi label yang dapat dipahami pengguna.
  if (isExactLocation(business)) return 'Lokasi terverifikasi';
  if (business.location_accuracy === LOCATION_ACCURACY.UNKNOWN) {
    return 'Lokasi belum terverifikasi';
  }
  return 'Lokasi perkiraan berdasarkan wilayah';
};
