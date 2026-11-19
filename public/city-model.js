import * as T from '/vendor/three.module.js';

const site = [55.27435, 25.19714];
const meterLongitude = 100780;
const meterLatitude = 110775;
const toWorld = ([lon, lat]) => [(lon - site[0]) * meterLongitude, (site[1] - lat) * meterLatitude];

function planarTriangles(rings) {
  const points = rings.map(ring => ring.map(([x, z]) => new T.Vector2(x, z)));
  return {
    vertices: points.flat(),
    faces: T.ShapeUtils.triangulateShape(points[0], points.slice(1))
  };
}

// Collect the city into a handful of draw calls rather than one mesh per building.
function surfaceBatch() {
  const positions = [], normals = [], colors = [], facade = [];
  const vertex = ([x, y, z], normal, color, uv) => {
    positions.push(x, y, z);
    normals.push(...normal);
    colors.push(color.r, color.g, color.b);
    facade.push(...uv);
  };

  function horizontal(rings, height, color) {
    const { vertices, faces } = planarTriangles(rings);
    for (const [a, b, c] of faces) {
      for (const index of [c, b, a]) {
        const point = vertices[index];
        vertex([point.x, height, point.y], [0, 1, 0], color, [point.x, point.y, 0]);
      }
    }
  }

  function extrude(rings, bottom, top, walls, roof, textureId = 1) {
    horizontal(rings, top, roof);
    for (const ring of rings) {
      const points = ring.map(point => new T.Vector2(...point));
      const orientation = T.ShapeUtils.isClockWise(points) === (ring === rings[0]) ? -1 : 1;
      for (let i = 0; i < ring.length; i++) {
        const [ax, az] = ring[i];
        const [bx, bz] = ring[(i + 1) % ring.length];
        const dx = bx - ax, dz = bz - az;
        const length = Math.hypot(dx, dz);
        if (!length) continue;
        const normal = [orientation * dz / length, 0, -orientation * dx / length];
        const corners = [[ax, bottom, az], [bx, bottom, bz], [bx, top, bz], [ax, top, az]];
        const uv = [[0, bottom], [length, bottom], [length, top], [0, top]];
        const indexes = orientation > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
        for (const index of indexes) vertex(corners[index], normal, walls, [...uv[index], textureId]);
      }
    }
  }

  function line(points, width, height, color) {
    if (points.length < 2) return;
    const offsets = points.map(([x, z], i) => {
      const previous = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      const dx = next[0] - previous[0], dz = next[1] - previous[1];
      const half = width / Math.max(1, 2 * Math.hypot(dx, dz));
      return [[x - dz * half, height, z + dx * half], [x + dz * half, height, z - dx * half]];
    });
    for (let i = 1; i < offsets.length; i++) {
      const [a, b] = offsets[i - 1], [c, d] = offsets[i];
      for (const point of [a, c, b, b, c, d]) vertex(point, [0, 1, 0], color, [0, 0, 0]);
    }
  }

  function mesh(material) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('facade', new T.Float32BufferAttribute(facade, 3));
    return new T.Mesh(geometry, material);
  }

  return { mesh, horizontal, extrude, line };
}

function buildingMaterial() {
  const material = new T.MeshStandardMaterial({
    vertexColors: true, side: T.DoubleSide, roughness: .79, metalness: .10
  });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 facade; varying vec3 vFacade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFacade = facade;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFacade;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 grid = vFacade.xy / vec2(vFacade.z > 1.5 ? 2.35 : 3.5, 3.55);
        vec2 screenWidth = fwidth(grid);
        float detail = (1.0 - smoothstep(0.09, 0.49, max(screenWidth.x, screenWidth.y))) * step(0.5, vFacade.z);
        vec2 s = fract(grid);
        float floorSlab = 1.0 - smoothstep(0.055, 0.19, abs(s.y - 0.5));
        float mullion = 1.0 - smoothstep(0.024, 0.083, min(s.x, 1.0 - s.x));
        float varied = fract(sin(dot(floor(grid) + floor(vFacade.z * 25.0), vec2(127.1, 311.7))) * 43758.5453);
        float windowTint = smoothstep(0.13, 0.7, varied);
        float band = sin(vFacade.y * 0.017 + vFacade.z) * 0.5 + 0.5;
        vec2 broadGrid = vFacade.xy / vec2(8.0, 13.2);
        vec2 panelAA = fwidth(broadGrid);
        float panels = (1.0 - smoothstep(.14, .69, max(panelAA.x, panelAA.y))) * step(.5, vFacade.z);
        float edges = 1.0 - smoothstep(.05, .21, min(fract(broadGrid.x), 1.0 - fract(broadGrid.x)));
        float darkerFloors = smoothstep(.16, .72, fract(broadGrid.y));
        diffuseColor.rgb *= 1.0 + detail * (floorSlab * .43 + mullion * .21 - .35 + windowTint * .24);
        diffuseColor.rgb *= 1.0 + panels * (.21 * edges - .16 * darkerFloors);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.86, 1.035, 1.17), band * step(0.5, vFacade.z) * .72);
      `);
  };
  return material;
}

function waterMaterial(bounds, terrainTone) {
  const material = new T.MeshStandardMaterial({
    vertexColors: true, side: T.DoubleSide, roughness: .31, metalness: .13
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.waterBounds = { value: new T.Vector4(...bounds) };
    shader.uniforms.terrainTone = { value: terrainTone };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 facade; varying vec2 waterXY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nwaterXY = facade.xy;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 waterXY; uniform vec4 waterBounds; uniform vec3 terrainTone;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float broad = sin(waterXY.x * .009 + cos(waterXY.y * .013));
        float ripple = sin(waterXY.x * .165 + waterXY.y * .493 + broad * 1.4);
        float shimmer = smoothstep(.81, 1., ripple) * .12;
        diffuseColor.rgb *= .93 + shimmer + broad * .085;
        vec2 clearance = min(waterXY - waterBounds.xy, waterBounds.zw - waterXY);
        float edge = smoothstep(0.0, 950.0, min(clearance.x, clearance.y));
        diffuseColor.rgb = mix(terrainTone, diffuseColor.rgb, edge);
      `);
  };
  return material;
}

