import { applyTheme, BASE_THEME, buildTheme } from "./theme.js";
import { ensureContrast, contrastRatio, mixHex } from "./color.js";
import { archetypeForGroup, brandForReference, MOOD_THEMES } from "./themes.db.js";

const app = document.querySelector("#app");

const STEP_ORDER = [
  "models",
  "intake",
  "followups",
  "personality",
  "anti",
  "references",
  "referenceTaste",
  "extra",
  "directions",
  "optional",
  "preview",
  "final"
];

const STEP_GROUP = {
  models: "Context",
  intake: "Context",
  followups: "Context",
  personality: "Taste",
  anti: "Taste",
  references: "References",
  referenceTaste: "References",
  extra: "References",
  directions: "Direction",
  optional: "Direction",
  preview: "Direction",
  final: "Files"
};

// The five named phases of the interview, in order. Used for the "Step n of 5"
// indicator so the model screen reads as the opening move of a real flow.
const PHASES = ["Context", "Taste", "References", "Direction", "Files"];

function stepEyebrow() {
  const index = PHASES.indexOf(STEP_GROUP[state.step]);
  return index >= 0 ? `Step ${index + 1} of ${PHASES.length}` : "";
}

// The model screen only offers these three CLIs. Each is its own little "world":
// a tinted page background, a contrasting card, ink, and an accent. The two chosen
// models split the screen along a top-right → bottom-left diagonal; picking the same
// model twice merges the worlds back into one. See updateModelSplit().
const ALLOWED_MODEL_IDS = ["codex", "claude", "gemini"];

// Each agent gets a full themed "world", split conceptually into COLOR + EFFECT.
//   COLOR  — the palette half: two soft field stops (the base wash, kept low in
//            saturation so two worlds blend rather than collide), two bloom tones
//            (the slow drifting luminosity), a near-white card, ink/hairline/accent,
//            a glow, and a radius that nudges the feel.
//   EFFECT — the model's signature motion language, keyed independently of colour:
//     codex  → grid    : precise / technical — a faint structural baseline grid
//     gemini → dots     : airy / cosmic — a drifting dot cloud, ideas suspended in air
//     claude → bubbles  : warm / human — soft tinted bubbles rising and gathering
// Fields are deliberately pale so the seam between two worlds reads as a gentle
// editorial field change. Ratios checked with the internal color tool
// (src/colorTools.js): ink/card 13–14:1, muted/card ~5:1.
const MODEL_WORLDS = {
  codex: {
    bg: "#DDEDE5", field1: "#EAF4EF", field2: "#D3E8DD", bloom1: "#9FDDC4", bloom2: "#C2EAD8",
    card: "#F3F7F4", ink: "#16271F", inkMuted: "#5A6F64", hairline: "#C5DFD4",
    accent: "#1F9D78", glow: "rgba(31, 157, 120, 0.16)", radius: "10px", effect: "grid"
  },
  claude: {
    bg: "#EBDDCC", field1: "#F3EADF", field2: "#E7D7C6", bloom1: "#EBC9A6", bloom2: "#E5D2BC",
    card: "#F8F1E8", ink: "#3A2516", inkMuted: "#74583F", hairline: "#E0CBB3",
    accent: "#C97A3D", glow: "rgba(201, 122, 61, 0.16)", radius: "22px", effect: "bubbles"
  },
  gemini: {
    bg: "#DEE2FB", field1: "#EAECFD", field2: "#D6DBFA", bloom1: "#BCC4FF", bloom2: "#CDBEF7",
    card: "#F1F2FC", ink: "#1B1E3C", inkMuted: "#565C8A", hairline: "#C9CEF3",
    accent: "#4F5BD5", glow: "rgba(79, 91, 213, 0.18)", radius: "16px", effect: "dots"
  }
};

const NEUTRAL_WORLD = {
  bg: "#F1EFEA", field1: "#F4F2EE", field2: "#E8E5DE", bloom1: "#E9E6DE", bloom2: "#F1EFEA",
  card: "#FFFFFF", ink: "#151517", inkMuted: "#6D7078", hairline: "#E1E1DD",
  accent: "#5E6AD2", glow: "rgba(94, 106, 210, 0.14)", radius: "18px", effect: "none"
};

function worldForModelId(id) {
  return MODEL_WORLDS[id] || NEUTRAL_WORLD;
}

// The split CTA paints white text over a diagonal of the two worlds' accents. The
// raw brand accents (green/clay) are too light to carry white text at WCAG AA, so
// each is deepened just enough to clear 4.5:1 — only for the button, never the
// world's visible accent. Mirrors the loop the internal color tool would run.
function ctaAccentFor(accent) {
  let color = accent;
  for (let step = 0; step < 30 && contrastRatio("#FFFFFF", color) < 4.5; step += 1) {
    color = mixHex(color, "#000000", 0.06);
  }
  return color;
}

const LOADER_PHRASES = {
  followups: ["Reading your project.", "Finding the gaps worth asking about."],
  personality: ["Reading your project.", "Tuning the taste options."],
  anti: ["Listening for the wrong notes.", "Setting the guardrails."],
  referenceTaste: ["Reading the references.", "Noting what's worth keeping."],
  directions: ["Reading your taste.", "Weighing the references.", "Composing three directions."],
  optional: ["Preparing the final tuning."],
  preview: ["Laying out your direction.", "Drafting the plan."],
  final: ["Writing DESIGN.md.", "Writing SKILL.md.", "Checking contrast and format."]
};

const state = {
  step: "boot",
  introSeen: false,
  localOnly: false,
  availableModels: [],
  referenceCatalog: [],
  referenceGroup: "Premium / minimal",
  referenceSearch: "",
  models: {},
  intake: "",
  intakeAnswers: {},
  followupQuestions: [],
  personalityOptions: null,
  personality: [],
  antiOptions: null,
  avoid: [],
  references: [],
  referenceLikeOptions: null,
  referenceLikes: {},
  extra: "",
  directions: null,
  selectedDirections: [],
  directionComments: {},
  regenerationHistory: [],
  lockedDirection: null,
  optionalOptions: null,
  optionalAdditions: [],
  plan: null,
  generated: null,
  primaryContext: "",
  usage: { primary: null, secondary: null },
  history: [],
  notice: "",
  error: "",
  loading: ""
};

let shellMounted = false;
let loaderTimer = null;
let pendingPulse = false;
let introTimers = [];
let introMoveHandler = null;
let introMoveTarget = null;
let activeTheme = { ...BASE_THEME };

// Name-reveal choreography. CSS animation stagger/durations must match these.
const INTRO_WORD = "Tasteprint";
const INTRO_ENTRY_MS = 520;
const INTRO_ENTRY_STAGGER = 26;
const INTRO_EXIT_MS = 400;
const INTRO_EXIT_STAGGER = 22;
const INTRO_Y_JITTER = [-20, 16, -10, 22, -14, 12, -24, 18, -8, 14];
// Letters finish arriving here; the CTA fades in just after (the delay tracks the
// real entrance, not a magic number). The exit duration times the hand-off to models.
const INTRO_ENTRY_END = INTRO_ENTRY_STAGGER * (INTRO_WORD.length - 1) + INTRO_ENTRY_MS;
const INTRO_CTA_DELAY = INTRO_ENTRY_END + 120;
const INTRO_EXIT_DURATION = INTRO_EXIT_STAGGER * (INTRO_WORD.length - 1) + INTRO_EXIT_MS;

// Anatomy editor: an opt-in dev tool (`npm run dev:anatomy`, which opens /?anatomy)
// that freezes the intro on its static frame with the CTA-hover blueprint always
// revealed and every call-out draggable, plus a button that copies the measured
// positions back as CSS. Off unless the query flag is present, so the normal
// deterministic flow is byte-for-byte unaffected.
const ANATOMY_EDIT = typeof location !== "undefined" &&
  new URLSearchParams(location.search).has("anatomy");

bindAppEvents();
init();

async function init() {
  applyTheme(BASE_THEME);
  state.loading = "boot";
  paint();
  const bootStart = Date.now();

  try {
    const [models, references, health] = await Promise.all([
      getJson("/api/models"),
      getJson("/api/references"),
      getJson("/api/health")
    ]);

    state.availableModels = models.models || [];
    state.referenceCatalog = references.references || [];
    state.projectDir = health.projectDir;
    state.localOnly = Boolean(health.localOnly);

    const allowed = state.availableModels.filter((model) => ALLOWED_MODEL_IDS.includes(model.id));
    const pool = allowed.length ? allowed : state.availableModels;
    state.models.primary = modelWithDefaults(pool[0]);
    state.models.secondary = modelWithDefaults(pool[1] || pool[0]);
    state.loading = "";
    state.step = state.introSeen ? "models" : "intro";
  } catch (error) {
    state.loading = "";
    state.step = "models";
    state.error = error.message;
  }

  // Keep the entrance loader on screen briefly so the boot → reveal hand-off
  // reads as one choreographed moment instead of a flash (instant in dev:local).
  await delay(Math.max(0, 250 - (Date.now() - bootStart)));
  paint({ transition: true });
}

