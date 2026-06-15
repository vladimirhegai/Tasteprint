// Model-specific background effects for the "Choose your model pair." screen.
//
// The model screen splits the colour world (palette custom-properties, handled in
// app.js + styles.css) from the EFFECT world managed here. Each side of the diagonal
// gets one `.fx-stage`; this module mounts a canvas effect controller into it, swaps
// the effect with a 600ms crossfade when the model changes, and tears everything down
// when the screen is left.
//
// Effects are atmospheres behind the cards — calm, restrained, never demo-centerpieces:
//   gemini → antigravity     : airy suspended particles, a loose ring drifts with the cursor
//   codex  → faulty-terminal : a low, technical glyph/scanline texture (WebGL port)
//   claude → metaballs       : soft warm blobs that merge across the whole side (WebGL2)
//
// Hard rules honoured: no React, no frameworks, no new deps; canvases never take pointer
// events and always sit behind the cards (`.model-atmos` is z-index:-1); DPR is capped;
// loops stop on tab-hide and obey `prefers-reduced-motion`; controllers are destroyed
// after a crossfade and on screen exit so nothing leaks.

// Every meaningful tuning value lives here, never buried in a render loop. This object
// is the prompt's recommended starting shape — tune it live in the browser.
export const MODEL_EFFECT_CONFIG = {
  gemini: {
    type: "antigravity",
    color: "#4F5BD5",
    secondaryColor: "#8B7CFF",
    countSplit: 340,
    countMerged: 560,
    magnetRadiusRatio: 0.18,
    ringRadiusRatio: 0.075,
    waveSpeed: 1.4,
    waveAmplitude: 7,
    particleSize: 1.15,
    particleShape: "capsule",
    particleVariance: 0.55,
    lerpSpeed: 0.035,
    cursorSmoothing: 0.08,
    fieldStrength: 0.78,
    rotationSpeed: 0.24,
    depthFactor: 0.85,
    pulseSpeed: 0.9,
    autoAnimate: true,
    idleDelayMs: 1600,
    opacity: 0.52,
    dprCap: 1.5
  },

  codex: {
    type: "faulty-terminal",
    tint: "#1F9D78",
    // glyphSet + cellSize are carried from the React Bits demo but are not consumed by
    // this procedural shader — glyph density comes from scale × gridMul × digitSize.
    glyphSet: "01{}[]<>/_\\",
    scale: 1.65,
    gridMul: [2, 1],
    digitSize: 1.15,
    cellSize: 18,
    timeScale: 0.55,
    fpsCap: 24,
    scanlineIntensity: 0.16,
    glitchAmount: 0.34,
    flickerAmount: 0.18,
    noiseAmp: 0.32,
    chromaticAberration: 0,
    dither: 0.08,
    curvature: 0.025,
    mouseReact: true,
    mouseStrength: 0.42,
    cursorSmoothing: 0.08,
    pageLoadAnimation: false,
    brightness: 0.72,
    opacity: 0.6,
    dprCap: 1.5
  },

  claude: {
    type: "metaballs",
    color: "#C97A3D",
    cursorBallColor: "#EBC9A6",
    ballCountSplit: 16,
    ballCountMerged: 24,
    animationSize: 38,
    cursorBallSize: 3.4,
    enableMouseInteraction: true,
    enableTransparency: true,
    hoverSmoothness: 0.08,
    clumpFactor: 0.82,
    speed: 0.22,
    spreadX: 0.92,
    spreadY: 0.82,
    threshold: 2.3,
    softness: 0.12,
    opacity: 0.5,
    dprCap: 1.35
  }
};

// Effect controllers are keyed by their `type` so the manager can look one up from the
// effect string the colour world already carries on each model.
const CONFIG_BY_TYPE = Object.fromEntries(
  Object.values(MODEL_EFFECT_CONFIG).map((config) => [config.type, config])
);

const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
const MOBILE_MAX = 860;

