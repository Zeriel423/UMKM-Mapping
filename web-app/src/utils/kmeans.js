// src/utils/kmeans.js

// Radius bumi rata-rata untuk hasil jarak dalam kilometer.
const EARTH_RADIUS_KM = 6371.0088;

// Memilih koordinat analisis dari format lama maupun format database baru.
const coordinatesOf = (point) => ({
  lat: Number(point.analysis_lat ?? point.lat),
  lng: Number(point.analysis_lng ?? point.lng),
});

// Haversine keeps geographic distances meaningful across mainland and islands.
const distance = (p1, p2) => {
  const first = coordinatesOf(p1);
  const second = coordinatesOf(p2);
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(second.lat - first.lat);
  const dLng = toRadians(second.lng - first.lng);
  const lat1 = toRadians(first.lat);
  const lat2 = toRadians(second.lat);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Membuat seed dari isi dataset agar hasil cluster dapat direproduksi.
const createSeed = (data, k) => {
  let hash = 2166136261 ^ k;
  for (const point of data) {
    const coordinates = coordinatesOf(point);
    const value = `${point.id ?? ''}|${coordinates.lat}|${coordinates.lng}`;
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash >>> 0;
};

// Generator pseudoacak lokal agar algoritma tidak memakai Math.random global.
const seededRandom = (seed) => {
  let value = seed;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
};

// K-Means++ initialization for better centroid selection
const initializeCentroidsKMeansPP = (data, k) => {
  const centroids = [];
  const random = seededRandom(createSeed(data, k));
  
  // Use a deterministic first centroid so the same input always yields the same zones.
  const firstIndex = Math.floor(data.length / 2);
  centroids.push(coordinatesOf(data[firstIndex]));

  for (let c = 1; c < k; c++) {
    // Calculate distance from each point to its nearest existing centroid
    const distances = data.map(point => {
      let minDist = Infinity;
      for (const centroid of centroids) {
        const dist = distance(point, centroid);
        if (dist < minDist) minDist = dist;
      }
      return minDist * minDist; // Squared distance for probability weighting
    });

    // Convert distances to probabilities
    const totalDist = distances.reduce((sum, d) => sum + d, 0);
    if (totalDist === 0) break;

    const probabilities = distances.map(d => d / totalDist);

    // Weighted random selection
    let r = random();
    let cumulative = 0;
    let selectedIndex = 0;
    for (let i = 0; i < probabilities.length; i++) {
      cumulative += probabilities[i];
      if (r <= cumulative) {
        selectedIndex = i;
        break;
      }
    }

    centroids.push(coordinatesOf(data[selectedIndex]));
  }

  // Degenerate datasets can contain fewer unique locations than K.
  while (centroids.length < k) {
    centroids.push(coordinatesOf(data[centroids.length % data.length]));
  }

  return centroids;
};

// Calculate Within-Cluster Sum of Squares (WCSS) for elbow method
const calculateWCSS = (clusters, centroids) => {
  let wcss = 0;
  for (let i = 0; i < clusters.length; i++) {
    for (const point of clusters[i]) {
      wcss += Math.pow(distance(point, centroids[i]), 2);
    }
  }
  return wcss;
};

// Calculate the maximum distance from centroid to any point in its cluster
const calculateClusterRadius = (cluster, centroid) => {
  if (!cluster || cluster.length === 0) return 0;
  let maxDist = 0;
  for (const point of cluster) {
    const dist = distance(point, centroid);
    if (dist > maxDist) maxDist = dist;
  }
  return maxDist * 1000;
};

// K-means Clustering implementation with K-Means++ initialization
export const performKMeans = (data, k, maxIterations = 100) => {
  if (!data || data.length === 0 || k <= 0) return { clusteredData: [], centroids: [], clusters: [], wcss: 0, iterations: 0, clusterRadii: [] };

  // 1. Initialize centroids using K-Means++
  let centroids = initializeCentroidsKMeansPP(data, k);

  let clusters = new Array(k).fill().map(() => []);
  let iterations = 0;
  let centroidsChanged = true;

  while (centroidsChanged && iterations < maxIterations) {
    // Reset clusters
    clusters = new Array(k).fill().map(() => []);

    // 2. Assign each point to the closest centroid
    for (const point of data) {
      let minDistance = Infinity;
      let closestCentroidIndex = 0;

      for (let i = 0; i < centroids.length; i++) {
        const dist = distance(point, centroids[i]);
        if (dist < minDistance) {
          minDistance = dist;
          closestCentroidIndex = i;
        }
      }

      clusters[closestCentroidIndex].push(point);
    }

    // 3. Update centroids
    let newCentroids = [];
    centroidsChanged = false;

    for (let i = 0; i < k; i++) {
      const cluster = clusters[i];
      if (cluster.length === 0) {
        // Handle empty cluster by keeping old centroid
        newCentroids.push(centroids[i]);
        continue;
      }

      const sumLat = cluster.reduce((sum, point) => sum + coordinatesOf(point).lat, 0);
      const sumLng = cluster.reduce((sum, point) => sum + coordinatesOf(point).lng, 0);

      const newLat = sumLat / cluster.length;
      const newLng = sumLng / cluster.length;

      newCentroids.push({ lat: newLat, lng: newLng });

      // Check if centroid moved significantly
      if (Math.abs(centroids[i].lat - newLat) > 0.0001 || Math.abs(centroids[i].lng - newLng) > 0.0001) {
        centroidsChanged = true;
      }
    }

    centroids = newCentroids;
    iterations++;
  }

  // Calculate WCSS for this result
  const wcss = calculateWCSS(clusters, centroids);

  // Calculate dynamic radius for each cluster
  const clusterRadii = clusters.map((cluster, i) => calculateClusterRadius(cluster, centroids[i]));

  // Format result to include cluster assignment for each data point
  const clusteredData = data.map(point => {
    let minDist = Infinity;
    let clusterIndex = 0;

    for (let i = 0; i < centroids.length; i++) {
      const dist = distance(point, centroids[i]);
      if (dist < minDist) {
        minDist = dist;
        clusterIndex = i;
      }
    }

    return { ...point, cluster: clusterIndex };
  });

  return { clusteredData, centroids, clusters, wcss, iterations, clusterRadii };
};

// Calculate elbow method data for a range of K values
export const calculateElbowData = (data, maxK = 10) => {
  const results = [];
  for (let k = 2; k <= maxK; k++) {
    const { wcss } = performKMeans(data, k);
    results.push({ k, wcss });
  }
  return results;
};

// Generate distinct colors for clusters based on YBLI theme
export const generateClusterColors = (k) => {
  const colors = [
    '#1D5D55', // Dark Green (primary)
    '#FFB703', // Gold/Yellow (accent)
    '#219EBC', // Blue
    '#FB8500', // Orange
    '#E63946', // Red
    '#8338EC', // Purple
    '#023047', // Dark Blue
    '#38B000', // Bright Green
    '#9D0208', // Dark Red
    '#606C38', // Olive Green
  ];

  if (k <= colors.length) {
    return colors.slice(0, k);
  }

  // Generate evenly-spaced hue colors if k > preset colors
  const extraColors = [];
  for (let i = colors.length; i < k; i++) {
    const hue = Math.floor((i * 360) / k);
    extraColors.push(`hsl(${hue}, 70%, 45%)`);
  }

  return [...colors, ...extraColors];
};