/* ---------------- Painting ---------------- */

function paint({ transition = false } = {}) {
  stopLoader();

  if (state.loading === "boot") {
    shellMounted = false;
    app.innerHTML = `<div class="boot"><div class="boot-loader" aria-label="Loading"></div></div>`;
    return;
  }

  if (state.step === "intro") {
    shellMounted = false;
    mountIntro();
    return;
  }

  if (!shellMounted) {
    app.innerHTML = shellHtml();
    shellMounted = true;
  }

  mountStep({ transition });
}

function shellHtml() {
  return `
    <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
    <div class="shell">
      <header class="topbar">
        <div class="section-label" id="sectionLabel"></div>
        <div class="top-actions" id="topActions"></div>
      </header>
      <main class="screen" id="screen"></main>
      <div class="bottom-bar">
        <div class="brand">${splitText("Tasteprint")}</div>
        <div class="footer-inner" id="footer"></div>
      </div>
    </div>
  `;
}

function mountStep({ transition = false } = {}) {
  const descriptor = renderStep();
  const screen = document.querySelector("#screen");
  const footer = document.querySelector("#footer");
  const sectionLabel = document.querySelector("#sectionLabel");
  const topActions = document.querySelector("#topActions");
  const progressFill = document.querySelector("#progressFill");

  const index = STEP_ORDER.indexOf(state.step);
  if (progressFill) {
    progressFill.style.width = `${index >= 0 ? ((index + 1) / STEP_ORDER.length) * 100 : 0}%`;
  }
  if (sectionLabel) {
    sectionLabel.textContent = STEP_GROUP[state.step] || "";
  }
  if (topActions) {
    topActions.innerHTML = contextUsageHtml();
  }

  screen.className = `screen ${descriptor.wide ? "wide" : ""} ${descriptor.centered ? "centered" : ""}`;
  screen.innerHTML = `
    ${descriptor.eyebrow ? `<p class="eyebrow">${esc(descriptor.eyebrow)}</p>` : ""}
    <h1 class="title">${descriptor.titleHtml || esc(descriptor.title)}</h1>
    ${descriptor.helper ? `<p class="helper">${esc(descriptor.helper)}</p>` : ""}
    <div class="body ${descriptor.bodyClass || ""}">${descriptor.body}</div>
  `;
  footer.innerHTML = descriptor.loadingKey ? "" : (descriptor.footer || "");

  updateModelSplit();

  if (transition) {
    // Reset any in-flight enter animation, then force a reflow so re-adding the
    // class restarts it (otherwise a same-node re-render won't replay the motion).
    screen.classList.remove("screen-enter");
    void screen.offsetWidth;
    screen.classList.add("screen-enter");
    screen.addEventListener("animationend", () => screen.classList.remove("screen-enter"), { once: true });

    // Hand-off into the model screen: the two cards stagger up underneath the
    // atmosphere instead of arriving with the shell. Only on a real screen change
    // (go), never on an in-place refresh — so editing a dropdown doesn't re-stagger.
    if (state.step === "models" && !prefersReducedMotion()) {
      const stage = screen.querySelector(".model-stage");
      if (stage) {
        stage.classList.add("is-entering");
        setTimeout(() => stage.classList.remove("is-entering"), 680);
      }
    }
  }

  applyThemeForStep();

  if (descriptor.loadingKey) {
    startLoader(descriptor.loadingKey);
  }

  if (pendingPulse) {
    flashLimit(screen, footer);
    pendingPulse = false;
  }

  syncSelectValues();
}

function renderStep() {
  const renderer = {
    models: renderModels,
    intake: renderIntake,
    followups: renderFollowups,
    personality: renderPersonality,
    anti: renderAnti,
    references: renderReferences,
    referenceTaste: renderReferenceTaste,
    extra: renderExtra,
    directions: renderDirections,
    optional: renderOptional,
    preview: renderPreview,
    final: renderFinal
  }[state.step] || renderModels;

  return renderer();
}

function go(step) {
  state.step = step;
  paint({ transition: true });
}

function refresh() {
  paint({ transition: false });
}

/* ---------------- Theme orchestration ---------------- */

function applyThemeForStep() {
  const theme = themeForStep(state.step);
  activeTheme = buildTheme(theme);
  applyTheme(theme);
}

function themeForStep(step) {
  switch (step) {
    case "personality":
      return buildTheme(MOOD_THEMES.positive);
    case "anti":
      return buildTheme(MOOD_THEMES.negative);
    case "references":
    case "referenceTaste":
      return referencesTheme();
    case "directions":
      return state.lockedDirection
        ? buildTheme({ colors: state.lockedDirection.colors, dark: state.lockedDirection.dark })
        : buildTheme(BASE_THEME);
    case "optional":
    case "preview":
    case "final":
      // Hold the chosen direction's palette from selection through the reveal —
      // no return-to-default bounce.
      return state.lockedDirection
        ? buildTheme({ colors: state.lockedDirection.colors, dark: state.lockedDirection.dark })
        : buildTheme(BASE_THEME);
    default:
      return buildTheme(BASE_THEME);
  }
}

// Drives the model atmosphere: two living fields that meet on a soft diagonal — the
// primary world fills the top-left, the secondary blends in from the bottom-right —
// plus the root CSS vars the cards, split text, and CTA read. Each field carries a
// flowing-gradient base, drifting blooms, and a signature effect. Picking the same
// model on both sides makes every side colour equal, so the seam dissolves and the
// two worlds merge.
let modelSplitBg = null;
const SPLIT_VARS = [
  "--p-side", "--s-side", "--seam-opacity",
  "--p-field-1", "--p-field-2", "--p-bloom-1", "--p-bloom-2",
  "--p-card", "--p-ink", "--p-ink-muted", "--p-hairline", "--p-accent", "--p-cta", "--p-glow", "--p-radius",
  "--s-field-1", "--s-field-2", "--s-bloom-1", "--s-bloom-2",
  "--s-card", "--s-ink", "--s-ink-muted", "--s-hairline", "--s-accent", "--s-cta", "--s-glow", "--s-radius",
  "--sl", "--sr"
];

function updateModelSplit() {
  if (state.step !== "models") {
    clearModelSplit();
    return;
  }

  const primary = worldForModelId(state.models.primary?.id);
  const secondary = worldForModelId(state.models.secondary?.id);
  const merged = state.models.primary?.id === state.models.secondary?.id;

  if (!modelSplitBg) {
    modelSplitBg = document.createElement("div");
    modelSplitBg.className = "model-atmos";
    modelSplitBg.setAttribute("aria-hidden", "true");
    // Two atmospheres + a soft seam sheen. The secondary layer is masked to the
    // bottom-right and feathered across the diagonal, so the worlds dissolve into
    // each other instead of meeting at a hard edge. Each layer carries a slow
    // flowing-gradient base, drifting blooms, and all three effect layers (grid /
    // dots / bubbles) — only the active one is opaque, so a model swap crossfades
    // the effect. All motion is CSS.
    modelSplitBg.innerHTML = `
      <div class="atmos atmos-primary">${atmosLayersHtml()}</div>
      <div class="atmos atmos-secondary">${atmosLayersHtml()}</div>
      <div class="model-seam"></div>`;
    app.prepend(modelSplitBg);
    requestAnimationFrame(() => modelSplitBg?.classList.add("is-on"));
  }

  // Effect language is chosen per side independently of colour; colours below ride
  // typed CSS vars so a dropdown change eases from one palette to the next, while the
  // effect layers crossfade via the data-effect hook.
  modelSplitBg.querySelector(".atmos-primary")?.setAttribute("data-effect", primary.effect);
  modelSplitBg.querySelector(".atmos-secondary")?.setAttribute("data-effect", secondary.effect);

  document.documentElement.dataset.screen = "models";
  document.documentElement.dataset.merged = merged ? "true" : "false";

  const root = document.documentElement.style;
  root.setProperty("--p-side", primary.bg);
  root.setProperty("--s-side", secondary.bg);
  root.setProperty("--p-field-1", primary.field1);
  root.setProperty("--p-field-2", primary.field2);
  root.setProperty("--p-bloom-1", primary.bloom1);
  root.setProperty("--p-bloom-2", primary.bloom2);
  root.setProperty("--s-field-1", secondary.field1);
  root.setProperty("--s-field-2", secondary.field2);
  root.setProperty("--s-bloom-1", secondary.bloom1);
  root.setProperty("--s-bloom-2", secondary.bloom2);
  // The seam is just a faint fold of light; it recedes entirely when the two
  // worlds become one. Soft, not a geometric event.
  root.setProperty("--seam-opacity", merged ? "0" : "0.55");
  root.setProperty("--p-card", primary.card);
  root.setProperty("--p-ink", primary.ink);
  root.setProperty("--p-ink-muted", primary.inkMuted);
  root.setProperty("--p-hairline", primary.hairline);
  root.setProperty("--p-accent", primary.accent);
  root.setProperty("--p-cta", ctaAccentFor(primary.accent));
  root.setProperty("--p-glow", primary.glow);
  root.setProperty("--p-radius", primary.radius);
  root.setProperty("--s-card", secondary.card);
  root.setProperty("--s-ink", secondary.ink);
  root.setProperty("--s-ink-muted", secondary.inkMuted);
  root.setProperty("--s-hairline", secondary.hairline);
  root.setProperty("--s-accent", secondary.accent);
  root.setProperty("--s-cta", ctaAccentFor(secondary.accent));
  root.setProperty("--s-glow", secondary.glow);
  root.setProperty("--s-radius", secondary.radius);
  // Split-text wedges: left wins the primary ink, right the secondary ink.
  root.setProperty("--sl", primary.ink);
  root.setProperty("--sr", secondary.ink);
}

