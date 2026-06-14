import { applyTheme, BASE_THEME, buildTheme } from "./theme.js";
import { ensureContrast } from "./color.js";
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

const LOADER_PHRASES = {
  boot: ["Loading your local studio."],
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
let introTimer = null;
let activeTheme = { ...BASE_THEME };

bindAppEvents();
init();

async function init() {
  applyTheme(BASE_THEME);
  state.loading = "boot";
  paint();

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

    const installed = state.availableModels.filter((model) => !model.fallback);
    const fallback = state.availableModels.find((model) => model.fallback) || state.availableModels[0];
    state.models.primary = modelWithDefaults(installed[0] || fallback);
    state.models.secondary = modelWithDefaults(installed[1] || installed[0] || fallback);
    state.loading = "";
    state.step = state.introSeen ? "models" : "intro";
  } catch (error) {
    state.loading = "";
    state.step = "models";
    state.error = error.message;
  }

  paint({ transition: true });
}

/* ---------------- Painting ---------------- */

function paint({ transition = false } = {}) {
  stopLoader();

  if (state.loading === "boot") {
    shellMounted = false;
    app.innerHTML = `<div class="intro"><div class="loader" style="width:min(420px,80vw)"><div class="loader-line"></div><div class="loader-status">${esc(LOADER_PHRASES.boot[0])}</div></div></div>`;
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
        <div class="brand">Tasteprint</div>
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

  screen.className = `screen ${descriptor.wide ? "wide" : ""}`;
  screen.innerHTML = `
    <p class="eyebrow">${esc(descriptor.eyebrow)}</p>
    <h1 class="title">${esc(descriptor.title)}</h1>
    ${descriptor.helper ? `<p class="helper">${esc(descriptor.helper)}</p>` : ""}
    <div class="body ${descriptor.bodyClass || ""}">${descriptor.body}</div>
  `;
  footer.innerHTML = descriptor.loadingKey ? "" : (descriptor.footer || "");

  if (transition) {
    // Reset any in-flight enter animation, then force a reflow so re-adding the
    // class restarts it (otherwise a same-node re-render won't replay the motion).
    screen.classList.remove("screen-enter");
    void screen.offsetWidth;
    screen.classList.add("screen-enter");
    screen.addEventListener("animationend", () => screen.classList.remove("screen-enter"), { once: true });
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
  app.innerHTML = `
    <div class="intro" data-action="skip-intro">
      <div class="intro-grid"></div>
      <div class="intro-stage">
        <div class="intro-spark"></div>
        <h1 class="intro-wordmark">Tasteprint</h1>
        <p class="intro-sub">A design file your agent can follow.</p>
      </div>
      <button class="intro-skip" data-action="skip-intro">Skip</button>
    </div>
  `;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  clearTimeout(introTimer);
  introTimer = setTimeout(advanceFromIntro, reduce ? 600 : 2300);
}

function advanceFromIntro() {
  if (state.step !== "intro") {
    return;
  }
  clearTimeout(introTimer);
  state.introSeen = true;
  go("models");
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

function renderModels() {
  const installedCount = state.availableModels.filter((model) => !model.fallback).length;

  return {
    eyebrow: "Model setup",
    title: "Choose your models.",
    helper: "A primary model for synthesis, a secondary for the interview.",
    body: `
      ${state.error ? errorHtml(state.error) : ""}
      ${installedCount || state.localOnly ? "" : noticeHtml("No supported CLI model was detected on PATH. You can still run the full onboarding in local draft mode.")}
      <div class="model-grid">
        ${renderModelSelector("primary", "Primary", "Synthesizes directions and writes the files.")}
        ${renderModelSelector("secondary", "Secondary", "Runs the interview and reads references.")}
      </div>
      <div class="panel" style="margin-top:16px">
        <div class="label">Output directory</div>
        <p class="helper small"><code>${esc(state.projectDir || "Current directory")}</code></p>
      </div>
    `,
    footer: footerHtml({ primaryLabel: "Start", primaryAction: "start-intake", side: "npx tasteprint" })
  };
}

function renderModelSelector(role, title, helper) {
  const selected = state.models[role] || modelWithDefaults(state.availableModels[0]);
  const modelOptions = state.availableModels
    .map((model) => `<option value="${esc(model.id)}" ${selected?.id === model.id ? "selected" : ""}>${esc(model.label)}${!model.fallback && model.path && !model.localOnly ? " · detected" : ""}</option>`)
    .join("");
  const variants = selected?.variants?.length ? selected.variants : [];
  const selectedVariant = selected?.variant || variants[0];
  const thinkingOptions = selectedVariant?.thinkingOptions?.length ? selectedVariant.thinkingOptions : selected?.thinkingOptions || [];
  const selectedThinking = selected?.thinking || thinkingOptions[0];
  const custom = selectedVariant?.custom || selectedVariant?.id === "custom";

  return `
    <div class="panel model-panel">
      <div class="model-role"><span class="role-dot ${role}"></span>${esc(title)}</div>
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
      ${custom ? `
        <div class="field">
          <label class="label" for="${role}CustomModel">Custom model id</label>
          <input class="input" id="${role}CustomModel" data-bind-custom-model="${esc(role)}" value="${esc(selected.customModelId || "")}" placeholder="gpt-5.5, opus, provider/model" />
        </div>
      ` : ""}
      <div class="field">
        <label class="label" for="${role}Thinking">Thinking</label>
        <select class="select" id="${role}Thinking" data-bind-model-thinking="${esc(role)}">
          ${thinkingOptions.map((option) => `<option value="${esc(option.id)}" ${selectedThinking?.id === option.id ? "selected" : ""}>${esc(option.label)}</option>`).join("")}
        </select>
      </div>
      <p class="helper small">${esc(helper)}</p>
      <div class="model-meta">
        <span>${esc(selectedVariant?.description || "Use the selected CLI configuration.")}</span>
        <span>${usageTextForSelection(selected, role)}</span>
      </div>
    </div>
  `;
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

function choiceCard({ label, description, selected, action, value, extraClass = "", htmlDescription = false }) {
  return `
    <button class="choice-card ${selected ? "selected" : ""} ${extraClass}" data-action="${esc(action)}" data-value="${esc(value)}" aria-pressed="${selected}">
      <span class="choice-title">${esc(label)}</span>
      ${description ? `<span class="choice-desc">${htmlDescription ? description : esc(description)}</span>` : ""}
    </button>
  `;
}

function footerHtml({ primaryLabel, primaryAction, primaryDisabled = false, backAction, side = "", counter = "" }) {
  return `
    <div class="footer-side">
      ${backAction ? `<button class="button ghost" data-action="${esc(backAction)}">Back</button>` : ""}
      ${counter ? `<span class="counter-chip">${esc(counter)}</span>` : ""}
      ${side ? `<span>${esc(side)}</span>` : ""}
    </div>
    ${primaryLabel ? `<button class="button primary" data-action="${esc(primaryAction)}" ${primaryDisabled ? "disabled" : ""}>${esc(primaryLabel)}</button>` : ""}
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
    if (state.step === "intro" && (event.key === "Escape" || event.key === "Enter" || event.key === " ")) {
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
    refresh();
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
    refresh();
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
      case "skip-intro":
        return advanceFromIntro();
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
