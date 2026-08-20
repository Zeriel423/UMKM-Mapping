import { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import MapView from './components/Map';
import BusinessList from './components/BusinessList';
import { performKMeans, generateClusterColors } from './utils/kmeans';
import { Loader2, AlertTriangle, Menu, X, Search, Navigation, Share2 } from 'lucide-react';

function App() {
  const [rawData, setRawData] = useState([]);
  const [kValue, setKValue] = useState(3);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [activeCollection, setActiveCollection] = useState(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState(null);
  const [focusSelectedBusiness, setFocusSelectedBusiness] = useState(false);

  useEffect(() => {
    fetch('/data/umkm.json')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}: Gagal memuat data`);
        return response.json();
      })
      .then((jsonData) => {
        if (!Array.isArray(jsonData) || jsonData.length === 0) throw new Error('Data UMKM kosong atau format tidak valid');
        setRawData(jsonData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!rawData.length) return;
    const syncUrl = () => {
      const id = new URLSearchParams(window.location.search).get('umkm');
      const exists = rawData.some((item) => String(item.id) === id);
      setSelectedBusinessId(exists ? id : null);
      setFocusSelectedBusiness(exists);
    };
    syncUrl();
    window.addEventListener('popstate', syncUrl);
    return () => window.removeEventListener('popstate', syncUrl);
  }, [rawData]);

  const productTypes = useMemo(() => {
    const map = new Map();
    rawData.forEach((item) => {
      const code = item.product_type;
      if (!map.has(code)) map.set(code, { code, label: item.product_label || code, count: 0 });
      map.get(code).count += 1;
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [rawData]);

  const filteredData = useMemo(() => {
    let result = rawData;
    if (activeCollection) result = result.filter((item) => activeCollection.productTypes.includes(item.product_type));
    else if (productFilter) result = result.filter((item) => item.product_type === productFilter);
    const q = searchQuery.trim().toLowerCase();
    if (q) result = result.filter((item) => item.name?.toLowerCase().includes(q) || item.brand?.toLowerCase().includes(q) || item.owner?.toLowerCase().includes(q) || item.address?.toLowerCase().includes(q) || item.product_label?.toLowerCase().includes(q));
    return result;
  }, [rawData, searchQuery, productFilter, activeCollection]);

  const selectedBusiness = useMemo(() => rawData.find((item) => String(item.id) === String(selectedBusinessId)) || null, [rawData, selectedBusinessId]);

  const clusterResult = useMemo(() => {
    if (!filteredData.length) return { clusteredData: [], centroids: [], colors: [], clusterStats: [], clusterRadii: [], iterations: 0, wcss: 0 };
    const effectiveK = Math.min(kValue, filteredData.length);
    const result = performKMeans(filteredData, effectiveK);
    const colors = generateClusterColors(effectiveK);
    return {
      clusteredData: result.clusteredData,
      centroids: result.centroids,
      colors,
      clusterStats: result.clusters.map((cluster, index) => ({ count: cluster.length, color: colors[index] })),
      clusterRadii: result.clusterRadii,
      iterations: result.iterations,
      wcss: result.wcss,
    };
  }, [filteredData, kValue]);

  const { clusteredData, centroids, colors, clusterStats, clusterRadii, iterations, wcss } = clusterResult;

  const selectBusiness = useCallback((business, focus = false) => {
    const id = String(business.id);
    setSelectedBusinessId(id);
    setFocusSelectedBusiness(focus);
    const url = new URL(window.location.href);
    url.searchParams.set('umkm', id);
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
    if (focus) setDiscoveryOpen(false);
  }, []);

  const clearSelectedBusiness = useCallback(() => {
    setSelectedBusinessId(null);
    setFocusSelectedBusiness(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('umkm');
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const routeToBusiness = useCallback((business) => {
    const lat = Number(business?.lat);
    const lng = Number(business?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const shareBusiness = useCallback(async (business) => {
    const title = business.brand?.trim() || business.name || 'UMKM';
    const url = new URL(window.location.href);
    url.searchParams.set('umkm', String(business.id));
    const shareUrl = url.toString();
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `Lihat ${title} di Zonasi UMKM`, url: shareUrl });
        return 'Tautan berhasil dibagikan.';
      } catch (err) {
        if (err.name === 'AbortError') return '';
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

  if (isLoading) return <div className="loading-screen"><div className="loading-content"><Loader2 size={40} color="var(--primary-color)" className="animate-spin" /><h2>Memuat Data UMKM...</h2></div></div>;
  if (error) return <div className="error-screen"><div className="error-content"><AlertTriangle size={48} color="#E63946" /><h2>Gagal Memuat Data</h2><p>{error}</p><button className="btn-retry" onClick={() => window.location.reload()}>Coba Lagi</button></div></div>;

  return (
    <div className={`app-container ${sidebarOpen ? 'sidebar-open' : ''} ${discoveryOpen ? 'discovery-open' : ''}`}>
      <style>{`
        .mobile-discovery-trigger { display:none; }
        .selected-business-card { position:absolute; left:50%; bottom:24px; transform:translateX(-50%); z-index:1500; width:min(390px,calc(100% - 32px)); background:#fff; border:1px solid rgba(29,93,85,.14); border-radius:16px; box-shadow:0 12px 34px rgba(15,23,42,.24); overflow:hidden; }
        .selected-business-card.flyto-popup { opacity:0; animation:selected-business-flyto-popup .28s ease-out .82s forwards; }
        @keyframes selected-business-flyto-popup { from { opacity:0; } to { opacity:1; } }
        .selected-business-card-header { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:13px 15px 8px; }
        .selected-business-card-title { margin:0; color:#0f172a; font:800 16px/1.25 var(--font-body); }
        .selected-business-card-close { display:grid; place-items:center; width:32px; height:32px; flex:0 0 32px; border:0; border-radius:9px; background:#f1f5f9; color:#64748b; cursor:pointer; }
        .selected-business-card-body { padding:0 15px 13px; }
        .selected-business-card-category { display:block; margin-bottom:5px; color:var(--primary-color); font:700 11px var(--font-body); text-transform:uppercase; letter-spacing:.04em; }
        .selected-business-card-address { display:flex; gap:6px; align-items:flex-start; color:#64748b; font:500 12px/1.45 var(--font-body); }
        .selected-business-card-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:0 15px 15px; }
        .selected-business-card-actions button { min-height:38px; border:0; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:7px; font:700 12px var(--font-body); cursor:pointer; }
        .selected-route-button { background:var(--primary-color); color:#fff; }
        .selected-share-button { background:#eef5f3; color:var(--primary-color); }
        .popup-route-button { display:flex; align-items:center; justify-content:center; width:100%; box-sizing:border-box; margin-top:10px; padding:8px 12px; border-radius:8px; background:var(--primary-color); color:#fff; font:700 12px var(--font-body); text-decoration:none; }
        .popup-route-button:hover { background:var(--primary-dark); color:#fff; }
        @media (max-width:768px) {
          .mobile-discovery-trigger { position:absolute; left:50%; right:auto; bottom:calc(18px + env(safe-area-inset-bottom)); top:auto; transform:translateX(-50%); z-index:1200; display:flex; align-items:center; justify-content:center; gap:7px; width:min(250px,calc(100vw - 32px)); min-height:48px; padding:0 14px; border:1px solid rgba(29,93,85,.12); border-radius:999px; background:rgba(255,255,255,.97); color:var(--primary-color); box-shadow:0 8px 24px rgba(15,23,42,.2); font:700 13px var(--font-body); cursor:pointer; backdrop-filter:blur(8px); }
          .mobile-discovery-trigger span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          .main-content .map-container { width:100%; height:100%; flex:1 1 100%; }
          .main-content .business-panel { display:none; position:absolute; left:10px; right:10px; bottom:10px; z-index:1300; width:auto; height:min(72dvh,620px); max-height:72dvh; flex:none; margin:0; border:1px solid rgba(29,93,85,.12); border-radius:20px; box-shadow:0 12px 36px rgba(15,23,42,.22); overflow-y:auto; }
          .main-content .business-panel.mobile-open { display:block; }
          .mobile-panel-header { position:sticky; top:0; display:flex; justify-content:flex-end; align-items:center; height:48px; padding:0 10px; background:rgba(255,255,255,.97); border-bottom:1px solid var(--border-color); z-index:10; }
          .mobile-panel-handle { display:none !important; }
          .mobile-panel-close { display:inline-grid; place-items:center; width:36px; height:36px; border:0; border-radius:10px; background:#eef5f3; color:var(--primary-color); cursor:pointer; }
          .selected-business-card { left:12px; right:12px; bottom:calc(78px + env(safe-area-inset-bottom)); transform:none; width:auto; max-width:none; z-index:1700; }
          .app-container.discovery-open .selected-business-card { display:none; }
        }
      `}</style>

      <button className="sidebar-toggle" onClick={() => setSidebarOpen((open) => !open)} aria-label={sidebarOpen ? 'Tutup menu' : 'Buka menu'} id="sidebar-toggle">
        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      <Sidebar
        isOpen={sidebarOpen} kValue={kValue} setKValue={setKValue}
        totalData={rawData.length} filteredCount={filteredData.length}
        clusterStats={clusterStats} iterations={iterations} wcss={wcss}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        productFilter={productFilter}
        setProductFilter={(filter) => { setActiveCollection(null); setProductFilter(filter); }}
        productTypes={productTypes}
      />

      <main className="main-content">
        <button className="mobile-discovery-trigger" type="button" onClick={() => { setSidebarOpen(false); setDiscoveryOpen(true); }} aria-label="Buka pencarian dan pilihan komunitas">
          <Search size={18} aria-hidden="true" /><span>Pencarian &amp; Komunitas</span>
        </button>

        <MapView
          data={clusteredData} centroids={centroids} colors={colors}
          clusterRadii={clusterRadii} clusterStats={clusterStats}
          selectedBusiness={focusSelectedBusiness ? selectedBusiness : null}
          onSelectBusiness={(business) => selectBusiness(business, false)}
        />

        {selectedBusiness && (
          <article className={`selected-business-card ${focusSelectedBusiness ? 'flyto-popup' : ''}`} aria-label={`Detail ${selectedBusiness.brand || selectedBusiness.name || 'UMKM'}`}>
            <div className="selected-business-card-header">
              <h2 className="selected-business-card-title">{selectedBusiness.brand?.trim() || selectedBusiness.name || 'UMKM'}</h2>
              <button className="selected-business-card-close" type="button" onClick={clearSelectedBusiness} aria-label="Tutup detail UMKM">
                <X size={17} />
              </button>
            </div>
            <div className="selected-business-card-body">
              <span className="selected-business-card-category">{selectedBusiness.product_label || selectedBusiness.product_type || 'UMKM'}</span>
              <div className="selected-business-card-address">
                <Navigation size={14} />
                <span>{selectedBusiness.address || 'Alamat belum tersedia'}</span>
              </div>
            </div>
            <div className="selected-business-card-actions">
              <button className="selected-route-button" type="button" onClick={() => routeToBusiness(selectedBusiness)}>
                <Navigation size={15} /> Rute
              </button>
              <button className="selected-share-button" type="button" onClick={() => shareBusiness(selectedBusiness)}>
                <Share2 size={15} /> Bagikan
              </button>
            </div>
          </article>
        )}

        <BusinessList
          key={`${searchQuery}-${productFilter}-${activeCollection?.id || 'all'}`}
          businesses={filteredData} allBusinesses={rawData} selectedBusiness={selectedBusiness}
          activeCollectionId={activeCollection?.id}
          onSelectCollection={(collection) => { setProductFilter(''); setActiveCollection(collection); }}
          onSelectBusiness={(business) => selectBusiness(business, true)}
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
