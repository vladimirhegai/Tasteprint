import { invokeModel } from "./modelAdapters.js";
import { createColorSystem, createColorToolPrompt } from "./colorTools.js";
import { loadReferenceColorLibrary, loadReferenceContexts } from "./referenceLibrary.js";
import {
  createDesignMd,
  createFallbackAntiVibeOptions,
  createFallbackDirections,
  createFallbackIntakeQuestions,
  createFallbackOptionalAdditions,
  createFallbackPersonalityOptions,
  createFallbackReferenceLikes,
  createPlanFromState,
  createSkillMd,
  primaryAccent,
  summarizeForPrimary,
  shouldUseDark,
  validateDesignMd,
  validateSkillMd
} from "./generator.js";
import { estimatePromptUsage } from "./tokenEstimator.js";

export async function getIntakeQuestions(state, context) {
  const fallbackQuestions = createFallbackIntakeQuestions(state);
  const fallback = {
    questions: fallbackQuestions,
    summaryForPrimary: summarizeForPrimary(state, "Project intake")
  };

  return runJsonModel({
    model: state.models?.secondary,
    projectDir: context.projectDir,
    role: "secondary",
    task: "Project intake clarification",
    prompt: secondaryPrompt("Project intake clarification", state, `Analyze the user's one-line or messy project dump. Ask only for important missing information. If the dump already contains enough audience, product type, and workflow context, return an empty questions array.

Return JSON:
{
  "questions": [
    {
      "id": "audience",
      "type": "text" | "single" | "multi",
      "prompt": "Question shown to the user",
      "placeholder": "optional text placeholder",
      "options": ["optional", "choice", "labels"]
    }
  ],
  "summaryForPrimary": "Detailed summary for the primary model. Include original dump, inferred product, audience, important unknowns, and any assumptions. Do not shorten aggressively."
}`),
    fallback,
    normalize: (data) => ({
      questions: Array.isArray(data.questions) ? data.questions.slice(0, 4) : fallback.questions,
      summaryForPrimary: data.summaryForPrimary || fallback.summaryForPrimary
    })
  });
}

export async function getPersonalityOptions(state, context) {
  const fallback = {
    options: createFallbackPersonalityOptions(state),
    summaryForPrimary: summarizeForPrimary(state, "Product personality options")
  };

  return runJsonModel({
    model: state.models?.secondary,
    projectDir: context.projectDir,
    role: "secondary",
    task: "Product personality",
    prompt: secondaryPrompt("Product personality", state, `Generate personality choices for this product. Include 15 total labels. Put the most likely 3 to 5 first based on the user's product context. Use concise descriptions.

Return JSON:
{
  "options": [{ "label": "Premium", "description": "Polished and restrained." }],
  "summaryForPrimary": "Detailed product personality interpretation for the primary model."
}`),
    fallback,
    normalize: (data) => ({
      options: Array.isArray(data.options) && data.options.length ? data.options.slice(0, 15) : fallback.options,
      summaryForPrimary: data.summaryForPrimary || fallback.summaryForPrimary
    })
  });
}

export async function getAntiVibeOptions(state, context) {
  const fallback = {
    options: createFallbackAntiVibeOptions(state),
    summaryForPrimary: summarizeForPrimary(state, "Anti-vibe options")
  };

  return runJsonModel({
    model: state.models?.secondary,
    projectDir: context.projectDir,
    role: "secondary",
    task: "Anti-vibe clarification",
    prompt: secondaryPrompt("Anti-vibe clarification", state, `The user selected product personality traits. Generate options for what the product should NOT feel like. Start with the most likely anti-patterns for this product and its selected traits.

Return JSON:
{
  "options": [{ "label": "Generic SaaS", "description": "Avoid template-like panels and vague gradients." }],
  "summaryForPrimary": "Detailed anti-vibe summary for the primary model."
}`),
    fallback,
    normalize: (data) => ({
      options: Array.isArray(data.options) && data.options.length ? data.options.slice(0, 14) : fallback.options,
      summaryForPrimary: data.summaryForPrimary || fallback.summaryForPrimary
    })
  });
}

