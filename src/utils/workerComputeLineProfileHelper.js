export function measureProfileLineInWorker({
  startPoint,
  endPoint,
  setBuildingGraph,
  breakLineEdges,
  bvhRoot,
  boundaryEdges,
}) {
  return new Promise((resolve, reject) => {
    let worker = new Worker(
      new URL('../workers/profileBuilder.worker.js', import.meta.url),
      {
        type: 'module', // if needed
      }
    );

    worker.onmessage = (e) => {
      if (e.data.type === 'progress') {
        const { progress, details } = e.data;
        const calProgress = progress * 100;
        setBuildingGraph(calProgress.toFixed(2)); // Convert to percentage
      } else if (e.data.success) {
        worker.terminate();
        worker = null; // explicitly clear reference
        resolve(e.data.data);
      } else if (e.data.error) {
        worker.terminate();
        worker = null; // explicitly clear reference
        reject(new Error(e.data.error));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      worker = null; // explicitly clear reference
      reject(err.message);
    };
    worker.postMessage({
      startPoint,
      endPoint,
      breakLineEdges,
      bvhRoot,
      boundaryEdges,
    });
  });
}

// export function measureProfileLineInWorker({
//   meshData,
//   startPoint,
//   endPoint,
//   stepSize,
//   setBuildingGraph,
// }) {
//   return new Promise((resolve, reject) => {
//     const workerCode = `
//       self.onmessage = (e) => {
//         const { meshData, startPoint, endPoint, stepSize } = e.data;

//         if (!meshData || !meshData.positions) {
//           self.postMessage({
//             success: false,
//             error: 'Invalid meshData passed to worker',
//           });
//           return;
//         }

//         function computeProfile(meshData, startPoint, endPoint, stepSize) {
//           // Create geometry structure for raycasting
//           function buildTriangles(meshData) {
//             const positions = meshData.positions;
//             const triangles = [];
//             for (let i = 0; i < positions.length; i += 9) {
//               triangles.push([
//                 { x: positions[i], y: positions[i + 1], z: positions[i + 2] },
//                 { x: positions[i + 3], y: positions[i + 4], z: positions[i + 5] },
//                 { x: positions[i + 6], y: positions[i + 7], z: positions[i + 8] },
//               ]);
//             }
//             return triangles;
//           }

//           function rayTriangleIntersection(rayOrigin, rayDir, triangle) {
//             // Möller–Trumbore intersection algorithm
//             const EPSILON = 1e-6;
//             const edge1 = {
//               x: triangle[1].x - triangle[0].x,
//               y: triangle[1].y - triangle[0].y,
//               z: triangle[1].z - triangle[0].z,
//             };
//             const edge2 = {
//               x: triangle[2].x - triangle[0].x,
//               y: triangle[2].y - triangle[0].y,
//               z: triangle[2].z - triangle[0].z,
//             };
//             const h = {
//               x: rayDir.y * edge2.z - rayDir.z * edge2.y,
//               y: rayDir.z * edge2.x - rayDir.x * edge2.z,
//               z: rayDir.x * edge2.y - rayDir.y * edge2.x,
//             };
//             const a = edge1.x * h.x + edge1.y * h.y + edge1.z * h.z;
//             if (a > -EPSILON && a < EPSILON) return null;

//             const f = 1.0 / a;
//             const s = {
//               x: rayOrigin.x - triangle[0].x,
//               y: rayOrigin.y - triangle[0].y,
//               z: rayOrigin.z - triangle[0].z,
//             };
//             const u = f * (s.x * h.x + s.y * h.y + s.z * h.z);
//             if (u < 0.0 || u > 1.0) return null;

//             const q = {
//               x: s.y * edge1.z - s.z * edge1.y,
//               y: s.z * edge1.x - s.x * edge1.z,
//               z: s.x * edge1.y - s.y * edge1.x,
//             };
//             const v = f * (rayDir.x * q.x + rayDir.y * q.y + rayDir.z * q.z);
//             if (v < 0.0 || u + v > 1.0) return null;

//             const t = f * (edge2.x * q.x + edge2.y * q.y + edge2.z * q.z);
//             if (t > EPSILON) {
//               return {
//                 x: rayOrigin.x + rayDir.x * t,
//                 y: rayOrigin.y + rayDir.y * t,
//                 z: rayOrigin.z + rayDir.z * t,
//               };
//             }
//             return null;
//           }

//           function raycastTriangles(rayOrigin, rayDir, triangles) {
//             let closestIntersection = null;
//             for (const tri of triangles) {
//               const intersection = rayTriangleIntersection(rayOrigin, rayDir, tri);
//               if (intersection) {
//                 if (!closestIntersection || intersection.z < closestIntersection.z) {
//                   closestIntersection = intersection;
//                 }
//               }
//             }
//             return closestIntersection;
//           }

//           const triangles = buildTriangles(meshData);
//           const dx = endPoint.x - startPoint.x;
//           const dy = endPoint.y - startPoint.y;
//           const length = Math.sqrt(dx * dx + dy * dy);

//           if (!stepSize || stepSize <= 0) {
//             return { success: false, error: 'Invalid stepSize, must be > 0' };
//           }

//           if (length === 0) {
//             return { success: true, data: [] };
//           }

//           const stepCount = Math.floor(length / stepSize);
//           const profilePoints = [];
//           let lastPostedProgress = 0;
//           self.postMessage({ progress: 0 });

//           for (let i = 0; i <= stepCount; i++) {
//             const fraction = i / stepCount;
//             const x = startPoint.x + fraction * dx;
//             const y = startPoint.y + fraction * dy;

//             const rayOrigin = { x, y, z: 999999 };
//             const rayDir = { x: 0, y: 0, z: -1 };
//             const intersection = raycastTriangles(rayOrigin, rayDir, triangles);

//             if (intersection) {
//               const distAlongLine = fraction * length;
//               profilePoints.push({ x: distAlongLine, y: intersection.z });
//             }

//             const rawProgress = (i / stepCount) * 100;
//             const floored = Math.floor(rawProgress);
//             if (floored >= lastPostedProgress + 10) {
//               lastPostedProgress += 10;
//               if (lastPostedProgress > 100) lastPostedProgress = 100;
//               self.postMessage({ progress: lastPostedProgress });
//             }
//           }

//           if (lastPostedProgress < 100) {
//             self.postMessage({ progress: 100 });
//           }

//           return { success: true, data: profilePoints };
//         }

//         try {
//           const result = computeProfile(meshData, startPoint, endPoint, stepSize);
//           self.postMessage(result);
//         } catch (err) {
//           self.postMessage({ success: false, error: err.message });
//         }
//       };
//     `;

//     const blob = new Blob([workerCode], { type: 'application/javascript' });
//     const worker = new Worker(URL.createObjectURL(blob));

//     worker.onmessage = (e) => {
//       if (typeof e.data.progress === 'number') {
//         setBuildingGraph(e.data.progress);
//       } else if (e.data.success) {
//         resolve(e.data.data);
//         worker.terminate();
//       } else if (e.data.error) {
//         reject(new Error(e.data.error));
//         worker.terminate();
//       }
//     };

//     worker.onerror = (err) => {
//       reject(err.message);
//       worker.terminate();
//     };

//     worker.postMessage({
//       meshData,
//       startPoint,
//       endPoint,
//       stepSize,
//     });
//   });
// }
