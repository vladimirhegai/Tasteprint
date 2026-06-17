// The "Living Template" recipe book for the "How should it feel?" screen.
//
// A generic mock website sits in the middle of that screen; selecting a mood
// (Playful, Dense, Minimal…) morphs it. The morph is just a set of CSS custom
// properties swapped on the preview element — exactly the project's core theme
// primitive, but scoped to the preview instead of :root, so the page chrome
// stays calm and only the template transforms.
//
// Everything here is static, so the morph is identical under `npm run dev:local`
// (no live model). Recipes are keyed to the known personality vocabulary in
// src/generator.js (PERSONALITY_OPTIONS); any unknown, model-authored label
// falls back to a light "polish" patch so the morph never breaks. Palette values
// are mined from the awesome-design-md corpus (Claude, Linear, Wired, Figma,
// Apple, Stripe…) so each mood reads like a real, designed system.

// The deliberately-plain starting point — a flat, low-contrast, cramped template
// that reads as "unstyled". The mock visibly improves the moment any mood lands.
// These values must mirror the `.template-preview` var defaults in styles.css.
export const BASELINE_PREVIEW = {
  accent: "#8A8A8E",
  accentSoft: "#EDEDEF",
  accentInk: "#FFFFFF",
  canvas: "#FFFFFF",
  surface: "#F4F4F5",
  ink: "#3C3C40",
  inkSoft: "#A0A0A6",
  border: "#E4E4E7",
  radius: "3px",
  density: "0.82",
  scale: "0.96",
  weight: "600",
  tracking: "0em",
  font: 'Arial, "Helvetica Neue", sans-serif',
  shadow: "none"
};

const SANS = "var(--font-sans)";
const SERIF = 'Georgia, "Iowan Old Style", "Times New Roman", serif';
const SHADOW_SOFT = "0 18px 44px -28px rgba(20, 20, 28, 0.4)";
const SHADOW_WARM = "0 18px 44px -26px rgba(120, 70, 40, 0.34)";
const SHADOW_COLOR = "0 20px 48px -26px rgba(110, 60, 200, 0.36)";
const SHADOW_DARK = "0 26px 60px -34px rgba(0, 0, 0, 0.75)";
const SHADOW_GLOW = "0 0 0 1px rgba(120, 140, 255, 0.18), 0 22px 52px -28px rgba(60, 90, 255, 0.5)";

