// Small, reliable model background effects for the "Choose your model pair" screen.
//
// This is intentionally a foundation, not a final effects showcase:
// - one canvas per visible side
// - no dependencies or build-step rendering libraries
// - canvases never receive pointer events
// - animation stops on hidden tabs and in reduced motion
// - same-model merge runs one full-screen effect

export const MODEL_EFFECT_CONFIG = {
  gemini: {
    type: "antigravity",
    color: "#4F5BD5",
    secondaryColor: "#8B7CFF",
    countSplit: 220,
    countMerged: 340,
    renderScale: 0.72,
    mobileRenderScale: 0.5,
    maxCanvasPixels: 560000,
    // 60fps so the cursor ring tracks smoothly on a 60Hz display (a 30fps cap judders,
    // same lesson as the metaballs). The batched, allocation-free draw loop keeps the
    // particle field cheap enough to afford it. followRate/idleRate are the
    // frame-rate-independent chase rates for the cursor (higher = snappier).
    fpsCap: 60,
    followRate: 18,
    idleRate: 2.4,
    opacity: 0.46,
    dprCap: 1.25
  },
  codex: {
    type: "faulty-terminal",
    // Port of React Bits' FaultyTerminal (WebGL). Tuned to read as a green CRT glyph
    // field over the light codex world: alpha is driven by glyph luminance so empty
    // space stays transparent and the field blends instead of painting a black screen.
    tint: "#23C28C",
    scale: 1.7,
    // Merged keeps the same scale as split: the .fx-stage is always full-viewport (split
    // just masks the primary to the top-left), so dropping that mask on merge already
    // reveals the rest of the SAME glyph field. Zooming the scale on top of that made the
    // whole field jump on merge — the seamless reveal is what we want instead.
    mergedScale: 1.7,
    gridMul: [2, 1],
    digitSize: 1.3,
    timeScale: 0.5,
    scanlineIntensity: 0.5,
    glitchAmount: 1,
    flickerAmount: 0.7,
    noiseAmp: 1.0,
    curvature: 0.1,
    mouseStrength: 0.22,
    brightness: 1.0,
    // Frame-rate-independent chase rate for the cursor glow (higher = snappier, less
    // trailing lag). The old fixed `* 0.08` per frame felt laggy and, being tied to the
    // frame count, tracked even worse at the 30fps cap. 16 keeps a hair of smoothing
    // trail without the cursor falling behind. fpsCap lifted to 45 so the glow's
    // position is sampled often enough that the follow reads as fluid, not stepped.
    mouseFollowRate: 16,
    renderScale: 0.5,
    mobileRenderScale: 0.34,
    maxCanvasPixels: 480000,
    fpsCap: 45,
    opacity: 0.5,
    dprCap: 1.2
  },
  claude: {
    type: "metaballs",
    color: "#C97A3D",
    cursorBallColor: "#EBC9A6",
    ballCountSplit: 20,
    ballCountMerged: 30,
    animationSize: 42,
    minBallRadius: 1.0,
    maxBallRadius: 3.0,
    cursorBallSize: 2.15,
    enableMouseInteraction: true,
    enableTransparency: true,
    // Frame-rate-INDEPENDENT cursor chase (`1 - e^(-rate·dt)`), same as gemini/codex. The
    // old fixed per-frame factor (`*= smoothness`) was tied to the frame count, so any dip
    // below 60fps stretched the follow and read as lag; this keeps a constant time-constant
    // no matter the cadence. hoverFollowRate is tuned high for a tight, snappy track with
    // just a hair of smoothing; idleFollowRate drifts gently. No added per-frame cost.
    hoverFollowRate: 26,
    idleFollowRate: 4,
    idleDriftRadiusRatio: 0.08,
    speed: 0.18,
    spreadX: 1.08,
    spreadY: 1.0,
    threshold: 2.85,
    softness: 0.09,
    renderScale: 0.62,
    mobileRenderScale: 0.45,
    maxCanvasPixels: 620000,
    fpsCap: 60,
    opacity: 0.44,
    dprCap: 1.15
  }
};

const CONFIG_BY_TYPE = Object.fromEntries(
  Object.values(MODEL_EFFECT_CONFIG).map((config) => [config.type, config])
);

const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
const MOBILE_MAX = 860;
// Must match the .fx-instance opacity transition in styles.css (600ms). Retiring the
// outgoing effect sooner than its fade-out completes pops it off mid-crossfade, so the
// model swap reads as a cut instead of a blend.
const CROSSFADE_MS = 600;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isMobile() {
  return window.innerWidth <= MOBILE_MAX;
}

