import { AlertTriangle, CheckCircle2, MapPin, PackageSearch, Store } from 'lucide-react';
import { useMemo } from 'react';
import { LOCATION_ACCURACY } from '../../utils/location';

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

const DashboardPage = ({ businesses, loading, onNavigate, canVerify }) => {
  const summary = useMemo(() => {
    const active = businesses.filter((item) => item.is_active !== false);
    return {
      total: businesses.length,
      active: active.length,
      exact: active.filter((item) => item.location_accuracy === LOCATION_ACCURACY.EXACT).length,
      approximate: active.filter((item) => item.location_accuracy === LOCATION_ACCURACY.APPROXIMATE).length,
      unknown: active.filter((item) => item.location_accuracy === LOCATION_ACCURACY.UNKNOWN).length,
      categories: countBy(active, (item) => item.product_label || item.product_type),
      regions: countBy(active, (item) => item.location_area),
    };
  }, [businesses]);

  if (loading) return <div className="admin-loading-card">Memuat ringkasan data...</div>;

  const verifiedPercentage = summary.active
    ? Math.round((summary.exact / summary.active) * 100)
    : 0;

  return (
    <div className="admin-page-stack">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">RINGKASAN SISTEM</p>
          <h1>Dashboard Admin</h1>
          <p>Pantau kualitas dataset dan kesiapan analisis spasial.</p>
        </div>
        {canVerify && <button className="admin-primary-button" type="button" onClick={() => onNavigate('/admin/verifikasi')}>
          <MapPin size={18} /> Mulai verifikasi
        </button>}
      </div>

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
