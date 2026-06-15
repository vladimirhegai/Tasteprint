# Master Prompt: Model-Specific Background Effects

You are the implementation agent. Implement this end to end.

## Objective

Improve the `Choose your model pair.` page by giving each model its own background animation:

- Gemini: inspired by React Bits `Antigravity`
- Codex: inspired by React Bits `FaultyTerminal`
- Claude: inspired by React Bits `MetaBalls`

The React Bits prompts are references only. Tasteprint does not use React, and this project should stay vanilla HTML, CSS, and JavaScript.

These effects are model atmospheres behind the cards, not demo-centerpieces. The page should still feel calm, precise, editorial, and task-focused.

## Source Material

Read these before editing:

1. `PRODUCT.md`
2. `public/app.js`
3. `public/styles.css`
4. `C:\Users\vladh\.codex\attachments\abea8c15-2e6a-4ff6-ac7a-279b0183d477\pasted-text.txt`
5. `C:\Users\vladh\.codex\attachments\0d422b9f-3a95-450b-9abe-2e8fda6c29fb\pasted-text.txt`
6. `C:\Users\vladh\.codex\attachments\03a5be07-d06f-4524-8f95-8d99264550f5\pasted-text.txt`

Current landmarks:

- `public/app.js`
  - `MODEL_WORLDS`
  - `updateModelSplit()`
  - `atmosLayersHtml()`
  - `clearModelSplit()`
  - `renderModels()`
  - `refreshModelCard()`
- `public/styles.css`
  - `.model-atmos`
  - `.atmos-primary`
  - `.atmos-secondary`
  - `.fx`
  - `.model-seam`
  - `.model-stage`
  - `.panel.model-card`
  - the `prefers-reduced-motion` block near the bottom

## Hard Constraints

- No React.
- No `@react-three/fiber`.
- Do not add a framework or build step.
- Do not change model detection, invocation, orchestration, or backend behavior.
- Do not touch non-model-pair screens unless required for cleanup.
- Do not let canvases intercept pointer events.
- Do not let effects sit above the cards.
- Preserve `npm run dev:local`.
- Keep `npm test` green.
- Stop all animation loops and observers when leaving the model screen.
- Respect `prefers-reduced-motion: reduce`.

New vanilla JS modules are allowed, for example `public/modelEffects.js`, imported by `public/app.js`.

## Design Direction

This is product UI, not a marketing hero. Users are choosing tools before starting work. Motion can create identity and atmosphere, but readability and control usability win.

Use this motion weighting:

- Primary: Jakub Krehel production polish
- Secondary: Emil Kowalski restraint and frequency gating
- Selective: Jhey Tompkins creative shader/CSS exploration

Avoid:

- generic AI gradients
- heavy neon
- black hacker-terminal panels
- lava-lamp intensity
- bouncy motion
- excessive glow
- effects that fight the select controls

## Architecture

Refactor the existing atmosphere into two separate concepts:

1. Color world: palette variables for the side, cards, ink, hairline, accent, glow, and radius.
2. Effect world: a managed animation controller mounted into that side.

The model-to-effect mapping should be explicit:

```js
const MODEL_WORLDS = {
  codex: {
    // existing palette fields...
    effect: "faulty-terminal",
  },
  claude: {
    // existing palette fields...
    effect: "metaballs",
  },
  gemini: {
    // existing palette fields...
    effect: "antigravity",
  },
};
```

Update the atmosphere layer markup so each side has one effect stage:

```js
function atmosLayersHtml(side) {
  return `
    <div class="atmos-flow"></div>
    <div class="atmos-blob blob-a"></div>
    <div class="atmos-blob blob-b"></div>
    <div class="fx-stage" data-side="${side}"></div>
  `;
}
```

In `updateModelSplit()`, mount or update the effect controllers:

```js
modelSplitBg.innerHTML = `
  <div class="atmos atmos-primary">${atmosLayersHtml("primary")}</div>
  <div class="atmos atmos-secondary">${atmosLayersHtml("secondary")}</div>
  <div class="model-seam"></div>
