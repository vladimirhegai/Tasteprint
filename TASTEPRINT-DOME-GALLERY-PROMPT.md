# Master Prompt: Replace Intro Grid With A Non-Clickable Dome Gallery

You are implementing a frontend change in the Tasteprint repo. Tasteprint is a local onboarding tool for builders using AI coding agents. The visual register is calm, precise, editorial, premium, and technical. The intro is the rare first-impression moment, so it can have cinematic motion, but it must stay quiet enough that the wordmark and "Start Designing" CTA remain the primary interaction.

Important: this project does not use React. Do not install React or `@use-gesture/react`. Port the React Bits DomeGallery idea into the existing vanilla HTML/CSS/JS app.

## Current Project Context

- Entry HTML: `public/index.html`
- Intro render code: `public/app.js`, `mountIntro()` around lines 542-616
- Current grid backdrop markup is inside `.intro-field`:
  ```html
  <div class="intro-field" id="introField">
    <div class="intro-grid"></div>
    <div class="intro-grid-glow"></div>
  </div>
  ```
- Current intro grid CSS starts around `public/styles.css:1600`.
- Current exit flow uses `.intro.is-leaving` and `.intro-stage.is-exiting` in `exitIntro()`.
- Reduced motion is already handled in `mountIntro()` via:
  ```js
  const reduce = ANATOMY_EDIT || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  ```

## Goal

Replace the intro grid line backdrop with a dome gallery inspired by React Bits `DomeGallery`, adapted to vanilla JS/CSS. The gallery must sit behind the intro wordmark and CTA, enter with the intro, leave with the intro, rotate slowly to the right automatically, and also respond to mouse/pointer dragging. The images are temporary stock images from the React Bits defaults; they will eventually be website screenshots.

## Non-Negotiables

- Do not implement React.
- Do not add dependencies.
- Do not make the image tiles clickable. No `button`, no `role="button"`, no `tabIndex`, no click-to-open, no scrim, no enlarged image overlay.
- The gallery is decorative: `aria-hidden="true"`, empty image alt text, no keyboard focus.
- Keep the text and CTA above the gallery. The CTA must remain fully clickable.
- The dome must not feel tall or vertical. It should read as a wide, low, horizontal band behind the wordmark.
- Keep the existing wordmark letter entrance and exit. Add the gallery entrance/exit around it.
- Respect `prefers-reduced-motion`: no auto rotation, no drag inertia, no looping animation. Render a quiet static gallery.
- Animate only `transform`, `opacity`, and optionally `filter`. Do not animate layout properties.

## Visual Direction

The dome should feel like a curated wall of future website screenshots, not a loud carousel. Use restrained opacity, soft edge fades, and a light wash behind the text so the wordmark remains crisp. Use rectangular website-like tiles, not large rounded square art cards.

Recommended values:

- Dome container: full viewport, behind `.intro-stage`
- Visible band: roughly `min(70vh, 620px)` tall, centered slightly above the title baseline
- Radius: `clamp(540px, 68vw, 980px)`
- Perspective: `calc(var(--dome-radius) * 2)`
- Vertical rotation clamp: `-8deg` to `8deg`
- Auto rotate: about `2.5deg` to `4deg` per second to the right
- Tile shape: `aspect-ratio: 16 / 10`, `border-radius: 10px` or `12px`
- Tile filter: slightly muted, for example `saturate(.78) contrast(.96) brightness(1.02)`
- Overlay: radial/linear fades using `var(--canvas)` so the gallery does not compete with text

## Suggested Markup Change

In `mountIntro()`, replace the grid children inside `.intro-field` with a dome mount:

```js
app.innerHTML = `
  <div class="intro ${reduce ? "is-static" : ""}">
    <div class="intro-field" id="introField">
      <div class="intro-dome-layer" id="introDome" aria-hidden="true"></div>
    </div>
    <div class="intro-stage" id="introStage">
      <h1 class="intro-wordmark" aria-label="${esc(INTRO_WORD)}">${letters}</h1>
      <button class="intro-cta" data-action="start-designing" style="--cta-delay:${INTRO_CTA_DELAY}ms">
        <span class="intro-cta-label">Start Designing</span>
      </button>
      ${introAnatomyHtml()}
    </div>
  </div>
`;
```

Then mount the vanilla gallery after querying `intro`:

```js
const dome = app.querySelector("#introDome");
if (dome) {
  introDomeCleanup = mountIntroDomeGallery(dome, { inputTarget: intro, reduce });
}
```

