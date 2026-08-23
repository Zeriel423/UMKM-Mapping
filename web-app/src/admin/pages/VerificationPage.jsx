import { ExternalLink, MapPin, Save, Search } from 'lucide-react';
import L from 'leaflet';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { verifyBusinessLocation } from '../../services/umkmService';
import { getAnalysisCoordinates, LOCATION_ACCURACY, locationAccuracyLabel } from '../../utils/location';

const markerIcon = L.divIcon({
  className: 'admin-map-pin',
  html: '<span></span>',
  iconSize: [28, 36],
  iconAnchor: [14, 34],
});

const MapFocus = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 14));
  }, [lat, lng, map]);
  return null;
};

const VerificationPage = ({ businesses, refresh, notify }) => {
  const [includeVerified, setIncludeVerified] = useState(false);
  const candidates = useMemo(() => businesses.filter((business) =>
    business.is_active !== false
    && (includeVerified || business.location_accuracy !== LOCATION_ACCURACY.EXACT),
  ), [businesses, includeVerified]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return candidates.filter((business) => !query || [business.brand, business.name, business.address, business.location_area]
      .some((value) => value?.toLowerCase().includes(query)));
  }, [candidates, search]);

  const effectiveSelectedId = selectedId ?? filtered[0]?.id ?? null;
  const selected = businesses.find((business) => String(business.id) === String(effectiveSelectedId)) || null;
  const initialPoint = getAnalysisCoordinates(selected || {}) || { lat: 1.4748, lng: 124.8421 };
  const coordinates = draft?.coordinates || initialPoint;
  const accuracy = draft?.accuracy || (
    selected?.location_accuracy || LOCATION_ACCURACY.UNKNOWN
  );
  const area = draft?.area ?? selected?.location_area ?? '';
  const confirmed = draft?.confirmed === true;
  const latitude = coordinates.lat === '' || coordinates.lat === null
    ? null
    : Number(coordinates.lat);
  const longitude = coordinates.lng === '' || coordinates.lng === null
    ? null
    : Number(coordinates.lng);
  const coordinatesValid = Number.isFinite(latitude)
    && latitude >= -90
    && latitude <= 90
    && Number.isFinite(longitude)
    && longitude >= -180
    && longitude <= 180;
  const mapCoordinates = coordinatesValid
    ? { lat: latitude, lng: longitude }
    : initialPoint;

  const selectBusiness = (business) => {
    const point = getAnalysisCoordinates(business) || { lat: 1.4748, lng: 124.8421 };
    setSelectedId(business.id);
    setDraft({
      coordinates: point,
      accuracy: business.location_accuracy || LOCATION_ACCURACY.UNKNOWN,
      area: business.location_area || '',
      confirmed: false,
    });
  };

  const updateDraft = (updates) => setDraft((current) => ({
    coordinates,
    accuracy,
    area,
    confirmed,
    ...current,
    ...updates,
  }));

  const save = async () => {
    if (!selected) return;
    if (!coordinatesValid) {
      notify('Koordinat harus berada dalam rentang latitude -90–90 dan longitude -180–180.', 'error');
      return;
    }
    if (accuracy === LOCATION_ACCURACY.UNKNOWN) {
      notify('Pilih status “lokasi tepat” atau “masih berupa perkiraan” setelah pemeriksaan.', 'error');
      return;
    }
    if (accuracy === LOCATION_ACCURACY.EXACT && !confirmed) {
      notify('Konfirmasikan bahwa titik sudah diperiksa sebelum menandainya sebagai lokasi tepat.', 'error');
      return;
    }
    setSaving(true);
    try {
      await verifyBusinessLocation(selected.id, {
        lat: coordinates.lat,
        lng: coordinates.lng,
        location_accuracy: accuracy,
        location_area: area,
      });
      notify(`Lokasi ${selected.brand || selected.name} berhasil diperbarui.`, 'success');
      setSelectedId(null);
      setDraft(null);
      await refresh();
    } catch (error) {
      notify(error.message || 'Lokasi gagal diperbarui.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const searchMapsUrl = selected
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selected.brand || selected.name} ${selected.address || ''}`)}`
    : '#';

  return (
    <div className="admin-page-stack">
      <div className="admin-page-heading">
        <div><p className="admin-eyebrow">KUALITAS KOORDINAT</p><h1>Verifikasi Lokasi</h1><p>{candidates.length.toLocaleString('id-ID')} UMKM tersedia untuk diperiksa.</p></div>
      </div>

      <section className="admin-verification-layout">
        <aside className="admin-panel admin-verification-list">
          <label className="admin-search-field"><Search size={17} /><input aria-label="Cari data yang perlu diverifikasi" type="search" placeholder="Cari data yang perlu diverifikasi..." value={search} onChange={(event) => { setSearch(event.target.value); setSelectedId(null); setDraft(null); }} /></label>
          <label className="admin-check-field"><input type="checkbox" checked={includeVerified} onChange={(event) => { setIncludeVerified(event.target.checked); setSelectedId(null); setDraft(null); }} /><span>Sertakan lokasi yang sudah tepat</span></label>
          <div className="admin-verification-scroll">
            {filtered.map((business) => (
              <button className={`admin-verification-item ${String(business.id) === String(effectiveSelectedId) ? 'active' : ''}`} type="button" key={business.id} onClick={() => selectBusiness(business)}>
                <strong>{business.brand || business.name}</strong>
                <span>{business.address || 'Alamat belum tersedia'}</span>
                <small>{locationAccuracyLabel(business)}</small>
              </button>
            ))}
            {filtered.length === 0 && <div className="admin-empty-state">Semua data pada filter ini telah diverifikasi.</div>}
          </div>
        </aside>

        <div className="admin-page-stack admin-verification-workspace">
          {selected ? (
            <>
              <article className="admin-panel admin-verification-form">
                <div className="admin-panel-title-row">
                  <div><h2>{selected.brand || selected.name}</h2><p>{selected.address || 'Alamat belum tersedia'}</p></div>
                  <a className="admin-secondary-button" href={searchMapsUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Cari referensi</a>
                </div>
                <div className="admin-form-grid">
                  <label className="admin-field"><span>Latitude</span><input type="number" min="-90" max="90" step="any" value={coordinates.lat} aria-invalid={!coordinatesValid} onChange={(event) => updateDraft({ coordinates: { ...coordinates, lat: event.target.value }, confirmed: false })} /></label>
                  <label className="admin-field"><span>Longitude</span><input type="number" min="-180" max="180" step="any" value={coordinates.lng} aria-invalid={!coordinatesValid} onChange={(event) => updateDraft({ coordinates: { ...coordinates, lng: event.target.value }, confirmed: false })} /></label>
                  <label className="admin-field"><span>Status hasil verifikasi</span><select value={accuracy} onChange={(event) => updateDraft({ accuracy: event.target.value, confirmed: false })}><option value={LOCATION_ACCURACY.UNKNOWN}>Pilih hasil pemeriksaan</option><option value={LOCATION_ACCURACY.EXACT}>Lokasi tepat</option><option value={LOCATION_ACCURACY.APPROXIMATE}>Masih berupa perkiraan</option></select></label>
                  <label className="admin-field"><span>Wilayah/kecamatan</span><input value={area} onChange={(event) => updateDraft({ area: event.target.value })} /></label>
                </div>
                {accuracy === LOCATION_ACCURACY.EXACT && (
                  <label className="admin-check-field admin-verification-confirmation"><input type="checkbox" checked={confirmed} onChange={(event) => updateDraft({ confirmed: event.target.checked })} /><span>Saya telah memeriksa titik ini dan memastikan bahwa koordinatnya menunjukkan lokasi usaha.</span></label>
                )}
                <div className="admin-inline-note"><MapPin size={17} /><span>Geser pin pada peta atau isi koordinat secara manual. Status “lokasi tepat” menyamakan titik analisis dan tampilan.</span></div>
                <button className="admin-primary-button" type="button" onClick={save} disabled={saving || !coordinatesValid}><Save size={18} /> {saving ? 'Menyimpan...' : 'Simpan verifikasi'}</button>
              </article>

              <div className="admin-verification-map" aria-label="Peta verifikasi lokasi">
                <MapContainer center={[mapCoordinates.lat, mapCoordinates.lng]} zoom={14} zoomControl>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapFocus lat={mapCoordinates.lat} lng={mapCoordinates.lng} />
                  <Marker
                    draggable
                    icon={markerIcon}
                    position={[mapCoordinates.lat, mapCoordinates.lng]}
                    eventHandlers={{
                      dragend: (event) => {
                        const point = event.target.getLatLng();
                        updateDraft({
                          coordinates: { lat: point.lat, lng: point.lng },
                          confirmed: false,
                        });
                      },
                    }}
                  />
                </MapContainer>
              </div>
            </>
          ) : (
            <div className="admin-panel admin-empty-state">Pilih data UMKM untuk mulai memeriksa lokasinya.</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default VerificationPage;
