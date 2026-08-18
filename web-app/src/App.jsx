import { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import MapView from './components/Map';
import BusinessList from './components/BusinessList';
import { performKMeans, generateClusterColors } from './utils/kmeans';
import { Loader2, AlertTriangle, Menu, X, Search, ExternalLink, MapPin } from 'lucide-react';

const businessTitle = (business) => business.brand?.trim() || business.name || 'UMKM tanpa nama';

const directionsUrl = (business) => {
  const lat = Number(business?.lat);
  const lng = Number(business?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
};

function App() {
  // Data state
  const [rawData, setRawData] = useState([]);
  const [kValue, setKValue] = useState(3);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [showMapDetailCard, setShowMapDetailCard] = useState(false);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [activeCollection, setActiveCollection] = useState(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState(null);

  // Load data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/data/umkm.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}: Gagal memuat data`);
        const jsonData = await response.json();
        if (!Array.isArray(jsonData) || jsonData.length === 0) {
          throw new Error('Data UMKM kosong atau format tidak valid');
        }
        setRawData(jsonData);
      } catch (err) {
        console.error('[App] Error loading data:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // A shared business link uses the static-app-friendly format: ?umkm=<id>.
  // Keep the selected card in sync when visitors use the browser back button.
  useEffect(() => {
    if (rawData.length === 0) return undefined;

    const syncSelectedBusinessFromUrl = () => {
      const businessId = new URLSearchParams(window.location.search).get('umkm');
      const businessExists = rawData.some((business) => String(business.id) === businessId);
      setSelectedBusinessId(businessExists ? businessId : null);
      if (!businessExists) setShowMapDetailCard(false);
    };

    syncSelectedBusinessFromUrl();
    window.addEventListener('popstate', syncSelectedBusinessFromUrl);

    return () => window.removeEventListener('popstate', syncSelectedBusinessFromUrl);
  }, [rawData]);

  // Extract unique product types from data
  const productTypes = useMemo(() => {
    if (rawData.length === 0) return [];
    const typeMap = new Map();
    rawData.forEach(item => {
      const code = item.product_type;
      const label = item.product_label || code;
      if (!typeMap.has(code)) {
        typeMap.set(code, { code, label, count: 0 });
      }
      typeMap.get(code).count++;
    });
    return Array.from(typeMap.values()).sort((a, b) => b.count - a.count);
  }, [rawData]);

  // Filter data based on search and product filter
  const filteredData = useMemo(() => {
    let result = rawData;

    if (activeCollection) {
      result = result.filter((item) => activeCollection.productTypes.includes(item.product_type));
    } else if (productFilter) {
      result = result.filter(item => item.product_type === productFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item =>
        item.name?.toLowerCase().includes(q) ||
        item.brand?.toLowerCase().includes(q) ||
        item.owner?.toLowerCase().includes(q) ||
        item.address?.toLowerCase().includes(q) ||
        item.product_label?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [rawData, searchQuery, productFilter, activeCollection]);

  const selectedBusiness = useMemo(
    () => rawData.find((business) => String(business.id) === String(selectedBusinessId)) || null,
    [rawData, selectedBusinessId],
  );

  // Compute clustering results from filtered data and kValue
  const clusterResult = useMemo(() => {
    if (filteredData.length === 0) {
      return { clusteredData: [], centroids: [], colors: [], clusterStats: [], clusterRadii: [], iterations: 0, wcss: 0 };
    }

    const effectiveK = Math.min(kValue, filteredData.length);
    const result = performKMeans(filteredData, effectiveK);
    const generatedColors = generateClusterColors(effectiveK);

    const stats = result.clusters.map((cluster, index) => ({
      count: cluster.length,
      color: generatedColors[index]
    }));

    return {
      clusteredData: result.clusteredData,
      centroids: result.centroids,
      colors: generatedColors,
      clusterStats: stats,
      clusterRadii: result.clusterRadii,
      iterations: result.iterations,
      wcss: result.wcss,
    };
  }, [filteredData, kValue]);

  const { clusteredData, centroids, colors, clusterStats, clusterRadii, iterations, wcss } = clusterResult;

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((isOpen) => {
      const nextOpen = !isOpen;
      if (nextOpen) {
        setDiscoveryOpen(false);
        setShowMapDetailCard(false);
      }
      return nextOpen;
    });
  }, []);

  const selectBusiness = useCallback((business) => {
    const businessId = String(business.id);
    const wasDiscoveryOpen = discoveryOpen;

    setSelectedBusinessId(businessId);
    setShowMapDetailCard(wasDiscoveryOpen);

    // On mobile, close the discovery sheet after a list selection so the map
    // and the selected location remain visible together.
    if (wasDiscoveryOpen) {
      setDiscoveryOpen(false);
    }

    const url = new URL(window.location.href);
    url.searchParams.set('umkm', businessId);
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [discoveryOpen]);

  const clearSelectedBusiness = useCallback(() => {
    setSelectedBusinessId(null);
    setShowMapDetailCard(false);

    const url = new URL(window.location.href);
    url.searchParams.delete('umkm');
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const selectProductFilter = useCallback((filter) => {
    setActiveCollection(null);
    setProductFilter(filter);
  }, []);

  const selectCollection = useCallback((collection) => {
    setProductFilter('');
    setActiveCollection(collection);
  }, []);

  const shareBusiness = useCallback(async (business) => {
    const title = business.brand?.trim() || business.name || 'UMKM';
    const url = new URL(window.location.href);
    url.searchParams.set('umkm', String(business.id));
    const shareUrl = url.toString();

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Lihat ${title} di Zonasi UMKM`,
          url: shareUrl,
        });
        return 'Tautan berhasil dibagikan.';
      } catch (shareError) {
        if (shareError.name === 'AbortError') return '';
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      return 'Tautan UMKM telah disalin.';
    } catch {
      window.prompt('Salin tautan UMKM ini:', shareUrl);
      return '';
    }
  }, []);

  // Loading screen
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <Loader2 size={40} color="var(--primary-color)" className="animate-spin" />
          <h2>Memuat Data UMKM...</h2>
        </div>
      </div>
    );
  }

  // Error screen
  if (error) {
    return (
      <div className="error-screen">
        <div className="error-content">
          <AlertTriangle size={48} color="#E63946" style={{ marginBottom: '1rem' }} />
          <h2>Gagal Memuat Data</h2>
          <p>{error}</p>
          <button className="btn-retry" onClick={() => window.location.reload()}>
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${sidebarOpen ? 'sidebar-open' : ''} ${discoveryOpen ? 'discovery-open' : ''}`}>
      {/* Mobile sidebar toggle */}
      <button
        className="sidebar-toggle"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Tutup menu' : 'Buka menu'}
        id="sidebar-toggle"
      >
        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        kValue={kValue}
        setKValue={setKValue}
        totalData={rawData.length}
        filteredCount={filteredData.length}
        clusterStats={clusterStats}
        iterations={iterations}
        wcss={wcss}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        productFilter={productFilter}
        setProductFilter={selectProductFilter}
        productTypes={productTypes}
      />

      {/* Main map area */}
      <main className="main-content">
        <button
          className="mobile-discovery-trigger"
          type="button"
          onClick={() => {
            setSidebarOpen(false);
            setShowMapDetailCard(false);
            setDiscoveryOpen(true);
          }}
          aria-label="Buka pencarian dan pilihan komunitas"
          aria-expanded={discoveryOpen}
        >
          <Search size={18} aria-hidden="true" />
          <span>Pencarian &amp; Komunitas</span>
        </button>

        <MapView
          data={clusteredData}
          centroids={centroids}
          colors={colors}
          clusterRadii={clusterRadii}
          clusterStats={clusterStats}
          selectedBusiness={selectedBusiness}
          onSelectBusiness={selectBusiness}
        />

        {showMapDetailCard && selectedBusiness && (
          <article
            className="map-selection-detail-card"
            aria-label={`Detail ${businessTitle(selectedBusiness)}`}
            style={{
              position: 'absolute',
              left: '50%',
              bottom: '24px',
              transform: 'translateX(-50%)',
              zIndex: 1800,
              width: 'min(390px, calc(100% - 32px))',
              boxSizing: 'border-box',
              padding: '16px 18px',
              borderRadius: '18px',
              background: 'rgba(255,255,255,0.97)',
              boxShadow: '0 12px 35px rgba(15,23,42,0.22)',
              border: '1px solid rgba(15,23,42,0.08)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', color: '#0f766e', marginBottom: '5px' }}>
                  UMKM TERPILIH
                </span>
                <h2 style={{ margin: 0, fontSize: '18px', lineHeight: 1.2, color: '#0f172a' }}>
                  {businessTitle(selectedBusiness)}
                </h2>
                <span style={{ display: 'inline-block', marginTop: '7px', padding: '4px 8px', borderRadius: '999px', background: '#e6f7f3', color: '#0f766e', fontSize: '11px', fontWeight: 700 }}>
                  {selectedBusiness.product_label || selectedBusiness.product_type || 'UMKM'}
                </span>
              </div>
              <button
                type="button"
                onClick={clearSelectedBusiness}
                aria-label="Tutup kartu detail UMKM"
                style={{ flex: '0 0 auto', width: '32px', height: '32px', border: 0, borderRadius: '50%', background: '#f1f5f9', color: '#475569', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
              >
                <X size={17} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', marginTop: '11px', color: '#64748b', fontSize: '12px', lineHeight: 1.45 }}>
              <MapPin size={15} style={{ flex: '0 0 auto', marginTop: '1px' }} />
              <span>{selectedBusiness.address || 'Alamat belum tersedia'}</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '13px' }}>
              {directionsUrl(selectedBusiness) && (
                <a
                  className="action-button primary"
                  href={directionsUrl(selectedBusiness)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}
                >
                  <ExternalLink size={15} /> Rute
                </a>
              )}
              <button
                className="action-button secondary"
                type="button"
                onClick={() => setShowMapDetailCard(false)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Lihat di daftar
              </button>
            </div>
          </article>
        )}

        <BusinessList
          key={`${searchQuery}-${productFilter}-${activeCollection?.id || 'all'}`}
          businesses={filteredData}
          allBusinesses={rawData}
          selectedBusiness={selectedBusiness}
          activeCollectionId={activeCollection?.id}
          onSelectCollection={selectCollection}
          onSelectBusiness={selectBusiness}
          onClearSelectedBusiness={clearSelectedBusiness}
          onShareBusiness={shareBusiness}
          isMobileOpen={discoveryOpen}
          onMobileClose={() => setDiscoveryOpen(false)}
        />
      </main>
    </div>
  );
}

export default App;