/* ---------------- small helpers ---------------- */

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function hexToRgb255(hex) {
  let h = String(hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h || "000000", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexToRgb01(hex) {
  const [r, g, b] = hexToRgb255(hex);
  return [r / 255, g / 255, b / 255];
}

function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

// Deterministic PRNG so the initial particle/ball layout is reproducible (dev:local
// must stay deterministic). Animation over time is still wall-clock driven.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isMobile() {
  return window.innerWidth <= MOBILE_MAX;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("modelEffects: shader compile failed", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function linkProgram(gl, vertexSrc, fragmentSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "position");
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("modelEffects: program link failed", gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

// A full-screen triangle (covers clip space with one primitive). vUv is derived from the
// position in the vertex shader, so only one attribute (location 0) is needed.
function makeFullscreenTriangle(gl) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return buffer;
}

/* ---------------- base controller ----------------
   Owns the canvas, sizing (capped DPR), the RAF loop, and the four gates every effect
   shares: ResizeObserver, prefers-reduced-motion, document visibility, and a virtual
   pointer. Subclasses implement onSetup / onResize / onFrame / onStatic / onDestroy. */
class EffectController {
  constructor(host, config, { merged = false, side = "primary" } = {}) {
    this.host = host;
    this.config = config;
    this.merged = merged;
    this.side = side;
    this.dprCap = config.dprCap || 1.5;
    this.fpsCap = config.fpsCap || 0;

    this.live = false;
    this.destroyed = false;
    this.setupDone = false;
    this.raf = 0;
    this.lastFrame = 0;
    this.lastDraw = 0;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.rect = { left: 0, top: 0, width: 0, height: 0 };

    // Virtual pointer (host-relative px + normalised), driven from window pointermove —
    // the canvas itself can't receive events (pointer-events: none).
    this.pointer = { x: 0, y: 0 };
    this.pointerNorm = { x: 0.5, y: 0.5 };
    this.lastPointerMove = -Infinity;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "fx-canvas";
    host.appendChild(this.canvas);

    this._tick = this._tick.bind(this);
    this._onResize = () => this._resize();
    this._onVisibility = () => this._evaluate();
    this._onReduce = () => this._evaluate();
    this._onPointer = (event) => this._handlePointer(event);

    this.observer = new ResizeObserver(this._onResize);
    this.observer.observe(host);
    document.addEventListener("visibilitychange", this._onVisibility);
    window.addEventListener("pointermove", this._onPointer, { passive: true });
    if (reduceMq.addEventListener) reduceMq.addEventListener("change", this._onReduce);
    else if (reduceMq.addListener) reduceMq.addListener(this._onReduce);
  }

  get reduced() {
    return reduceMq.matches;
  }

  start() {
    if (this.destroyed) return;
    this.live = true;
    this._resize();
  }

  stop() {
    this.live = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  resize() {
    this._resize();
  }

  renderStaticFrame() {
    if (!this.setupDone || this.width === 0) return;
    this.onStatic();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.live = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    this.observer.disconnect();
    document.removeEventListener("visibilitychange", this._onVisibility);
    window.removeEventListener("pointermove", this._onPointer);
    if (reduceMq.removeEventListener) reduceMq.removeEventListener("change", this._onReduce);
    else if (reduceMq.removeListener) reduceMq.removeListener(this._onReduce);
    try {
      this.onDestroy();
    } finally {
      if (this.canvas.parentElement) this.canvas.remove();
    }
  }

  _handlePointer(event) {
    const rect = this.rect;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointerNorm.x = clamp(x / (rect.width || 1), 0, 1);
    this.pointerNorm.y = clamp(y / (rect.height || 1), 0, 1);
    this.lastPointerMove = performance.now();
  }

  _resize() {
    if (this.destroyed) return;
    const rect = this.host.getBoundingClientRect();
    this.rect = rect;
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w <= 0 || h <= 0) {
      this.width = 0;
      this.height = 0;
      this._evaluate();
      return;
    }
    let dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    if (isMobile()) dpr = Math.min(dpr, 1.2);
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    if (!this.setupDone) {
      this.setupDone = this.onSetup() !== false;
    }
    if (this.setupDone) this.onResize();
    this._evaluate();
  }

  // Single source of truth for whether the RAF loop should be running. Called on start,
  // resize, visibility change, and reduced-motion change.
  _evaluate() {
    if (this.destroyed || !this.live) return;
    const shouldLoop = !this.reduced && !document.hidden && this.width > 0 && this.setupDone;
    if (shouldLoop && !this.raf) {
      this.lastFrame = performance.now();
      this.raf = requestAnimationFrame(this._tick);
    } else if (!shouldLoop && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    // Reduced motion / resumed-while-paused: paint a single static frame so the field
    // never sits blank, but do not spin a loop.
    if (!shouldLoop && this.reduced && !document.hidden && this.setupDone && this.width > 0) {
      this.onStatic();
    }
  }

  _tick(now) {
    if (!this.live || this.reduced || document.hidden || this.destroyed) {
      this.raf = 0;
      return;
    }
    this.raf = requestAnimationFrame(this._tick);
    if (!this.setupDone || this.width === 0) return;
    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    if (this.fpsCap) {
      const minDelta = 1000 / this.fpsCap;
      if (now - this.lastDraw < minDelta) return;
      this.lastDraw = now;
    }
    this.onFrame(dt, now);
  }

  // True when the pointer has been still long enough to hand over to idle motion.
  isIdle(now, delayMs) {
    return now - this.lastPointerMove > delayMs;
  }

  /* eslint-disable class-methods-use-this */
  onSetup() {}
  onResize() {}
  onFrame() {}
  onStatic() {}
  onDestroy() {}
  /* eslint-enable class-methods-use-this */
}

/* ---------------- Gemini: Antigravity (Canvas 2D) ----------------
   Many small suspended particles drift in place as faint dust; those near the virtual
   cursor are pulled into a loose, wavering ring and brighten. The cursor is smoothed and,
   when the pointer goes quiet, wanders on its own (auto-animate). Airy, not a starfield. */
class AntigravityEffect extends EffectController {
  onSetup() {
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) return false;

    const cfg = this.config;
    const rng = mulberry32(this.side === "primary" ? 0x9e37 : 0x85eb);
    const count = this._count();
    this.particles = [];
    for (let i = 0; i < count; i += 1) {
      this.particles.push({
        hx: rng(),
        hy: rng(),
        z: rng() * 2 - 1,
        t: rng() * Math.PI * 2,
        speed: 0.4 + rng() * 0.8,
        radiusOffset: rng() * 2 - 1,
        size: 0.6 + rng() * 0.8,
        drift: rng() * Math.PI * 2,
        tone: rng(),
        cx: 0,
        cy: 0,
        init: false
      });
    }
    this.colorA = hexToRgb255(cfg.color);
    this.colorB = hexToRgb255(cfg.secondaryColor);
    this.virt = { x: 0, y: 0, init: false };
    this.time = 0;
    return true;
  }

  _count() {
    let count = this.merged ? this.config.countMerged : this.config.countSplit;
    if (isMobile()) count = Math.round(count * 0.5);
    return count;
  }

  _draw(dt, now, isStatic) {
    const ctx = this.ctx;
    const cfg = this.config;
    const w = this.width;
    const h = this.height;
    if (!isStatic) this.time += dt;
    const time = this.time;
    const minDim = Math.min(w, h);
    const magnetR = cfg.magnetRadiusRatio * minDim;
    const ringR = cfg.ringRadiusRatio * minDim;
    const driftAmp = minDim * 0.012;

    // Virtual cursor target: the live pointer, or an idle Lissajous wander.
    let targetX;
    let targetY;
    if (isStatic) {
      targetX = w * 0.5;
      targetY = h * 0.5;
    } else if (cfg.autoAnimate && this.isIdle(now, cfg.idleDelayMs)) {
      targetX = w * 0.5 + Math.sin(time * 0.5) * w * 0.25;
      targetY = h * 0.5 + Math.cos(time * 0.9) * h * 0.22;
    } else {
      targetX = this.pointer.x;
      targetY = this.pointer.y;
    }
    if (!this.virt.init || isStatic) {
      this.virt.x = targetX;
      this.virt.y = targetY;
      this.virt.init = true;
    }
    this.virt.x += (targetX - this.virt.x) * cfg.cursorSmoothing;
    this.virt.y += (targetY - this.virt.y) * cfg.cursorSmoothing;
    const cx = this.virt.x;
    const cy = this.virt.y;
    const rot = time * cfg.rotationSpeed;
    // Frame-rate independent approach factor for the lerp toward the ring/home.
    const k = isStatic ? 1 : 1 - Math.exp(-cfg.lerpSpeed * 60 * dt);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";

    for (const p of this.particles) {
      if (!isStatic) p.t += p.speed * dt;
      const homeX = p.hx * w + Math.sin(time * 0.25 + p.drift) * driftAmp;
      const homeY = p.hy * h + Math.cos(time * 0.22 + p.drift) * driftAmp;

      const dx = homeX - cx;
      const dy = homeY - cy;
      const dist = Math.hypot(dx, dy);
      let tx = homeX;
      let ty = homeY;
      if (dist < magnetR) {
        const angle = Math.atan2(dy, dx) + rot;
        const wave = Math.sin(p.t * cfg.waveSpeed + angle) * (0.5 * cfg.waveAmplitude);
        const deviation = p.radiusOffset * ((minDim * 0.02) / (cfg.fieldStrength + 0.1));
        const cur = ringR + wave + deviation;
        tx = cx + cur * Math.cos(angle);
        ty = cy + cur * Math.sin(angle);
      }
      if (!p.init) {
        p.cx = tx;
        p.cy = ty;
        p.init = true;
      }
      p.cx += (tx - p.cx) * k;
      p.cy += (ty - p.cy) * k;

      const distToCursor = Math.hypot(p.cx - cx, p.cy - cy);
      const ringFactor = clamp(1 - Math.abs(distToCursor - ringR) / (ringR * 1.6), 0, 1);
      const pulse = 0.8 + Math.sin(p.t * cfg.pulseSpeed) * 0.2 * cfg.particleVariance;
      const depth = 0.7 + (p.z * 0.5 + 0.5) * 0.5;
      const radius = cfg.particleSize * p.size * (minDim * 0.0055) * depth * (0.6 + 0.8 * ringFactor) * pulse;
      if (radius < 0.35) continue;
      const alpha = (0.34 + 0.55 * ringFactor) * depth;
      const tone = clamp(p.tone * 0.6 + ringFactor * 0.5, 0, 1);
      const col = mixRgb(this.colorA, this.colorB, tone);
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha.toFixed(3)})`;

      if (cfg.particleShape === "capsule" && radius > 0.7 && !isMobile()) {
        const dir = Math.atan2(p.cy - cy, p.cx - cx);
        const len = radius * 1.7;
        ctx.save();
        ctx.translate(p.cx, p.cy);
        ctx.rotate(dir);
        ctx.lineWidth = radius * 1.05;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.beginPath();
        ctx.moveTo(-len / 2, 0);
        ctx.lineTo(len / 2, 0);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  onFrame(dt, now) {
    this._draw(dt, now, false);
  }

  onStatic() {
    this._draw(0, performance.now(), true);
  }

  onDestroy() {
    this.particles = null;
    this.ctx = null;
  }
}

/* ---------------- Codex: Faulty Terminal (WebGL) ----------------
   A raw-WebGL port of the React Bits FaultyTerminal shader (no ogl). The fragment is the
   original GLSL with one change: it outputs luminance as alpha so the green glyph texture
   composites over the field behind it instead of painting a black panel. Frame-capped and
   kept dim so the cards stay dominant. Falls back to a faint static dot grid (2D) if WebGL
   is unavailable. */
const TERMINAL_VERT = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const TERMINAL_FRAG = `
precision mediump float;

varying vec2 vUv;

uniform float iTime;
uniform vec3  iResolution;
uniform float uScale;
uniform vec2  uGridMul;
uniform float uDigitSize;
uniform float uScanlineIntensity;
uniform float uGlitchAmount;
uniform float uFlickerAmount;
uniform float uNoiseAmp;
uniform float uChromaticAberration;
uniform float uDither;
uniform float uCurvature;
uniform vec3  uTint;
uniform vec2  uMouse;
uniform float uMouseStrength;
uniform float uUseMouse;
uniform float uBrightness;

float time;

float hash21(vec2 p){
  p = fract(p * 234.56);
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}

float noise(vec2 p){
  return sin(p.x * 10.0) * sin(p.y * (3.0 + sin(time * 0.090909))) + 0.2;
}

mat2 rotate(float angle){
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float fbm(vec2 p){
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

float pattern(vec2 p, out vec2 q, out vec2 r){
  vec2 offset1 = vec2(1.0);
  vec2 offset0 = vec2(0.0);
  mat2 rot01 = rotate(0.1 * time);
  mat2 rot1 = rotate(0.1);
  q = vec2(fbm(p + offset1), fbm(rot01 * p + offset1));
  r = vec2(fbm(rot1 * q + offset0), fbm(q + offset0));
  return fbm(p + r);
}

float digit(vec2 p){
  vec2 grid = uGridMul * 15.0;
  vec2 s = floor(p * grid) / grid;
  p = p * grid;
  vec2 q, r;
  float intensity = pattern(s * 0.1, q, r) * 1.3 - 0.03;

  if(uUseMouse > 0.5){
    vec2 mouseWorld = uMouse * uScale;
    float distToMouse = distance(s, mouseWorld);
    float mouseInfluence = exp(-distToMouse * 8.0) * uMouseStrength * 10.0;
    intensity += mouseInfluence;
    float ripple = sin(distToMouse * 20.0 - iTime * 5.0) * 0.1 * mouseInfluence;
    intensity += ripple;
  }

  p = fract(p);
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
  float br = isOn * (0.2 + y * 0.8) * (0.75 + x * 0.25);
  return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0) * br;
}

float onOff(float a, float b, float c){
  return step(c, sin(iTime + a * cos(iTime * b))) * uFlickerAmount;
}

float displace(vec2 look){
  float y = look.y - mod(iTime * 0.25, 1.0);
  float window = 1.0 / (1.0 + 50.0 * y * y);
  return sin(look.y * 20.0 + iTime) * 0.0125 * onOff(4.0, 2.0, 0.8) * (1.0 + cos(iTime * 60.0)) * window;
}

vec3 getColor(vec2 p){
  float bar = step(mod(p.y + time * 20.0, 1.0), 0.2) * 0.4 + 1.0;
  bar *= uScanlineIntensity;

  float displacement = displace(p);
  p.x += displacement;

  if (uGlitchAmount != 1.0) {
    float extra = displacement * (uGlitchAmount - 1.0);
    p.x += extra;
  }

  float middle = digit(p);
  const float off = 0.002;
  float sum = digit(p + vec2(-off, -off)) + digit(p + vec2(0.0, -off)) + digit(p + vec2(off, -off)) +
              digit(p + vec2(-off, 0.0)) + digit(p + vec2(0.0, 0.0)) + digit(p + vec2(off, 0.0)) +
              digit(p + vec2(-off, off)) + digit(p + vec2(0.0, off)) + digit(p + vec2(off, off));
  vec3 baseColor = vec3(0.9) * middle + sum * 0.1 * vec3(1.0) * bar;
  return baseColor;
}

vec2 barrel(vec2 uv){
  vec2 c = uv * 2.0 - 1.0;
  float r2 = dot(c, c);
  c *= 1.0 + uCurvature * r2;
  return c * 0.5 + 0.5;
}

void main(){
  time = iTime * 0.333333;
  vec2 uv = vUv;
  if(uCurvature != 0.0){
    uv = barrel(uv);
  }
  vec2 p = uv * uScale;
  vec3 col = getColor(p);

  if(uChromaticAberration != 0.0){
    vec2 ca = vec2(uChromaticAberration) / iResolution.xy;
    col.r = getColor(p + ca).r;
    col.b = getColor(p - ca).b;
  }

  col *= uTint;
  col *= uBrightness;

  if(uDither > 0.0){
    float rnd = hash21(gl_FragCoord.xy);
    col += (rnd - 0.5) * (uDither * 0.003922);
  }

  // Transparent integration: dark cells drop out, glyphs carry alpha so the field shows
  // through. This is what keeps it a texture, not a black terminal panel.
  float a = clamp(max(col.r, max(col.g, col.b)) * 1.5, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
}
`;

class FaultyTerminalEffect extends EffectController {
  onSetup() {
    const gl =
      this.canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false }) ||
      this.canvas.getContext("experimental-webgl", { alpha: true, premultipliedAlpha: false });
    if (!gl) {
      this.fallback = true;
      this.ctx2d = this.canvas.getContext("2d");
      this.tintRgb = hexToRgb255(this.config.tint);
      return Boolean(this.ctx2d);
    }
    this.gl = gl;
    const program = linkProgram(gl, TERMINAL_VERT, TERMINAL_FRAG);
    if (!program) {
      this.fallback = true;
      return true;
    }
    this.program = program;
    this.buffer = makeFullscreenTriangle(gl);
    gl.useProgram(program);
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const cfg = this.config;
    const u = (name) => gl.getUniformLocation(program, name);
    this.u = {
      iTime: u("iTime"),
      iResolution: u("iResolution"),
      uMouse: u("uMouse")
    };
    // Static uniforms set once.
    gl.uniform1f(u("uScale"), cfg.scale);
    gl.uniform2f(u("uGridMul"), cfg.gridMul[0], cfg.gridMul[1]);
    gl.uniform1f(u("uDigitSize"), cfg.digitSize);
    gl.uniform1f(u("uScanlineIntensity"), cfg.scanlineIntensity);
    gl.uniform1f(u("uGlitchAmount"), cfg.glitchAmount);
    gl.uniform1f(u("uFlickerAmount"), cfg.flickerAmount);
    gl.uniform1f(u("uNoiseAmp"), cfg.noiseAmp);
    gl.uniform1f(u("uChromaticAberration"), cfg.chromaticAberration);
    gl.uniform1f(u("uDither"), typeof cfg.dither === "boolean" ? (cfg.dither ? 1 : 0) : cfg.dither);
    gl.uniform1f(u("uCurvature"), cfg.curvature);
    const tint = hexToRgb01(cfg.tint);
    gl.uniform3f(u("uTint"), tint[0], tint[1], tint[2]);
    gl.uniform1f(u("uMouseStrength"), cfg.mouseStrength);
    gl.uniform1f(u("uUseMouse"), cfg.mouseReact ? 1 : 0);
    gl.uniform1f(u("uBrightness"), cfg.brightness);

    this.smoothMouse = { x: 0.5, y: 0.5 };
    this.timeOffset = mulberry32(this.side === "primary" ? 11 : 97)() * 100;
    this.canvas.addEventListener("webglcontextlost", (event) => event.preventDefault());
    return true;
  }

  onResize() {
    if (this.fallback || !this.gl) return;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.uniform3f(this.u.iResolution, this.canvas.width, this.canvas.height, this.canvas.width / this.canvas.height);
  }

  _render(now) {
    if (this.fallback || !this.gl) {
      this._renderFallback();
      return;
    }
    const gl = this.gl;
    const cfg = this.config;
    gl.useProgram(this.program);
    const elapsed = (now * 0.001 + this.timeOffset) * cfg.timeScale;
    gl.uniform1f(this.u.iTime, elapsed);
    if (cfg.mouseReact) {
      // uMouse is normalised, y flipped to match the shader's bottom-left origin.
      this.smoothMouse.x += (this.pointerNorm.x - this.smoothMouse.x) * cfg.cursorSmoothing;
      this.smoothMouse.y += (1 - this.pointerNorm.y - this.smoothMouse.y) * cfg.cursorSmoothing;
      gl.uniform2f(this.u.uMouse, this.smoothMouse.x, this.smoothMouse.y);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _renderFallback() {
    const ctx = this.ctx2d;
    if (!ctx) return;
    const w = this.width;
    const h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cell = 18;
    const [r, g, b] = this.tintRgb;
    ctx.fillStyle = `rgba(${r},${g},${b},0.10)`;
    for (let y = cell; y < h; y += cell) {
      for (let x = cell; x < w; x += cell) {
        ctx.fillRect(x, y, 1.4, 1.4);
      }
    }
  }

  onFrame(dt, now) {
    this._render(now);
  }

  onStatic() {
    this._render(this.timeOffset ? this.timeOffset * 1000 : 0);
  }

  onDestroy() {
    const gl = this.gl;
    if (gl) {
      if (this.buffer) gl.deleteBuffer(this.buffer);
      if (this.program) gl.deleteProgram(this.program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.gl = null;
    this.program = null;
  }
}

/* ---------------- Claude: MetaBalls (WebGL2) ----------------
   A raw-WebGL2 port of the React Bits MetaBalls shader, re-tuned for a large split-screen
   surface. Balls are spread across aspect-aware world coordinates (worldHeight =
   animationSize, worldWidth scales with the canvas aspect) so they fill the whole side
   and merge softly, instead of clustering into a small central circle. A smoothed cursor
   ball follows the pointer. Degrades to a tasteful 2D soft-blob field if WebGL2 is absent. */
const META_MAX = 32;

const META_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const META_FRAG = `#version 300 es
precision highp float;
uniform vec3 iResolution;
uniform vec3 iColor;
uniform vec3 iCursorColor;
uniform vec3 iMouse;
uniform float iAnimationSize;
uniform int iBallCount;
uniform float iCursorBallSize;
uniform vec3 iMetaBalls[${META_MAX}];
uniform float iThreshold;
uniform float iSoftness;
uniform bool enableTransparency;
out vec4 outColor;

float mb(vec2 c, float r, vec2 p){
  vec2 d = p - c;
  return (r * r) / max(dot(d, d), 1e-4);
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  float scale = iAnimationSize / iResolution.y;
  vec2 coord = (fc - iResolution.xy * 0.5) * scale;
  vec2 mouseW = (iMouse.xy - iResolution.xy * 0.5) * scale;
  float m1 = 0.0;
  for (int i = 0; i < ${META_MAX}; i++) {
    if (i >= iBallCount) break;
    m1 += mb(iMetaBalls[i].xy, iMetaBalls[i].z, coord);
  }
  float m2 = mb(mouseW, iCursorBallSize, coord);
  float total = m1 + m2;
  float aa = max(fwidth(total), 1e-4) * (1.0 + iSoftness * 8.0);
  float f = smoothstep(-1.0, 1.0, (total - iThreshold) / aa);
  vec3 cFinal = vec3(0.0);
  if (total > 0.0) {
    cFinal = iColor * (m1 / total) + iCursorColor * (m2 / total);
  }
  outColor = vec4(cFinal * f, enableTransparency ? f : 1.0);
}
`;

class MetaballsEffect extends EffectController {
  onSetup() {
    const cfg = this.config;
    this.colorRgb = hexToRgb255(cfg.color);
    this._buildBalls();

    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false
    });
    if (!gl) {
      this.fallback = true;
      this.ctx2d = this.canvas.getContext("2d");
      return Boolean(this.ctx2d);
    }
    this.gl = gl;
    const program = linkProgram(gl, META_VERT, META_FRAG);
    if (!program) {
      this.fallback = true;
      this.ctx2d = this.canvas.getContext("2d");
      this.gl = null;
      return Boolean(this.ctx2d);
    }
    this.program = program;
    this.buffer = makeFullscreenTriangle(gl);
    gl.useProgram(program);
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const u = (name) => gl.getUniformLocation(program, name);
    this.u = {
      iResolution: u("iResolution"),
      iMouse: u("iMouse"),
      iMetaBalls: u("iMetaBalls")
    };
    const colorA = hexToRgb01(cfg.color);
    const colorC = hexToRgb01(cfg.cursorBallColor);
    gl.uniform3f(u("iColor"), colorA[0], colorA[1], colorA[2]);
    gl.uniform3f(u("iCursorColor"), colorC[0], colorC[1], colorC[2]);
    gl.uniform1f(u("iAnimationSize"), cfg.animationSize);
    gl.uniform1i(u("iBallCount"), this.ballCount);
    gl.uniform1f(u("iCursorBallSize"), cfg.cursorBallSize);
    gl.uniform1f(u("iThreshold"), cfg.threshold);
    gl.uniform1f(u("iSoftness"), cfg.softness);
    gl.uniform1i(u("enableTransparency"), cfg.enableTransparency ? 1 : 0);

    this.ballData = new Float32Array(META_MAX * 3);
    this.mouseBall = { x: 0, y: 0, init: false };
    this.canvas.addEventListener("webglcontextlost", (event) => event.preventDefault());
    return true;
  }

  _buildBalls() {
    const cfg = this.config;
    let count = this.merged ? cfg.ballCountMerged : cfg.ballCountSplit;
    if (isMobile()) count = Math.max(6, Math.round(count * 0.6));
    count = Math.min(count, META_MAX);
    this.ballCount = count;

    // R2 low-discrepancy sequence → even coverage across the whole world rect, so both
    // diagonal halves stay filled (and the merged view has no bald patches).
    const g = 1.32471795724474602596;
    const a1 = 1 / g;
    const a2 = 1 / (g * g);
    const rng = mulberry32(this.side === "primary" ? 0x51ed : 0x2f9a);
    this.balls = [];
    for (let i = 0; i < count; i += 1) {
      const nx = ((0.5 + a1 * (i + 1)) % 1) - 0.5 + (rng() - 0.5) * 0.06;
      const ny = ((0.5 + a2 * (i + 1)) % 1) - 0.5 + (rng() - 0.5) * 0.06;
      this.balls.push({
        nx: clamp(nx, -0.5, 0.5),
        ny: clamp(ny, -0.5, 0.5),
        phase: rng() * Math.PI * 2,
        freqA: 0.6 + rng() * 0.8,
        freqB: 0.5 + rng() * 0.7,
        orbit: 0.04 + rng() * 0.06,
        radius: 0.115 + rng() * 0.06
      });
    }
  }

  onResize() {
    if (this.fallback || !this.gl) return;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.uniform3f(this.u.iResolution, this.canvas.width, this.canvas.height, 0);
  }

  // Shared ball-position math (world units) for both GL and 2D paths.
  _stepBalls(now, elapsed) {
    const cfg = this.config;
    const worldH = cfg.animationSize;
    const worldW = worldH * (this.canvas.width / Math.max(1, this.canvas.height));
    const positions = [];
    for (let i = 0; i < this.ballCount; i += 1) {
      const ball = this.balls[i];
      const ax = ball.nx * worldW * cfg.spreadX;
      const ay = ball.ny * worldH * cfg.spreadY;
      const ox = Math.cos(elapsed * cfg.speed * ball.freqA + ball.phase) * worldH * ball.orbit;
      const oy = Math.sin(elapsed * cfg.speed * ball.freqB + ball.phase) * worldH * ball.orbit;
      positions.push({
        x: (ax + ox) * cfg.clumpFactor,
        y: (ay + oy) * cfg.clumpFactor,
        r: worldH * ball.radius
      });
    }
    return positions;
  }

  _cursorTarget(now, elapsed) {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const interactive = this.config.enableMouseInteraction && !this.isIdle(now, 1200);
    if (interactive) {
      return { x: this.pointerNorm.x * cw, y: (1 - this.pointerNorm.y) * ch };
    }
    // Idle: a slow orbit near centre so the cursor ball keeps the field alive.
    return {
      x: cw * 0.5 + Math.cos(elapsed * this.config.speed) * cw * 0.15,
      y: ch * 0.5 + Math.sin(elapsed * this.config.speed * 0.9) * ch * 0.15
    };
  }

  _render(now, isStatic) {
    const elapsed = isStatic ? 0 : now * 0.001;
    if (this.fallback || !this.gl) {
      this._renderFallback(now, elapsed);
      return;
    }
    const gl = this.gl;
    const positions = this._stepBalls(now, elapsed);
    const data = this.ballData;
    for (let i = 0; i < this.ballCount; i += 1) {
      data[i * 3] = positions[i].x;
      data[i * 3 + 1] = positions[i].y;
      data[i * 3 + 2] = positions[i].r;
    }
    gl.useProgram(this.program);
    gl.uniform3fv(this.u.iMetaBalls, data);

    const target = this._cursorTarget(now, elapsed);
    if (!this.mouseBall.init || isStatic) {
      this.mouseBall.x = target.x;
      this.mouseBall.y = target.y;
      this.mouseBall.init = true;
    }
    this.mouseBall.x += (target.x - this.mouseBall.x) * this.config.hoverSmoothness;
    this.mouseBall.y += (target.y - this.mouseBall.y) * this.config.hoverSmoothness;
    gl.uniform3f(this.u.iMouse, this.mouseBall.x, this.mouseBall.y, 0);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // 2D degradation: soft radial-gradient blobs in the warm colour. No true metaball
  // merging, but a tasteful, calm field that keeps Claude's identity.
  _renderFallback(now, elapsed) {
    const ctx = this.ctx2d;
    if (!ctx) return;
    const w = this.width;
    const h = this.height;
    const cfg = this.config;
    const [r, g, b] = this.colorRgb;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const scale = h / cfg.animationSize;
    for (let i = 0; i < this.ballCount; i += 1) {
      const ball = this.balls[i];
      const ax = (ball.nx * cfg.spreadX + 0.5) * w;
      const ay = (ball.ny * cfg.spreadY + 0.5) * h;
      const ox = Math.cos(elapsed * cfg.speed * ball.freqA + ball.phase) * w * 0.04;
      const oy = Math.sin(elapsed * cfg.speed * ball.freqB + ball.phase) * h * 0.04;
      const x = ax + ox;
      const y = ay + oy;
      const radius = cfg.animationSize * ball.radius * scale * 1.6;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.5)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  onFrame(dt, now) {
    this._render(now, false);
  }

  onStatic() {
    this._render(performance.now(), true);
  }

  onDestroy() {
    const gl = this.gl;
    if (gl) {
      if (this.buffer) gl.deleteBuffer(this.buffer);
      if (this.program) gl.deleteProgram(this.program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.gl = null;
    this.program = null;
    this.balls = null;
  }
}

/* ---------------- manager ----------------
   One controller per side, swapped with a CSS opacity crossfade. A side's identity is
   keyed by `${effectType}|${merged?m:s}`; when that key changes we mount the incoming
   effect, fade it in, fade the outgoing one out, then destroy the outgoing controller. */
function createController(type, host, opts) {
  switch (type) {
    case "antigravity":
      return new AntigravityEffect(host, CONFIG_BY_TYPE[type], opts);
    case "faulty-terminal":
      return new FaultyTerminalEffect(host, CONFIG_BY_TYPE[type], opts);
    case "metaballs":
      return new MetaballsEffect(host, CONFIG_BY_TYPE[type], opts);
    default:
      return null;
  }
}

const SLOTS = {
  primary: { key: "none", controller: null, instance: null },
  secondary: { key: "none", controller: null, instance: null }
};
const CROSSFADE_MS = 600;
const pending = [];

function retireController(instance, controller) {
  if (instance) instance.classList.remove("is-active");
  const entry = { controller, instance, timer: 0 };
  entry.timer = setTimeout(() => {
    controller?.destroy();
    instance?.remove();
    const index = pending.indexOf(entry);
    if (index >= 0) pending.splice(index, 1);
  }, CROSSFADE_MS + 80);
  pending.push(entry);
}

function applySide(container, side, type, mergedForSide) {
  const stage = container.querySelector(`.fx-stage[data-side="${side}"]`);
  if (!stage) return;
  const slot = SLOTS[side];
  const usable = Boolean(type) && Boolean(CONFIG_BY_TYPE[type]);
  const key = usable ? `${type}|${mergedForSide ? "m" : "s"}` : "none";

  if (slot.key === key) {
    slot.controller?.resize();
    return;
  }

  if (slot.controller) retireController(slot.instance, slot.controller);
  slot.key = key;
  slot.controller = null;
  slot.instance = null;
  if (!usable) return;

  const config = CONFIG_BY_TYPE[type];
  const instance = document.createElement("div");
  instance.className = "fx-instance";
  if (config.opacity != null) instance.style.setProperty("--fx-opacity", String(config.opacity));
  stage.appendChild(instance);
  const controller = createController(type, instance, { merged: mergedForSide, side });
  slot.instance = instance;
  slot.controller = controller;
  controller?.start();
  // Next frame: trigger the opacity transition (mounting + fading on the same frame skips it).
  requestAnimationFrame(() => instance.classList.add("is-active"));
}

// Mount / update both sides. When the two models match (`merged`), the primary effect
// fills the viewport (its mask is dropped in CSS) and the secondary is destroyed.
export function syncModelEffects(container, { primary, secondary, merged }) {
  if (!container) return;
  applySide(container, "primary", primary, Boolean(merged));
  applySide(container, "secondary", merged ? null : secondary, false);
}

// Tear everything down when leaving the model screen: live controllers and any
// mid-crossfade outgoing ones, so no RAF loop / observer / WebGL context survives.
export function destroyModelEffects() {
  for (const side of ["primary", "secondary"]) {
    const slot = SLOTS[side];
    slot.controller?.destroy();
    slot.instance?.remove();
    slot.controller = null;
    slot.instance = null;
    slot.key = "none";
  }
  for (const entry of pending.splice(0)) {
    clearTimeout(entry.timer);
    entry.controller?.destroy();
    entry.instance?.remove();
  }
}
