const canvas = document.getElementById("platonicStage");
const presetButtons = [...document.querySelectorAll(".preset-btn")];
const speedControl = document.getElementById("speedControl");
const opacityControl = document.getElementById("opacityControl");
const pauseControl = document.getElementById("pauseControl");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
});

renderer.setClearColor(0x05080d, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05080d, 0.035);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 90);
camera.position.set(0, 0.2, 13);

const root = new THREE.Group();
scene.add(root);

const glowRoot = new THREE.Group();
scene.add(glowRoot);

const meteorRoot = new THREE.Group();
scene.add(meteorRoot);

const reflectionRoot = new THREE.Group();
scene.add(reflectionRoot);

scene.add(new THREE.AmbientLight(0x6d8da0, 0.55));

const keyLight = new THREE.DirectionalLight(0xb8fff0, 1.25);
keyLight.position.set(-4, 5, 8);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x70a7ff, 0.72);
rimLight.position.set(5, -2, -7);
scene.add(rimLight);

const shapeSpecs = [
  {
    id: "tetrahedron",
    label: "Tetrahedron",
    geometry: new THREE.TetrahedronGeometry(1.08, 0),
    color: 0x6fe3b0,
    scale: 1.05,
    rotation: new THREE.Vector3(0.31, 0.64, 0.19),
    axis: new THREE.Vector3(0.86, 0.24, 0.44).normalize(),
  },
  {
    id: "cube",
    label: "Cube",
    geometry: new THREE.BoxGeometry(1.62, 1.62, 1.62),
    color: 0x8fd3ff,
    scale: 1.55,
    rotation: new THREE.Vector3(0.54, 0.17, 0.38),
    axis: new THREE.Vector3(0.22, 0.91, 0.35).normalize(),
  },
  {
    id: "octahedron",
    label: "Octahedron",
    geometry: new THREE.OctahedronGeometry(1.62, 0),
    color: 0xffd166,
    scale: 2.15,
    rotation: new THREE.Vector3(0.26, 0.45, 0.72),
    axis: new THREE.Vector3(0.47, 0.42, 0.78).normalize(),
  },
  {
    id: "dodecahedron",
    label: "Dodecahedron",
    geometry: new THREE.DodecahedronGeometry(1.5, 0),
    color: 0xc9a6ff,
    scale: 2.84,
    rotation: new THREE.Vector3(0.18, 0.76, 0.29),
    axis: new THREE.Vector3(0.76, 0.12, 0.63).normalize(),
  },
  {
    id: "icosahedron",
    label: "Icosahedron",
    geometry: new THREE.IcosahedronGeometry(1.5, 0),
    color: 0xff9e7a,
    scale: 3.54,
    rotation: new THREE.Vector3(0.62, 0.28, 0.11),
    axis: new THREE.Vector3(0.18, 0.62, 0.76).normalize(),
  },
];

