// Browser color port. The minimum of src/colorTools.js needed to expand an accent
// (or a backend createColorSystem token object) into a full flat theme offline.
// Keeping the math identical to the server guarantees dev:local renders the same
// palettes the AI path would produce.

const DEFAULT_PRIMARY = "#5E6AD2";

const LIGHT_NEUTRALS = {
  canvas: "#F7F7F5",
  canvasPure: "#FFFFFF",
  canvasWarm: "#F3F1EC",
  ink: "#151517",
  inkSoft: "#2B2C30",
  inkMuted: "#6D7078",
  inkSubtle: "#9A9EA8",
  hairline: "#E1E1DD",
  hairlineStrong: "#C9CAC4"
};

const DARK_NEUTRALS = {
  canvas: "#0B0B0D",
  canvasPure: "#111114",
  canvasWarm: "#1F2024",
  ink: "#F6F6F4",
  inkSoft: "#D7D8DA",
  inkMuted: "#B8BCC7",
  inkSubtle: "#7E828C",
  hairline: "#2B2C31",
  hairlineStrong: "#3A3B41"
};

// Expand a single accent hex + dark flag into the flat theme color tokens.
// Mirrors createColorSystem (visible primary repaired to 3:1) + createThemeColorTokens.
export function expandAccent(accent, dark = false) {
  const neutrals = dark ? DARK_NEUTRALS : LIGHT_NEUTRALS;
  const primary = ensureContrast(normalizeHex(accent) || DEFAULT_PRIMARY, neutrals.canvas, 3).hex;
  const primaryInk = chooseReadableText(primary);
  const primaryHover = deriveHoverColor(primary, primaryInk);
  const primarySoft = dark
    ? mixHex(neutrals.canvasPure, primary, 0.22)
    : mixHex(neutrals.canvasPure, primary, 0.1);

  return {
    ...neutrals,
    primary,
    primaryInk,
    primaryHover,
    primarySoft
  };
}

// Expand a backend createColorSystem token object (direction.colors) into flat
// theme tokens. Matches src/colorTools.js createThemeColorTokens exactly.
export function expandTokens(colors, dark) {
  const isDark = typeof dark === "boolean" ? dark : relativeLuminance(colors.canvas) < 0.5;
  const primary = normalizeHex(colors.primary) || DEFAULT_PRIMARY;
  const primaryInk = normalizeHex(colors.primaryInk) || chooseReadableText(primary);
  const primaryHover = deriveHoverColor(primary, primaryInk);
  const neutrals = isDark ? DARK_NEUTRALS : LIGHT_NEUTRALS;

  return {
    canvas: colors.canvas || neutrals.canvas,
    canvasPure: colors.surface || neutrals.canvasPure,
    canvasWarm: colors.surfaceMuted || neutrals.canvasWarm,
    ink: colors.ink || neutrals.ink,
    inkSoft: isDark ? mixHex(colors.ink, colors.canvas, 0.12) : colors.secondary || neutrals.inkSoft,
    inkMuted: colors.inkMuted || neutrals.inkMuted,
    inkSubtle: isDark
      ? mixHex(colors.inkMuted, colors.canvas, 0.28)
      : mixHex(colors.inkMuted, colors.canvas, 0.34),
    hairline: colors.hairline || neutrals.hairline,
    hairlineStrong: isDark
      ? mixHex(colors.hairline, colors.ink, 0.14)
      : mixHex(colors.hairline, colors.ink, 0.16),
    primary,
    primaryHover,
    primarySoft: isDark ? mixHex(colors.surface, primary, 0.22) : mixHex(colors.surface, primary, 0.1),
    primaryInk
  };
}

export function ensureContrast(foreground, background, minimum = 4.5) {
  const bg = normalizeHex(background) || LIGHT_NEUTRALS.canvas;
  let fg = normalizeHex(foreground) || DEFAULT_PRIMARY;
  let ratio = contrastRatio(fg, bg);

  if (ratio >= minimum) {
    return { hex: fg, ratio, changed: false };
  }

  const direction = relativeLuminance(bg) > 0.5 ? -1 : 1;
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
      return { hex: fg, ratio, changed: true };
    }
  }

  return { hex: best.hex, ratio: best.ratio, changed: true };
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
  const hue = (((h % 360) + 360) % 360) / 360;

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

function deriveHoverColor(primary, primaryInk) {
  const source = normalizeHex(primary) || DEFAULT_PRIMARY;
  const text = normalizeHex(primaryInk) || chooseReadableText(source);
  const direction = relativeLuminance(text) > 0.5 ? -1 : 1;
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

export function mixHex(firstColor, secondColor, secondAmount = 0.5) {
  const first = hexToRgb(normalizeHex(firstColor) || DEFAULT_PRIMARY);
  const second = hexToRgb(normalizeHex(secondColor) || DEFAULT_PRIMARY);
  const amount = clamp(secondAmount, 0, 1);
  return rgbToHex({
    r: first.r + (second.r - first.r) * amount,
    g: first.g + (second.g - first.g) * amount,
    b: first.b + (second.b - first.b) * amount
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
