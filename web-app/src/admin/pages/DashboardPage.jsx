import { AlertTriangle, CheckCircle2, MapPin, PackageSearch, Store } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getAnalysisCoordinates, isMappableLocation, LOCATION_ACCURACY } from '../../utils/location';
import { loadDashboardOverview } from '../../services/umkmService';

// Mengelompokkan data dengan Map agar ringkasan kategori tidak memakai pencarian berulang.
const countBy = (items, getValue) => {
  const counts = new Map();
  items.forEach((item) => {
    const value = getValue(item) || 'Belum dikategorikan';
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
};

// Menyajikan indikator kualitas data dan pintasan alur kerja admin.
const DashboardPage = ({ businesses, loading, onNavigate, canVerify, canManage }) => {
  const [overview, setOverview] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    loadDashboardOverview(canManage).then((data) => {
      if (active) setOverview(data);
    }).catch(() => {
      if (active) setOverview({ analysis: { error: 'Data belum dapat dimuat.' }, submissions: { error: 'Data belum dapat dimuat.' }, recovery: { error: 'Data belum dapat dimuat.' } });
    });
    return () => { active = false; };
  }, [canManage, retry]);
  // Ringkasan hanya dihitung ulang ketika daftar bisnis berubah.
  const summary = useMemo(() => {
    const active = businesses.filter((item) => item.is_active !== false);
    return {
      total: businesses.length,
      active: active.length,
      unverified: active.filter((item) => item.location_accuracy !== LOCATION_ACCURACY.EXACT).length,
      missing: active.filter((item) => {
        const point = getAnalysisCoordinates(item);
        return !point || Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180;
      }).length,
      uncategorized: active.filter((item) => !item.product_label?.trim() && !item.product_type?.trim()).length,
      exact: active.filter((item) => item.location_accuracy === LOCATION_ACCURACY.EXACT).length,
      approximate: active.filter((item) => item.location_accuracy === LOCATION_ACCURACY.APPROXIMATE).length,
      unknown: active.filter((item) => item.location_accuracy === LOCATION_ACCURACY.UNKNOWN).length,
      categories: countBy(active, (item) => item.product_label || item.product_type),
      regions: countBy(active, (item) => item.location_area),
    };
  }, [businesses]);

  const latest = overview?.analysis?.data?.[0];
  const analysisChanged = useMemo(() => {
    if (!Array.isArray(latest?.input_snapshot)) return null;
    const current = businesses.filter((item) => item.is_active === true && item.published === true && isMappableLocation(item));
    if (current.length !== latest.input_snapshot.length) return true;
    const saved = new Map(latest.input_snapshot.map((point) => [String(point.id), point]));
    return current.some((item) => {
      const previous = saved.get(String(item.id));
      const point = getAnalysisCoordinates(item);
      return !previous || previous.lat !== point.lat || previous.lng !== point.lng;
    });
  }, [businesses, latest]);

  if (loading) return <div className="admin-loading-card">Memuat ringkasan data...</div>;

  const verifiedPercentage = summary.active
    ? Math.round((summary.exact / summary.active) * 100)
    : 0;
  const queueCount = (key) => !overview ? 'Memuat…' : overview[key]?.error ? 'Tidak tersedia' : (overview[key]?.count ?? 0).toLocaleString('id-ID');
  const queue = (key, title, section) => (
    <article className="admin-panel">
      <div className="admin-panel-title-row"><div><h2>{title}</h2><p>Hingga 5 permintaan tertua yang masih menunggu.</p></div><button type="button" className="admin-secondary-button" onClick={() => onNavigate('/admin/pengajuan', { section })}>Lihat semua</button></div>
      {!overview ? <p>Memuat antrean…</p> : overview[key]?.error ? <p role="alert">{overview[key].error}</p> : overview[key]?.data.length ? <ul className="admin-dashboard-queue">{overview[key].data.map((item) => <li key={item.id}><div><strong>{item.business_name}</strong><small>{new Date(item.created_at).toLocaleString('id-ID')}</small></div><button type="button" className="admin-secondary-button" onClick={() => onNavigate('/admin/pengajuan', { section })}>{key === 'recovery' ? 'Proses' : 'Tinjau'}</button></li>)}</ul> : <p>Tidak ada permintaan yang menunggu.</p>}
    </article>
  );

  return (
    <div className="admin-page-stack">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">RINGKASAN SISTEM</p>
          <h1>Dashboard Admin</h1>
          <p>Pantau pekerjaan yang perlu ditindaklanjuti dan kualitas data UMKM.</p>
        </div>
        {canVerify && <button className="admin-primary-button" type="button" onClick={() => onNavigate('/admin/verifikasi')}>
          <MapPin size={18} /> Mulai verifikasi
        </button>}
      </div>

      <section className="admin-metric-grid" aria-label="Pintasan pekerjaan">
        <button type="button" className="admin-metric-card admin-dashboard-metric" onClick={() => onNavigate('/admin/umkm', { activity: 'active' })}><Store size={22} /><span>UMKM aktif</span><strong>{summary.active.toLocaleString('id-ID')}</strong><small>Lihat data aktif</small></button>
        <button type="button" className="admin-metric-card admin-dashboard-metric" onClick={() => onNavigate(canVerify ? '/admin/verifikasi' : '/admin/umkm', { quality: 'unverified' })}><MapPin size={22} /><span>Lokasi perlu diperiksa</span><strong>{summary.unverified.toLocaleString('id-ID')}</strong><small>Lokasi data aktif belum tepat</small></button>
        {canManage && <><button type="button" className="admin-metric-card admin-dashboard-metric" onClick={() => onNavigate('/admin/pengajuan')}><PackageSearch size={22} /><span>Pengajuan menunggu</span><strong>{queueCount('submissions')}</strong><small>Buka antrean pengajuan</small></button><button type="button" className="admin-metric-card admin-dashboard-metric" onClick={() => onNavigate('/admin/pengajuan', { section: 'recovery' })}><AlertTriangle size={22} /><span>Permintaan lupa kode</span><strong>{queueCount('recovery')}</strong><small>Proses pemulihan kode</small></button></>}
      </section>
      {canManage && <section className="admin-two-column">{queue('submissions', 'Pengajuan perlu ditinjau', 'submissions')}{queue('recovery', 'Pemulihan kode', 'recovery')}</section>}
      <section className="admin-two-column">
        <article className="admin-panel"><h2>Kualitas data aktif</h2><p>Satu usaha dapat memiliki beberapa masalah. Klik indikator untuk melihat datanya.</p><div className="admin-dashboard-quality">{[
          ['Koordinat kosong atau tidak valid', summary.missing, { quality: 'coordinates' }],
          ['Lokasi masih perkiraan', summary.approximate, { accuracy: LOCATION_ACCURACY.APPROXIMATE }],
          ['Kategori belum diisi', summary.uncategorized, { quality: 'category' }],
        ].map(([label, count, filter]) => <button type="button" key={label} onClick={() => onNavigate('/admin/umkm', filter)}><span>{label}</span><strong>{count.toLocaleString('id-ID')}</strong></button>)}</div></article>
        <article className="admin-panel"><div className="admin-panel-title-row"><div><h2>Ringkasan zona</h2><p>Analisis terakhir yang disimpan admin.</p></div><button type="button" className="admin-secondary-button" onClick={() => onNavigate('/admin/kmeans')}>Buka analisis</button></div>
          {analysisChanged === true && <div className="admin-alert">Data analisis sudah berubah. Jalankan ulang analisis untuk memperbarui ringkasan.</div>}
          {latest && analysisChanged === null && <p>Snapshot tidak tersedia; perubahan data belum dapat dibandingkan.</p>}
          {!overview ? <p>Memuat analisis…</p> : overview.analysis.error ? <p role="alert">{overview.analysis.error}</p> : !latest ? <p>Belum ada analisis tersimpan.</p> : <><p>{new Date(latest.created_at).toLocaleString('id-ID')} · {latest.data_count.toLocaleString('id-ID')} UMKM · {latest.k_value} zona</p><div className="admin-cluster-list">{(latest.cluster_stats || []).map((zone) => <div key={zone.cluster}><MapPin size={16} /><span>Zona {zone.cluster}</span><strong>{zone.count.toLocaleString('id-ID')} UMKM</strong></div>)}</div><p>Jumlah usaha terdata tidak menunjukkan tingkat kepadatan atau kemajuan ekonomi.</p></>}
          {overview && Object.values(overview).some((item) => item.error) && <button type="button" className="admin-secondary-button" onClick={() => { setOverview(null); setRetry((value) => value + 1); }}>Coba muat ulang</button>}
        </article>
      </section>

      <section className="admin-metric-grid" aria-label="Statistik data UMKM">
        <article className="admin-metric-card admin-metric-primary">
          <Store size={22} />
          <span>Total data</span>
          <strong>{summary.total.toLocaleString('id-ID')}</strong>
          <small>{summary.active.toLocaleString('id-ID')} data aktif</small>
        </article>
        <article className="admin-metric-card">
          <CheckCircle2 size={22} />
          <span>Lokasi tepat</span>
          <strong>{summary.exact.toLocaleString('id-ID')}</strong>
          <small>{verifiedPercentage}% dari data aktif</small>
        </article>
        <article className="admin-metric-card">
          <PackageSearch size={22} />
          <span>Lokasi perkiraan</span>
          <strong>{summary.approximate.toLocaleString('id-ID')}</strong>
          <small>Perlu pemeriksaan bertahap</small>
        </article>
        <article className="admin-metric-card admin-metric-danger">
          <AlertTriangle size={22} />
          <span>Belum terverifikasi</span>
          <strong>{summary.unknown.toLocaleString('id-ID')}</strong>
          <small>Tidak disertakan dalam K-Means</small>
        </article>
      </section>

      <section className="admin-two-column">
        <article className="admin-panel">
          <div className="admin-panel-title-row"><div><h2>Wilayah terbanyak</h2><p>Berdasarkan informasi wilayah pada dataset.</p></div></div>
          <div className="admin-ranking-list">
            {summary.regions.slice(0, 8).map((item, index) => (
              <div className="admin-ranking-item" key={item.label}>
                <span className="admin-ranking-number">{index + 1}</span>
                <span>{item.label}</span>
                <strong>{item.count.toLocaleString('id-ID')}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-panel">
          <div className="admin-panel-title-row"><div><h2>Kategori usaha</h2><p>Komposisi jenis produk terbesar.</p></div></div>
          <div className="admin-ranking-list">
            {summary.categories.slice(0, 8).map((item, index) => (
              <div className="admin-ranking-item" key={item.label}>
                <span className="admin-ranking-number">{index + 1}</span>
                <span>{item.label}</span>
                <strong>{item.count.toLocaleString('id-ID')}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="admin-panel admin-quality-panel">
        <div>
          <h2>Progres verifikasi lokasi</h2>
          <p>Lokasi tepat memiliki koordinat yang telah diperiksa secara manual oleh admin.</p>
        </div>
        <div className="admin-progress" role="progressbar" aria-label="Lokasi yang telah diverifikasi" aria-valuemin="0" aria-valuemax="100" aria-valuenow={verifiedPercentage}>
          <span style={{ width: `${verifiedPercentage}%` }} />
        </div>
        <strong>{verifiedPercentage}%</strong>
      </section>
    </div>
  );
};

export default DashboardPage;
