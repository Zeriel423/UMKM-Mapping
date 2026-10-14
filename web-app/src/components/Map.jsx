import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  ZoomControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  getDisplayCoordinates,
  isExactLocation,
  isMappableLocation,
  locationAccuracyLabel,
} from "../utils/location";
import MapInfoPanel from "./MapInfoPanel";
import { getProductInfo } from "../data/communityCollections";

// Plugin markercluster membaca Leaflet dari window pada saat dimuat dinamis.
if (typeof window !== "undefined") {
  window.L = L;
}

// Cache ikon mencegah pembuatan divIcon berulang untuk warna yang sama.
const iconCache = {};

// Membuat ikon marker UMKM berdasarkan warna kategori.
const getIcon = (color) => {
  if (iconCache[color]) return iconCache[color];

  const icon = L.divIcon({
    className: "custom-div-icon",
    html: `<div style="
      background-color: ${color};
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    popupAnchor: [0, -5],
  });

  iconCache[color] = icon;
  return icon;
};

// Icon untuk lokasi pengguna
const userLocationIcon = L.divIcon({
  className: "user-location-icon",
  html: `<div style="
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #2563eb;
    border: 4px solid #fff;
    box-shadow:
      0 0 0 5px rgba(37,99,235,0.22),
      0 2px 8px rgba(0,0,0,0.35);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Menghitung jarak garis lurus antar koordinat dengan rumus Haversine.
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Radius bumi dalam km

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Menampilkan jarak pendek sebagai meter dan sisanya sebagai kilometer.
const formatDistance = (distance) => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }

  return `${distance.toFixed(1)} km`;
};

// Mencegah data UMKM menjadi HTML aktif ketika dimasukkan ke popup Leaflet.
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

// Merakit HTML popup yang dipakai oleh marker Leaflet di luar tree React.
const popupContent = (umkm, categoryColor) => {
  const coordinates = getDisplayCoordinates(umkm);
  const destination = coordinates ? `${coordinates.lat},${coordinates.lng}` : umkm.address || umkm.name;
  const gallery = (umkm.photos || []).map((photo, index) =>
    `<img src="${escapeHtml(photo.url)}" alt="Foto ${escapeHtml(umkm.brand || umkm.name || 'UMKM')} ${index + 1}" loading="lazy" />`,
  ).join('');
  return `
  <div>
    <h3 style="color: ${categoryColor}">${escapeHtml(umkm.name || "UMKM")}</h3>
    <p class="popup-brand">${escapeHtml(umkm.brand || "")}</p>
    ${gallery ? `<div class="popup-photo-gallery">${gallery}</div>` : ''}
    <p class="popup-detail"><strong>Jenis:</strong> ${escapeHtml(umkm.product_label || umkm.product_type || "-")}</p>
    <p class="popup-detail"><strong>Pemilik:</strong> ${escapeHtml(umkm.owner || "-")}</p>
    <p class="popup-address">${escapeHtml(umkm.address || "-")}</p>
    <span class="popup-location-badge">${escapeHtml(locationAccuracyLabel(umkm))}</span>
    <a class="popup-route-button" href="https://www.google.com/maps/dir/?api=1&amp;destination=${encodeURIComponent(destination)}" target="_blank" rel="noopener noreferrer">Buka Rute</a>
  </div>
`;
};

const bindBusinessPopup = (marker, business, color) => {
  marker.bindPopup(popupContent(business, color), { maxWidth: 280, maxHeight: 420 });
};

const DensityLayer = ({ data, category }) => {
  const map = useMap();
  const [failedCategory, setFailedCategory] = useState(null);
  useEffect(() => {
    if (!category) return undefined;
    let cancelled = false;
    let layer;
    const addDensity = async () => {
      try {
        await import('leaflet.heat');
        if (cancelled) return;
        const points = data.filter((business) => category === 'all' || business.product_type === category)
          .map(getDisplayCoordinates).filter(Boolean).map(({ lat, lng }) => [lat, lng, 1]);
        layer = L.heatLayer(points, {
          radius: 28,
          blur: 20,
          maxZoom: 17,
          minOpacity: 0.25,
          gradient: { 0.2: '#2563eb', 0.45: '#06b6d4', 0.65: '#22c55e', 0.8: '#facc15', 1: '#dc2626' },
        }).addTo(map);
      } catch {
        if (!cancelled) setFailedCategory(category);
      }
    };
    addDensity();
    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, data, category]);
  return category && failedCategory === category ? <div className="density-error" role="alert">Layer kepadatan gagal dimuat. Muat ulang halaman untuk mencoba lagi.</div> : null;
};

// =========================================================
// MARKER CLUSTER LAYER
// =========================================================

// Membuat layer marker yang dikelompokkan untuk menjaga peta tetap responsif.
const MarkerClusterLayer = ({ data, onSelectBusiness }) => {
  const map = useMap();
  const clusterGroupRef = useRef(null);
  const mcLoadedRef = useRef(false);

  // Layer lama dibersihkan sebelum data diganti.
  useEffect(() => {
    if (!map || !data || data.length === 0) return;
    let cancelled = false;

    const setupMarkers = async () => {
      // Load leaflet.markercluster
      if (!mcLoadedRef.current && !L.MarkerClusterGroup) {
        try {
          await import("leaflet.markercluster/dist/leaflet.markercluster.js");

          await import("leaflet.markercluster/dist/MarkerCluster.css");

          await import("leaflet.markercluster/dist/MarkerCluster.Default.css");

          mcLoadedRef.current = true;
        } catch (err) {
          if (cancelled) return;
          console.error("[Map] Failed to load markercluster:", err);

          addMarkersWithoutClustering();
          return;
        }
      }

      if (cancelled) return;

      // Remove layer sebelumnya
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
      }

      // Buat cluster group
      const clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 14,

        iconCreateFunction: (cluster) => {
          const childCount = cluster.getChildCount();

          let size = "small";

          if (childCount > 50) {
            size = "large";
          } else if (childCount > 20) {
            size = "medium";
          }

          return L.divIcon({
            html: `<div><span>${childCount}</span></div>`,
            className: `marker-cluster marker-cluster-${size}`,
            iconSize: L.point(40, 40),
          });
        },
      });

      // Tambahkan marker
      data.forEach((umkm) => {
        const categoryColor = getProductInfo(umkm.product_type).color || "#0f766e";
        const coordinates = getDisplayCoordinates(umkm);
        if (!coordinates) return;

        const marker = L.marker([coordinates.lat, coordinates.lng], {
          icon: getIcon(categoryColor),
        });

        marker.on("click", () => onSelectBusiness?.(umkm));
        bindBusinessPopup(marker, umkm, categoryColor);
        clusterGroup.addLayer(marker);
      });

      map.addLayer(clusterGroup);
      clusterGroupRef.current = clusterGroup;
    };

    // Fallback jika markercluster gagal
    const addMarkersWithoutClustering = () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
      }

      const group = L.layerGroup();

      data.forEach((umkm) => {
        const categoryColor = getProductInfo(umkm.product_type).color || "#0f766e";
        const coordinates = getDisplayCoordinates(umkm);
        if (!coordinates) return;

        const marker = L.marker([coordinates.lat, coordinates.lng], {
          icon: getIcon(categoryColor),
        });

        marker.on("click", () => onSelectBusiness?.(umkm));
        bindBusinessPopup(marker, umkm, categoryColor);
        group.addLayer(marker);
      });

      map.addLayer(group);
      clusterGroupRef.current = group;
    };

    setupMarkers();

    return () => {
      cancelled = true;
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
    };
  }, [map, data, onSelectBusiness]);

  return null;
};