const presets = {
  wire: {
    cameraZ: 14,
    rootScale: 0.95,
    rootY: -0.08,
    meshOpacity: 0.035,
    edgeOpacity: 0.68,
    edgeWidth: 1,
    meshMode: "wire",
    particleOpacity: 0.34,
    particleSize: 0.026,
    rotation: 0.42,
    spread: 0.0,
    pulse: 0.04,
  },
  glass: {
    cameraZ: 12.5,
    rootScale: 1,
    rootY: -0.02,
    meshOpacity: 0.22,
    edgeOpacity: 0.46,
    edgeWidth: 1,
    meshMode: "glass",
    particleOpacity: 0.26,
    particleSize: 0.032,
    rotation: 0.35,
    spread: 0.03,
    pulse: 0.055,
  },
  lattice: {
    cameraZ: 15.2,
    rootScale: 0.9,
    rootY: -0.14,
    meshOpacity: 0.08,
    edgeOpacity: 0.82,
    edgeWidth: 1,
    meshMode: "lattice",
    particleOpacity: 0.44,
    particleSize: 0.024,
    rotation: 0.56,
    spread: 0.16,
    pulse: 0.075,
    meteorCount: 0,
    waterOpacity: 0.1,
  },
  mirrorfall: {
    cameraZ: 15,
    rootScale: 0.91,
    rootY: -0.16,
    meshOpacity: 0.075,
    edgeOpacity: 0.86,
    edgeWidth: 1,
    meshMode: "lattice",
    particleOpacity: 0.42,
    particleSize: 0.023,
    rotation: 0.52,
    spread: 0.15,
    pulse: 0.07,
    meteorCount: 38,
    meteorOpacity: 0.98,
    meteorSize: 0.07,
    meteorSpeed: 0.72,
    meteorSlant: -0.42,
    meteorTrail: 0.58,
    reflectionStrength: 0.42,
    waterOpacity: 0.2,
  },
  skimmers: {
    cameraZ: 14.4,
    rootScale: 0.88,
    rootY: -0.18,
    meshOpacity: 0.065,
    edgeOpacity: 0.78,
    edgeWidth: 1,
    meshMode: "lattice",
    particleOpacity: 0.5,
    particleSize: 0.021,
    rotation: 0.62,
    spread: 0.2,
    pulse: 0.082,
    meteorCount: 54,
    meteorOpacity: 0.96,
    meteorSize: 0.052,
    meteorSpeed: 1,
    meteorSlant: -0.18,
    meteorTrail: 0.44,
    reflectionStrength: 0.56,
    waterOpacity: 0.28,
  },
  downpour: {
    cameraZ: 16,
    rootScale: 0.86,
    rootY: -0.12,
    meshOpacity: 0.055,
    edgeOpacity: 0.7,
    edgeWidth: 1,
    meshMode: "lattice",
    particleOpacity: 0.58,
    particleSize: 0.02,
    rotation: 0.46,
    spread: 0.12,
    pulse: 0.065,
    meteorCount: 84,
    meteorOpacity: 1,
    meteorSize: 0.044,
    meteorSpeed: 1.2,
    meteorSlant: -0.62,
    meteorTrail: 0.5,
    reflectionStrength: 0.5,
    waterOpacity: 0.34,
  },
  etched: {
    cameraZ: 14.8,
    rootScale: 0.94,
    rootY: -0.12,
    meshOpacity: 0.018,
    edgeOpacity: 0.28,
    edgeWidth: 1,
    meshMode: "lattice",
    particleOpacity: 0.24,
    particleSize: 0.018,
    rotation: 0.34,
    spread: 0.18,
    pulse: 0.026,
    meteorCount: 0,
    waterOpacity: 0.18,
    sketch: true,
    sketchColor: 0xf0d2a4,
    scratchOpacity: 0.82,
    hatchOpacity: 0.42,
    hatchDensity: 0.9,
  },
  inkfall: {
    cameraZ: 15.3,
    rootScale: 0.91,
    rootY: -0.14,
    meshOpacity: 0.02,
    edgeOpacity: 0.24,
    edgeWidth: 1,
    meshMode: "lattice",
    particleOpacity: 0.28,
    particleSize: 0.018,
    rotation: 0.42,
    spread: 0.18,
    pulse: 0.035,
    meteorCount: 46,
    meteorOpacity: 0.94,
    meteorSize: 0.055,
    meteorSpeed: 0.78,
    meteorSlant: -0.36,
    meteorTrail: 0.42,
    reflectionStrength: 0.48,
    waterOpacity: 0.3,
    sketch: true,
    sketchColor: 0xf4d6a5,
    scratchOpacity: 0.86,
    hatchOpacity: 0.38,
    hatchDensity: 0.8,
  },
  chalkwater: {
    cameraZ: 15.8,
    rootScale: 0.9,
    rootY: -0.1,
    meshOpacity: 0.024,
    edgeOpacity: 0.2,
    edgeWidth: 1,
    meshMode: "lattice",
    particleOpacity: 0.34,
    particleSize: 0.017,
    rotation: 0.3,
    spread: 0.12,
    pulse: 0.02,
    meteorCount: 72,
    meteorOpacity: 0.9,
    meteorSize: 0.046,
    meteorSpeed: 0.58,
    meteorSlant: -0.58,
    meteorTrail: 0.34,
    reflectionStrength: 0.62,
    waterOpacity: 0.42,
    sketch: true,
    sketchColor: 0xe7c99a,
    scratchOpacity: 0.95,
    hatchOpacity: 0.54,
    hatchDensity: 1,
  },
};

