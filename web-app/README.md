# Zonasi UMKM Sulawesi Utara

Aplikasi Web GIS untuk pemetaan dan analisis zonasi UMKM menggunakan K-Means clustering.

## Menjalankan aplikasi

```bash
npm install
npm run dev
```

Website publik tersedia pada `/`. Panel pengelola tersedia pada `/admin`.

## Mengaktifkan panel admin

Tanpa konfigurasi backend, `/admin` menampilkan halaman persiapan dan ringkasan data JSON dalam mode baca-saja. Website publik tetap berfungsi seperti sebelumnya.

Untuk mengaktifkan login dan penyimpanan:

1. Buat proyek Supabase.
2. Jalankan [`supabase/migrations/20260823000000_admin_foundation.sql`](supabase/migrations/20260823000000_admin_foundation.sql) melalui SQL Editor.
3. Buat pengguna melalui **Authentication → Users**.
4. Daftarkan pengguna tersebut sebagai admin menggunakan contoh SQL pada bagian akhir migrasi.
5. Salin `.env.example` menjadi `.env.local`, lalu isi Project URL dan publishable key.
6. Buka `/admin`, masuk, lalu gunakan menu **Impor & Ekspor → Impor data awal**.
7. Setelah impor awal selesai, pasang dua variabel yang sama pada pengaturan Environment Variables di Vercel dan lakukan deployment ulang.

Ketika variabel Supabase sudah aktif, database menjadi satu-satunya sumber data website publik. Kegagalan database tidak akan diam-diam menampilkan kembali data JSON lama yang mungkin sudah dinonaktifkan oleh admin.

Jangan memasukkan secret key atau service-role key ke file `.env` frontend. Akses tabel dibatasi menggunakan PostgreSQL Row Level Security.

## Fitur admin

- Login email dan kata sandi melalui Supabase Auth.
- Dashboard kualitas dataset.
- Tambah, edit, aktifkan, dan nonaktifkan data UMKM.
- Verifikasi koordinat dengan pin peta yang dapat digeser.
- Analisis K-Means dan penyimpanan snapshot input, hash dataset, WCSS, centroid, serta iterasi.
- Impor atomik data awal/CSV tervalidasi dan ekspor CSV yang aman dibuka di spreadsheet.
- Audit log otomatis untuk perubahan data UMKM.
- Layout admin responsif yang terpisah dari CSS website publik.

Status **lokasi tepat** hanya dapat diberikan setelah titik diperiksa dan dikonfirmasi melalui halaman verifikasi. Hasil analisis admin memakai data aktif, dipublikasikan, dan dapat dipetakan—sama dengan sumber data halaman publik.

CSV hasil ekspor ditujukan untuk analisis dan pertukaran data, bukan pemulihan penuh database. Baris berstatus `tepat` harus diubah menjadi perkiraan/belum terverifikasi lalu diperiksa ulang sebelum dapat diimpor; bukti verifikasi tidak dipulihkan dari CSV.

## Hak akses per peran

- `superadmin` dan `admin`: mengelola UMKM, verifikasi, impor/ekspor, serta menyimpan hasil K-Means.
- `verifikator`: membaca data dan memperbarui koordinat/status melalui alur verifikasi terbatas; tidak dapat mengarsipkan atau mengimpor data.
- `viewer`: akses baca dashboard, data, analisis, dan riwayat; tidak memiliki operasi tulis.

Pembatasan ini diterapkan pada antarmuka sekaligus Row Level Security/RPC database. Menyembunyikan tombol saja tidak dijadikan lapisan keamanan.

## Pemeriksaan proyek

```bash
npm run lint
npm run build
```
