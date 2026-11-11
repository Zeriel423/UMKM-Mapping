import { Download, FileSpreadsheet, Upload, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { importBusinessesAtomically } from '../../services/umkmService';
import { loadRawStaticBusinesses } from '../../services/publicDataService';
import { businessesToCsv, downloadCsv, parseBusinessCsv } from '../utils/csv';
import { LOCATION_ACCURACY } from '../../utils/location';

// Menyelaraskan record import dengan data existing agar koordinat terverifikasi tidak tertimpa
const mergeWithExisting = (importedRecords, currentBusinesses) => {
  const currentById = new Map((currentBusinesses || []).map((b) => [Number(b.id), b]));
  return importedRecords.map((record) => {
    if (record.id === undefined || record.id === null) return record;
    const existing = currentById.get(Number(record.id));
    if (!existing) return record;

    // Pertahankan koordinat yang sudah tepat/terverifikasi
    const existingIsExact = existing.location_accuracy === LOCATION_ACCURACY.EXACT;
    const importedIsExact = record.location_accuracy === LOCATION_ACCURACY.EXACT;
    const importedHasCoords = Number.isFinite(record.analysis_lat) && Number.isFinite(record.analysis_lng);

    const keepExistingCoords = existingIsExact && (!importedIsExact || !importedHasCoords);

    return {
      ...existing,
      ...record,
      // Pertahankan nilai privat asli jika tidak ada perubahan baru pada file import
      name: record.name || existing.name || '',
      bpjph: record.bpjph || existing.bpjph || '',
      sumber_data: record.sumber_data || existing.sumber_data || '',
      owner: record.owner || existing.owner || '',
      nama_pemilik: record.nama_pemilik || existing.nama_pemilik || '',
      // Koordinat latitude dan longitude yang sudah diperbaiki tidak boleh tertimpa
      analysis_lat: keepExistingCoords ? existing.analysis_lat : (record.analysis_lat ?? existing.analysis_lat),
      analysis_lng: keepExistingCoords ? existing.analysis_lng : (record.analysis_lng ?? existing.analysis_lng),
      display_lat: keepExistingCoords ? existing.display_lat : (record.display_lat ?? existing.display_lat),
      display_lng: keepExistingCoords ? existing.display_lng : (record.display_lng ?? existing.display_lng),
      lat: keepExistingCoords ? existing.lat : (record.lat ?? existing.lat),
      lng: keepExistingCoords ? existing.lng : (record.lng ?? existing.lng),
      location_accuracy: keepExistingCoords ? existing.location_accuracy : (record.location_accuracy || existing.location_accuracy),
      location_area: record.location_area || existing.location_area,
    };
  });
};

// Menangani pratinjau, validasi, impor transaksi, dan ekspor CSV.
const ImportExportPage = ({ businesses, refresh, notify }) => {
  const [preview, setPreview] = useState(null);
  const [filename, setFilename] = useState('');
  const [progress, setProgress] = useState(null);
  const [importing, setImporting] = useState(false);

  // Membaca file lokal lalu memvalidasi seluruh baris sebelum impor diizinkan.
  const readCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    try {
      const parsed = parseBusinessCsv(await file.text());
      setPreview(parsed);
    } catch (error) {
      setPreview(null);
      notify(error.message || 'File gagal dibaca. Pastikan format CSV valid.', 'error');
    }
  };

  // Mengirim record valid sebagai satu transaksi database dan memperbarui progres.
  const runImport = async (records, sourceName) => {
    if (!records.length) return;
    const recordsWithId = records.filter((record) => record.id !== undefined && record.id !== null).length;
    if (businesses.length && recordsWithId && !window.confirm(
      `${recordsWithId.toLocaleString('id-ID')} baris memiliki ID dan dapat memperbarui data yang sudah ada. Koordinat yang sudah diverifikasi akan tetap dipertahankan. Lanjutkan impor atomik?`,
    )) return;

    setImporting(true);
    setProgress({ current: 0, total: records.length });
    try {
      // Gabungkan dengan data existing agar koordinat terverifikasi dan field tak berubah tetap aman
      const recordsToImport = mergeWithExisting(records, businesses);
      await importBusinessesAtomically(
        recordsToImport,
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

  // Memindahkan data JSON awal ke database untuk konfigurasi pertama kali.
  const seedStaticData = async () => {
    if (businesses.length && !window.confirm(
      'Database sudah memiliki data. Impor data awal akan menyinkronkan dataset dan tetap mempertahankan koordinat yang telah diverifikasi. Lanjutkan?',
    )) return;

    try {
      const staticBusinesses = await loadRawStaticBusinesses();
      await runImport(staticBusinesses, 'umkm.json (data awal)');
    } catch (error) {
      notify(error.message || 'Data awal gagal dimuat.', 'error');
    }
  };

  // Menghasilkan CSV dari data aktif tanpa permintaan jaringan tambahan.
  const exportData = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`data-umkm-${date}.csv`, businessesToCsv(businesses));
    notify('File CSV berhasil dibuat.', 'success');
  };

  const downloadTemplate = () => {
    downloadCsv('template-tambah-umkm.csv', businessesToCsv([]));
    notify('Template CSV berhasil dibuat.', 'success');
  };

  return (
    <div className="admin-page-stack">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">PERTUKARAN DATA</p>
          <h1>Impor &amp; Ekspor</h1>
          <p>Validasi data sebelum dimasukkan dan simpan salinan dataset untuk analisis.</p>
        </div>
      </div>

      <section className="admin-three-column">
        <article className="admin-panel admin-action-card">
          <div className="admin-action-icon"><UploadCloud size={24} /></div>
          <h2>Impor data awal</h2>
          <p>Salin isi <code>umkm.json</code> ke database. Koordinat yang telah diperbaiki tetap terlindungi.</p>
          <button className="admin-primary-button" type="button" onClick={seedStaticData} disabled={importing}>
            Impor {businesses.length ? 'ulang' : 'data awal'}
          </button>
        </article>

        <article className="admin-panel admin-action-card">
          <div className="admin-action-icon"><FileSpreadsheet size={24} /></div>
          <h2>Impor CSV / Excel</h2>
          <p>Mendukung format koma (,) dan titik-koma (;). Kolom privat (BPJPH, Pemilik, Sumber) terlindungi secara otomatis.</p>
          <div className="admin-action-actions">
            <label className="admin-file-button">
              <Upload size={18} /> Pilih file CSV
              <input type="file" accept=".csv,text/csv,text/plain" onChange={readCsv} />
            </label>
            <button className="admin-secondary-button" type="button" onClick={downloadTemplate}>
              <Download size={18} /> Unduh template CSV
            </button>
          </div>
        </article>

        <article className="admin-panel admin-action-card">
          <div className="admin-action-icon"><Download size={24} /></div>
          <h2>Ekspor dataset</h2>
          <p>Unduh {businesses.length.toLocaleString('id-ID')} data UMKM ke file CSV terstruktur lengkap dengan kolom privat.</p>
          <button className="admin-secondary-button" type="button" onClick={exportData} disabled={!businesses.length}>
            <Download size={18} /> Unduh CSV
          </button>
        </article>
      </section>

      {progress && (
        <section className="admin-panel">
          <div className="admin-panel-title-row">
            <div>
              <h2>Progres impor</h2>
              <p>{progress.current.toLocaleString('id-ID')} dari {progress.total.toLocaleString('id-ID')} data diproses.</p>
            </div>
            <strong>{Math.round((progress.current / progress.total) * 100)}%</strong>
          </div>
          <div className="admin-progress" role="progressbar" aria-label="Progres impor data" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round((progress.current / progress.total) * 100)}>
            <span style={{ width: `${(progress.current / progress.total) * 100}%` }} />
          </div>
        </section>
      )}

      {preview && (
        <section className="admin-panel">
          <div className="admin-panel-title-row">
            <div>
              <h2>Pratinjau {filename}</h2>
              <p>{preview.businesses.length.toLocaleString('id-ID')} baris ditemukan.</p>
            </div>
          </div>
          {preview.errors.length > 0 ? (
            <div className="admin-alert admin-alert-error">
              <div>
                <strong>Impor belum dapat dilanjutkan.</strong>
                <ul>{preview.errors.slice(0, 12).map((error) => <li key={error}>{error}</li>)}</ul>
                {preview.errors.length > 12 && <p>Dan {preview.errors.length - 12} masalah lainnya.</p>}
              </div>
            </div>
          ) : (
            <>
              <div className="admin-alert admin-alert-success">
                Struktur data valid. Sistem akan mempertahankan koordinat yang telah diverifikasi dan menjaga kolom privat.
              </div>
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Usaha (Brand)</th>
                      <th>Alamat</th>
                      <th>Latitude</th>
                      <th>Longitude</th>
                      <th>Status Lokasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.businesses.slice(0, 10).map((business, index) => (
                      <tr key={`${business.id}-${index}`}>
                        <td>{business.id ?? 'Baru'}</td>
                        <td>{business.brand || business.name}</td>
                        <td>{business.address}</td>
                        <td>{business.analysis_lat ?? '-'}</td>
                        <td>{business.analysis_lng ?? '-'}</td>
                        <td>{business.location_accuracy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="admin-primary-button"
                type="button"
                onClick={() => runImport(preview.businesses, filename)}
                disabled={importing}
              >
                <Upload size={18} /> {importing ? 'Mengimpor...' : 'Konfirmasi impor'}
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default ImportExportPage;
