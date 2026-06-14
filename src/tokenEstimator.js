const DEFAULT_CONTEXT_WINDOW = 128000;

export function estimateTextTokens(text) {
  const source = String(text || "");
  if (!source) {
    return {
      tokens: 0,
      chars: 0,
      method: "local-estimate"
    };
  }

  const pieces = source.match(/[\p{L}\p{N}_'-]+|[^\s]/gu) || [];
  let tokens = 0;

  for (const piece of pieces) {
    if (/^[\x00-\x7F]+$/.test(piece)) {
      tokens += Math.max(1, Math.ceil(piece.length / 4));
    } else {
      tokens += Math.max(1, Math.ceil([...piece].length * 0.85));
    }
  }

  return {
    tokens: Math.ceil(tokens * 1.08),
    chars: [...source].length,
    method: "local-estimate"
  };
}

export function estimatePromptUsage(prompt, modelSelection = {}, meta = {}) {
  const estimated = estimateTextTokens(prompt);
  const contextWindow = resolveContextWindow(modelSelection);
  const percent = contextWindow ? Math.min(100, (estimated.tokens / contextWindow) * 100) : null;

  return {
    ...estimated,
    contextWindow,
    percent: percent === null ? null : Math.round(percent * 10) / 10,
    role: meta.role || null,
    task: meta.task || null,
    model: selectedModelLabel(modelSelection),
    accuracy: "estimate"
  };
}

export function resolveContextWindow(modelSelection = {}) {
  return Number(modelSelection?.variant?.contextWindow)
    || Number(modelSelection?.contextWindow)
    || Number(modelSelection?.modelContextWindow)
    || DEFAULT_CONTEXT_WINDOW;
}

function selectedModelLabel(modelSelection = {}) {
  if (modelSelection?.customModelId) {
    return modelSelection.customModelId;
  }
  if (modelSelection?.variant?.label) {
    return modelSelection.variant.label;
  }
  return modelSelection?.label || "Tasteprint local draft";
}
