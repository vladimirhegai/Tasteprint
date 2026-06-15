# Master Prompt: Model Effects Performance And Fidelity Fix

You are the implementation agent. Implement this corrective pass end to end.

This prompt follows `TASTEPRINT-MODEL-EFFECTS-MASTER-PROMPT.md`, but it supersedes that prompt anywhere the two conflict. Do not rebuild the page from scratch. Fix the implemented model effects.

## User-Reported Problems

The current implementation is visually promising, but has four concrete issues:

1. The model page takes too long to load.
2. The Codex terminal effect is the laggiest part.
3. Claude's metaballs currently read as one giant blob, not distinct balls that merge.
4. Codex feels stale and uniform. The React Bits FaultyTerminal reference has noise, glitch, scanline, and field variance; the current Codex treatment lacks enough of that life.
5. Claude and Gemini appear to "reset" or release the cursor when the cursor stays still for too long. A stationary cursor must still count as an active cursor.

Performance must be greatly improved.

## Read First

Read these files before editing:

1. `PRODUCT.md`
2. `TASTEPRINT-MODEL-EFFECTS-MASTER-PROMPT.md`
3. `public/app.js`
4. `public/styles.css`
5. `public/modelEffects.js`
6. FaultyTerminal reference:
   `C:\Users\vladh\.codex\attachments\31c51fe4-437a-4b22-92a6-5af98fec2334\pasted-text.txt`

Current landmarks in `public/modelEffects.js`:

- `MODEL_EFFECT_CONFIG`
- `EffectController`
- `FaultyTerminalEffect`
- `TERMINAL_FRAG`
- `MetaballsEffect`
- `META_FRAG`
- `syncModelEffects()`
- `destroyModelEffects()`

## Preserve What Works

Keep:

- the split-screen model atmosphere architecture
- same-model merge behavior
- the warm Claude palette and broad organic feel
- the Gemini antigravity direction unless it is directly involved in performance
- cards above effects
- reduced-motion behavior
- no React, no dependencies, no build step

Do not touch backend/model invocation/orchestrator code.

## Required Outcome

After this pass:

- The model screen should feel interactive immediately.
- The first visible model page content should not wait for shaders or canvas setup.
- Codex should have FaultyTerminal-like variance without causing lag.
- Claude should show multiple visible metaballs with negative space between them.
- Claude balls may merge locally, especially near the cursor, but the whole viewport must not become one continuous blob.
- Gemini and Claude must not jump, recenter, or switch to an idle orbit while the pointer is still inside the effect area.
- No active effect should run at full device resolution if a lower internal resolution looks good.
- Leaving the model screen must destroy RAF loops, observers, canvases, and WebGL contexts.

## Performance Budget

Use these targets:

- Model screen first contentful visual response: under 200ms after navigation/render.
- No effect setup should create a long task over 50ms on a typical laptop.
- Codex draw path: target 12-18 fps, not 24-60 fps.
- Canvas/WebGL internal render scale: default 0.35-0.6 for Codex, 0.5-0.75 for Claude, 0.75 or less on mobile.
- At most one heavy effect should compile per frame or idle slice.
- During same-model merge, run one effect instance only.
- During crossfade, only incoming plus outgoing may exist, and outgoing must be destroyed after the fade.

Add temporary performance marks while working. Remove noisy console logs before finishing, or guard them behind a local debug flag.

Example instrumentation:

```js
const EFFECT_DEBUG = false;

function mark(name) {
  if (EFFECT_DEBUG) performance.mark(name);
}

function measure(name, start, end) {
  if (!EFFECT_DEBUG) return;
  performance.measure(name, start, end);
  console.table(performance.getEntriesByName(name).slice(-1));
}
```

## First Paint Fix

The model page must not block on effect construction.

Change the mount sequence so the page paints the cards, title, CSS background, and controls first. Then initialize effects after the first paint or in idle time.

Recommended flow in `updateModelSplit()` or the effect manager:

```js
syncModelEffectsDeferred(modelSplitBg, {
  primary: primary.effect,
  secondary: secondary.effect,
  merged
});
```

Implementation guidance:

```js
function afterFirstPaint(callback) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(callback, { timeout: 250 });
      } else {
        setTimeout(callback, 32);
      }
    });
  });
}
```

Rules:

- Do not compile two WebGL programs in the same frame.
- Queue effect setup by side.
- If the user changes dropdowns before the queued setup runs, cancel stale setup.
- Show the existing CSS atmosphere immediately so there is no blank field.
- In reduced motion, skip expensive animated setup where possible and paint a static frame only.

## Render Scale

Add explicit internal render scaling per effect. Do not rely only on DPR caps.

Config shape:

```js
renderScale: 0.5,
mobileRenderScale: 0.38,
maxCanvasPixels: 650000
```

