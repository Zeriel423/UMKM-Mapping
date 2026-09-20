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
2. Jalankan seluruh migrasi di folder [`supabase/migrations`](supabase/migrations) melalui SQL Editor sesuai urutan nama file.
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
- Formulir pengajuan UMKM dari halaman peta, dengan peninjauan setujui/tolak oleh admin.
- Layout admin responsif yang terpisah dari CSS website publik.

Status **lokasi tepat** hanya dapat diberikan setelah titik diperiksa dan dikonfirmasi melalui halaman verifikasi. Hasil analisis admin memakai data aktif, dipublikasikan, dan dapat dipetakan—sama dengan sumber data halaman publik.

CSV hasil ekspor ditujukan untuk analisis dan pertukaran data, bukan pemulihan penuh database. Baris berstatus `tepat` harus diubah menjadi perkiraan/belum terverifikasi lalu diperiksa ulang sebelum dapat diimpor; bukti verifikasi tidak dipulihkan dari CSV.

## Hak akses per peran

- `superadmin` dan `admin`: mengelola UMKM, verifikasi, impor/ekspor, serta menyimpan hasil K-Means.
- `verifikator`: membaca data dan memperbarui koordinat/status melalui alur verifikasi terbatas; tidak dapat mengarsipkan atau mengimpor data.
- `viewer`: akses baca dashboard, data, analisis, dan riwayat; tidak memiliki operasi tulis.

Pembatasan ini diterapkan pada antarmuka sekaligus Row Level Security/RPC database. Menyembunyikan tombol saja tidak dijadikan lapisan keamanan.

## Pengajuan dari publik

Tombol **Daftarkan UMKM** pada peta membuka formulir untuk nama usaha, pemilik, kontak, kategori, alamat, dan titik lokasi opsional. Pengajuan hanya dapat dibuat; data pengajuan tidak dapat dibaca kembali oleh pengunjung.

Admin dan superadmin meninjau pengajuan melalui **Pengajuan UMKM**. Saat disetujui, aplikasi membuat data UMKM baru dan menandai pengajuan sebagai disetujui dalam satu transaksi. Lokasi yang dikirim pelaku berstatus perkiraan dan tetap dapat diperiksa lagi melalui menu Verifikasi Lokasi.

## Kategori, kepadatan, dan foto publik

Sidebar publik menyediakan **Mengenal Kategori UMKM** dan **Legenda UMKM & Layer Peta**. Checkbox kategori dapat dipilih bersamaan dan memfilter marker serta daftar usaha. Warna titik mengikuti kategori produk; polygon dan centroid tetap memakai warna K-Means. Menyembunyikan kategori di legenda tidak menghitung ulang K-Means atau mengubah batas zona.

Pilihan **Analisis kepadatan** menampilkan heatmap semua kategori terpilih atau satu kategori. Heatmap menunjukkan konsentrasi relatif titik pada tingkat zoom saat ini, bukan nilai usaha/km² maupun hasil K-Means. Titik perkiraan dan filter pencarian/zona memengaruhi tampilan. Batas dan nomor RW belum ditambahkan karena dataset RW belum tersedia.

Migrasi `supabase/migrations/20260920000101_published_umkm_photos.sql` sudah diterapkan pada proyek Supabase saat ini. Untuk instalasi baru, jalankan migrasi tersebut setelah migrasi pengajuan dan foto sebelumnya. Migrasi menyalin metadata foto pengajuan yang sudah disetujui ke `umkm_photos` dan menyinkronkan persetujuan berikutnya melalui trigger. Data kontak, kode pelacakan, dan pengajuan yang belum disetujui tetap privat. Bucket tetap privat; RLS hanya mengizinkan pembacaan foto usaha aktif dan dipublikasikan. Tautan foto berlaku 5 menit, sehingga tautan yang sudah diterbitkan dapat tetap berlaku sampai kedaluwarsa setelah usaha dinonaktifkan.

Foto dimuat saat kartu peta dibuka. Jika belum ada foto, kartu menampilkan keterangan tanpa gambar pengganti. Mode JSON lokal mendukung `photo_url` dan `photo_kind` (`product` atau `place`) jika foto asli sudah tersedia.

## Pemeriksaan proyek

```bash
npm run lint
npm run build
```
