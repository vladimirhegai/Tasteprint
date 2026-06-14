import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isSafeCssColor, normalizeHex, sanitizeCssValue } from "./colorTools.js";

export const REFERENCE_CATALOG = [
  // Premium / minimal
  { id: "apple", name: "Apple", group: "Premium / minimal", slug: "apple", description: "Premium restraint, large hierarchy, product-as-artifact focus." },
  { id: "stripe", name: "Stripe", group: "Premium / minimal", slug: "stripe", description: "Soft technical polish, refined gradients, transactional clarity." },
  { id: "vercel", name: "Vercel", group: "Premium / minimal", slug: "vercel", description: "Black-and-white precision, developer confidence, crisp UI." },
  { id: "linear", name: "Linear", group: "Premium / minimal", slug: "linear.app", description: "Graphite surfaces, sparse accent, dense product credibility." },
  { id: "raycast", name: "Raycast", group: "Premium / minimal", slug: "raycast", description: "Command-palette polish, keyboard-first density, dark chrome." },
  { id: "cursor", name: "Cursor", group: "Premium / minimal", slug: "cursor", description: "Editor calm, restrained chrome, developer-grade focus." },
  { id: "superhuman", name: "Superhuman", group: "Premium / minimal", slug: "superhuman", description: "Speed-first email, keyboard precision, premium dark polish." },
  { id: "resend", name: "Resend", group: "Premium / minimal", slug: "resend", description: "Monochrome developer clarity, sharp docs, calm restraint." },
  { id: "sanity", name: "Sanity", group: "Premium / minimal", slug: "sanity", description: "Structured content tooling, crisp panels, confident red signal." },

  // Technical / powerful
  { id: "nvidia", name: "Nvidia", group: "Technical / powerful", slug: "nvidia", description: "High-contrast technical confidence with a sharp green signal." },
  { id: "figma", name: "Figma", group: "Technical / powerful", slug: "figma", description: "Collaborative creation, clear controls, lively but practical color." },
  { id: "warp", name: "Warp", group: "Technical / powerful", slug: "warp", description: "Modern terminal energy, dark chrome, blue technical accent." },
  { id: "supabase", name: "Supabase", group: "Technical / powerful", slug: "supabase", description: "Developer-native dashboards, dark surfaces, green signal." },
  { id: "clickhouse", name: "ClickHouse", group: "Technical / powerful", slug: "clickhouse", description: "Data density, performance confidence, high-contrast utility." },
  { id: "mongodb", name: "MongoDB", group: "Technical / powerful", slug: "mongodb", description: "Database-grade clarity, green signal, structured documentation." },
  { id: "hashicorp", name: "HashiCorp", group: "Technical / powerful", slug: "hashicorp", description: "Infrastructure precision, neutral palette, systematic structure." },
  { id: "posthog", name: "PostHog", group: "Technical / powerful", slug: "posthog", description: "Product analytics energy, playful-technical, orange signal." },
  { id: "sentry", name: "Sentry", group: "Technical / powerful", slug: "sentry", description: "Observability focus, dark chrome, violet technical accent." },

  // Creative / visual
  { id: "runway", name: "Runway", group: "Creative / visual", slug: "runwayml", description: "Editorial confidence, cinematic contrast, serious creative tone." },
  { id: "framer", name: "Framer", group: "Creative / visual", slug: "framer", description: "Design-forward marketing, expressive motion, confident surfaces." },
  { id: "webflow", name: "Webflow", group: "Creative / visual", slug: "webflow", description: "Polished creator tooling, blue signal, structured visual editing." },
  { id: "notion", name: "Notion", group: "Creative / visual", slug: "notion", description: "Warm minimalism, document calm, approachable productivity." },
  { id: "spotify", name: "Spotify", group: "Creative / visual", slug: "spotify", description: "Bold media energy, dark surfaces, confident green signal." },
  { id: "pinterest", name: "Pinterest", group: "Creative / visual", slug: "pinterest", description: "Visual discovery, soft grids, approachable curation." },
  { id: "miro", name: "Miro", group: "Creative / visual", slug: "miro", description: "Collaborative canvas, lively controls, playful structure." },
  { id: "lovable", name: "Lovable", group: "Creative / visual", slug: "lovable", description: "Generative builder energy, vivid accents, modern creator tone." },

  // AI / agentic
  { id: "claude", name: "Claude", group: "AI / agentic", slug: "claude", description: "Warm, literate calm; clay accent; agent-native restraint." },
  { id: "mistral", name: "Mistral", group: "AI / agentic", slug: "mistral.ai", description: "Sharp model-lab energy, dark chrome, vivid orange signal." },
  { id: "cohere", name: "Cohere", group: "AI / agentic", slug: "cohere", description: "Enterprise AI calm, muted green, structured trust." },
  { id: "together", name: "Together", group: "AI / agentic", slug: "together.ai", description: "Open model platform, dark surfaces, blue technical signal." },
  { id: "elevenlabs", name: "ElevenLabs", group: "AI / agentic", slug: "elevenlabs", description: "Audio-AI minimalism, monochrome focus, crisp surfaces." },
  { id: "replicate", name: "Replicate", group: "AI / agentic", slug: "replicate", description: "Model-running utility, dark chrome, developer-native clarity." },
  { id: "xai", name: "xAI", group: "AI / agentic", slug: "x.ai", description: "Austere monochrome, high contrast, stark technical tone." },
  { id: "minimax", name: "MiniMax", group: "AI / agentic", slug: "minimax", description: "Multimodal lab energy, dark surfaces, vivid signal." },
  { id: "ollama", name: "Ollama", group: "AI / agentic", slug: "ollama", description: "Local-model friendliness, neutral palette, calm utility." },
  { id: "opencode", name: "OpenCode", group: "AI / agentic", slug: "opencode.ai", description: "Terminal-native agent tooling, dark chrome, amber signal." },

  // Enterprise / trustworthy
  { id: "shopify", name: "Shopify", group: "Enterprise / trustworthy", slug: "shopify", description: "Commerce trust, polished merchant workflows, confident conversion." },
  { id: "airbnb", name: "Airbnb", group: "Enterprise / trustworthy", slug: "airbnb", description: "Human warmth, marketplace trust, photography-aware UI." },
  { id: "intercom", name: "Intercom", group: "Enterprise / trustworthy", slug: "intercom", description: "Customer messaging clarity, blue trust, approachable product UI." },
  { id: "slack", name: "Slack", group: "Enterprise / trustworthy", slug: "slack", description: "Team workspace warmth, structured navigation, purple signal." },
  { id: "ibm", name: "IBM", group: "Enterprise / trustworthy", slug: "ibm", description: "Systematic enterprise rigor, grid discipline, blue trust." },
  { id: "wise", name: "Wise", group: "Enterprise / trustworthy", slug: "wise", description: "Fintech clarity, bold green, confident transactional UI." },
  { id: "coinbase", name: "Coinbase", group: "Enterprise / trustworthy", slug: "coinbase", description: "Financial trust, clean panels, calm blue signal." },
  { id: "uber", name: "Uber", group: "Enterprise / trustworthy", slug: "uber", description: "Operational scale, monochrome confidence, dense utility." },

  // Editorial / bold
  { id: "wired", name: "WIRED", group: "Editorial / bold", slug: "wired", description: "Editorial intensity, strong type, high-contrast layout." },
  { id: "theverge", name: "The Verge", group: "Editorial / bold", slug: "theverge", description: "Bold tech journalism, vivid accent, confident hierarchy." },
  { id: "nike", name: "Nike", group: "Editorial / bold", slug: "nike", description: "Athletic boldness, stark contrast, decisive type." },
  { id: "tesla", name: "Tesla", group: "Editorial / bold", slug: "tesla", description: "Minimal product drama, dark cinematic surfaces, red signal." },
  { id: "starbucks", name: "Starbucks", group: "Editorial / bold", slug: "starbucks", description: "Warm brand confidence, green identity, approachable polish." }
];

