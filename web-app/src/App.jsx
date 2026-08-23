import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import MapView from './components/Map';
import BusinessList from './components/BusinessList';
import { performKMeans, generateClusterColors } from './utils/kmeans';
import {
  getAnalysisCoordinates,
  isMappableLocation,
  LOCATION_ACCURACY,
} from './utils/location';
import { loadPublicBusinesses } from './services/publicDataService';
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
  const [focusSelectedBusiness, setFocusSelectedBusiness] = useState(false);
  const discoveryTriggerRef = useRef(null);

  const closeDiscovery = useCallback((restoreFocus = true) => {
    setDiscoveryOpen(false);

    if (restoreFocus && window.matchMedia('(max-width: 768px)').matches) {
      window.requestAnimationFrame(() => discoveryTriggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const jsonData = await loadPublicBusinesses();
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
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        closeDiscovery();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [closeDiscovery]);

  useEffect(() => {
    if (rawData.length === 0) return undefined;

    const syncSelectedBusinessFromUrl = () => {
      const businessId = new URLSearchParams(window.location.search).get('umkm');
      const businessExists = rawData.some((business) => String(business.id) === businessId);
      setSelectedBusinessId(businessExists ? businessId : null);
      setFocusSelectedBusiness(businessExists);
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
      if (!typeMap.has(code)) typeMap.set(code, { code, label, count: 0 });
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

  const mappableCount = useMemo(
    () => rawData.filter(isMappableLocation).length,
    [rawData],
  );

  const mappableFilteredData = useMemo(
    () => filteredData.filter(isMappableLocation),
    [filteredData],
  );

  const locationStats = useMemo(() => filteredData.reduce((stats, business) => {
    if (isMappableLocation(business)) stats.mappable += 1;

    if (business.location_accuracy === LOCATION_ACCURACY.EXACT) {
      stats.exact += 1;
    } else if (business.location_accuracy === LOCATION_ACCURACY.UNKNOWN) {
      stats.unknown += 1;
    } else {
      stats.approximate += 1;
    }

    return stats;
  }, {
    total: filteredData.length,
    mappable: 0,
    exact: 0,
    approximate: 0,
    unknown: 0,
  }), [filteredData]);

  const clusterResult = useMemo(() => {
    if (mappableFilteredData.length === 0) {
      return { clusteredData: [], centroids: [], colors: [], clusterStats: [], clusterRadii: [], iterations: 0, wcss: 0 };
    }

    const effectiveK = Math.min(kValue, mappableFilteredData.length);
    const result = performKMeans(mappableFilteredData, effectiveK);
    const generatedColors = generateClusterColors(effectiveK);
    const stats = result.clusters.map((cluster, index) => ({ count: cluster.length, color: generatedColors[index] }));

    return {
      clusteredData: result.clusteredData,
      centroids: result.centroids,
      colors: generatedColors,
      clusterStats: stats,
      clusterRadii: result.clusterRadii,
      iterations: result.iterations,
      wcss: result.wcss,
    };
  }, [mappableFilteredData, kValue]);

  const { clusteredData, centroids, colors, clusterStats, clusterRadii, iterations, wcss } = clusterResult;

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((isOpen) => {
      const nextOpen = !isOpen;
      if (nextOpen) setDiscoveryOpen(false);
      return nextOpen;
    });
  }, []);

  const selectBusiness = useCallback((business, focus = false) => {
    const businessId = String(business.id);
    setSelectedBusinessId(businessId);
    setFocusSelectedBusiness(focus);
    closeDiscovery(false);

    const url = new URL(window.location.href);
    url.searchParams.set('umkm', businessId);
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [closeDiscovery]);

  const clearSelectedBusiness = useCallback(() => {
    setSelectedBusinessId(null);
    setFocusSelectedBusiness(false);

    const url = new URL(window.location.href);
    url.searchParams.delete('umkm');
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  // Leaflet owns the popup. Direct marker clicks must never trigger another
  // flyTo because that can close the popup that Leaflet just opened.
  // List/community selections keep the existing flyTo + popup behavior.
  useEffect(() => {
    if (!selectedBusiness) return undefined;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 28;
    let timer = null;

    const selectedName = businessTitle(selectedBusiness);
    const selectedAddress = selectedBusiness.address || '';

    const addRouteButton = () => {
      if (cancelled) return;

      const popupContent = document.querySelector('.leaflet-popup-content');
      if (!popupContent || popupContent.querySelector('.popup-route-button')) return;

      const popupText = popupContent.textContent || '';
      const matchesBusiness =
        popupText.includes(selectedName) ||
        (selectedAddress && popupText.includes(selectedAddress));

      if (!matchesBusiness) return;

      const coordinates = getAnalysisCoordinates(selectedBusiness);
      const destination = coordinates
        ? `${coordinates.lat},${coordinates.lng}`
        : selectedBusiness.address || selectedName;
      const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
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

    const openSelectedPopup = () => {
      if (cancelled) return;

      const mapElement = document.querySelector('#map-container .leaflet-container');
      if (!mapElement) {
        scheduleRetry();
        return;
      }

      const mapRect = mapElement.getBoundingClientRect();
      const targetX = mapRect.left + mapRect.width / 2;
      const targetY = mapRect.top + mapRect.height / 2;

      const markerElements = Array.from(
        mapElement.querySelectorAll('.leaflet-marker-icon.custom-div-icon'),
      ).filter((element) => element.innerHTML.includes('width: 10px'));

      const marker = markerElements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            element,
            distance: Math.hypot(
              rect.left + rect.width / 2 - targetX,
              rect.top + rect.height / 2 - targetY,
            ),
          };
        })
        .sort((a, b) => a.distance - b.distance)[0];

      if (!marker || marker.distance > Math.max(mapRect.width, mapRect.height) * 0.14) {
        scheduleRetry();
        return;
      }

      marker.element.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }));

      window.setTimeout(addRouteButton, 50);
      window.setTimeout(addRouteButton, 150);
      window.setTimeout(addRouteButton, 300);

      window.setTimeout(() => {
        if (!document.querySelector('.leaflet-popup')) scheduleRetry();
      }, 180);
    };

    const scheduleRetry = () => {
      if (cancelled || attempts >= maxAttempts) return;
      attempts += 1;
      timer = window.setTimeout(openSelectedPopup, attempts < 6 ? 180 : 250);
    };

    // Direct marker click: Leaflet has already opened the popup. Only add Rute.
    // List/community selection: open the marker after flyTo as before.
    if (!focusSelectedBusiness) {
      const directTimers = [50, 150, 300].map((delay) => window.setTimeout(addRouteButton, delay));

      return () => {
        cancelled = true;
        directTimers.forEach((directTimer) => window.clearTimeout(directTimer));
      };
    }

    timer = window.setTimeout(openSelectedPopup, 700);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [selectedBusiness, focusSelectedBusiness]);

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
      <div className="loading-screen public-state-screen">
        <div className="loading-content">
          <Loader2 size={40} color="var(--primary-color)" className="animate-spin" />
          <h2>Memuat Data UMKM...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen public-state-screen">
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
    <div className={`app-container public-app ${sidebarOpen ? 'sidebar-open' : ''} ${discoveryOpen ? 'discovery-open' : ''}`}>
      <button className="sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarOpen ? 'Tutup menu' : 'Buka menu'} aria-expanded={sidebarOpen} aria-controls="sidebar" id="sidebar-toggle">
        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={closeSidebar} aria-hidden="true" />

      <Sidebar
        isOpen={sidebarOpen}
        kValue={kValue}
        setKValue={setKValue}
        totalData={rawData.length}
        mappableCount={mappableCount}
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
          ref={discoveryTriggerRef}
          className="mobile-discovery-trigger"
          type="button"
          onClick={() => {
            setSidebarOpen(false);
            setDiscoveryOpen(true);
          }}
          aria-label="Buka pencarian dan pilihan komunitas"
          aria-expanded={discoveryOpen}
          aria-controls="business-panel"
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
          locationStats={locationStats}
          overlayOpen={sidebarOpen || discoveryOpen}
          selectedBusiness={focusSelectedBusiness ? selectedBusiness : null}
          onSelectBusiness={selectBusiness}
        />

        <BusinessList
          businesses={filteredData}
          allBusinesses={rawData}
          resultsKey={`${searchQuery}\u0000${productFilter}\u0000${activeCollection?.id || 'all'}`}
          selectedBusiness={selectedBusiness}
          activeCollectionId={activeCollection?.id}
          onSelectCollection={selectCollection}
          onSelectBusiness={(business) => selectBusiness(business, true)}
          onClearSelectedBusiness={clearSelectedBusiness}
          onShareBusiness={shareBusiness}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isMobileOpen={discoveryOpen}
          onMobileClose={closeDiscovery}
        />
      </main>
    </div>
  );
}

export default App;