// One patch per vocabulary word. Each carries a *complete, coherent* identity
// (palette + type) so it can act as the dominant look in a multi-select; spacing
// and shape axes blend across selections (see composePreview). Most moods pull the
// template onto the app's real sans — the baseline's generic Arial is part of the
// "bad → better" read.
export const MOOD_PREVIEW = {
  // Apple-style restraint: refined near-black, pearl surfaces, generous radius.
  Premium: {
    accent: "#1D1D1F", accentSoft: "#F0F0F2", canvas: "#FFFFFF", surface: "#FAFAFC",
    ink: "#1D1D1F", inkSoft: "#7A7A7E", border: "#E4E4E7", radius: "16px",
    density: "1.18", scale: "1.02", weight: "600", tracking: "-0.02em", font: SANS, shadow: SHADOW_SOFT
  },
  // Vercel/Apple white space — say less, leave room.
  Minimal: {
    accent: "#171717", accentSoft: "#F4F4F4", canvas: "#FFFFFF", surface: "#FFFFFF",
    ink: "#171717", inkSoft: "#888888", border: "#EBEBEB", radius: "8px",
    density: "1.26", scale: "1.0", weight: "500", tracking: "-0.01em", font: SANS, shadow: "none"
  },
  // Linear graphite dark — lavender accent on near-black surfaces.
  Technical: {
    accent: "#5E6AD2", accentSoft: "#1E2030", accentInk: "#0B0C14", canvas: "#0D0E10", surface: "#16181B",
    ink: "#F7F8F8", inkSoft: "#8A8F98", border: "#2A2C32", radius: "8px",
    density: "0.98", scale: "0.98", weight: "600", tracking: "-0.012em", font: SANS, shadow: SHADOW_DARK
  },
  // Figma-ish lilac energy — round, warm-white, lively.
  Playful: {
    accent: "#7C3AED", accentSoft: "#EDE7FF", canvas: "#FFFDF9", surface: "#FFFFFF",
    ink: "#2A2440", inkSoft: "#7E73A8", border: "#ECE6FB", radius: "22px",
    density: "1.16", scale: "1.03", weight: "680", tracking: "-0.01em", font: SANS, shadow: SHADOW_COLOR
  },
  // PostHog signal orange — decisive, compact, action-forward.
  Fast: {
    accent: "#FF5A1F", accentSoft: "#FFE9DF", canvas: "#FFFFFF", surface: "#FFFFFF",
    ink: "#1A1A1C", inkSoft: "#7C7C82", border: "#EBEBEB", radius: "6px",
    density: "0.96", scale: "1.0", weight: "680", tracking: "-0.02em", font: SANS, shadow: "none"
  },
  // Notion-warm minimal with a muted teal — quiet and readable.
  Calm: {
    accent: "#4F8A7B", accentSoft: "#E6EFEB", canvas: "#F7F8F5", surface: "#FFFFFF",
    ink: "#2C332F", inkSoft: "#7E867F", border: "#E3E8E4", radius: "16px",
    density: "1.2", scale: "1.0", weight: "560", tracking: "-0.006em", font: SANS, shadow: SHADOW_SOFT
  },
  // Information-dense — tight gutters, smaller type, more on screen.
  Dense: {
    accent: "#3A3A40", accentSoft: "#ECECEE", canvas: "#FFFFFF", surface: "#F7F7F8",
    ink: "#161618", inkSoft: "#70707A", border: "#E2E2E5", radius: "6px",
    density: "0.72", scale: "0.9", weight: "620", tracking: "-0.01em", font: SANS, shadow: "none"
  },
  // The opposite — air, calm, oversized spacing.
  Spacious: {
    accent: "#2A2A30", accentSoft: "#F0F0F1", canvas: "#FFFFFF", surface: "#FFFFFF",
    ink: "#1C1C20", inkSoft: "#86868E", border: "#EFEFEF", radius: "14px",
    density: "1.42", scale: "1.06", weight: "540", tracking: "-0.012em", font: SANS, shadow: SHADOW_SOFT
  },
  // Wired stark editorial — serif display, hairline rules, black ink.
  Editorial: {
    accent: "#111114", accentSoft: "#F0EEE9", canvas: "#FBFAF7", surface: "#FFFFFF",
    ink: "#0E0D0B", inkSoft: "#757575", border: "#E2DED6", radius: "3px",
    density: "1.12", scale: "1.06", weight: "720", tracking: "-0.03em", font: SERIF, shadow: "none"
  },
  // Cool deep-space dark with an electric blue glow.
  Futuristic: {
    accent: "#6E8BFF", accentSoft: "#1A1E33", accentInk: "#070A18", canvas: "#0A0B14", surface: "#12131F",
    ink: "#E8EAF5", inkSoft: "#888FB0", border: "#23263A", radius: "12px",
    density: "1.05", scale: "1.0", weight: "600", tracking: "0.01em", font: SANS, shadow: SHADOW_GLOW
  },
  // Stripe/Apple trust blue — clean, structured, dependable.
  Trustworthy: {
    accent: "#0A66C2", accentSoft: "#E5EFFA", canvas: "#FBFCFE", surface: "#FFFFFF",
    ink: "#0D253D", inkSoft: "#5C6678", border: "#E3E8EE", radius: "10px",
    density: "1.06", scale: "1.0", weight: "620", tracking: "-0.01em", font: SANS, shadow: SHADOW_SOFT
  },
  // Figma magenta — confident, vivid, a touch luxe.
  Creative: {
    accent: "#FF3D8B", accentSoft: "#FFE3EF", canvas: "#FFFCFD", surface: "#FFFFFF",
    ink: "#2A1A24", inkSoft: "#8A6A78", border: "#FBDDE9", radius: "18px",
    density: "1.12", scale: "1.04", weight: "680", tracking: "-0.015em", font: SANS, shadow: SHADOW_COLOR
  },
  // IBM/enterprise navy — deeper, more corporate than Trustworthy.
  Enterprise: {
    accent: "#1F4E8C", accentSoft: "#E7EDF5", canvas: "#FAFBFC", surface: "#FFFFFF",
    ink: "#1C2430", inkSoft: "#5A6478", border: "#E2E6EC", radius: "8px",
    density: "1.0", scale: "0.98", weight: "640", tracking: "-0.008em", font: SANS, shadow: SHADOW_SOFT
  },
  // Claude cream + coral — humanist, warm, literate.
  Warm: {
    accent: "#CC785C", accentSoft: "#F0E5DC", accentInk: "#FFFFFF", canvas: "#FAF9F5", surface: "#F5F0E8",
    ink: "#141413", inkSoft: "#6C6A64", border: "#E6DFD8", radius: "14px",
    density: "1.16", scale: "1.02", weight: "600", tracking: "-0.012em", font: SANS, shadow: SHADOW_WARM
  },
  // Nike/Vercel black — square, heavy, high-contrast.
  Sharp: {
    accent: "#111111", accentSoft: "#ECECEC", canvas: "#FFFFFF", surface: "#FFFFFF",
    ink: "#0A0A0C", inkSoft: "#707072", border: "#1A1A1A", radius: "2px",
    density: "0.98", scale: "1.02", weight: "720", tracking: "-0.03em", font: SANS, shadow: "none"
  }
};

