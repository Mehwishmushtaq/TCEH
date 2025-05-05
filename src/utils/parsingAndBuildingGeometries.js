import * as THREE from 'three';
import { lerpColor, getHexColor, getHexColorCode } from './colorsUtils';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { surfaceRunningId } from '../constants/refStore';
import { buildBVH } from './bvhBuilder';
import { buildSurfaceInWorker } from './workerGeometryHelper';
import {
  extractBreakLinesFromEntities,
  computeSharpEdgesFromGeometry,
} from './commonUtils';
// export const parseAndBuildGeometry = ({
//   flattenToPlane,
//   entities,
//   surfIdx,
// }) => {
//   vertexMapRef.current.clear();
//   if (surfaceRunningId.current != surfIdx) {
//     meshAdjListRef.current = [];
//     meshVerticesRef.current = [];
//     surfaceRunningId.current = surfIdx;
//   }
//   const geom = new THREE.BufferGeometry();
//   const positions = [];
//   // Build adjacency from each 3DFACE
//   for (const entity of entities) {
//     if (entity.type === '3DFACE' || entity.type === 'FACE') {
//       const verts = entity.vertices;
//       let indicesLocal = verts.map((v) => {
//         const adjV = flattenToPlane ? { x: v.x, y: v.y, z: 0 } : v;
//         const tv = new THREE.Vector3(adjV.x, adjV.y, adjV.z);
//         return addVertexToGraph(tv);
//       });

//       // Build edges
//       if (indicesLocal.length === 3) {
//         addEdge(indicesLocal[0], indicesLocal[1]);
//         addEdge(indicesLocal[1], indicesLocal[2]);
//         addEdge(indicesLocal[2], indicesLocal[0]);
//       } else if (indicesLocal.length === 4) {
//         addEdge(indicesLocal[0], indicesLocal[1]);
//         addEdge(indicesLocal[1], indicesLocal[2]);
//         addEdge(indicesLocal[2], indicesLocal[3]);
//         addEdge(indicesLocal[3], indicesLocal[0]);
//       }
//       if (indicesLocal.length >= 3) {
//         // first tri
//         positions.push(
//           ...getVec3(indicesLocal[0]),
//           ...getVec3(indicesLocal[1]),
//           ...getVec3(indicesLocal[2])
//         );
//         // if 4 verts, add second tri
//         if (indicesLocal.length === 4) {
//           positions.push(
//             ...getVec3(indicesLocal[0]),
//             ...getVec3(indicesLocal[2]),
//             ...getVec3(indicesLocal[3])
//           );
//         }
//       }
//     } else if (entity.type === 'BOUNDARY' && entity.isBoundaryPolygon) {
//       // 1) Flatten coords into earcut format
//       //    entity.vertices = [ {x, y, z}, ... ]
//       //    We'll do a basic approach: assume the boundary is nearly planar
//       //    and just ignore z for 2D triangulation. Then we’ll assign
//       //    an average Z or the original Z from the points.

//       // Flatten to earcut's 2D array [x0, y0, x1, y1, ...]
//       const coords2D = [];
//       const zValues = [];
//       entity.vertices.forEach((v) => {
//         coords2D.push(v.x, v.y);
//         zValues.push(v.z || 0);
//       });
//       // Triangulate
//       const indices = earcut(coords2D);
//       // 2) For each triangle index, push (x, y, z) into `positions`
//       //    We'll pick the actual Z from the corresponding vertex
//       //    so the polygon remains in 3D.
//       for (let i = 0; i < indices.length; i++) {
//         const idx = indices[i];
//         const vx = entity.vertices[idx].x;
//         const vy = entity.vertices[idx].y;
//         // If flattenToPlane => z=0, else use the original
//         const vz = flattenToPlane ? 0 : entity.vertices[idx].z || 0;

//         positions.push(vx, vy, vz);
//       }
//     }
//   }

//   const finalPos = new Float32Array(positions);
//   geom.setAttribute('position', new THREE.BufferAttribute(finalPos, 3));
//   geom.computeVertexNormals();

