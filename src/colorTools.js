const DEFAULT_PRIMARY = "#5E6AD2";
const LIGHT_CANVAS = "#F7F7F5";
const DARK_CANVAS = "#0B0B0D";
const LIGHT_INK = "#151517";
const DARK_INK = "#F6F6F4";

export function createColorSystem({ primary = DEFAULT_PRIMARY, dark = false, secondarySeed = null, referenceLibrary = [] } = {}) {
  const canvas = dark ? DARK_CANVAS : LIGHT_CANVAS;
  const referenceSeed = chooseReferenceColorSeed(referenceLibrary, canvas);
  const sourcePrimary = normalizeHex(referenceSeed?.hex) || normalizeHex(primary) || DEFAULT_PRIMARY;
  const visiblePrimary = ensureContrast(sourcePrimary, canvas, 3).hex;
  const structural = dark ? "#F6F6F4" : "#2A2B31";
  const secondary = secondarySeed && normalizeHex(secondarySeed)
    ? ensureContrast(secondarySeed, canvas, 3).hex
    : structural;
  const tertiary = suggestThirdColor(visiblePrimary, secondary, { dark, background: canvas }).hex;
  const primaryInk = chooseReadableText(visiblePrimary);

  const tokens = dark
    ? {
        primary: visiblePrimary,
        primaryInk,
        secondary,
        tertiary,
        neutral: DARK_CANVAS,
        canvas: DARK_CANVAS,
        surface: "#111114",
        surfaceMuted: "#1F2024",
        ink: DARK_INK,
        inkMuted: "#B8BCC7",
        hairline: "#2B2C31"
      }
    : {
        primary: visiblePrimary,
        primaryInk,
        secondary,
        tertiary,
        neutral: LIGHT_CANVAS,
        canvas: LIGHT_CANVAS,
        surface: "#FFFFFF",
        surfaceMuted: "#F3F1EC",
        ink: LIGHT_INK,
        inkMuted: "#6D7078",
        hairline: "#E1E1DD"
      };

  return {
    tokens,
    sourcePrimary,
    adjustedPrimary: sourcePrimary.toLowerCase() !== visiblePrimary.toLowerCase(),
    contrast: analyzePalette(tokens),
    referenceSeed,
    method: {
      primary: "Seeded from selected references or user direction, then lightness-repaired for focus and selected-state contrast.",
      secondary: "Structural neutral or seed color with contrast repaired against the canvas.",
      tertiary: "Computed from the color wheel as a third hue that stays separated from primary and secondary, then contrast-repaired.",
      textOnAccent: "Chosen by contrast, not preference; use the higher-contrast black or white text on the accent."
    }
  };
}

export function createThemeColorTokens(options = {}) {
  const system = options.tokens ? { tokens: options.tokens } : createColorSystem(options);
  const tokens = system.tokens;
  const dark = typeof options.dark === "boolean" ? options.dark : relativeLuminance(tokens.canvas) < 0.5;
  const primaryHover = deriveHoverColor(tokens.primary, tokens.primaryInk);

  return {
    canvas: tokens.canvas,
    canvasPure: tokens.surface,
    canvasWarm: tokens.surfaceMuted,
    ink: tokens.ink,
    inkSoft: dark ? mixHex(tokens.ink, tokens.canvas, 0.12) : tokens.secondary,
    inkMuted: tokens.inkMuted,
    inkSubtle: dark ? mixHex(tokens.inkMuted, tokens.canvas, 0.28) : mixHex(tokens.inkMuted, tokens.canvas, 0.34),
    hairline: tokens.hairline,
    hairlineStrong: dark ? mixHex(tokens.hairline, tokens.ink, 0.14) : mixHex(tokens.hairline, tokens.ink, 0.16),
    primary: tokens.primary,
    primaryHover,
    primarySoft: dark ? mixHex(tokens.surface, tokens.primary, 0.22) : mixHex(tokens.surface, tokens.primary, 0.1),
    primaryInk: tokens.primaryInk
  };
}

export function createColorToolPrompt({ primary, dark, referenceLibrary = [] }) {
  const system = createColorSystem({ primary, dark, referenceLibrary });
  return [
    "Internal color tool output. Use this as a checked candidate palette, not as a hard limit.",
    JSON.stringify({
      referenceSeed: system.referenceSeed,
      referenceColorLibrary: summarizeReferenceColorLibrary(referenceLibrary),
      tokens: system.tokens,
      contrast: system.contrast,
      method: system.method
    }, null, 2),
    "If changing colors, preserve semantic roles, derive added hues with color-wheel relationships, choose text-on-color by contrast, and repair lightness until WCAG AA is met."
  ].join("\n");
}