// A gentle "make it look intentional" identity for any label not in the vocabulary
// (model-authored options vary run to run). It lifts the baseline off its plain
// state without a strong character, so unknown moods still feel like they did
// something — and they never out-rank a known mood for the dominant palette.
const POLISH_PATCH = {
  accent: "#3B3B42", accentSoft: "#EEEEF0", canvas: "#FFFFFF", surface: "#FFFFFF",
  ink: "#1A1A1E", inkSoft: "#797982", border: "#ECECEE", radius: "12px",
  density: "1.1", scale: "1.0", weight: "620", tracking: "-0.012em", font: SANS, shadow: SHADOW_SOFT
};

// Which mood owns the palette + type identity when several are picked. Higher wins.
// Strongly-coloured / opinionated moods out-rank the structural ones (Dense,
// Spacious, Minimal) so a partner mood's colour shows through instead of being
// washed to grey. Values are unique, so the dominant choice — and therefore the
// whole result — is identical regardless of selection order.
const MOOD_PRIORITY = {
  Editorial: 14,
  Futuristic: 13,
  Technical: 12,
  Creative: 11,
  Playful: 10,
  Warm: 9,
  Fast: 8,
  Trustworthy: 7,
  Enterprise: 6,
  Calm: 5,
  Premium: 4,
  Sharp: 3,
  Minimal: 2,
  Spacious: 1,
  Dense: 0
};

// Identity axes — taken whole from the single dominant mood so colour + type stay
// coherent (averaging colours across moods just makes mud).
const DOMINANT_TOKENS = [
  "accent", "accentSoft", "accentInk", "canvas", "surface", "ink", "inkSoft",
  "border", "font", "shadow", "weight", "tracking"
];
// Spacing / shape axes — blended across the selection so a tight mood + an airy
// mood land in between. Both operations below are commutative, so the composed
// result does not depend on the order moods were selected.
const NUMERIC_TOKENS = ["density", "scale", "radius"];

function patchFor(label) {
  return MOOD_PREVIEW[label] || POLISH_PATCH;
}

function averageToken(token, patches) {
  const base = BASELINE_PREVIEW[token];
  const unit = String(base).match(/[a-z%]+$/i)?.[0] || "";
  const values = patches.map((patch) => parseFloat(patch[token] != null ? patch[token] : base));
  const avg = values.reduce((sum, n) => sum + n, 0) / values.length;
  return `${Math.round(avg * 1000) / 1000}${unit}`;
}

// Compose the preview tokens for the current selection. Order-independent: one
// highest-priority mood supplies the whole identity, and the spacing/shape axes are
// averaged. No selection → the untouched, plain baseline.
export function composePreview(selectedLabels = []) {
  const tokens = { ...BASELINE_PREVIEW };
  if (!selectedLabels.length) {
    return tokens;
  }

  const patches = selectedLabels.map(patchFor);
  const dominant = selectedLabels
    .slice()
    .sort((a, b) => (MOOD_PRIORITY[b] ?? -1) - (MOOD_PRIORITY[a] ?? -1) || (a < b ? -1 : 1))
    .map(patchFor)[0];

  for (const token of DOMINANT_TOKENS) {
    if (dominant[token] != null) {
      tokens[token] = dominant[token];
    }
  }
  for (const token of NUMERIC_TOKENS) {
    tokens[token] = averageToken(token, patches);
  }
  return tokens;
}