Object.assign(presets, {
  chalkwater01: {
    cameraZ: 15.8,
    rootScale: 0.9,
    rootY: -0.1,
    meshOpacity: 0.024,
    edgeOpacity: 0.2,
    edgeWidth: 1,
    meshMode: "lattice",
    particleOpacity: 0.06,
    particleSize: 0.01,
    rotation: 0.28,
    spread: 0.12,
    pulse: 0.018,
    meteorCount: 0,
    waterOpacity: 0.34,
    sketch: true,
    sketchColor: 0xe7c99a,
    scratchOpacity: 0.9,
    hatchOpacity: 0.5,
    hatchDensity: 1,
  },
  chalkwater02: {
    cameraZ: 15.4,
    rootScale: 0.92,
    rootY: -0.08,
    meshOpacity: 0.02,
    edgeOpacity: 0.18,
    edgeWidth: 1,
    meshMode: "lattice",
    particleOpacity: 0.05,
    particleSize: 0.01,
    rotation: 0.24,
    spread: 0.1,
    pulse: 0.014,
    meteorCount: 0,
    waterOpacity: 0.26,
    sketch: true,
    sketchColor: 0xf1d3a2,
    scratchOpacity: 0.96,
    hatchOpacity: 0.72,
    hatchDensity: 1.28,
  },
  chalkwater03: {
    cameraZ: 16.2,
    rootScale: 0.86,
    rootY: -0.14,
    meshOpacity: 0.016,
    edgeOpacity: 0.14,
    edgeWidth: 1,
    meshMode: "lattice",
    particleOpacity: 0.04,
    particleSize: 0.009,
    rotation: 0.2,
    spread: 0.16,
    pulse: 0.012,
    meteorCount: 0,
    waterOpacity: 0.22,
    sketch: true,
    sketchColor: 0xdcc69b,
    scratchOpacity: 0.72,
    hatchOpacity: 0.34,
    hatchDensity: 0.82,
  },
  chalkwater04: {
    cameraZ: 14.9,
    rootScale: 0.96,
    rootY: -0.06,
    meshOpacity: 0.032,
    edgeOpacity: 0.28,
    edgeWidth: 1,
    meshMode: "lattice",
    particleOpacity: 0.05,
    particleSize: 0.01,
    rotation: 0.18,
    spread: 0.08,
    pulse: 0.012,
    meteorCount: 0,
    waterOpacity: 0.3,
    sketch: true,
    sketchColor: 0xffd9a3,
    scratchOpacity: 1,
    hatchOpacity: 0.62,
    hatchDensity: 1.1,
  },
  chalkwater05: {
    cameraZ: 17.1,
    rootScale: 0.98,
    rootY: -0.18,
    meshOpacity: 0.018,
    edgeOpacity: 0.18,
    edgeWidth: 1,
    meshMode: "lattice",
    particleOpacity: 0.05,
    particleSize: 0.01,
    rotation: 0.22,
    spread: 0.28,
    pulse: 0.016,
    meteorCount: 0,
    waterOpacity: 0.38,
    sketch: true,
    sketchColor: 0xe9c896,
    scratchOpacity: 0.88,
    hatchOpacity: 0.42,
    hatchDensity: 0.9,
  },
  chalkwater06: {
    cameraZ: 15.6,
    rootScale: 0.84,
    rootY: -0.08,
    meshOpacity: 0.028,
    edgeOpacity: 0.24,
    edgeWidth: 1,
    meshMode: "lattice",
    particleOpacity: 0.07,
    particleSize: 0.011,
    rotation: 0.32,
    spread: 0.04,
    pulse: 0.028,
    meteorCount: 0,
    waterOpacity: 0.28,
    sketch: true,
    sketchColor: 0xf0cca0,
    scratchOpacity: 0.94,
    hatchOpacity: 0.58,
    hatchDensity: 1,
  },
  chalkwater07: {
    cameraZ: 16,
    rootScale: 0.88,
    rootY: -0.22,
    meshOpacity: 0.02,
    edgeOpacity: 0.2,
    edgeWidth: 1,
    meshMode: "lattice",
    particleOpacity: 0.08,
    particleSize: 0.01,
    rotation: 0.26,
    spread: 0.18,
    pulse: 0.02,
    meteorCount: 0,
    waterOpacity: 0.55,
    sketch: true,
    sketchColor: 0xe2c393,
    scratchOpacity: 0.86,
    hatchOpacity: 0.46,
    hatchDensity: 0.94,
  },
  chalkwater08: {
    cameraZ: 15.2,
    rootScale: 0.91,
    rootY: -0.1,
    meshOpacity: 0.022,
    edgeOpacity: 0.22,
    edgeWidth: 1,
    meshMode: "lattice",
    particleOpacity: 0.04,
    particleSize: 0.009,
    rotation: 0.16,
    spread: 0.13,
    pulse: 0.01,
    meteorCount: 0,
    waterOpacity: 0.2,
    sketch: true,
    sketchColor: 0xffe0ad,
    scratchOpacity: 1,
    hatchOpacity: 0.5,
    hatchDensity: 0.86,
  },
  chalkwater09: {
    cameraZ: 16.5,
    rootScale: 0.82,
    rootY: -0.16,
    meshOpacity: 0.014,
    edgeOpacity: 0.12,
    edgeWidth: 1,
    meshMode: "lattice",
    particleOpacity: 0.03,
    particleSize: 0.008,
    rotation: 0.18,
    spread: 0.22,
    pulse: 0.012,
    meteorCount: 0,
    waterOpacity: 0.18,
    sketch: true,
    sketchColor: 0xd8c197,
    scratchOpacity: 0.68,
    hatchOpacity: 0.3,
    hatchDensity: 0.72,
  },
});