//   // Merge vertices to optimize geometry
//   const mergedGeom = mergeVertices(geom, 1e-4);
//   mergedGeom.computeVertexNormals();

//   let terrainMesh;

//   // if (solidSurface) {
//   const positionsAttr = mergedGeom.getAttribute('position');
//   let minZ = Infinity;
//   let maxZ = -Infinity;
//   for (let i = 0; i < positionsAttr.count; i++) {
//     const z = positionsAttr.getZ(i);
//     if (z < minZ) minZ = z;
//     if (z > maxZ) maxZ = z;
//   }

//   const colors = [];
//   const bottomColor = [0, 0, 1]; // Blue
//   const midColor = [0, 1, 0]; // Green
//   const topColor = [1, 0, 0]; // Red

//   for (let i = 0; i < positionsAttr.count; i++) {
//     const z = positionsAttr.getZ(i);
//     const t = (z - minZ) / (maxZ - minZ || 1);
//     let r, g, b;
//     if (t < 0.5) {
//       const tt = t / 0.5;
//       const c = lerpColor(bottomColor, midColor, tt);
//       [r, g, b] = c;
//     } else {
//       const tt = (t - 0.5) / 0.5;
//       const c = lerpColor(midColor, topColor, tt);
//       [r, g, b] = c;
//     }
//     colors.push(r, g, b);
//   }

//   const colorAttr = new THREE.Float32BufferAttribute(colors, 3);

//   mergedGeom.setAttribute('color', colorAttr);
//   const material = new THREE.MeshPhongMaterial({
//     vertexColors: true,
//     wireframe: true,
//     side: THREE.DoubleSide,
//   });
//   terrainMesh = new THREE.Mesh(mergedGeom, material);
//   return {
//     mesh: terrainMesh,
//     vertices: meshVerticesRef.current,
//     adjacency: meshAdjListRef.current,
//   };
// };

// export const addEdge = (i1, i2) => {
//   const v1 = meshVerticesRef.current[i1];
//   const v2 = meshVerticesRef.current[i2];
//   const dx = v1.x - v2.x;
//   const dy = v1.y - v2.y;
//   const dz = v1.z - v2.z;
//   const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

//   // Ensure bidirectional edge
//   if (!meshAdjListRef.current[i1].some((edge) => edge.idx === i2)) {
//     meshAdjListRef.current[i1].push({ idx: i2, dist3D });
//   }
//   if (!meshAdjListRef.current[i2].some((edge) => edge.idx === i1)) {
//     meshAdjListRef.current[i2].push({ idx: i1, dist3D });
//   }
// };

// const vectorKey = (v) =>
//   `${v.x.toFixed(5)}_${v.y.toFixed(5)}_${v.z.toFixed(5)}`;
// export const addVertexToGraph = (tv) => {
//   const key = vectorKey(tv);
//   if (!vertexMapRef.current.has(key)) {
//     const idx = meshVerticesRef.current.length;
//     meshVerticesRef.current.push(tv.clone());
//     meshAdjListRef.current.push([]);
//     vertexMapRef.current.set(key, idx);
//     return idx;
//   }
//   return vertexMapRef.current.get(key);
// };
// function getVec3(idx) {
//   const v = meshVerticesRef.current[idx];
//   return [v.x, v.y, v.z];
// }
export const renderLwPolyline = (entity) => {
  const points = entity.vertices.map(
    (vertex) => new THREE.Vector2(vertex.x, vertex.y, entity.elevation)
  );

  const isClosed = entity.isFilledShape || entity.is3dPolyline;
  if (isClosed) {
    const shape = new THREE.Shape(points);
    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshPhongMaterial({
      color: getHexColorCode(entity.color || entity.colorNumber) || 0x0000ff,
      side: THREE.DoubleSide,
      // flatShading: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  } else {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      entity.vertices.map(
        (vertex) => new THREE.Vector3(vertex.x, vertex.y, entity.elevation || 0)
      )
    );
    const material = new THREE.LineBasicMaterial({
      color: getHexColorCode(entity.color || entity.colorNumber || 0x0000ff),
    });
    return new THREE.Line(geometry, material);
  }
};