// One atmosphere's layer stack, bottom → top: a slow flowing-gradient base, two
// drifting blooms, then the three effect layers. data-effect on the parent decides
// which effect layer is visible; the others sit at opacity 0 and crossfade on swap.
function atmosLayersHtml() {
  return `
    <div class="atmos-flow"></div>
    <div class="atmos-blob blob-a"></div>
    <div class="atmos-blob blob-b"></div>
    <div class="fx fx-grid"></div>
    <div class="fx fx-dots"></div>
    <div class="fx fx-bubbles">${bubblesHtml()}</div>`;
}

// Claude's signature: soft, blurred, tinted bubbles that float, breathe, and drift
// gently in place. Spread across the WHOLE field (both diagonal halves) via per-bubble
// top/left so that, once each side's mask clips it to its own section, the primary
// (top-left) and secondary (bottom-right) each get a balanced handful — and when BOTH
// sides are Claude the bubbles fill the entire field. Varied size / position / speed /
// phase / drift so they never march in lockstep. Few and subtle — not a lava lamp.
function bubblesHtml() {
  const bubbles = [
    // Top-left cluster — shown when the PRIMARY side is Claude.
    { size: 62, left: 10, top: 20, dur: 17, delay: 0, dx: 14, dy: -20 },
    { size: 34, left: 26, top: 44, dur: 22, delay: 6, dx: -12, dy: -16 },
    { size: 78, left: 15, top: 67, dur: 19, delay: 11, dx: 10, dy: -24 },
    { size: 30, left: 40, top: 26, dur: 24, delay: 3, dx: -8, dy: -18 },
    { size: 48, left: 33, top: 78, dur: 16, delay: 9, dx: 16, dy: -14 },
    { size: 26, left: 46, top: 54, dur: 26, delay: 14, dx: 12, dy: -22 },
    // Bottom-right cluster — shown when the SECONDARY side is Claude.
    { size: 56, left: 60, top: 48, dur: 18, delay: 4, dx: -14, dy: -18 },
    { size: 32, left: 76, top: 30, dur: 23, delay: 10, dx: 12, dy: -20 },
    { size: 70, left: 70, top: 72, dur: 20, delay: 2, dx: -10, dy: -16 },
    { size: 28, left: 88, top: 54, dur: 25, delay: 7, dx: 10, dy: -24 },
    { size: 46, left: 58, top: 82, dur: 17, delay: 13, dx: 14, dy: -14 },
    { size: 38, left: 85, top: 80, dur: 21, delay: 8, dx: -12, dy: -22 }
  ];
  return bubbles
    .map((b) => `<span class="bubble" style="--size:${b.size}px;--left:${b.left}%;--top:${b.top}%;--dur:${b.dur}s;--delay:-${b.delay}s;--dx:${b.dx}px;--dy:${b.dy}px"></span>`)
    .join("");
}

function clearModelSplit() {
  if (modelSplitBg) {
    modelSplitBg.remove();
    modelSplitBg = null;
  }
  delete document.documentElement.dataset.screen;
  delete document.documentElement.dataset.merged;
  const root = document.documentElement.style;
  SPLIT_VARS.forEach((name) => root.removeProperty(name));
}

function referencesTheme() {
  const selected = state.references;
  if (selected.length) {
    const lastId = selected[selected.length - 1];
    const reference = state.referenceCatalog.find((item) => item.id === lastId);
    const group = reference?.group || state.referenceGroup;
    const brand = brandForReference(lastId);
    return buildTheme(archetypeForGroup(group), brand ? { accent: brand.accent, dark: brand.dark } : {});
  }
  return buildTheme(archetypeForGroup(state.referenceGroup));
}

/* ---------------- Intro ---------------- */