`;

syncModelEffects(modelSplitBg, {
  primary: primary.effect,
  secondary: secondary.effect,
  merged,
});
```

In `clearModelSplit()`, destroy all effect controllers.

## Split And Merge Rules

The page is split screen by default:

- primary model: top-left field
- secondary model: bottom-right field

Effects must only occupy their side of the split. When primary and secondary are the same model, the fields merge:

- seam opacity becomes `0`
- one full-screen effect remains visible
- the duplicated secondary effect is hidden or destroyed
- card colors and CTA behavior still read from the two selected roles

Recommended CSS:

```css
.fx-stage {
  position: absolute;
  inset: 0;
  z-index: 3;
  overflow: hidden;
  pointer-events: none;
}

.fx-instance {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 600ms var(--ease);
}

.fx-instance.is-active {
  opacity: var(--fx-opacity, 1);
}

.fx-instance canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.atmos-primary .fx-stage {
  -webkit-mask-image: linear-gradient(138deg, #000 41%, transparent 59%);
  mask-image: linear-gradient(138deg, #000 41%, transparent 59%);
}

:root[data-merged="true"] .atmos-primary .fx-stage {
  -webkit-mask-image: none;
  mask-image: none;
}

:root[data-merged="true"] .atmos-secondary .fx-stage {
  opacity: 0;
}
```

Keep all card and control layers above `.model-atmos`.

## Required Config

Every meaningful custom value must live in a visible config object. Do not bury tuning values inside render loops.

Use this shape as the starting point and tune it in the browser:

```js
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
    dprCap: 1.5,
  },

  codex: {
    type: "faulty-terminal",
    tint: "#1F9D78",
    glyphSet: "01{}[]<>/_\\",
    scale: 1.65,
    gridMul: [2, 1],
    digitSize: 1.15,
    cellSize: 18,
    timeScale: 0.55,
    fpsCap: 24,
    scanlineIntensity: 0.11,
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
    brightness: 0.42,
    opacity: 0.46,
    dprCap: 1.5,
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
    spreadX: 0.9,
    spreadY: 0.78,
    threshold: 1.12,
    softness: 0.12,
    opacity: 0.48,
    dprCap: 1.35,
  },
};
```

## Controller Interface

Create effect controllers with one shared interface:

```js
controller.start();
controller.stop();
controller.resize();
controller.renderStaticFrame();
controller.destroy();
```

Use:

- `ResizeObserver`
- `requestAnimationFrame`
- `matchMedia("(prefers-reduced-motion: reduce)")`
- `document.visibilitychange`
- capped DPR

When the tab is hidden, stop or throttle loops. When visible again, resume cleanly.

Reduced motion should call `renderStaticFrame()` and should not run continuous RAF loops.

## Crossfade Behavior

On model switch:

1. Keep the outgoing effect visible.
2. Mount the incoming effect.
3. Fade incoming in and outgoing out over `600ms var(--ease)`.
4. Destroy the outgoing controller after the transition.

Only active and outgoing effects should animate. Do not keep all possible model effects running at opacity `0`.

## Gemini Effect: Antigravity

Port the feel of React Bits `Antigravity` into vanilla canvas.

Required qualities:

- many small particles
- pointer-influenced magnetic field
- loose ring formation around cursor
- smooth virtual cursor interpolation
- idle auto-animation when pointer is inactive
- wave/ring variance
- particle size variance
- optional capsule-like particle drawing
- split and merged modes both work

Implementation recommendation:

- Canvas 2D is acceptable and probably enough.
- No Three.js dependency.
- Use viewport-relative radius calculations so the effect scales to each side.
- Use low alpha and restrained blue/indigo/violet tones.

The effect should feel airy and suspended, not like a starfield.

## Codex Effect: Faulty Terminal

Port the feel of React Bits `FaultyTerminal` into vanilla canvas.

Required qualities:

- glyph/grid field
- scanlines
- subtle horizontal glitch displacement
- low flicker
- mouse-reactive intensity or ripple
- pale green technical tint
- transparent integration with the field behind it