export async function getReferenceLikeOptions(state, context) {
  const referenceContexts = await loadReferenceContexts(state.references || [], context.packageRootUrl);
  const referencesForPrompt = referenceContexts.map((reference) => [
    `# ${reference.name}`,
    `Has exact DESIGN.md: ${reference.hasDesignMd ? "yes" : "no"}`,
    reference.designMd || `No local DESIGN.md available. Use this reference description instead: ${reference.description}`
  ].join("\n")).join("\n\n---\n\n");

  const fallback = {
    byReference: createFallbackReferenceLikes(state),
    summaryForPrimary: summarizeForPrimary(state, "Reference selection")
  };

  return runJsonModel({
    model: state.models?.secondary,
    projectDir: context.projectDir,
    role: "secondary",
    task: "Reference taste clarification",
    prompt: secondaryPrompt("Reference taste clarification", state, `The user selected references. You are given the exact DESIGN.md for references where available. Generate a checklist for what the user may like about each reference. The UI must not reveal that an agent created the options.

Selected reference context:
${referencesForPrompt}

Return JSON:
{
  "byReference": {
    "apple": {
      "referenceId": "apple",
      "referenceName": "Apple",
      "options": ["Typography", "Spacing", "Calmness", "Other"]
    }
  },
  "summaryForPrimary": "Detailed summary of reference tokens, visual traits, and likely useful attributes for the primary model. Include important details from the selected DESIGN.md files and do not over-compress."
}`),
    fallback,
    normalize: (data) => ({
      byReference: data.byReference && typeof data.byReference === "object" ? data.byReference : fallback.byReference,
      summaryForPrimary: data.summaryForPrimary || fallback.summaryForPrimary
    })
  });
}

export async function getDirections(state, context) {
  const referenceColorLibrary = await loadReferenceColorLibrary(state.references || [], context.packageRootUrl);
  const fallback = {
    directions: createFallbackDirections(state),
    summaryForPrimary: summarizeForPrimary(state, "Design directions")
  };

  return runJsonModel({
    model: state.models?.primary,
    projectDir: context.projectDir,
    role: "primary",
    task: "Generate design directions",
    prompt: primaryPrompt("Generate design directions", state, `Generate exactly 3 distinct design directions. The user can select one or mix several. Avoid repeating any rejected directions in the regenerate history.

Be concise: short labels, one-sentence descriptions, no marketing copy. Do not describe a full palette or typography — only return one accent hex and whether the direction is dark. The UI and generated files derive the rest from the accent.

Return JSON:
{
  "directions": [
    {
      "id": "direction-a",
      "name": "Quiet Premium",
      "thesis": "One sentence.",
      "goodFor": "Up to 8 words.",
      "avoid": "Up to 8 words.",
      "tags": ["Premium", "Calm", "Technical"],
      "accentHex": "#5E6AD2",
      "dark": false
    }
  ],
  "summaryForPrimary": "Short reasoning retained for final generation. No raw dump repetition."
}`, { referenceColorLibrary }),
    fallback,
    normalize: (data) => ({
      directions: Array.isArray(data.directions) && data.directions.length
        ? data.directions.slice(0, 3).map((direction, index) => normalizeDirection(direction, index, fallback.directions))
        : fallback.directions,
      summaryForPrimary: data.summaryForPrimary || fallback.summaryForPrimary
    })
  });
}

function normalizeDirection(direction, index, fallbackDirections) {
  const reference = fallbackDirections[index] || fallbackDirections[0] || {};
  const accentHex = typeof direction.accentHex === "string" ? direction.accentHex : reference.accentHex;
  const dark = typeof direction.dark === "boolean" ? direction.dark : Boolean(reference.dark);
  const colors = direction.colors && direction.colors.primary
    ? direction.colors
    : createColorSystem({ primary: accentHex, dark }).tokens;

  return {
    id: direction.id || `direction-${index + 1}`,
    name: direction.name || reference.name || `Direction ${index + 1}`,
    thesis: direction.thesis || "",
    goodFor: direction.goodFor || "",
    avoid: direction.avoid || "",
    tags: Array.isArray(direction.tags) ? direction.tags.slice(0, 4) : [],
    accentHex,
    dark,
    colors
  };
}