function addBuildings(scene, buildings) {
  const batch = surfaceBatch();
  const glass = ['#4a697d', '#4c7288', '#678696', '#58858c', '#69848d', '#556c84', '#827f77'].map(color => new T.Color(color));
  const stone = ['#b2a294', '#a7a79d', '#ad9f89', '#9e9f99', '#baafa2', '#bcb0a0'].map(color => new T.Color(color));
  const roof = new T.Color('#bac0bd');
  let index = 0;
  for (const [top, bottom, rings, mappedColor] of buildings) {
    const palette = top >= 65 ? glass : stone;
    const ring = rings[0];
    const [x, z] = ring[0];
    const tone = palette[Math.abs(Math.round(x + z * 3.1)) % palette.length];
    const color = mappedColor ? tone.clone().lerp(new T.Color(mappedColor), .55) : tone;
    batch.extrude(rings, bottom, top, color, color.clone().lerp(roof, .5),
      top > 350 && Math.hypot(x, z) < 125 ? 2 : 1 + (++index % 7) * .07);
  }
  const buildingsMesh = batch.mesh(buildingMaterial());
  buildingsMesh.castShadow = buildingsMesh.receiveShadow = true;
  scene.add(buildingsMesh);
}

function addSurfaces(scene, map, texture) {
  const water = surfaceBatch(), parks = surfaceBatch(), roads = surfaceBatch();
  const sea = new T.Color('#236574');
  const inland = new T.Color('#297680');
  const greenery = [new T.Color('#78866a'), new T.Color('#86997a'), new T.Color('#6e846b')];
  const pavement = ['#aaa293', '#8a8780', '#767880', '#626f78'].map(color => new T.Color(color));
  const paint = new T.Color('#c3b8a3');
  const terrainTone = new T.Color('#aaa598');
  const { bounds } = map;

  for (const [isSea, rings] of map.water) water.horizontal(rings, .62, isSea ? sea : inland);
  for (const [type, rings] of map.parks) parks.horizontal(rings, .39, greenery[type]);
  for (const [rank, bridge, path] of map.roads) {
    const y = bridge ? 7.1 : Math.max(1, 1 + rank * .11);
    roads.line(path, [5, 8, 12, 16][rank], y, pavement[rank]);
    if (rank >= 2) roads.line(path, rank === 3 ? .85 : .45, y + .13, paint);
  }
  const roadMesh = roads.mesh(new T.MeshStandardMaterial({
    vertexColors: true, side: T.DoubleSide, transparent: true, opacity: .72, roughness: .94
  }));
  roadMesh.receiveShadow = true;
  const parkMesh = parks.mesh(new T.MeshStandardMaterial({
    vertexColors: true, side: T.DoubleSide, transparent: true, opacity: texture ? .5 : .94, roughness: .94
  }));
  parkMesh.receiveShadow = true;
  scene.add(parkMesh, water.mesh(waterMaterial(bounds, terrainTone)), roadMesh);

  const ground = new T.MeshStandardMaterial({ color: texture ? '#e5dac9' : terrainTone, map: texture, roughness: .96 });
  if (texture) {
    ground.onBeforeCompile = shader => {
      shader.uniforms.terrainTone = { value: terrainTone };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 terrainTone;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec2 edgeDistance = min(vMapUv, 1.0 - vMapUv);
          float inner = smoothstep(0.0, 0.092, min(edgeDistance.x, edgeDistance.y));
          diffuseColor.rgb = mix(terrainTone, diffuseColor.rgb, inner);
        `);
    };
  }
  const tileGround = new T.Mesh(new T.PlaneGeometry(bounds[2] - bounds[0], bounds[3] - bounds[1]), ground);
  tileGround.rotation.x = -Math.PI / 2;
  tileGround.position.set((bounds[0] + bounds[2]) / 2, 0, (bounds[1] + bounds[3]) / 2);
  tileGround.receiveShadow = true;
  scene.add(tileGround);
  const outskirts = new T.Mesh(new T.PlaneGeometry(40000, 40000),
    new T.MeshStandardMaterial({ color: terrainTone, roughness: 1 }));
  outskirts.rotation.x = -Math.PI / 2;
  outskirts.position.y = -3;
  scene.add(outskirts);
}

export async function buildModel(host) {
  const { default: map } = await import('/assets/dubai-map-data.js').catch(() => {
    throw new Error('The local Dubai map data could not load. The panorama is available.');
  });
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch {
    throw new Error('3D requires a browser with WebGL 2. The panorama is available.');
  }

  const scene = new T.Scene();
  const groundTexture = map.satellite
    ? await new T.TextureLoader().loadAsync('/assets/dubai-ground.webp').catch(() => null)
    : null;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setClearColor('#abb2b1');
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  if (groundTexture) {
    groundTexture.colorSpace = T.SRGBColorSpace;
    groundTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  }
  scene.fog = new T.FogExp2('#abb2b1', .000126);
  const camera = new T.PerspectiveCamera(47, 1, 4, 38000);
  const target = new T.Vector3();
  const sunlight = new T.DirectionalLight('#ffe1b4', 2.35);
  sunlight.position.set(-3750, 3100, 1700);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, { left: -3550, right: 3550, top: 3550, bottom: -3550, near: 30, far: 10500 });
  sunlight.shadow.camera.updateProjectionMatrix();
  sunlight.shadow.bias = -.00019;
  sunlight.shadow.normalBias = 2.25;
  scene.add(sunlight, new T.HemisphereLight('#d5e9ff', '#aa9275', 1.32));

  addSurfaces(scene, map, groundTexture);
  addBuildings(scene, map.buildings);

  const ring = new T.Mesh(new T.RingGeometry(85, 91, 72),
    new T.MeshBasicMaterial({ color: '#f9d49d', side: T.DoubleSide, transparent: true, opacity: .9 }));
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);

  let distance, theta, phi, width, height;
  function overview() {
    distance = 5050;
    theta = .45;
    phi = .98;
    target.set(570, 108, 465);
  }
  overview();
  target.set(0, 100, 130);
  distance = 2550;
  const limitTarget = () => {
    target.x = T.MathUtils.clamp(target.x, map.bounds[0] + 850, map.bounds[2] - 850);
    target.z = T.MathUtils.clamp(target.z, map.bounds[1] + 850, map.bounds[3] - 850);
  };
  const offset = new T.Vector3();
  const projected = new T.Vector3();

  return {
    overview,
    select(point) {
      const [x, z] = toWorld(point);
      ring.position.set(x, 2, z);
    },
    zoom(factor) { distance = T.MathUtils.clamp(distance / factor, 1050, 7100); },
    rotate(x, y) {
      theta -= x * .0054;
      phi = T.MathUtils.clamp(phi - y * .0039, .47, 1.24);
    },
    pan(dx, dy) {
      const scale = distance / 640;
      target.x += (-dx * Math.cos(theta) - dy * Math.sin(theta)) * scale;
      target.z += (dx * Math.sin(theta) - dy * Math.cos(theta)) * scale;
      limitTarget();
    },
    flightTo(point) {
      const [x, z] = toWorld(point);
      const start = target.clone();
      const end = new T.Vector3(x, 75, z);
      const from = distance;
      return progress => {
        target.lerpVectors(start, end, progress);
        distance = T.MathUtils.lerp(from, 2350, progress);
        limitTarget();
      };
    },
    render() {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      if (w !== width || h !== height) {
        width = w;
        height = h;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
      offset.setFromSphericalCoords(distance, phi, theta);
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      renderer.render(scene, camera);
    },
    project(point) {
      const [x, z] = toWorld(point);
      projected.set(x, Math.hypot(x, z) < 40 ? 323 : 125, z).project(camera);
      return [(projected.x + 1) * width / 2, (1 - projected.y) * height / 2];
    },
    dispose() {
      scene.traverse(object => {
        object.geometry?.dispose();
        object.material?.dispose();
      });
      sunlight.shadow.dispose();
      groundTexture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