function mountIntro() {
  // Edit mode rides the same code path as reduced motion: a static final frame, no
  // entrance choreography, so the call-outs are stable to drag the moment they mount.
  const reduce = ANATOMY_EDIT || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const half = INTRO_WORD.length / 2;
  const letters = INTRO_WORD.split("").map((char, index) => {
    const fromLeft = index < half;
    const fromAbove = index % 2 === 0;
    const yBase = fromAbove ? -128 : 128;
    const exitBase = fromAbove ? 128 : -128;
    const yJitter = INTRO_Y_JITTER[index] || 0;
    const entryX = fromLeft ? "-70vw" : "70vw";
    const exitX = fromLeft ? "-82vw" : "82vw";
    const turnY = `${yBase + yJitter}px`;
    const exitY = `${exitBase + yJitter}px`;
    return `<span class="intro-letter" style="--i:${index};--entry-x:${entryX};--turn-y:${turnY};--exit-x:${exitX};--exit-y:${exitY}">${esc(char)}</span>`;
  }).join("");

  app.innerHTML = `
    <div class="intro ${reduce ? "is-static" : ""}">
      <div class="intro-field" id="introField">
        <div class="intro-grid"></div>
        <div class="intro-grid-glow"></div>
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

  clearIntroTimers();

  const intro = app.querySelector(".intro");
  const field = app.querySelector("#introField");
  if (intro && field && !reduce) {
    introMoveTarget = intro;
    introMoveHandler = (event) => {
      const rect = field.getBoundingClientRect();
      field.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      field.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };
    intro.addEventListener("pointermove", introMoveHandler);
  }

  // The anatomy blueprint reveals on hover OR focus of the CTA — JS toggle (not a
  // pure CSS sibling selector) so keyboard focus gets parity and reduced-motion can
  // show it without movement. The whole intro tears down on advance, so these
  // listeners ride along with the discarded nodes; no manual cleanup needed.
  const cta = app.querySelector(".intro-cta");
  const anatomy = app.querySelector(".intro-anatomy");
  if (cta && anatomy) {
    const reveal = () => anatomy.classList.add("is-revealed");
    const hide = () => anatomy.classList.remove("is-revealed");
    cta.addEventListener("pointerenter", reveal);
    cta.addEventListener("pointerleave", hide);
    cta.addEventListener("focus", reveal);
    cta.addEventListener("blur", hide);
  }

  // Edit mode: pin the blueprint open and hand the stage to the draggable editor.
  if (ANATOMY_EDIT && anatomy) {
    anatomy.classList.add("is-revealed");
    import("./anatomy-editor.js")
      .then((module) => module.mountAnatomyEditor(app))
      .catch((error) => console.error("Anatomy editor failed to load:", error));
  }

  // No auto-advance: the entrance plays on mount, then the intro waits for the
  // Start Designing click (or the Esc fast-path). Reduced motion shows the final
  // frame + button immediately and likewise waits.
}

// A blueprint that snaps in on CTA hover/focus and annotates the page's own design
// tokens. Seven call-outs form a page-spec diagram anchored to the real geometry of
// the wordmark + CTA: the type face (off the "T"), cap height, tracking (off the
// final "t"), baseline, the accent that lives on the button, the primary action's
// width, and the canvas grid. Leaders are mostly orthogonal with two diagonals, so
// it scans like a design-tool inspection layer. aria-hidden + pointer-events none.
function introAnatomyHtml() {
  return `
    <div class="intro-anatomy" aria-hidden="true">
      <div class="bp bp-type" style="--n:0">
        <span class="bp-dot"></span>
        <span class="bp-leader"></span>
        <span class="bp-tag"><i class="bp-sw" style="--c:var(--ink)"></i>Display / 650</span>
      </div>
      <div class="bp bp-cap" style="--n:1">
        <span class="bp-vbracket"></span>
        <span class="bp-tag">Cap height</span>
      </div>
      <div class="bp bp-track" style="--n:2">
        <span class="bp-dot"></span>
        <span class="bp-leader"></span>
        <span class="bp-tag">Tracking -0.04em</span>
      </div>
      <div class="bp bp-base" style="--n:3">
        <span class="bp-dot"></span>
        <span class="bp-leader"></span>
        <span class="bp-tag">Baseline</span>
      </div>
      <div class="bp bp-accent" style="--n:4">
        <span class="bp-dot"></span>
        <span class="bp-leader"></span>
        <span class="bp-tag"><i class="bp-sw" style="--c:var(--primary)"></i>Accent / primary</span>
      </div>
      <div class="bp bp-action" style="--n:5">
        <span class="bp-bracket"></span>
        <span class="bp-leader"></span>
        <span class="bp-tag">Primary action</span>
      </div>
      <div class="bp bp-grid-note" style="--n:6">
        <span class="bp-ring"></span>
        <span class="bp-leader"></span>
        <span class="bp-tag"><i class="bp-sw bp-sw-ring" style="--c:var(--canvas)"></i>Canvas / 44px</span>
      </div>
    </div>
  `;
}

function clearIntroTimers() {
  introTimers.forEach(clearTimeout);
  introTimers = [];
  if (introMoveTarget && introMoveHandler) {
    introMoveTarget.removeEventListener("pointermove", introMoveHandler);
  }
  introMoveTarget = null;
  introMoveHandler = null;
}

function advanceFromIntro() {
  if (state.step !== "intro") {
    return;
  }
  clearIntroTimers();
  state.introSeen = true;
  go("models");
}

// Click-out: fly the letters out and fade the CTA / grid / anatomy together, then
// hand off to models once the exit completes. Reduced motion skips straight across.
function exitIntro() {
  if (state.step !== "intro") {
    return;
  }
  const intro = app.querySelector(".intro");
  const stage = app.querySelector("#introStage");
  if (prefersReducedMotion() || !intro || !stage) {
    return advanceFromIntro();
  }
  clearIntroTimers();
  intro.classList.add("is-leaving");
  stage.classList.add("is-exiting");
  introTimers.push(setTimeout(advanceFromIntro, INTRO_EXIT_DURATION));
}

/* ---------------- Loader ---------------- */

function loaderBodyHtml() {
  return `<div class="loader"><div class="loader-line"></div><div class="loader-status" id="loaderStatus"></div></div>`;
}

function startLoader(key) {
  stopLoader();
  const phrases = LOADER_PHRASES[key] || ["Working."];
  const status = document.querySelector("#loaderStatus");
  if (!status) {
    return;
  }
  status.textContent = phrases[0];

  if (phrases.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  let index = 0;
  loaderTimer = setInterval(() => {
    index = (index + 1) % phrases.length;
    status.classList.add("is-fading");
    setTimeout(() => {
      status.textContent = phrases[index];
      status.classList.remove("is-fading");
    }, 280);
  }, 1700);
}

function stopLoader() {
  if (loaderTimer) {
    clearInterval(loaderTimer);
    loaderTimer = null;
  }
}

function flashLimit(screen, footer) {
  const chip = footer?.querySelector(".counter-chip");
  const grid = screen?.querySelector(".choice-grid, .reference-grid");
  const live = screen?.querySelector("#limit-live");
  if (chip) {
    chip.classList.add("pulse");
  }
  if (grid) {
    grid.classList.add("at-limit");
  }
  if (live) {
    live.textContent = "Maximum of 3 selected.";
  }
  setTimeout(() => {
    chip?.classList.remove("pulse");
    grid?.classList.remove("at-limit");
  }, 260);
}

/* ---------------- Step renderers (return descriptors) ---------------- */

// Role copy lives here so each card reads like an editorial "role object" — a
// purpose caption next to the marker, then a one-line explanation of the job.
const MODEL_ROLE_COPY = {
  primary: { name: "Primary", caption: "Drives synthesis", purpose: "The lead model. It reads everything and writes your DESIGN.md." },
  secondary: { name: "Secondary", caption: "Asks you the questions", purpose: "Optional. A second voice for critique, comparison, or interview." }
};

function renderModels() {
  return {
    centered: true,
    wide: true,
    eyebrow: stepEyebrow(),
    titleHtml: splitText("Choose your model pair."),
    title: "Choose your model pair.",
    helper: "Pick a primary model for synthesis and an optional secondary for challenge, comparison, or the interview.",
    bodyClass: "model-body",
    body: `
      ${state.error ? errorHtml(state.error) : ""}
      <div class="model-stage">
        <div class="model-card-wrap primary">${renderModelSelector("primary")}</div>
        <div class="model-card-wrap secondary">${renderModelSelector("secondary")}</div>
      </div>
    `,
    footer: footerHtml({ primaryLabel: "Start the interview", primaryAction: "start-intake", side: "npx tasteprint", modelCta: true, arrow: true })
  };
}

function renderModelSelector(role) {
  const copy = MODEL_ROLE_COPY[role] || MODEL_ROLE_COPY.primary;
  return `
    <div class="panel model-card ${role}">
      <div class="model-head">
        <div class="model-role"><span class="role-dot"></span><span class="role-name">${esc(copy.name)}</span></div>
        <span class="role-caption">${esc(copy.caption)}</span>
      </div>
      <p class="model-purpose">${esc(copy.purpose)}</p>
      ${modelFieldsHtml(role)}
    </div>
  `;
}

// The three selects for one card. Extracted so a model change can swap just this
// block in place (keeping the card + wrap elements alive), which avoids the float
// restart / focus-loss jump a full screen re-render caused.
function modelFieldsHtml(role) {
  const selected = state.models[role] || modelWithDefaults(state.availableModels[0]);
  const allowed = state.availableModels.filter((model) => ALLOWED_MODEL_IDS.includes(model.id));
  const pool = allowed.length ? allowed : state.availableModels;
  const modelOptions = pool
    .map((model) => `<option value="${esc(model.id)}" ${selected?.id === model.id ? "selected" : ""}>${esc(model.label)}</option>`)
    .join("");
  // Drop the "custom model id" pseudo-variant — the model screen stays to the
  // three first-party CLIs and their published model ids only.
  const variants = (selected?.variants?.length ? selected.variants : []).filter((variant) => !variant.custom);
  const selectedVariant = (selected?.variant && !selected.variant.custom) ? selected.variant : variants[0];
  const thinkingOptions = selectedVariant?.thinkingOptions?.length ? selectedVariant.thinkingOptions : selected?.thinkingOptions || [];
  const selectedThinking = selected?.thinking || thinkingOptions[0];

  return `
    <div class="model-fields">
      <div class="field">
        <label class="label" for="${role}Model">Model</label>
        <select class="select" id="${role}Model" data-bind-model="${esc(role)}">${modelOptions}</select>
      </div>
      <div class="field">
        <label class="label" for="${role}Variant">Model id</label>
        <select class="select" id="${role}Variant" data-bind-model-variant="${esc(role)}">
          ${variants.map((variant) => `<option value="${esc(variant.id)}" ${selectedVariant?.id === variant.id ? "selected" : ""}>${esc(variant.label)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label class="label" for="${role}Thinking">Thinking</label>
        <select class="select" id="${role}Thinking" data-bind-model-thinking="${esc(role)}">
          ${thinkingOptions.map((option) => `<option value="${esc(option.id)}" ${selectedThinking?.id === option.id ? "selected" : ""}>${esc(option.label)}</option>`).join("")}
        </select>
      </div>
    </div>
  `;
}

// Update one model card without re-rendering the whole screen. Swaps just the selects
// (so the variant/thinking options track the new model), crossfades the world vars,
// and fires the acknowledgement pulse — all while the card + wrap DOM stay put, so the
// idle float keeps running and the surface eases instead of snapping.
function refreshModelCard(role) {
  const fields = document.querySelector(`.panel.model-card.${role} .model-fields`);
  if (!fields) {
    return refresh();
  }
  fields.outerHTML = modelFieldsHtml(role);
  updateModelSplit();
  syncSelectValues();
  const card = document.querySelector(`.panel.model-card.${role}`);
  if (card && !prefersReducedMotion()) {
    card.classList.remove("is-acked");
    void card.offsetWidth;
    card.classList.add("is-acked");
    setTimeout(() => card.classList.remove("is-acked"), 300);
  }
}

function renderIntake() {
  return {
    eyebrow: "Project intake",
    title: "What are you building?",
    helper: "Paste the messy version — product, audience, vibe, competitors. Structure comes later.",
    body: `
      ${messageHtml()}
      <div class="field">
        <label class="label" for="intake">Product context</label>
        <textarea id="intake" class="textarea" data-bind="intake" placeholder="A design review tool for founders who want fast, premium landing page feedback before launch...">${esc(state.intake)}</textarea>
      </div>
    `,
    footer: footerHtml({
      backAction: "back-models",
      primaryLabel: "Continue",
      primaryAction: "submit-intake",
      primaryDisabled: !state.intake.trim()
    })
  };
}

function renderFollowups() {
  if (state.loading) {
    return loadingDescriptor("Project intake", "followups");
  }

  const questions = state.followupQuestions || [];
  return {
    eyebrow: "Project intake",
    title: questions.length ? "A few missing details." : "Your context is clear.",
    helper: questions.length ? "Answer only what matters." : "Tasteprint has enough to move into taste.",
    body: `${messageHtml()}${questions.map(renderDynamicQuestion).join("")}`,
    footer: footerHtml({
      backAction: "back-intake",
      primaryLabel: "Continue",
      primaryAction: "finish-followups"
    })
  };
}

function renderPersonality() {
  if (state.loading) {
    return loadingDescriptor("Product personality", "personality");
  }

  return {
    eyebrow: "Product personality",
    title: "How should it feel?",
    helper: "Pick up to three. We tuned the first few to your product.",
    body: `
      ${messageHtml()}
      ${limitLiveHtml()}
      <div class="choice-grid three">
        ${(state.personalityOptions || []).map((option) => choiceCard({
          label: option.label,
          description: option.description,
          selected: state.personality.includes(option.label),
          action: "toggle-personality",
          value: option.label
        })).join("")}
      </div>
    `,
    footer: footerHtml({
      backAction: "back-followups",
      primaryLabel: "Continue",
      primaryAction: "submit-personality",
      primaryDisabled: state.personality.length === 0,
      counter: `${state.personality.length} / 3`
    })
  };
}

function renderAnti() {
  if (state.loading) {
    return loadingDescriptor("Product personality", "anti");
  }

  return {
    eyebrow: "Product personality",
    title: "And what should it never feel like?",
    helper: "Guardrails that keep the direction honest.",
    body: `
      ${messageHtml()}
      <div class="choice-grid">
        ${(state.antiOptions || []).map((option) => choiceCard({
          label: option.label,
          description: option.description,
          selected: state.avoid.includes(option.label),
          action: "toggle-avoid",
          value: option.label
        })).join("")}
      </div>
    `,
    footer: footerHtml({ backAction: "back-personality", primaryLabel: "Continue", primaryAction: "go-references" })
  };
}

function renderReferences() {
  const groups = [...new Set(state.referenceCatalog.map((reference) => reference.group))];
  return {
    eyebrow: "Reference selection",
    title: "Pick references for your taste.",
    helper: "Up to three — for attributes, not imitation.",
    wide: true,
    body: `
      ${messageHtml()}
      ${limitLiveHtml()}
      <div class="filter-row">
        <input class="input" data-bind="referenceSearch" value="${esc(state.referenceSearch)}" placeholder="Search references" />
      </div>
      <div class="tabs">
        ${groups.map((group) => `<button class="tab ${group === state.referenceGroup ? "active" : ""}" data-action="set-reference-group" data-value="${esc(group)}">${esc(group)}</button>`).join("")}
      </div>
      <div class="reference-grid">${filteredReferences().map(renderReferenceCard).join("")}</div>
    `,
    footer: footerHtml({
      backAction: "back-anti",
      primaryLabel: "Continue",
      primaryAction: "submit-references",
      primaryDisabled: state.references.length === 0,
      counter: `${state.references.length} / 3`
    })
  };
}

function renderReferenceTaste() {
  if (state.loading) {
    return loadingDescriptor("Taste clarification", "referenceTaste", true);
  }

  const selected = state.references.map((id) => state.referenceCatalog.find((reference) => reference.id === id)).filter(Boolean);
  return {
    eyebrow: "Taste clarification",
    title: "What do you like about these?",
    helper: "Pick the parts worth keeping.",
    wide: true,
    body: `${messageHtml()}<div class="summary-list">${selected.map(renderReferenceTasteBlock).join("")}</div>`,
    footer: footerHtml({ wide: true, backAction: "back-references", primaryLabel: "Continue", primaryAction: "go-extra" })
  };
}

function renderExtra() {
  return {
    eyebrow: "Taste clarification",
    title: "Anything to add?",
    helper: "Constraints, taste notes, competitors — optional.",
    body: `
      ${messageHtml()}
      <div class="field">
        <label class="label" for="extra">Extra notes</label>
        <textarea id="extra" class="textarea" data-bind="extra" placeholder="Make it feel more like a serious product tool than a marketing site. Avoid huge hero sections.">${esc(state.extra)}</textarea>
      </div>
    `,
    footer: footerHtml({ backAction: "back-reference-taste", primaryLabel: "Generate directions", primaryAction: "submit-extra" })
  };
}

function renderDirections() {
  if (state.loading) {
    return loadingDescriptor("Design direction", "directions", true);
  }

  const selected = state.selectedDirections.length > 0;
  return {
    eyebrow: "Design direction",
    title: "Choose a direction.",
    helper: "Pick one, or mix. Regenerate with a note.",
    wide: true,
    body: `
      ${messageHtml()}
      <div class="split">
        <div class="direction-list">
          ${(state.directions || []).map((direction) => choiceCard({
            label: direction.name,
            description: `${esc(direction.thesis)}${swatchRow(direction)}<div class="dir-lines"><strong>Good for:</strong> ${esc(direction.goodFor)}<br><strong>Avoid:</strong> ${esc(direction.avoid)}</div>${direction.tags?.length ? `<div class="tag-row">${direction.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div>` : ""}`,
            selected: state.selectedDirections.includes(direction.id),
            action: "toggle-direction",
            value: direction.id,
            extraClass: "direction-card",
            htmlDescription: true
          })).join("")}
        </div>
        <aside class="panel">
          <div class="label">Direction notes</div>
          ${selected ? state.selectedDirections.map((id) => {
            const direction = state.directions.find((item) => item.id === id);
            return `
              <div class="field" style="margin-top:14px">
                <label class="label" for="comment-${esc(id)}">${esc(direction?.name || id)}</label>
                <textarea id="comment-${esc(id)}" class="textarea" data-direction-comment="${esc(id)}" placeholder="Keep the graphite surfaces, but make the empty states warmer.">${esc(state.directionComments[id] || "")}</textarea>
              </div>
            `;
          }).join("") : `<p class="helper small">Select a direction and this space becomes editable.</p>`}
          <button class="button ghost" data-action="regenerate-directions" style="margin-top:12px">Regenerate</button>
        </aside>
      </div>
    `,
    footer: footerHtml({
      wide: true,
      backAction: "back-extra",
      primaryLabel: "Continue",
      primaryAction: "submit-directions",
      primaryDisabled: state.selectedDirections.length === 0,
      side: state.selectedDirections.length > 1 ? "Last pick sets the theme" : ""
    })
  };
}

function renderOptional() {
  if (state.loading) {
    return loadingDescriptor("Optional additions", "optional");
  }

  return {
    eyebrow: "Optional additions",
    title: "Any final tuning?",
    helper: "Optional nudges before the reveal.",
    body: `
      ${messageHtml()}
      <div class="choice-grid">
        ${(state.optionalOptions || []).map((option) => choiceCard({
          label: option.label,
          description: option.description,
          selected: state.optionalAdditions.includes(option.label),
          action: "toggle-optional",
          value: option.label
        })).join("")}
      </div>
    `,
    footer: footerHtml({ backAction: "back-directions", primaryLabel: "Preview plan", primaryAction: "submit-optional" })
  };
}

function renderPreview() {
  if (state.loading) {
    return loadingDescriptor("Preview", "preview", true);
  }

  const plan = state.plan || {};
  const rows = [
    ["Design direction", plan.designDirection],
    ["Core feeling", plan.coreFeeling],
    ["Inspired by", plan.inspiredBy],
    ["Avoid", plan.avoid],
    ["Typography", plan.typography],
    ["Color", plan.color],
    ["Components", plan.components],
    ["Motion", plan.motion]
  ];

  return {
    eyebrow: "Preview",
    title: "Review your direction.",
    helper: "This becomes your DESIGN.md and SKILL.md.",
    wide: true,
    body: `
      ${messageHtml()}
      <div class="split">
        <div class="panel">
          <div class="summary-list">
            ${rows.map(([key, value]) => `
              <div class="summary-item">
                <div class="summary-key">${esc(key)}</div>
                <div class="summary-value">${esc(value || "Not specified")}</div>
              </div>
            `).join("")}
          </div>
        </div>
        <pre class="code-preview">${esc(previewPlanMarkdown(plan))}</pre>
      </div>
    `,
    footer: footerHtml({ wide: true, backAction: "back-optional", primaryLabel: "Generate files", primaryAction: "generate-final" })
  };
}

function renderFinal() {
  if (state.loading) {
    return loadingDescriptor("Files", "final", true);
  }

  const generated = state.generated;
  if (!generated) {
    return {
      eyebrow: "Files",
      title: "No files generated yet.",
      helper: "Go back to the preview and generate the final artifacts.",
      body: messageHtml(),
      footer: footerHtml({ backAction: "back-preview", primaryLabel: "Generate files", primaryAction: "generate-final" })
    };
  }

  const designValid = generated.validation?.design?.valid;
  const skillValid = generated.validation?.skill?.valid;

  return {
    eyebrow: "Files",
    title: "Your design system is ready.",
    helper: generated.written ? "Tasteprint wrote copy-safe files into your launch directory." : "Review the artifacts, then write them into your launch directory.",
    wide: true,
    bodyClass: "final-reveal",
    body: `
      ${messageHtml()}
      ${generated.written ? noticeHtml(`Wrote ${generated.written.designPath} and ${generated.written.skillPath}`) : ""}
      <div class="validation">
        <div class="validation-row"><span>DESIGN.md format</span><span class="${designValid ? "status-ok" : "status-bad"}">${designValid ? "Valid" : "Needs review"}</span></div>
        <div class="validation-row"><span>SKILL.md format</span><span class="${skillValid ? "status-ok" : "status-bad"}">${skillValid ? "Valid" : "Needs review"}</span></div>
      </div>
      <div class="split">
        <div>
          <div class="label" style="margin-bottom:8px">DESIGN.md</div>
          <pre class="code-preview">${esc(generated.designMd)}</pre>
        </div>
        <div>
          <div class="label" style="margin-bottom:8px">SKILL.md</div>
          <pre class="code-preview">${esc(generated.skillMd)}</pre>
        </div>
      </div>
    `,
    footer: footerHtml({
      wide: true,
      backAction: "back-preview",
      primaryLabel: generated.written ? "Write another copy" : "Write files",
      primaryAction: "write-files"
    })
  };
}

const LOADING_TITLES = {
  followups: "Reading your project.",
  personality: "Shaping the taste options.",
  anti: "Setting the guardrails.",
  referenceTaste: "Reading your references.",
  directions: "Composing three directions.",
  optional: "Preparing the final tuning.",
  preview: "Building your preview.",
  final: "Generating your files."
};

function loadingDescriptor(eyebrow, key, wide = false) {
  return {
    eyebrow,
    title: LOADING_TITLES[key] || "Working.",
    helper: "",
    wide,
    body: loaderBodyHtml(),
    loadingKey: key
  };
}

/* ---------------- Render helpers ---------------- */

function renderDynamicQuestion(question) {
  const value = state.intakeAnswers[question.id];
  if (question.type === "single") {
    return `
      <div class="question-block">
        <div class="question-title">${esc(question.prompt)}</div>
        <div class="choice-grid">
          ${(question.options || []).map((option) => choiceCard({
            label: option,
            description: "",
            selected: value === option,
            action: "answer-single",
            value: `${question.id}::${option}`
          })).join("")}
        </div>
      </div>
    `;
  }

  if (question.type === "multi") {
    const selectedValues = Array.isArray(value) ? value : [];
    return `
      <div class="question-block">
        <div class="question-title">${esc(question.prompt)}</div>
        <div class="choice-grid">
          ${(question.options || []).map((option) => choiceCard({
            label: option,
            description: "",
            selected: selectedValues.includes(option),
            action: "answer-multi",
            value: `${question.id}::${option}`
          })).join("")}
        </div>
      </div>
    `;
  }

  return `
    <div class="question-block">
      <label class="question-title" for="question-${esc(question.id)}">${esc(question.prompt)}</label>
      <input id="question-${esc(question.id)}" class="input" data-answer-text="${esc(question.id)}" value="${esc(value || "")}" placeholder="${esc(question.placeholder || "")}" />
    </div>
  `;
}

function filteredReferences() {
  const query = state.referenceSearch.trim().toLowerCase();
  return state.referenceCatalog.filter((reference) => {
    const matchesGroup = reference.group === state.referenceGroup;
    const matchesSearch = !query || `${reference.name} ${reference.description} ${reference.group}`.toLowerCase().includes(query);
    return matchesGroup && matchesSearch;
  });
}

function updateReferenceGrid() {
  const grid = document.querySelector(".reference-grid");
  if (grid) {
    grid.innerHTML = filteredReferences().map(renderReferenceCard).join("");
  }
}

function renderReferenceCard(reference) {
  const selected = state.references.includes(reference.id);
  const preview = reference.preview || {};
  const style = [
    `--ref-canvas:${preview.canvas}`,
    `--ref-surface:${preview.surface}`,
    `--ref-ink:${preview.ink}`,
    `--ref-primary:${preview.primary}`,
    `--ref-hairline:${preview.hairline}`,
    `--ref-font:${preview.fontFamily}`
  ].join(";");

  return `
    <button class="reference-card ${selected ? "selected" : ""}" data-action="toggle-reference" data-value="${esc(reference.id)}" aria-pressed="${selected}">
      <div class="reference-preview" style="${esc(style)}">
        <div class="preview-top"><div class="preview-dot"></div><div class="preview-line short"></div></div>
        <div class="preview-lines"><div class="preview-line"></div><div class="preview-line short"></div></div>
        <div class="preview-panel"></div>
      </div>
      <div>
        <div class="reference-name">${esc(reference.name)}</div>
        <div class="reference-copy">${esc(reference.description)}</div>
      </div>
    </button>
  `;
}

function renderReferenceTasteBlock(reference) {
  const options = state.referenceLikeOptions?.byReference?.[reference.id]?.options || [];
  const current = state.referenceLikes[reference.id] || { selected: [], note: "" };
  const brand = brandForReference(reference.id);
  const accent = brand ? ensureContrast(brand.accent, activeTheme.canvas, 3).hex : activeTheme.ink;

  return `
    <div class="panel taste-block" style="--brand-accent:${esc(accent)}">
      <div class="question-title">What do you like about <span class="brand-name">${esc(reference.name)}</span>?</div>
      <div class="choice-grid three" style="margin-top:14px">
        ${options.map((option) => choiceCard({
          label: option,
          description: "",
          selected: current.selected?.includes(option),
          action: "toggle-reference-like",
          value: `${reference.id}::${option}`
        })).join("")}
      </div>
      <div class="field" style="margin-top:16px">
        <label class="label" for="note-${esc(reference.id)}">Anything specific?</label>
        <textarea id="note-${esc(reference.id)}" class="textarea" data-reference-note="${esc(reference.id)}" placeholder="The typography feels calm, but I want less product photography.">${esc(current.note || "")}</textarea>
      </div>
    </div>
  `;
}

function swatchRow(direction) {
  const colors = direction.colors;
  if (!colors) {
    return "";
  }
  const swatches = [colors.primary, colors.secondary, colors.tertiary, colors.canvas, colors.ink]
    .filter(Boolean)
    .map((hex) => `<span class="swatch" style="background:${esc(hex)}"></span>`)
    .join("");
  return `<div class="swatch-row">${swatches}</div>`;
}

// Renders text that is sliced along a diagonal seam: the left wedge takes --sl,
// the right wedge takes --sr. Off the model screen those vars are unset, so both
// wedges fall back to currentColor and it reads as ordinary text. When the two
// chosen models match, --sl === --sr and the seam disappears.
function splitText(text) {
  const safe = esc(text);
  return `<span class="split-text"
    ><span class="split-base">${safe}</span
    ><span class="split-layer left" aria-hidden="true">${safe}</span
    ><span class="split-layer right" aria-hidden="true">${safe}</span
  ></span>`;
}

function choiceCard({ label, description, selected, action, value, extraClass = "", htmlDescription = false }) {
  return `
    <button class="choice-card ${selected ? "selected" : ""} ${extraClass}" data-action="${esc(action)}" data-value="${esc(value)}" aria-pressed="${selected}">
      <span class="choice-title">${esc(label)}</span>
      ${description ? `<span class="choice-desc">${htmlDescription ? description : esc(description)}</span>` : ""}
    </button>
  `;
}

function footerHtml({ primaryLabel, primaryAction, primaryDisabled = false, backAction, side = "", counter = "", modelCta = false, arrow = false }) {
  const classes = ["button", "primary", modelCta ? "model-cta" : "", arrow ? "has-arrow" : ""].filter(Boolean).join(" ");
  return `
    <div class="footer-side">
      ${backAction ? `<button class="button ghost" data-action="${esc(backAction)}">Back</button>` : ""}
      ${counter ? `<span class="counter-chip">${esc(counter)}</span>` : ""}
      ${side ? `<span class="footer-note">${esc(side)}</span>` : ""}
    </div>
    ${primaryLabel ? `<button class="${classes}" data-action="${esc(primaryAction)}" ${primaryDisabled ? "disabled" : ""}><span class="btn-label">${esc(primaryLabel)}</span></button>` : ""}
  `;
}

function limitLiveHtml() {
  return `<span id="limit-live" aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"></span>`;
}

function contextUsageHtml() {
  const primary = state.usage.primary;
  const secondary = state.usage.secondary;
  if (!primary && !secondary) {
    return "";
  }
  return `
    <div class="context-usage" aria-label="Estimated context usage">
      ${primary ? `<span>P ${formatTokens(primary.tokens)}${primary.contextWindow ? `/${formatTokens(primary.contextWindow)}` : ""}</span>` : ""}
      ${secondary ? `<span>S ${formatTokens(secondary.tokens)}${secondary.contextWindow ? `/${formatTokens(secondary.contextWindow)}` : ""}</span>` : ""}
    </div>
  `;
}

function messageHtml() {
  return `${state.error ? errorHtml(state.error) : ""}${state.notice ? noticeHtml(state.notice) : ""}`;
}

function noticeHtml(message) {
  return `<div class="notice">${esc(message)}</div>`;
}

function errorHtml(message) {
  return `<div class="error">${esc(message)}</div>`;
}

/* ---------------- Model selection helpers ---------------- */

function modelWithDefaults(model) {
  if (!model) {
    return null;
  }
  const clone = structuredClone(model);
  clone.variant = clone.variants?.find((variant) => variant.id === clone.defaultVariantId) || clone.variants?.[0] || null;
  clone.thinking = defaultThinkingFor(clone, clone.variant);
  clone.customModelId = "";
  return clone;
}

function defaultThinkingFor(model, variant) {
  const options = variant?.thinkingOptions?.length ? variant.thinkingOptions : model?.thinkingOptions || [];
  return options.find((option) => option.id === variant?.defaultThinkingId)
    || options.find((option) => option.id === model?.defaultThinkingId)
    || options.find((option) => option.id === "medium")
    || options[0]
    || null;
}

function usageTextForSelection(selection, role) {
  const usage = state.usage[role];
  if (usage) {
    return `${formatTokens(usage.tokens)} / ${formatTokens(usage.contextWindow)} context`;
  }
  const window = selection?.variant?.contextWindow || 128000;
  return `${formatTokens(window)} context window`;
}

function syncSelectValues() {
  document.querySelectorAll("[data-bind-model]").forEach((element) => {
    element.value = state.models[element.dataset.bindModel]?.id || "";
  });
  document.querySelectorAll("[data-bind-model-variant]").forEach((element) => {
    element.value = state.models[element.dataset.bindModelVariant]?.variant?.id || "";
  });
  document.querySelectorAll("[data-bind-model-thinking]").forEach((element) => {
    element.value = state.models[element.dataset.bindModelThinking]?.thinking?.id || "";
  });
}

/* ---------------- Events (delegated, bound once) ---------------- */

function bindAppEvents() {
  app.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) {
      return;
    }
    event.preventDefault();
    handleAction(trigger.dataset.action, trigger.dataset.value);
  });

  app.addEventListener("input", onInput);
  app.addEventListener("change", onChange);

  document.addEventListener("keydown", (event) => {
    // Esc is the quiet a11y fast-path straight to models. Enter/Space are left to the
    // browser so they activate the focused Start Designing CTA (with the exit motion).
    if (state.step === "intro" && event.key === "Escape") {
      advanceFromIntro();
    }
  });
}