let activePreset = "chalkwater01";
let timeScale = Number(speedControl.value);
let opacityScale = Number(opacityControl.value);
let paused = false;

function jitteredPoint(point, amount) {
  return new THREE.Vector3(
    point.x + (Math.random() - 0.5) * amount,
    point.y + (Math.random() - 0.5) * amount,
    point.z + (Math.random() - 0.5) * amount
  );
}

function makeScratchEdgeGeometry(sourceGeometry, copies, jitter) {
  const base = new THREE.EdgesGeometry(sourceGeometry);
  const source = base.attributes.position;
  const points = [];

  for (let i = 0; i < source.count; i += 2) {
    const a = new THREE.Vector3().fromBufferAttribute(source, i);
    const b = new THREE.Vector3().fromBufferAttribute(source, i + 1);
    for (let copy = 0; copy < copies; copy++) {
      points.push(jitteredPoint(a, jitter));
      points.push(jitteredPoint(b, jitter));
    }
  }

  base.dispose();
  return new THREE.BufferGeometry().setFromPoints(points);
}

function makeHatchGeometry(sourceGeometry, density, jitter) {
  const geometry = sourceGeometry.index ? sourceGeometry.clone().toNonIndexed() : sourceGeometry.clone();
  const position = geometry.attributes.position;
  const points = [];
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpC = new THREE.Vector3();
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const linesPerFace = Math.max(5, Math.round(9 * density));

  for (let i = 0; i < position.count; i += 3) {
    tmpA.fromBufferAttribute(position, i);
    tmpB.fromBufferAttribute(position, i + 1);
    tmpC.fromBufferAttribute(position, i + 2);

    for (let line = 1; line <= linesPerFace; line++) {
      const t = line / (linesPerFace + 1);
      start.copy(tmpA).lerp(tmpC, t);
      end.copy(tmpB).lerp(tmpC, t);
      start.lerp(end, 0.08);
      end.lerp(start, 0.08);
      points.push(jitteredPoint(start, jitter));
      points.push(jitteredPoint(end, jitter));
    }
  }

  geometry.dispose();
  return new THREE.BufferGeometry().setFromPoints(points);
}

