import { Eye, EyeOff, MapPin, Info, Layers, Search, X } from 'lucide-react';
import { useRef } from 'react';
import { getProductInfo } from '../data/communityCollections';

// Menyediakan pencarian, filter, ringkasan data, dan kontrol analisis peta.
const Sidebar = ({
  isOpen,
  kValue,
  setKValue,
  totalData,
  mappableCount,
  clusterStats,
  selectedZone,
  onSelectZone,
  selectedZoneSummary,
  showZoneAreas,
  setShowZoneAreas,

  iterations,
  wcss,
  searchQuery,
  setSearchQuery,
  productTypes,
  filteredCount,
  hiddenCategories,
  onToggleCategory,
  onToggleAllCategories,
  densityCategory,
  setDensityCategory,
}) => {
  const categoryDialog = useRef(null);
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark" aria-hidden="true">
            <MapPin size={22} />
          </span>
          <div>
            <span className="sidebar-eyebrow">WEB GIS SULAWESI UTARA</span>
            <h1>Zonasi UMKM</h1>
          </div>
        </div>
        <p className="sidebar-subtitle">
          Pemetaan persebaran dan analisis zonasi UMKM dengan K-Means.
        </p>
        <div className="sidebar-data-status">
          <span><i aria-hidden="true" />Data publik aktif</span>
          <strong>{mappableCount.toLocaleString('id-ID')} titik peta</strong>
        </div>
      </div>

      <section className="sidebar-discovery" aria-labelledby="sidebar-discovery-title">
        {/* Bagian ini mengelompokkan kontrol untuk menemukan UMKM publik. */}
        <div className="sidebar-section-heading">
          <div>
            <span className="sidebar-section-kicker">TEMUKAN USAHA</span>
            <h2 id="sidebar-discovery-title">Cari UMKM yang Anda butuhkan</h2>
          </div>
          <Search size={18} aria-hidden="true" />
        </div>

        <div className="search-box">
          <label className="visually-hidden" htmlFor="search-input">Cari UMKM</label>
          <Search size={16} className="search-icon" />
          {/* Nilai input langsung memperbarui filter pencarian di komponen induk. */}
          <input
            id="search-input"
            className="search-input"
            type="text"
            placeholder="Nama usaha, merek, pemilik..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Hapus pencarian"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button className="category-info-button" type="button" onClick={() => categoryDialog.current.showModal()}>
          <Info size={18} /> Mengenal Kategori UMKM
        </button>
      </section>

      <details className="map-layer-legend" open>
        <summary><Layers size={18} /> Legenda UMKM &amp; Layer Peta</summary>
        <div className="map-layer-content">
          <p>Warna titik menunjukkan kategori. Warna area menunjukkan zona K-Means.</p>
          <label className="layer-option layer-option-all">
            <input type="checkbox" checked={hiddenCategories.length === 0} ref={(element) => { if (element) element.indeterminate = hiddenCategories.length > 0 && hiddenCategories.length < productTypes.length; }} onChange={onToggleAllCategories} />
            <strong>Semua kategori</strong>
          </label>
          <div className="category-layer-list">
            {productTypes.map((type) => (
              <label className="layer-option" key={type.code}>
                <input type="checkbox" checked={!hiddenCategories.includes(type.code)} onChange={() => onToggleCategory(type.code)} />
                <span className="category-color" style={{ backgroundColor: getProductInfo(type.code).color }} aria-hidden="true" />
                <span>{type.label}</span><small>{type.count.toLocaleString('id-ID')}</small>
              </label>
            ))}
          </div>
          <fieldset className="map-layer-section">
            <legend>Analisis kepadatan</legend>
            <label htmlFor="density-category">Tampilkan konsentrasi titik</label>
            <select id="density-category" value={densityCategory} onChange={(event) => setDensityCategory(event.target.value)}>
              <option value="">Nonaktif</option>
              <option value="all">Semua kategori terpilih</option>
              {productTypes.filter((type) => !hiddenCategories.includes(type.code)).map((type) => <option key={type.code} value={type.code}>{type.label}</option>)}
            </select>
            {densityCategory && <div className="density-scale"><span /><div><small>Rendah</small><small>Tinggi</small></div><p>Kepadatan relatif titik pada tampilan dan tingkat zoom saat ini. Lokasi perkiraan dapat memengaruhi hasil.</p></div>}
          </fieldset>
        </div>
      </details>

      <dialog ref={categoryDialog} className="category-dialog" aria-labelledby="category-dialog-title" onClick={(event) => { if (event.target === event.currentTarget) categoryDialog.current.close(); }}>
        <header><div><span className="sidebar-section-kicker">KENALI USAHA LOKAL</span><h2 id="category-dialog-title">Kategori UMKM</h2><p>Jenis produk dan layanan dalam dataset Sulawesi Utara.</p></div><button type="button" aria-label="Tutup informasi kategori" onClick={() => categoryDialog.current.close()}><X size={22} /></button></header>
        <div className="category-info-grid">
          {productTypes.map((type) => {
            const info = getProductInfo(type.code);
            return <article className="category-info-card" key={type.code}>
              <h3 style={{ backgroundColor: info.color }}>{type.label}</h3>
              <div><p>{info.description}</p><strong>{type.count.toLocaleString('id-ID')} usaha terdata</strong></div>
            </article>;
          })}
        </div>
      </dialog>

      {/* Stats Cards */}
      <div className="stats-container">
        <div className="stats-card">
          <div className="stats-card-header">
            <MapPin size={18} color="var(--primary-color)" />
            <h3>Cakupan data UMKM</h3>
          </div>
          <p className="stats-value">{totalData.toLocaleString('id-ID')}</p>
          <p className="stats-breakdown">
            {mappableCount.toLocaleString('id-ID')} dipetakan · {(totalData - mappableCount).toLocaleString('id-ID')} belum terverifikasi
          </p>
        </div>

        {filteredCount !== undefined && filteredCount !== totalData && (
          <div className="stats-card">
            <div className="stats-card-header">
              <Search size={16} color="var(--accent-color)" />
              <h3>Hasil Filter</h3>
            </div>
            <p className="stats-value">{filteredCount.toLocaleString('id-ID')}</p>
          </div>
        )}
      </div>

      <details className="analysis-panel">
        {/* Detail native menjaga kontrol K-Means tetap tersembunyi sampai dibutuhkan. */}
        <summary>
          <span className="analysis-summary-title"><Layers size={18} /> Analisis Zonasi K-Means</span>
          <span className="analysis-summary-hint">Atur dan lihat hasil</span>
        </summary>

        <div className="analysis-panel-content">
          <div className="control-group">
            <label htmlFor="k-slider">
              Jumlah cluster (K): <span className="k-badge">{kValue}</span>
            </label>
            <input
              id="k-slider"
              type="range"
              min="2"
              max="10"
              value={kValue}
              onChange={(e) => setKValue(Number.parseInt(e.target.value, 10))}
            />
            <span className="control-hint">Geser untuk mengubah jumlah wilayah zonasi.</span>
          </div>

          <div className="zone-visibility-control">
            <div>
              <strong>Area zonasi wilayah</strong>
              <span>Tampilkan batas polygon hasil K-Means pada peta.</span>
            </div>
            <button
              className={showZoneAreas ? 'active' : ''}
              type="button"
              role="switch"
              aria-checked={showZoneAreas}
              onClick={() => setShowZoneAreas((visible) => !visible)}
            >
              {showZoneAreas ? <Eye size={17} /> : <EyeOff size={17} />}
              {showZoneAreas ? 'Aktif' : 'Nonaktif'}
            </button>
          </div>

          {clusterStats && clusterStats.length > 0 && (
            <div className="zone-stats-section animate-fade-in">
              <div className="zone-stats-header">
                <h3>Statistik Zonasi</h3>
              </div>

              <div className="zone-stats-list">
                {clusterStats.map((stat, index) => (
                  <button
                    type="button"
                    key={index}
                    className={`zone-stat-item ${selectedZone === index ? 'selected' : ''}`}
                    style={{ borderLeftColor: stat.color }}
                    onClick={() => onSelectZone(index)}
                    aria-pressed={selectedZone === index}
                  >
                    <span className="zone-stat-label">
                      <span className="zone-color-dot" style={{ backgroundColor: stat.color }} />
                      Wilayah {index + 1}
                    </span>
                    <span className="zone-stat-count">{stat.count.toLocaleString('id-ID')} UMKM</span>
                  </button>
                ))}
              </div>

              {selectedZoneSummary && (
                <div className="zone-selection-summary">
                  <div><span>Zona terpilih</span><strong>Wilayah {selectedZone + 1}</strong></div>
                  <div><span>Jumlah UMKM</span><strong>{selectedZoneSummary.count.toLocaleString('id-ID')}</strong></div>
                  <div><span>Kategori dominan</span><strong>{selectedZoneSummary.dominantCategory}</strong></div>
                  <div><span>Pusat aktivitas</span><strong>{selectedZoneSummary.centroid ? `${selectedZoneSummary.centroid.lat.toFixed(5)}, ${selectedZoneSummary.centroid.lng.toFixed(5)}` : 'Belum tersedia'}</strong></div>
                  <button type="button" onClick={() => onSelectZone(selectedZone)}>Tampilkan semua zona</button>
                </div>
              )}

              <div className="algo-info">
                <div className="algo-info-row">
                  <span className="algo-info-label">Iterasi</span>
                  <span className="algo-info-value">{iterations || '-'}</span>
                </div>
                <div className="algo-info-row">
                  <span className="algo-info-label">WCSS</span>
                  <span className="algo-info-value">{wcss ? `${wcss.toFixed(2)} km²` : '-'}</span>
                </div>
                <div className="algo-info-row">
                  <span className="algo-info-label">Inisialisasi</span>
                  <span className="algo-info-value">K-Means++ stabil</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </details>

      {/* Info Box */}
      <div className="sidebar-footer">
        <div className="info-box">
          <Info size={18} color="var(--primary-color)" className="info-box-icon" />
          <p>
            Warna titik menunjukkan kategori usaha, sedangkan warna area menunjukkan zona K-Means.
            Sebagian titik merupakan perkiraan berdasarkan alamat atau wilayah.
          </p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