Add cleanup near the existing intro cleanup:

```js
let introDomeCleanup = null;

function clearIntroTimers() {
  introTimers.forEach(clearTimeout);
  introTimers = [];
  introDomeCleanup?.();
  introDomeCleanup = null;
  if (introMoveTarget && introMoveHandler) {
    introMoveTarget.removeEventListener("pointermove", introMoveHandler);
  }
  introMoveTarget = null;
  introMoveHandler = null;
}
```

You can remove the old `introMoveHandler` grid spotlight behavior once the grid is gone.

## Starter Vanilla JS

Use this as the implementation starting point, not as a final copy-paste mandate. Fit it into `public/app.js` near the intro helpers.

```js
const DOME_IMAGES = [
  "https://images.unsplash.com/photo-1755331039789-7e5680e26e8f?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1755569309049-98410b94f66d?q=80&w=772&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1755497595318-7e5e3523854f?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1755353985163-c2a0fe5ac3d8?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1745965976680-d00be7dc0377?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1752588975228-21f44630bb3c?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://pbs.twimg.com/media/Gyla7NnXMAAXSo_?format=jpg&name=large"
];

function mountIntroDomeGallery(root, { inputTarget, reduce }) {
  const segments = 28;
  const xCols = Array.from({ length: segments }, (_, i) => -28 + i * 2);
  const rows = [-3, -1, 1, 3];
  const items = xCols.flatMap((x, col) => rows.map((y, row) => ({
    x,
    y: y + (col % 2 ? 0.65 : 0),
    src: DOME_IMAGES[(col * rows.length + row) % DOME_IMAGES.length]
  })));

  root.innerHTML = `
    <div class="intro-dome-stage">
      <div class="intro-dome-sphere">
        ${items.map((item) => `
          <div class="intro-dome-item" style="--x:${item.x};--y:${item.y}">
            <img class="intro-dome-img" src="${esc(item.src)}" alt="" draggable="false" loading="eager" />
          </div>
        `).join("")}
      </div>
    </div>
  `;

  const sphere = root.querySelector(".intro-dome-sphere");
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  let rotX = -2;
  let rotY = -12;
  let frame = 0;
  let last = performance.now();
  let dragging = false;
  let lastPointer = null;

  const apply = () => {
    sphere.style.transform = `translateZ(calc(var(--dome-radius) * -1)) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  };

  const tick = (now) => {
    const dt = Math.min(40, now - last);
    last = now;
    if (!reduce && !dragging) {
      rotY += dt * 0.0032;
      apply();
    }
    frame = requestAnimationFrame(tick);
  };

  const onPointerDown = (event) => {
    if (reduce || event.target.closest(".intro-cta, [data-action]")) return;
    dragging = true;
    lastPointer = { x: event.clientX, y: event.clientY };
    inputTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!dragging || !lastPointer) return;
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    lastPointer = { x: event.clientX, y: event.clientY };
    rotY += dx / 18;
    rotX = clamp(rotX - dy / 30, -8, 8);
    apply();
  };

  const onPointerUp = () => {
    dragging = false;
    lastPointer = null;
  };

  apply();
  if (!reduce) frame = requestAnimationFrame(tick);
  inputTarget?.addEventListener("pointerdown", onPointerDown);
  inputTarget?.addEventListener("pointermove", onPointerMove);
  inputTarget?.addEventListener("pointerup", onPointerUp);
  inputTarget?.addEventListener("pointercancel", onPointerUp);

  return () => {
    cancelAnimationFrame(frame);
    inputTarget?.removeEventListener("pointerdown", onPointerDown);
    inputTarget?.removeEventListener("pointermove", onPointerMove);
    inputTarget?.removeEventListener("pointerup", onPointerUp);
    inputTarget?.removeEventListener("pointercancel", onPointerUp);
  };
}
```

## Starter CSS

Place this in the intro section of `public/styles.css`, replacing the `.intro-grid` and `.intro-grid-glow` rules. Keep `.intro`, `.intro-stage`, `.intro-wordmark`, `.intro-cta`, letter animations, and anatomy rules unless you need minor z-index tuning.

```css
.intro-field {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 0;
}