function hexToRgb(hex) {
  let h = String(hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((char) => char + char).join("");
  const value = parseInt(h || "000000", 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgba(rgb, alpha) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(a, b, seed = 0) {
  let h = Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + seed, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x27d4eb2d);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967295;
}

function afterPaint(callback) {
  requestAnimationFrame(() => setTimeout(callback, 0));
}

class CanvasEffect {
  constructor(host, config, { merged = false, side = "primary" } = {}) {
    this.host = host;
    this.config = config;
    this.merged = merged;
    this.side = side;
    this.destroyed = false;
    this.running = false;
    this.ready = false;
    this.raf = 0;
    this.lastFrame = 0;
    this.lastDraw = 0;
    this.width = 0;
    this.height = 0;
    this.pixelRatio = 1;
    this.pointerInside = false;
    this.hasPointer = false;
    this.pointer = { x: 0.5, y: 0.5 };
    this.pointerPx = { x: 0, y: 0 };
    this.lastClient = null;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "fx-canvas";
    this.canvas.style.pointerEvents = "none";
    this.ctx = this.constructor.canvasContext === "custom"
      ? null
      : this.canvas.getContext("2d", { alpha: true });
    host.appendChild(this.canvas);

    this._tick = this._tick.bind(this);
    this._onResize = () => this.resize();
    this._onPointer = (event) => this._handlePointer(event);
    this._onVisibility = () => this._syncLoop();
    this._onReduce = () => this._syncLoop();

    this.resizeObserver = new ResizeObserver(this._onResize);
    this.resizeObserver.observe(host);
    window.addEventListener("pointermove", this._onPointer, { passive: true });
    document.addEventListener("visibilitychange", this._onVisibility);
    if (reduceMq.addEventListener) reduceMq.addEventListener("change", this._onReduce);
    else reduceMq.addListener(this._onReduce);
  }

  start() {
    if (this.destroyed) return;
    this.running = true;
    this.resize();
    this.setup();
    this.ready = true;
    this.renderStaticFrame();
    this._syncLoop();
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy() {
    if (this.destroyed) return;
    this.stop();
    this.destroyed = true;
    this.resizeObserver.disconnect();
    window.removeEventListener("pointermove", this._onPointer);
    document.removeEventListener("visibilitychange", this._onVisibility);
    if (reduceMq.removeEventListener) reduceMq.removeEventListener("change", this._onReduce);
    else reduceMq.removeListener(this._onReduce);
    this.teardown();
    this.canvas.remove();
  }

  resize() {
    if (this.destroyed) return;
    const rect = this.host.getBoundingClientRect();
    this.rect = rect;
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    const scale = isMobile()
      ? (this.config.mobileRenderScale || this.config.renderScale || 1)
      : (this.config.renderScale || 1);
    const dpr = Math.min(window.devicePixelRatio || 1, this.config.dprCap || 1);
    let ratio = Math.min(dpr * scale, 1);
    let pixelW = Math.max(1, Math.round(cssW * ratio));
    let pixelH = Math.max(1, Math.round(cssH * ratio));
    const maxPixels = this.config.maxCanvasPixels || Infinity;
    const pixels = pixelW * pixelH;

    if (pixels > maxPixels) {
      const down = Math.sqrt(maxPixels / pixels);
      pixelW = Math.max(1, Math.round(pixelW * down));
      pixelH = Math.max(1, Math.round(pixelH * down));
      ratio *= down;
    }

    this.width = cssW;
    this.height = cssH;
    this.pixelRatio = ratio;
    this.canvas.width = pixelW;
    this.canvas.height = pixelH;
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";

    if (this.lastClient) {
      this._syncPointer(this.lastClient.x, this.lastClient.y);
    } else {
      this.pointerPx.x = cssW * 0.5;
      this.pointerPx.y = cssH * 0.5;
    }

    if (this.ready) {
      this.onResize();
      this.renderStaticFrame();
    }
  }

  renderStaticFrame() {
    if (!this.ctx || this.width <= 1 || this.height <= 1) return;
    this.draw(1 / 30, performance.now(), true);
  }

  setup() {}
  onResize() {}
  teardown() {}

  _handlePointer(event) {
    this.lastClient = { x: event.clientX, y: event.clientY };
    this._syncPointer(event.clientX, event.clientY);
  }

  _syncPointer(clientX, clientY) {
    const rect = this.rect || this.host.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const inside = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
    this.pointerInside = inside;
    if (!inside) return;
    this.hasPointer = true;
    this.pointer.x = clamp(x / Math.max(1, rect.width), 0, 1);
    this.pointer.y = clamp(y / Math.max(1, rect.height), 0, 1);
    this.pointerPx.x = this.pointer.x * this.width;
    this.pointerPx.y = this.pointer.y * this.height;
  }

  _syncLoop() {
    if (!this.running || this.destroyed || document.hidden || reduceMq.matches) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      if (!document.hidden) this.renderStaticFrame();
      return;
    }
    if (!this.raf) {
      this.lastFrame = performance.now();
      this.raf = requestAnimationFrame(this._tick);
    }
  }

  _tick(now) {
    this.raf = 0;
    if (!this.running || this.destroyed || document.hidden || reduceMq.matches) return;

    const minDelta = this.config.fpsCap ? 1000 / this.config.fpsCap : 0;
    if (minDelta && now - this.lastDraw < minDelta) {
      this.raf = requestAnimationFrame(this._tick);
      return;
    }

    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    this.lastDraw = now;
    dt = clamp(dt, 0, 0.05);
    this.draw(dt, now, false);
    this.raf = requestAnimationFrame(this._tick);
  }

  clear() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  }

  draw() {}
}

// Shared so a re-mount (model swapped away and back, or a merge that rebuilds the side)
// resumes the drift phase and keeps the cursor where it was instead of snapping the
// field to t=0 with the ring jumping to the centre. ONE shared cursor slot (not per side)
// so a merge that moves the field secondary→primary keeps the ring continuous. Stored
// normalised so it survives a resize. Mirrors META_EPOCH / META_CURSOR.
const GEMINI_EPOCH = (typeof performance !== "undefined" ? performance.now() : Date.now());
let GEMINI_CURSOR = null;

class GeminiEffect extends CanvasEffect {
  setup() {
    this.colorA = hexToRgb(this.config.color);
    this.colorB = hexToRgb(this.config.secondaryColor);
    this.baseAlpha = 0.24;
    // Phase to a shared wall clock so a fresh instance picks up where a continuously
    // running one would be (this.time += dt accumulates real seconds).
    this.time = (performance.now() - GEMINI_EPOCH) / 1000;

    const persisted = GEMINI_CURSOR;
    this.cursor = persisted
      ? { x: persisted.fx * this.width, y: persisted.fy * this.height }
      : { x: this.width * 0.5, y: this.height * 0.5 };

    // Opaque colour ramp — independent of particle count, so it's built once here.
    const STEPS = 16;
    this.palette = new Array(STEPS);
    for (let i = 0; i < STEPS; i += 1) {
      this.palette[i] = rgba(mixRgb(this.colorA, this.colorB, i / (STEPS - 1)), 1);
    }

    this.active = []; // reused scratch list, length tracked per frame via activeCount
    this._buildParticles();
  }

  _buildParticles() {
    // Side-independent seed (see metaballs): a gemini field looks the same on either side,
    // so merging into Gemini is a seamless reveal regardless of which side it started on.
    const rng = mulberry32(0x4f5bd5);
    const count = this.merged ? this.config.countMerged : this.config.countSplit;
    const STEPS = this.palette.length;

    this.particles = Array.from({ length: isMobile() ? Math.round(count * 0.6) : count }, () => ({
      x: rng(),
      y: rng(),
      phase: rng() * Math.PI * 2,
      speed: 0.4 + rng() * 0.8,
      size: 0.7 + rng() * 1.1,
      tone: rng(),
      bucket: 0,
      // Scratch slots reused each frame for particles caught in the cursor field — keeps
      // the object shape stable so the draw loop allocates nothing.
      _dx: 0,
      _dy: 0,
      _dist: 0
    }));

    // Bucket each particle by its static tone so the ambient field draws in one fill per
    // bucket (alpha rides ctx.globalAlpha) instead of a per-particle colour string + fill.
    this.buckets = Array.from({ length: STEPS }, () => []);
    for (const p of this.particles) {
      p.bucket = clamp(Math.round(p.tone * (STEPS - 1)), 0, STEPS - 1);
      this.buckets[p.bucket].push(p);
    }
  }

  draw(dt, now, still) {
    this.clear();
    const ctx = this.ctx;
    const cfg = this.config;
    const w = this.width;
    const h = this.height;
    const min = Math.min(w, h);
    if (!still) this.time += dt;

    // Frame-rate-independent cursor follow: a snappy chase toward the pointer, easing back
    // to the idle drift when it leaves. A fixed per-frame factor (the old `* 0.08`) felt
    // laggy and tracked the display only at the old 30fps cap; this stays smooth at 60.
    const targetX = this.pointerInside ? this.pointerPx.x : w * (0.5 + Math.sin(this.time * 0.34) * 0.2);
    const targetY = this.pointerInside ? this.pointerPx.y : h * (0.5 + Math.cos(this.time * 0.27) * 0.16);
    const rate = this.pointerInside ? (cfg.followRate ?? 18) : (cfg.idleRate ?? 2.4);
    const k = 1 - Math.exp(-rate * dt);
    this.cursor.x += (targetX - this.cursor.x) * k;
    this.cursor.y += (targetY - this.cursor.y) * k;

    const cx = this.cursor.x;
    const cy = this.cursor.y;
    const ringRadius = min * 0.08;
    const fieldRadius = min * 0.22;
    const fieldSq = fieldRadius * fieldRadius;
    const drift = min * 0.012;
    const sizeScale = min * 0.0034;
    const t = this.time;
    const TWO_PI = Math.PI * 2;

    // Pass 1 — ambient field, batched by colour bucket (one fillStyle + one fill each).
    // Particles swept inside the cursor field are deferred to pass 2 (brighter, larger).
    let activeCount = 0;
    ctx.globalAlpha = this.baseAlpha;
    for (let b = 0; b < this.buckets.length; b += 1) {
      const bucket = this.buckets[b];
      if (!bucket.length) continue;
      ctx.fillStyle = this.palette[b];
      ctx.beginPath();
      let drew = false;
      for (let i = 0; i < bucket.length; i += 1) {
        const p = bucket[i];
        const homeX = p.x * w + Math.sin(t * 0.18 + p.phase) * drift;
        const homeY = p.y * h + Math.cos(t * 0.16 + p.phase) * drift;
        const dx = homeX - cx;
        const dy = homeY - cy;
        const distSq = dx * dx + dy * dy;
        if (distSq < fieldSq) {
          p._dx = dx;
          p._dy = dy;
          p._dist = Math.sqrt(distSq);
          this.active[activeCount] = p;
          activeCount += 1;
          continue;
        }
        const r = Math.max(0.8, p.size * sizeScale);
        ctx.moveTo(homeX + r, homeY);
        ctx.arc(homeX, homeY, r, 0, TWO_PI);
        drew = true;
      }
      if (drew) ctx.fill();
    }

    // Pass 2 — particles caught in the cursor field. Each eases from its ambient home
    // toward the orbiting ring as it's pulled in (smoothstep of `pull`) instead of
    // snapping onto the ring the instant it crosses the boundary — so capsules visibly
    // *flow* into the field. At pull≈0 the blended position/size/colour/alpha all equal
    // the ambient draw, so the field edge stays seamless. Still allocation-free.
    const lastStep = this.palette.length - 1;
    for (let i = 0; i < activeCount; i += 1) {
      const p = this.active[i];
      const pull = 1 - p._dist / fieldRadius;
      const join = pull * pull * (3 - 2 * pull);
      const homeX = cx + p._dx;
      const homeY = cy + p._dy;
      const angle = Math.atan2(p._dy, p._dx) + t * 0.18;
      const rx = ringRadius + Math.sin(t * p.speed + p.phase) * drift;
      const ry = ringRadius + Math.cos(t * p.speed + p.phase) * drift;
      const ringX = cx + Math.cos(angle) * rx;
      const ringY = cy + Math.sin(angle) * ry;
      const x = homeX + (ringX - homeX) * join;
      const y = homeY + (ringY - homeY) * join;
      const r = Math.max(0.8, p.size * sizeScale * (1 + pull * 0.8));
      const ci = clamp(Math.round((p.tone + pull * 0.35) * lastStep), 0, lastStep);
      ctx.globalAlpha = this.baseAlpha + pull * 0.5;
      ctx.fillStyle = this.palette[ci];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TWO_PI);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // Persist the cursor (normalised) so a re-mount resumes from here instead of the
    // centre. Mutated in place — one allocation on the first frame, none after.
    let store = GEMINI_CURSOR;
    if (!store) store = GEMINI_CURSOR = { fx: 0.5, fy: 0.5 };
    store.fx = this.cursor.x / Math.max(1, w);
    store.fy = this.cursor.y / Math.max(1, h);
  }
}

// ---- Faulty terminal (Codex) ----
// A vanilla/WebGL port of React Bits' FaultyTerminal. A full-screen triangle runs a
// fragment shader that builds a drifting fbm field, samples it into a 5x5 dot-matrix
// glyph grid, and adds rolling scanlines, glitch displacement, flicker, and barrel
// curvature. Output alpha = glyph luminance, so the field blends over the light codex
// world (transparent where dark) instead of painting an opaque black screen.
const FAULTY_VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// PERFORMANCE: the reference shader calls the fbm-heavy pattern()/digit() ten times per
// pixel (the center glyph + a 3x3 bloom). All ten taps land in the same grid cell, so
// the costly fbm field (pattern -> 5x fbm -> 15x noise) is computed ONCE per cell here
// (cellIntensity) and the nine bloom taps only re-run the cheap glyph bitmap (glyph),
// reusing that intensity. That is a ~10x cut in transcendental work — the change that
// keeps this affordable next to the metaballs effect on the other half of the screen.
// Chromatic aberration, dithering, and the page-load fade are dropped (unused here).
const FAULTY_FRAGMENT = `
precision mediump float;

varying vec2 vUv;

uniform float iTime;
uniform float uScale;
uniform vec2  uGridMul;
uniform float uDigitSize;
uniform float uScanlineIntensity;
uniform float uGlitchAmount;
uniform float uFlickerAmount;
uniform float uNoiseAmp;
uniform float uCurvature;
uniform vec3  uTint;
uniform vec2  uMouse;
uniform float uMouseStrength;
uniform float uUseMouse;
uniform float uBrightness;

float time;

float noise(vec2 p) {
  return sin(p.x * 10.0) * sin(p.y * (3.0 + sin(time * 0.090909))) + 0.2;
}

mat2 rotate(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float fbm(vec2 p) {
  p *= 1.1;
  float f = 0.0;
  float amp = 0.5 * uNoiseAmp;
  mat2 modify0 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify0 * p * 2.0;
  amp *= 0.454545;
  mat2 modify1 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify1 * p * 2.0;
  amp *= 0.454545;
  mat2 modify2 = rotate(time * 0.08);
  f += amp * noise(p);
  return f;
}

float pattern(vec2 p, out vec2 q, out vec2 r) {
  vec2 offset1 = vec2(1.0);
  vec2 offset0 = vec2(0.0);
  mat2 rot01 = rotate(0.1 * time);
  mat2 rot1 = rotate(0.1);
  q = vec2(fbm(p + offset1), fbm(rot01 * p + offset1));
  r = vec2(fbm(rot1 * q + offset0), fbm(q + offset0));
  return fbm(p + r);
}

// Expensive: the drifting field intensity for one grid cell. Run once per pixel.
float cellIntensity(vec2 s) {
  vec2 q, r;
  float intensity = pattern(s * 0.1, q, r) * 1.3 - 0.03;
  if (uUseMouse > 0.5) {
    vec2 mouseWorld = uMouse * uScale;
    float distToMouse = distance(s, mouseWorld);
    float mouseInfluence = exp(-distToMouse * 8.0) * uMouseStrength * 10.0;
    intensity += mouseInfluence;
    intensity += sin(distToMouse * 20.0 - iTime * 5.0) * 0.1 * mouseInfluence;
  }
  return intensity;
}

// Cheap: the 5x5 dot-matrix glyph bitmap, given a precomputed cell intensity.
float glyph(vec2 p, float intensity) {
  vec2 grid = uGridMul * 15.0;
  p = fract(p * grid);
  p *= uDigitSize;
  float px5 = p.x * 5.0;
  float py5 = (1.0 - p.y) * 5.0;
  float x = fract(px5);
  float y = fract(py5);
  float i = floor(py5) - 2.0;
  float j = floor(px5) - 2.0;
  float n = i * i + j * j;
  float f = n * 0.0625;
  float isOn = step(0.1, intensity - f);
  float bright = isOn * (0.2 + y * 0.8) * (0.75 + x * 0.25);
  return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0) * bright;
}

float onOff(float a, float b, float c) {
  return step(c, sin(iTime + a * cos(iTime * b))) * uFlickerAmount;
}

float displace(vec2 look) {
  float y = look.y - mod(iTime * 0.25, 1.0);
  float window = 1.0 / (1.0 + 50.0 * y * y);
  return sin(look.y * 20.0 + iTime) * 0.0125 * onOff(4.0, 2.0, 0.8) * (1.0 + cos(iTime * 60.0)) * window;
}

float field(vec2 p) {
  float bar = (step(mod(p.y + time * 20.0, 1.0), 0.2) * 0.4 + 1.0) * uScanlineIntensity;

  float displacement = displace(p);
  p.x += displacement;
  if (uGlitchAmount != 1.0) {
    p.x += displacement * (uGlitchAmount - 1.0);
  }

  vec2 grid = uGridMul * 15.0;
  vec2 s = floor(p * grid) / grid;
  float intensity = cellIntensity(s);

  float middle = glyph(p, intensity);
  const float off = 0.002;
  float sum = glyph(p + vec2(-off, -off), intensity) + glyph(p + vec2(0.0, -off), intensity) + glyph(p + vec2(off, -off), intensity) +
              glyph(p + vec2(-off, 0.0), intensity) + glyph(p + vec2(0.0, 0.0), intensity) + glyph(p + vec2(off, 0.0), intensity) +
              glyph(p + vec2(-off, off), intensity) + glyph(p + vec2(0.0, off), intensity) + glyph(p + vec2(off, off), intensity);

  return 0.9 * middle + sum * 0.1 * bar;
}

vec2 barrel(vec2 uv) {
  vec2 c = uv * 2.0 - 1.0;
  float r2 = dot(c, c);
  c *= 1.0 + uCurvature * r2;
  return c * 0.5 + 0.5;
}

void main() {
  time = iTime * 0.333333;
  vec2 uv = vUv;
  if (uCurvature != 0.0) uv = barrel(uv);

  vec2 p = uv * uScale;
  float g = field(p);

  float alpha = clamp(g * uBrightness, 0.0, 1.0);
  // Hot cells lean toward a pale phosphor green; everything else holds the tint.
  vec3 color = mix(uTint, vec3(0.85, 1.0, 0.92), clamp((g - 0.7) * 1.6, 0.0, 0.55));
  gl_FragColor = vec4(color, alpha);
}
`;

// Shared so a re-mount (model swapped away and back, or a merge that rebuilds the side)
// resumes the animation roughly where it was instead of snapping back to t=0; the smoothed
// mouse persists in ONE shared slot (not per side) so the cursor glow stays continuous when
// a merge moves the field from the secondary to the primary side. Normalised already.
const FAULTY_EPOCH = (typeof performance !== "undefined" ? performance.now() : Date.now());
let FAULTY_MOUSE = null;

class FaultyTerminalEffect extends CanvasEffect {
  static canvasContext = "custom";

  setup() {
    const gl = this.canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false
    });

    const cfg = this.config;
    this.tint = hexToRgb(cfg.tint);
    this.timeScale = cfg.timeScale ?? 1;
    // Side-INDEPENDENT phase: a codex field must look identical whether it's mounted on
    // the primary or secondary side. A merge always keeps the primary side, so a per-side
    // offset made a codex that started on the secondary jump (the phase shifted) when the
    // merge moved it to primary. Two codex fields never coexist (same model both sides ⇒
    // merged ⇒ secondary destroyed), so there's nothing to desync. Epoch phasing still
    // makes a re-mount resume in place; dev:local stays deterministic (no Math.random).
    this.time = (performance.now() - FAULTY_EPOCH) / 1000 * this.timeScale;
    // One shared cursor slot (not per side) so the glow stays put across a merge: the
    // surviving primary inherits the live position the secondary was writing.
    this.smoothMouse = FAULTY_MOUSE || (FAULTY_MOUSE = { x: 0.5, y: 0.5 });

    if (!gl) {
      this._initFallback();
      return;
    }

    try {
      this.gl = gl;
      this.program = createProgram(gl, FAULTY_VERTEX, FAULTY_FRAGMENT);
      this.positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

      this.locations = {
        position: gl.getAttribLocation(this.program, "aPosition"),
        iTime: gl.getUniformLocation(this.program, "iTime"),
        uScale: gl.getUniformLocation(this.program, "uScale"),
        uGridMul: gl.getUniformLocation(this.program, "uGridMul"),
        uDigitSize: gl.getUniformLocation(this.program, "uDigitSize"),
        uScanlineIntensity: gl.getUniformLocation(this.program, "uScanlineIntensity"),
        uGlitchAmount: gl.getUniformLocation(this.program, "uGlitchAmount"),
        uFlickerAmount: gl.getUniformLocation(this.program, "uFlickerAmount"),
        uNoiseAmp: gl.getUniformLocation(this.program, "uNoiseAmp"),
        uCurvature: gl.getUniformLocation(this.program, "uCurvature"),
        uTint: gl.getUniformLocation(this.program, "uTint"),
        uMouse: gl.getUniformLocation(this.program, "uMouse"),
        uMouseStrength: gl.getUniformLocation(this.program, "uMouseStrength"),
        uUseMouse: gl.getUniformLocation(this.program, "uUseMouse"),
        uBrightness: gl.getUniformLocation(this.program, "uBrightness")
      };

      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);

      // This canvas owns its GL context and never switches program or buffer, so the
      // program, vertex attribute, and every static uniform are bound once here. The
      // per-frame draw only updates the two dynamic uniforms (iTime + mouse).
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.enableVertexAttribArray(this.locations.position);
      gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);

      const scale = this.merged ? (cfg.mergedScale ?? cfg.scale) : cfg.scale;
      gl.uniform1f(this.locations.uScale, scale);
      gl.uniform2f(this.locations.uGridMul, cfg.gridMul[0], cfg.gridMul[1]);
      gl.uniform1f(this.locations.uDigitSize, cfg.digitSize);
      gl.uniform1f(this.locations.uScanlineIntensity, cfg.scanlineIntensity);
      gl.uniform1f(this.locations.uGlitchAmount, cfg.glitchAmount);
      gl.uniform1f(this.locations.uFlickerAmount, cfg.flickerAmount);
      gl.uniform1f(this.locations.uNoiseAmp, cfg.noiseAmp);
      gl.uniform1f(this.locations.uCurvature, cfg.curvature);
      gl.uniform3f(this.locations.uTint, this.tint[0] / 255, this.tint[1] / 255, this.tint[2] / 255);
      gl.uniform1f(this.locations.uMouseStrength, cfg.mouseStrength);
      gl.uniform1f(this.locations.uUseMouse, cfg.mouseStrength > 0 ? 1 : 0);
      gl.uniform1f(this.locations.uBrightness, cfg.brightness);
      this.onResize();
    } catch (error) {
      this.teardown();
      this._initFallback();
    }
  }

  _initFallback() {
    const fallback = document.createElement("canvas");
    fallback.className = this.canvas.className;
    fallback.style.pointerEvents = "none";
    fallback.style.width = "100%";
    fallback.style.height = "100%";
    fallback.width = this.canvas.width;
    fallback.height = this.canvas.height;
    this.canvas.replaceWith(fallback);
    this.canvas = fallback;
    this.ctx = this.canvas.getContext("2d", { alpha: true });
  }

  teardown() {
    if (!this.gl) return;
    const gl = this.gl;
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.program) gl.deleteProgram(this.program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = null;
    this.program = null;
    this.positionBuffer = null;
  }

  onResize() {
    if (!this.gl || !this.program) return;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  renderStaticFrame() {
    if (this.destroyed || this.width <= 1 || this.height <= 1) return;
    this.draw(1 / 30, performance.now(), true);
  }

  draw(dt, now, still) {
    if (!still) this.time += dt * this.timeScale;
    if (this.gl && this.program) this._drawWebgl(dt);
    else this._drawFallback(still);
  }

  _drawWebgl(dt) {
    const gl = this.gl;
    // Ease the smoothed mouse toward the pointer; the shader wants y up. The chase is
    // frame-rate-independent (`1 - e^(-rate·dt)`) so the glow keeps pace with the cursor
    // no matter the cap — the previous fixed per-frame factor trailed far behind.
    const rate = this.config.mouseFollowRate ?? 16;
    const k = 1 - Math.exp(-rate * Math.max(dt, 0));
    this.smoothMouse.x += (this.pointer.x - this.smoothMouse.x) * k;
    this.smoothMouse.y += ((1 - this.pointer.y) - this.smoothMouse.y) * k;

    gl.uniform1f(this.locations.iTime, this.time);
    gl.uniform2f(this.locations.uMouse, this.smoothMouse.x, this.smoothMouse.y);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Lightweight 2D stand-in for the rare no-WebGL case: a faint flickering glyph wash
  // plus scanlines in the tint, enough to read as a terminal without the shader.
  _drawFallback(still) {
    if (!this.ctx) return;
    this.clear();
    const ctx = this.ctx;
    const cfg = this.config;
    const w = this.width;
    const h = this.height;
    const cols = isMobile() ? 40 : 64;
    const cellW = w / cols;
    const rows = Math.max(24, Math.round(h / Math.max(8, cellW)));
    const cellH = h / rows;
    const frame = still ? 0 : Math.floor(this.time * cfg.fpsCap);

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const v = hash2(col, row + (frame >> 2), 7);
        if (v < 0.62) continue;
        ctx.fillStyle = rgba(this.tint, (v - 0.62) / 0.38 * 0.4 * cfg.brightness);
        ctx.fillRect(col * cellW, row * cellH, cellW * 0.6, cellH * 0.62);
      }
    }

    ctx.fillStyle = rgba(this.tint, cfg.scanlineIntensity * 0.28);
    for (let y = (frame % 3); y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }
  }
}

