import { Archive, CheckCircle2, Edit3, Plus, RotateCcw, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { saveBusiness, setBusinessActive } from '../../services/umkmService';
import { LOCATION_ACCURACY, locationAccuracyLabel } from '../../utils/location';

const PAGE_SIZE = 30;

const EMPTY_BUSINESS = {
  name: '',
  brand: '',
  owner: '',
  product_type: '',
  product_label: '',
  address: '',
  location_area: '',
  location_accuracy: LOCATION_ACCURACY.UNKNOWN,
  analysis_lat: '',
  analysis_lng: '',
  is_active: true,
  published: true,
};

const accuracyClass = (accuracy) => {
  if (accuracy === LOCATION_ACCURACY.EXACT) return 'admin-status-success';
  if (accuracy === LOCATION_ACCURACY.UNKNOWN) return 'admin-status-danger';
  return 'admin-status-warning';
};

const BusinessDialog = ({ business, onClose, onSaved, notify }) => {
  const [form, setForm] = useState(() => business ? { ...business } : { ...EMPTY_BUSINESS });
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef(null);
  const hasExactLocation = business?.location_accuracy === LOCATION_ACCURACY.EXACT;

  useEffect(() => {
    const previousFocus = document.activeElement;
    document.body.classList.add('admin-dialog-open');
    window.requestAnimationFrame(() => dialogRef.current?.querySelector('input, select, textarea, button')?.focus());

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;

      const focusable = [...(dialogRef.current?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
      ) || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.classList.remove('admin-dialog-open');
      window.removeEventListener('keydown', closeOnEscape);
      previousFocus?.focus?.();
    };
  }, [onClose]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const coordinateValues = form.location_accuracy === LOCATION_ACCURACY.EXACT
        ? {
            lat: form.analysis_lat,
            lng: form.analysis_lng,
            display_lat: form.analysis_lat,
            display_lng: form.analysis_lng,
          }
        : {};
      const saved = await saveBusiness({ ...form, ...coordinateValues });
      notify(`Data ${saved.brand || saved.name} berhasil disimpan.`, 'success');
      onSaved();
      onClose();
    } catch (error) {
      notify(error.message || 'Data gagal disimpan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialogRef} className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="business-form-title">
        <div className="admin-dialog-header">
          <div><p className="admin-eyebrow">DATA UMKM</p><h2 id="business-form-title">{business ? 'Edit UMKM' : 'Tambah UMKM'}</h2></div>
          <button className="admin-icon-button" type="button" onClick={onClose} aria-label="Tutup formulir"><X size={20} /></button>
        </div>

        <form className="admin-form admin-form-grid" onSubmit={submit}>
          <label className="admin-field"><span>Nama data/sumber *</span><input value={form.name} onChange={(event) => update('name', event.target.value)} required /></label>
          <label className="admin-field"><span>Nama usaha/merek</span><input value={form.brand || ''} onChange={(event) => update('brand', event.target.value)} /></label>
          <label className="admin-field"><span>Nama pemilik</span><input value={form.owner || ''} onChange={(event) => update('owner', event.target.value)} /></label>
          <label className="admin-field"><span>Kode kategori</span><input value={form.product_type || ''} onChange={(event) => update('product_type', event.target.value)} /></label>
          <label className="admin-field"><span>Nama kategori</span><input value={form.product_label || ''} onChange={(event) => update('product_label', event.target.value)} /></label>
          <label className="admin-field"><span>Wilayah</span><input value={form.location_area || ''} disabled={hasExactLocation} onChange={(event) => update('location_area', event.target.value)} /></label>
          <label className="admin-field admin-field-full"><span>Alamat *</span><textarea rows="3" value={form.address || ''} onChange={(event) => update('address', event.target.value)} required /></label>
          <label className="admin-field"><span>Status lokasi</span><select value={form.location_accuracy} disabled={hasExactLocation} onChange={(event) => update('location_accuracy', event.target.value)}>{hasExactLocation && <option value={LOCATION_ACCURACY.EXACT}>Lokasi tepat</option>}<option value={LOCATION_ACCURACY.APPROXIMATE}>Perkiraan kecamatan</option><option value={LOCATION_ACCURACY.UNKNOWN}>Belum terverifikasi</option></select><small>{hasExactLocation ? 'Koordinat terverifikasi hanya dapat dikoreksi melalui menu Verifikasi Lokasi.' : 'Gunakan menu Verifikasi Lokasi untuk menetapkan lokasi tepat.'}</small></label>
          <label className="admin-field"><span>Latitude analisis</span><input type="number" min="-90" max="90" step="any" value={form.analysis_lat ?? ''} disabled={hasExactLocation} onChange={(event) => update('analysis_lat', event.target.value)} /></label>
          <label className="admin-field"><span>Longitude analisis</span><input type="number" min="-180" max="180" step="any" value={form.analysis_lng ?? ''} disabled={hasExactLocation} onChange={(event) => update('analysis_lng', event.target.value)} /></label>
          <label className="admin-check-field"><input type="checkbox" checked={form.published !== false} onChange={(event) => update('published', event.target.checked)} /><span>Tampilkan pada website publik</span></label>
          <label className="admin-check-field"><input type="checkbox" checked={form.is_active !== false} onChange={(event) => update('is_active', event.target.checked)} /><span>Data aktif</span></label>

          <div className="admin-dialog-actions admin-field-full">
            <button className="admin-secondary-button" type="button" onClick={onClose}>Batal</button>
            <button className="admin-primary-button" type="submit" disabled={saving}><CheckCircle2 size={18} /> {saving ? 'Menyimpan...' : 'Simpan data'}</button>
          </div>
        </form>
      </section>
    </div>
  );
};

const BusinessesPage = ({ businesses, loading, refresh, notify, canManage }) => {
  const [search, setSearch] = useState('');
  const [accuracy, setAccuracy] = useState('all');
  const [activity, setActivity] = useState('active');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(undefined);
  const [busyId, setBusyId] = useState(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return businesses.filter((business) => {
      const matchesQuery = !query || [business.brand, business.name, business.owner, business.address]
        .some((value) => value?.toLowerCase().includes(query));
      const matchesAccuracy = accuracy === 'all' || business.location_accuracy === accuracy;
      const matchesActivity = activity === 'all'
        || (activity === 'active' ? business.is_active !== false : business.is_active === false);
      return matchesQuery && matchesAccuracy && matchesActivity;
    });
  }, [businesses, search, accuracy, activity]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleActive = async (business) => {
    if (!canManage) return;
    const nextActive = business.is_active === false;
    setBusyId(business.id);
    try {
      await setBusinessActive(business.id, nextActive);
      notify(nextActive ? 'Data diaktifkan kembali.' : 'Data dinonaktifkan.', 'success');
      await refresh();
    } catch (error) {
      notify(error.message || 'Status data gagal diubah.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-page-stack">
      <div className="admin-page-heading">
        <div><p className="admin-eyebrow">PENGELOLAAN DATA</p><h1>Data UMKM</h1><p>{businesses.length.toLocaleString('id-ID')} data tersimpan di database.</p></div>
        {canManage && <button className="admin-primary-button" type="button" onClick={() => setEditing(null)}><Plus size={18} /> Tambah UMKM</button>}
      </div>

      {!canManage && <div className="admin-alert">Peran Anda memiliki akses baca. Penambahan, penyuntingan, dan pengarsipan data hanya tersedia untuk admin.</div>}

      <section className="admin-panel admin-toolbar">
        <label className="admin-search-field"><Search size={18} /><input aria-label="Cari usaha, pemilik, atau alamat" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cari usaha, pemilik, atau alamat..." /></label>
        <label className="admin-compact-field"><span>Status lokasi</span><select value={accuracy} onChange={(event) => { setAccuracy(event.target.value); setPage(1); }}><option value="all">Semua</option><option value={LOCATION_ACCURACY.EXACT}>Tepat</option><option value={LOCATION_ACCURACY.APPROXIMATE}>Perkiraan</option><option value={LOCATION_ACCURACY.UNKNOWN}>Belum terverifikasi</option></select></label>
        <label className="admin-compact-field"><span>Status data</span><select value={activity} onChange={(event) => { setActivity(event.target.value); setPage(1); }}><option value="active">Aktif</option><option value="inactive">Nonaktif</option><option value="all">Semua</option></select></label>
      </section>

      <section className="admin-panel admin-table-panel">
        <div className="admin-table-summary"><span>{filtered.length.toLocaleString('id-ID')} hasil</span><span>Halaman {currentPage} dari {pageCount}</span></div>
        {loading ? <div className="admin-empty-state">Memuat data UMKM...</div> : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>Usaha</th><th>Kategori</th><th>Wilayah</th><th>Status lokasi</th><th>Status data</th>{canManage && <th><span className="admin-visually-hidden">Tindakan</span></th>}</tr></thead>
              <tbody>
                {visible.map((business) => (
                  <tr key={business.id}>
                    <td><strong>{business.brand || business.name}</strong><small>{business.owner || 'Pemilik belum tersedia'}</small><small>{business.address || 'Alamat belum tersedia'}</small></td>
                    <td>{business.product_label || business.product_type || '-'}</td>
                    <td>{business.location_area || '-'}</td>
                    <td><span className={`admin-status-badge ${accuracyClass(business.location_accuracy)}`}>{locationAccuracyLabel(business)}</span></td>
                    <td><span className={`admin-status-badge ${business.is_active === false ? 'admin-status-neutral' : 'admin-status-success'}`}>{business.is_active === false ? 'Nonaktif' : 'Aktif'}</span></td>
                    {canManage && <td><div className="admin-row-actions"><button className="admin-icon-button" type="button" onClick={() => setEditing(business)} aria-label={`Edit ${business.brand || business.name}`}><Edit3 size={17} /></button><button className="admin-icon-button" type="button" onClick={() => toggleActive(business)} disabled={busyId === business.id} aria-label={business.is_active === false ? 'Aktifkan data' : 'Nonaktifkan data'}>{business.is_active === false ? <RotateCcw size={17} /> : <Archive size={17} />}</button></div></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && visible.length === 0 && <div className="admin-empty-state">Tidak ada data yang sesuai dengan filter.</div>}
        <div className="admin-pagination"><button className="admin-secondary-button" type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Sebelumnya</button><button className="admin-secondary-button" type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Berikutnya</button></div>
      </section>

      {canManage && editing !== undefined && <BusinessDialog business={editing} onClose={() => setEditing(undefined)} onSaved={refresh} notify={notify} />}
    </div>
  );
};

export default BusinessesPage;
