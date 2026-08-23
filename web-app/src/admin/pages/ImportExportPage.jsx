import { Download, FileSpreadsheet, Upload, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { importBusinessesAtomically } from '../../services/umkmService';
import { loadStaticBusinesses } from '../../services/publicDataService';
import { businessesToCsv, downloadCsv, parseBusinessCsv } from '../utils/csv';

const ImportExportPage = ({ businesses, refresh, notify }) => {
  const [preview, setPreview] = useState(null);
  const [filename, setFilename] = useState('');
  const [progress, setProgress] = useState(null);
  const [importing, setImporting] = useState(false);

  const readCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    try {
      const parsed = parseBusinessCsv(await file.text());
      setPreview(parsed);
    } catch (error) {
      setPreview(null);
      notify(error.message || 'CSV gagal dibaca.', 'error');
    }
  };

  const runImport = async (records, sourceName) => {
    if (!records.length) return;
    const recordsWithId = records.filter((record) => record.id !== undefined && record.id !== null).length;
    if (businesses.length && recordsWithId && !window.confirm(
      `${recordsWithId.toLocaleString('id-ID')} baris memiliki ID dan dapat menimpa data yang sudah diedit. Lanjutkan impor atomik?`,
    )) return;

    setImporting(true);
    setProgress({ current: 0, total: records.length });
    try {
      await importBusinessesAtomically(
        records,
        sourceName,
        (current, total) => setProgress({ current, total }),
      );
      notify(`${records.length.toLocaleString('id-ID')} data berhasil diimpor.`, 'success');
      setPreview(null);
      setFilename('');
      await refresh();
    } catch (error) {
      setProgress(null);
      notify(error.message || 'Impor data gagal.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const seedStaticData = async () => {
    try {
      const staticBusinesses = await loadStaticBusinesses();
      await runImport(staticBusinesses, 'umkm.json (data awal)');
    } catch (error) {
      notify(error.message || 'Data awal gagal dimuat.', 'error');
    }
  };

  const exportData = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`data-umkm-${date}.csv`, businessesToCsv(businesses));
    notify('File CSV berhasil dibuat.', 'success');
  };

  return (
    <div className="admin-page-stack">
      <div className="admin-page-heading">
        <div><p className="admin-eyebrow">PERTUKARAN DATA</p><h1>Impor &amp; Ekspor</h1><p>Validasi data sebelum dimasukkan dan simpan salinan dataset untuk analisis.</p></div>
      </div>

      <section className="admin-three-column">
        <article className="admin-panel admin-action-card">
          <div className="admin-action-icon"><UploadCloud size={24} /></div>
          <h2>Impor data awal</h2>
          <p>Salin seluruh isi <code>umkm.json</code> dalam satu transaksi. ID lama tetap dipertahankan.</p>
          <button className="admin-primary-button" type="button" onClick={seedStaticData} disabled={importing}>Impor {businesses.length ? 'ulang' : 'data awal'}</button>
        </article>

        <article className="admin-panel admin-action-card">
          <div className="admin-action-icon"><FileSpreadsheet size={24} /></div>
          <h2>Impor CSV</h2>
          <p>Kolom minimal: <code>name</code> dan <code>address</code>. Koordinat akan diperiksa sebelum impor.</p>
          <label className="admin-file-button"><Upload size={18} /> Pilih file CSV<input type="file" accept=".csv,text/csv" onChange={readCsv} /></label>
        </article>

        <article className="admin-panel admin-action-card">
          <div className="admin-action-icon"><Download size={24} /></div>
          <h2>Ekspor dataset</h2>
          <p>Unduh {businesses.length.toLocaleString('id-ID')} data untuk analisis. Ini bukan berkas pemulihan; status tepat wajib diverifikasi ulang saat diimpor.</p>
          <button className="admin-secondary-button" type="button" onClick={exportData} disabled={!businesses.length}><Download size={18} /> Unduh CSV</button>
        </article>
      </section>

      {progress && (
        <section className="admin-panel">
          <div className="admin-panel-title-row"><div><h2>Progres impor</h2><p>{progress.current.toLocaleString('id-ID')} dari {progress.total.toLocaleString('id-ID')} data diproses.</p></div><strong>{Math.round((progress.current / progress.total) * 100)}%</strong></div>
          <div className="admin-progress" role="progressbar" aria-label="Progres impor data" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round((progress.current / progress.total) * 100)}><span style={{ width: `${(progress.current / progress.total) * 100}%` }} /></div>
        </section>
      )}

      {preview && (
        <section className="admin-panel">
          <div className="admin-panel-title-row"><div><h2>Pratinjau {filename}</h2><p>{preview.businesses.length.toLocaleString('id-ID')} baris ditemukan.</p></div></div>
          {preview.errors.length > 0 ? (
            <div className="admin-alert admin-alert-error"><div><strong>Impor belum dapat dilanjutkan.</strong><ul>{preview.errors.slice(0, 12).map((error) => <li key={error}>{error}</li>)}</ul>{preview.errors.length > 12 && <p>Dan {preview.errors.length - 12} masalah lainnya.</p>}</div></div>
          ) : (
            <>
              <div className="admin-alert admin-alert-success">Struktur CSV valid. Periksa kembali sumber data sebelum menyimpannya.</div>
              <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>ID</th><th>Usaha</th><th>Alamat</th><th>Latitude</th><th>Longitude</th></tr></thead><tbody>{preview.businesses.slice(0, 10).map((business, index) => <tr key={`${business.id}-${index}`}><td>{business.id ?? 'Baru'}</td><td>{business.brand || business.name}</td><td>{business.address}</td><td>{business.analysis_lat ?? '-'}</td><td>{business.analysis_lng ?? '-'}</td></tr>)}</tbody></table></div>
              <button className="admin-primary-button" type="button" onClick={() => runImport(preview.businesses, filename)} disabled={importing}><Upload size={18} /> {importing ? 'Mengimpor...' : 'Konfirmasi impor'}</button>
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default ImportExportPage;
