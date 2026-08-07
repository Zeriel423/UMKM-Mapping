import React, { useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  ZoomControl,
  useMap
} from 'react-leaflet';
import L from 'leaflet';

// Make L available globally for leaflet.markercluster
if (typeof window !== 'undefined') {
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
      className: 'custom-div-icon',
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
      iconAnchor: [11, 11]
    });
  } else {
    icon = L.divIcon({
      className: 'custom-div-icon',
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
      popupAnchor: [0, -5]
    });
  }

  iconCache[key] = icon;
  return icon;
};

// Component that manages marker cluster layer using native Leaflet
const MarkerClusterLayer = ({ data, colors }) => {
  const map = useMap();
  const clusterGroupRef = useRef(null);
  const mcLoadedRef = useRef(false);

  useEffect(() => {
    if (!map || !data || data.length === 0) return;

    const setupMarkers = async () => {
      // Dynamically import leaflet.markercluster only once
      if (!mcLoadedRef.current && !L.MarkerClusterGroup) {
        try {
          await import('leaflet.markercluster/dist/leaflet.markercluster.js');
          await import('leaflet.markercluster/dist/MarkerCluster.css');
          await import('leaflet.markercluster/dist/MarkerCluster.Default.css');
          mcLoadedRef.current = true;
        } catch (err) {
          console.error('[Map] Failed to load markercluster:', err);
          // Fallback: add markers without clustering
          addMarkersWithoutClustering();
          return;
        }
      }

      // Remove previous cluster group
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
      }

      // Create new cluster group
      const clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 14,
        iconCreateFunction: (cluster) => {
          const childCount = cluster.getChildCount();
          let size = 'small';
          if (childCount > 50) size = 'large';
          else if (childCount > 20) size = 'medium';

          return L.divIcon({
            html: `<div><span>${childCount}</span></div>`,
            className: `marker-cluster marker-cluster-${size}`,
            iconSize: L.point(40, 40)
          });
        }
      });

      // Add markers to cluster group
      data.forEach((umkm) => {
        const clusterColor = umkm.cluster !== undefined && colors[umkm.cluster]
          ? colors[umkm.cluster]
          : '#888';

        const marker = L.marker([umkm.lat, umkm.lng], {
          icon: getIcon(clusterColor)
        });

        marker.bindPopup(`
          <div>
            <h3 style="color: ${clusterColor}">${umkm.name}</h3>
            <p class="popup-brand">${umkm.brand}</p>
            <p class="popup-detail"><strong>Jenis:</strong> ${umkm.product_label || umkm.product_type}</p>
            <p class="popup-detail"><strong>Pemilik:</strong> ${umkm.owner}</p>
            <p class="popup-address">${umkm.address}</p>
            <span class="popup-zone-badge" style="background-color: ${clusterColor}">
              Zone ${umkm.cluster + 1}
            </span>
          </div>
        `, { maxWidth: 280 });

        clusterGroup.addLayer(marker);
      });

      map.addLayer(clusterGroup);
      clusterGroupRef.current = clusterGroup;
    };

    const addMarkersWithoutClustering = () => {
      // Fallback: use a simple layer group if markercluster fails
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
      }

      const group = L.layerGroup();
      data.forEach((umkm) => {
        const clusterColor = umkm.cluster !== undefined && colors[umkm.cluster]
          ? colors[umkm.cluster]
          : '#888';

        const marker = L.marker([umkm.lat, umkm.lng], {
          icon: getIcon(clusterColor)
        });

        marker.bindPopup(`
          <div>
            <h3 style="color: ${clusterColor}">${umkm.name}</h3>
            <p class="popup-brand">${umkm.brand}</p>
            <p class="popup-detail"><strong>Jenis:</strong> ${umkm.product_label || umkm.product_type}</p>
            <p class="popup-detail"><strong>Pemilik:</strong> ${umkm.owner}</p>
            <p class="popup-address">${umkm.address}</p>
            <span class="popup-zone-badge" style="background-color: ${clusterColor}">
              Zone ${umkm.cluster + 1}
            </span>
          </div>
        `, { maxWidth: 280 });

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
  }, [map, data, colors]);

  return null;
};

// Map Legend Component
const MapLegend = ({ colors, clusterStats }) => {
  if (!colors || colors.length === 0) return null;

  return (
    <div className="map-legend" id="map-legend">
      <div className="map-legend-title">Legenda Zonasi</div>
      <div className="map-legend-items">
        {colors.map((color, idx) => (
          <div key={idx} className="map-legend-item">
            <span className="map-legend-color" style={{ backgroundColor: color }} />
            <span>
              Zone {idx + 1}
              {clusterStats && clusterStats[idx] && (
                <span style={{ color: '#94a3b8', marginLeft: '4px' }}>
                  ({clusterStats[idx].count})
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="map-legend-centroid">
        <span className="centroid-icon-preview" />
        <span>Pusat Cluster</span>
      </div>
    </div>
  );
};

const MapComponent = ({ data, centroids, colors, clusterRadii, clusterStats }) => {
  // Center map to North Sulawesi (wider view to capture all regions)
  const defaultCenter = [1.2000, 124.5000];
  const zoomLevel = 8;

  return (
    <div className="map-container" id="map-container">
      <MapContainer
  center={defaultCenter}
  zoom={zoomLevel}
  style={{ height: '100%', width: '100%' }}
  zoomControl={false}
>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <ZoomControl position="topright" />

        {/* Clustered data markers */}
        <MarkerClusterLayer data={data} colors={colors} />

        {/* Centroid markers and radius circles */}
        {centroids.map((centroid, idx) => (
          <React.Fragment key={`centroid-${idx}`}>
            <Marker
              position={[centroid.lat, centroid.lng]}
              icon={getIcon(colors[idx], true)}
              zIndexOffset={1000}
            >
              <Popup>
                <div style={{ textAlign: 'center' }}>
                  <strong style={{ color: colors[idx] }}>Pusat Zone {idx + 1}</strong>
                  <br />
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {centroid.lat.toFixed(4)}, {centroid.lng.toFixed(4)}
                  </span>
                </div>
              </Popup>
            </Marker>

            {/* Dynamic radius based on cluster spread */}
            <Circle
              center={[centroid.lat, centroid.lng]}
              radius={clusterRadii && clusterRadii[idx] ? Math.min(clusterRadii[idx] * 0.7, 50000) : 2000}
              pathOptions={{
                color: colors[idx],
                fillColor: colors[idx],
                fillOpacity: 0.06,
                weight: 1.5,
                dashArray: '6, 4'
              }}
            />
          </React.Fragment>
        ))}
      </MapContainer>

      {/* Legend Overlay */}
      <MapLegend colors={colors} clusterStats={clusterStats} />
    </div>
  );
};

export default MapComponent;
