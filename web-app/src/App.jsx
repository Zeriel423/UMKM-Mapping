import { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import MapView from './components/Map';
import { performKMeans, generateClusterColors } from './utils/kmeans';
import { Loader2, AlertTriangle, Menu, X } from 'lucide-react';

function App() {
  // Data state
  const [rawData, setRawData] = useState([]);
  const [kValue, setKValue] = useState(3);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState('');

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
    // Sort by count descending
    return Array.from(typeMap.values()).sort((a, b) => b.count - a.count);
  }, [rawData]);

  // Filter data based on search and product filter
  const filteredData = useMemo(() => {
    let result = rawData;

    if (productFilter) {
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
  }, [rawData, searchQuery, productFilter]);

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

  // Close sidebar on mobile when clicking overlay
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

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
    <div className="app-container">
      {/* Mobile sidebar toggle */}
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
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
        setProductFilter={setProductFilter}
        productTypes={productTypes}
      />

      {/* Main map area */}
      <main className="main-content">
        <MapView
          data={clusteredData}
          centroids={centroids}
          colors={colors}
          clusterRadii={clusterRadii}
          clusterStats={clusterStats}
        />
      </main>
    </div>
  );
}

export default App;
