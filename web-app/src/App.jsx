import { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import MapView from './components/Map';
import BusinessList from './components/BusinessList';
import { performKMeans, generateClusterColors } from './utils/kmeans';
import { Loader2, AlertTriangle, Menu, X, Search } from 'lucide-react';

const businessTitle = (business) => business.brand?.trim() || business.name || 'UMKM tanpa nama';

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

  useEffect(() => {
    if (rawData.length === 0) return undefined;

    const syncSelectedBusinessFromUrl = () => {
      const businessId = new URLSearchParams(window.location.search).get('umkm');
      const businessExists = rawData.some((business) => String(business.id) === businessId);
      setSelectedBusinessId(businessExists ? businessId : null);
    };

    syncSelectedBusinessFromUrl();
    window.addEventListener('popstate', syncSelectedBusinessFromUrl);

    return () => window.removeEventListener('popstate', syncSelectedBusinessFromUrl);
  }, [rawData]);

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
      if (nextOpen) setDiscoveryOpen(false);
      return nextOpen;
    });
  }, []);

  // Keep this callback stable. Recreating it when the mobile panel closes
  // caused the Leaflet marker layer to be rebuilt, which closed the popup.
  const selectBusiness = useCallback((business) => {
    const businessId = String(business.id);

    setSelectedBusinessId(businessId);
    setDiscoveryOpen(false);

    const url = new URL(window.location.href);
    url.searchParams.set('umkm', businessId);
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const clearSelectedBusiness = useCallback(() => {
    setSelectedBusinessId(null);

    const url = new URL(window.location.href);
    url.searchParams.delete('umkm');
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  // Open the existing Leaflet popup only after flyTo has completely finished.
  // Waiting for `moveend` avoids opening a popup while markercluster is still
  // moving/repositioning markers, which previously made the popup flash and disappear.
  useEffect(() => {
    if (!selectedBusiness) return undefined;

    const mapElement = document.querySelector('#map-container .leaflet-container');
    if (!mapElement) return undefined;

    const findAndOpenPopup = () => {
      const mapRect = mapElement.getBoundingClientRect();
      const targetX = mapRect.left + mapRect.width / 2;
      const targetY = mapRect.top + mapRect.height / 2;
      const selectedId = String(selectedBusiness.id);
      const selectedName = businessTitle(selectedBusiness);
      const selectedAddress = selectedBusiness.address || '';

      const markerElements = Array.from(
        mapElement.querySelectorAll('.leaflet-marker-icon.custom-div-icon'),
      ).filter((element) => element.innerHTML.includes('width: 10px'));

      const candidates = markerElements.map((element) => {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        return { element, distance: Math.hypot(x - targetX, y - targetY) };
      });

      // After flyTo, the selected marker should be at the map center.
      // Use the closest marker rather than a timing-based click.
      const marker = candidates.sort((a, b) => a.distance - b.distance)[0];
      if (!marker || marker.distance > Math.max(mapRect.width, mapRect.height) * 0.12) {
        return false;
      }

      marker.element.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }));

      const addRouteButton = () => {
        const popupContent = document.querySelector('.leaflet-popup-content');
        if (!popupContent || popupContent.querySelector('.popup-route-button')) return;

        const popupText = popupContent.textContent || '';
        const matchesBusiness =
          popupText.includes(selectedName) ||
          (selectedAddress && popupText.includes(selectedAddress));

        if (!matchesBusiness) return;

        const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${selectedBusiness.lat},${selectedBusiness.lng}`)}`;
        const routeButton = document.createElement('a');
        routeButton.className = 'popup-route-button';
        routeButton.href = routeUrl;
        routeButton.target = '_blank';
        routeButton.rel = 'noreferrer';
        routeButton.textContent = '🚗 Rute';
        routeButton.style.cssText = [
          'display:flex',
          'align-items:center',
          'justify-content:center',
          'width:100%',
          'box-sizing:border-box',
          'margin-top:10px',
          'padding:8px 12px',
          'border-radius:8px',
          'background:#0f766e',
          'color:#fff',
          'font-size:12px',
          'font-weight:700',
          'text-decoration:none',
        ].join(';');

        popupContent.appendChild(routeButton);
      };

      window.setTimeout(addRouteButton, 50);
      window.setTimeout(addRouteButton, 150);
      window.setTimeout(addRouteButton, 300);
      return true;
    };

    let retryTimer = null;
    let cancelled = false;

    const tryOpenAfterMove = () => {
      if (cancelled) return;
      if (findAndOpenPopup()) {
        window.setTimeout(() => {
          if (!document.querySelector('.leaflet-popup')) {
            findAndOpenPopup();
          }
        }, 250);
        return;
      }
      retryTimer = window.setTimeout(tryOpenAfterMove, 120);
    };

    const handleMoveEnd = () => {
      window.setTimeout(tryOpenAfterMove, 40);
    };

    // React-Leaflet exposes the Leaflet map through the DOM container.
    // Dispatching the event here lets the existing marker popup open only
    // after the camera animation is finished.
    mapElement.addEventListener('moveend', handleMoveEnd);

    // Also start once in case flyTo already finished before this effect mounted.
    const initialTimer = window.setTimeout(tryOpenAfterMove, 900);

    return () => {
      cancelled = true;
      mapElement.removeEventListener('moveend', handleMoveEnd);
      window.clearTimeout(initialTimer);
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [selectedBusiness]);

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
        await navigator.share({ title, text: `Lihat ${title} di Zonasi UMKM`, url: shareUrl });
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

  if (error) {
    return (
      <div className="error-screen">
        <div className="error-content">
          <AlertTriangle size={48} color="#E63946" style={{ marginBottom: '1rem' }} />
          <h2>Gagal Memuat Data</h2>
          <p>{error}</p>
          <button className="btn-retry" onClick={() => window.location.reload()}>Coba Lagi</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${sidebarOpen ? 'sidebar-open' : ''} ${discoveryOpen ? 'discovery-open' : ''}`}>
      <button className="sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarOpen ? 'Tutup menu' : 'Buka menu'} id="sidebar-toggle">
        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={closeSidebar} />

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

      <main className="main-content">
        <button
          className="mobile-discovery-trigger"
          type="button"
          onClick={() => {
            setSidebarOpen(false);
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
