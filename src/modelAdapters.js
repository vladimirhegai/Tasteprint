import { spawn, spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WINDOWS = process.platform === "win32";

const DEFAULT_THINKING_OPTIONS = [
  {
    id: "default",
    label: "CLI default",
    description: "Use the CLI's configured thinking or reasoning setting.",
    cliValue: null
  }
];

const OPENAI_THINKING_OPTIONS = [
  { id: "low", label: "Low", description: "Fast responses with lighter reasoning.", cliValue: "low" },
  { id: "medium", label: "Medium", description: "Balanced reasoning for everyday Tasteprint steps.", cliValue: "medium" },
  { id: "high", label: "High", description: "Deeper reasoning for synthesis-heavy generation.", cliValue: "high" },
  { id: "xhigh", label: "Extra high", description: "Maximum practical reasoning for complex design synthesis.", cliValue: "xhigh" }
];

const CLAUDE_THINKING_OPTIONS = [
  { id: "low", label: "Low", description: "Fast responses with lighter reasoning.", cliValue: "low" },
  { id: "medium", label: "Medium", description: "Balanced reasoning for everyday Tasteprint steps.", cliValue: "medium" },
  { id: "high", label: "High", description: "Deeper reasoning for synthesis-heavy generation.", cliValue: "high" },
  { id: "xhigh", label: "Extra high", description: "Extra reasoning depth for complex design synthesis.", cliValue: "xhigh" },
  { id: "max", label: "Max", description: "Claude Code's maximum effort setting.", cliValue: "max" }
];

const CANDIDATES = [
  {
    id: "codex",
    label: "Codex",
    executable: "codex",
    role: "Agentic coding CLI",
    defaultContextWindow: 272000,
    variants: codexFallbackVariants,
    dynamicVariants: loadCodexVariants,
    thinkingOptions: OPENAI_THINKING_OPTIONS,
    args: (prompt, selection) => [
      "exec",
      "--skip-git-repo-check",
      "--color",
      "never",
      ...modelFlagArgs("--model", selection),
      ...codexThinkingArgs(selection),
      prompt
    ],
    fileAware: true
  },
  {
    id: "claude",
    label: "Claude Code",
    executable: "claude",
    role: "Agentic coding CLI",
    defaultContextWindow: 200000,
    // Variant labels are bare model tiers (the card already says "Claude Code"), and
    // Fable is intentionally omitted.
    variants: () => [
      modelVariant("opus", "Opus", "opus", 200000, "Highest capability Claude Code alias."),
      modelVariant("sonnet", "Sonnet", "sonnet", 200000, "Balanced Claude Code alias."),
      modelVariant("haiku", "Haiku", "haiku", 200000, "Fast Claude Code alias.")
    ],
    thinkingOptions: CLAUDE_THINKING_OPTIONS,
    args: (prompt, selection) => [
      "--print",
      "--output-format",
      "text",
      ...modelFlagArgs("--model", selection),
      ...thinkingFlagArgs("--effort", selection),
      prompt
    ],
    fileAware: true
  },
  {
    id: "gemini",
    label: "Gemini",
    executable: "gemini",
    role: "Agentic coding CLI",
    defaultContextWindow: 1000000,
    variants: () => [
      modelVariant("gemini-3-pro", "Gemini 3 Pro", "gemini-3-pro", 1000000, "Large-context Gemini model when available."),
      modelVariant("gemini-2.5-pro", "Gemini 2.5 Pro", "gemini-2.5-pro", 1000000, "Strong Gemini Pro model."),
      modelVariant("gemini-2.5-flash", "Gemini 2.5 Flash", "gemini-2.5-flash", 1000000, "Faster Gemini model.")
    ],
    thinkingOptions: DEFAULT_THINKING_OPTIONS,
    args: (prompt, selection) => [
      ...modelFlagArgs("--model", selection),
      "-p",
      prompt
    ],
    fileAware: true
  },
  {
    id: "opencode",
    label: "OpenCode",
    executable: "opencode",
    role: "Agentic coding CLI",
    defaultContextWindow: 128000,
    variants: () => [
      modelVariant("default", "OpenCode default", null, 128000, "Use OpenCode's configured model."),
      modelVariant("gpt-5.5", "GPT-5.5", "gpt-5.5", 272000, "OpenAI model id when configured in OpenCode."),
      modelVariant("claude-opus", "Claude Opus", "opus", 200000, "Anthropic alias when configured in OpenCode."),
      modelVariant("claude-sonnet", "Claude Sonnet", "sonnet", 200000, "Anthropic alias when configured in OpenCode.")
    ],
    thinkingOptions: DEFAULT_THINKING_OPTIONS,
    args: (prompt, selection) => [
      "run",
      ...modelFlagArgs("--model", selection),
      prompt
    ],
    fileAware: true
  },
  {
    id: "cursor-agent",
    label: "Cursor Agent",
    executable: "cursor-agent",
    role: "Agentic coding CLI",
    defaultContextWindow: 128000,
    variants: () => [
      modelVariant("default", "Cursor default", null, 128000, "Use Cursor Agent's configured model."),
      modelVariant("gpt-5.5", "GPT-5.5", "gpt-5.5", 272000, "OpenAI model id when available in Cursor Agent."),
      modelVariant("claude-opus", "Claude Opus", "opus", 200000, "Anthropic alias when available in Cursor Agent."),
      modelVariant("claude-sonnet", "Claude Sonnet", "sonnet", 200000, "Anthropic alias when available in Cursor Agent.")
    ],
    thinkingOptions: DEFAULT_THINKING_OPTIONS,
    args: (prompt, selection) => [
      ...modelFlagArgs("--model", selection),
      "-p",
      prompt
    ],
    fileAware: true
  },
  {
    id: "qwen",
    label: "Qwen Code",
    executable: "qwen",
    role: "Agentic coding CLI",
    defaultContextWindow: 128000,
    variants: () => [
      modelVariant("default", "Qwen default", null, 128000, "Use Qwen Code's configured model."),
      modelVariant("qwen3-coder", "Qwen3 Coder", "qwen3-coder", 256000, "Qwen coding model id when available."),
      modelVariant("qwen3-coder-plus", "Qwen3 Coder Plus", "qwen3-coder-plus", 256000, "Larger Qwen coding model id when available.")
    ],
    thinkingOptions: DEFAULT_THINKING_OPTIONS,
    args: (prompt, selection) => [
      ...modelFlagArgs("--model", selection),
      "-p",
      prompt
    ],
    fileAware: true
  }
];

// The three first-party CLIs Tasteprint showcases. They are always offered on the
// model screen — installed or not — so every user can preview their "world"; real PATH
// presence rides each descriptor as `installed` and is only enforced once the interview
// starts (see the not-detected gate in the UI).
const SHOWCASED_IDS = ["codex", "claude", "gemini"];

export function detectModels(options = {}) {
  const localOnly = Boolean(options.localOnly);
  const unavailable = new Set(options.unavailable || []);

  const descriptors = CANDIDATES.map((candidate) => {
    const path = findExecutable(candidate.executable);
    // dev:local treats everything as installed (deterministic, no install popup) unless a
    // model is explicitly forced unavailable for testing; normal runs trust PATH.
    const installed = (localOnly ? true : Boolean(path)) && !unavailable.has(candidate.id);
    const showcased = SHOWCASED_IDS.includes(candidate.id);
    return buildModelDescriptor(candidate, {
      path,
      // Showcased CLIs are always selectable; other CLIs appear only when installed.
      forceAvailable: localOnly || showcased,
      localOnly,
      installed
    });
  });

  const visible = descriptors.filter((model) => SHOWCASED_IDS.includes(model.id) || model.available);
  return [...visible, localFallbackModel(localOnly)];
}

export async function invokeModel(modelSelection, prompt, options = {}) {
  const modelId = modelSelection?.id;
  const candidate = CANDIDATES.find((item) => item.id === modelId);

  if (modelSelection?.localOnly) {
    return {
      ok: false,
      skipped: true,
      stdout: "",
      stderr: "",
      warning: null,
      localOnly: true
    };
  }

  if (!candidate || modelSelection?.fallback || modelId === "tasteprint-local") {
    return {
      ok: false,
      skipped: true,
      stdout: "",
      stderr: "",
      warning: modelSelection?.localOnly ? null : "Using Tasteprint's local fallback because no callable CLI model was selected.",
      localOnly: Boolean(modelSelection?.localOnly)
    };
  }

  const executablePath = modelSelection?.path || findExecutable(candidate.executable);
  if (!executablePath) {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      warning: `${candidate.label} was selected, but the ${candidate.executable} executable was not found on PATH.`
    };
  }

  let promptForCli = prompt;
  let tempFile = null;

  if (candidate.fileAware && prompt.length > 6000) {
    const projectDir = options.projectDir || dirname(fileURLToPath(import.meta.url));
    const tempDir = join(projectDir, ".tasteprint", "tmp");
    await mkdir(tempDir, { recursive: true });
    tempFile = join(tempDir, `${candidate.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
    await writeFile(tempFile, prompt, "utf8");
    promptForCli = [
      "Read the complete Tasteprint task prompt from this local file:",
      tempFile,
      "",
      "Return only the requested JSON. Do not edit files. Do not start servers."
    ].join("\n");
  }

  const resolvedSelection = resolveModelSelection(modelSelection, candidate);
  const args = candidate.args(promptForCli, resolvedSelection);
  const result = await runProcess(executablePath, args, {
    timeoutMs: options.timeoutMs || 120000,
    cwd: options.projectDir || process.cwd()
  });

  if (tempFile) {
    await rm(tempFile, { force: true }).catch(() => {});
  }

  return {
    ...result,
    model: {
      id: candidate.id,
      label: modelLabel(candidate, resolvedSelection),
      variant: resolvedSelection.variant,
      thinking: resolvedSelection.thinking
    }
  };
}

function codexFallbackVariants() {
  return [
    modelVariant("gpt-5.5", "GPT-5.5", "gpt-5.5", 272000, "Frontier Codex model."),
    modelVariant("gpt-5.4", "GPT-5.4", "gpt-5.4", 272000, "Previous-generation GPT-5 model when available."),
    modelVariant("gpt-5", "GPT-5", "gpt-5", 272000, "GPT-5 model alias when available.")
  ].map((variant) => ({
    ...variant,
    thinkingOptions: OPENAI_THINKING_OPTIONS,
    defaultThinkingId: "medium"
  }));
}

function localFallbackModel(localOnly) {
  return {
    id: "tasteprint-local",
    label: localOnly ? "Tasteprint local onboarding" : "Tasteprint local draft",
    executable: null,
    path: null,
    role: "Deterministic offline fallback",
    available: true,
    installed: true,
    fallback: true,
    localOnly,
    variants: [
      modelVariant("tasteprint-local", localOnly ? "Local fallback flow" : "Tasteprint local draft", null, 128000, "Deterministic local generator.")
    ],
    thinkingOptions: DEFAULT_THINKING_OPTIONS,
    defaultVariantId: "tasteprint-local",
    defaultThinkingId: "default"
  };
}

function buildModelDescriptor(candidate, options) {
  const path = options.path || null;
  const variants = withCustomVariant(loadVariants(candidate, path || candidate.executable), candidate.defaultContextWindow);
  const thinkingOptions = loadThinkingOptions(candidate, variants);

  return {
    id: candidate.id,
    label: candidate.label,
    executable: candidate.executable,
    path,
    role: candidate.role,
    available: options.forceAvailable || Boolean(path),
    // Real PATH presence, independent of `available` (which a showcased CLI forces true
    // so it can be previewed). The UI gates the interview start on this.
    installed: Boolean(options.installed),
    fileAware: candidate.fileAware,
    localOnly: options.localOnly,
    variants,
    thinkingOptions,
    defaultVariantId: variants[0]?.id || null,
    defaultThinkingId: defaultThinkingId(thinkingOptions, variants[0])
  };
}

function loadCodexVariants(executablePath) {
  const result = spawnSync(executablePath, ["debug", "models"], {
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true
  });

  if (result.status !== 0 || !result.stdout) {
    return [];
  }

  try {
    const parsed = JSON.parse(result.stdout);
    return (parsed.models || [])
      .filter((model) => model.slug && (!model.visibility || model.visibility === "list"))
      .sort((a, b) => (a.priority || 999) - (b.priority || 999))
      .map((model) => ({
        id: model.slug,
        label: model.display_name || model.slug,
        cliValue: model.slug,
        description: model.description || "Codex model.",
        contextWindow: Number(model.context_window || model.contextWindow || model.effective_context_window || model.max_context_window) || 272000,
        defaultThinkingId: model.default_reasoning_level || "medium",
        thinkingOptions: Array.isArray(model.supported_reasoning_levels) && model.supported_reasoning_levels.length
          ? model.supported_reasoning_levels.map((level) => ({
              id: level.effort,
              label: titleCase(level.effort),
              description: level.description || `${titleCase(level.effort)} reasoning.`,
              cliValue: level.effort
            }))
          : OPENAI_THINKING_OPTIONS
      }));
  } catch {
    return [];
  }
}

function loadVariants(candidate, executablePath) {
  const dynamic = candidate.dynamicVariants?.(executablePath) || [];
  const fallback = candidate.variants?.() || [];
  return dynamic.length ? dynamic : fallback;
}

function loadThinkingOptions(candidate, variants) {
  const variantOptions = variants.find((variant) => Array.isArray(variant.thinkingOptions) && variant.thinkingOptions.length)?.thinkingOptions;
  return variantOptions || candidate.thinkingOptions || DEFAULT_THINKING_OPTIONS;
}

function withCustomVariant(variants, contextWindow) {
  return [
    ...variants,
    {
      id: "custom",
      label: "Custom model id",
      cliValue: null,
      description: "Type any model id supported by this CLI.",
      contextWindow: contextWindow || 128000,
      custom: true
    }
  ];
}

function modelVariant(id, label, cliValue, contextWindow, description) {
  return {
    id,
    label,
    cliValue,
    contextWindow,
    description
  };
}

function resolveModelSelection(selection = {}, candidate) {
  const variants = withCustomVariant(loadVariants(candidate, selection.path || findExecutable(candidate.executable)), candidate.defaultContextWindow);
  const selectedVariant = selection.variant?.custom || selection.variant?.id === "custom" || selection.customModelId
    ? modelVariant("custom", selection.customModelId || "custom", selection.customModelId || null, candidate.defaultContextWindow || 128000, "Custom model id.")
    : variants.find((variant) => variant.id === selection.variant?.id) || variants.find((variant) => variant.id === selection.defaultVariantId) || variants[0];
  const thinkingOptions = selectedVariant?.thinkingOptions || loadThinkingOptions(candidate, variants);
  const selectedThinking = thinkingOptions.find((thinking) => thinking.id === selection.thinking?.id)
    || thinkingOptions.find((thinking) => thinking.id === selectedVariant?.defaultThinkingId)
    || thinkingOptions.find((thinking) => thinking.id === selection.defaultThinkingId)
    || thinkingOptions[0]
    || DEFAULT_THINKING_OPTIONS[0];

  return {
    ...selection,
    variant: selectedVariant,
    thinking: selectedThinking
  };
}

function modelFlagArgs(flag, selection) {
  const value = selection?.variant?.cliValue;
  return value ? [flag, value] : [];
}

function codexThinkingArgs(selection) {
  const value = selection?.thinking?.cliValue;
  return value ? ["-c", `model_reasoning_effort="${value}"`] : [];
}

function thinkingFlagArgs(flag, selection) {
  const value = selection?.thinking?.cliValue;
  return value ? [flag, value] : [];
}

function defaultThinkingId(thinkingOptions, variant) {
  return variant?.defaultThinkingId || thinkingOptions.find((option) => option.id === "medium")?.id || thinkingOptions[0]?.id || "default";
}

function modelLabel(candidate, selection) {
  const variant = selection.variant?.label ? ` / ${selection.variant.label}` : "";
  const thinking = selection.thinking?.id && selection.thinking.id !== "default" ? ` (${selection.thinking.label})` : "";
  return `${candidate.label}${variant}${thinking}`;
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function findExecutable(command) {
  const lookup = WINDOWS ? spawnSync("where.exe", [command], { encoding: "utf8" }) : spawnSync("command", ["-v", command], { encoding: "utf8", shell: true });
  if (lookup.status !== 0) {
    return null;
  }

  const firstLine = lookup.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return firstLine || null;
}

function runProcess(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        stdout,
        stderr: stderr || error.message,
        warning: error.message
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0 && !timedOut,
        stdout,
        stderr,
        code,
        warning: timedOut ? "The selected CLI model timed out." : code === 0 ? null : stderr || `Process exited with code ${code}.`
      });
    });
  });
}
