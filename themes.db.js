// A small, curated, fully static theme database. It turns our pile of design-md /
// archetype skills into deterministic theme decisions without paying tokens or
// parsing at runtime. Each entry stores ONLY the axes we morph; everything else
// inherits from BASE_THEME via buildTheme().

// Keyed by reference group (the tab labels in the references screen).
export const ARCHETYPE_THEMES = {
  "Premium / minimal": {
    accent: "#5E6AD2",
    dark: false,
    headingWeight: "650",
    headingTracking: "-0.03em",
    radiusCard: "18px",
    density: "1.08"
  },
  "Technical / powerful": {
    accent: "#76B900",
    dark: true,
    headingWeight: "700",
    headingTracking: "-0.012em",
    radiusCard: "5px",
    radiusControl: "5px",
    density: "0.92"
  },
  "Creative / visual": {
    accent: "#8B3DFF",
    dark: false,
    headingWeight: "680",
    headingTracking: "-0.02em",
    radiusCard: "22px",
    density: "1.12"
  },
  "AI / agentic": {
    accent: "#D97757",
    dark: true,
    headingWeight: "640",
    headingTracking: "-0.018em",
    radiusCard: "14px",
    density: "1.0"
  },
  "Enterprise / trustworthy": {
    accent: "#0176D3",
    dark: false,
    headingWeight: "640",
    headingTracking: "-0.01em",
    radiusCard: "12px",
    density: "1.0"
  },
  "Editorial / bold": {
    accent: "#111114",
    dark: false,
    headingWeight: "700",
    headingTracking: "-0.034em",
    radiusCard: "8px",
    density: "1.06"
  }
};

// Accent (+ optional dark) per reference id — mined from design-md frontmatter,
// curated for contrast safety. Last-selected reference wins for the live theme.
export const REFERENCE_BRAND = {
  apple: { accent: "#0066CC" },
  stripe: { accent: "#635BFF" },
  vercel: { accent: "#111114" },
  linear: { accent: "#5E6AD2", dark: true },
  raycast: { accent: "#FF6363", dark: true },
  cursor: { accent: "#111114" },
  superhuman: { accent: "#5E61E6", dark: true },
  resend: { accent: "#111114" },
  sanity: { accent: "#F03E2F" },
  nvidia: { accent: "#76B900", dark: true },
  figma: { accent: "#A259FF" },
  warp: { accent: "#01A4FF", dark: true },
  supabase: { accent: "#3ECF8E", dark: true },
  clickhouse: { accent: "#FAFF69", dark: true },
  mongodb: { accent: "#00ED64", dark: true },
  hashicorp: { accent: "#000000" },
  posthog: { accent: "#F54E00" },
  sentry: { accent: "#7553FF", dark: true },
  runway: { accent: "#FFFFFF", dark: true },
  framer: { accent: "#0099FF", dark: true },
  webflow: { accent: "#146EF5" },
  notion: { accent: "#0A85D1" },
  spotify: { accent: "#1DB954", dark: true },
  pinterest: { accent: "#E60023" },
  miro: { accent: "#FFD02F" },
  lovable: { accent: "#FF4D6A" },
  claude: { accent: "#D97757" },
  mistral: { accent: "#FA520F", dark: true },
  cohere: { accent: "#39594D" },
  together: { accent: "#0F6FFF", dark: true },
  elevenlabs: { accent: "#111114" },
  replicate: { accent: "#111114", dark: true },
  xai: { accent: "#FFFFFF", dark: true },
  minimax: { accent: "#E8431F", dark: true },
  ollama: { accent: "#111114" },
  opencode: { accent: "#FFBE00", dark: true },
  shopify: { accent: "#95BF47", dark: true },
  airbnb: { accent: "#FF385C" },
  intercom: { accent: "#1F8DED" },
  slack: { accent: "#611F69" },
  ibm: { accent: "#0F62FE" },
  meta: { accent: "#0866FF" },
  mastercard: { accent: "#EB001B" },
  wise: { accent: "#9FE870" },
  revolut: { accent: "#191C1F", dark: true },
  coinbase: { accent: "#0052FF" },
  uber: { accent: "#111114" },
  wired: { accent: "#111114" },
  theverge: { accent: "#FF1700" },
  nike: { accent: "#111114" },
  tesla: { accent: "#E31937" },
  starbucks: { accent: "#00704A" },
  bmw: { accent: "#0066B1" },
  ferrari: { accent: "#FF2800" }
};

// Mood nudges layered on top of BASE for the personality (positive) and anti
// (negative) screens. The headline "the tool reacts to the question's tone" moment.
export const MOOD_THEMES = {
  positive: {
    mood: "positive",
    canvasWarm: "#F4F1EA",
    primarySoft: "#ECEFFF",
    density: "1.08"
  },
  negative: {
    mood: "negative",
    canvasWarm: "#EEEFF1",
    inkMuted: "#5C5F66",
    hairline: "#D7D8DA",
    density: "0.96"
  }
};

export function archetypeForGroup(group) {
  return ARCHETYPE_THEMES[group] || ARCHETYPE_THEMES["Premium / minimal"];
}

export function brandForReference(id) {
  return REFERENCE_BRAND[id] || null;
}
