import { ArrowLeft, CheckCircle2, Database, FileCode2, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { loadStaticBusinesses } from '../services/publicDataService';
import { LOCATION_ACCURACY } from '../utils/location';

const AdminSetup = () => {
  const [businesses, setBusinesses] = useState([]);

  useEffect(() => {
    loadStaticBusinesses().then(setBusinesses).catch(() => setBusinesses([]));
  }, []);

  const stats = useMemo(() => ({
    total: businesses.length,
    exact: businesses.filter((item) => item.location_accuracy === LOCATION_ACCURACY.EXACT).length,
    approximate: businesses.filter((item) => item.location_accuracy === LOCATION_ACCURACY.APPROXIMATE).length,
    unknown: businesses.filter((item) => item.location_accuracy === LOCATION_ACCURACY.UNKNOWN).length,
  }), [businesses]);

  return (
    <div className="admin-setup-page">
      <header className="admin-setup-header">
        <a className="admin-back-link" href="/"><ArrowLeft size={17} /> Kembali ke peta publik</a>
        <span className="admin-status-badge admin-status-warning">Mode persiapan</span>
      </header>

      <main className="admin-setup-content">
        <section className="admin-setup-hero">
          <div>
            <p className="admin-eyebrow">FONDASI ADMIN TERPASANG</p>
            <h1>Hubungkan database untuk mengaktifkan pengelolaan data</h1>
            <p>
              Tampilan publik tetap menggunakan data JSON. Setelah Supabase dikonfigurasi,
              login, CRUD, verifikasi lokasi, riwayat, dan penyimpanan K-Means akan aktif.
            </p>
          </div>
          <div className="admin-setup-icon" aria-hidden="true"><ShieldCheck size={52} /></div>
        </section>

        <section className="admin-metric-grid" aria-label="Ringkasan data saat ini">
          <article className="admin-metric-card"><span>Total UMKM</span><strong>{stats.total.toLocaleString('id-ID')}</strong></article>
          <article className="admin-metric-card"><span>Lokasi tepat</span><strong>{stats.exact.toLocaleString('id-ID')}</strong></article>
          <article className="admin-metric-card"><span>Lokasi perkiraan</span><strong>{stats.approximate.toLocaleString('id-ID')}</strong></article>
          <article className="admin-metric-card"><span>Belum terverifikasi</span><strong>{stats.unknown.toLocaleString('id-ID')}</strong></article>
        </section>

        <section className="admin-setup-grid">
          <article className="admin-panel">
            <div className="admin-panel-heading"><Database size={20} /><div><h2>Aktifkan backend</h2><p>Tiga langkah konfigurasi produksi.</p></div></div>
            <ol className="admin-step-list">
              <li><CheckCircle2 size={18} /><span>Jalankan migrasi SQL pada folder <code>supabase/migrations</code>.</span></li>
              <li><CheckCircle2 size={18} /><span>Buat akun Auth dan masukkan pengguna tersebut ke tabel <code>admin_profiles</code>.</span></li>
              <li><CheckCircle2 size={18} /><span>Isi <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> di Vercel.</span></li>
            </ol>
          </article>

          <article className="admin-panel">
            <div className="admin-panel-heading"><FileCode2 size={20} /><div><h2>Keamanan bawaan</h2><p>Tidak ada kata sandi atau secret key di kode.</p></div></div>
            <ul className="admin-feature-list">
              <li>Website publik hanya dapat membaca data aktif yang dipublikasikan.</li>
              <li>Operasi tulis hanya tersedia bagi akun pada daftar admin aktif.</li>
              <li>Setiap perubahan UMKM direkam otomatis di audit log.</li>
              <li>Service-role key tidak pernah digunakan pada browser.</li>
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
};

export default AdminSetup;
