// bvhBuilder.js

/**
 * Build a very basic BVH from an array of triangles.
 * Each triangle: { vA, vB, vC }, where each v# is { x, y, z }.
 *
 * @param {Array} triangles - array of { vA, vB, vC }
 * @param {number} maxTrianglesPerLeaf - how many triangles before splitting
 * @param {number} depth
 * @returns {object} bvhNode
 */
export function buildBVH(triangles, maxTrianglesPerLeaf = 100, depth = 0) {
    if (triangles.length <= maxTrianglesPerLeaf || depth > 40) {
      // Leaf node
      return {
        isLeaf: true,
        triangles,
        bounds: computeBounds(triangles),
      };
    }
  
    // 1) Compute bounding box, pick an axis to split (e.g. largest extent)
    const bounds = computeBounds(triangles);
    const extents = [
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.min.z,
    ];
    let splitAxis = 0; // x=0, y=1, z=2
    if (extents[1] > extents[0]) splitAxis = 1;
    if (extents[2] > extents[splitAxis]) splitAxis = 2;
  
    // 2) Sort triangles by the center of that axis
    triangles.sort((a, b) => {
      const ca = center(a)[splitAxis];
      const cb = center(b)[splitAxis];
      return ca - cb;
    });
  
    // 3) Split halfway
    const mid = Math.floor(triangles.length / 2);
    const leftTris = triangles.slice(0, mid);
    const rightTris = triangles.slice(mid);
  
    // 4) Recursively build children
    const leftNode = buildBVH(leftTris, maxTrianglesPerLeaf, depth + 1);
    const rightNode = buildBVH(rightTris, maxTrianglesPerLeaf, depth + 1);
  
    return {
      isLeaf: false,
      bounds,
      splitAxis,
      left: leftNode,
      right: rightNode,
    };
  }
  
  function center(tri) {
    // average of 3 vertices, returns [cx, cy, cz]
    const cx = (tri.vA.x + tri.vB.x + tri.vC.x) / 3;
    const cy = (tri.vA.y + tri.vB.y + tri.vC.y) / 3;
    const cz = (tri.vA.z + tri.vB.z + tri.vC.z) / 3;
    return [cx, cy, cz];
  }
  
  function computeBounds(triangles) {
    let minx = Infinity, miny = Infinity, minz = Infinity;
    let maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
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
  