Implementation recommendation:

- Canvas 2D is likely enough.
- Draw glyph cells at a capped frame rate.
- Use offscreen rows or cached glyph textures if needed.
- Keep brightness low enough that cards remain dominant.

The effect should read as precise technical texture, not a black terminal panel or Matrix screen.

## Claude Effect: MetaBalls

This effect needs the most careful adaptation.

The React Bits example can read as a small circle because its world is not tuned for large split-screen surfaces. Do not ship that. Claude's metaballs must fill the side and, in merged mode, fill the full viewport.

Required qualities:

- true soft merging blobs
- aspect-aware world coordinates
- balls distributed across the entire side
- cursor ball with smoothing
- exposed ball count, size, speed, clump, smoothness, threshold, and softness
- transparent rendering over the warm Claude field
- full-screen coverage when merged

Implementation recommendation:

- Prefer raw WebGL for true metaballs.
- If WebGL2 is unavailable, degrade to a tasteful static or 2D soft-circle field.
- Do not add `ogl`.

Coordinate rule:

```js
const worldHeight = config.animationSize;
const worldWidth = worldHeight * (canvasWidth / canvasHeight);
```

Use `worldWidth` and `worldHeight` to distribute balls. Do not keep all balls near `(0, 0)`.

Claude should feel warm, organic, and calm. Avoid intense lava-lamp motion.

## Card Readability

The cards must remain the main readable surface.

Check:

- body text contrast is at least 4.5:1
- labels and select text are at least 4.5:1
- focus rings are visible
- dropdowns are clickable
- canvases have `pointer-events: none`
- effects stay behind cards

If needed, add a subtle central readability wash inside `.model-atmos`, but avoid glassmorphism and avoid adding cards inside cards.

## Responsive Behavior

Desktop:

- preserve diagonal split
- effects are side-specific
- same-model selection merges to full screen

At `max-width: 860px`:

- keep the existing stacked-card layout
- reduce particle counts, glyph density, and metaball count
- avoid visual fighting behind stacked cards
- no horizontal overflow

Mobile:

- performance beats richness
- keep effects quieter
- cap DPR more aggressively if needed

## Reduced Motion

Extend the existing reduced-motion block and JS behavior.

When reduced motion is enabled:

- no antigravity particle motion
- no terminal flicker or glitch loops
- no metaball movement
- no idle card float
- no flowing gradient movement
- static fields may remain visible
- palette/effect crossfades may remain if they do not create large movement

Do not simply hide all model identity unless the static result is broken.

## Performance Budget

- Cap DPR per effect.
- Avoid layout reads inside RAF loops except when resizing.
- Animate only `transform`, `opacity`, or canvas pixels.
- Keep expensive WebGL/canvas work out of hidden or zero-opacity instances.
- Destroy old controllers after crossfade.
- Confirm no runaway RAF after leaving the page.

## Verification

Run:

```bash
npm run dev:local
npm test
```

Verify in browser at:

- 1440 x 900
- 1024 x 768
- 390 x 844

Manual checks:

1. Gemini/Gemini: seam disappears and antigravity fills the full viewport.
2. Codex/Codex: seam disappears and faulty-terminal texture fills the full viewport.
3. Claude/Claude: seam disappears and metaballs fill the full viewport, not a small central circle.
4. Gemini/Codex, Codex/Claude, Gemini/Claude: each effect stays in its own side.
5. Switching either dropdown crossfades the effect rather than hard-cutting.
6. Cards remain above effects.
7. Selects remain usable.
8. Reduced motion shows static fields without continuous animation.
9. There are no console errors.
10. There are no leaking RAF loops, observers, or WebGL contexts after leaving the model screen.

## Out Of Scope

- No full app redesign.
- No changes to intake, followups, preview, final, or generated files screens.
- No backend or orchestrator changes.
- No new framework.
- No React.
- No dependencies unless absolutely unavoidable and explicitly justified first.

