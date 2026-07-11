/* =========================================================================
 * platonic-background.js — WebGL Ripple Draft background.
 * Purely visual: no game-state reads/writes beyond G.config.
 * ========================================================================= */

(function () {
  "use strict";

  const cfg = G.config.platonicBackground;
  const B = (G.platonicBackground = {});

  if (!cfg || !cfg.enabled) {
    console.warn("[platonic-background] disabled or missing config — background will not render", cfg);
    return;
  }

  let canvas, renderer, scene, camera, root, glowRoot, reflectionRoot, particles;
  let solids = [];
  let waterLines = [];
  let started = false;

  function hexNumber(hex) {
    return parseInt(String(hex).replace("#", ""), 16);
  }

  function colorObject(hex) {
    return new THREE.Color(hexNumber(hex));
  }

  function vectorFromArray(values) {
    return new THREE.Vector3(values[0], values[1], values[2]);
  }

  function jitteredPoint(point, amount) {
    return new THREE.Vector3(
      point.x + (Math.random() - 0.5) * amount,
      point.y + (Math.random() - 0.5) * amount,
      point.z + (Math.random() - 0.5) * amount
    );
  }

  function makeGeometry(type) {
    switch (type) {
      case "tetrahedron": return new THREE.TetrahedronGeometry(1.08, 0);
      case "cube": return new THREE.BoxGeometry(1.62, 1.62, 1.62);
      case "octahedron": return new THREE.OctahedronGeometry(1.62, 0);
      case "dodecahedron": return new THREE.DodecahedronGeometry(1.5, 0);
      case "icosahedron": return new THREE.IcosahedronGeometry(1.5, 0);
      default: return new THREE.IcosahedronGeometry(1.5, 0);
    }
  }

  function makeScratchEdgeGeometry(sourceGeometry) {
    const base = new THREE.EdgesGeometry(sourceGeometry);
    const source = base.attributes.position;
    const points = [];
    for (let i = 0; i < source.count; i += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(source, i);
      const b = new THREE.Vector3().fromBufferAttribute(source, i + 1);
      for (let copy = 0; copy < cfg.sketch.scratchCopies; copy++) {
        points.push(jitteredPoint(a, cfg.sketch.scratchJitter));
        points.push(jitteredPoint(b, cfg.sketch.scratchJitter));
      }
    }
    base.dispose();
    return new THREE.BufferGeometry().setFromPoints(points);
  }

  function makeHatchGeometry(sourceGeometry) {
    const geometry = sourceGeometry.index ? sourceGeometry.clone().toNonIndexed() : sourceGeometry.clone();
    const position = geometry.attributes.position;
    const points = [];
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const start = new THREE.Vector3();
    const end = new THREE.Vector3();
    const linesPerFace = Math.max(5, Math.round(9 * cfg.sketch.hatchDensity));

    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i);
      b.fromBufferAttribute(position, i + 1);
      c.fromBufferAttribute(position, i + 2);

      for (let line = 1; line <= linesPerFace; line++) {
        const t = line / (linesPerFace + 1);
        start.copy(a).lerp(c, t);
        end.copy(b).lerp(c, t);
        start.lerp(end, 0.08);
        end.lerp(start, 0.08);
        points.push(jitteredPoint(start, cfg.sketch.hatchJitter));
        points.push(jitteredPoint(end, cfg.sketch.hatchJitter));
      }
    }

    geometry.dispose();
    return new THREE.BufferGeometry().setFromPoints(points);
  }

  function makeSoftTexture(hex) {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 128;
    textureCanvas.height = 128;
    const context = textureCanvas.getContext("2d");
    const c = colorObject(hex);
    const r = Math.round(c.r * 255);
    const g = Math.round(c.g * 255);
    const b = Math.round(c.b * 255);
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(" + r + "," + g + "," + b + ",0.32)");
    gradient.addColorStop(0.52, "rgba(" + r + "," + g + "," + b + ",0.12)");
    gradient.addColorStop(1, "rgba(" + r + "," + g + "," + b + ",0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function buildSolids() {
    const sketchColor = hexNumber(cfg.sketch.color);
    solids = cfg.solids.map((spec, index) => {
      const geometry = makeGeometry(spec.type);
      const group = new THREE.Group();
      const rotation = vectorFromArray(spec.rotation);
      group.rotation.set(rotation.x, rotation.y, rotation.z);
      group.scale.setScalar(spec.scale);
      group.position.z = -index * 0.16;

      const depthBoost = 1 - index * 0.08;
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color: sketchColor,
        transparent: true,
        opacity: cfg.sketch.meshOpacity * depthBoost,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }));
      group.add(mesh);

      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({
        color: sketchColor,
        transparent: true,
        opacity: cfg.sketch.edgeOpacity * depthBoost,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      group.add(edges);

      const scratch = new THREE.LineSegments(makeScratchEdgeGeometry(geometry), new THREE.LineBasicMaterial({
        color: sketchColor,
        transparent: true,
        opacity: cfg.sketch.scratchOpacity * depthBoost,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      group.add(scratch);

      const hatch = new THREE.LineSegments(makeHatchGeometry(geometry), new THREE.LineBasicMaterial({
        color: sketchColor,
        transparent: true,
        opacity: cfg.sketch.hatchOpacity * depthBoost,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      group.add(hatch);

      root.add(group);
      return {
        axis: vectorFromArray(spec.axis).normalize(),
        group,
        index,
        rotation,
        scale: spec.scale,
      };
    });
  }

  function buildParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(cfg.particles.count * 3);
    for (let i = 0; i < cfg.particles.count; i++) {
      const radius = cfg.particles.radiusMin + Math.random() * (cfg.particles.radiusMax - cfg.particles.radiusMin);
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * cfg.particles.ySpread;
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * radius + cfg.particles.zOffset;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particles = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: hexNumber(cfg.particles.color),
      size: cfg.particles.size,
      transparent: true,
      opacity: cfg.particles.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    scene.add(particles);
  }

  function buildWaterLines() {
    const waterColor = hexNumber(cfg.water.color);
    for (let i = 0; i < cfg.water.lineCount; i++) {
      const y = cfg.water.baseY - i * cfg.water.yStep;
      const z = cfg.water.baseZ - i * cfg.water.zStep;
      const width = cfg.water.minWidth + Math.random() * (cfg.water.maxWidth - cfg.water.minWidth);
      const x = (Math.random() - 0.5) * cfg.water.xSpread;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x - width * 0.5, y, z),
        new THREE.Vector3(x + width * 0.5, y + (Math.random() - 0.5) * 0.025, z),
      ]);
      const baseOpacity = 0.03 + Math.random() * 0.11;
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
        color: waterColor,
        transparent: true,
        opacity: baseOpacity * cfg.water.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      line.userData.phase = Math.random() * Math.PI * 2;
      line.userData.baseOpacity = baseOpacity;
      reflectionRoot.add(line);
      waterLines.push(line);
    }
  }

  function buildNebulas() {
    cfg.nebulas.forEach((def) => {
      const material = new THREE.SpriteMaterial({
        map: makeSoftTexture(def.color),
        color: hexNumber(def.color),
        transparent: true,
        opacity: def.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(def.x, def.y, def.z);
      sprite.scale.set(def.width, def.width * def.heightScale, 1);
      glowRoot.add(sprite);
    });
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function animate(now) {
    if (!started) return;
    requestAnimationFrame(animate);
    const seconds = now * 0.001;
    const motion = seconds * cfg.motion.speed;

    root.rotation.y = motion * cfg.root.rotateY;
    root.rotation.x = Math.sin(motion * cfg.root.wobbleSpeed) * cfg.root.rotateX;
    glowRoot.rotation.z = seconds * cfg.motion.glowDrift;
    reflectionRoot.rotation.z = Math.sin(seconds * cfg.water.rotationSpeed) * cfg.water.rotationAmount;
    particles.rotation.y = seconds * cfg.particles.rotateY;
    particles.rotation.x = Math.sin(seconds * cfg.particles.rotateXSpeed) * cfg.particles.rotateX;

    waterLines.forEach((line) => {
      line.material.opacity = line.userData.baseOpacity * cfg.water.opacity *
        (0.62 + Math.sin(seconds * cfg.water.shimmerSpeed + line.userData.phase) * 0.38);
    });

    solids.forEach((solid) => {
      const amount = motion * cfg.motion.shapeRotation * (1 - solid.index * 0.08);
      solid.group.rotation.set(
        solid.rotation.x + solid.axis.x * amount,
        solid.rotation.y + solid.axis.y * amount,
        solid.rotation.z + solid.axis.z * amount
      );
      const pulse = 1 + Math.sin(seconds * 0.42 + solid.index) * cfg.motion.pulse;
      solid.group.scale.setScalar(solid.scale * pulse);
    });

    renderer.render(scene, camera);
  }

  B.init = function () {
    if (started) return;
    if (typeof THREE === "undefined") {
      console.warn("[platonic-background] THREE is undefined — CDN and vendor fallback both failed to load");
      return;
    }
    canvas = document.getElementById(cfg.canvasId);
    if (!canvas) {
      console.warn("[platonic-background] canvas #" + cfg.canvasId + " not found in DOM");
      return;
    }

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(hexNumber(cfg.clearColor), 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cfg.pixelRatioMax));

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(hexNumber(cfg.fogColor), cfg.fogDensity);

    camera = new THREE.PerspectiveCamera(cfg.camera.fov, 1, cfg.camera.near, cfg.camera.far);
    camera.position.set(0, cfg.camera.y, cfg.camera.z);

    root = new THREE.Group();
    root.scale.setScalar(cfg.root.scale);
    root.position.y = cfg.root.y;
    scene.add(root);

    glowRoot = new THREE.Group();
    scene.add(glowRoot);

    reflectionRoot = new THREE.Group();
    scene.add(reflectionRoot);

    scene.add(new THREE.AmbientLight(0x6d8da0, 0.55));
    const keyLight = new THREE.DirectionalLight(0xb8fff0, 1.25);
    keyLight.position.set(-4, 5, 8);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x70a7ff, 0.72);
    rimLight.position.set(5, -2, -7);
    scene.add(rimLight);

    buildSolids();
    buildParticles();
    buildWaterLines();
    buildNebulas();
    resize();
    // Some browsers haven't settled on a real viewport size by the time this
    // runs (window.innerWidth/innerHeight can read as a transient sliver),
    // so re-check shortly after layout has had a chance to catch up.
    setTimeout(resize, 0);
    setTimeout(resize, 250);

    window.addEventListener("resize", resize);
    started = true;
    requestAnimationFrame(animate);
    console.info("[platonic-background] started OK — canvas " + canvas.width + "x" + canvas.height +
      ", solids=" + solids.length + ", camera z=" + camera.position.z);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", B.init);
  } else {
    B.init();
  }
})();
