/* =========================================================================
 * render.js — the canvas "stage": the primordial soup, drifting chemistry
 * particles, and a distinct visual for each energy event (lightning, UV,
 * bubbles, volcanism, meteor). Pure visuals + click routing; it never mutates
 * game balance, only calls G.engine.strike() on input.
 *
 * Uses requestAnimationFrame (smooth; pauses when the tab is hidden — logic
 * keeps running on the engine's setInterval instead).
 * ========================================================================= */

(function () {
  "use strict";
  const cfg = G.config;
  const R = (G.render = {});

  let canvas, ctx, W = 0, H = 0, dpr = 1;
  let cx = 0, cy = 0;
  let particles = [];
  let clouds = [];
  const fx = { bolts: [], pulses: [], flashes: [], meteors: [], plumes: [], bubbles: [], rays: [], texts: [] };
  let t0 = performance.now();

  function rand(a, b) { return a + Math.random() * (b - a); }

  function hexRGB(hex) {
    const h = hex.replace("#", "");
    return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
  }
  function hexA(hex, a) {
    const [r, g, b] = hexRGB(hex);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  /* ---- optional sprite textures (assets/fx/*.png) ------------------------
   * Any energy event may declare `sprite:"foo.png"` in config.energyEvents.table.
   * If that file exists it is drawn — tinted to the event color and blended
   * additively ("lighter") — in place of the procedural shape. If the file is
   * missing or still decoding, the procedural fallback in drawEffects runs
   * instead, so the game never breaks on an absent asset. Author sprites as a
   * single ~256px, near-WHITE image on full transparency (no colour, no frames):
   * the code supplies motion, size and colour. See assets/fx/README.md. ---- */
  const sprites = {};        // filename -> HTMLImageElement (may still be loading)
  const tintCanvases = {};   // "filename|#color" -> tinted offscreen canvas

  function loadSprite(name) {
    if (!name || sprites[name]) return;
    const img = new Image();
    img.src = "assets/fx/" + name;
    sprites[name] = img;
  }

  // A colour-tinted copy of the sprite, cached per (file,colour); null if not ready.
  function tintedSprite(name, color) {
    const img = sprites[name];
    if (!img || !img.complete || !img.naturalWidth) return null;
    const key = name + "|" + color;
    let c = tintCanvases[key];
    if (!c) {
      c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const cc = c.getContext("2d");
      cc.drawImage(img, 0, 0);
      cc.globalCompositeOperation = "source-in";  // keep alpha, repaint RGB as tint
      cc.fillStyle = color;
      cc.fillRect(0, 0, c.width, c.height);
      tintCanvases[key] = c;
    }
    return c;
  }

  // Stamp a (tinted) sprite canvas centred at (x,y), sized `size` px, blended additively.
  function stampSprite(cv, x, y, size, alpha, rot) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(cv, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2;
    cy = H * 0.5;
  }

  function initParticles() {
    particles = [];
    const n = Math.min(90, Math.floor((W * H) / 16000));
    const palette = cfg.resources.map((c) => c.color).concat(["#A7F3D0", "#9db8d6"]);
    for (let i = 0; i < n; i++) {
      particles.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: rand(-6, 6), vy: rand(-6, 6),
        r: rand(1, 3.2), a: rand(0.1, 0.5),
        c: palette[(Math.random() * palette.length) | 0],
      });
    }
    clouds = [];
    for (let i = 0; i < 5; i++) {
      clouds.push({
        x: Math.random() * W, y: Math.random() * H, r: rand(180, 360),
        vx: rand(-4, 4), vy: rand(-3, 3), hue: rand(150, 210),
      });
    }
  }

  /* ---- public: play the visual for a rolled energy event.
   * `outcome` is { size } for size-varied events (volcanic), { variant } for
   * variant-based events (meteor), or {} for plain events. ---- */
  R.playEvent = function (def, outcome, x, y) {
    if (x == null) { x = rand(W * 0.25, W * 0.75); y = rand(H * 0.3, H * 0.7); }
    const now = performance.now();
    const size = outcome && outcome.size;
    const variant = outcome && outcome.variant;
    const big = variant ? (variant.visualScale || 1)
      : size ? Math.min(3, (cfg.energyEvents.sizeMult[size] || 1) * 0.5) + 0.6
      : 1;
    const label = variant ? variant.name : (size ? size + " " + def.name : def.name);

    // shared: tinted flash + expanding ring + floating label
    fx.flashes.push({ born: now, dur: 260, color: hexRGB(def.color).join(","), max: 0.12 * big });
    fx.pulses.push({ born: now, x, y, color: def.color, scale: big });
    fx.texts.push({ born: now, x, y, msg: label, color: def.color });

    // Sprite name + colour ride along on each fx entry; drawEffects resolves the
    // tinted texture per frame (the image may still be loading now) and falls back
    // to the procedural draw when no sprite is available.
    const sprite = def.sprite, color = def.color;

    switch (def.id) {
      case "lightning":
        if (sprite) fx.bolts.push({ born: now, x, y, big, sprite, color });
        else R.addLightning(x, y);
        break;
      case "meteor": fx.meteors.push({ born: now, x, y, big, sprite, color, bloom: def.bloomSprite }); break;
      case "volcanic": fx.plumes.push({ born: now, x, y, big, sprite, color }); break;
      case "geothermal": fx.plumes.push({ born: now, x, y, big: big * 0.7, sprite, color }); break;
      case "cavitation": for (let i = 0; i < 10 * big; i++) fx.bubbles.push({ born: now + i * 20, x: x + rand(-30, 30), y, big, sprite, color }); break;
      case "uv": fx.rays.push({ born: now, x, y, big, sprite, color }); break;
      default: R.addLightning(x, y);
    }
  };

  R.addLightning = function (x, y) {
    const startX = rand(W * 0.2, W * 0.8);
    const segs = [{ x: startX, y: -20 }];
    const steps = 9;
    for (let i = 1; i <= steps; i++) {
      const tt = i / steps;
      const px = startX + (x - startX) * tt + rand(-40, 40) * (1 - tt);
      const py = -20 + (y + 20) * tt;
      segs.push({ x: px, y: py });
    }
    fx.bolts.push({ segs, born: performance.now() });
    fx.flashes.push({ born: performance.now(), dur: 220, color: "200,225,255", max: 0.28 });
  };

  /* ---- background ---- */
  function drawBackground(time) {
    ctx.clearRect(0, 0, W, H);

    const bg = cfg.platonicBackground || {};
    ctx.fillStyle = bg.stageWash || "rgba(5,8,13,0.18)";
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = "lighter";
    clouds.forEach((cl) => {
      cl.x += cl.vx * 0.016; cl.y += cl.vy * 0.016;
      if (cl.x < -cl.r) cl.x = W + cl.r; if (cl.x > W + cl.r) cl.x = -cl.r;
      if (cl.y < -cl.r) cl.y = H + cl.r; if (cl.y > H + cl.r) cl.y = -cl.r;
      const g = ctx.createRadialGradient(cl.x, cl.y, 0, cl.x, cl.y, cl.r);
      g.addColorStop(0, "hsla(" + cl.hue + ",60%,45%,0.10)");
      g.addColorStop(1, "hsla(" + cl.hue + ",60%,30%,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cl.x, cl.y, cl.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalCompositeOperation = "source-over";
  }

  function drawParticles() {
    particles.forEach((p) => {
      p.x += p.vx * 0.016; p.y += p.vy * 0.016;
      if (p.x < 0) p.x = W; else if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; else if (p.y > H) p.y = 0;
      ctx.globalAlpha = p.a; ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  /* ---- event effects ---- */
  function drawEffects(time) {
    // lightning bolts
    fx.bolts = fx.bolts.filter((b) => time - b.born < 360);
    fx.bolts.forEach((b) => {
      const age = (time - b.born) / 360;
      const cv = b.sprite && tintedSprite(b.sprite, b.color);
      if (cv) {
        // vertical bolt: sky (y≈-20) down to the impact point, fading out
        const h = b.y + 20, w = 90 * (b.big || 1);
        ctx.save();
        ctx.globalAlpha = 1 - age;
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(cv, b.x - w / 2, -20, w, h);
        ctx.restore();
        return;
      }
      ctx.strokeStyle = "rgba(100,247,210," + (1 - age) + ")";
      ctx.lineWidth = 3 * (1 - age) + 1;
      ctx.shadowColor = "rgba(56,189,248,0.9)"; ctx.shadowBlur = 16;
      ctx.beginPath();
      b.segs.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // meteors: streak from top-right into the impact point, then flash
    fx.meteors = fx.meteors.filter((m) => time - m.born < 900);
    fx.meteors.forEach((m) => {
      const age = (time - m.born) / 900;
      const sx = m.x + 260 * m.big, sy = m.y - 320 * m.big;
      const t = Math.min(1, age * 1.6);
      const hx = sx + (m.x - sx) * t, hy = sy + (m.y - sy) * t;
      const cv = m.sprite && tintedSprite(m.sprite, m.color);
      if (cv) {
        // meteor head streaking down the path; the art is already drawn facing its
        // travel (head down-left, tail up-right), so no runtime rotation is applied.
        stampSprite(cv, hx, hy, 90 * m.big, 1 - age, 0);
        if (t >= 1) {
          const bloom = m.bloom && tintedSprite(m.bloom, m.color);
          if (bloom) stampSprite(bloom, m.x, m.y, (age - 0.55) * 260 * m.big, (1 - age) * 0.8, age * 2);
          else stampSprite(cv, m.x, m.y, (age - 0.6) * 240 * m.big, (1 - age) * 0.5, 0);
        }
        return;
      }
      ctx.strokeStyle = "rgba(167,243,208," + (1 - age) + ")";
      ctx.lineWidth = 3 * m.big;
      ctx.shadowColor = "rgba(110,231,183,0.9)"; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.moveTo(sx + (hx - sx) * 0.6, sy + (hy - sy) * 0.6); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.shadowBlur = 0;
      if (t >= 1) {
        ctx.fillStyle = "rgba(185,232,214," + (1 - age) * 0.7 + ")";
        ctx.beginPath(); ctx.arc(m.x, m.y, (age - 0.6) * 120 * m.big, 0, Math.PI * 2); ctx.fill();
      }
    });

    // volcanic plumes: rising smoky column
    fx.plumes = fx.plumes.filter((p) => time - p.born < 1100);
    fx.plumes.forEach((p) => {
      const age = (time - p.born) / 1100;
      const cv = p.sprite && tintedSprite(p.sprite, p.color);
      if (cv) {
        // rising, expanding column anchored near the vent
        const rise = age * 90 * p.big, sz = (60 + age * 60) * p.big;
        stampSprite(cv, p.x, p.y - rise - sz * 0.3, sz, (1 - age) * 0.9, 0);
        return;
      }
      for (let i = 0; i < 6; i++) {
        const rise = age * 90 * p.big + i * 8;
        const r = (6 + i * 4) * p.big * (1 + age);
        ctx.fillStyle = "rgba(228,165,122," + (1 - age) * 0.18 + ")";
        ctx.beginPath(); ctx.arc(p.x + Math.sin(i + age * 3) * 12, p.y - rise, r, 0, Math.PI * 2); ctx.fill();
      }
    });

    // cavitation bubbles: rise & pop
    fx.bubbles = fx.bubbles.filter((b) => time - b.born < 800 && time >= b.born);
    fx.bubbles.forEach((b) => {
      const age = (time - b.born) / 800;
      const y = b.y - age * 60 * b.big;
      const cv = b.sprite && tintedSprite(b.sprite, b.color);
      if (cv) {
        stampSprite(cv, b.x, y, 12 + age * 14 * b.big, (1 - age) * 0.9, 0);
        return;
      }
      ctx.strokeStyle = "rgba(94,230,240," + (1 - age) * 0.8 + ")";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(b.x, y, 3 + age * 5 * b.big, 0, Math.PI * 2); ctx.stroke();
    });

    // UV shimmer: radiating rays
    fx.rays = fx.rays.filter((r) => time - r.born < 700);
    fx.rays.forEach((r) => {
      const age = (time - r.born) / 700;
      const cv = r.sprite && tintedSprite(r.sprite, r.color);
      if (cv) {
        // radiant burst: grows and slowly rotates as it fades
        stampSprite(cv, r.x, r.y, (60 + age * 80 * r.big), (1 - age) * 0.9, age * 1.2);
        return;
      }
      ctx.strokeStyle = "rgba(217,249,157," + (1 - age) * 0.6 + ")";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + age;
        const r1 = 10 + age * 30 * r.big, r2 = r1 + 18 * r.big;
        ctx.beginPath();
        ctx.moveTo(r.x + Math.cos(a) * r1, r.y + Math.sin(a) * r1);
        ctx.lineTo(r.x + Math.cos(a) * r2, r.y + Math.sin(a) * r2);
        ctx.stroke();
      }
    });

    // expanding rings
    fx.pulses = fx.pulses.filter((p) => time - p.born < 900);
    fx.pulses.forEach((p) => {
      const age = (time - p.born) / 900;
      const rr = (18 + age * 70) * (p.scale || 1);
      ctx.strokeStyle = hexA(p.color || "#A7F3D0", (1 - age) * 0.6);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.stroke();
    });

    // floating labels
    fx.texts = fx.texts.filter((tx) => time - tx.born < 1100);
    fx.texts.forEach((tx) => {
      const age = (time - tx.born) / 1100;
      ctx.fillStyle = hexA(tx.color, 1 - age);
      ctx.font = "600 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(tx.msg, tx.x, tx.y - 24 - age * 34);
    });

    // full-screen flashes
    fx.flashes = fx.flashes.filter((f) => time - f.born < f.dur);
    fx.flashes.forEach((f) => {
      const age = (time - f.born) / f.dur;
      ctx.fillStyle = "rgba(" + f.color + "," + f.max * (1 - age) + ")";
      ctx.fillRect(0, 0, W, H);
    });
  }

  /* ---- main RAF loop ---- */
  function frame(now) {
    const time = now - t0;
    drawBackground(now);
    drawParticles();
    drawEffects(now);
    requestAnimationFrame(frame);
  }

  /* ---- input: whole soup is the strike target ---- */
  function onClick(ev) {
    G.engine.strike(ev.clientX, ev.clientY);
  }

  R.init = function () {
    canvas = document.getElementById("stage");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    resize();
    initParticles();
    // Preload any event sprite textures declared in config (assets/fx/*.png).
    (cfg.energyEvents && cfg.energyEvents.table || []).forEach(function (def) {
      if (def.sprite) loadSprite(def.sprite);
      if (def.bloomSprite) loadSprite(def.bloomSprite);
    });
    // Guard against a transient wrong window size at load time (some browsers
    // haven't settled on real viewport dimensions yet when this first runs).
    setTimeout(function () { resize(); initParticles(); }, 0);
    setTimeout(function () { resize(); initParticles(); }, 250);
    window.addEventListener("resize", function () { resize(); initParticles(); });
    canvas.addEventListener("pointerdown", onClick);
    requestAnimationFrame(frame);
  };
})();