const solids = shapeSpecs.map((spec, index) => {
  const group = new THREE.Group();
  group.name = spec.label;
  group.rotation.copy(spec.rotation);
  group.scale.setScalar(spec.scale);
  group.position.z = -index * 0.16;

  const meshMaterial = new THREE.MeshPhysicalMaterial({
    color: spec.color,
    transparent: true,
    opacity: 0.08,
    roughness: 0.42,
    metalness: 0.05,
    transmission: 0.18,
    thickness: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(spec.geometry, meshMaterial);
  group.add(mesh);

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: spec.color,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
  });

  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(spec.geometry), edgeMaterial);
  group.add(edges);

  const scratchMaterial = new THREE.LineBasicMaterial({
    color: 0xcbb891,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const scratch = new THREE.LineSegments(makeScratchEdgeGeometry(spec.geometry, 3, 0.018), scratchMaterial);
  scratch.visible = false;
  group.add(scratch);

  const hatchMaterial = new THREE.LineBasicMaterial({
    color: 0xcbb891,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const hatch = new THREE.LineSegments(makeHatchGeometry(spec.geometry, 1, 0.01), hatchMaterial);
  hatch.visible = false;
  group.add(hatch);

  root.add(group);
  return { spec, group, mesh, edges, scratch, hatch, index };
});

const particleGeometry = new THREE.BufferGeometry();
const particleCount = 420;
const particlePositions = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount; i++) {
  const radius = 3 + Math.random() * 8.6;
  const theta = Math.random() * Math.PI * 2;
  const y = (Math.random() - 0.5) * 7.4;
  particlePositions[i * 3] = Math.cos(theta) * radius;
  particlePositions[i * 3 + 1] = y;
  particlePositions[i * 3 + 2] = Math.sin(theta) * radius - 2.2;
}

particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

const particleMaterial = new THREE.PointsMaterial({
  color: 0x9fe8d2,
  size: 0.026,
  transparent: true,
  opacity: 0.34,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

const waterLines = makeWaterLines();
reflectionRoot.add(waterLines);

const nebulaPlanes = [
  makeNebula(0x3fb98a, -5.3, 2.3, -9, 5.8, 0.18),
  makeNebula(0x357cb0, 4.4, -1.8, -10, 7.4, 0.14),
  makeNebula(0xa56eff, 0.8, 3.4, -11, 6.8, 0.1),
];

nebulaPlanes.forEach((plane) => glowRoot.add(plane));

const meteorPalette = [0x6fe3b0, 0x8fd3ff, 0xffd166, 0xc9a6ff, 0xff9e7a];
const meteorGeometryFactories = [
  () => new THREE.TetrahedronGeometry(1, 0),
  () => new THREE.BoxGeometry(1.2, 1.2, 1.2),
  () => new THREE.OctahedronGeometry(1, 0),
  () => new THREE.DodecahedronGeometry(0.9, 0),
  () => new THREE.IcosahedronGeometry(0.92, 0),
];

const meteorPool = Array.from({ length: 90 }, (_, index) => makeMeteor(index));
meteorPool.forEach((meteor) => meteorRoot.add(meteor.group));

function makeNebula(color, x, y, z, size, opacity) {
  const texture = makeSoftTexture(color);
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, y, z);
  sprite.scale.set(size, size * 0.68, 1);
  return sprite;
}

function makeSoftTexture(color) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 128;
  textureCanvas.height = 128;
  const context = textureCanvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  const c = new THREE.Color(color);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.32)`);
  gradient.addColorStop(0.52, `rgba(${r}, ${g}, ${b}, 0.12)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(textureCanvas);
  if ("colorSpace" in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else {
    texture.encoding = THREE.sRGBEncoding;
  }
  return texture;
}

function makeWaterLines() {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: 0x8fd3ff,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  for (let i = 0; i < 34; i++) {
    const y = -2.25 - i * 0.055;
    const z = -4.5 - i * 0.09;
    const width = 2.5 + Math.random() * 6.8;
    const x = (Math.random() - 0.5) * 8;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x - width * 0.5, y, z),
      new THREE.Vector3(x + width * 0.5, y + (Math.random() - 0.5) * 0.025, z),
    ]);
    const line = new THREE.Line(geometry, material.clone());
    line.material.opacity = 0.03 + Math.random() * 0.11;
    line.userData.phase = Math.random() * Math.PI * 2;
    line.userData.baseOpacity = line.material.opacity;
    group.add(line);
  }

  return group;
}