export const renderPolyline = (entity) => {
  const points = entity.vertices.map(
    (vertex) => new THREE.Vector3(vertex.x, vertex.y, vertex.z || 0)
  );

  // Check if the polyline is closed
  const isClosed = entity.isFilledShape || entity.is3dPolyline;
  if (isClosed) {
    // Convert to 2D shape for simplicity
    const shapePoints = entity.vertices.map(
      (vertex) => new THREE.Vector2(vertex.x, vertex.y)
    );
    const shape = new THREE.Shape(shapePoints);
    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshPhongMaterial({
      color: getHexColorCode(entity.color || entity.colorNumber) || 0x00ff00,
      side: THREE.DoubleSide,
      // flatShading: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  } else {
    // If not closed, render as a line
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: getHexColorCode(entity.color || entity.colorNumber) || 0x00ff00,
    });
    return new THREE.Line(geometry, material);
  }
};

export const renderPointEntity = (entity) => {
  // ...unchanged...
  const position = new THREE.Vector3(
    entity.position.x,
    entity.position.y,
    entity.position.z || 0
  );
  const geometry = new THREE.BufferGeometry().setFromPoints([position]);
  const mat = new THREE.PointsMaterial({
    color: getHexColorCode(entity.color || entity.colorNumber) || 0xffff00,
    size: entity.scaleX || 1.5,
  });
  return new THREE.Points(geometry, mat);
};
const renderLine = (entity, color) => {
  const points = entity.vertices.map(
    (vertex) => new THREE.Vector3(vertex.x, vertex.y, vertex.z || 0)
  );
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: getHexColorCode(entity.color || entity.colorNumber) || 0xff0000,
    linewidth: entity.lineWidth || '1',
    side: THREE.DoubleSide,
  });
  const line = new THREE.Line(geometry, material);
  line.name = `line_${Math.random()}`;
  return line;
};

export const renderEntity = (entity) => {
  // ...unchanged...
  if (
    entity.type === '3DFACE' &&
    entity.type === 'FACE' &&
    entity.type === 'BOUNDARY'
  ) {
    return null; // skip
  }
  switch (entity.type) {
    case 'LWPOLYLINE':
      return renderLwPolyline(entity, entity.color);
    case 'POLYLINE':
      return renderPolyline(entity, entity.color);
    case 'POINT':
      return renderPointEntity(entity, entity.color);
    case 'INSERT':
      return renderPointEntity(entity, entity.color);
    case 'ATTRIB':
      return renderPointEntity(entity, entity.color);
    case 'LINE':
      return renderLine(entity, entity.color);
    default:
      return null;
  }
};

export const setupLighting = (scene) => {
  // ...unchanged...
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
  directionalLight.position.set(200, 300, 400);
  scene.add(directionalLight);

  const bottomLight = new THREE.PointLight(0xffffff, 1.2);
  bottomLight.position.set(0, -500, 200);
  scene.add(bottomLight);

  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
  hemisphereLight.position.set(0, 0, 300);
  scene.add(hemisphereLight);

  const ambientLight = new THREE.AmbientLight(0x666666, 1.5);
  scene.add(ambientLight);
};

export function computeUVsForDrapePixelCenter(geometry, texture, jgwValues) {
  const position = geometry.getAttribute('position');
  if (!position) {
    console.warn('No position attribute on geometry');
    return new Float32Array(0);
  }

  // Deconstruct JGW
  let { pixelWidth, rotationX, rotationY, pixelHeight, topLeftX, topLeftY } =
    jgwValues;

  // Image dimensions in pixels
  const imageWidth = texture.image.width;
  const imageHeight = texture.image.height;

  const posArray = position.array; // [x0,y0,z0, x1,y1,z1, ...]
  const uvArray = new Float32Array((posArray.length / 3) * 2);

  let k = 0;
  for (let i = 0; i < posArray.length; i += 3) {
    const x = posArray[i];
    const y = posArray[i + 1];

    let u = (x - topLeftX) / (imageWidth * pixelWidth);
    let v = (topLeftY - y) / (imageHeight * Math.abs(pixelHeight));

    // If the image appears inverted top-to-bottom,
    // swap the sign or do v = 1 - v.
    // v = 1 - v;
    v = 1 - v;
    uvArray[k++] = u;
    uvArray[k++] = v;
  }

  return uvArray;
}

