// bvhWorker.js
/* eslint-disable no-restricted-globals */

// -------------- geometryToTriangles --------------
function geometryToTriangles(positions) {
  const triArray = [];
  for (let i = 0; i < positions.length; i += 9) {
    const vA = {
      x: positions[i],
      y: positions[i + 1],
      z: positions[i + 2],
    };
    const vB = {
      x: positions[i + 3],
      y: positions[i + 4],
      z: positions[i + 5],
    };
    const vC = {
      x: positions[i + 6],
      y: positions[i + 7],
      z: positions[i + 8],
    };
    triArray.push({ vA, vB, vC });
  }
  return triArray;
}

// -------------- buildBVH --------------
function buildBVH(triangles, maxTrianglesPerLeaf = 100, depth = 0, totalTriangles, progressCallback) {
  if (triangles.length <= maxTrianglesPerLeaf || depth > 40) {
    // Leaf node
    return {
      isLeaf: true,
      triangles,
      bounds: computeBounds(triangles),
    };
  }

  // Compute bounding box, pick an axis to split (e.g., largest extent)
  const bounds = computeBounds(triangles);
  const extents = [
    bounds.max.x - bounds.min.x,
    bounds.max.y - bounds.min.y,
    bounds.max.z - bounds.min.z,
  ];
  let splitAxis = 0; // x=0, y=1, z=2
  if (extents[1] > extents[0]) splitAxis = 1;
  if (extents[2] > extents[splitAxis]) splitAxis = 2;

  // Sort triangles by the center of that axis
  triangles.sort((a, b) => {
    const ca = center(a)[splitAxis];
    const cb = center(b)[splitAxis];
    return ca - cb;
  });

  // Split halfway
  const mid = Math.floor(triangles.length / 2);
  const leftTris = triangles.slice(0, mid);
  const rightTris = triangles.slice(mid);

  // Report progress based on the number of triangles processed
  if (progressCallback) {
    const processedTriangles = totalTriangles - (leftTris.length + rightTris.length);
    const progress = Math.min(100, Math.round((processedTriangles / totalTriangles) * 100));
    progressCallback(progress);
  }

  // Recursively build children
  const leftNode = buildBVH(leftTris, maxTrianglesPerLeaf, depth + 1, totalTriangles, progressCallback);
  const rightNode = buildBVH(rightTris, maxTrianglesPerLeaf, depth + 1, totalTriangles, progressCallback);

  return {
    isLeaf: false,
    bounds,
    splitAxis,
    left: leftNode,
    right: rightNode,
  };
}

function center(tri) {
  const cx = (tri.vA.x + tri.vB.x + tri.vC.x) / 3;
  const cy = (tri.vA.y + tri.vB.y + tri.vC.y) / 3;
  const cz = (tri.vA.z + tri.vB.z + tri.vC.z) / 3;
  return [cx, cy, cz];
}

function computeBounds(triangles) {
  let minx = Infinity,
    miny = Infinity,
    minz = Infinity;
  let maxx = -Infinity,
    maxy = -Infinity,
    maxz = -Infinity;
  for (const t of triangles) {
    for (const v of [t.vA, t.vB, t.vC]) {
      if (v.x < minx) minx = v.x;
      if (v.y < miny) miny = v.y;
      if (v.z < minz) minz = v.z;
      if (v.x > maxx) maxx = v.x;
      if (v.y > maxy) maxy = v.y;
      if (v.z > maxz) maxz = v.z;
    }
  }
  return {
    min: { x: minx, y: miny, z: minz },
    max: { x: maxx, y: maxy, z: maxz },
  };
}

self.onmessage = async (evt) => {
  const { type } = evt.data;

  if (type === 'BUILD_BVH') {
    try {
      // Get positions from data
      const { positions, maxTrianglesPerLeaf } = evt.data;

      // Convert positions to triangle array
      const triangles = geometryToTriangles(positions);

      // Total number of triangles for progress calculation
      const totalTriangles = triangles.length;

      // Progress callback to send updates to the main thread
      const progressCallback = (progress) => {
        self.postMessage({ status: 'progress', progress });
      };

      // Build BVH with progress reporting
      const bvhRoot = buildBVH(triangles, maxTrianglesPerLeaf, 0, totalTriangles, progressCallback);

      // Post result back
      self.postMessage({
        success: true,
        bvh: bvhRoot,
      });
    } catch (err) {
      self.postMessage({ success: false, error: err.message });
    }
  }
};