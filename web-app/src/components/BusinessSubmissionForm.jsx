import L from 'leaflet';
import { CheckCircle2, ClipboardCheck, Copy, ImagePlus, Loader2, MapPin, Search, Send, Store, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { isSupabaseConfigured } from '../lib/supabase';
import { requestSubmissionTrackingRecovery, submitBusinessSubmission, trackBusinessSubmission } from '../services/umkmService';

const EMPTY_FORM = {
  business_name: '',
  owner_name: '',
  phone: '',
  category: '',
  address: '',
  latitude: '',
  longitude: '',
  notes: '',
};

const NORTH_SULAWESI_VIEWBOX = '123.0,5.8,127.5,0.2';

const categoryGuides = [
  ['Makanan dan minuman', 'Kuliner, kue, minuman, katering, atau produk olahan.'],
  ['Kerajinan', 'Souvenir, anyaman, jahit, mebel, atau produk kreatif.'],
  ['Perdagangan', 'Toko kelontong, pakaian, kosmetik, atau barang kebutuhan.'],
  ['Jasa', 'Bengkel, salon, laundry, percetakan, atau jasa profesional.'],
  ['Pertanian dan perikanan', 'Hasil tani, peternakan, perikanan, atau olahannya.'],
];

const selectedLocationIcon = L.divIcon({
  className: 'public-location-picker-pin',
  html: '<span></span>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

const LocationPickerEvents = ({ onSelect }) => {
  useMapEvents({
    click: (event) => onSelect(event.latlng),
  });
  return null;
};

const LocationPickerFocus = ({ coordinates }) => {
  const map = useMap();

  useEffect(() => {
    if (coordinates) map.flyTo(coordinates, 17, { duration: 0.45 });
  }, [coordinates, map]);

  return null;
};

const BusinessSubmissionForm = ({ initialMode = 'submit', onClose }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [mapFocus, setMapFocus] = useState(null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoKind, setPhotoKind] = useState('product');
  const [trackerOpen, setTrackerOpen] = useState(initialMode === 'tracking');
  const [trackerCode, setTrackerCode] = useState('');
  const [trackingResult, setTrackingResult] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryForm, setRecoveryForm] = useState({ business_name: '', owner_name: '', phone: '' });
  const [recoverySaving, setRecoverySaving] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const dialogRef = useRef(null);
  const savingRef = useRef(false);
  const locationSearchCache = useRef(new Map());
  const lastSearchAt = useRef(0);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    document.body.classList.add('public-dialog-open');
    window.requestAnimationFrame(() => dialogRef.current?.querySelector('input, textarea, button')?.focus());

    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !savingRef.current) onClose();
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.classList.remove('public-dialog-open');
      window.removeEventListener('keydown', closeOnEscape);
      previousFocus?.focus?.();
    };
  }, [onClose]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const latitude = Number(form.latitude);
  const longitude = Number(form.longitude);
  const selectedLocation = form.latitude !== ''
    && form.longitude !== ''
    && Number.isFinite(latitude)
    && latitude >= -90
    && latitude <= 90
    && Number.isFinite(longitude)
    && longitude >= -180
    && longitude <= 180
    ? [latitude, longitude]
    : null;

  const selectLocation = ({ lat, lng }) => {
    setForm((current) => ({
      ...current,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
  };

  const searchLocation = async () => {
    const query = searchQuery.trim();
    if (query.length < 3) {
      setSearchError('Masukkan setidaknya 3 karakter untuk mencari lokasi.');
      return;
    }

    const cached = locationSearchCache.current.get(query.toLowerCase());
    if (cached) {
      setSearchResults(cached);
      setSearchError('');
      return;
    }

    setSearching(true);
    setSearchError('');
    try {
      const elapsed = Date.now() - lastSearchAt.current;
      if (elapsed < 1000) await new Promise((resolve) => window.setTimeout(resolve, 1000 - elapsed));
      const parameters = new URLSearchParams({
        format: 'jsonv2',
        limit: '5',
        countrycodes: 'id',
        viewbox: NORTH_SULAWESI_VIEWBOX,
        bounded: '1',
        q: query,
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${parameters}`);
      lastSearchAt.current = Date.now();
      if (!response.ok) throw new Error('Pencarian lokasi sedang tidak tersedia.');

      const locations = (await response.json())
        .map((location) => ({
          id: location.place_id,
          name: location.display_name,
          lat: Number(location.lat),
          lng: Number(location.lon),
        }))
        .filter((location) => Number.isFinite(location.lat) && Number.isFinite(location.lng));
      locationSearchCache.current.set(query.toLowerCase(), locations);
      setSearchResults(locations);
      if (!locations.length) setSearchError('Lokasi tidak ditemukan. Coba gunakan nama jalan atau gedung yang lebih spesifik.');
    } catch (searchRequestError) {
      setSearchResults([]);
      setSearchError(searchRequestError.message || 'Pencarian lokasi gagal. Coba lagi.');
    } finally {
      setSearching(false);
    }
  };

  const chooseSearchResult = (location) => {
    const coordinates = [location.lat, location.lng];
    selectLocation(location);
    setMapFocus(coordinates);
    setSearchQuery(location.name);
    setSearchResults([]);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const result = await submitBusinessSubmission({ ...form, photo, photo_kind: photoKind });
      setTrackingCode(result.tracking_code);
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError.message || 'Pengajuan belum dapat dikirim. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const checkSubmissionStatus = async () => {
    setTrackingLoading(true);
    setTrackingError('');
    try {
      setTrackingResult(await trackBusinessSubmission(trackerCode));
    } catch (trackingRequestError) {
      setTrackingResult(null);
      setTrackingError(trackingRequestError.message || 'Status pengajuan belum dapat dimuat.');
    } finally {
      setTrackingLoading(false);
    }
  };

  const submitRecoveryRequest = async (event) => {
    event.preventDefault();
    setRecoverySaving(true);
    setRecoveryMessage('');
    try {
      await requestSubmissionTrackingRecovery(recoveryForm);
      setRecoveryMessage('Permintaan terkirim. Admin akan memverifikasi data dan menghubungi nomor WhatsApp Anda.');
      setRecoveryForm({ business_name: '', owner_name: '', phone: '' });
    } catch (recoveryError) {
      setRecoveryMessage(recoveryError.message || 'Permintaan belum dapat dikirim.');
    } finally {
      setRecoverySaving(false);
    }
  };

  const copyTrackingCode = async () => {
    try {
      await navigator.clipboard.writeText(trackingCode);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 2200);
    } catch {
      setCodeCopied(false);
    }
  };

  return (
    <div className="public-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section ref={dialogRef} className="public-dialog" role="dialog" aria-modal="true" aria-labelledby="submission-form-title">
        <div className="public-dialog-header">
          <div className="public-dialog-heading">
            <span><Store size={21} aria-hidden="true" /></span>
            <div><p>DAFTARKAN USAHA</p><h2 id="submission-form-title">Pengajuan UMKM</h2></div>
          </div>
          <button className="public-dialog-close" type="button" onClick={onClose} disabled={saving} aria-label="Tutup formulir"><X size={21} /></button>
        </div>

        {!isSupabaseConfigured ? (
          <div className="public-submission-unavailable">
            <h3>Pendaftaran belum aktif</h3>
            <p>Hubungkan aplikasi ke Supabase dan jalankan migrasi database agar pengajuan dapat diterima.</p>
          </div>
        ) : submitted ? (
          <div className="public-submission-success">
            <CheckCircle2 size={44} aria-hidden="true" />
            <h3>Pengajuan terkirim</h3>
            <p>Admin akan meninjau data usaha Anda sebelum dipublikasikan pada peta. Simpan kode pelacakan berikut untuk melihat hasil tinjauan.</p>
            <code className="public-tracking-code">{trackingCode}</code>
            <button className="public-copy-code-button" type="button" onClick={copyTrackingCode}><Copy size={16} aria-hidden="true" /> {codeCopied ? 'Kode tersalin' : 'Salin kode'}</button>
            <button className="public-submit-button" type="button" onClick={onClose}>Selesai</button>
          </div>
        ) : (
          <form className="public-submission-form" onSubmit={submit}>
            <p className="public-submission-intro">Isi data usaha Anda. Titik lokasi bersifat opsional dan akan diverifikasi oleh admin.</p>
            <button className="public-status-trigger" type="button" onClick={() => setTrackerOpen((current) => !current)} aria-expanded={trackerOpen}>
              <ClipboardCheck size={17} aria-hidden="true" /> Lacak status pengajuan UMKM
            </button>
            {trackerOpen && (
              <div className="public-status-panel" role="search">
                <label><span>Kode pelacakan</span><input value={trackerCode} onChange={(event) => setTrackerCode(event.target.value)} placeholder="Masukkan kode dari pengajuan Anda" /></label>
                <button type="button" onClick={checkSubmissionStatus} disabled={trackingLoading}>{trackingLoading ? 'Memeriksa...' : 'Cek status'}</button>
                {trackingError && <p className="public-submission-error" role="alert">{trackingError}</p>}
                {trackingResult && <div className={`public-tracking-result public-tracking-${trackingResult.status}`}><strong>{trackingResult.status === 'pending' ? 'Menunggu tinjauan' : trackingResult.status === 'approved' ? 'Disetujui' : 'Ditolak'}</strong><span>{trackingResult.business_name}</span>{trackingResult.status === 'rejected' && <p><b>Alasan penolakan:</b> {trackingResult.review_note || 'Admin belum menyertakan alasan.'}</p>}</div>}
                <button className="public-recovery-trigger" type="button" onClick={() => setRecoveryOpen((current) => !current)} aria-expanded={recoveryOpen}>Lupa kode pelacakan?</button>
                {recoveryOpen && <div className="public-recovery-panel"><p>Masukkan data yang sama seperti saat mendaftar. Admin akan memeriksa kecocokan data lalu menghubungi WhatsApp Anda.</p><label><span>Nama usaha</span><input value={recoveryForm.business_name} onChange={(event) => setRecoveryForm((current) => ({ ...current, business_name: event.target.value }))} maxLength="160" /></label><label><span>Nama pemilik</span><input value={recoveryForm.owner_name} onChange={(event) => setRecoveryForm((current) => ({ ...current, owner_name: event.target.value }))} maxLength="120" /></label><label><span>Nomor WhatsApp</span><input type="tel" value={recoveryForm.phone} onChange={(event) => setRecoveryForm((current) => ({ ...current, phone: event.target.value }))} maxLength="40" /></label><button type="button" onClick={submitRecoveryRequest} disabled={recoverySaving}>{recoverySaving ? 'Mengirim...' : 'Kirim permintaan'}</button>{recoveryMessage && <p className="public-recovery-message" role="status">{recoveryMessage}</p>}</div>}
              </div>
            )}
            <div className="public-submission-grid">
              <label><span>Nama usaha *</span><input value={form.business_name} onChange={(event) => update('business_name', event.target.value)} maxLength="160" required /></label>
              <label><span>Nama pemilik *</span><input value={form.owner_name} onChange={(event) => update('owner_name', event.target.value)} maxLength="120" required /></label>
              <label><span>Nomor WhatsApp *</span><input type="tel" inputMode="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} maxLength="40" required /></label>
              <label><span>Kategori usaha *</span><input list="submission-category-options" value={form.category} onChange={(event) => update('category', event.target.value)} maxLength="100" placeholder="Contoh: Makanan dan minuman" required /><datalist id="submission-category-options">{categoryGuides.map(([name]) => <option key={name} value={name} />)}</datalist></label>
              <label className="public-submission-full"><span>Alamat usaha *</span><textarea rows="3" value={form.address} onChange={(event) => update('address', event.target.value)} maxLength="500" required /></label>
            </div>

            <div className="public-category-guide"><strong>Panduan memilih kategori</strong>{categoryGuides.map(([name, description]) => <p key={name}><b>{name}</b> — {description}</p>)}</div>

            <div className="public-photo-field">
              <div><strong><ImagePlus size={17} aria-hidden="true" /> Foto usaha</strong><p>Unggah satu foto produk atau tempat usaha untuk membantu admin memverifikasi pengajuan.</p></div>
              <label><span>Jenis foto</span><select value={photoKind} onChange={(event) => setPhotoKind(event.target.value)} disabled={!photo}><option value="product">Produk</option><option value="place">Tempat usaha</option></select></label>
              <label className="public-photo-upload"><span>Pilih foto</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /><small>{photo ? `${photo.name} (${Math.ceil(photo.size / 1024)} KB)` : 'JPG, PNG, atau WebP, maksimal 5 MB.'}</small></label>
            </div>

            <div className="public-location-fields">
              <div><strong><MapPin size={17} aria-hidden="true" /> Titik lokasi usaha</strong><p>Pilih titik usaha secara manual pada peta agar koordinat lebih presisi.</p></div>
              <button className="public-location-button" type="button" onClick={() => setPickerOpen((current) => !current)} aria-expanded={pickerOpen} aria-controls="submission-location-picker"><MapPin size={17} /> {pickerOpen ? 'Tutup peta' : 'Pilih lokasi'}</button>
              {pickerOpen && (
                <div className="public-location-picker" id="submission-location-picker">
                  <p>Klik peta untuk menetapkan titik lokasi usaha.</p>
                  <div className="public-location-search">
                    <label className="public-visually-hidden" htmlFor="submission-location-search">Cari jalan atau gedung</label>
                    <input id="submission-location-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        searchLocation();
                      }
                    }} placeholder="Cari nama jalan atau gedung" autoComplete="off" />
                    <button type="button" onClick={searchLocation} disabled={searching}>{searching ? <Loader2 className="animate-spin" size={17} /> : <Search size={17} />} {searching ? 'Mencari...' : 'Cari'}</button>
                  </div>
                  {searchError && <p className="public-location-search-error" role="alert">{searchError}</p>}
                  {searchResults.length > 0 && (
                    <div className="public-location-search-results" role="listbox" aria-label="Hasil pencarian lokasi">
                      {searchResults.map((location) => <button type="button" role="option" key={location.id} onClick={() => chooseSearchResult(location)}><MapPin size={16} aria-hidden="true" /><span>{location.name}</span></button>)}
                    </div>
                  )}
                  <div className="public-location-picker-map" aria-label="Peta pemilih lokasi usaha">
                    <MapContainer center={selectedLocation || [1.2, 124.5]} zoom={selectedLocation ? 15 : 8} zoomControl>
                      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
                      <LocationPickerEvents onSelect={selectLocation} />
                      <LocationPickerFocus coordinates={mapFocus} />
                      {selectedLocation && <Marker position={selectedLocation} icon={selectedLocationIcon} />}
                    </MapContainer>
                  </div>
                  <small className="public-location-attribution">Pencarian lokasi oleh <a href="https://www.openstreetmap.org/" target="_blank" rel="noreferrer">OpenStreetMap</a>.</small>
                </div>
              )}
              <div className="public-location-coordinates" aria-live="polite">
                <label><span>Latitude</span><input type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(event) => update('latitude', event.target.value)} /></label>
                <label><span>Longitude</span><input type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(event) => update('longitude', event.target.value)} /></label>
              </div>
            </div>

            <label className="public-submission-notes"><span>Keterangan tambahan</span><textarea rows="3" value={form.notes} onChange={(event) => update('notes', event.target.value)} maxLength="1000" placeholder="Contoh: jam operasional atau petunjuk lokasi" /></label>
            {error && <div className="public-submission-error" role="alert">{error}</div>}
            <div className="public-submission-actions">
              <button className="public-cancel-button" type="button" onClick={onClose} disabled={saving}>Batal</button>
              <button className="public-submit-button" type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} {saving ? 'Mengirim...' : 'Kirim pengajuan'}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
};

export default BusinessSubmissionForm;