// export async function createGeometryFromJSON(geometryJSON) {
//   const geometry = new THREE.BufferGeometry();

//   if (geometryJSON.attributes) {
//     for (const attrName in geometryJSON.attributes) {
//       const srcAttr = geometryJSON.attributes[attrName];
//       const typedArray = new Float32Array(srcAttr.array);
//       const bufferAttr = new THREE.BufferAttribute(
//         typedArray,
//         srcAttr.itemSize,
//         srcAttr.normalized || false
//       );

//       geometry.setAttribute(attrName, bufferAttr);
//     }
//   }

//   if (geometryJSON.index) {
//     // Decide if you need Uint16Array vs. Uint32Array (depends on max index)
//     // e.g. if max index > 65535, you must use Uint32
//     // For simplicity, we'll just assume it's safe to use UInt32 if it's large:
//     // const maxIndexValue = Math.max(...geometryJSON.index.array);
//     // let maxIndexValue = geometryJSON.index.array.reduce(
//     //   (acc, val) => (val > acc ? val : acc),
//     //   -Infinity
//     // );
//     // const IndexArrayType = maxIndexValue > 65535 ? Uint32Array : Uint16Array;

//     const typedIndex = new Uint32Array(geometryJSON.index.array);
//     const indexAttr = new THREE.BufferAttribute(
//       typedIndex,
//       geometryJSON.index.itemSize,
//       geometryJSON.index.normalized || false
//     );
//     geometry.setIndex(indexAttr);
//   }
//   geometry.computeVertexNormals(); // if needed
//   return geometry;
// }

async function createGeometryFromJSON(json) {
  const geometry = new THREE.BufferGeometry();
  // Rebuild each attribute
  for (const attrName in json.attributes) {
    const srcAttr = json.attributes[attrName];
    // For example, position is a Float32Array
    const typedArray = new Float32Array(srcAttr.array);
    const bufferAttr = new THREE.BufferAttribute(
      typedArray,
      srcAttr.itemSize,
      srcAttr.normalized
    );
    geometry.setAttribute(attrName, bufferAttr);
  }

  if (json.index) {
    const indexArray = new Uint32Array(json.index.array);
    geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
  }

  geometry.computeVertexNormals();

  return geometry;
}

export async function onBuildSurface({
  scene,
  surf,
  surfIdx,
  entities,
  flattenToPlane,
  setBuildProgress,
}) {
  const surfColor = getHexColorCode(entities[0]?.color) || '#808080';
  let surfaceRunId = surfaceRunningId.current;
  try {
    let data = await buildSurfaceInWorker({
      surfIdx,
      surfaceRunningId: surfaceRunId,
      entities,
      flattenToPlane,
      setBuildProgress,
    });
    if (!data) {
      console.warn('No geometry built');
      return;
    }
    const { geometries } = data;
    const geoArr = [];
    for (let geo of geometries) {
      const geom = await createGeometryFromJSON(geo);
      geoArr.push(geom);
    }
    const combinedGeometry = mergeGeometries(geoArr);
    const material = new THREE.MeshPhongMaterial({
      vertexColors: false,
      wireframe: true,
      color: surfColor,
      side: THREE.DoubleSide,
    });
    const combinedMesh = new THREE.Mesh(combinedGeometry, material);
    scene.add(combinedMesh);
    surf._object = combinedMesh;
    surf._originalMaterial = combinedMesh.material.clone();
    // const positions = surf._object.geometry.getAttribute("positions")
    // surf._breakLineEdges = computeSharpEdgesFromGeometry(positions.array);

    delete surf.entities;
    surfaceRunningId.current = surfaceRunningId.current + 1;
    return;
  } catch (err) {
    console.error('Error building surface in worker:', err);
  }
}

export const replaceFileExtFunc = (text = '') => {
  return text
    .replace(/\.xml$/, '')
    .replace(/\.dxf$/, '')
    .replace(/\.pslz$/, '');
};