const META_MAX_BALLS = 36;
// Shared so the metaballs survive a re-mount (switching model away and back, or a merge
// that rebuilds the side) without resetting: the motion is phased to one wall clock, and
// the cursor ball lives in ONE shared slot (not per side) so it stays put when a merge
// moves the field from the secondary to the primary side.
const META_EPOCH = (typeof performance !== "undefined" ? performance.now() : Date.now());
const META_CURSOR = { x: 0, y: 0 };
const META_VERTEX = `
attribute vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const META_FRAGMENT = `
precision highp float;

uniform vec2 uResolution;
uniform vec3 uColor;
uniform vec3 uCursorColor;
uniform vec3 uBalls[${META_MAX_BALLS}];
uniform vec3 uCursor;
uniform float uWorldHeight;
uniform float uThreshold;
uniform float uSoftness;
uniform float uUseCursor;
uniform int uBallCount;

float metaball(vec2 center, float radius, vec2 point) {
  vec2 delta = point - center;
  return (radius * radius) / max(dot(delta, delta), 0.0008);
}

void main() {
  vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  float worldWidth = uWorldHeight * (uResolution.x / max(uResolution.y, 1.0));
  vec2 point = (uv - 0.5) * vec2(worldWidth, uWorldHeight);

  float field = 0.0;
  float cursorField = 0.0;

  for (int i = 0; i < ${META_MAX_BALLS}; i++) {
    if (i >= uBallCount) break;
    field += metaball(uBalls[i].xy, uBalls[i].z, point);
  }

  if (uUseCursor > 0.5) {
    cursorField = metaball(uCursor.xy, uCursor.z, point);
    field += cursorField;
  }

  float edge = smoothstep(uThreshold - uSoftness, uThreshold + uSoftness, field);
  float halo = smoothstep(0.18, uThreshold * 0.72, field) * (1.0 - edge) * 0.22;
  float alpha = max(edge * 0.82, halo);

  if (alpha <= 0.002) discard;

  float cursorMix = cursorField / max(field, 0.0001);
  vec3 color = mix(uColor, uCursorColor, clamp(cursorMix * 0.72 + edge * 0.06, 0.0, 0.72));
  gl_FragColor = vec4(color, alpha);
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(error || "Shader compile failed");
  }
  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(error || "Program link failed");
  }

  return program;
}