// Brings a shared-link or list selection into view without taking over the
// map until the visitor explicitly selects a business.
// Mengarahkan peta ke UMKM yang dipilih dari daftar atau tautan berbagi.
const SelectedBusinessController = ({ business }) => {
  const map = useMap();

  useEffect(() => {
    if (!business || !isMappableLocation(business)) return;

    const coordinates = getDisplayCoordinates(business);
    if (!coordinates) return;

    map.flyTo([coordinates.lat, coordinates.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [business, map]);

  return null;
};

// =========================================================
// USER LOCATION + UMKM TERDEKAT
// =========================================================

// Menggunakan lokasi browser untuk mencari lima UMKM terdekat.
const UserLocationFeature = ({ data }) => {
  const map = useMap();
  const nearbyPanelRef = useRef(null);

  const [userLocation, setUserLocation] = useState(null);

  const [nearest, setNearest] = useState([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  // Cari lokasi pengguna
  // Permintaan geolokasi hanya dimulai setelah pengguna menekan tombol.
  const findNearest = () => {
    if (!navigator.geolocation) {
      setError("Browser Anda tidak mendukung fitur lokasi.");

      return;
    }

    setLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = {
          lat: coords.latitude,
          lng: coords.longitude,
        };

        // Jarak publik memakai titik yang terlihat pengguna pada peta.
        const validData = (data || []).filter((umkm) => getDisplayCoordinates(umkm));

        // Hitung jarak setiap UMKM
        const nearestData = validData
          .map((umkm) => {
            const coordinates = getDisplayCoordinates(umkm);
            return {
              ...umkm,
              distance: calculateDistance(location.lat, location.lng, coordinates.lat, coordinates.lng),
            };
          })

          .sort((a, b) => a.distance - b.distance)

          // Ambil 5 terdekat
          .slice(0, 5);

        setUserLocation(location);

        setNearest(nearestData);

        setLoading(false);

        // Fokus ke lokasi pengguna
        map.flyTo([location.lat, location.lng], Math.max(map.getZoom(), 12), {
          duration: 1.2,
        });
      },

      (geoError) => {
        setLoading(false);

        if (geoError.code === 1) {
          setError(
            "Izin lokasi ditolak. Silakan izinkan akses lokasi di browser.",
          );
        } else if (geoError.code === 2) {
          setError("Lokasi Anda tidak dapat ditemukan.");
        } else {
          setError("Gagal mendapatkan lokasi. Silakan coba lagi.");
        }
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

  // Reset
  // Menghapus hasil terdekat tanpa memengaruhi filter atau marker UMKM.
  const clearLocation = () => {
    setUserLocation(null);
    setNearest([]);
    setError("");
  };

  // Fokus ke UMKM
  // Memusatkan peta ke UMKM yang dipilih dari daftar lokasi terdekat.
  const focusUmkm = (umkm) => {
    const coordinates = getDisplayCoordinates(umkm);
    if (!coordinates) return;
    map.flyTo([coordinates.lat, coordinates.lng], 15, {
      duration: 1,
    });
  };

  // Membuka Google Maps dengan koordinat analisis atau alamat sebagai fallback.
  const openMap = (umkm) => {
    const coordinates = getDisplayCoordinates(umkm);
    const destination = coordinates
      ? `${coordinates.lat},${coordinates.lng}`
      : umkm.address || umkm.name;
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;

    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };

  const hasEstimatedResults = nearest.some((umkm) => !isExactLocation(umkm));

  useEffect(() => {
    const panel = nearbyPanelRef.current;
    if (!panel) return undefined;

    const stopMapInteraction = (event) => event.stopPropagation();
    const interactionEvents = ['touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointermove', 'wheel'];
    interactionEvents.forEach((eventName) => panel.addEventListener(eventName, stopMapInteraction, { passive: true }));
    return () => interactionEvents.forEach((eventName) => panel.removeEventListener(eventName, stopMapInteraction));
  }, []);

  return (
    <>
      {/* Panel UMKM Terdekat */}
      <div ref={nearbyPanelRef} className="nearby-panel">
        {!userLocation ? (
          <button
            className="nearby-trigger"
            type="button"
            onClick={findNearest}
            disabled={loading}
          >
            {loading ? "📍 Mencari lokasi Anda..." : "📍 Cari UMKM di Sekitar Anda"}
          </button>
        ) : (
          <div className="nearby-card">
            {/* Header */}
            <div className="nearby-card-header">
              <div className="nearby-card-title">
                📍 {hasEstimatedResults ? "Perkiraan UMKM Terdekat" : "UMKM Terdekat"}
              </div>

              <div className="nearby-card-subtitle">
                {hasEstimatedResults
                  ? "Jarak ke titik peta; lokasi usaha masih perkiraan"
                  : "Jarak garis lurus ke titik UMKM pada peta"}
              </div>
            </div>

            {/* List */}
            <div className="nearby-list">
              {nearest.length === 0 ? (
                <div className="nearby-empty">
                  Tidak ada data UMKM dengan koordinat yang valid.
                </div>
              ) : (
                nearest.map((umkm, index) => (
                  <div className="nearby-item" key={`${umkm.name}-${index}`}>
                    {/* Informasi UMKM */}
                    <button
                      className="nearby-item-main"
                      type="button"
                      onClick={() => focusUmkm(umkm)}
                    >
                      <div className="nearby-item-heading">
                        <strong className="nearby-item-name">
                          {index + 1}. {umkm.name}
                        </strong>

                        <span className="nearby-item-distance">
                          {formatDistance(umkm.distance)}
                        </span>
                      </div>

                      <div className="nearby-item-category">
                        {umkm.product_label ||
                          umkm.product_type ||
                          "UMKM"}
                      </div>
                    </button>

                    {/* Tombol Rute */}
                    <button
                      className="nearby-route-button"
                      type="button"
                      onClick={() => openMap(umkm)}
                      aria-label={`Buka rute menuju ${umkm.name}`}
                    >
                      🚗 Buka Rute
                    </button>
                  </div>
                ))
              )}
            </div>
            {/* Reset */}
            <button
              className="nearby-reset-button"
              type="button"
              onClick={clearLocation}
            >
              Reset lokasi
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="nearby-error">
            {error}
          </div>
        )}
      </div>

      {/* Marker lokasi pengguna */}
      {userLocation && (
        <>
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={userLocationIcon}
            zIndexOffset={2000}
          >
            <Popup>
              <strong>📍 Lokasi Anda</strong>

              <br />

              <span className="nearby-user-coordinates">
                {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
              </span>
            </Popup>
          </Marker>

          {/* Radius lokasi pengguna */}
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={80}
            pathOptions={{
              color: "#2563eb",
              fillColor: "#2563eb",
              fillOpacity: 0.08,
              weight: 1,
            }}
          />
        </>
      )}
    </>
  );
};

// =========================================================
// MAIN MAP COMPONENT
// =========================================================

const EXCLUDED_SAMPLE_NAMES = new Set([
  'Kibo Cafe',
  'Odanam Burger',
  'QueenJo',
  'Christine Klappertaart Kairagi',
  'Kios Golden',
]);
const EXCLUDED_SAMPLE_IDS = new Set([1811, 1812, 1813, 1814, 1815]);

const isCleanBusiness = (business) => (
  business
  && !EXCLUDED_SAMPLE_IDS.has(business.id)
  && !EXCLUDED_SAMPLE_NAMES.has(business.name)
  && !business.sampleDetails
);

// Menyatukan tile map, marker cluster, dan kontrol informasi peta.
const MapComponent = ({
  data,
  densityCategory = '',
  locationStats,
  overlayOpen = false,
  selectedBusiness,
  onSelectBusiness,
}) => {
  const defaultCenter = [1.2, 124.5];
  const cleanData = useMemo(() => (data || []).filter(isCleanBusiness), [data]);
  const zoomLevel = 8;

  return (
    <div className="map-container" id="map-container">
      <MapContainer
        center={defaultCenter}
        zoom={zoomLevel}
        style={{
          height: "100%",
          width: "100%",
        }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <ZoomControl position="topright" />

        <DensityLayer data={cleanData} category={densityCategory} />

        {/* Fitur untuk masyarakat */}
        <UserLocationFeature data={cleanData} />

        <SelectedBusinessController business={selectedBusiness} />

        {/* Marker UMKM */}
        <MarkerClusterLayer data={cleanData} onSelectBusiness={onSelectBusiness} />
      </MapContainer>

      <MapInfoPanel
        key={overlayOpen ? "map-info-blocked" : "map-info-ready"}
        locationStats={locationStats}
        disabled={overlayOpen}
      />
    </div>
  );
};

export default MapComponent;