const FALLBACK_PREVIEWS = {
  apple: ["#ffffff", "#f5f5f7", "#1d1d1f", "#0066cc"],
  stripe: ["#ffffff", "#f6f9fc", "#0d253d", "#533afd"],
  vercel: ["#ffffff", "#f5f5f5", "#000000", "#000000"],
  linear: ["#010102", "#0f1011", "#f7f8f8", "#5e6ad2"],
  raycast: ["#0b0b0f", "#17171d", "#ffffff", "#ff6363"],
  nvidia: ["#050805", "#111711", "#f4fff1", "#76b900"],
  github: ["#ffffff", "#f6f8fa", "#24292f", "#0969da"],
  figma: ["#ffffff", "#f7f7f7", "#1f1f1f", "#a259ff"],
  blender: ["#16191f", "#22262e", "#f7f7f7", "#ea7600"],
  datadog: ["#ffffff", "#f7f5fb", "#1f1f24", "#632ca6"],
  runway: ["#050505", "#111111", "#ffffff", "#ffffff"],
  framer: ["#050505", "#111111", "#ffffff", "#0099ff"],
  webflow: ["#ffffff", "#f3f6ff", "#080b16", "#146ef5"],
  notion: ["#fbfaf8", "#f1efeb", "#242424", "#37352f"],
  canva: ["#ffffff", "#f6f2ff", "#222222", "#8b3dff"],
  salesforce: ["#ffffff", "#f5fbff", "#032d60", "#0176d3"],
  atlassian: ["#ffffff", "#f7f8fa", "#172b4d", "#0052cc"],
  microsoft: ["#ffffff", "#f5f5f5", "#1a1a1a", "#0078d4"],
  shopify: ["#050505", "#101510", "#f7fff2", "#95bf47"],
  airbnb: ["#ffffff", "#fff8f6", "#222222", "#ff385c"]
};