class MetaballsEffect extends CanvasEffect {
  static canvasContext = "custom";

  setup() {
    const gl = this.canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false
    });

    this.time = 0;
    this.color = hexToRgb(this.config.color);
    this.cursorColor = hexToRgb(this.config.cursorBallColor);
    // Persist the cursor ball across re-mounts so it resumes rather than sliding in from
    // the centre when the effect is switched away and back.
    this.cursorWorld = META_CURSOR;
    this._setupBalls();
    // Phase the animation to a shared wall clock so a freshly mounted instance picks up
    // where a continuously-running one would be — re-mounting no longer snaps the balls
    // back to their start formation.
    this.time = (performance.now() - META_EPOCH) / 1000;
    // Pre-allocated once; reused every frame so the render loop never allocates.
    this.ballUniforms = new Float32Array(META_MAX_BALLS * 3);

    if (!gl) {
      this.ctx = this.canvas.getContext("2d", { alpha: true });
      return;
    }

    try {
      this.gl = gl;
      this.program = createProgram(gl, META_VERTEX, META_FRAGMENT);
      this.positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW
      );

      this.locations = {
        position: gl.getAttribLocation(this.program, "aPosition"),
        resolution: gl.getUniformLocation(this.program, "uResolution"),
        color: gl.getUniformLocation(this.program, "uColor"),
        cursorColor: gl.getUniformLocation(this.program, "uCursorColor"),
        balls: gl.getUniformLocation(this.program, "uBalls[0]"),
        cursor: gl.getUniformLocation(this.program, "uCursor"),
        worldHeight: gl.getUniformLocation(this.program, "uWorldHeight"),
        threshold: gl.getUniformLocation(this.program, "uThreshold"),
        softness: gl.getUniformLocation(this.program, "uSoftness"),
        useCursor: gl.getUniformLocation(this.program, "uUseCursor"),
        ballCount: gl.getUniformLocation(this.program, "uBallCount")
      };

      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, this.config.enableTransparency ? 0 : 1);

      // This canvas owns its own GL context and never switches program or buffer,
      // so the program, vertex attribute, and every static uniform are bound once
      // here. The per-frame draw only updates the two dynamic uniforms (balls + cursor).
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.enableVertexAttribArray(this.locations.position);
      gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform3f(this.locations.color, this.color[0] / 255, this.color[1] / 255, this.color[2] / 255);
      gl.uniform3f(this.locations.cursorColor, this.cursorColor[0] / 255, this.cursorColor[1] / 255, this.cursorColor[2] / 255);
      gl.uniform1f(this.locations.worldHeight, this.config.animationSize);
      gl.uniform1f(this.locations.threshold, this.config.threshold);
      gl.uniform1f(this.locations.softness, this.config.softness);
      gl.uniform1f(this.locations.useCursor, this.config.enableMouseInteraction ? 1 : 0);
      gl.uniform1i(this.locations.ballCount, this.ballCount);
      this.onResize();
    } catch (error) {
      this.teardown();
      const fallback = document.createElement("canvas");
      fallback.className = this.canvas.className;
      fallback.style.pointerEvents = "none";
      fallback.style.width = "100%";
      fallback.style.height = "100%";
      fallback.width = this.canvas.width;
      fallback.height = this.canvas.height;
      this.canvas.replaceWith(fallback);
      this.canvas = fallback;
      this.ctx = this.canvas.getContext("2d", { alpha: true });
    }
  }

  teardown() {
    if (!this.gl) return;
    const gl = this.gl;
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.program) gl.deleteProgram(this.program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = null;
    this.program = null;
    this.positionBuffer = null;
  }

  onResize() {
    if (!this.gl || !this.program) return;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // Resolution only changes on resize, so it lives here rather than in the draw loop.
    gl.uniform2f(this.locations.resolution, this.canvas.width, this.canvas.height);
  }

  renderStaticFrame() {
    if (this.destroyed || this.width <= 1 || this.height <= 1) return;
    this.draw(1 / 24, performance.now(), true);
  }

  _setupBalls() {
    // Seed and anchors are identical whether split or merged, so a merge is a seamless
    // mask reveal (the .fx-stage is always full-viewport — split just clips the primary
    // to the top-left; merging drops that mask) rather than a reseed that teleports every
    // blob. Ball i lands in the same spot in both states because the rng stream up to it
    // is identical; merged only appends a few extra balls that fade in over the crossfade.
    // Mirrors the gemini field, which already never reseeds on merge.
    // Side-independent seed: a Claude field looks the same on either side, so merging into
    // Claude is a seamless reveal no matter which side it started on (the survivor is always
    // the primary side). Two metaballs fields never coexist, so nothing needs desyncing.
    const rng = mulberry32(0xc97a3d);
    const requestedCount = this.merged ? this.config.ballCountMerged : this.config.ballCountSplit;
    const mobile = isMobile();
    const mobileCount = Math.max(10, Math.round(requestedCount * 0.72));
    const count = Math.min(META_MAX_BALLS, mobile ? mobileCount : requestedCount);

    // Anchors are scattered across the WHOLE field (corners, edges, centre) rather than
    // bunched near the middle, so the goo reads as "metaballs everywhere". A few balls
    // share each anchor in a tight cluster, which is what keeps each blob merged and
    // gooey instead of looking like isolated dots — the spread/merge trade-off. One fixed
    // set for both states keeps every blob's home stable across a merge.
    const anchors = [
      [-0.40, -0.34], [0.02, -0.32], [0.40, -0.36],
      [-0.42, 0.06], [0.16, 0.12],
      [-0.18, 0.38], [0.40, 0.30]
    ];
    const minRadius = this.config.minBallRadius;
    const maxRadius = this.config.maxBallRadius;
    const radiusScale = mobile ? 0.82 : 1;
    const clusterScale = mobile ? 1.2 : 1;

    this.spreadX = this.config.spreadX ?? 1;
    this.spreadY = this.config.spreadY ?? 1;
    this.time = 0;
    this.balls = Array.from({ length: count }, (_, index) => {
      const anchor = anchors[index % anchors.length];
      const ring = Math.floor(index / anchors.length);
      const angle = rng() * Math.PI * 2;
      // Tight cluster radius so each anchor's balls overlap and merge into one blob.
      const distance = (0.028 + rng() * 0.05 + ring * 0.022) * clusterScale;
      return {
        homeX: clamp(anchor[0] + Math.cos(angle) * distance, -0.48, 0.48),
        homeY: clamp(anchor[1] + Math.sin(angle) * distance, -0.46, 0.46),
        radius: (minRadius + rng() * (maxRadius - minRadius)) * radiusScale,
        ampX: 0.014 + rng() * 0.022,
        ampY: 0.014 + rng() * 0.026,
        phase: rng() * Math.PI * 2,
        speed: 0.6 + rng() * 0.7
      };
    });
    this.ballCount = this.balls.length;
  }

  draw(dt, now, still) {
    if (!still) this.time += dt;
    if (this.gl && this.program) {
      this._drawWebgl(dt);
    } else {
      this._drawFallback(dt, still);
    }
  }

  _worldWidth(worldHeight) {
    return worldHeight * (this.canvas.width / Math.max(1, this.canvas.height));
  }

  // Writes the current ball positions straight into the reused Float32Array and updates
  // the cursor ball in place — no per-frame allocations, so the loop produces no GC churn.
  _advance(worldWidth, worldHeight, dt) {
    const cfg = this.config;
    const speed = cfg.speed;
    const balls = this.balls;
    const arr = this.ballUniforms;
    const sx = this.spreadX;
    const sy = this.spreadY;

    for (let i = 0; i < balls.length; i += 1) {
      const ball = balls[i];
      const t = this.time * speed * ball.speed + ball.phase;
      const offset = i * 3;
      arr[offset] = (ball.homeX * sx + Math.sin(t) * ball.ampX) * worldWidth;
      arr[offset + 1] = (ball.homeY * sy + Math.cos(t * 0.9) * ball.ampY) * worldHeight;
      arr[offset + 2] = ball.radius;
    }

    const cursor = this.cursorWorld;
    let targetX;
    let targetY;
    let rate;
    if (cfg.enableMouseInteraction && this.pointerInside) {
      // Chase the pointer — a tight, snappy follow with a hair of smoothing.
      targetX = (this.pointer.x - 0.5) * worldWidth;
      targetY = (0.5 - this.pointer.y) * worldHeight;
      rate = cfg.hoverFollowRate ?? 26;
    } else {
      // No pointer: drift on a slow orbit, eased more gently.
      const drift = cfg.idleDriftRadiusRatio || 0.08;
      targetX = Math.cos(this.time * speed * 0.9) * worldWidth * drift;
      targetY = Math.sin(this.time * speed * 0.7) * worldHeight * drift;
      rate = cfg.idleFollowRate ?? 4;
    }
    // Frame-rate-independent ease: the fraction covered this frame depends on real elapsed
    // time, so the follow feels identical whether we're at 60fps or dropping frames.
    const k = 1 - Math.exp(-rate * Math.max(dt, 0));
    cursor.x += (targetX - cursor.x) * k;
    cursor.y += (targetY - cursor.y) * k;
  }

  _drawWebgl(dt) {
    const gl = this.gl;
    const worldHeight = this.config.animationSize;
    const worldWidth = this._worldWidth(worldHeight);
    this._advance(worldWidth, worldHeight, dt);

    // Program, vertex attribute, resolution and every static uniform were bound once in
    // setup()/onResize(); only the two dynamic uniforms change here.
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform3fv(this.locations.balls, this.ballUniforms);
    gl.uniform3f(this.locations.cursor, this.cursorWorld.x, this.cursorWorld.y, this.config.cursorBallSize);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _drawFallback(dt) {
    if (!this.ctx) return;
    this.clear();
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const worldHeight = this.config.animationSize;
    const worldWidth = this._worldWidth(worldHeight);
    this._advance(worldWidth, worldHeight, dt);
    const arr = this.ballUniforms;

    ctx.save();
    ctx.filter = "blur(8px) contrast(1.55)";
    ctx.globalCompositeOperation = "lighter";

    const paint = (px, py, pr, headColor, headAlpha) => {
      const grad = ctx.createRadialGradient(px, py, pr * 0.08, px, py, pr);
      grad.addColorStop(0, rgba(headColor, headAlpha));
      grad.addColorStop(0.58, rgba(this.color, 0.24));
      grad.addColorStop(1, rgba(this.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    };

    for (let i = 0; i < this.ballCount; i += 1) {
      const offset = i * 3;
      const x = (arr[offset] / worldWidth + 0.5) * w;
      const y = (0.5 - arr[offset + 1] / worldHeight) * h;
      const r = (arr[offset + 2] / worldHeight) * h;
      paint(x, y, r, this.color, 0.48);
    }

    if (this.config.enableMouseInteraction) {
      const cx = (this.cursorWorld.x / worldWidth + 0.5) * w;
      const cy = (0.5 - this.cursorWorld.y / worldHeight) * h;
      const cr = (this.config.cursorBallSize / worldHeight) * h;
      paint(cx, cy, cr, this.cursorColor, 0.54);
    }

    ctx.restore();
  }
}

function createController(type, host, opts) {
  const config = CONFIG_BY_TYPE[type];
  if (!config) return null;
  if (type === "antigravity") return new GeminiEffect(host, config, opts);
  if (type === "faulty-terminal") return new FaultyTerminalEffect(host, config, opts);
  if (type === "metaballs") return new MetaballsEffect(host, config, opts);
  return null;
}

const slots = {
  primary: { key: "none", instance: null, controller: null, pending: 0 },
  secondary: { key: "none", instance: null, controller: null, pending: 0 }
};

let token = 0;

function retire(instance, controller) {
  if (!instance && !controller) return;
  instance?.classList.remove("is-active");
  setTimeout(() => {
    controller?.destroy();
    instance?.remove();
  }, CROSSFADE_MS + 40);
}

function clearSide(side, immediate = false) {
  const slot = slots[side];
  slot.pending += 1;
  if (immediate) {
    slot.controller?.destroy();
    slot.instance?.remove();
  } else {
    retire(slot.instance, slot.controller);
  }
  slot.key = "none";
  slot.instance = null;
  slot.controller = null;
}

function mountSide(container, side, type, merged, defer) {
  const stage = container.querySelector(`.fx-stage[data-side="${side}"]`);
  const slot = slots[side];
  const config = CONFIG_BY_TYPE[type];
  const nextKey = config ? `${type}:${merged ? "merged" : "split"}` : "none";

  if (!stage || !config) {
    clearSide(side, true);
    return;
  }
  if (slot.key === nextKey && slot.controller) {
    slot.controller.resize();
    return;
  }

  const runToken = ++slot.pending;
  const run = () => {
    if (runToken !== slot.pending || !container.isConnected || !stage.isConnected) return;

    const instance = document.createElement("div");
    instance.className = "fx-instance";
    instance.style.setProperty("--fx-opacity", String(config.opacity ?? 1));
    stage.appendChild(instance);

    const controller = createController(type, instance, { merged, side });
    controller?.start();
    retire(slot.instance, slot.controller);

    slot.key = nextKey;
    slot.instance = instance;
    slot.controller = controller;

    requestAnimationFrame(() => {
      if (slot.instance === instance) instance.classList.add("is-active");
    });
  };

  if (defer) afterPaint(run);
  else run();
}

export function syncModelEffects(container, { primary, secondary, merged }) {
  if (!container) return;
  token += 1;
  mountSide(container, "primary", primary, Boolean(merged), false);
  // Retire (don't hard-destroy) the secondary on merge: it keeps drawing while its stage
  // fades, so its field cross-covers with the primary's newly-merged one. Since both sides
  // share the same seed/phase, that overlap is a seamless reveal — destroying it instantly
  // instead left a light flash before the merged field faded in.
  if (merged) clearSide("secondary", false);
  else mountSide(container, "secondary", secondary, false, false);
}

export function syncModelEffectsDeferred(container, { primary, secondary, merged }) {
  if (!container) return;
  token += 1;
  const runToken = token;
  afterPaint(() => {
    if (runToken !== token) return;
    mountSide(container, "primary", primary, Boolean(merged), false);
    // Retire (not hard-destroy) on merge so the secondary's field fades out and cross-covers
    // the primary's expanding merged field — see syncModelEffects(); avoids the light flash.
    if (merged) clearSide("secondary", false);
    else mountSide(container, "secondary", secondary, false, false);
  });
}

export function destroyModelEffects() {
  token += 1;
  clearSide("primary", true);
  clearSide("secondary", true);
}

// Pre-compile the WebGL programs the model screen will mount (faulty-terminal + metaballs)
// on a throwaway 1x1 context, so the first real mount reuses the driver's cached shader
// binary instead of paying the link cost mid-transition. Called during the boot loader so
// the heavy work lands while the user is already watching a spinner — clicking into the
// model screen then stays instant. Best-effort: any failure is swallowed (the real mount
// recompiles or falls back to Canvas2D exactly as before). Runs at most once.
let warmedUp = false;
export function warmupModelEffects() {
  if (warmedUp || reduceMq.matches) return;
  warmedUp = true;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false });
    if (!gl) return;
    [[FAULTY_VERTEX, FAULTY_FRAGMENT], [META_VERTEX, META_FRAGMENT]].forEach(([vert, frag]) => {
      try {
        const program = createProgram(gl, vert, frag);
        // Force the driver to finish the upload, then drop it — we only want the cache warm.
        gl.useProgram(program);
        gl.deleteProgram(program);
      } catch {
        /* a single shader failing to warm is harmless; the live mount handles it */
      }
    });
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    /* no WebGL / blocked context — skip warmup entirely */
  }
}
