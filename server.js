const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const timeout = require('connect-timeout');

const app = express();
const PORT = process.env.PORT || 3001;

// Increase JSON body limit if needed
app.use(bodyParser.json({ limit: '50mb' }));

// Serve React’s build folder (for production)
app.use(express.static(path.join(__dirname, 'build')));

/**
 * Helper to get or create an entry in a local map for "layers" or "surfaces".
 */
function getOrCreateMapEntry(map, key, prefix, idx) {
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

/**
 * POST /api/categorize-chunk
 *
 * We receive a chunk of `entities` (maybe 100k at a time),
 * categorize them immediately, and return partial "layers" + "surfaces"
 * to the client. We do NOT store them in memory beyond this request.
 */
app.post('/api/categorize-chunk', (req, res) => {
  const { entities, idx } = req.body;
  if (!entities) {
    return res
      .status(400)
      .json({ success: false, error: 'No entities provided' });
  }

  // We'll create local maps for this chunk only
  const layersMap = new Map();
  const surfacesMap = new Map();

  // Categorize each entity
  for (const entity of entities) {
    if (
      entity.type === '3DFACE' ||
      entity.type === 'FACE' ||
      entity.type === 'BOUNDARY'
    ) {
      // surface
      const surfaceName = entity.surface || entity.surfaceName || 'Default';
      const surfEntry = getOrCreateMapEntry(
        surfacesMap,
        surfaceName,
        'surface',
        idx
      );
      surfEntry.entities.push(entity);
    } else {
      // layer
      const layerName = entity.layer || entity.layerName || 'Default';
      const layerEntry = getOrCreateMapEntry(
        layersMap,
        layerName,
        'layer',
        idx
      );
      layerEntry.entities.push(entity);
    }
  }

  // Convert maps to arrays
  const layers = Array.from(layersMap.values());
  const surfaces = Array.from(surfacesMap.values());

  // Return partial results to the client
  // The client merges them into its own global maps
  res.json({ success: true, layers, surfaces });
});

const sessions = new Map();

/**
 * Creates a new session.
 */
// 1) Initialize session
app.post('/api/geometry/init', (req, res) => {
  const sessionId = uuidv4();
  sessions.set(sessionId, {
    lines: [],
    openPolylines: [],
    closedPolylines: [],
    points: [],
  });
  res.json({ success: true, sessionId });
});

// 2) Receive chunk
app.post('/api/geometry/chunk', (req, res) => {
  const { sessionId, entities } = req.body;
  if (!sessionId || !entities) {
    return res
      .status(400)
      .json({ success: false, error: 'Missing sessionId or entities' });
  }
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Invalid sessionId' });
  }

  for (const e of entities) {
    if (e.type === 'LINE') {
      session.lines.push(e);
    } else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') {
      const isClosed = !!(e.shape || e.is3dPolyline);
      if (isClosed) {
        session.closedPolylines.push(e);
      } else {
        session.openPolylines.push(e);
      }
    } else if (e.type === 'POINT' && e.position) {
      session.points.push(e);
    }
    // If you have other types (3DFACE, etc.), handle them similarly.
  }
  res.json({
    success: true,
    message: `Merged chunk of size ${entities.length}`,
  });
});

// Helper: parse color "#rrggbb" => [r, g, b]
function parseColor(hexStr) {
  const hex = parseInt((hexStr || '#ffffff').replace('#', ''), 16);
  const r = ((hex >> 16) & 0xff) / 255;
  const g = ((hex >> 8) & 0xff) / 255;
  const b = (hex & 0xff) / 255;
  return [r, g, b];
}

/**
 * Build line segments from all LINE entities.
 * Each entity is treated as a continuous line => we create segments for consecutive vertices.
 */
