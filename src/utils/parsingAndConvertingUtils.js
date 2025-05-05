// parsingAndConvertingUtils.js
import * as THREE from 'three';
import {
  findDeepValue,
  fetchObjectsByKey,
  fetchObjectsByKeyWithCondition,
} from './searchUtils';
import { rgbToHexEnhanced, getHexColorCode } from './colorsUtils';
import { categorizeEntitiesInWorker } from './categorizeWorkerHelper';
import axios from 'axios';

export const convertXMLToEntities = (xmlData, fileName) => {
  // console.log("xmlData", xmlData)
  const fileNameForSurface = fileName.split('.').shift();
  let entities = [];
  const pointMap = new Map();
  const findLineWidth = findDeepValue(
    xmlData?.LandXML?.Project?.Feature,
    '@_label',
    'lineWeight',
    true
  );
  let lineWidth = 2;
  if (findLineWidth?.length) {
    lineWidth = findLineWidth[0]['@_value'];
  }
  // xmlData?.LandXML?.Project?.Feature[1]?.Feature?.Property[3]['@_value'];
  if (xmlData.LandXML?.PlanFeatures?.PlanFeature) {
    xmlData.LandXML.PlanFeatures.PlanFeature.forEach((feature) => {
      const { Line } = feature.CoordGeom || {};
      const lines = Array.isArray(Line) ? Line : [Line];
      const findColor = findDeepValue([feature], '@_label', 'color', true);
      const findLayer = findDeepValue([feature], '@_label', 'layer', true);
      let layerName = fileNameForSurface;
      let color = '128,128,128';
      if (findLayer?.length) {
        layerName = findLayer[0]['@_value'];
      }
      if (findColor?.length) {
        color = findColor[0]['@_value'] || '128,128,128';
      }
      const hexColorCode = getHexColorCode(color || '128,128,128');
      const faceVertices = [];
      if (layerName.includes('TIN') || layerName.includes('SURFACE')) {
        lines.forEach((line) => {
          const startCoords = line.Start?.split(' ').map(Number);
          const endCoords = line.End?.split(' ').map(Number);
          faceVertices.push(
            { x: startCoords[1], y: startCoords[0], z: startCoords[2] || 0 },
            { x: endCoords[1], y: endCoords[0], z: endCoords[2] || 0 }
          );
        });

        if (faceVertices?.length >= 3) {
          for (let i = 1; i < faceVertices?.length - 1; i++) {
            entities.push({
              type: '3DFACE',
              color: hexColorCode,
              lineWidth: lineWidth,
              surfaceName: layerName,
              vertices: [faceVertices[0], faceVertices[i], faceVertices[i + 1]],
              isBreakLineEdge: true, // Flag edges that are break lines
            });
          }
        }
      } else {
        lines.forEach((line) => {
          const startCoords = line.Start?.split(' ').map(Number);
          const endCoords = line.End?.split(' ').map(Number);
          const direction = line['@_dir'];
          const length = line['@_length'];
          const staStart = line['@_staStart'];
          if (startCoords && endCoords) {
            entities.push({
              type: 'LINE',
              direction: direction,
              lineLength: length,
              startingPoint: staStart,
              color: hexColorCode,
              lineWidth: lineWidth,
              layerName: layerName,
              vertices: [
                {
                  x: startCoords[1],
                  y: startCoords[0],
                  z: startCoords[2] || 0,
                },
                { x: endCoords[1], y: endCoords[0], z: endCoords[2] || 0 },
              ],
            });
          }
        });
      }
    });
  }
  if (xmlData.LandXML?.Parcels) {
    const findParcels = fetchObjectsByKey(xmlData.LandXML?.Parcels, 'Parcel');
    findParcels.forEach((parcel) => {
      const parcelsArr = Array.isArray(parcel.Parcel)
        ? parcel.Parcel
        : [parcel.Parcel];
      parcelsArr.forEach((pa) => {
        const { Line } = pa.CoordGeom || {};
        const lines = Array.isArray(Line) ? Line : [Line];
        const findColor = findDeepValue([pa], '@_label', 'color', true);
        const findLayer = findDeepValue([pa], '@_label', 'layer', true);
        let layerName = fileNameForSurface;
        let color = '128,128,128';
        if (findLayer?.length) {
          layerName = findLayer[0]['@_value'];
        }
        if (findColor?.length) {
          color = findColor[0]['@_value'] || '128,128,128';
        }
        const hexColorCode = getHexColorCode(color || '128,128,128');
        lines.forEach((line) => {
          const startCoords = line.Start?.split(' ').map(Number);
          const endCoords = line.End?.split(' ').map(Number);
          const direction = line['@_dir'];
          const length = line['@_length'];
          const staStart = line['@_staStart'];
          if (startCoords && endCoords) {
            entities.push({
              type: 'LINE',
              direction: direction,
              lineLength: length,
              startingPoint: staStart,
              color: hexColorCode,
              lineWidth: lineWidth,
              layerName: layerName,
              vertices: [
                {
                  x: startCoords[1],
                  y: startCoords[0],
                  z: startCoords[2] || 0,
                },
                { x: endCoords[1], y: endCoords[0], z: endCoords[2] || 0 },
              ],
            });
          }
        });
      });
    });
  }
  if (xmlData.LandXML?.Surfaces?.Surface) {
    const surfaces = fetchObjectsByKeyWithCondition(
      xmlData.LandXML?.Surfaces,
      'Surface'
    ).flat();
    surfaces.forEach((surf) => {
      const definitions = fetchObjectsByKeyWithCondition(
        surf,
        'Definition'
      ).flat();
      if (definitions?.length) {
        definitions.forEach((def) => {
          const color = def?.Feature?.Property['@_value'] || '128,128,128';
          const surfaceName = surf['@_name'] || fileNameForSurface;
          const hexColorCode = getHexColorCode(color || '128,128,128');
          if (def?.Pnts?.P) {
            def.Pnts.P.forEach((point) => {
              const [x, y, z] = point['#text'].split(' ').map(Number);
              pointMap.set(
                parseInt(point['@_id'], 10),
                new THREE.Vector3(y, x, z || 0)
              );
              // entities.push({
              //   type: 'POINT',
              //   color: hexColorCode,
              //   layerName: surfaceName,
              //   position: {
              //     x: x,
              //     y: y,
              //     z: z || 0,
              //   },
              // });
            });
          } else {
            console.error('No points found in the XML.');
          }
          // Parse faces
          if (def?.Faces?.F) {
            def.Faces.F.forEach((face) => {
              const indices = face.split(' ').map((id) => parseInt(id, 10));
              // Ensure that the face has exactly 3 vertices (triangle)
              if (indices?.length === 3) {
                const vertices = indices.map((id) => {
                  const vertex = pointMap.get(id);
                  if (!vertex) {
                    console.error(`Point ID ${id} not found.`);
                  }
                  return vertex;
                });
                // Only add the face if all vertices are found
                if (vertices.every((v) => v !== undefined)) {
                  entities.push({
                    color: hexColorCode,
                    type: 'FACE',
                    vertices,
                    surfaceName: surfaceName,
                    isBreakLineEdge: true, // Flag edges that are break lines
                  });
                }
              } else {
                console.warn(
                  `Face with ${indices?.length} vertices is not supported.`
                );
              }
            });
          } else {
            console.error('No faces found in the XML.');
          }
        });
      }
    });
  }
  return entities;
};

