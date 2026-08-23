import React, { useEffect, useRef, useState } from "react";
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
  getAnalysisCoordinates,
  getDisplayCoordinates,
  isExactLocation,
  isMappableLocation,
  locationAccuracyLabel,
} from "../utils/location";
import MapInfoPanel from "./MapInfoPanel";

// Make L available globally for leaflet.markercluster
if (typeof window !== "undefined") {
  window.L = L;
}

// Memoized icon cache to avoid re-creating on every render
const iconCache = {};

const getIcon = (color, isCentroid = false) => {
  const key = `${color}-${isCentroid}`;
  if (iconCache[key]) return iconCache[key];

  let icon;

  if (isCentroid) {
    icon = L.divIcon({
      className: "custom-div-icon",
      html: `<div style="
        background-color: ${color};
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 3px solid #fff;
        box-shadow: 0 0 10px rgba(0,0,0,0.4), 0 0 20px ${color}44;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: 7px; height: 7px; background-color: white; border-radius: 50%;"></div>
      </div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  } else {
    icon = L.divIcon({
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
  }

  iconCache[key] = icon;
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

// Menghitung jarak menggunakan Haversine formula
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

// Format jarak menjadi meter / kilometer
const formatDistance = (distance) => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }

  return `${distance.toFixed(1)} km`;
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const popupContent = (umkm, clusterColor) => `
  <div>
    <h3 style="color: ${clusterColor}">${escapeHtml(umkm.name || "UMKM")}</h3>
    <p class="popup-brand">${escapeHtml(umkm.brand || "")}</p>
    <p class="popup-detail"><strong>Jenis:</strong> ${escapeHtml(umkm.product_label || umkm.product_type || "-")}</p>
    <p class="popup-detail"><strong>Pemilik:</strong> ${escapeHtml(umkm.owner || "-")}</p>
    <p class="popup-address">${escapeHtml(umkm.address || "-")}</p>
    <span class="popup-location-badge">${escapeHtml(locationAccuracyLabel(umkm))}</span>
    <span class="popup-zone-badge" style="background-color: ${clusterColor}">Wilayah ${Number(umkm.cluster) + 1}</span>
  </div>
`;

// =========================================================
// MARKER CLUSTER LAYER
// =========================================================

const MarkerClusterLayer = ({ data, colors, onSelectBusiness }) => {
  const map = useMap();
  const clusterGroupRef = useRef(null);
  const mcLoadedRef = useRef(false);

  useEffect(() => {
    if (!map || !data || data.length === 0) return;

    const setupMarkers = async () => {
      // Load leaflet.markercluster
      if (!mcLoadedRef.current && !L.MarkerClusterGroup) {
        try {
          await import("leaflet.markercluster/dist/leaflet.markercluster.js");

          await import("leaflet.markercluster/dist/MarkerCluster.css");

          await import("leaflet.markercluster/dist/MarkerCluster.Default.css");

          mcLoadedRef.current = true;
        } catch (err) {
          console.error("[Map] Failed to load markercluster:", err);

          addMarkersWithoutClustering();
          return;
        }
      }

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
        const clusterColor =
          umkm.cluster !== undefined && colors[umkm.cluster]
            ? colors[umkm.cluster]
            : "#888";

        const coordinates = getDisplayCoordinates(umkm);
        if (!coordinates) return;

        const marker = L.marker([coordinates.lat, coordinates.lng], {
          icon: getIcon(clusterColor),
        });

        marker.on("click", () => onSelectBusiness?.(umkm));

        marker.bindPopup(popupContent(umkm, clusterColor), { maxWidth: 280 });

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
        const clusterColor =
          umkm.cluster !== undefined && colors[umkm.cluster]
            ? colors[umkm.cluster]
            : "#888";

        const coordinates = getDisplayCoordinates(umkm);
        if (!coordinates) return;

        const marker = L.marker([coordinates.lat, coordinates.lng], {
          icon: getIcon(clusterColor),
        });

        marker.on("click", () => onSelectBusiness?.(umkm));

        marker.bindPopup(popupContent(umkm, clusterColor), { maxWidth: 280 });

        group.addLayer(marker);
      });

      map.addLayer(group);
      clusterGroupRef.current = group;
    };

    setupMarkers();

    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
      }
    };
  }, [map, data, colors, onSelectBusiness]);

  return null;
};

// Brings a shared-link or list selection into view without taking over the
// map until the visitor explicitly selects a business.
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

const UserLocationFeature = ({ data }) => {
  const map = useMap();

  const [userLocation, setUserLocation] = useState(null);

  const [nearest, setNearest] = useState([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  // Cari lokasi pengguna
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

        // Pastikan koordinat UMKM valid
        const validData = (data || []).filter((umkm) => getAnalysisCoordinates(umkm));

        // Hitung jarak setiap UMKM
        const nearestData = validData
          .map((umkm) => {
            const coordinates = getAnalysisCoordinates(umkm);
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
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  };

  // Reset
  const clearLocation = () => {
    setUserLocation(null);
    setNearest([]);
    setError("");
  };

  // Fokus ke UMKM
  const focusUmkm = (umkm) => {
    const coordinates = getDisplayCoordinates(umkm);
    if (!coordinates) return;
    map.flyTo([coordinates.lat, coordinates.lng], 15, {
      duration: 1,
    });
  };

  const openMap = (umkm) => {
    const coordinates = getAnalysisCoordinates(umkm);
    const destination = coordinates
      ? `${coordinates.lat},${coordinates.lng}`
      : umkm.address || umkm.name;
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;

    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };

  const hasEstimatedResults = nearest.some((umkm) => !isExactLocation(umkm));

  return (
    <>
      {/* Panel UMKM Terdekat */}
      <div className="nearby-panel">
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
                  ? "Jarak dihitung dari titik perkiraan wilayah"
                  : "5 UMKM terdekat dari lokasi Anda"}
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

const MapComponent = ({
  data,
  centroids,
  colors,
  clusterRadii,
  clusterStats,
  locationStats,
  overlayOpen = false,
  selectedBusiness,
  onSelectBusiness,
}) => {
  const defaultCenter = [1.2, 124.5];

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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <ZoomControl position="topright" />

        {/* Fitur untuk masyarakat */}
        <UserLocationFeature data={data} />

        <SelectedBusinessController business={selectedBusiness} />

        {/* Marker UMKM */}
        <MarkerClusterLayer data={data} colors={colors} onSelectBusiness={onSelectBusiness} />

        {/* Centroid dan radius cluster */}
        {centroids.map((centroid, idx) => (
          <React.Fragment key={`centroid-${idx}`}>
            <Marker
              position={[centroid.lat, centroid.lng]}
              icon={getIcon(colors[idx], true)}
              zIndexOffset={1000}
            >
              <Popup>
                <div
                  style={{
                    textAlign: "center",
                  }}
                >
                  <strong
                    style={{
                      color: colors[idx],
                    }}
                  >
                    Pusat Wilayah {idx + 1}
                  </strong>

                  <br />

                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "#64748b",
                    }}
                  >
                    {centroid.lat.toFixed(4)}, {centroid.lng.toFixed(4)}
                  </span>
                </div>
              </Popup>
            </Marker>

            <Circle
              center={[centroid.lat, centroid.lng]}
              radius={
                clusterRadii && clusterRadii[idx]
                  ? Math.min(clusterRadii[idx] * 0.7, 50000)
                  : 2000
              }
              pathOptions={{
                color: colors[idx],
                fillColor: colors[idx],
                fillOpacity: 0.06,
                weight: 1.5,
                dashArray: "6, 4",
              }}
            />
          </React.Fragment>
        ))}
      </MapContainer>

      <MapInfoPanel
        key={overlayOpen ? "map-info-blocked" : "map-info-ready"}
        colors={colors}
        clusterStats={clusterStats}
        locationStats={locationStats}
        disabled={overlayOpen}
      />
    </div>
  );
};

export default MapComponent;
