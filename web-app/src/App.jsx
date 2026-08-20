import { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import MapView from './components/Map';
import BusinessList from './components/BusinessList';
import { performKMeans, generateClusterColors } from './utils/kmeans';
import { Loader2, AlertTriangle, Menu, X, Search } from 'lucide-react';

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
        if (!Array.isArray(jsonData) || jsonData.length === 0) {
          throw new Error('Data UMKM kosong atau format tidak valid');
        }
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
    if (q) {
      result = result.filter((item) =>
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
    () => rawData.find((item) => String(item.id) === String(selectedBusinessId)) || null,
    [rawData, selectedBusinessId]
  );

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
    if (focus) setDiscoveryOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set('umkm', id);
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const clearSelectedBusiness = useCallback(() => {
    setSelectedBusinessId(null);
    setFocusSelectedBusiness(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('umkm');
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  // Add the route button to the currently opened Leaflet popup.
  // MutationObserver makes this reliable for direct marker clicks as well as
  // popups opened after a flyTo from search/community.
  useEffect(() => {
    if (!selectedBusiness) return;

    const lat = Number(selectedBusiness.lat);
    const lng = Number(selectedBusiness.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
    let observer;
    let timer;
    let stopped = false;

    const addRouteButton = () => {
      if (stopped) return true;
      const popups = document.querySelectorAll('.leaflet-popup-content');
      for (const popup of popups) {
        if (popup.querySelector('.popup-route-button')) return true;
        const text = popup.textContent || '';
        const names = [selectedBusiness.name, selectedBusiness.brand, selectedBusiness.address].filter(Boolean);
        if (!names.some((name) => text.includes(name))) continue;

        const button = document.createElement('a');
        button.className = 'popup-route-button';
        button.href = routeUrl;
        button.target = '_blank';
        button.rel = 'noopener noreferrer';
        button.textContent = '🚗 Rute';
        popup.appendChild(button);
        return true;
      }
      return false;
    };

    const retry = () => {
      if (stopped) return;
      if (!addRouteButton()) timer = window.setTimeout(retry, 150);
    };

    observer = new MutationObserver(() => addRouteButton());
    observer.observe(document.body, { childList: true, subtree: true });
    [50, 150, 300, 600, 1000].forEach((delay) => window.setTimeout(addRouteButton, delay));
    timer = window.setTimeout(retry, 1200);

    return () => {
      stopped = true;
      observer?.disconnect();
      window.clearTimeout(timer);
    };
  }, [selectedBusiness]);

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
        .popup-route-button { display:flex; align-items:center; justify-content:center; width:100%; box-sizing:border-box; margin-top:10px; padding:8px 12px; border-radius:8px; background:var(--primary-color); color:#fff; font:700 12px var(--font-body); text-decoration:none; }
        .popup-route-button:hover { background:var(--primary-dark); color:#fff; }
        @media (max-width:768px) {
          .mobile-discovery-trigger {
            position:absolute; left:12px; right:12px; bottom:12px; top:auto; z-index:1200;
            display:flex; align-items:center; justify-content:center; gap:7px;
            min-height:44px; padding:0 14px; border:1px solid rgba(29,93,85,.12); border-radius:12px;
            background:rgba(255,255,255,.96); color:var(--primary-color); box-shadow:0 5px 16px rgba(15,23,42,.18);
            font:700 12px var(--font-body); cursor:pointer; backdrop-filter:blur(8px);
          }
          .mobile-discovery-trigger span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          .main-content .map-container { width:100%; height:100%; flex:1 1 100%; }
          .main-content .business-panel {
            display:none; position:absolute; left:10px; right:10px; bottom:10px; z-index:1300;
            width:auto; height:min(72dvh,620px); max-height:72dvh; flex:none; margin:0;
            border:1px solid rgba(29,93,85,.12); border-radius:20px; box-shadow:0 12px 36px rgba(15,23,42,.22); overflow-y:auto;
          }
          .main-content .business-panel.mobile-open { display:block; }
          .mobile-panel-header { position:sticky; top:0; display:flex; justify-content:flex-end; align-items:center; height:48px; padding:0 10px; background:rgba(255,255,255,.97); border-bottom:1px solid var(--border-color); z-index:10; }
          .mobile-panel-handle { display:none !important; }
          .mobile-panel-close { display:inline-grid; place-items:center; width:36px; height:36px; border:0; border-radius:10px; background:#eef5f3; color:var(--primary-color); cursor:pointer; }
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
