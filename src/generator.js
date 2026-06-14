import { access, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { analyzePalette, createColorSystem, suggestThirdColor } from "./colorTools.js";

const PRODUCT_TYPES = [
  "SaaS dashboard",
  "Consumer app",
  "Developer tool",
  "Creative tool",
  "Marketplace",
  "Mobile app",
  "Internal tool",
  "Other"
];

const PERSONALITY_OPTIONS = [
  "Premium",
  "Minimal",
  "Technical",
  "Playful",
  "Fast",
  "Calm",
  "Dense",
  "Spacious",
  "Editorial",
  "Futuristic",
  "Trustworthy",
  "Creative",
  "Enterprise",
  "Warm",
  "Sharp"
];

const AVOID_OPTIONS = [
  "Generic SaaS",
  "Overly playful",
  "Corporate",
  "Crypto / Web3",
  "Childish",
  "Too colorful",
  "Too empty",
  "Too dense",
  "Apple clone",
  "Linear clone",
  "Startup template"
];

const REFERENCE_TRAITS = {
  apple: ["Typography", "Spacing", "Calmness", "Premium feel", "Product photography style", "Motion", "Simplicity", "Navigation", "Color restraint", "Other"],
  stripe: ["Soft technical polish", "Gradient restraint", "Thin typography", "Clear CTAs", "Dashboard contrast", "Trust", "Information hierarchy", "Other"],
  vercel: ["Black and white clarity", "Developer confidence", "Sharp typography", "Sparse layout", "Docs-like precision", "Fast-feeling UI", "Other"],
  linear: ["Graphite surfaces", "Interface density", "Lavender accent", "Hairline borders", "Keyboard-first feel", "Precise motion", "Other"],
  raycast: ["Command palette feel", "Dark chrome", "Compact controls", "Premium gradients", "Keyboard-first workflows", "Other"],
  nvidia: ["Technical power", "High contrast", "Green accent", "Data-heavy confidence", "Hardware-like sharpness", "Other"],
  github: ["Developer-native hierarchy", "Readable density", "Reliable controls", "Code-first patterns", "Neutral palette", "Other"],
  figma: ["Creative tooling", "Collaborative feel", "Lively accents", "Clean panels", "Canvas metaphors", "Other"],
  blender: ["Power-user controls", "Viewport density", "Technical creativity", "Compact panels", "Dark UI", "Other"],
  datadog: ["Operational scanning", "Charts and metrics", "Enterprise clarity", "Dense dashboards", "Status colors", "Other"],
  runway: ["Editorial confidence", "Cinematic pacing", "Black and white contrast", "Creative seriousness", "Minimal chrome", "Other"],
  framer: ["Motion", "Design polish", "Bold type", "Visual composition", "Modern creator energy", "Other"],
  webflow: ["Creator workflow clarity", "Blue technical accent", "Product UI framing", "Structured panels", "Polished marketing", "Other"],
  notion: ["Warm minimalism", "Document calm", "Soft surfaces", "Readable content", "Approachable controls", "Other"],
  canva: ["Accessible creativity", "Friendly choices", "Visual templates", "Colorful controls", "Low-friction onboarding", "Other"],
  salesforce: ["Enterprise trust", "Guided workflows", "Approachable business UI", "Clear forms", "Large-system confidence", "Other"],
  atlassian: ["Team software clarity", "Structured navigation", "Blue trust", "Practical panels", "Workflow states", "Other"],
  microsoft: ["Familiar productivity", "Accessible controls", "Systematic layouts", "Subtle surfaces", "Enterprise polish", "Other"],
  shopify: ["Commerce trust", "Merchant workflows", "Conversion clarity", "Dark cinematic polish", "Green signal", "Other"],
  airbnb: ["Human warmth", "Marketplace trust", "Photography-aware UI", "Soft radius", "Accessible browsing", "Other"],
  cursor: ["Editor calm", "Restrained chrome", "Developer focus", "Dark mode", "Compact controls", "Other"],
  superhuman: ["Keyboard speed", "Premium dark polish", "Dense efficiency", "Precise motion", "Focus states", "Other"],
  supabase: ["Developer dashboards", "Dark surfaces", "Green signal", "Structured panels", "Docs clarity", "Other"],
  posthog: ["Product analytics energy", "Playful-technical tone", "Orange signal", "Dense data UI", "Other"],
  sentry: ["Observability focus", "Dark chrome", "Violet accent", "Status clarity", "Other"],
  spotify: ["Bold media energy", "Dark surfaces", "Green signal", "Editorial covers", "Other"],
  slack: ["Team workspace warmth", "Structured navigation", "Purple signal", "Approachable controls", "Other"],
  ibm: ["Grid discipline", "Enterprise rigor", "Blue trust", "Systematic type", "Other"],
  claude: ["Warm literate calm", "Clay accent", "Readable density", "Agent-native restraint", "Other"],
  mistral: ["Sharp lab energy", "Dark chrome", "Orange signal", "Technical confidence", "Other"],
  tesla: ["Minimal product drama", "Dark cinematic surfaces", "Red signal", "Stark contrast", "Other"],
  nike: ["Athletic boldness", "Stark contrast", "Decisive type", "Editorial energy", "Other"]
};

const REFERENCE_NAMES = {
  apple: "Apple",
  stripe: "Stripe",
  vercel: "Vercel",
  linear: "Linear",
  raycast: "Raycast",
  cursor: "Cursor",
  superhuman: "Superhuman",
  resend: "Resend",
  sanity: "Sanity",
  nvidia: "Nvidia",
  figma: "Figma",
  warp: "Warp",
  supabase: "Supabase",
  clickhouse: "ClickHouse",
  mongodb: "MongoDB",
  hashicorp: "HashiCorp",
  posthog: "PostHog",
  sentry: "Sentry",
  runway: "Runway",
  framer: "Framer",
  webflow: "Webflow",
  notion: "Notion",
  spotify: "Spotify",
  pinterest: "Pinterest",
  miro: "Miro",
  lovable: "Lovable",
  claude: "Claude",
  mistral: "Mistral",
  cohere: "Cohere",
  together: "Together",
  elevenlabs: "ElevenLabs",
  replicate: "Replicate",
  xai: "xAI",
  minimax: "MiniMax",
  ollama: "Ollama",
  opencode: "OpenCode",
  shopify: "Shopify",
  airbnb: "Airbnb",
  intercom: "Intercom",
  slack: "Slack",
  ibm: "IBM",
  wise: "Wise",
  coinbase: "Coinbase",
  uber: "Uber",
  wired: "WIRED",
  theverge: "The Verge",
  nike: "Nike",
  tesla: "Tesla",
  starbucks: "Starbucks"
};

export function createFallbackIntakeQuestions(state = {}) {
  const dump = (state.intake || "").toLowerCase();
  const answers = state.intakeAnswers || {};
  const questions = [];

  if (!answers.productType && !PRODUCT_TYPES.some((type) => dump.includes(type.toLowerCase().split(" ")[0]))) {
    questions.push({
      id: "productType",
      type: "single",
      prompt: "What kind of product is it?",
      options: PRODUCT_TYPES
    });
  }

  if (!answers.audience && !/\b(for|users|customers|audience|teams|founders|developers|designers|marketers|consumers)\b/.test(dump)) {
    questions.push({
      id: "audience",
      type: "text",
      prompt: "Who is the product for?",
      placeholder: "Founders, marketers, and product teams."
    });
  }

  if (!answers.coreWorkflow && !/\b(onboarding|dashboard|editor|checkout|workflow|create|manage|analyze|monitor|publish)\b/.test(dump)) {
    questions.push({
      id: "coreWorkflow",
      type: "text",
      prompt: "What is the most important workflow or screen?",
      placeholder: "Example: A focused dashboard for reviewing launch readiness."
    });
  }

  return questions.slice(0, 3);
}

export function createFallbackPersonalityOptions(state = {}) {
  const dump = `${state.intake || ""} ${JSON.stringify(state.intakeAnswers || {})}`.toLowerCase();
  const priority = [];

  if (/\b(ai|agent|developer|api|code|technical|model|cli)\b/.test(dump)) {
    priority.push("Technical", "Sharp", "Fast");
  }
  if (/\b(founder|enterprise|team|business|b2b|saas)\b/.test(dump)) {
    priority.push("Trustworthy", "Premium", "Enterprise");
  }
  if (/\b(creator|design|video|image|studio|creative|brand)\b/.test(dump)) {
    priority.push("Creative", "Editorial", "Spacious");
  }
  if (/\b(consumer|mobile|social|community|habit)\b/.test(dump)) {
    priority.push("Warm", "Playful", "Calm");
  }

  const ordered = unique([...priority, ...PERSONALITY_OPTIONS]);
  return ordered.map((label) => ({
    label,
    description: personalityDescription(label)
  }));
}

export function createFallbackAntiVibeOptions(state = {}) {
  const selected = new Set(state.personality || []);
  const priority = [];

  if (selected.has("Premium") || selected.has("Minimal")) {
    priority.push("Startup template", "Generic SaaS", "Apple clone");
  }
  if (selected.has("Technical") || selected.has("Enterprise")) {
    priority.push("Too playful", "Childish", "Too colorful");
  }
  if (selected.has("Creative") || selected.has("Editorial")) {
    priority.push("Corporate", "Too empty", "Linear clone");
  }

  return unique([...priority, ...AVOID_OPTIONS]).map((label) => ({
    label,
    description: avoidDescription(label)
  }));
}

export function createFallbackReferenceLikes(state = {}) {
  const selected = state.references || [];
  const byReference = {};

  for (const id of selected) {
    byReference[id] = {
      referenceId: id,
      referenceName: REFERENCE_NAMES[id] || titleCase(id),
      options: REFERENCE_TRAITS[id] || ["Typography", "Spacing", "Color", "Motion", "Layout", "Density", "Mood", "Other"]
    };
  }

  return byReference;
}

export function createFallbackOptionalAdditions(state = {}) {
  const selected = new Set(state.personality || []);
  const options = [];

  if (!selected.has("Calm")) {
    options.push("Make it calmer");
  }
  if (!selected.has("Premium")) {
    options.push("More premium");
  }
  if (!selected.has("Technical")) {
    options.push("More technical");
  }
  options.push("Make it darker", "Make it lighter", "More editorial", "More compact", "More spacious");

  return unique(options).slice(0, 5).map((label) => ({
    label,
    description: optionalDescription(label)
  }));
}

export function createFallbackDirections(state = {}) {
  const references = (state.references || []).map((id) => REFERENCE_NAMES[id] || titleCase(id));
  const traits = state.personality?.length ? state.personality.join(", ") : "premium, useful, clear";
  const product = inferProjectName(state);
  const technical = state.personality?.includes("Technical") || /developer|api|agent|cli|data|dashboard/i.test(state.intake || "");
  const creative = state.personality?.includes("Creative") || state.personality?.includes("Editorial");
  const dark = state.avoid?.includes("Too colorful") || state.references?.some((id) => ["linear", "raycast", "nvidia", "runway"].includes(id));

  const firstName = technical ? "Graphite Control Room" : "Quiet Premium";
  const secondName = creative ? "Editorial Studio" : "Soft Technical";
  const thirdName = dark ? "Luminous Utility" : "Focused Workspace";
  const directionPalettes = directionPalettesFor();

  return [
    {
      id: "direction-a",
      name: firstName,
      thesis: `${product} feels ${traits.toLowerCase()} with restrained surfaces, sharp hierarchy, and a single confident accent.`,
      goodFor: technical ? "Agent tools, developer products, dashboards, and power-user workflows." : "Premium SaaS, AI products, and onboarding-heavy tools.",
      avoid: "Decorative gradients, brand cloning, oversized empty sections, and vague startup polish.",
      tags: unique(["Premium", "Precise", technical ? "Technical" : "Calm"]).slice(0, 3),
      palette: dark ? "Graphite base, off-white text, restrained indigo or green accent." : "Warm off-white canvas, ink text, restrained indigo accent.",
      typography: "Modern grotesk, medium-weight headings, readable body text, subtle mono only for technical labels.",
      components: "Sharp panels, compact controls, visible focus states, calm selected cards."
    },
    {
      id: "direction-b",
      name: secondName,
      thesis: `${product} uses a lighter, more narrative design language that still stays useful and implementation-ready.`,
      goodFor: creative ? "Creative tools, portfolios, visual workflows, and concept-heavy products." : "Trust-building onboarding, explainable AI tools, and SaaS surfaces.",
      avoid: "Looking like a landing-page template, using too many colors, or hiding product utility under decoration.",
      tags: unique(["Editorial", creative ? "Creative" : "Trustworthy", "Spacious"]).slice(0, 3),
      palette: "Soft canvas, graphite text, muted border system, restrained accent for important actions.",
      typography: "Editorial hierarchy with confident section titles and calm, readable body copy.",
      components: "Unframed content bands, purposeful cards, restrained preview panes, clear navigation."
    },
    {
      id: "direction-c",
      name: thirdName,
      thesis: `${product} emphasizes repeated use: scannable layouts, compact decision points, and utility that feels quietly refined.`,
      goodFor: "Operational apps, internal tools, marketplaces, and products with many states or workflows.",
      avoid: "Dense admin sludge, corporate sameness, weak contrast, and scattered component styling.",
      tags: unique(["Trustworthy", "Fast", dark ? "Sharp" : "Minimal"]).slice(0, 3),
      palette: dark ? "Dark utility surfaces with a softer content layer and a precise action accent." : "Neutral workspace palette with one crisp accent and minimal shadow.",
      typography: "UI-first type scale with tight titles, direct labels, and steady body rhythm.",
      components: "Dense but breathable panels, inspectable sidebars, compact chips, practical forms."
    }
  ].map((direction, index) => {
    const palette = directionPalettes[index] || directionPalettes[0];
    return {
      ...direction,
      inspiredBy: references.length ? references.join(", ") : "the selected taste traits",
      accentHex: palette.accentHex,
      dark: palette.dark,
      colors: palette.colors
    };
  });

  function directionPalettesFor() {
    const accentA = primaryAccent(state).hex;
    const altB = suggestThirdColor(accentA, "#2A2B31", { dark: false }).hex;
    const seeds = [
      { accentHex: accentA, dark: technical || shouldUseDark(state) },
      { accentHex: creative ? "#8B3DFF" : altB, dark: false },
      { accentHex: accentA, dark: true }
    ];
    return seeds.map((seed) => ({
      ...seed,
      colors: createColorSystem({ primary: seed.accentHex, dark: seed.dark }).tokens
    }));
  }
}

export function createPlanFromState(state = {}) {
  const selected = selectedDirections(state);
  const references = (state.references || []).map((id) => REFERENCE_NAMES[id] || titleCase(id));
  const traits = state.personality?.length ? state.personality.join(", ") : "Premium, calm, useful";
  const avoid = state.avoid?.length ? state.avoid.join(", ") : "Generic SaaS, brand cloning, low contrast";
  const directionNames = selected.map((direction) => direction.name).join(" + ") || "Quiet Premium";
  const dark = paletteIsDark(state);
  const primary = primaryAccent(state);
  const colors = paletteForState(state);

  return {
    designDirection: directionNames,
    coreFeeling: traits,
    inspiredBy: references.length ? referenceSentence(state) : "The user's own product context and taste words.",
    avoid,
    typography: "Modern grotesk for UI, restrained display scale, readable body text, mono only for technical labels and generated file previews.",
    color: dark
      ? `Graphite base, off-white text, muted borders, restrained ${primary.name} accent ${colors.primary} with ${colors.primaryInk} text on accent.`
      : `Warm off-white canvas, graphite text, soft surface layers, restrained ${primary.name} accent ${colors.primary} with ${colors.primaryInk} text on accent.`,
    components: "Precise buttons, calm choice cards, compact controls, inspectable panels, explicit focus and selected states.",
    motion: "Fast, precise, functional. No bounce, no confetti, no decorative motion.",
    notes: state.extra || "No extra notes."
  };
}

export function createDesignMd(state = {}, plan = createPlanFromState(state)) {
  const projectName = inferProjectName(state);
  const styleName = plan.designDirection || "Quiet Premium";
  const dark = paletteIsDark(state);
  const accent = primaryAccent(state);
  const colors = paletteForState(state);
  const contrast = analyzePalette(colors);
  const references = referenceSentence(state);
  const selected = selectedDirections(state);
  const thesis = selected[0]?.thesis || `${projectName} should feel ${lowerSentence(plan.coreFeeling)} while staying practical enough for real product work.`;

  return `---
version: alpha
name: ${yamlQuote(styleName)}
description: ${yamlQuote(`${projectName} design system generated by Tasteprint from product context, personality choices, references, and user edits.`)}
colors:
  primary: "${colors.primary}"
  primary-ink: "${colors.primaryInk}"
  secondary: "${colors.secondary}"
  tertiary: "${colors.tertiary}"
  neutral: "${colors.neutral}"
  canvas: "${colors.canvas}"
  surface: "${colors.surface}"
  surface-muted: "${colors.surfaceMuted}"
  ink: "${colors.ink}"
  ink-muted: "${colors.inkMuted}"
  hairline: "${colors.hairline}"
  focus: "${colors.primary}"
typography:
  headline-display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: 0
  headline-md:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 30px
    fontWeight: 600
    lineHeight: 1.16
    letterSpacing: 0
  body-md:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  label-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0
  mono-sm:
    fontFamily: "Geist Mono, JetBrains Mono, SFMono-Regular, ui-monospace, Menlo, monospace"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
rounded:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 18px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  section: 80px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.full}"
    padding: "10px 18px"
    height: 40px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.full}"
    padding: "10px 16px"
    height: 40px
  choice-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
---

# ${projectName} DESIGN.md

## Overview

${thesis}

The core feeling is ${lowerSentence(plan.coreFeeling)}. The product should feel intentional, useful, and specific to its audience rather than like a generic template. It is inspired by ${references}, but those references are interpreted as attributes, not clone targets.

Avoid ${lowerSentence(plan.avoid)}.

## Colors

The palette uses controlled contrast and one primary accent. The accent is reserved for primary actions, selected states, focus rings, and important progress indicators.

- **Primary (${colors.primary}):** ${accent.name} signal for the single highest-priority action or active state.
- **Primary ink (${colors.primaryInk}):** Text and icons placed directly on the primary accent.
- **Secondary (${colors.secondary}):** Structural graphite used for strong text, deep panels, and important framing.
- **Tertiary (${colors.tertiary}):** Support color for success, confirmation, or a rare secondary signal.
- **Neutral (${colors.neutral}):** Foundation color for page backgrounds and quiet negative space.
- **Surface (${colors.surface}):** Main content panels, inputs, and repeated component surfaces.
- **Hairline (${colors.hairline}):** Borders, dividers, and low-emphasis structure.

Color method: start from user references and product intent, then use color-wheel relationships for any added hue. If a third color is needed, derive it from the primary and secondary hues rather than picking randomly. After choosing a hue, repair lightness until normal text, controls, focus rings, and selected states meet WCAG AA contrast. The current checked ratios are primary ink on primary ${contrast.primaryInkOnPrimary}:1, primary on canvas ${contrast.primaryOnCanvas}:1, and ink on canvas ${contrast.inkOnCanvas}:1.

## Typography

Use a modern grotesk UI stack with restrained weight. Headings should feel confident, not loud. Body text should stay readable in product surfaces, forms, and generated document previews.

- **Headlines:** 600 weight, tight hierarchy, no decorative font treatment.
- **Body:** 16px default with generous line height for onboarding, settings, and product copy.
- **Labels:** 13px to 14px, medium or semibold, direct wording.
- **Monospace:** Only for code, file names, model names, command snippets, and generated markdown previews.

## Layout

Use an 8px spacing rhythm and keep each screen organized around one main decision. Prefer centered, narrow onboarding screens and wider two-column layouts only for previews or comparison work.

- Question screens should stay near 680px max width.
- Preview and artifact review screens may expand to 960px or 1120px.
- Group related controls with spacing before reaching for extra borders or shadows.
- Keep primary actions visually stable and easy to find.

## Elevation & Depth

Depth is created through tonal surfaces, hairline borders, and restrained contrast. Shadows are rare and should only support a focused preview, modal, or final reveal.

- Default components use borders instead of heavy shadows.
- Hover states may lift by 1px or change border contrast.
- Focus states must be visible with the primary color.
- Do not use glow effects except subtle focus treatment.

## Shapes

The shape language is precise with moderate softness. Use 8px radius for inputs and compact controls, 12px to 18px for choice cards and panels, and full radius only for primary CTAs or small chips.

Avoid playful bubble shapes, inconsistent corner systems, and excessive rounding on dense product surfaces.

## Components

- **Primary buttons:** Use the primary accent, white text, pill radius, 40px minimum height, and direct action labels.
- **Secondary buttons:** Use neutral surfaces, hairline border, and the same height as primary buttons.
- **Choice cards:** Use surface background, hairline border, calm selected state, and concise titles.
- **Reference cards:** Show mood through abstract color, typography, and spacing cues rather than screenshots that imply copying.
- **Inputs:** Pair every input with a visible label. Text areas should feel spacious enough for messy product thoughts.
- **Panels:** Use panels for real artifacts, previews, or repeated items. Do not nest decorative cards inside larger cards.
- **Motion:** Keep transitions fast and functional: 120ms to 220ms, subtle fade or 8px slide, no bounce.

## Do's and Don'ts

- Do use the primary color for only one main action per screen.
- Do preserve readable contrast and visible focus states.
- Do treat references as taste signals, not visual templates to copy.
- Do keep repeated workflows efficient, scannable, and keyboard-friendly.
- Don't use generic SaaS gradients, decorative blobs, or brand-clone layouts.
- Don't introduce extra accent colors without a clear semantic role.
- Don't make dense workflows feel empty just to look premium.
- Don't hide important product state behind vague copy or decorative visuals.
`;
}

export function createSkillMd(state = {}, plan = createPlanFromState(state)) {
  const projectName = inferProjectName(state);
  const skillName = `${slugify(projectName).slice(0, 48) || "project"}-design`;
  const references = referenceSentence(state);
  const avoid = plan.avoid || "Generic SaaS, low contrast, brand cloning";

  return `---
name: ${skillName}
description: Use when creating, editing, reviewing, or refining frontend UI, UX, product design, visual styling, component behavior, layout, motion, accessibility, or design-system guidance for ${projectName}. Follow the local DESIGN.md first, then these project-specific taste and quality rules.
---

# ${projectName} Design Skill

## Mission

Build UI that follows the project-specific DESIGN.md and keeps ${projectName} feeling ${lowerSentence(plan.coreFeeling)}. Translate user requests into implementation-ready design decisions without drifting into generic templates or copied brand language.

## Required Reading

- Read ./DESIGN.md before making frontend, UX, styling, component, motion, or accessibility changes.
- Treat DESIGN.md tokens as the source of truth for color, typography, spacing, radius, and component styling.
- If a user request conflicts with DESIGN.md, call out the conflict and ask before changing the design direction.

## Design Intent

- Core feeling: ${plan.coreFeeling}.
- Design direction: ${plan.designDirection}.
- Inspired by: ${references}.
- Avoid: ${avoid}.

## Style Foundations

- Use semantic tokens from DESIGN.md instead of one-off raw values.
- Keep the primary accent scarce and reserved for the most important action, focus, or selected state.
- When changing or adding colors, derive hues from references or color-wheel relationships, then check contrast before shipping.
- Use restrained typography with clear hierarchy and readable body text.
- Prefer tonal surfaces, hairline borders, and spacing over heavy shadows.
- Keep motion fast, precise, and functional.

## Component Rules

- Buttons must include default, hover, active, focus-visible, disabled, and loading states where relevant.
- Cards and panels must have stable dimensions or responsive constraints so content changes do not shift layouts unexpectedly.
- Inputs must use visible labels, clear helper or error text, and accessible focus treatment.
- Choice controls must expose selected state visually and semantically.
- Navigation should be calm, predictable, and proportional to the product surface.
- Empty states should help the user recover or continue, not decorate the page.

## Accessibility

- Meet WCAG AA contrast for normal text, large text, controls, and focus indicators.
- Ensure all interactive controls are keyboard reachable and have visible focus states.
- Use 40px minimum target size, with 44px preferred on touch-heavy screens.
- Do not rely on color alone for selected, error, warning, or success states.
- Respect reduced motion preferences.

## Writing Tone

- Clear, direct, and useful.
- Confident without hype.
- Specific over clever.
- Calm and product-aware.

## Rules: Do

- Do start from the existing DESIGN.md tokens and component guidance.
- Do preserve one clear primary action per focused workflow.
- Do use deterministic color checks for any new palette: contrast ratio, text-on-accent choice, and role separation.
- Do make dense information scannable with hierarchy, grouping, and labels.
- Do interpret references as attributes: typography, spacing, density, tone, color restraint, or motion.
- Do check responsive behavior for compact and wide viewports.

## Rules: Don't

- Don't copy ${references} literally.
- Don't use decorative gradients, blobs, mascots, or novelty styling unless the user explicitly changes the direction.
- Don't add multiple accent colors for visual variety.
- Don't use vague labels when the action can be named directly.
- Don't sacrifice accessibility for atmosphere.

## Quality Gates

- The UI reads as ${lowerSentence(plan.coreFeeling)} within the first viewport.
- Primary actions, selected states, errors, and focus states are obvious without relying on color alone.
- Typography, spacing, radius, and color choices map back to DESIGN.md.
- Components include real states, not only ideal/default appearances.
- Mobile and desktop layouts avoid text clipping, overlap, and unexpected reflow.
- The implementation avoids the listed anti-patterns: ${avoid}.
`;
}

export function validateDesignMd(content) {
  const errors = [];
  const warnings = [];
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!frontmatter) {
    errors.push("Missing YAML frontmatter block.");
  } else {
    const yaml = frontmatter[1];
    for (const key of ["version:", "name:", "colors:", "typography:", "rounded:", "spacing:", "components:"]) {
      if (!yaml.includes(key)) {
        errors.push(`Missing ${key.replace(":", "")} in YAML frontmatter.`);
      }
    }
    if (!/colors:\s*[\s\S]*?\n\s{2}primary:/m.test(yaml)) {
      errors.push("Missing colors.primary token.");
    }
  }

  const requiredSections = [
    "Overview",
    "Colors",
    "Typography",
    "Layout",
    "Elevation & Depth",
    "Shapes",
    "Components",
    "Do's and Don'ts"
  ];
  const headings = [...content.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1]);
  const headingSet = new Set();

  for (const heading of headings) {
    if (headingSet.has(heading)) {
      errors.push(`Duplicate section heading: ${heading}.`);
    }
    headingSet.add(heading);
  }

  let previousIndex = -1;
  for (const section of requiredSections) {
    const index = headings.indexOf(section);
    if (index === -1) {
      errors.push(`Missing required section: ${section}.`);
      continue;
    }
    if (index < previousIndex) {
      errors.push(`Section out of order: ${section}.`);
    }
    previousIndex = index;
  }

  if (!/WCAG|contrast|focus/i.test(content)) {
    warnings.push("Consider adding explicit accessibility guidance.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateSkillMd(content) {
  const errors = [];
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!frontmatter) {
    errors.push("Missing YAML frontmatter block.");
  } else {
    const yaml = frontmatter[1];
    if (!/^name:\s*\S+/m.test(yaml)) {
      errors.push("Missing skill name in frontmatter.");
    }
    if (!/^description:\s*.+/m.test(yaml)) {
      errors.push("Missing skill description in frontmatter.");
    }
    const extraKeys = yaml
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.split(":")[0])
      .filter((key) => !["name", "description"].includes(key));
    if (extraKeys.length) {
      errors.push(`SKILL.md frontmatter should only include name and description. Found: ${extraKeys.join(", ")}.`);
    }
  }

  for (const section of ["Mission", "Required Reading", "Style Foundations", "Accessibility", "Quality Gates"]) {
    if (!content.includes(`## ${section}`)) {
      errors.push(`Missing SKILL.md section: ${section}.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export async function writeGeneratedFiles(projectDir, files) {
  const designPath = await uniqueOutputPath(join(projectDir, "DESIGN.md"));
  const skillPath = await uniqueOutputPath(join(projectDir, "SKILL.md"));

  await writeFile(designPath, files.designMd, "utf8");
  await writeFile(skillPath, files.skillMd, "utf8");

  return {
    designPath,
    skillPath
  };
}

export async function uniqueOutputPath(targetPath) {
  if (!(await exists(targetPath))) {
    return targetPath;
  }

  const dir = dirname(targetPath);
  const ext = extname(targetPath);
  const stem = basename(targetPath, ext);
  let candidate = join(dir, `${stem}-copy${ext}`);
  let index = 2;

  while (await exists(candidate)) {
    candidate = join(dir, `${stem}-copy-${index}${ext}`);
    index += 1;
  }

  return candidate;
}

export function summarizeForPrimary(state = {}, label = "Current state") {
  const references = (state.references || []).map((id) => REFERENCE_NAMES[id] || titleCase(id)).join(", ") || "None selected yet";
  const answers = Object.entries(state.intakeAnswers || {})
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join("; ") || "No follow-up answers yet";

  return [
    `${label}:`,
    `Original product dump: ${state.intake || "Not provided yet"}`,
    `Follow-up answers: ${answers}`,
    `Personality: ${(state.personality || []).join(", ") || "Not selected yet"}`,
    `Avoid: ${(state.avoid || []).join(", ") || "Not selected yet"}`,
    `References: ${references}`,
    `Reference likes: ${summarizeReferenceLikes(state)}`,
    `Extra notes: ${state.extra || "None"}`
  ].join("\n");
}

function selectedDirections(state) {
  const ids = new Set(state.selectedDirections || []);
  const directions = state.directions || createFallbackDirections(state);
  const selected = directions.filter((direction) => ids.has(direction.id));
  return selected.length ? selected : directions.slice(0, 1);
}

function summarizeReferenceLikes(state) {
  const likes = state.referenceLikes || {};
  const entries = Object.entries(likes).map(([id, value]) => {
    const name = REFERENCE_NAMES[id] || titleCase(id);
    const selected = value?.selected?.length ? value.selected.join(", ") : "No checklist selections";
    const note = value?.note ? `; note: ${value.note}` : "";
    return `${name}: ${selected}${note}`;
  });
  return entries.join(" | ") || "None yet";
}

function referenceSentence(state) {
  const names = (state.references || []).map((id) => REFERENCE_NAMES[id] || titleCase(id));
  if (!names.length) {
    return "the user's selected taste traits";
  }

  const likeParts = Object.entries(state.referenceLikes || {})
    .map(([id, value]) => {
      const selected = value?.selected || [];
      if (!selected.length && !value?.note) {
        return null;
      }
      return `${REFERENCE_NAMES[id] || titleCase(id)} for ${[...selected, value.note].filter(Boolean).join(", ")}`;
    })
    .filter(Boolean);

  return likeParts.length ? likeParts.join("; ") : names.join(", ");
}

export function shouldUseDark(state) {
  const additions = new Set(state.optionalAdditions || []);
  if (additions.has("Make it darker")) {
    return true;
  }
  if (additions.has("Make it lighter")) {
    return false;
  }
  return (state.references || []).some((id) => ["linear", "raycast", "nvidia", "runway", "framer", "shopify"].includes(id));
}

// Prefer the palette the user locked in by selecting a direction, so preview and
// final reuse the exact colors they just saw. Falls back to the deterministic
// accent + dark derivation when nothing is locked (keeps dev:local consistent).
export function paletteForState(state = {}) {
  const locked = state.lockedDirection?.colors;
  if (locked && locked.primary && locked.canvas) {
    return locked;
  }
  return createColorSystem({ primary: primaryAccent(state).hex, dark: shouldUseDark(state) }).tokens;
}

export function paletteIsDark(state = {}) {
  if (state.lockedDirection && typeof state.lockedDirection.dark === "boolean") {
    return state.lockedDirection.dark;
  }
  return shouldUseDark(state);
}

// Backend accent map (mirrors public/themes.db.js REFERENCE_BRAND). White / very
// light brand accents use a graphite stand-in so light fallback palettes stay
// visible; createColorSystem repairs contrast either way. The last selected
// reference with a known accent wins, matching the frontend's last-pick rule.
const REFERENCE_ACCENTS = {
  apple: { name: "blue", hex: "#0066CC" },
  stripe: { name: "indigo", hex: "#635BFF" },
  vercel: { name: "graphite", hex: "#111114" },
  linear: { name: "indigo", hex: "#5E6AD2" },
  raycast: { name: "coral", hex: "#FF6363" },
  cursor: { name: "graphite", hex: "#111114" },
  superhuman: { name: "indigo", hex: "#5E61E6" },
  resend: { name: "graphite", hex: "#111114" },
  sanity: { name: "red", hex: "#F03E2F" },
  nvidia: { name: "green", hex: "#76B900" },
  figma: { name: "violet", hex: "#A259FF" },
  warp: { name: "blue", hex: "#01A4FF" },
  supabase: { name: "green", hex: "#3ECF8E" },
  clickhouse: { name: "graphite", hex: "#2B2B2B" },
  mongodb: { name: "green", hex: "#00684A" },
  hashicorp: { name: "graphite", hex: "#111114" },
  posthog: { name: "orange", hex: "#F54E00" },
  sentry: { name: "violet", hex: "#7553FF" },
  runway: { name: "graphite", hex: "#111114" },
  framer: { name: "blue", hex: "#0099FF" },
  webflow: { name: "blue", hex: "#146EF5" },
  notion: { name: "blue", hex: "#0A85D1" },
  spotify: { name: "green", hex: "#1DB954" },
  pinterest: { name: "red", hex: "#E60023" },
  miro: { name: "blue", hex: "#2E5BFF" },
  lovable: { name: "pink", hex: "#FF4D6A" },
  claude: { name: "clay", hex: "#D97757" },
  mistral: { name: "orange", hex: "#FA520F" },
  cohere: { name: "green", hex: "#39594D" },
  together: { name: "blue", hex: "#0F6FFF" },
  elevenlabs: { name: "graphite", hex: "#111114" },
  replicate: { name: "graphite", hex: "#111114" },
  xai: { name: "graphite", hex: "#111114" },
  minimax: { name: "orange", hex: "#E8431F" },
  ollama: { name: "graphite", hex: "#111114" },
  opencode: { name: "amber", hex: "#B98900" },
  shopify: { name: "green", hex: "#5E8E3E" },
  airbnb: { name: "coral", hex: "#E6505A" },
  intercom: { name: "blue", hex: "#1F8DED" },
  slack: { name: "purple", hex: "#611F69" },
  ibm: { name: "blue", hex: "#0F62FE" },
  wise: { name: "green", hex: "#1A8245" },
  coinbase: { name: "blue", hex: "#0052FF" },
  uber: { name: "graphite", hex: "#111114" },
  wired: { name: "graphite", hex: "#111114" },
  theverge: { name: "red", hex: "#CC1400" },
  nike: { name: "graphite", hex: "#111114" },
  tesla: { name: "red", hex: "#E31937" },
  starbucks: { name: "green", hex: "#00704A" }
};

export function primaryAccent(state) {
  const refs = state.references || [];
  for (let index = refs.length - 1; index >= 0; index -= 1) {
    const accent = REFERENCE_ACCENTS[refs[index]];
    if (accent) {
      return accent;
    }
  }
  return { name: "indigo", hex: "#5E6AD2" };
}

function lightColorTokens(primary) {
  return {
    primary,
    secondary: "#2A2B31",
    tertiary: "#27A664",
    neutral: "#F7F7F5",
    canvas: "#F7F7F5",
    surface: "#FFFFFF",
    surfaceMuted: "#F3F1EC",
    ink: "#151517",
    inkMuted: "#6D7078",
    hairline: "#E1E1DD"
  };
}

function darkColorTokens(primary) {
  return {
    primary,
    secondary: "#F6F6F4",
    tertiary: "#27A664",
    neutral: "#0B0B0D",
    canvas: "#0B0B0D",
    surface: "#111114",
    surfaceMuted: "#1F2024",
    ink: "#F6F6F4",
    inkMuted: "#B8BCC7",
    hairline: "#2B2C31"
  };
}

function inferProjectName(state = {}) {
  const explicit = state.intakeAnswers?.projectName || state.projectName;
  if (explicit) {
    return cleanTitle(explicit);
  }

  const dump = (state.intake || "").trim();
  const named = dump.match(/(?:called|named|for)\s+([A-Z][A-Za-z0-9_-]{2,})/);
  if (named) {
    return cleanTitle(named[1]);
  }

  const firstWords = dump
    .replace(/^(i am|i'm|we are|we're|building|creating|making|an?)\s+/i, "")
    .split(/[,.:\n]/)[0]
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");

  return cleanTitle(firstWords || "Product");
}

function cleanTitle(value) {
  return String(value)
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function titleCase(value) {
  return String(value)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function lowerSentence(value) {
  return String(value || "")
    .replace(/\.$/, "")
    .toLowerCase();
}

function yamlQuote(value) {
  return JSON.stringify(String(value));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function exists(path) {
  return access(path).then(() => true, () => false);
}

function personalityDescription(label) {
  const descriptions = {
    Premium: "Polished, restrained, and worth trusting.",
    Minimal: "Low-noise, sparse, and highly intentional.",
    Technical: "Precise, capable, and implementation-aware.",
    Playful: "Light, friendly, and expressive without becoming childish.",
    Fast: "Direct, responsive, and workflow-oriented.",
    Calm: "Quiet, measured, and easy to stay with.",
    Dense: "Information-rich while staying structured.",
    Spacious: "Breathable and editorially paced.",
    Editorial: "Confident hierarchy with a point of view.",
    Futuristic: "Forward-looking without sci-fi clutter.",
    Trustworthy: "Clear, reliable, and confidence-building.",
    Creative: "Visual, expressive, and maker-oriented.",
    Enterprise: "Scalable, clear, and accountable.",
    Warm: "Human, approachable, and soft-edged.",
    Sharp: "Crisp, decisive, and high-contrast."
  };
  return descriptions[label] || "A useful product personality signal.";
}

function avoidDescription(label) {
  const descriptions = {
    "Generic SaaS": "Avoid template-like panels, vague gradients, and interchangeable copy.",
    "Overly playful": "Keep charm from turning into toy-like UI.",
    Corporate: "Avoid bland enterprise stock-product language.",
    "Crypto / Web3": "Avoid speculative visual tropes and neon-finance styling.",
    Childish: "Avoid juvenile colors, mascots, and bubbly shapes.",
    "Too colorful": "Keep the palette controlled and semantic.",
    "Too empty": "Avoid premium-looking whitespace that weakens utility.",
    "Too dense": "Avoid overloaded dashboards with no hierarchy.",
    "Apple clone": "Borrow restraint, not Apple's exact showroom language.",
    "Linear clone": "Borrow precision, not Linear's exact dark marketing system.",
    "Startup template": "Avoid default landing-page composition."
  };
  return descriptions[label] || "A useful anti-pattern to avoid.";
}

function optionalDescription(label) {
  const descriptions = {
    "Make it darker": "Lean into graphite surfaces and stronger contrast.",
    "Make it lighter": "Favor off-white canvas and softer panel contrast.",
    "More playful": "Allow more warmth and expressive microcopy.",
    "More premium": "Increase restraint, hierarchy, and polish.",
    "More technical": "Add precise controls, compact panels, and code-aware details.",
    "Make it calmer": "Reduce visual noise and motion.",
    "More editorial": "Strengthen pacing, hierarchy, and written tone.",
    "More compact": "Increase scanning efficiency without collapsing clarity.",
    "More spacious": "Open the layout rhythm and reduce density."
  };
  return descriptions[label] || "Tune the generated direction.";
}
