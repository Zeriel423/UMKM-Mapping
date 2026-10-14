import { MapPin, Info, Layers, Search, X } from 'lucide-react';
import { useRef } from 'react';
import { getProductInfo } from '../data/communityCollections';

// Menyediakan pencarian, filter, ringkasan data, dan kontrol filter peta.
const Sidebar = ({
  isOpen,
  totalData,
  mappableCount,
  searchQuery,
  setSearchQuery,
  productTypes,
  filteredCount,
  hiddenCategories,
  onToggleCategory,
  onToggleAllCategories,
  densityCategory,
  setDensityCategory,
  onOpenAbout,
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
            <h1>Peta UMKM</h1>
          </div>
        </div>
        <p className="sidebar-subtitle">
          Pemetaan persebaran geografis UMKM di Sulawesi Utara.
        </p>
        <div className="sidebar-data-status">
          <span><i aria-hidden="true" />Data publik aktif</span>
          <strong>{mappableCount.toLocaleString('id-ID')} titik peta</strong>
        </div>

        {onOpenAbout && (
          <button
            type="button"
            className="sidebar-collab-badge"
            onClick={onOpenAbout}
            aria-label="Informasi kolaborasi Politeknik Negeri Manado dan Yayasan Bina Lentera Insan"
          >
            <div className="sidebar-collab-badge-logos">
              <img src="/images/logo-polimdo.png" alt="Polimdo" />
              <img src="/images/logo-ybli.png" alt="YBLI" />
            </div>
            <div className="sidebar-collab-badge-text">
              <strong>Kerjasama Polimdo &amp; YBLI</strong>
              <span>Latar belakang &amp; tujuan projek</span>
            </div>
          </button>
        )}
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
          <p>Warna titik menunjukkan kategori jenis usaha.</p>
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

      {/* Info Box */}
      <div className="sidebar-footer">
        <div className="info-box">
          <Info size={18} color="var(--primary-color)" className="info-box-icon" />
          <p>
            Warna titik menunjukkan kategori jenis usaha.
            Sebagian titik merupakan perkiraan berdasarkan alamat atau wilayah.
          </p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
