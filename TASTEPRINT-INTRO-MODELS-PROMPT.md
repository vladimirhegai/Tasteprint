# Master Prompt — Intro + Model-Pair Screen Pass

> Paste this whole file as the brief for a fresh session. It is scoped to **two screens only**:
> the **intro** reveal and the **"Choose your model pair."** screen. Do not touch other steps.
>
> This plan was written against the *actual current code* (not the older `TASTEPRINT-UPGRADE-PLAN.md`
> descriptions, which are now out of date for these two screens). Read the files listed below first —
> the intro and model atmosphere are already sophisticated; you are refining them, not building from zero.

---

## 0. Read first (in this order)

1. `TASTEPRINT-GUIDE.md` — architecture + onboarding flow (how `state.step`, `render`/`paint`, `bindEvents` work).
2. This file.
3. The code you will actually edit (both screens live almost entirely in two files):
   - `public/app.js` — intro: `mountIntro()` (~L484), `advanceFromIntro()` (~L547), timing consts (~L161–169); models: `MODEL_WORLDS` (~L64), `worldForModelId()` (~L88), `updateModelSplit()` (~L382), `MODEL_ROLE_COPY` (~L616), `renderModels()`/`renderModelSelector()` (~L621); actions: `handleAction()` (~L1370), keydown (~L1285).
   - `public/styles.css` — intro: `.intro*` (~L1461–1597); models: `.model-atmos` / `.atmos*` / `.model-seam` (~L525–705), `.model-stage` / `.model-card-wrap` / `.model-link` (~L711–758), `.panel.model-card*` (~L760+), motion token `--ease: cubic-bezier(0.16,1,0.3,1)` (~L41).

Do **not** follow `DESIGN-OLD.md`. There is no `DESIGN.md` at root — the product's whole premise is that the
design philosophy keeps shifting, so treat the *current* `public/` code as the living source of truth and evolve it.

---

## 1. Hard constraints (do not violate)

- **`npm run dev:local` must stay first-class.** Both screens are `STATIC` (no model calls), so everything here is
  pure frontend. After every change, run `npm run dev:local` (port 4317) and verify the screen in a real browser.
- **Vanilla JS only.** No build step, no runtime deps, Node stdlib only. The whole app re-renders via `innerHTML` +
  `bindEvents`; keep that model. Pure CSS/SVG for all motion (no animation libraries).
- **Motion budget:** ease `var(--ease)` = `cubic-bezier(0.16,1,0.3,1)`; UI transitions 120/180/280ms; idle/ambient
  motion may be longer but must stay subtle. No bounce, no confetti, one accent per viewport, hairlines over shadows.
- **`prefers-reduced-motion: reduce` is mandatory** for every new animation — show the final frame / crossfade, never
  movement. There is already a global reduced-motion block at the bottom of `styles.css` (~L1582); extend it.
- **Only animate `transform`/`opacity`** for anything that loops (idle float, bubbles, flowing gradients). Do not
  animate layout properties or `background-position` on large surfaces in a loop (use a transformed pseudo-layer).