function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function convertValueToHexColor(value) {
  // Convert the value to a hexadecimal string.
  // toString(16) converts to hex; we then uppercase it.
  const hex = value.toString(16).toUpperCase();
  // Pad the hex string with leading zeros to ensure it has 6 characters.
  const paddedHex = ('000000' + hex).slice(-6);
  // Return the color code with a '#' prefix.
  return '#' + paddedHex;
}
/**
 * Build a single "open polylines" geometry as a continuous line.
 * We just push all vertices in order for all open polylines.
 * (If you want them separate, you'd do something else.)
 */
const rgbToHexEnhanced = (rgbStr) => {
  // Remove any extra spaces and split by comma
  const rgbArray = rgbStr
    .split(',')
    .map((component) => component.trim())
    .map(Number);

  // Validate the array
  if (rgbArray.length !== 3 || rgbArray.some((c) => isNaN(c))) {
    throw new Error("Invalid RGB format. Expected format: 'R,G,B'");
  }

  // Validate range
  if (rgbArray.some((c) => c < 0 || c > 255)) {
    throw new Error('RGB components must be between 0 and 255');
  }

  // Conversion helper
  const toHex = (decimal) => {
    const hex = decimal.toString(16).toUpperCase();
    return hex.length === 1 ? '0' + hex : hex;
  };

  const [r, g, b] = rgbArray;
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const getHexColorCode = (color) => {
  if (color) {
    if (typeof color == Number || typeof color == 'number') {
      return convertValueToHexColor(color);
    }
    if (
      typeof color == 'string' &&
      (color?.includes('#') || color?.includes('0x'))
    ) {
      return color;
    } else {
      return rgbToHexEnhanced(color);
    }
  }
  return 0x000000; // Default color if none specified
};

async function buildLineSegments(entities) {
  const positions = [];
  const colors = [];

  for (const line of entities) {
    // If line.color is unchanged from the last line, we reuse the same r,g,b
    // If it's different, we parse once and store r,g,b
    const colorStr = line.color || '#e80909';
    const rgbColor = hexToRgb(colorStr);
    const verts = line.vertices || [];
    if (verts.length < 2) continue;
    for (let i = 0; i < verts.length - 1; i++) {
      const v = verts[i];
      const vB = verts[i + 1];
      positions.push(v.x, v.y, v.z || 0, vB.x, vB.y, vB.z || 0);
      colors.push(
        rgbColor.r || 0,
        rgbColor.g || 0,
        rgbColor.b || 0,
        rgbColor.r || 0,
        rgbColor.g || 0,
        rgbColor.b
      );
    }
  }

  return { positions, colors };
}

function buildOpenPolylines(entities) {
  const positions = [];
  const colors = [];

  for (const poly of entities) {
    // 1) Determine color
    const color = getHexColorCode(poly.color) || '#000000';
    const [r, g, b] = parseColor(color);
    let verts = poly.vertices;
    // 5) Create line segments for each pair of consecutive vertices
    for (let i = 0; i < verts.length - 1; i++) {
      const v1 = verts[i];
      const v2 = verts[i + 1];

      // Handle elevation: use poly.elevation or default to 0 if undefined
      const z1 = poly.elevation !== undefined ? poly.elevation : v1.z || 0;
      const z2 = poly.elevation !== undefined ? poly.elevation : v2.z || 0;

      // Push first vertex of the segment
      positions.push(v1.x, v1.y, z1);
      colors.push(r, g, b);

      // Push second vertex of the segment
      positions.push(v2.x, v2.y, z2);
      colors.push(r, g, b);
    }
  }

  // for (const poly of entities) {
  //   // 1) Determine color
  //   const color = getHexColorCode(poly.color) || '#000000';
  //   const [r, g, b] = parseColor(color);
  //   const rgbColor = hexToRgb(color);
  //   let verts = poly.vertices;
  //   // 5) Create line segments for each pair of consecutive vertices
  //   for (let i = 0; i < verts.length - 1; i++) {
  //     const v1 = verts[i];
  //     const v2 = verts[i + 1];

  //     // Handle elevation: use poly.elevation or default to 0 if undefined
  //     const z1 = poly.elevation !== undefined ? poly.elevation : v1.z || 0;
  //     const z2 = poly.elevation !== undefined ? poly.elevation : v2.z || 0;

  //     // Push first vertex of the segment
  //     positions.push(
  //       v1.x,
  //       v1.y,
  //       z1,
  //       v2.x,
  //       v2.y,
  //       z2
  //       // rgbColor.r || 0,
  //       // rgbColor.g || 0,
  //       // rgbColor.b || 0
  //     );
  //     // colors.push(r, g, b);

  //     // // Push second vertex of the segment
  //     // positions.push();
  //     // colors.push(r, g, b);
  //   }
  // }

  return { positions, colors };
}

/**
 * Build an array of descriptors for each closed polyline, so the front end
 * can create shape geometry for each.
 */
function buildClosedPolylines(entities) {
  const results = [];
  for (const poly of entities) {
    const color = getHexColorCode(poly.color) || '#000000';
    const verts = poly.vertices || [];
    // We'll store just the 2D x,y
    const shapeVerts = verts.map((v) => ({
      x: v.x,
      y: v.y,
      z: v.z || poly.elevation || 0,
    }));
    results.push({
      vertices: shapeVerts,
      color,
    });
  }
  return results;
}

/**
 * Build a single geometry for points.
 */
function buildPoints(entities) {
  const positions = [];
  const colors = [];
  let lastColorStr = null;
  for (const pt of entities) {
    if (!pt.position) continue;
    const v = pt.position;

    const color = getHexColorCode(pt.color) || '#000000';
    if (color !== lastColorStr) {
      colors.push(color);
      lastColorStr = color;
    }
    // const [r, g, b] = parseColor(color);
    positions.push(v.x, v.y, v.z || 0);
    // colors.push(r, g, b);
  }
  return { positions, colors };
}

async function stringifyArrayInChunks(arr, chunkSize = 1000) {
  let result = '[';
  for (let i = 0; i < arr?.length; i += chunkSize) {
    const slice = arr.slice(i, i + chunkSize);
    // JSON‑stringify the small chunk.
    let chunkStr = JSON.stringify(slice);
    // Remove the surrounding brackets
    if (chunkStr.startsWith('[') && chunkStr.endsWith(']')) {
      chunkStr = chunkStr.substring(1, chunkStr.length - 1);
    }
    if (i > 0 && chunkStr) {
      result += ',' + chunkStr;
    } else {
      result += chunkStr;
    }
  }
  result += ']';
  return result;
}

/**
 * 3) Finish route => streams out final JSON with lines, openPolylines, closedPolylines, points
 */
function haltOnTimedout(req, res, next) {
  if (!req.timedout) next();
}
// app.post(
//   '/api/geometry/finish',
//   timeout('20m'),
//   haltOnTimedout,
//   async (req, res) => {
//     const { sessionId } = req.body;
//     if (!sessionId) {
//       return res
//         .status(400)
//         .json({ success: false, error: 'Missing sessionId' });
//     }
//     const session = await sessions.get(sessionId);
//     if (!session) {
//       return res
//         .status(404)
//         .json({ success: false, error: 'Invalid sessionId' });
//     }

//     const { lines, openPolylines, closedPolylines, points } = session;

//     // Build final arrays
//     const lineData = await buildLineSegments(lines);
//     const openPolyData = buildOpenPolylines(openPolylines);
//     const closedPolyData = buildClosedPolylines(closedPolylines);
//     const pointData = buildPoints(points);
//     sessions.delete(sessionId);

//     // We'll chunk-stream the final JSON:
//     res.setHeader('Content-Type', 'application/json');
//     res.write('{"success":true,"geometry":{');

//     // lines
//     if (lineData.positions.length) {
//       const positions = await stringifyArrayInChunks(lineData.positions);
//       // const colors = await stringifyArrayInChunks(lineData.colors);
//       res.write('"lines":{');
//       res.write('"positions":' + positions);
//       // res.write('"colors":' + colors);
//       res.write('}');
//     }
//     if (openPolyData.positions.length) {
//       // openPolylines
//       if (lineData.positions.length) {
//         res.write(',"openPolylines":{');
//       } else {
//         res.write('"openPolylines":{');
//       }
//       res.write('"positions":' + JSON.stringify(openPolyData.positions) + ',');
//       res.write('"colors":' + JSON.stringify(openPolyData.colors));
//       res.write('}');
//     }
//     if (closedPolyData.length) {
//       if (openPolyData.positions.length) {
//         res.write(',"closedPolylines":');
//       } else {
//         res.write('"closedPolylines":');
//       }
//       // closedPolylines => array
//       res.write(JSON.stringify(closedPolyData));
//     }

//     if (pointData.positions.length) {
//       // points
//       if (closedPolyData.length) {
//         res.write(',"points":{');
//       } else {
//         res.write('"points":{');
//       }

//       res.write('"positions":' + JSON.stringify(pointData.positions) + ',');
//       res.write('"colors":' + JSON.stringify(pointData.colors));
//       res.write('}');
//     }
//     // close geometry + object
//     res.write('}}');
//     res.end();
//   }
// );

app.post(
  '/api/geometry/finish',
  timeout('20m'),
  haltOnTimedout,
  async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) {
        return res
          .status(400)
          .json({ success: false, error: 'Missing sessionId' });
      }
      const session = sessions.get(sessionId);
      if (!session) {
        return res
          .status(404)
          .json({ success: false, error: 'Invalid sessionId' });
      }

      const { lines, openPolylines, closedPolylines, points } = session;

      // Build final data arrays
      const lineData = await buildLineSegments(lines);
      const openPolyData = buildOpenPolylines(openPolylines);
      const closedPolyData = buildClosedPolylines(closedPolylines);
      const pointData = buildPoints(points);

      // Set header for NDJSON streaming
      res.setHeader('Content-Type', 'application/x-ndjson');

      // Stream lineData in small chunks
      if (lineData.positions.length) {
        const chunkSize = 10000; // adjust as needed
        for (let i = 0; i < lineData.positions.length; i += chunkSize) {
          const chunk = lineData.positions.slice(i, i + chunkSize);
          res.write(JSON.stringify({ type: 'lineChunk', data: chunk }) + '\n');
        }
        for (let i = 0; i < lineData.colors.length; i += chunkSize) {
          const chunk = lineData.colors.slice(i, i + chunkSize);
          res.write(
            JSON.stringify({ type: 'lineColorsChunk', data: chunk }) + '\n'
          );
        }
        // for (let i = 0; i < lineData.length; i += 10000) {
        //   const slice = lineData.slice(i, i + 10000);
        //   res.write(JSON.stringify({ type: 'lineChunk', data: slice }) + '\n');
        // }
        // res.write(JSON.stringify({ type: 'lineChunk', data: lineData }) + '\n');
      }

      // Stream other geometry parts as complete objects (assuming they are small)
      if (openPolyData.positions.length) {
        const chunkSize = 10000; // adjust as needed
        for (let i = 0; i < openPolyData.positions.length; i += chunkSize) {
          const chunk = openPolyData.positions.slice(i, i + chunkSize);
          res.write(
            JSON.stringify({ type: 'openPolylines', data: chunk }) + '\n'
          );
        }
        for (let i = 0; i < openPolyData.colors.length; i += chunkSize) {
          const chunk = openPolyData.colors.slice(i, i + chunkSize);
          res.write(
            JSON.stringify({ type: 'openPolylinesColors', data: chunk }) + '\n'
          );
        }
        // res.write(
        //   JSON.stringify({ type: 'openPolylines', data: openPolyData }) + '\n'
        // );
      }
      if (closedPolyData.length) {
        res.write(
          JSON.stringify({ type: 'closedPolylines', data: closedPolyData }) +
            '\n'
        );
      }
      if (pointData.positions.length) {
        res.write(JSON.stringify({ type: 'points', data: pointData }) + '\n');
      }
      res.end();
      sessions.delete(sessionId);
    } catch (error) {
      console.log('error', error);
    }
  }
);
// For any other route, serve the React index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
