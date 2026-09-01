import { AlertCircle, CheckCircle2, Info, MapPin, Target, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Memformat angka statistik dengan pemisah ribuan Indonesia.
const formatNumber = (value) => Number(value || 0).toLocaleString('id-ID');

// Menampilkan ringkasan zonasi dan ketelitian lokasi di atas peta.
const MapInfoPanel = ({
  colors = [],
  clusterStats = [],
  locationStats = {},
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);

  const total = Number(locationStats.total || 0);
  const mappable = Number(locationStats.mappable || 0);
  const exact = Number(locationStats.exact || 0);
  const approximate = Number(locationStats.approximate || 0);
  const unknown = Number(locationStats.unknown || 0);

  const openPanel = () => {
    // Fokus berpindah ke tombol tutup agar panel dapat dipakai dengan keyboard.
    setIsOpen(true);
    window.requestAnimationFrame(() => closeRef.current?.focus());
  };

  const closePanel = () => {
    // Fokus dikembalikan ke pemicu setelah panel ditutup.
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    // Escape menutup panel informasi tanpa mengubah posisi peta.
    if (!isOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') closePanel();
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  if (disabled) return null;

  return (
    <div className={`map-info-control ${isOpen ? 'open' : ''}`}>
      {isOpen && (
        <aside
          className="map-info-panel"
          id="map-info-panel"
          role="region"
          aria-labelledby="map-info-title"
        >
          <header className="map-info-header">
            <div className="map-info-heading">
              <span className="map-info-heading-icon" aria-hidden="true">
                <Info size={18} />
              </span>
              <div>
                <span className="map-info-eyebrow">INFO PETA</span>
                <h2 id="map-info-title">Zonasi &amp; Akurasi Data</h2>
              </div>
            </div>
            <button
              ref={closeRef}
              className="map-info-close"
              type="button"
              onClick={closePanel}
              aria-label="Tutup info peta"
            >
              <X size={18} />
            </button>
          </header>

          <div className="map-info-content">
            <p className="map-info-context">
              Ringkasan untuk <strong>{formatNumber(total)} UMKM</strong> pada hasil saat ini.
            </p>

            <section className="map-info-section" aria-labelledby="map-info-zoning-title">
              <div className="map-info-section-title">
                <Target size={16} aria-hidden="true" />
                <h3 id="map-info-zoning-title">Zonasi K-Means</h3>
              </div>

              <div className="map-info-metrics">
                <div>
                  <span>Zona aktif</span>
                  <strong>{formatNumber(colors.length)}</strong>
                </div>
                <div>
                  <span>Titik dipetakan</span>
                  <strong>{formatNumber(mappable)}</strong>
                </div>
              </div>

              {colors.length > 0 ? (
                <div className={`map-info-zone-list ${colors.length > 5 ? 'dense' : ''}`}>
                  {colors.map((color, index) => (
                    <div className="map-info-zone-item" key={`${color}-${index}`}>
                      <span
                        className="map-info-zone-color"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span>Wilayah {index + 1}</span>
                      <strong>{formatNumber(clusterStats[index]?.count)} UMKM</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="map-info-empty">Tidak ada titik yang dapat dipetakan untuk hasil ini.</p>
              )}

              <div className="map-info-centroid">
                <span className="centroid-icon-preview" aria-hidden="true" />
                <span>Lingkaran besar menandai pusat cluster.</span>
              </div>
            </section>

            <section className="map-info-section" aria-labelledby="map-info-accuracy-title">
              <div className="map-info-section-title">
                <MapPin size={16} aria-hidden="true" />
                <h3 id="map-info-accuracy-title">Status Akurasi Lokasi</h3>
              </div>

              <div className="map-info-accuracy-list">
                <div className="map-info-accuracy-item exact">
                  <CheckCircle2 size={17} aria-hidden="true" />
                  <span>Lokasi terverifikasi</span>
                  <strong>{formatNumber(exact)}</strong>
                </div>
                <div className="map-info-accuracy-item approximate">
                  <MapPin size={17} aria-hidden="true" />
                  <span>Perkiraan berdasarkan wilayah</span>
                  <strong>{formatNumber(approximate)}</strong>
                </div>
                <div className="map-info-accuracy-item unknown">
                  <AlertCircle size={17} aria-hidden="true" />
                  <span>Belum terverifikasi</span>
                  <strong>{formatNumber(unknown)}</strong>
                </div>
              </div>
            </section>

            <div className="map-info-note">
              <Info size={16} aria-hidden="true" />
              <p>
                Warna titik menunjukkan wilayah hasil K-Means, bukan tingkat akurasi lokasi.
                Titik perkiraan mewakili wilayah dan bukan posisi GPS yang presisi.
              </p>
            </div>
          </div>
        </aside>
      )}

      <button
        ref={triggerRef}
        className="map-info-trigger"
        type="button"
        onClick={isOpen ? closePanel : openPanel}
        aria-label={isOpen ? 'Sembunyikan panel info peta' : 'Buka info peta dan status akurasi data'}
        aria-expanded={isOpen}
        aria-controls="map-info-panel"
      >
        <Info size={18} aria-hidden="true" />
        <span>Info Peta</span>
      </button>
    </div>
  );
};

export default MapInfoPanel;