- Keep `npm test` green (no test touches these screens, but don't break shared helpers).

---

## 2. Skill-usage map (use deliberately — do NOT overuse)

Four skills are installed under `.agents/skills/`. Each owns a specific moment below. **Do not run a skill on
every step.** One focused pass per skill, at the point it adds the most. Order of operations: motion-principles to
*design* the motion, impeccable to *build/redesign* the visuals, emil to *polish the interaction craft*, taste as a
final *anti-slop gut check*.

| Skill | Invoke as | Use it for (and only this) |
|---|---|---|
| **design-motion-principles** | invoke the skill in **Create** mode | Choreograph the new motion *before* coding: the button hover-anatomy reveal, the card idle float (run it through the **Frequency Gate** — this is a once-per-session first-impression screen, so subtle delight passes), the intro→models cross-dissolve, and the model-switch transition. Pull easing/stagger recipes from its Motion Cookbook. |
| **impeccable** | `$impeccable shape` then `$impeccable craft` for the build; `$impeccable critique` once on the model screen; `$impeccable polish` at the end | The *visual* redesign: model-card redesign, the Claude bubble effect, the "anatomy" blueprint overlay, lowering/recomposing the card stage. Honor its **absolute bans** (they directly apply here — see §5). |
| **emil-design-eng** | invoke the skill for a motion review | The fine interaction craft: the `Start Designing` button's `:active` scale feedback, exact easing curves/durations, "should this animate at all", and a final **Before/After table** review of all new motion. |
| **design-taste-frontend** | invoke the skill, **anti-slop lens only** | A single gut check at the end: Anti-Default Discipline, color calibration ("no AI-purple"), and the AI-slop test. **Ignore its stack guidance** — it assumes React/Tailwind/Motion/Next; this app is vanilla JS with no build step. Use only its taste principles, not its toolchain. |

**Heads-up on impeccable setup:** its `context.mjs` may report `NO_PRODUCT_MD`. If it does, don't get derailed into a
full `init` — for this scoped pass, read the existing `public/styles.css` tokens + a representative component (it asks
for this anyway) and proceed with `craft`/`polish` against the real code. Only do `init`/PRODUCT.md if the user asks.

---

## 3. Decisions already made (do not re-litigate)

- **Intro becomes button-driven; remove auto-advance.** Today `mountIntro()` sets `INTRO_TOTAL`/`INTRO_EXIT_START`
  timers that auto-exit into models. With a `Start Designing` button, the intro **waits for the click** — delete the
  auto-exit timers. (Reduced-motion still shows the final frame + button immediately, see §4.)
- **Remove the visible `Skip` button** (`.intro-skip` + its CSS). Keyboard `Enter`/`Space` naturally activates the
  focused CTA; keep `Esc` as a quiet a11y fast-path to models.
- **Anatomy reveal is capped at ~4 annotations** ("not TOO much"). Chosen targets: (1) the wordmark → typography,
  (2) the accent dot/letter → color, (3) the grid field → background, (4) the button → the action itself.
- **Remove the `synthesis → critique` connector** (`.model-link`) from the model screen entirely.
- **Secondary role caption:** `"Stress-tests the result"` → `"Asks you the questions"` (in `MODEL_ROLE_COPY`).
- **Claude's effect changes from paper-grain → floating bubbles.** (Bonus: this also clears impeccable's `feTurbulence`
  grain ban — the current Claude texture uses a turbulence SVG, which is exactly the banned pattern.)
- **Background is conceptually split into COLOR (palette) + EFFECT (grid | dots | bubbles).** Codex = grid + green,
  Gemini = dots + blue, Claude = bubbles + warm. All three field gradients gain slow "flowing-water" motion.

---

## 4. PART A — Intro screen

**Current behavior:** letters of "Tasteprint" fly in (`letter-in`), hold ~660ms, fly out (`letter-out`), and a timer
auto-advances to `models`. There's a cursor-following grid glow and a `Skip` button. (`mountIntro` ~L484,
`styles.css` ~L1461.)

**Target behavior:** letters fly in → a `Start Designing` button fades in below the wordmark → on **hover** the button
exposes the page's "anatomy" (a blueprint of its own design tokens) → on **click** the letters fly out *and* the button
fades out together, then it advances to `models` with a smoother hand-off.

### A1. Add the `Start Designing` button
- Render it inside `.intro-stage`, **after** the `<h1 class="intro-wordmark">`, as `<button class="intro-cta" data-action="start-designing">Start Designing</button>`.
- It enters *after* the letters finish (fade/slide up ~8px, `var(--ease)`, delayed past the entrance — reuse the
  `INTRO_*` timing consts so the delay tracks the real letter-in duration).
- `:active { transform: scale(0.97) }` press feedback; hover lift 1px. Use a **custom ease-out curve**, not a default
  one (emil). Verify text contrast on the button ≥ 4.5:1 (taste/impeccable button-contrast check).

### A2. Wire the click-out
- New action `start-designing` in `handleAction()`: add `.is-exiting` to `#introStage` (replays `letter-out`) **and**
  fade the `.intro-cta` out at the same time, then call `advanceFromIntro()` after the exit completes (reuse the exit
  duration math). Keep `advanceFromIntro()` setting `state.introSeen = true` and `go("models")`.
- In `mountIntro()`: **remove** the two auto-advance timers (`INTRO_EXIT_START`, `INTRO_TOTAL`). The entrance still
  plays on mount; the exit now fires only on the action.
- Remove `.intro-skip` from markup, the `skip-intro` visible button, and its CSS. Keep the keydown handler but narrow
  it: `Esc` → `advanceFromIntro()`; `Enter`/`Space` should just activate the focused button (let the browser do it).

### A3. The hover "anatomy" overlay (the centerpiece)
Reference visual: the Uiverse blueprint-button the user shared — thin leader lines + tiny labels that are hidden by
default (`opacity:0; visibility:hidden; transform: scale(1.4)`) and snap in on hover. We extend that idea so it
annotates the *whole page's design tokens*, not just the button.

