// The intake "word cloud" database.
//
// While the user describes their product on the intake screen, any token here that
// shows up in their text "pops in" and floats around the textbox. Each entry carries
// its own little theme so the word reads the way it feels — Apple is clean and quiet,
// "Blue" is blue, "Premium" wears a serif, "Dark" is a dark chip, and so on.
//
// ---- HOW TO ADD A WORD -------------------------------------------------------
// Push an object onto INTAKE_WORDS. The only required field is `label` (what shows).
//
//   label    text shown in the chip (also the default trigger, lowercased)
//   match    optional array of trigger tokens (aliases / plurals). Whole-word only.
//   color    text color (defaults to the page ink)
//   bg       chip background (omit for the default frosted pill, or set `bare`)
//   border   chip border color
//   bare     true → no pill: just styled text floating (good for clean wordmarks)
//   font     SANS | SERIF | MONO | SYSTEM (or any CSS font-family string)
//   weight   font-weight (defaults to 550)
//   italic   true → italic
//   tracking letter-spacing (e.g. "0.2em" for airy, "-0.03em" for tight)
//   caps     true → UPPERCASE
//
// Keep it tasteful, not huge. ~common brands, colors, and product "feels".
// -----------------------------------------------------------------------------

// The three webfonts the page already loads, plus the OS UI font. Reuse these so
// the cloud stays light — no extra font requests for a decorative flourish.
const SANS = '"Outfit", system-ui, sans-serif';
const SERIF = '"Newsreader", Georgia, serif';
const MONO = '"Geist Mono", ui-monospace, monospace';
const SYSTEM = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

// Colored chip helper: tinted background + matching border from one hue, so a color
// word literally wears its own color. Pass a readable text color when the hue is too
// light/dark to read on the tint.
function hue(color, text) {
  return {
    color: text || color,
    bg: `color-mix(in srgb, ${color} 16%, transparent)`,
    border: `color-mix(in srgb, ${color} 34%, transparent)`
  };
}