Sizing rule:

```js
const cssW = Math.round(rect.width);
const cssH = Math.round(rect.height);
const scale = isMobile() ? config.mobileRenderScale : config.renderScale;
const cappedDpr = Math.min(window.devicePixelRatio || 1, config.dprCap || 1);
const pixelRatio = Math.min(cappedDpr * scale, 1);

let pixelW = Math.max(1, Math.round(cssW * pixelRatio));
let pixelH = Math.max(1, Math.round(cssH * pixelRatio));

const pixels = pixelW * pixelH;
if (pixels > config.maxCanvasPixels) {
  const down = Math.sqrt(config.maxCanvasPixels / pixels);
  pixelW = Math.max(1, Math.round(pixelW * down));
  pixelH = Math.max(1, Math.round(pixelH * down));
}

canvas.width = pixelW;
canvas.height = pixelH;
canvas.style.width = "100%";
canvas.style.height = "100%";
```

Effects should look atmospheric when upscaled. If Codex needs crispness, draw at low resolution and add CSS image rendering or a tiny blur/opacity treatment. Do not choose crispness over responsiveness.

## Codex: Fix Lag And Add Variance

The current Codex WebGL path is likely too expensive because the fragment shader samples `digit()` many times per pixel and each `digit()` calls layered noise. Full-screen per-pixel shader work is not worth it for a background texture.

Choose one of these paths:

### Preferred Path: Cheap Canvas Terminal Field

Replace the Codex effect with a lower-resolution 2D canvas renderer.

Draw a terminal field as cells, not per full-resolution pixel:

- compute a grid of cells, for example 64-120 columns depending on viewport
- draw small glyph blocks, ticks, scanline fragments, and sparse bars
- use a seeded noise field for intensity
- update only a subset of rows/cells per frame
- add occasional horizontal row displacement
- add mouse ripple/intensity influence
- draw at 12-18 fps
- render at internal scale around 0.45

This will be much cheaper and can still look closer to FaultyTerminal.

Suggested config:

```js
codex: {
  type: "faulty-terminal",
  renderer: "canvas-cells",
  tint: "#1F9D78",
  renderScale: 0.45,
  mobileRenderScale: 0.32,
  maxCanvasPixels: 420000,
  fpsCap: 15,
  columnsSplit: 92,
  columnsMerged: 118,
  rowsMin: 34,
  glyphDensity: 0.42,
  intensityBase: 0.18,
  intensityVariance: 0.62,
  noiseScale: 0.075,
  noiseSpeed: 0.34,
  scanlineIntensity: 0.12,
  glitchChance: 0.075,
  glitchRows: [1, 4],
  glitchShiftPx: 10,
  flickerAmount: 0.14,
  ditherAmount: 0.08,
  mouseStrength: 0.34,
  cursorSmoothing: 0.08,
  brightness: 0.54,
  opacity: 0.5
}
```

Visual requirements:

- It should not look like a static square grid.
- It needs pockets of density and pockets of quiet.
- It needs faint rolling scanlines.
- It needs occasional horizontal row tears.
- It needs subtle cell-level flicker.
- It must not look like Matrix rain.
- It must not become a dark terminal panel.

Useful drawing approach:

```js
for (let row = 0; row < rows; row += 1) {
  const rowNoise = noise(row * 0.17, time * noiseSpeed);
  const rowShift = activeGlitchRows.has(row) ? glitchShift : 0;

  for (let col = 0; col < cols; col += 1) {
    const n = fbm(col * noiseScale, row * noiseScale, time * noiseSpeed);
    const mouse = mouseInfluence(col, row);
    const on = n + mouse > thresholdForCell(col, row);
    if (!on) continue;

    const alpha = base + n * intensityVariance + mouse * mouseStrength;
    drawGlyphFragment(ctx, x + rowShift, y, cellW, cellH, alpha);
  }
}
```

If you use noise helpers, keep them cheap and deterministic. Avoid allocating arrays inside the frame loop.

### Acceptable Path: Optimized WebGL Terminal

If you keep WebGL, simplify it aggressively:

- remove the 3x3 neighbor `digit()` sampling
- reduce fBM octaves
- render at low internal resolution
- cap at 12-18 fps
- avoid full-resolution chromatic aberration
- avoid expensive trig-heavy repeated calls
- use a tiny precomputed noise texture if needed

The output should gain more FaultyTerminal variance while using less GPU time than the current shader.

## Claude: Fix One Giant Blob

The current Claude effect has the right warm feel, but it visually collapses into one huge continuous shape. Fix the metaball field so it reads as distinct balls with local merging.

Likely causes to investigate:

- `clumpFactor` below `1` compresses ball positions toward the center.
- ball radii are too large for the world spacing.
- threshold/softness settings create one continuous filled region.
- the CSS bloom layers may be visually merging with the metaball canvas.
- fallback 2D radial blobs may overlap too heavily.

Required design:

- Preserve Claude's warm clay/amber colors.
- Keep the soft organic feel.
- Show multiple separate metaballs, not one field-sized blob.
- Leave visible negative space between clusters.
- Merging should happen locally between nearby balls or the cursor ball.
- In merged Claude/Claude mode, fill the full screen with several clusters, not one blob.

Tune toward this starting config:

```js
claude: {
  type: "metaballs",
  color: "#C97A3D",
  cursorBallColor: "#EBC9A6",
  renderScale: 0.62,
  mobileRenderScale: 0.45,
  maxCanvasPixels: 620000,
  fpsCap: 24,
  ballCountSplit: 11,
  ballCountMerged: 17,
  animationSize: 42,
  minBallRadius: 1.35,
  maxBallRadius: 2.8,
  cursorBallSize: 2.25,
  hoverSmoothness: 0.075,
  clumpFactor: 1.35,
  spreadX: 1.08,
  spreadY: 0.92,
  speed: 0.18,
  threshold: 2.9,
  softness: 0.055,
  opacity: 0.46
}
```

Important: either redefine `clumpFactor` so values above `1` spread balls apart, or rename it to `spreadFactor`. Do not keep a config where `0.82` pulls every ball toward one large shared mass.

Coordinate rule:

```js
const worldHeight = config.animationSize;
const worldWidth = worldHeight * (canvas.width / Math.max(1, canvas.height));
```

Distribution rule:

- Place balls across the full `worldWidth` and `worldHeight`.
- Avoid pure center clustering.
- Use deterministic distribution plus small jitter.
- Keep at least two or three clusters per side.
- Keep outer balls partially near edges so the field does not read as one centered puddle.

Shader rule:

- A single ball should have a clear circular boundary.
- Nearby balls should merge only when their fields overlap.
- If more than 45 percent of the side is filled by the metaball alpha at rest, it is too blobby.

Add a temporary debug mode if useful:

```js
debugCenters: false
```

When enabled locally, draw ball centers/radii over the effect. Remove or keep disabled by default.

Also check CSS blooms. If the large warm `.atmos-blob` layers are making Claude look like one giant blob even after shader tuning, lower their opacity or mask them more softly for `effect="metaballs"`.

## Gemini And Claude Cursor Stillness Fix

Fix the cursor handoff behavior for both Gemini and Claude.

Current likely cause:

- `AntigravityEffect` uses `isIdle(now, cfg.idleDelayMs)` and then switches from the real pointer to an idle Lissajous target.
- `MetaballsEffect._cursorTarget()` uses `!this.isIdle(now, 1200)` and then switches to an idle center orbit.
- This makes a stationary cursor appear to "reset" after the delay, even though the user's cursor is still intentionally parked in one place.

Interaction rule:

- If the pointer is inside the effect's host rect, the effect must continue to target the real pointer forever, even if the pointer is stationary.
- Idle autopilot is allowed only when the pointer has never entered the effect, or after the pointer has left the host rect.
- If idle autopilot starts after pointer leave, it must blend away from the last cursor position smoothly. It must not snap to center.
- Do not use "time since last pointermove" alone as the definition of idle.

Add pointer-inside tracking to the base controller.

Suggested shape:

```js
this.pointerInside = false;
this.hasPointer = false;

_handlePointer(event) {
  const rect = this.rect;
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  this.pointerInside = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
  if (!this.pointerInside) return;

  this.hasPointer = true;
  this.pointer.x = x;
  this.pointer.y = y;
  this.pointerNorm.x = clamp(x / (rect.width || 1), 0, 1);
  this.pointerNorm.y = clamp(y / (rect.height || 1), 0, 1);
  this.lastPointerMove = performance.now();
}

shouldUsePointer() {
  return this.hasPointer && this.pointerInside;
}

shouldUseIdleAutopilot() {
  return !this.pointerInside;
}
```

Because the canvas has `pointer-events: none`, window-level `pointermove` is fine. Just compute whether the pointer is inside the host rect. If the pointer leaves and no new pointer events arrive, the last known inside state may remain stale; guard by recomputing against `rect` in the pointer handler and by treating coordinates outside the rect as `pointerInside = false`.

Update Gemini:

```js
if (this.shouldUsePointer()) {
  targetX = this.pointer.x;
  targetY = this.pointer.y;
} else if (cfg.autoAnimate) {
  // idle motion is allowed only outside/never-entered, and should start from the
  // current virtual cursor position rather than snapping to a new center orbit.
}
```

Update Claude:

```js
const interactive = this.config.enableMouseInteraction && this.shouldUsePointer();
if (interactive) {
  return { x: this.pointerNorm.x * cw, y: (1 - this.pointerNorm.y) * ch };
}
```

Idle orbit for Claude should use the current `mouseBall` as its starting point and a small orbit radius. It should not reinitialize to center when the cursor stops.

Add or rename config values so the behavior is clear:

```js
idleMode: "when-outside",
idleReleaseDelayMs: 0,
idleDriftRadiusRatio: 0.12,
holdCursorWhenStill: true
```

`holdCursorWhenStill: true` is mandatory for Gemini and Claude.

Verification for this specific issue:

1. Choose Gemini on either side, place the cursor over the field, stop moving for 10 seconds. The antigravity ring must stay at that cursor position. It may keep breathing/waving, but it must not recenter or jump to an idle path.
2. Choose Claude on either side, place the cursor over the field, stop moving for 10 seconds. The cursor metaball must stay at that cursor position. It may keep softly merging, but it must not drift back to center.
3. Move the cursor out of the viewport or out of the effect side. Idle motion may begin, but it must blend smoothly from the last known position.
4. Repeat in same-model merged mode.

## Effect Lifecycle Improvements

The current manager already has `start()`, `stop()`, `resize()`, `renderStaticFrame()`, and `destroy()`. Tighten it:

- Add an initialization queue so expensive setup is deferred and cancelable.
- Add render-scale sizing to the base controller.
- Do not create a WebGL context until the instance is actually needed.
- Do not create a secondary controller in merged mode.
- During crossfade, stop outgoing animation once opacity reaches zero, then destroy.
- On rapid dropdown changes, cancel pending setup and destroy stale incoming instances.
- On reduced motion, skip loops and paint one static frame.

Pseudo shape:

```js
let setupToken = 0;

function scheduleEffectSetup(run) {
  const token = ++setupToken;
  afterFirstPaint(() => {
    if (token !== setupToken) return;
    run();
  });
  return token;
}
```

For two split effects, stagger setup:

```js
scheduleEffectSetup(() => mountPrimary());
scheduleEffectSetup(() => afterFirstPaint(() => mountSecondary()));
```

Or use a small queue:

```js
const setupQueue = [];
let setupRunning = false;

function enqueueSetup(task) {
  setupQueue.push(task);
  pumpSetupQueue();
}

function pumpSetupQueue() {
  if (setupRunning || !setupQueue.length) return;
  setupRunning = true;
  afterFirstPaint(() => {
    const task = setupQueue.shift();
    task?.();
    setupRunning = false;
    pumpSetupQueue();
  });
}
```

## CSS Performance

Review `public/styles.css` for model-screen loops.

Keep CSS ambient motion subtle, but do not stack too many full-screen moving layers with canvas effects.

Potential fixes:

- Lower `.atmos-flow` and `.atmos-blob` opacity when a heavy canvas effect is active.
- Disable or reduce CSS blob motion for Claude if the canvas itself carries the organic movement.
- Avoid `filter: blur(...)` on many large moving elements if it causes paint cost.
- Use `contain: paint` on effect instances if it helps.

Example:

```css
.fx-instance {
  contain: paint;
}

:root[data-screen="models"] .atmos[data-effect="metaballs"] .atmos-blob {
  opacity: 0.28;
}
```

Do not remove all atmosphere. Reduce overlapping expensive layers where they are redundant.

## Reduced Motion

Reduced motion remains mandatory.

When enabled:

- no Codex flicker/glitch loop
- no Claude ball movement
- no Gemini particle movement
- no flowing gradient or blob drift
- paint a static version of the chosen effect if cheap
- otherwise use the CSS color atmosphere only

## Verification

Run:

```bash
npm run dev:local
npm test
```

Verify with the browser at:

- 1365 x 768, matching the screenshots
- 1440 x 900
- 390 x 844

Manual checks:

1. Navigate to the model page. The cards/title appear immediately, before effect setup completes.
2. Codex/Codex no longer lags the page.
3. Codex has visible variance: noise pockets, faint scanlines, row displacement, and subtle flicker.
4. Codex does not become a black terminal, Matrix rain, or a uniform square grid.
5. Claude/Claude shows several metaballs or clusters with negative space, not one huge blob.
6. Claude colors still feel warm and good.
7. Claude split with Gemini or Codex stays inside its side.
8. Same-model merge still uses one full-screen effect and no seam.
9. Rapid dropdown changes do not leave old canvases or running loops behind.
10. Reduced motion stops all continuous motion.
11. No console errors.
12. No performance long tasks over 50ms from effect setup in the normal path.

## Final Report

When done, summarize:

- what changed for first-paint performance
- what changed for Codex rendering/performance/variance
- what changed for Claude metaball separation
- before/after performance observations
- any remaining tradeoffs