- Add an `.intro-anatomy` overlay layer inside `.intro` (sibling of `.intro-stage`), `pointer-events:none`,
  `aria-hidden="true"`, containing ~4 annotation nodes: each = a short leader line + a small mono label.
  Suggested 4 (keep it to these — "not TOO much"):
  1. **Wordmark → typography:** line to the title, label e.g. `Display · −0.04em` (read the real tracking from `--heading-weight`/the wordmark).
  2. **Accent dot/letter → color:** a small swatch + label `Accent · var(--primary)`.
  3. **Grid field → background:** line to a corner of `.intro-field`, label `Canvas · grid`.
  4. **Button → the action:** label `Primary action` (this is the part that mirrors the Uiverse anatomy of the button itself).
- **Reveal on hover** of the button. Prefer CSS: `.intro-cta:hover ~ .intro-anatomy` (or a JS class toggle on
  pointerenter/leave of the button if you want `prefers-reduced-motion` / focus parity — JS is fine and more robust).
  Hidden→shown should fade + settle (`scale(1.06)→1`, `var(--ease)`, ~180–220ms) and **stagger** the 4 nodes
  (~40ms apart, emil/motion stagger). Leader lines draw in with `clip-path: inset(...)` or `transform: scaleX` from the
  anchor (emil's clip-path reveal), not a plain opacity pop.
- Keep labels quiet: `var(--font-mono)`, ~11px, `--ink-subtle`/muted, hairline leaders. One accent only.
- **Reduced motion:** anatomy still *appears* on hover but instantly (no scale/draw); or show nothing — either is fine,
  just no movement.

### A4. Intro → models hand-off (smoother)
- Today `go("models")` runs `paint({transition:true})` (CSS `screen-enter`) while `.model-atmos` fades in via `.is-on`
  over 600ms. Make it read as **one cross-dissolve**: as the intro letters/button exit and the intro grid fades, the
  models canvas + atmosphere come up underneath, and the two cards **stagger in** (≤12px rise, ~40–60ms apart) rather
  than appearing with the shell. Choreograph this in motion-principles Create mode; keep it inside the motion budget.

### A5. Skill calls for Part A
- **design-motion-principles (Create):** design the entrance→button→anatomy→exit→hand-off sequence as one timeline
  before writing CSS. Confirm the anatomy reveal is *motivated* (it teaches what the tool does) and passes the gate.
- **emil-design-eng:** lock the button `:active`/hover, the exact easing curves and durations, and the leader-line
  clip-path reveal; finish with a Before/After table for the intro motion.

---

## 5. PART B — "Choose your model pair." screen

**Current state:** two cards (primary high-left, secondary low-right) over a "living atmosphere" with per-model
textures + drifting blooms, a centered `synthesis → critique` connector, and CSS-var crossfades on model change.
(`updateModelSplit` ~L382, `.atmos*` CSS ~L525, `MODEL_WORLDS` ~L64.)

### B1. Remove the connector + fix copy
- Delete the `.model-link` span from `renderModels()` body and its CSS (~L737). Re-center the pair without it.
- In `MODEL_ROLE_COPY.secondary.caption`: `"Stress-tests the result"` → `"Asks you the questions"`.

### B2. Lower & recompose the card stage (kills the bottom empty space)
- The cards currently sit too high (`.model-card-wrap.primary { top: 0 }`, `.secondary { bottom: 5% }`) over a tall
  `.model-stage` min-height, leaving dead space below. Lower the whole pair / re-balance so it's vertically centered in
  the stage. Tune `top`/`bottom` and `.model-stage` `min-height` **in the browser** under `dev:local` (don't guess
  pixel values blind). Use `$impeccable layout` (or the `live` flow) to dial spacing/rhythm.

### B3. Floaty cards (subtle idle motion)
- Give `.model-card-wrap.primary` and `.secondary` a gentle, slow idle drift (translateY/translateX ~6–10px, ~9–13s,
  `ease-in-out`, `infinite alternate`, **different phase per card** so they don't move in lockstep). GPU only
  (`transform`). **Pause on `:hover`/`:focus-within`** so editing the selects is rock-steady.
- Frequency-gate justification (state it): this screen is seen once at the start, the motion is decorative and
  premium, so subtle float is appropriate — keep it *barely* noticeable (emil's golden rule). Reduced motion: no float.

### B4. Redesign the cards
- Refine the two `.panel.model-card` surfaces with `$impeccable craft`/`polish`: stronger primary-vs-secondary
  hierarchy, cleaner field grouping, hover/focus states. **Respect impeccable's bans (they bite here):**
  - No `border:1px + box-shadow ≥16px` "ghost-card" pairing on the same element (the primary card currently pairs a
    border with a large `92px` glow shadow — keep the glow as the *atmosphere/lift* but don't also lean on a decorative
    border; pick the dominant one).
  - No card `border-radius ≥ 32px` (current radii 10–22px are fine — keep them ≤ ~16–22px).
  - Keep one accent per card tied to its world; verify all text ≥ 4.5:1 on the card surface.

### B5. Background = COLOR + EFFECT (refactor + Claude bubbles)
- **Make the split explicit.** Treat each world in `MODEL_WORLDS` as palette (the color half: `bg/field*/bloom*/ink*/
  hairline/accent/glow/radius`) + an **effect** key with values `grid` (codex) | `dots` (gemini) | `bubbles` (claude).
  Rename `texture` → `effect` (and the `[data-model=...]` hook can stay, or switch to `[data-effect=...]`). The CSS
  already keys effects off the model name at `.atmos[data-model="codex|claude|gemini"] .atmos-texture` (~L641–688).
- **Claude → bubbles:** replace the `feTurbulence` paper-grain texture (~L664) with floating bubbles: a handful of
  soft, blurred, tinted circles (use `--atmos-bloom-1/2`) that slowly **rise + drift + gently scale**, varied
  size/speed/phase. Pure CSS (extra spans in the `.atmos` markup built in `updateModelSplit`, or `::before/::after` +
  a couple of nodes). Subtle and few — not a lava lamp. Reduced motion: render them static.
- **Keep** codex grid + gemini dots, but make sure they read against their gradients.

### B6. Flowing-water gradients (all three)
- The field gradients are currently static (only the blobs drift). Add a slow "flowing" motion to the gradient itself:
  a large transformed gradient layer underneath the blooms that slowly translates/rotates (`transform`, ~30–60s,
  `ease-in-out alternate`), giving a liquid shimmer without animating `background-position`. Apply to all three worlds;
  keep it *under* the texture/bubbles and very low-contrast. Reduced motion: freeze it.

### B7. Better model-switch transition
- On dropdown change, `onChange → refresh()` then `updateModelSplit()` crossfades the `--p-*`/`--s-*` vars over 600ms
  (good — keep it). Add: (a) the per-model **effect/texture should crossfade** when it swaps (currently effect opacity
  is instant per `data-model` — fade the outgoing effect out / incoming in), and (b) a subtle acknowledgement on the
  changed card (one soft scale 0.99→1 + accent-glow pulse, ~200ms, emil feedback). Keep it quiet; no layout shift.

### B8. Skill calls for Part B
- **design-motion-principles (Create):** design the card idle-float, the flowing-gradient cadence, the Claude bubble
  motion, and the model-switch transition together so they share one rhythm (and none fight the others).
- **`$impeccable critique`** once on the model screen for a scored read of hierarchy/clarity, then `$impeccable craft`
  for the card + background redesign, then `$impeccable layout` for B2 spacing, then `$impeccable polish` to finish.
- **emil-design-eng:** review the model-switch feedback + idle float easing/durations; Before/After table.
- **design-taste-frontend (anti-slop lens):** final gut check — the three model worlds must not collapse into generic
  "AI gradient" slop; confirm distinct, intentional palettes and that nothing reads as templated.

---

## 6. Verification (run before declaring done)

1. `npm run dev:local` → walk: intro entrance → button fades in → hover shows the 4-node anatomy (staggered, leaders
   draw) → click flies letters + button out → smooth cross-dissolve into models.
2. On models: switch primary across Codex/Claude/Gemini and secondary too — palette + **effect crossfades**, cards give
   the soft pulse, bubbles/grid/dots and flowing gradients all run; pick the same model twice → worlds merge, seam
   fades. Idle float runs but pauses on hover/focus. No connector. Secondary caption reads "Asks you the questions".
   No empty band under the cards.
3. **Reduced motion** (toggle OS / DevTools): intro shows wordmark + button immediately, anatomy appears without
   movement, no idle float / no bubble drift / no gradient flow — only crossfades.
4. Zero console errors; no layout shift on hover/anatomy/switch; all card + button text ≥ 4.5:1.
5. `npm test` still green.
6. Run the **emil Before/After table** and the **design-taste-frontend AI-slop test** as the closing review; fix anything flagged.

---

## 7. Out of scope (do not do here)

- No other steps (`intake`…`final`), no backend/prompt/orchestrator changes, no catalog expansion.
- No new dependencies, no build step, no framework. Keep it vanilla and dev:local-deterministic.