export const INTAKE_WORDS = [
  /* ---------------- Brands — each wears its signature ---------------- */
  { label: "Apple", color: "#1d1d1f", font: SYSTEM, weight: 500, tracking: "-0.02em", bare: true },
  { label: "Google", color: "#4285F4", font: SANS, weight: 500 },
  { label: "Stripe", color: "#635BFF", font: SANS, weight: 600 },
  { label: "Vercel", color: "#000000", font: SYSTEM, weight: 600, tracking: "-0.03em", bare: true },
  { label: "Linear", color: "#5E6AD2", font: SANS, weight: 600 },
  { label: "Notion", color: "#111111", font: SERIF, weight: 500, bare: true },
  { label: "Figma", color: "#A259FF", font: SANS, weight: 600 },
  { label: "Nike", color: "#111111", font: SYSTEM, weight: 800, italic: true, caps: true, tracking: "0.02em" },
  { label: "Tesla", color: "#E31937", font: SYSTEM, weight: 600, caps: true, tracking: "0.34em" },
  { label: "Spotify", color: "#1DB954", font: SANS, weight: 700 },
  { label: "Netflix", color: "#E50914", font: SYSTEM, weight: 800, caps: true, tracking: "0.06em" },
  { label: "Airbnb", color: "#FF385C", font: SANS, weight: 600 },
  { label: "Amazon", color: "#FF9900", font: SANS, weight: 700, tracking: "-0.01em" },
  { label: "Microsoft", color: "#5E5E5E", font: SYSTEM, weight: 500 },
  { label: "Slack", color: "#611F69", font: SANS, weight: 600 },
  { label: "Discord", color: "#5865F2", font: SANS, weight: 700 },
  { label: "Uber", color: "#000000", font: SYSTEM, weight: 700, tracking: "-0.01em", bare: true },
  { label: "Coinbase", color: "#0052FF", font: SANS, weight: 600 },
  { label: "Shopify", color: "#5E8E3E", font: SANS, weight: 600 },
  { label: "Framer", color: "#0099FF", font: SANS, weight: 600 },
  { label: "Webflow", color: "#146EF5", font: SANS, weight: 600 },
  { label: "Raycast", color: "#FF6363", font: SANS, weight: 600 },
  { label: "GitHub", match: ["github"], color: "#111111", font: MONO, weight: 600 },
  { label: "Nvidia", color: "#76B900", font: SANS, weight: 700, caps: true, tracking: "0.05em" },
  { label: "OpenAI", match: ["openai"], color: "#10A37F", font: SANS, weight: 600 },
  { label: "Claude", color: "#C15F3C", font: SERIF, weight: 500 },
  { label: "Adobe", color: "#FA0F00", font: SANS, weight: 700 },
  { label: "Pinterest", color: "#E60023", font: SANS, weight: 700 },
  { label: "Supabase", color: "#3ECF8E", font: SANS, weight: 600 },
  { label: "Tailwind", match: ["tailwind", "tailwindcss"], color: "#38BDF8", font: SANS, weight: 600 },
  { label: "YouTube", color: "#FF0000", font: SYSTEM, weight: 700, tracking: "-0.02em" },
  { label: "React", color: "#61DAFB", font: SYSTEM, weight: 600 },
  { label: "Pornhub", color: "#000000", bg: "#FFA500", border: "#FFA500", font: SYSTEM, weight: 800, tracking: "-0.02em" },

  /* ---------------- Colors — they wear their own hue ---------------- */
  { label: "Red", ...hue("#E5484D") },
  { label: "Blue", ...hue("#2563EB") },
  { label: "Green", ...hue("#16A34A") },
  { label: "Orange", ...hue("#F97316") },
  { label: "Purple", ...hue("#8B3DFF") },
  { label: "Pink", ...hue("#EC4899") },
  { label: "Teal", ...hue("#14B8A6") },
  { label: "Cyan", ...hue("#06B6D4") },
  { label: "Navy", ...hue("#1E3A8A") },
  { label: "Indigo", ...hue("#4F46E5") },
  { label: "Black", color: "#111111", font: SYSTEM, weight: 800, tracking: "-0.02em", bare: true },
  { label: "White", color: "#FFFFFF", bg: "#1d1d1f", border: "#1d1d1f", weight: 600 },
  { label: "Yellow", color: "#3A2E00", bg: "#FACC15", border: "#E6B800", weight: 600 },
  { label: "Lime", color: "#243B00", bg: "#A3E635", border: "#84CC16", weight: 600 },
  { label: "Gold", color: "#8A6D2F", font: SERIF, italic: true, weight: 500, tracking: "0.04em" },
  { label: "Silver", color: "#8A8F98", font: SYSTEM, weight: 500, tracking: "0.06em" },
  { label: "Violet", ...hue("#7C3AED") },
  { label: "Rose", ...hue("#F43F5E") },
  { label: "Emerald", ...hue("#10B981") },
  { label: "Amber", ...hue("#D97706") },
  { label: "Bronze", color: "#CD7F32", font: SERIF, italic: true, weight: 500, tracking: "0.02em" },

  /* ---------------- Feels — the texture of the product ---------------- */
  { label: "Premium", color: "#7C6A3C", font: SERIF, weight: 500, tracking: "0.02em" },
  { label: "Minimal", match: ["minimal", "minimalist"], color: "#6B7280", font: SYSTEM, weight: 300, tracking: "0.2em", caps: true, bare: true },
  { label: "Fast", color: "#F97316", font: SANS, weight: 700, italic: true, tracking: "-0.01em" },
  { label: "Dark", color: "#F4F4F5", bg: "#15151A", border: "#15151A", weight: 600 },
  { label: "Light", color: "#9AA0A6", font: SYSTEM, weight: 300, tracking: "0.04em" },
  { label: "Bold", color: "#111111", font: SYSTEM, weight: 900, tracking: "-0.02em" },
  { label: "Clean", color: "#1d1d1f", font: SYSTEM, weight: 400, tracking: "-0.01em", bare: true },
  { label: "Modern", color: "#111111", font: SANS, weight: 500 },
  { label: "Playful", color: "#EC4899", font: SANS, weight: 700, bg: "color-mix(in srgb, #EC4899 14%, transparent)", border: "color-mix(in srgb, #EC4899 30%, transparent)" },
  { label: "Elegant", color: "#3A2E2A", font: SERIF, italic: true, weight: 500 },
  { label: "Sleek", color: "#111111", font: SYSTEM, weight: 600, tracking: "-0.03em", bare: true },
  { label: "Warm", color: "#B96A2E", font: SERIF, weight: 500, bg: "color-mix(in srgb, #B96A2E 12%, transparent)", border: "color-mix(in srgb, #B96A2E 28%, transparent)" },
  { label: "Calm", color: "#5B8A9A", font: SANS, weight: 400, bg: "color-mix(in srgb, #5B8A9A 12%, transparent)", border: "color-mix(in srgb, #5B8A9A 26%, transparent)" },
  { label: "Sharp", color: "#111111", font: MONO, weight: 600, tracking: "0.02em" },
  { label: "Luxury", match: ["luxury", "luxurious"], color: "#8A6D2F", font: SERIF, weight: 500, caps: true, tracking: "0.22em" },
  { label: "Futuristic", color: "#06B6D4", font: MONO, weight: 600, caps: true, tracking: "0.16em" },
  { label: "Retro", color: "#C2410C", font: SERIF, weight: 700, bg: "#FCE7C8", border: "#EBC99A" },
  { label: "Vibrant", color: "#FFFFFF", bg: "linear-gradient(90deg, #FF6B6B, #8B3DFF)", border: "transparent", font: SANS, weight: 800 },
  { label: "Friendly", color: "#16A34A", font: SANS, weight: 600, bg: "color-mix(in srgb, #16A34A 12%, transparent)", border: "color-mix(in srgb, #16A34A 26%, transparent)" },
  { label: "Professional", color: "#1F2937", font: SYSTEM, weight: 500 },
  { label: "Cozy", color: "#9A5B2E", font: SERIF, weight: 500, bg: "#F6E9D8", border: "#E6D2B6" },
  { label: "Soft", color: "#A78BFA", font: SANS, weight: 400, bg: "color-mix(in srgb, #A78BFA 14%, transparent)", border: "color-mix(in srgb, #A78BFA 28%, transparent)" },
  { label: "Edgy", color: "#FFFFFF", bg: "#111111", border: "#111111", font: SYSTEM, weight: 800, caps: true, tracking: "0.04em" },
  { label: "Bright", color: "#3A2E00", bg: "#FDE047", border: "#EAC500", font: SANS, weight: 700 },
  { label: "Muted", color: "#8A8F98", font: SYSTEM, weight: 400, tracking: "0.04em", bare: true },
  { label: "Technical", match: ["technical", "techy", "tech"], color: "#178A68", font: MONO, weight: 500 },
  { label: "Quiet", color: "#9AA0A6", font: SYSTEM, weight: 300, tracking: "0.1em", bare: true },
  { label: "Dense", color: "#111111", font: MONO, weight: 600, tracking: "-0.04em" },
  { label: "Spacious", color: "#6B7280", font: SYSTEM, weight: 300, tracking: "0.3em", caps: true, bare: true },
  { label: "Brutal", match: ["brutal", "brutalist"], color: "#000000", bg: "#FFFF00", border: "#000000", font: MONO, weight: 900, caps: true, tracking: "0.05em" },
  { label: "Organic", color: "#2E7D32", font: SERIF, weight: 400, italic: true },
  { label: "Cyberpunk", color: "#00FFFF", bg: "#FF0055", border: "#00FFFF", font: MONO, weight: 800, caps: true },
  { label: "Industrial", color: "#4E5D6C", font: MONO, weight: 700, tracking: "0.1em", caps: true },
  { label: "Subtle", color: "#71717A", font: SYSTEM, weight: 300, tracking: "0.15em", bare: true },
  { label: "Glow", match: ["glow", "glowing"], color: "#FFFFFF", bg: "radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)", border: "#8B5CF6", weight: 600 },

  /* ---------------- Audience & product type ---------------- */
  { label: "Founders", match: ["founders", "founder"], color: "#3A2E2A", font: SERIF, weight: 500 },
  { label: "Developers", match: ["developers", "developer", "devs", "dev"], color: "#178A68", font: MONO, weight: 500 },
  { label: "Designers", match: ["designers", "designer"], color: "#8B3DFF", font: SANS, weight: 500 },
  { label: "Startup", match: ["startup", "startups"], color: "#F97316", font: SANS, weight: 600 },
  { label: "Enterprise", color: "#1F2937", font: SYSTEM, weight: 600, tracking: "-0.01em" },
  { label: "SaaS", match: ["saas"], color: "#2563EB", font: SANS, weight: 600 },
  { label: "Mobile", color: "#16A34A", font: SANS, weight: 500 },
  { label: "Dashboard", color: "#475A50", font: MONO, weight: 500 },
  { label: "Portfolio", color: "#111111", font: SERIF, italic: true, weight: 500 },
  { label: "Ecommerce", match: ["ecommerce", "e-commerce"], color: "#95BF47", font: SANS, weight: 600 },
  { label: "Fintech", color: "#0052FF", font: SYSTEM, weight: 600 },
  { label: "AI", match: ["ai"], color: "#C15F3C", font: MONO, weight: 600, tracking: "0.04em" },
  { label: "Crypto", match: ["crypto", "cryptocurrency", "web3"], color: "#F59E0B", font: MONO, weight: 600 },
  { label: "Agency", match: ["agency", "studios", "studio"], color: "#111111", font: SERIF, weight: 500 },
  { label: "Creators", match: ["creators", "creator"], color: "#EC4899", font: SANS, weight: 600, italic: true },
  { label: "Analytics", match: ["analytics", "metrics"], color: "#0EA5E9", font: SYSTEM, weight: 500 },
  { label: "B2B", color: "#475569", font: SYSTEM, weight: 600, tracking: "0.08em", caps: true },
  { label: "Education", match: ["education", "school", "learning"], color: "#0284C7", font: SANS, weight: 500 }
];