function onInput(event) {
  const element = event.target;
  if (element.dataset.bind) {
    state[element.dataset.bind] = element.value;
    if (element.dataset.bind === "referenceSearch") {
      updateReferenceGrid();
    } else {
      updatePrimaryDisabled();
    }
    return;
  }
  if (element.dataset.answerText) {
    state.intakeAnswers[element.dataset.answerText] = element.value;
    return;
  }
  if (element.dataset.referenceNote) {
    const id = element.dataset.referenceNote;
    state.referenceLikes[id] ||= { selected: [], note: "" };
    state.referenceLikes[id].note = element.value;
    return;
  }
  if (element.dataset.directionComment) {
    state.directionComments[element.dataset.directionComment] = element.value;
    return;
  }
  if (element.dataset.bindCustomModel) {
    const role = element.dataset.bindCustomModel;
    if (state.models[role]) {
      state.models[role].customModelId = element.value.trim();
      state.usage[role] = null;
    }
  }
}

function onChange(event) {
  const element = event.target;
  if (element.dataset.bindModel) {
    const role = element.dataset.bindModel;
    state.models[role] = modelWithDefaults(state.availableModels.find((model) => model.id === element.value));
    state.usage[role] = null;
    refreshModelCard(role);
    return;
  }
  if (element.dataset.bindModelVariant) {
    const role = element.dataset.bindModelVariant;
    const model = state.models[role];
    const variant = model?.variants?.find((item) => item.id === element.value);
    if (model) {
      model.variant = variant;
      model.thinking = defaultThinkingFor(model, variant);
      state.usage[role] = null;
    }
    refreshModelCard(role);
    return;
  }
  if (element.dataset.bindModelThinking) {
    const role = element.dataset.bindModelThinking;
    const model = state.models[role];
    const options = model?.variant?.thinkingOptions?.length ? model.variant.thinkingOptions : model?.thinkingOptions || [];
    if (model) {
      model.thinking = options.find((item) => item.id === element.value) || options[0];
      state.usage[role] = null;
    }
    refreshModelCard(role);
  }
}