export async function getReferenceCatalog(packageRootUrl) {
  const packageRoot = fileURLToPath(packageRootUrl);
  const catalog = [];

  for (const reference of REFERENCE_CATALOG) {
    const designMd = await readReferenceDesignMd(reference, packageRoot).catch(() => null);
    catalog.push({
      ...reference,
      hasDesignMd: Boolean(designMd),
      preview: designMd ? previewFromDesignMd(designMd, reference.id) : fallbackPreview(reference.id)
    });
  }

  return catalog;
}

export async function loadReferenceContexts(referenceIds, packageRootUrl) {
  const packageRoot = fileURLToPath(packageRootUrl);
  const ids = new Set(referenceIds || []);
  const contexts = [];

  for (const reference of REFERENCE_CATALOG) {
    if (!ids.has(reference.id)) {
      continue;
    }

    const designMd = await readReferenceDesignMd(reference, packageRoot).catch(() => null);
    contexts.push({
      ...reference,
      designMd,
      hasDesignMd: Boolean(designMd)
    });
  }

  return contexts;
}

export async function loadReferenceColorLibrary(referenceIds, packageRootUrl) {
  const packageRoot = fileURLToPath(packageRootUrl);
  const ids = new Set(referenceIds || []);
  const library = [];

  for (const reference of REFERENCE_CATALOG) {
    if (!ids.has(reference.id)) {
      continue;
    }

    const designMd = await readReferenceDesignMd(reference, packageRoot).catch(() => null);
    const colors = designMd ? colorEntriesFromDesignMd(designMd) : [];
    library.push({
      referenceId: reference.id,
      referenceName: reference.name,
      hasDesignMd: Boolean(designMd),
      colors: colors.length ? colors : fallbackColorEntries(reference.id)
    });
  }

  return library;
}