function makeMeteor(index) {
  const color = meteorPalette[index % meteorPalette.length];
  const geometry = meteorGeometryFactories[index % meteorGeometryFactories.length]();
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.2,
    roughness: 0.36,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);

  const trailMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const trailGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-1.2, -0.12, 0),
  ]);
  const trail = new THREE.Line(trailGeometry, trailMaterial);

  const reflectionMaterial = new THREE.LineBasicMaterial({
    color: 0x9ddfff,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const reflectionGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-1.4, 0.04, 0),
  ]);
  const reflection = new THREE.Line(reflectionGeometry, reflectionMaterial);

  const group = new THREE.Group();
  group.add(mesh, trail, reflection);
  group.visible = false;

  return {
    group,
    mesh,
    trail,
    reflection,
    color,
    seed: Math.random() * 100,
    lane: Math.random(),
    shapeIndex: index % meteorGeometryFactories.length,
  };
}

function placeMeteor(meteor, preset, seconds) {
  const bodyColor = preset.sketch ? (preset.sketchColor || 0xcbb891) : meteor.color;
  const cycle = 7.5 / preset.meteorSpeed;
  const phase = (seconds * preset.meteorSpeed + meteor.seed) % cycle;
  const progress = phase / cycle;
  const x = -8.5 + progress * 17.5;
  const y = 4.3 - progress * (5.1 + preset.meteorSlant * -1.35) + (meteor.lane - 0.5) * 5.4;
  const z = -4.5 - meteor.lane * 6.5;
  const slant = preset.meteorSlant;
  const size = preset.meteorSize * (0.78 + meteor.lane * 0.55);
  const fadeIn = THREE.MathUtils.clamp(progress * 8, 0, 1);
  const fadeOut = THREE.MathUtils.clamp((1 - progress) * 8, 0, 1);
  const alpha = Math.min(fadeIn, fadeOut) * preset.meteorOpacity;

  meteor.group.visible = true;
  meteor.group.position.set(x, y, z);
  meteor.mesh.scale.setScalar(size);
  meteor.mesh.rotation.set(
    seconds * (0.8 + meteor.lane),
    seconds * (1.4 + meteor.shapeIndex * 0.13),
    seconds * 0.6
  );
  meteor.mesh.material.color.setHex(bodyColor);
  meteor.mesh.material.emissive.setHex(bodyColor);
  meteor.mesh.material.opacity = alpha;

  const tail = preset.meteorTrail * (1.2 + meteor.lane);
  const trailPositions = meteor.trail.geometry.attributes.position;
  trailPositions.setXYZ(0, 0, 0, 0);
  trailPositions.setXYZ(1, -tail, slant * tail, 0);
  trailPositions.needsUpdate = true;
  meteor.trail.material.color.setHex(bodyColor);
  meteor.trail.material.opacity = alpha * 0.52;

  const reflectedY = -2.35 - Math.abs(y + 1.25) * 0.16;
  meteor.reflection.position.set(0, reflectedY - y, 0.04);
  meteor.reflection.scale.set(1.25, 0.18, 1);
  const reflectionPositions = meteor.reflection.geometry.attributes.position;
  reflectionPositions.setXYZ(0, 0, 0, 0);
  reflectionPositions.setXYZ(1, -tail * 1.35, -slant * tail * 0.2, 0);
  reflectionPositions.needsUpdate = true;
  meteor.reflection.material.color.setHex(preset.sketch ? bodyColor : 0x9ddfff);
  meteor.reflection.material.opacity = alpha * preset.reflectionStrength;
}