function updatePrimaryDisabled() {
  const primaryBtn = document.querySelector("#footer .button.primary");
  if (!primaryBtn) {
    return;
  }
  if (state.step === "intake") {
    primaryBtn.disabled = !state.intake.trim();
  }
}

/* ---------------- Actions ---------------- */

async function handleAction(action, value) {
  state.error = "";
  state.notice = "";

  try {
    switch (action) {
      case "start-designing":
        // In the anatomy editor the accent dot lives on this button — swallow the
        // click so dragging it never navigates away from the tool.
        if (ANATOMY_EDIT) {
          return;
        }
        return exitIntro();
      case "start-intake":
        return go("intake");
      case "back-models":
        return go("models");
      case "back-intake":
        return go("intake");
      case "submit-intake":
        return submitIntake();
      case "answer-single":
        return answerSingle(value);
      case "answer-multi":
        return answerMulti(value);
      case "finish-followups":
        appendPrimaryContext("Project intake answers", summarizeObject(state.intakeAnswers));
        return loadPersonality();
      case "back-followups":
        return state.followupQuestions.length ? go("followups") : go("intake");
      case "toggle-personality":
        return toggleLimited(state.personality, value, 3);
      case "submit-personality":
        appendPrimaryContext("Selected personality", state.personality.join(", "));
        return loadAntiVibe();
      case "back-personality":
        return go("personality");
      case "toggle-avoid":
        return toggleValue(state.avoid, value);
      case "go-references":
        appendPrimaryContext("Avoid", state.avoid.join(", "));
        return go("references");
      case "back-anti":
        return go("anti");
      case "set-reference-group":
        state.referenceGroup = value;
        return refresh();
      case "toggle-reference":
        return toggleLimited(state.references, value, 3);
      case "submit-references":
        appendPrimaryContext("Selected references", state.references.join(", "));
        return loadReferenceLikes();
      case "back-references":
        return go("references");
      case "toggle-reference-like":
        return toggleReferenceLike(value);
      case "go-extra":
        appendPrimaryContext("Reference likes", JSON.stringify(state.referenceLikes, null, 2));
        return go("extra");
      case "back-reference-taste":
        return go("referenceTaste");
      case "submit-extra":
        appendPrimaryContext("Extra notes", state.extra || "None");
        return loadDirections();
      case "toggle-direction":
        return toggleDirection(value);
      case "regenerate-directions":
        state.regenerationHistory.push({
          rejectedDirections: state.directions || [],
          comments: state.directionComments,
          at: new Date().toISOString()
        });
        state.selectedDirections = [];
        state.directionComments = {};
        state.lockedDirection = null;
        return loadDirections();
      case "submit-directions":
        appendPrimaryContext("Selected directions", JSON.stringify({
          selectedDirections: state.selectedDirections,
          comments: state.directionComments
        }, null, 2));
        return loadOptional();
      case "back-extra":
        return go("extra");
      case "toggle-optional":
        return toggleValue(state.optionalAdditions, value);
      case "submit-optional":
        appendPrimaryContext("Optional additions", state.optionalAdditions.join(", "));
        return loadPlan();
      case "back-directions":
        return go("directions");
      case "back-optional":
        return go("optional");
      case "generate-final":
        return generateFinal();
      case "back-preview":
        return go("preview");
      case "write-files":
        return writeFiles();
      default:
        return null;
    }
  } catch (error) {
    state.loading = "";
    state.error = error.message;
    refresh();
  }
}