// /// Categoring Entities
export const categorizeEntities = async (entities, fileId, onProgress, fileName, mainZipFileName) => {
  const { layers, surfaces } = await categorizeEntitiesInWorker(
    entities,
    fileId,
    onProgress,
    fileName,
    mainZipFileName
  );

  // // return { layers, surfaces };

  // // 1) Create a session on the server
  // let initRes = await fetch('/api/categorize/init', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ fileId }), // optional, if your server expects it
  // });
  // let initData = await initRes.json();
  // if (!initData.sessionId) {
  //   throw new Error(
  //     'Failed to init session. Server response: ' + JSON.stringify(initData)
  //   );
  // }
  // const sessionId = initData.sessionId;

  // // 2) Split the entities array into chunks to avoid one massive request
  // const chunkSize = 100000; // e.g. 100k, adjust as needed
  // for (let i = 0; i < entities.length; i += chunkSize) {
  //   const chunk = entities.slice(i, i + chunkSize);

  //   // 2A) Send this chunk to the server
  //   const chunkRes = await fetch('/api/categorize/chunk', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       sessionId,
  //       entities: chunk, // partial chunk
  //     }),
  //   });
  //   const chunkData = await chunkRes.json();
  //   if (!chunkData.success) {
  //     throw new Error('Error merging chunk: ' + JSON.stringify(chunkData));
  //   }
  // }

  // // 3) All chunks are sent. Now request the final result
  // const finishRes = await fetch('/api/categorize/finish', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ sessionId }),
  // });
  // const finishData = await finishRes.json();
  // if (!finishData.success) {
  //   throw new Error('Finish error: ' + JSON.stringify(finishData));
  // }

  // // The server returns: { success: true, layers, surfaces }, for example

  return {
    layers: layers || [],
    surfaces: surfaces || [],
  };
};