function applyPreset(name) {
  activePreset = name;
  const preset = presets[name];
  const sketchColor = preset.sketchColor || 0xcbb891;
  camera.position.z = preset.cameraZ;
  root.scale.setScalar(preset.rootScale);
  root.position.y = preset.rootY;
  particleMaterial.opacity = preset.particleOpacity;
  particleMaterial.size = preset.particleSize;
  reflectionRoot.visible = (preset.meteorCount || 0) > 0 || !!preset.sketch;
  waterLines.children.forEach((line) => {
    line.material.opacity = line.userData.baseOpacity * (preset.waterOpacity || 0);
  });
  meteorPool.forEach((meteor, index) => {
    meteor.group.visible = index < (preset.meteorCount || 0);
  });

  solids.forEach((solid) => {
    const depthBoost = 1 - solid.index * 0.08;
    solid.mesh.material.opacity = preset.meshOpacity * opacityScale * depthBoost;
    solid.edges.material.opacity = preset.edgeOpacity * opacityScale * depthBoost;
    solid.mesh.material.color.setHex(preset.sketch ? sketchColor : solid.spec.color);
    solid.edges.material.color.setHex(preset.sketch ? sketchColor : solid.spec.color);
    solid.mesh.material.wireframe = preset.meshMode === "wire";
    solid.mesh.material.transmission = preset.meshMode === "glass" ? 0.24 : 0.04;
    solid.mesh.material.roughness = preset.meshMode === "glass" ? 0.25 : 0.55;
    solid.scratch.visible = !!preset.sketch;
    solid.hatch.visible = !!preset.sketch;
    solid.scratch.material.color.setHex(sketchColor);
    solid.hatch.material.color.setHex(sketchColor);
    solid.scratch.material.opacity = (preset.scratchOpacity || 0) * opacityScale * depthBoost;
    solid.hatch.material.opacity = (preset.hatchOpacity || 0) * opacityScale * depthBoost * (preset.hatchDensity || 1);
    solid.group.position.x = Math.sin(solid.index * 1.7) * preset.spread;
    solid.group.position.y = Math.cos(solid.index * 1.4) * preset.spread * 0.5;
  });

  presetButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.preset === name);
  });
}

window.platonicPrototype = {
  getState() {
    return {
      preset: activePreset,
      paused,
      speed: timeScale,
      opacity: opacityScale,
      meteors: presets[activePreset].meteorCount || 0,
      sketch: !!presets[activePreset].sketch,
      solids: solids.map((solid) => solid.spec.id),
    };
  },
  sampleCenterPixel() {
    const gl = renderer.getContext();
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const pixel = new Uint8Array(4);
    gl.readPixels(
      Math.floor(size.x / 2),
      Math.floor(size.y / 2),
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixel
    );
    return Array.from(pixel);
  },
};

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animate(now) {
  requestAnimationFrame(animate);
  const seconds = now * 0.001;
  const preset = presets[activePreset];
  const motion = paused ? 0 : seconds * timeScale;

  root.rotation.y = motion * 0.08;
  root.rotation.x = Math.sin(motion * 0.11) * 0.08;
  glowRoot.rotation.z = seconds * 0.014;
  reflectionRoot.rotation.z = Math.sin(seconds * 0.035) * 0.018;
  particles.rotation.y = seconds * 0.018;
  particles.rotation.x = Math.sin(seconds * 0.09) * 0.04;
  waterLines.children.forEach((line) => {
    line.material.opacity = line.userData.baseOpacity * (preset.waterOpacity || 0) *
      (0.62 + Math.sin(seconds * 0.8 + line.userData.phase) * 0.38);
  });

  solids.forEach((solid) => {
    const amount = motion * preset.rotation * (1 - solid.index * 0.08);
    solid.group.setRotationFromAxisAngle(solid.spec.axis, amount);
    solid.group.rotateX(solid.spec.rotation.x);
    solid.group.rotateY(solid.spec.rotation.y);
    solid.group.rotateZ(solid.spec.rotation.z);
    const pulse = 1 + Math.sin(seconds * 0.42 + solid.index) * preset.pulse;
    solid.group.scale.setScalar(solid.spec.scale * pulse);
  });

  meteorPool.forEach((meteor, index) => {
    if (index < (preset.meteorCount || 0)) {
      placeMeteor(meteor, preset, paused ? 0 : seconds);
    } else {
      meteor.group.visible = false;
    }
  });

  renderer.render(scene, camera);
}

presetButtons.forEach((button) => {
  button.addEventListener("click", () => applyPreset(button.dataset.preset));
});

speedControl.addEventListener("input", () => {
  timeScale = Number(speedControl.value);
});

opacityControl.addEventListener("input", () => {
  opacityScale = Number(opacityControl.value);
  applyPreset(activePreset);
});

pauseControl.addEventListener("change", () => {
  paused = pauseControl.checked;
});

window.addEventListener("resize", resize);

resize();
applyPreset(activePreset);
requestAnimationFrame(animate);