/* ---------------- Network steps ---------------- */

async function submitIntake() {
  if (!state.intake.trim()) {
    state.error = "Paste a bit of project context before continuing.";
    return refresh();
  }

  state.step = "followups";
  state.loading = "followups";
  paint({ transition: true });
  const result = await postJson("/api/onboarding/intake", { state: compactState() });
  state.loading = "";
  applyModelResult(result, "Project intake");
  state.followupQuestions = result.questions || [];
  if (!state.followupQuestions.length) {
    return loadPersonality();
  }
  paint({ transition: true });
}

async function loadPersonality() {
  state.step = "personality";
  state.loading = "personality";
  paint({ transition: true });
  const result = await postJson("/api/onboarding/personality", { state: compactState() });
  state.loading = "";
  applyModelResult(result, "Product personality");
  state.personalityOptions = result.options || [];
  paint({ transition: true });
}

async function loadAntiVibe() {
  state.step = "anti";
  state.loading = "anti";
  paint({ transition: true });
  const result = await postJson("/api/onboarding/anti-vibe", { state: compactState() });
  state.loading = "";
  applyModelResult(result, "Anti-vibe");
  state.antiOptions = result.options || [];
  paint({ transition: true });
}

async function loadReferenceLikes() {
  state.step = "referenceTaste";
  state.loading = "referenceTaste";
  paint({ transition: true });
  const result = await postJson("/api/onboarding/reference-likes", { state: compactState() });
  state.loading = "";
  applyModelResult(result, "Reference clarification");
  state.referenceLikeOptions = result;
  for (const id of state.references) {
    state.referenceLikes[id] ||= { selected: [], note: "" };
  }
  paint({ transition: true });
}