function readReferenceDesignMd(reference, packageRoot) {
  if (!reference.slug) {
    return Promise.resolve(null);
  }

  return readFile(join(packageRoot, "awesome-design-md", "design-md", reference.slug, "DESIGN.md"), "utf8");
}

function previewFromDesignMd(content, referenceId) {
  const fallback = fallbackPreview(referenceId);
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) {
    return fallback;
  }

  const colors = extractYamlMap(frontmatter, "colors");
  const typography = extractTypography(frontmatter);

  return {
    canvas: firstColor(colors, ["canvas", "neutral", "background", "surface-canvas"]) || fallback.canvas,
    surface: firstColor(colors, ["surface-1", "surface", "surface-pearl", "canvas-soft", "canvas-parchment"]) || fallback.surface,
    ink: firstColor(colors, ["ink", "body", "text", "on-surface", "body-on-dark"]) || fallback.ink,
    primary: firstColor(colors, ["primary", "primary-focus", "tertiary", "accent", "brand"]) || fallback.primary,
    hairline: firstColor(colors, ["hairline", "divider-soft", "border", "hairline-strong"]) || fallback.hairline,
    fontFamily: sanitizeCssValue(typography.fontFamily, fallback.fontFamily),
    radius: fallback.radius
  };
}

function colorEntriesFromDesignMd(content) {
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) {
    return [];
  }

  const colors = extractYamlMap(frontmatter, "colors");
  return Object.entries(colors)
    .filter(([, value]) => isSafeCssColor(value))
    .map(([role, value]) => ({
      role,
      value,
      hex: normalizeHex(value)
    }))
    .slice(0, 32);
}

function fallbackColorEntries(referenceId) {
  const fallback = fallbackPreview(referenceId);
  return [
    ["canvas", fallback.canvas],
    ["surface", fallback.surface],
    ["ink", fallback.ink],
    ["primary", fallback.primary],
    ["hairline", fallback.hairline]
  ].map(([role, value]) => ({
    role,
    value,
    hex: normalizeHex(value)
  }));
}

function fallbackPreview(referenceId) {
  const [canvas, surface, ink, primary] = FALLBACK_PREVIEWS[referenceId] || ["#ffffff", "#f3f1ec", "#151517", "#5e6ad2"];
  return {
    canvas,
    surface,
    ink,
    primary,
    hairline: mixHairline(canvas, ink),
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    radius: "14px"
  };
}

function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : null;
}

function extractYamlMap(yaml, key) {
  const block = extractIndentedBlock(yaml, key);
  const map = {};
  for (const line of block.split(/\r?\n/)) {
    const pair = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*(.+?)\s*$/);
    if (!pair) {
      continue;
    }
    map[pair[1]] = stripYamlValue(pair[2]);
  }
  return map;
}

function extractTypography(yaml) {
  const block = extractIndentedBlock(yaml, "typography");
  const fontMatch = block.match(/fontFamily:\s*(.+?)\s*$/m);
  return {
    fontFamily: fontMatch ? stripYamlValue(fontMatch[1]) : null
  };
}

function extractIndentedBlock(yaml, key) {
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  if (start === -1) {
    return "";
  }

  const block = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\S/.test(line) && line.trim()) {
      break;
    }
    block.push(line);
  }
  return block.join("\n");
}

function firstColor(colors, keys) {
  for (const key of keys) {
    const value = colors[key];
    if (value && isSafeCssColor(value)) {
      return value;
    }
  }
  return null;
}

function stripYamlValue(value) {
  return value.replace(/^["']|["']$/g, "").trim();
}

function mixHairline(canvas, ink) {
  if (canvas.toLowerCase() === "#ffffff") {
    return "#e6e6e6";
  }
  if (ink.toLowerCase() === "#ffffff" || ink.toLowerCase() === "#f7f8f8") {
    return "rgba(255,255,255,0.14)";
  }
  return "#dedede";
}
