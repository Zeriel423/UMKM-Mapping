import { BarChart3, Database, Play, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { loadKMeansRuns, saveKMeansRun } from '../../services/umkmService';
import { generateClusterColors, performKMeans } from '../../utils/kmeans';
import { getAnalysisCoordinates, isMappableLocation } from '../../utils/location';

// Menjaga urutan snapshot stabil sehingga hash dataset dapat direproduksi.
const compareSnapshotPoints = (first, second) => {
  const firstId = Number(first.id);
  const secondId = Number(second.id);
  if (Number.isFinite(firstId) && Number.isFinite(secondId) && firstId !== secondId) {
    return firstId - secondId;
  }

  const firstText = String(first.id);
  const secondText = String(second.id);
  if (firstText !== secondText) return firstText < secondText ? -1 : 1;
  if (first.lat !== second.lat) return first.lat - second.lat;
  return first.lng - second.lng;
};

// Membuat fingerprint dataset yang disimpan bersama hasil analisis.
const sha256 = async (value) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

// Menjalankan analisis K-Means admin dan menyimpan riwayat bila peran mengizinkan.
const KMeansPage = ({ businesses, canSave, notify }) => {
  const [kValue, setKValue] = useState(3);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  // Hanya titik dengan koordinat analisis valid yang masuk ke algoritma.
  const analysisData = useMemo(
    () => businesses.filter((item) => (
      item.is_active === true
      && item.published === true
      && isMappableLocation(item)
    )),
    [businesses],
  );

  // Snapshot terurut dipakai sebagai input hash yang tidak berubah antar render.
  const analysisSnapshot = useMemo(
    () => analysisData
      .map((item) => {
        const coordinates = getAnalysisCoordinates(item);
        return { id: item.id, lat: coordinates.lat, lng: coordinates.lng };
      })
      .sort(compareSnapshotPoints),
    [analysisData],
  );

  // Mengambil riwayat analisis terbaru setelah halaman dimuat atau data disimpan.
  const refreshHistory = async () => {
    try {
      setHistory(await loadKMeansRuns());
    } catch (error) {
      notify(error.message || 'Riwayat K-Means gagal dimuat.', 'error');
    }
  };

  useEffect(() => {
    let active = true;
    loadKMeansRuns()
      .then((data) => {
        if (active) setHistory(data);
      })
      .catch((error) => {
        if (active) notify(error.message || 'Riwayat K-Means gagal dimuat.', 'error');
      });
    return () => { active = false; };
  }, [notify]);

  // Perhitungan dan hash dijalankan bersama agar hasil dapat diaudit.
  const runAnalysis = async () => {
    if (analysisSnapshot.length < kValue) {
      notify('Jumlah data valid lebih kecil daripada nilai K.', 'error');
      return;
    }

    setRunning(true);
    try {
      await new Promise((resolve) => { window.setTimeout(resolve, 20); });
      const inputSnapshot = analysisSnapshot.map((point) => ({ ...point }));
      const datasetHash = await sha256(inputSnapshot);
      const analysis = performKMeans(inputSnapshot, kValue);
      const colors = generateClusterColors(kValue);
      const clusterStats = analysis.clusters.map((cluster, index) => ({
        cluster: index + 1,
        count: cluster.length,
        color: colors[index],
      }));
      setResult({
        ...analysis,
        colors,
        clusterStats,
        kValue,
        datasetHash,
        inputSnapshot,
        parameters: {
          algorithm: 'k-means',
          coordinate_source: 'getAnalysisCoordinates',
          distance_metric: 'haversine_km',
          initialization: 'deterministic_kmeans_plus_plus',
          max_iterations: 100,
          convergence_threshold_degrees: 0.0001,
          filters: {
            is_active: true,
            published: true,
            mappable_location: true,
          },
          excluded_records: businesses.length - inputSnapshot.length,
          snapshot_schema: '[{id,lat,lng}]',
          hash_algorithm: 'SHA-256',
        },
      });
    } catch (error) {
      notify(error.message || 'Analisis K-Means gagal dijalankan.', 'error');
    } finally {
      setRunning(false);
    }
  };

  // Hanya hasil yang telah dihitung yang dapat disimpan ke database.
  const saveResult = async () => {
    if (!result) return;
    if (!canSave) {
      notify('Hanya superadmin atau admin yang dapat menyimpan hasil K-Means.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveKMeansRun({
        k_value: result.kValue,
        data_count: result.inputSnapshot.length,
        iterations: result.iterations,
        wcss: result.wcss,
        centroids: result.centroids,
        cluster_stats: result.clusterStats,
        dataset_hash: result.datasetHash,
        input_snapshot: result.inputSnapshot,
        parameters: result.parameters,
      });
      notify('Hasil analisis K-Means disimpan ke riwayat.', 'success');
      await refreshHistory();
    } catch (error) {
      notify(error.message || 'Hasil analisis gagal disimpan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page-stack">
      <div className="admin-page-heading">
        <div><p className="admin-eyebrow">ANALISIS SPASIAL</p><h1>K-Means Clustering</h1><p>Jalankan algoritma yang sama dengan halaman publik dan simpan hasilnya agar dapat direproduksi.</p></div>
      </div>

      <section className="admin-two-column admin-kmeans-grid">
        <article className="admin-panel">
          <div className="admin-panel-heading"><BarChart3 size={21} /><div><h2>Parameter analisis</h2><p>{analysisData.length.toLocaleString('id-ID')} data memiliki lokasi yang dapat dianalisis.</p></div></div>
          <label className="admin-field">
            <span>Jumlah cluster (K): <strong>{kValue}</strong></span>
            <input type="range" min="2" max="10" value={kValue} onChange={(event) => setKValue(Number(event.target.value))} />
          </label>
          <div className="admin-analysis-note">
            <span>Jarak</span><strong>Haversine (kilometer)</strong>
            <span>Inisialisasi</span><strong>K-Means++ stabil</strong>
            <span>Data dikecualikan</span><strong>{(businesses.length - analysisData.length).toLocaleString('id-ID')}</strong>
          </div>
          <button className="admin-primary-button admin-full-button" type="button" onClick={runAnalysis} disabled={running}><Play size={18} /> {running ? 'Menghitung...' : 'Jalankan K-Means'}</button>
        </article>

        <article className="admin-panel">
          <div className="admin-panel-heading"><Database size={21} /><div><h2>Hasil terbaru</h2><p>Ringkasan kualitas dan komposisi cluster.</p></div></div>
          {result ? (
            <>
              <div className="admin-result-metrics"><div><span>WCSS</span><strong>{result.wcss.toFixed(2)} km²</strong></div><div><span>Iterasi</span><strong>{result.iterations}</strong></div><div><span>Nilai K</span><strong>{result.kValue}</strong></div></div>
              <div className="admin-cluster-list">
                {result.clusterStats.map((stat) => <div key={stat.cluster}><span className="admin-color-dot" style={{ background: stat.color }} /><span>Wilayah {stat.cluster}</span><strong>{stat.count.toLocaleString('id-ID')} UMKM</strong></div>)}
              </div>
              <div className="admin-analysis-note"><span>Hash dataset</span><strong title={result.datasetHash}>{result.datasetHash.slice(0, 16)}…</strong></div>
              {canSave ? (
                <button className="admin-secondary-button admin-full-button" type="button" onClick={saveResult} disabled={saving}><Save size={18} /> {saving ? 'Menyimpan...' : 'Simpan hasil analisis'}</button>
              ) : (
                <div className="admin-inline-note"><Save size={17} /><span>Mode baca-saja. Hanya superadmin atau admin yang dapat menyimpan hasil analisis.</span></div>
              )}
            </>
          ) : <div className="admin-empty-state">Atur nilai K lalu jalankan analisis untuk melihat hasil.</div>}
        </article>
      </section>

      <section className="admin-panel admin-table-panel">
        <div className="admin-panel-title-row"><div><h2>Riwayat analisis</h2><p>30 eksekusi terbaru yang tersimpan.</p></div></div>
        <div className="admin-table-scroll">
          <table className="admin-table"><thead><tr><th>Waktu</th><th>K</th><th>Jumlah data</th><th>Iterasi</th><th>WCSS</th><th>Metode</th><th>Hash dataset</th></tr></thead><tbody>{history.map((run) => <tr key={run.id}><td>{new Date(run.created_at).toLocaleString('id-ID')}</td><td>{run.k_value}</td><td>{run.data_count.toLocaleString('id-ID')}</td><td>{run.iterations}</td><td>{Number(run.wcss).toFixed(2)} km²</td><td>{run.parameters?.initialization || 'K-Means++'}</td><td title={run.dataset_hash || undefined}>{run.dataset_hash ? `${run.dataset_hash.slice(0, 12)}…` : '—'}</td></tr>)}</tbody></table>
        </div>
        {history.length === 0 && <div className="admin-empty-state">Belum ada hasil analisis yang disimpan.</div>}
      </section>
    </div>
  );
};

export default KMeansPage;