async function loadDirections() {
  state.step = "directions";
  state.loading = "directions";
  paint({ transition: true });
  const result = await postJson("/api/onboarding/directions", { state: compactState() });
  state.loading = "";
  applyModelResult(result, "Design directions");
  state.directions = result.directions || [];
  paint({ transition: true });
}

async function loadOptional() {
  state.step = "optional";
  state.loading = "optional";
  paint({ transition: true });
  const result = await postJson("/api/onboarding/optional-additions", { state: compactState() });
  state.loading = "";
  applyModelResult(result, "Optional additions");
  state.optionalOptions = result.options || [];
  paint({ transition: true });
}

async function loadPlan() {
  state.step = "preview";
  state.loading = "preview";
  paint({ transition: true });
  const result = await postJson("/api/onboarding/plan", { state: compactState() });
  state.loading = "";
  applyModelResult(result, "Preview plan");
  state.plan = result.plan;
  paint({ transition: true });
}

async function generateFinal() {
  state.step = "final";
  state.loading = "final";
  paint({ transition: true });
  const result = await postJson("/api/onboarding/final", { state: compactState() });
  state.loading = "";
  applyModelResult(result, "Final files");
  state.generated = {
    designMd: result.designMd,
    skillMd: result.skillMd,
    validation: result.validation
  };
  paint({ transition: true });
}

async function writeFiles() {
  if (!state.generated) {
    return;
  }
  state.loading = "final";
  paint();
  const result = await postJson("/api/write-files", {
    designMd: state.generated.designMd,
    skillMd: state.generated.skillMd
  });
  state.loading = "";
  state.generated.written = result.files;
  paint({ transition: true });
}

/* ---------------- Selection mutations ---------------- */

function answerSingle(value) {
  const [id, option] = splitValue(value);
  state.intakeAnswers[id] = option;
  refresh();
}

function answerMulti(value) {
  const [id, option] = splitValue(value);
  state.intakeAnswers[id] ||= [];
  toggleValue(state.intakeAnswers[id], option);
}

function toggleReferenceLike(value) {
  const [id, option] = splitValue(value);
  state.referenceLikes[id] ||= { selected: [], note: "" };
  toggleValue(state.referenceLikes[id].selected, option);
}

function toggleDirection(value) {
  toggleValue(state.selectedDirections, value, { silent: true });
  const lastId = state.selectedDirections[state.selectedDirections.length - 1];
  state.lockedDirection = lastId ? (state.directions || []).find((item) => item.id === lastId) || null : null;
  refresh();
}

function toggleValue(list, value, { silent = false } = {}) {
  const index = list.indexOf(value);
  if (index >= 0) {
    list.splice(index, 1);
  } else {
    list.push(value);
  }
  if (!silent) {
    refresh();
  }
}

function toggleLimited(list, value, limit) {
  const index = list.indexOf(value);
  if (index >= 0) {
    list.splice(index, 1);
  } else if (list.length < limit) {
    list.push(value);
  } else {
    pendingPulse = true;
  }
  refresh();
}

/* ---------------- Context + payload ---------------- */

function applyModelResult(result, label) {
  if (result.summaryForPrimary) {
    appendPrimaryContext(label, result.summaryForPrimary);
  }
  if (result.modelMeta?.usage?.role) {
    state.usage[result.modelMeta.usage.role] = result.modelMeta.usage;
  }
  state.notice = result.modelMeta?.warning || "";
}

function appendPrimaryContext(label, summary) {
  if (!summary) {
    return;
  }
  const entry = `## ${label}\n${summary}`;
  state.history.push({ label, summary, at: new Date().toISOString() });
  state.primaryContext = [...state.primaryContext.split("\n\n").filter(Boolean), entry].join("\n\n");
}

function compactState() {
  const { availableModels, referenceCatalog, loading, error, notice, usage, ...rest } = state;
  return {
    ...rest,
    models: {
      primary: compactModelSelection(state.models.primary),
      secondary: compactModelSelection(state.models.secondary)
    }
  };
}

function compactModelSelection(model) {
  if (!model) {
    return null;
  }
  return {
    id: model.id,
    label: model.label,
    executable: model.executable,
    path: model.path,
    role: model.role,
    fallback: model.fallback,
    localOnly: model.localOnly,
    variant: model.variant,
    thinking: model.thinking,
    customModelId: model.customModelId,
    contextWindow: model.variant?.contextWindow
  };
}

function previewPlanMarkdown(plan = {}) {
  return `Design direction:
${plan.designDirection || ""}

Core feeling:
${plan.coreFeeling || ""}

Inspired by:
${plan.inspiredBy || ""}

Avoid:
${plan.avoid || ""}

Typography:
${plan.typography || ""}

Color:
${plan.color || ""}

Components:
${plan.components || ""}

Motion:
${plan.motion || ""}`;
}

function summarizeObject(value) {
  return Object.entries(value || {})
    .map(([key, item]) => `${key}: ${Array.isArray(item) ? item.join(", ") : item}`)
    .join("; ");
}

function splitValue(value) {
  const index = value.indexOf("::");
  return [value.slice(0, index), value.slice(index + 2)];
}

function formatTokens(value) {
  const number = Number(value) || 0;
  if (number >= 1000000) {
    return `${(number / 1000000).toFixed(number >= 10000000 ? 0 : 1)}m`;
  }
  if (number >= 1000) {
    return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}k`;
  }
  return String(number);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function getJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