.intro-dome-layer {
  position: absolute;
  left: 50%;
  top: 48%;
  width: min(1320px, 132vw);
  height: min(70vh, 620px);
  transform: translate3d(-50%, -50%, 0) scale(0.985);
  opacity: 0;
  filter: blur(10px);
  animation: intro-dome-in 900ms var(--ease) 140ms both;
  pointer-events: none;
  --dome-radius: clamp(540px, 68vw, 980px);
  --dome-segments: 28;
  --dome-rot-y: calc((360deg / var(--dome-segments)) / 2);
  --dome-rot-x: calc((360deg / var(--dome-segments)) / 2);
  --dome-circ: calc(var(--dome-radius) * 3.14);
  --dome-tile-w: calc(var(--dome-circ) / var(--dome-segments) * 2.25);
  --dome-tile-h: calc(var(--dome-tile-w) * 0.62);
}

.intro-dome-layer::after {
  content: "";
  position: absolute;
  inset: -1px;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 48%, transparent 0 28%, color-mix(in srgb, var(--canvas) 82%, transparent) 62%, var(--canvas) 100%),
    linear-gradient(to bottom, var(--canvas), transparent 22%, transparent 68%, var(--canvas));
}

.intro-dome-stage {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  perspective: calc(var(--dome-radius) * 2);
  perspective-origin: 50% 46%;
  transform-style: preserve-3d;
}

.intro-dome-sphere,
.intro-dome-item {
  transform-style: preserve-3d;
}

.intro-dome-sphere {
  will-change: transform;
}

.intro-dome-item {
  position: absolute;
  width: var(--dome-tile-w);
  height: var(--dome-tile-h);
  inset: -999px;
  margin: auto;
  backface-visibility: hidden;
  transform:
    rotateY(calc(var(--dome-rot-y) * var(--x)))
    rotateX(calc(var(--dome-rot-x) * var(--y)))
    translateZ(var(--dome-radius));
}

.intro-dome-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  border-radius: 11px;
  box-shadow: 0 18px 48px color-mix(in srgb, var(--ink) 14%, transparent);
  filter: saturate(.78) contrast(.96) brightness(1.02);
  opacity: .74;
  pointer-events: none;
  user-select: none;
}

.intro-stage {
  position: relative;
  z-index: 2;
}

.intro.is-leaving .intro-dome-layer {
  opacity: 0;
  filter: blur(8px);
  transform: translate3d(-50%, calc(-50% - 8px), 0) scale(0.975);
  transition: opacity 320ms var(--ease), filter 320ms var(--ease), transform 320ms var(--ease);
}

@keyframes intro-dome-in {
  from {
    opacity: 0;
    filter: blur(12px);
    transform: translate3d(-50%, calc(-50% + 18px), 0) scale(0.965);
  }
  to {
    opacity: .42;
    filter: blur(0);
    transform: translate3d(-50%, -50%, 0) scale(1);
  }
}

.intro.is-static .intro-dome-layer {
  opacity: .36;
  filter: none;
  transform: translate3d(-50%, -50%, 0);
  animation: none;
}

@media (max-width: 720px) {
  .intro-dome-layer {
    width: 168vw;
    height: min(62vh, 520px);
    top: 46%;
    --dome-radius: clamp(480px, 112vw, 760px);
    --dome-tile-w: calc(var(--dome-circ) / var(--dome-segments) * 2.05);
  }
}

@media (prefers-reduced-motion: reduce) {
  .intro-dome-layer,
  .intro.is-leaving .intro-dome-layer {
    animation: none !important;
    transition: none !important;
    opacity: .34;
    filter: none;
    transform: translate3d(-50%, -50%, 0);
  }
}
```

## Anatomy Blueprint Note

The existing CTA hover anatomy includes a `Canvas / 44px` grid callout. Since the grid is being removed, either remove the `.bp-grid-note` node from `introAnatomyHtml()` or rename it to something accurate like `Gallery / ambient`. If keeping it, make sure it still reads as a design-tool annotation and does not point at a clickable image.

## Verification Checklist

- Start the app with `npm run dev` or `npm run dev:local`.
- Confirm the intro first viewport shows the dome behind `Tasteprint` and the CTA.
- Confirm the old grid lines are gone.
- Confirm the dome enters softly and leaves when "Start Designing" is clicked.
- Confirm the dome slowly rotates right when idle.
- Confirm pointer dragging turns the dome, but clicking images does nothing.
- Confirm clicking the CTA still starts the flow.
- Confirm reduced motion shows a static dome and does not run auto-rotation.
- Check desktop and mobile widths. The gallery must remain a wide horizontal band, not a tall vertical wall.
- Check text legibility over the images. If noisy, lower `.intro-dome-layer` opacity or strengthen the overlay wash before changing the wordmark.