// export async function initCategorize(fileId) {
//   // We call /orgs3dviewer/api/categorize/init
//   const res = await axios.post('/api/categorize/init', { fileId });
//   return res.data;
// }

// export async function chunkCategorize(sessionId, chunk) {
//   const res = await axios.post('/api/categorize/chunk', {
//     sessionId,
//     entities: chunk,
//   });
//   return res.data;
// }

// export async function finishCategorize(sessionId) {
//   const res = await axios.post('/api/categorize/finish', {
//     sessionId,
//   });
//   return res.data;
// }

// // Then in your "categorizeEntities" function:
// export async function categorizeEntities(entities, fileId) {
//   // 1) init
//   const initData = await initCategorize(fileId);
//   if (!initData.success) throw new Error('Init failed');
//   const { sessionId } = initData;

//   // 2) chunk
//   const chunkSize = 100000;
//   for (let i = 0; i < entities.length; i += chunkSize) {
//     const chunk = entities.slice(i, i + chunkSize);
//     const chunkRes = await chunkCategorize(sessionId, chunk);
//     if (!chunkRes.success) {
//       throw new Error('Chunk error');
//     }
//   }

//   // 3) finish
//   const finishData = await finishCategorize(sessionId);
//   if (!finishData.success) {
//     throw new Error('Finish error');
//   }

//   return {
//     layers: finishData.layers,
//     surfaces: finishData.surfaces,
//   };
// }

// export async function categorizeEntities(entities, fileId) {
//   // 1) Initialize session
//   const initRes = await axios.post('/api/categorize/init', {
//     fileId,
//   });
//   const { sessionId } = initRes.data;

//   // 2) Send chunks
//   const chunkSize = 100000; // adjust as needed
//   for (let i = 0; i < entities.length; i += chunkSize) {
//     const chunk = entities.slice(i, i + chunkSize);
//     const chunkRes = await axios.post('/api/categorize/chunk', {
//       sessionId,
//       entities: chunk,
//     });
//     if (!chunkRes.data.success) {
//       throw new Error('Error merging chunk');
//     }
//   }

//   // 3) Finish: get the final categorized data (streamed JSON)
//   const finishRes = await axios.post('/api/categorize/finish', {
//     sessionId,
//   });
//   return finishRes.data;
// }

// We keep local maps on the front end
function getOrCreateFrontMapEntry(map, key, prefix, idx) {
  if (!map.has(key)) {
    map.set(key, {
      id: `${prefix}_${key}_${idx}`,
      [`${prefix}Name`]: key,
      enableValue: true,
      entities: [],
    });
  }
  return map.get(key);
}

function mergePartial(frontMap, partialArr, prefix, idx) {
  for (const item of partialArr) {
    const key = item[`${prefix}Name`];
    const existing = getOrCreateFrontMapEntry(frontMap, key, prefix, idx);
    // push this chunk’s entities
    existing.entities.push(...item.entities);
  }
}

/**
 * categorizeEntities(entities)
 *
 * 1) Splits the big `entities` array into smaller chunks
 * 2) For each chunk, POST to /api/categorize-chunk
 * 3) Merges the partial layers/surfaces in the front end
 * 4) Returns final arrays
 */
// export async function categorizeEntities(entities, idx) {
//   const layersMap = new Map();
//   const surfacesMap = new Map();

//   // chunk the big array
//   const chunkSize = 100000; // or smaller if you want
//   for (let i = 0; i < entities.length; i += chunkSize) {
//     const chunk = entities.slice(i, i + chunkSize);

//     // call the server
//     const res = await axios.post('/api/categorize-chunk', {
//       entities: chunk,
//       idx,
//     });
//     if (!res.data.success) {
//       throw new Error('Categorize chunk error');
//     }

//     // partial results
//     const { layers, surfaces } = res.data;

//     // merge them into front-end maps
//     mergePartial(layersMap, layers, 'layer', idx);
//     mergePartial(surfacesMap, surfaces, 'surface', idx);
//   }

//   // after all chunks, convert to arrays
//   const finalLayers = Array.from(layersMap.values());
//   const finalSurfaces = Array.from(surfacesMap.values());

//   return { layers: finalLayers, surfaces: finalSurfaces };
// }