export async function getOptionalAdditions(state, context) {
  const fallback = {
    options: createFallbackOptionalAdditions(state),
    summaryForPrimary: summarizeForPrimary(state, "Optional additions")
  };

  return runJsonModel({
    model: state.models?.secondary,
    projectDir: context.projectDir,
    role: "secondary",
    task: "Optional additions",
    prompt: secondaryPrompt("Optional additions", state, `Generate 5 optional final modifiers the user might want before preview. Keep them short and action-oriented.

Return JSON:
{
  "options": [{ "label": "Make it darker", "description": "Lean into graphite surfaces." }],
  "summaryForPrimary": "Detailed final modifier context for the primary model."
}`),
    fallback,
    normalize: (data) => ({
      options: Array.isArray(data.options) && data.options.length ? data.options.slice(0, 5) : fallback.options,
      summaryForPrimary: data.summaryForPrimary || fallback.summaryForPrimary
    })
  });
}

export async function getPlan(state, context) {
  const referenceColorLibrary = await loadReferenceColorLibrary(state.references || [], context.packageRootUrl);
  const fallbackPlan = createPlanFromState(state);
  const fallback = {
    plan: fallbackPlan,
    summaryForPrimary: summarizeForPrimary(state, "Preview plan")
  };

  return runJsonModel({
    model: state.models?.primary,
    projectDir: context.projectDir,
    role: "primary",
    task: "Create preview plan",
    prompt: primaryPrompt("Create DESIGN.md and SKILL.md preview plan", state, `Create the preview plan that the UI shows before final generation. Keep it concise but specific.

Return JSON:
{
  "plan": {
    "designDirection": "Quiet Premium",
    "coreFeeling": "Premium, technical, calm.",
    "inspiredBy": "Apple restraint, Nvidia confidence, Linear density.",
    "avoid": "Generic SaaS gradients, brand copying.",
    "typography": "Modern grotesk...",
    "color": "Graphite base...",
    "components": "Sharp panels...",
    "motion": "Fast, precise...",
    "notes": "Any extra user edits."
  },
  "summaryForPrimary": "Detailed plan context for final file generation."
}`, { referenceColorLibrary }),
    fallback,
    normalize: (data) => ({
      plan: data.plan && typeof data.plan === "object" ? { ...fallbackPlan, ...data.plan } : fallbackPlan,
      summaryForPrimary: data.summaryForPrimary || fallback.summaryForPrimary
    })
  });
}

export async function getFinalFiles(state, context) {
  const referenceColorLibrary = await loadReferenceColorLibrary(state.references || [], context.packageRootUrl);
  const fallbackPlan = state.plan || createPlanFromState(state);
  const deterministicDesignMd = createDesignMd(state, fallbackPlan);
  const deterministicSkillMd = createSkillMd(state, fallbackPlan);
  const fallback = {
    designMd: deterministicDesignMd,
    skillMd: deterministicSkillMd,
    validation: {
      design: validateDesignMd(deterministicDesignMd),
      skill: validateSkillMd(deterministicSkillMd)
    }
  };

  const result = await runJsonModel({
    model: state.models?.primary,
    projectDir: context.projectDir,
    role: "primary",
    task: "Generate final files",
    prompt: primaryPrompt("Generate final DESIGN.md and SKILL.md", state, `Generate final files.

Hard requirements:
- DESIGN.md must follow Google's DESIGN.md format: YAML frontmatter with design tokens, then markdown sections in this order: Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts.
- SKILL.md must follow Codex skill frontmatter rules: only name and description in YAML frontmatter.
- SKILL.md body should be concise, imperative, and useful to an AI coding agent.
- Do not write files. Return JSON only.

Return JSON:
{
  "designMd": "complete markdown file",
  "skillMd": "complete markdown file"
}`, { referenceColorLibrary }),
    fallback,
    normalize: (data) => {
      const designMd = typeof data.designMd === "string" ? data.designMd : deterministicDesignMd;
      const skillMd = typeof data.skillMd === "string" ? data.skillMd : deterministicSkillMd;
      const validation = {
        design: validateDesignMd(designMd),
        skill: validateSkillMd(skillMd)
      };

      if (!validation.design.valid || !validation.skill.valid) {
        return fallback;
      }

      return {
        designMd,
        skillMd,
        validation
      };
    }
  });

  return result;
}

