import { CheckCircle2, LocateFixed, Loader2, MapPin, Send, Store, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { submitBusinessSubmission } from '../services/umkmService';

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

const BusinessSubmissionForm = ({ onClose }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const dialogRef = useRef(null);
  const savingRef = useRef(false);

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

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Browser ini belum mendukung pengambilan lokasi.');
      return;
    }

    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((current) => ({
          ...current,
          latitude: coords.latitude.toFixed(6),
          longitude: coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      () => {
        setError('Lokasi tidak dapat diambil. Izinkan akses lokasi atau lanjutkan tanpa titik peta.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await submitBusinessSubmission(form);
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError.message || 'Pengajuan belum dapat dikirim. Coba lagi.');
    } finally {
      setSaving(false);
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
            <p>Admin akan meninjau data usaha Anda sebelum dipublikasikan pada peta.</p>
            <button className="public-submit-button" type="button" onClick={onClose}>Selesai</button>
          </div>
        ) : (
          <form className="public-submission-form" onSubmit={submit}>
            <p className="public-submission-intro">Isi data usaha Anda. Titik lokasi bersifat opsional dan akan diverifikasi oleh admin.</p>
            <div className="public-submission-grid">
              <label><span>Nama usaha *</span><input value={form.business_name} onChange={(event) => update('business_name', event.target.value)} maxLength="160" required /></label>
              <label><span>Nama pemilik *</span><input value={form.owner_name} onChange={(event) => update('owner_name', event.target.value)} maxLength="120" required /></label>
              <label><span>Nomor WhatsApp *</span><input type="tel" inputMode="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} maxLength="40" required /></label>
              <label><span>Kategori usaha *</span><input value={form.category} onChange={(event) => update('category', event.target.value)} maxLength="100" placeholder="Contoh: Makanan dan minuman" required /></label>
              <label className="public-submission-full"><span>Alamat usaha *</span><textarea rows="3" value={form.address} onChange={(event) => update('address', event.target.value)} maxLength="500" required /></label>
            </div>

            <div className="public-location-fields">
              <div><strong><MapPin size={17} aria-hidden="true" /> Titik lokasi usaha</strong><p>Gunakan lokasi saat ini agar admin lebih mudah memeriksa alamat usaha.</p></div>
              <button className="public-location-button" type="button" onClick={useCurrentLocation} disabled={locating}>{locating ? <Loader2 className="animate-spin" size={17} /> : <LocateFixed size={17} />} {locating ? 'Mengambil lokasi...' : 'Gunakan lokasi saat ini'}</button>
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
