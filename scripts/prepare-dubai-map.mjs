import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const [directory, decoderDirectory, output = 'public/assets/dubai-map-data.js'] = process.argv.slice(2);
if (!directory || !decoderDirectory) {
  throw new Error('Usage: node scripts/prepare-dubai-map.mjs TILE_DIRECTORY DECODER_PREFIX [OUTPUT]');
}
const require = createRequire(resolve(decoderDirectory, 'package.json'));
const { VectorTile } = require('@mapbox/vector-tile');
const { default: Pbf } = require('pbf');

const bounds = [-3650, -3900, 5150, 3300];
const toWorld = ([lon, lat]) => [
  Math.round((lon - 55.27435) * 100780 * 2) / 2,
  Math.round((25.19714 - lat) * 110775 * 2) / 2
];
const buildings = new Map(), roads = new Map(), water = [], parks = [];
const roadClasses = new Map(Object.entries({
  minor: 0, service: 0, tertiary: 1, secondary: 1, primary: 2, trunk: 2, motorway: 3
}));
const parkClasses = new Map(Object.entries({
  grass: 0, park: 0, recreation_ground: 0, wood: 1, scrub: 1, pitch: 2, golf_course: 2, cemetery: 2
}));

function area(ring) {
  return Math.abs(ring.reduce((total, [x, y], index) => {
    const [nextX, nextY] = ring[(index + 1) % ring.length];
    return total + x * nextY - nextX * y;
  }, 0)) / 2;
}

function clipRing(points, rectangle) {
  const [west, north, east, south] = rectangle;
  for (const [axis, limit, sign] of [[0,west,1], [0,east,-1], [1,north,1], [1,south,-1]]) {
    if (!points.length) break;
    const result = [];
    let previous = points.at(-1);
    let wasInside = sign * (previous[axis] - limit) >= 0;
    for (const point of points) {
      const inside = sign * (point[axis] - limit) >= 0;
      if (inside !== wasInside) {
        const other = 1 - axis;
        const intersect = [0, 0];
        intersect[axis] = limit;
        intersect[other] = previous[other] + (point[other] - previous[other])
          * (limit - previous[axis]) / (point[axis] - previous[axis]);
        result.push(intersect.map(value => Math.round(value * 2) / 2));
      }
      if (inside) result.push(point);
      previous = point;
      wasInside = inside;
    }
    points = result;
  }
  return points;
}

function ringPoints(coordinates) {
  const points = coordinates.slice(0, -1).map(toWorld).filter((p, i, prior) =>
    i === 0 || p[0] !== prior[i - 1][0] || p[1] !== prior[i - 1][1]);
  if (points.length && points.at(-1)[0] === points[0][0] && points.at(-1)[1] === points[0][1]) points.pop();
  return points;
}

function tileCorner(x, y, zoom) {
  const world = 2 ** zoom;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / world))) * 180 / Math.PI;
  return toWorld([x / world * 360 - 180, lat]);
}

for (const name of (await readdir(directory)).filter(name => /^\d+-\d+-\d+\.pbf$/.test(name)).sort()) {
  const [zoom, x, y] = name.slice(0, -4).split('-').map(Number);
  const source = await readFile(resolve(directory, name));
  const tile = new VectorTile(new Pbf(source[0] === 31 && source[1] === 139 ? gunzipSync(source) : source));
  const nw = tileCorner(x, y, zoom), se = tileCorner(x + 1, y + 1, zoom);
  const tileBounds = [Math.max(nw[0], bounds[0]), Math.max(nw[1], bounds[1]),
    Math.min(se[0], bounds[2]), Math.min(se[1], bounds[3])];
  for (const layerName of ['building', 'transportation', 'water', 'park', 'landuse', 'landcover']) {
    const layer = tile.layers[layerName];
    if (!layer) continue;
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      const tags = feature.properties;
      const kind = tags.class;
      if (layerName === 'building' && tags.hide_3d) continue;
      if (layerName === 'transportation' && (!roadClasses.has(kind) || tags.brunnel === 'tunnel')) continue;
      if (['park', 'landuse', 'landcover'].includes(layerName) && !parkClasses.has(kind)) continue;

      const { geometry } = feature.toGeoJSON(x, y, zoom);
      if (layerName === 'transportation') {
        if (!geometry.type.endsWith('LineString')) continue;
        const lines = geometry.type === 'MultiLineString' ? geometry.coordinates : [geometry.coordinates];
        for (const [part, line] of lines.entries()) {
          const path = line.map(toWorld);
          if (!path.some(([x, z]) => x >= bounds[0] && x <= bounds[2] && z >= bounds[1] && z <= bounds[3])) continue;
          const key = feature.id === undefined ? `${name}:${i}:${part}` : `${feature.id}:${part}`;
          const entry = roads.get(key);
          if (!entry || entry[2].length < path.length) roads.set(key, [roadClasses.get(kind), tags.brunnel === 'bridge' ? 1 : 0, path]);
        }
        continue;
      }

      if (!geometry.type.endsWith('Polygon')) continue;
      const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
      for (const [part, polygon] of polygons.entries()) {
        const limit = layerName === 'building' ? bounds : tileBounds;
        const minimum = layerName === 'building' ? .23 : 18;
        const rings = polygon.map(ring => clipRing(ringPoints(ring), limit)).filter(ring => ring.length >= 3 && area(ring) >= minimum);
        if (!rings.length) continue;
        if (layerName === 'water') {
          if (kind === 'swimming_pool' && area(rings[0]) < 75) continue;
          water.push([kind === 'ocean' ? 1 : 0, rings]);
        } else if (layerName === 'building') {
          const size = area(rings[0]);
          const key = feature.id === undefined ? `${name}:${i}:${part}` : `${feature.id}:${part}`;
          const entry = buildings.get(key);
          const bottom = Math.max(0, tags.render_min_height || 0);
          const height = tags.render_height || Math.max(4, Math.min(12, 3 + Math.sqrt(size) * .17));
          const top = Math.round(Math.max(bottom + 2, height) * 10) / 10;
          const [x, z] = rings[0][0];
          // Keep the full center and skyline. Thin short peripheral clutter to reduce GPU memory.
          if (top < 22 && Math.hypot(x - 320, z - 270) > 2600 && feature.id % 3 !== 0) continue;
          const color = typeof tags.colour === 'string' && /^#[\da-f]{6}$/i.test(tags.colour) ? tags.colour : '';
          if (!entry || entry.size < size) buildings.set(key, { size, value: [top, bottom, rings, color] });
        } else {
          parks.push([parkClasses.get(kind), rings]);
        }
      }
    }
  }
}

const map = { bounds, satellite: true, buildings: [...buildings.values()].map(entry => entry.value), roads: [...roads.values()], water, parks };
if (map.buildings.length < 1000 || map.water.length < 10 || !map.buildings.some(([height]) => height === 828)) {
  throw new Error(`The Dubai tile set is incomplete (${map.buildings.length} buildings, ${map.water.length} water polygons, max height ${Math.max(...map.buildings.map(([height]) => height))} m).`);
}
await writeFile(output, '// © OpenStreetMap contributors (ODbL 1.0), via OpenFreeMap and OpenMapTiles.\n'
  + `export default ${JSON.stringify(map)};\n`);
for (const key of ['buildings', 'roads', 'water', 'parks']) console.log(`${key} ${map[key].length}`);