function secondaryPrompt(task, state, instructions) {
  return [
    "You are Tasteprint's secondary model. You run the interview and maintain a compact context summary for the primary model.",
    "The user must never see that a model wrote this. Write natural product-onboarding text.",
    "Be concise: short labels, one-sentence descriptions, no marketing copy. Return only JSON, no fence.",
    "",
    `Task: ${task}`,
    "",
    instructions,
    "",
    "Onboarding state:",
    JSON.stringify(slimState(state), null, 2)
  ].join("\n");
}

function primaryPrompt(task, state, instructions, options = {}) {
  const lockedPalette = state.lockedDirection?.colors && state.lockedDirection.colors.primary
    ? state.lockedDirection.colors
    : null;
  const accentHex = lockedPalette?.primary || primaryAccent(state).hex;
  const dark = state.lockedDirection && typeof state.lockedDirection.dark === "boolean"
    ? state.lockedDirection.dark
    : shouldUseDark(state);
  const colorPrompt = createColorToolPrompt({
    primary: accentHex,
    dark,
    referenceLibrary: options.referenceColorLibrary || []
  });

  return [
    "You are Tasteprint's primary model. You handle synthesis only: directions, preview plans, and final files.",
    "Use the original project dump directly and the secondary summaries as compressed memory. Keep important details.",
    "The color tool guidance is a checked candidate, not a fixed palette; references and user taste come first.",
    "Return only JSON. No markdown fence.",
    "",
    `Task: ${task}`,
    "",
    instructions,
    "",
    "Original project dump:",
    state.intake || "",
    "",
    "Secondary summaries for primary context:",
    state.primaryContext || "",
    "",
    "Direct user comments:",
    JSON.stringify({
      directionComments: state.directionComments || {},
      extra: state.extra || "",
      optionalAdditions: state.optionalAdditions || []
    }, null, 2),
    ...(lockedPalette
      ? ["", "Locked palette (use these exact hex values for the colors frontmatter; do not invent new colors):", JSON.stringify(lockedPalette, null, 2)]
      : []),
    "",
    "Internal color tool guidance:",
    colorPrompt,
    "",
    "Current structured state:",
    JSON.stringify(slimState(state), null, 2)
  ].join("\n");
}

function slimState(state = {}) {
  const selectedDirectionNames = (state.directions || [])
    .filter((direction) => (state.selectedDirections || []).includes(direction.id))
    .map((direction) => direction.name);
  const rejectedDirectionNames = (state.regenerationHistory || [])
    .flatMap((entry) => (entry.rejectedDirections || []).map((direction) => direction.name))
    .filter(Boolean)
    .slice(0, 12);

  return {
    intake: state.intake || "",
    intakeAnswers: state.intakeAnswers || {},
    personality: state.personality || [],
    avoid: state.avoid || [],
    references: state.references || [],
    referenceLikes: state.referenceLikes || {},
    extra: state.extra || "",
    selectedDirectionNames,
    rejectedDirectionNames,
    optionalAdditions: state.optionalAdditions || []
  };
}

async function runJsonModel({ model, prompt, fallback, normalize, projectDir, role, task }) {
  const usage = estimatePromptUsage(prompt, model, { role, task });
  const invocation = await invokeModel(model, prompt, { projectDir });
  const localOnlySource = model?.localOnly || invocation.localOnly;
  if (!invocation.ok) {
    return {
      ...fallback,
      modelMeta: {
        source: localOnlySource ? "local-only" : "fallback",
        warning: localOnlySource ? null : invocation.warning || "Model call skipped.",
        usage
      }
    };
  }

  const parsed = extractJson(invocation.stdout);
  if (!parsed) {
    return {
      ...fallback,
      modelMeta: {
        source: invocation.model?.label || "model",
        warning: "The selected model did not return valid JSON, so Tasteprint used its local fallback.",
        usage
      }
    };
  }

  try {
    return {
      ...normalize(parsed),
      modelMeta: {
        source: invocation.model?.label || "model",
        warning: null,
        usage
      }
    };
  } catch (error) {
    return {
      ...fallback,
      modelMeta: {
        source: invocation.model?.label || "model",
        warning: `Model JSON could not be normalized: ${error.message}`,
        usage
      }
    };
  }
}

function extractJson(text) {
  if (!text) {
    return null;
  }

  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // Continue to object extraction.
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}
