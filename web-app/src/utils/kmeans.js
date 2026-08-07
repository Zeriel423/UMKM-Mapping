// src/utils/kmeans.js

// Calculate Euclidean distance between two points
const distance = (p1, p2) => {
  return Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2));
};

// K-Means++ initialization for better centroid selection
const initializeCentroidsKMeansPP = (data, k) => {
  const centroids = [];
  
  // Pick the first centroid randomly (use a deterministic index for consistency)
  const firstIndex = Math.floor(data.length / 2);
  centroids.push({ lat: data[firstIndex].lat, lng: data[firstIndex].lng });

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
    let r = Math.random();
    let cumulative = 0;
    let selectedIndex = 0;
    for (let i = 0; i < probabilities.length; i++) {
      cumulative += probabilities[i];
      if (r <= cumulative) {
        selectedIndex = i;
        break;
      }
    }

    centroids.push({ lat: data[selectedIndex].lat, lng: data[selectedIndex].lng });
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
  // Convert degrees to approximate meters (1 degree ≈ 111,000 meters)
  return maxDist * 111000;
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

      const sumLat = cluster.reduce((sum, point) => sum + point.lat, 0);
      const sumLng = cluster.reduce((sum, point) => sum + point.lng, 0);

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
