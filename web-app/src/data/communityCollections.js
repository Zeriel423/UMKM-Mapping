import { CakeSlice, HeartPulse, UtensilsCrossed } from 'lucide-react';

const PRODUCT_INFO = {
  A0001: ['#b91c1c', 'Pengolahan daging menjadi produk siap masak atau siap santap, seperti abon dan bakso.'],
  A0002: ['#a16207', 'Usaha pengolahan minyak dan lemak pangan, seperti minyak kelapa.'],
  A0003: ['#2563eb', 'Produk berbahan dasar susu, seperti susu olahan, yoghurt, dan es krim.'],
  A0004: ['#ea580c', 'Pembuatan makanan olahan dan hidangan siap santap.'],
  A0005: ['#16a34a', 'Pengolahan buah dan sayur menjadi produk seperti manisan, selai, atau acar.'],
  A0006: ['#854d0e', 'Produksi tepung dan pangan berbahan tepung, termasuk mi dan olahan sejenis.'],
  A0007: ['#9333ea', 'Usaha pembuatan roti, kue basah, kue kering, dan biskuit.'],
  A0009: ['#0284c7', 'Pengolahan ikan dan hasil laut, seperti ikan asap, ikan asin, dan abon ikan.'],
  A0010: ['#be185d', 'Usaha pengolahan telur, seperti telur asin dan produk olahan telur lainnya.'],
  A0011: ['#4d7c0f', 'Pembuatan bumbu dan olahan rempah untuk kebutuhan memasak.'],
  A0012: ['#92400e', 'Pengolahan kacang menjadi makanan, camilan, atau bahan pangan.'],
  A0014: ['#e11d48', 'Produksi camilan dan makanan ringan, seperti keripik dan aneka kudapan.'],
  A0016: ['#0f766e', 'Layanan penyediaan makanan untuk pesanan, acara, dan kebutuhan katering.'],
  B0001: ['#7c3aed', 'Usaha pembuatan jamu dan produk obat tradisional berbahan alami.'],
};

export const getProductInfo = (code) => {
  const info = PRODUCT_INFO[code];
  if (info) return { color: info[0], description: info[1] };
  const hash = Array.from(String(code || '')).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
  return {
    color: `hsl(${hash % 360}, 65%, 38%)`,
    description: 'Kategori usaha sesuai jenis produk atau layanan yang tercatat pada data UMKM. Lihat rincian produk pada masing-masing usaha.',
  };
};

// Kelompok kurasi memetakan kebutuhan pengguna ke kode kategori UMKM.
export const COMMUNITY_COLLECTIONS = [
  {
    // Koleksi untuk camilan dan oleh-oleh.
    id: 'oleh-oleh',
    title: 'Oleh-oleh & Jajanan',
    description: 'Camilan dan hidangan khas untuk dibawa pulang.',
    productTypes: ['A0014', 'A0007', 'A0012', 'A0009'],
    icon: CakeSlice,
  },
  {
    // Koleksi untuk pesanan makanan bersama atau acara.
    id: 'pesan-untuk-acara',
    title: 'Pesan untuk Acara',
    description: 'Katering dan makanan untuk kebutuhan bersama.',
    productTypes: ['A0016', 'A0004', 'A0001', 'A0009'],
    icon: UtensilsCrossed,
  },
  {
    // Koleksi produk kesehatan dan bahan alami.
    id: 'alami-dan-sehat',
    title: 'Alami & Sehat',
    description: 'Jamu, olahan buah, dan pilihan bahan alami.',
    productTypes: ['B0001', 'A0005', 'A0003', 'A0011'],
    icon: HeartPulse,
  },
];
