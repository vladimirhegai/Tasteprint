// The runtime theme engine. One primitive — swap a set of CSS variables, animated —
// powers every theme moment (mood, archetype, direction palette, final reveal).
import { expandAccent, expandTokens } from "./color.js";

export const BASE_THEME = {
  // color
  canvas: "#F7F7F5",
  canvasPure: "#FFFFFF",
  canvasWarm: "#F3F1EC",
  ink: "#151517",
  inkSoft: "#2B2C30",
  inkMuted: "#6D7078",
  inkSubtle: "#9A9EA8",
  hairline: "#E1E1DD",
  hairlineStrong: "#C9CAC4",
  primary: "#5E6AD2",
  primaryHover: "#7480EA",
  primarySoft: "#ECEEFF",
  primaryInk: "#FFFFFF",
  // type
  fontSans: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  fontMono: '"Geist Mono", "JetBrains Mono", SFMono-Regular, ui-monospace, Menlo, monospace',
  headingWeight: "650",
  headingTracking: "-0.022em",
  // shape + density
  radiusCard: "18px",
  radiusControl: "8px",
  density: "1",
  // mood drives the subtle background wash + hover energy
  mood: "neutral",
  dark: false
};

// Compose a theme from BASE plus ordered patches. A patch may carry:
//   { accent }            -> expanded into full color tokens for the active darkness
//   { colors }            -> a backend createColorSystem token object, expanded
//   { dark }              -> flips the neutral set used by accent/colors expansion
//   any flat token        -> overrides directly (mood nudges, type, radius, density)
export function buildTheme(...patches) {
  let theme = { ...BASE_THEME };

  for (const patch of patches) {
    if (!patch) {
      continue;
    }

    const { accent, colors, dark, ...rest } = patch;
    if (typeof dark === "boolean") {
      theme.dark = dark;
    }
    if (colors) {
      theme = { ...theme, ...expandTokens(colors, theme.dark) };
    }
    if (accent) {
      theme = { ...theme, ...expandAccent(accent, theme.dark) };
    }
    theme = { ...theme, ...rest };
  }

  return theme;
}

const TOKEN_TO_VAR = {
  canvas: "--canvas",
  canvasPure: "--canvas-pure",
  canvasWarm: "--canvas-warm",
  ink: "--ink",
  inkSoft: "--ink-soft",
  inkMuted: "--ink-muted",
  inkSubtle: "--ink-subtle",
  hairline: "--hairline",
  hairlineStrong: "--hairline-strong",
  primary: "--primary",
  primaryHover: "--primary-hover",
  primarySoft: "--primary-soft",
  primaryInk: "--primary-ink",
  fontSans: "--font-sans",
  fontMono: "--font-mono",
  headingWeight: "--heading-weight",
  headingTracking: "--heading-tracking",
  radiusCard: "--radius-card",
  radiusControl: "--radius-control",
  density: "--density"
};

let currentTheme = null;

function moodWash(theme) {
  // "Light in the room", not a startup background. Tuned per mood.
  const primary = theme.primary || BASE_THEME.primary;
  if (theme.mood === "negative") {
    return `radial-gradient(circle at 50% -22%, ${rgba(primary, 0.05)}, transparent 30rem)`;
  }
  if (theme.mood === "positive") {
    return `radial-gradient(circle at 50% -18%, ${rgba(primary, 0.16)}, ${rgba(theme.canvasWarm, 0)} 34rem)`;
  }
  return `radial-gradient(circle at 50% -20%, ${rgba(primary, 0.12)}, transparent 32rem)`;
}

function rgba(hex, alpha) {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) {
    return `rgba(94, 106, 210, ${alpha})`;
  }
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function writeTheme(theme) {
  const root = document.documentElement;
  for (const [token, cssVar] of Object.entries(TOKEN_TO_VAR)) {
    if (theme[token] != null) {
      root.style.setProperty(cssVar, String(theme[token]));
    }
  }
  root.style.setProperty("--mood-wash", moodWash(theme));
  root.dataset.mood = theme.mood || "neutral";
  root.dataset.dark = theme.dark ? "true" : "false";
}

function sameTheme(a, b) {
  if (!a || !b) {
    return false;
  }
  return Object.keys(TOKEN_TO_VAR).every((token) => a[token] === b[token]) && a.mood === b.mood;
}

// applyTheme(theme) — the single entry point. It writes the theme tokens as CSS
// custom properties; the visible "calm crossfade" is carried entirely by the CSS
// property transitions in styles.css. That makes it automatically instant on
// first paint and under prefers-reduced-motion — and there is no overlay, so no
// cursor halo.
export function applyTheme(theme) {
  const merged = buildTheme(theme);
  if (sameTheme(currentTheme, merged)) {
    return;
  }
  writeTheme(merged);
  currentTheme = merged;
}

export function currentThemeSnapshot() {
  return currentTheme ? { ...currentTheme } : { ...BASE_THEME };
}
