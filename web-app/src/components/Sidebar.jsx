import { MapPin, Info, Layers, Search, X } from 'lucide-react';

const Sidebar = ({
  isOpen,
  kValue,
  setKValue,
  totalData,
  mappableCount,
  clusterStats,

  iterations,
  wcss,
  searchQuery,
  setSearchQuery,
  productFilter,
  setProductFilter,
  productTypes,
  filteredCount,
}) => {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <h1>Zonasi UMKM</h1>
        <p className="sidebar-subtitle">
          Pemetaan &amp; Analisis K-Means Sulawesi Utara
        </p>
      </div>

      {/* Search */}
      <div className="search-box">
        <label className="visually-hidden" htmlFor="search-input">Cari UMKM</label>
        <Search size={16} className="search-icon" />
        <input
          id="search-input"
          className="search-input"
          type="text"
          placeholder="Cari UMKM, merek, pemilik..."
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

      {/* Product Type Filter */}
      {productTypes && productTypes.length > 0 && (
        <div className="filter-section">
          <span className="filter-label">Filter Jenis Produk</span>
          <div className="filter-chips">
            <button
              className={`filter-chip ${productFilter === '' ? 'active' : ''}`}
              onClick={() => setProductFilter('')}
              aria-pressed={productFilter === ''}
            >
              Semua
            </button>
            {productTypes.map((pt) => (
              <button
                key={pt.code}
                className={`filter-chip ${productFilter === pt.code ? 'active' : ''}`}
                onClick={() => setProductFilter(productFilter === pt.code ? '' : pt.code)}
                title={pt.label}
                aria-pressed={productFilter === pt.code}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-container">
        <div className="stats-card">
          <div className="stats-card-header">
            <MapPin size={18} color="var(--primary-color)" />
            <h3>Total UMKM</h3>
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

          {clusterStats && clusterStats.length > 0 && (
            <div className="zone-stats-section animate-fade-in">
              <div className="zone-stats-header">
                <h3>Statistik Zonasi</h3>
              </div>

              <div className="zone-stats-list">
                {clusterStats.map((stat, index) => (
                  <div
                    key={index}
                    className="zone-stat-item"
                    style={{ borderLeftColor: stat.color }}
                  >
                    <span className="zone-stat-label">
                      <span className="zone-color-dot" style={{ backgroundColor: stat.color }} />
                      Wilayah {index + 1}
                    </span>
                    <span className="zone-stat-count">{stat.count.toLocaleString('id-ID')} UMKM</span>
                  </div>
                ))}
              </div>

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
            Warna pada peta menunjukkan wilayah zonasi UMKM yang berdekatan secara
            geografis. Sebagian titik merupakan perkiraan berdasarkan alamat atau wilayah.
          </p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