export function chooseReferenceColorSeed(referenceLibrary = [], background = LIGHT_CANVAS) {
  const weightedRoles = [
    [/primary|accent|brand|focus|action/i, 7],
    [/tertiary|signal|highlight|interactive/i, 5],
    [/secondary|success|warning/i, 3],
    [/ink|text|canvas|surface|neutral|border|hairline/i, -2]
  ];

  return referenceLibrary
    .flatMap((reference, referenceIndex) => (reference.colors || []).map((color, colorIndex) => ({
      referenceId: reference.referenceId,
      referenceName: reference.referenceName,
      role: color.role,
      hex: normalizeHex(color.hex || color.value),
      value: color.value,
      referenceIndex,
      colorIndex
    })))
    .filter((color) => color.hex)
    .map((color) => {
      const roleScore = weightedRoles.reduce((score, [pattern, weight]) => score + (pattern.test(color.role) ? weight : 0), 0);
      const contrast = contrastRatio(color.hex, background);
      const contrastScore = contrast >= 3 ? 3 : contrast;
      return {
        ...color,
        contrast: roundRatio(contrast),
        score: roleScore + contrastScore - color.referenceIndex * 0.25 - color.colorIndex * 0.02
      };
    })
    .sort((a, b) => b.score - a.score)[0] || null;
}

export function summarizeReferenceColorLibrary(referenceLibrary = []) {
  return referenceLibrary.map((reference) => ({
    referenceId: reference.referenceId,
    referenceName: reference.referenceName,
    colors: (reference.colors || [])
      .filter((color) => color.hex || normalizeHex(color.value))
      .slice(0, 12)
      .map((color) => ({
        role: color.role,
        value: color.hex || normalizeHex(color.value) || color.value
      }))
  }));
}

export function suggestThirdColor(firstColor, secondColor, { dark = false, background = dark ? DARK_CANVAS : LIGHT_CANVAS } = {}) {
  const first = normalizeHex(firstColor) || DEFAULT_PRIMARY;
  const second = normalizeHex(secondColor) || (dark ? DARK_INK : LIGHT_INK);
  const firstHsl = rgbToHsl(hexToRgb(first));
  const secondHsl = rgbToHsl(hexToRgb(second));
  const candidates = [
    rotateHue(firstHsl.h, 120),
    rotateHue(firstHsl.h, -120),
    rotateHue(secondHsl.h, 120),
    rotateHue(secondHsl.h, -120),
    rotateHue((firstHsl.h + secondHsl.h) / 2, 180)
  ];

  const hue = candidates
    .map((candidate) => ({
      hue: candidate,
      distance: Math.min(hueDistance(candidate, firstHsl.h), hueDistance(candidate, secondHsl.h))
    }))
    .sort((a, b) => b.distance - a.distance)[0].hue;

  const saturation = clamp(((firstHsl.s + secondHsl.s) / 2 || 0.52) * 0.82, 0.32, 0.74);
  const lightness = dark ? 0.62 : 0.42;
  const candidate = rgbToHex(hslToRgb({ h: hue, s: saturation, l: lightness }));
  const repaired = ensureContrast(candidate, background, 3);

  return {
    hex: repaired.hex,
    source: candidate,
    adjusted: repaired.changed,
    contrast: repaired.ratio
  };
}

export function analyzePalette(tokens) {
  return {
    inkOnCanvas: roundRatio(contrastRatio(tokens.ink, tokens.canvas)),
    mutedInkOnCanvas: roundRatio(contrastRatio(tokens.inkMuted, tokens.canvas)),
    primaryOnCanvas: roundRatio(contrastRatio(tokens.primary, tokens.canvas)),
    primaryInkOnPrimary: roundRatio(contrastRatio(tokens.primaryInk, tokens.primary)),
    tertiaryOnCanvas: roundRatio(contrastRatio(tokens.tertiary, tokens.canvas))
  };
}

export function ensureContrast(foreground, background, minimum = 4.5) {
  const bg = normalizeHex(background) || LIGHT_CANVAS;
  let fg = normalizeHex(foreground) || DEFAULT_PRIMARY;
  let ratio = contrastRatio(fg, bg);

  if (ratio >= minimum) {
    return { hex: fg, ratio: roundRatio(ratio), changed: false };
  }

  const bgLight = relativeLuminance(bg) > 0.5;
  const direction = bgLight ? -1 : 1;
  const hsl = rgbToHsl(hexToRgb(fg));
  let best = { hex: fg, ratio };

  for (let step = 0; step < 32; step += 1) {
    hsl.l = clamp(hsl.l + direction * 0.025, 0.02, 0.96);
    fg = rgbToHex(hslToRgb(hsl));
    ratio = contrastRatio(fg, bg);
    if (ratio > best.ratio) {
      best = { hex: fg, ratio };
    }
    if (ratio >= minimum) {
      return { hex: fg, ratio: roundRatio(ratio), changed: true };
    }
  }

  return { hex: best.hex, ratio: roundRatio(best.ratio), changed: true };
}

export function contrastRatio(firstColor, secondColor) {
  const first = relativeLuminance(firstColor);
  const second = relativeLuminance(secondColor);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function chooseReadableText(background) {
  const black = "#0B0B0D";
  const white = "#FFFFFF";
  return contrastRatio(black, background) >= contrastRatio(white, background) ? black : white;
}

export function normalizeHex(value) {
  const raw = String(value || "").trim();
  const short = raw.match(/^#([0-9a-f]{3})$/i);
  if (short) {
    return `#${short[1].split("").map((char) => char + char).join("")}`.toUpperCase();
  }
  const full = raw.match(/^#([0-9a-f]{6})$/i);
  return full ? `#${full[1].toUpperCase()}` : null;
}

export function isSafeCssColor(value) {
  const raw = String(value || "").trim();
  if (!raw || /[;{}<>]/.test(raw)) {
    return false;
  }
  if (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?$/i.test(raw)) {
    return true;
  }
  if (/^(?:rgb|rgba|hsl|hsla|oklch|oklab)\([0-9a-z%.,/\s+-]+\)$/i.test(raw)) {
    return true;
  }
  if (/^color-mix\([0-9a-z#%.,()/\s+-]+\)$/i.test(raw)) {
    return true;
  }
  return /^(?:black|white|transparent|currentcolor|canvas|canvastext)$/i.test(raw);
}

export function sanitizeCssValue(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw || /[;{}<>]/.test(raw)) {
    return fallback;
  }
  return raw;
}

function relativeLuminance(color) {
  const rgb = hexToRgb(normalizeHex(color) || DEFAULT_PRIMARY);
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex) || DEFAULT_PRIMARY;
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function rgbToHsl({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;

  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return { h: hue * 60, s: saturation, l: lightness };
}

function hslToRgb({ h, s, l }) {
  const hue = rotateHue(h, 0) / 360;

  if (s === 0) {
    const value = l * 255;
    return { r: value, g: value, b: value };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hueToRgb(p, q, hue + 1 / 3) * 255,
    g: hueToRgb(p, q, hue) * 255,
    b: hueToRgb(p, q, hue - 1 / 3) * 255
  };
}

function hueToRgb(p, q, t) {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

function rotateHue(hue, amount) {
  return ((hue + amount) % 360 + 360) % 360;
}

function hueDistance(first, second) {
  const distance = Math.abs(rotateHue(first, 0) - rotateHue(second, 0));
  return Math.min(distance, 360 - distance);
}

function deriveHoverColor(primary, primaryInk) {
  const source = normalizeHex(primary) || DEFAULT_PRIMARY;
  const text = normalizeHex(primaryInk) || chooseReadableText(source);
  const textIsLight = relativeLuminance(text) > 0.5;
  const direction = textIsLight ? -1 : 1;
  const hsl = rgbToHsl(hexToRgb(source));
  let best = source;
  let bestDelta = 0;

  for (let step = 1; step <= 12; step += 1) {
    const candidate = rgbToHex(hslToRgb({
      ...hsl,
      l: clamp(hsl.l + direction * step * 0.018, 0.02, 0.96)
    }));
    const ratio = contrastRatio(text, candidate);
    const delta = Math.abs(rgbToHsl(hexToRgb(candidate)).l - hsl.l);

    if (ratio >= 4.5 && delta > bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }

  return best;
}

function mixHex(firstColor, secondColor, secondAmount = 0.5) {
  const first = hexToRgb(normalizeHex(firstColor) || DEFAULT_PRIMARY);
  const second = hexToRgb(normalizeHex(secondColor) || DEFAULT_PRIMARY);
  const amount = clamp(secondAmount, 0, 1);
  return rgbToHex({
    r: first.r + (second.r - first.r) * amount,
    g: first.g + (second.g - first.g) * amount,
    b: first.b + (second.b - first.b) * amount
  });
}

function roundRatio(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
