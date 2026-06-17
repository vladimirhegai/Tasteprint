// Intake word cloud — the "quirk" of the What-are-you-building screen.
//
// As the user types (or pastes) their product description, any token from
// intakeWords.db.js that appears in the text pops in and floats in the margin
// around the textbox. Delete the word and its chip pops back out.
//
// Design notes:
//   - Motion is pure CSS (entrance pop + an idle float keyframe). The only JS per
//     word is one placement pass at spawn — no rAF loop, nothing per frame.
//   - Words are placed in the band *around* the composer, never over it, with a
//     little spacing so the cloud reads as scattered rather than stacked.
//   - On a paste, many words arrive at once: each gets a small random entrance
//     delay so they cascade in lively and random, but the whole burst lands fast.

import { INTAKE_WORDS } from "./intakeWords.db.js";

const MAX_WORDS = 20; // hard ceiling on chips on screen at once
const GAP = 18; // clear space kept around the composer
const EDGE = 12; // keep chips off the very edge of the stage
const MIN_DIST = 70; // soft minimum spacing between chip centers
const BASE_SIZE = 15; // px; per-chip size is this scaled up a little, at random

// token -> entry. First definition wins so earlier (brand) entries beat later ones.
const LOOKUP = new Map();
for (const entry of INTAKE_WORDS) {
  const tokens = entry.match?.length ? entry.match : [entry.label.toLowerCase()];
  for (const token of tokens) {
    const key = token.toLowerCase();
    if (!LOOKUP.has(key)) LOOKUP.set(key, entry);
  }
}

let stageEl = null;
let layerEl = null;
let boxEl = null;
const active = new Map(); // entry.label -> { el, cx, cy }

export function mountIntakeWords({ stage, layer, box }) {
  destroyIntakeWords();
  stageEl = stage;
  layerEl = layer;
  boxEl = box;
}

export function destroyIntakeWords() {
  if (layerEl) layerEl.replaceChildren();
  active.clear();
  stageEl = layerEl = boxEl = null;
}

// Re-scan the text and reconcile the cloud against it: pop in newcomers, pop out
// anything whose trigger word was deleted.
export function updateIntakeWords(text) {
  if (!layerEl || !boxEl) return;
  const present = matchedEntries(text);

  for (const key of [...active.keys()]) {
    if (!present.has(key)) removeWord(key);
  }

  // Collect everyone we're about to add so we can stagger the burst (matters most
  // on a paste). Random delays across a short, count-scaled window read lively but
  // never drag — a single typed word is effectively instant.
  const incoming = [];
  for (const [key, entry] of present) {
    if (active.has(key) || active.size + incoming.length >= MAX_WORDS) continue;
    incoming.push([key, entry]);
  }
  const window = Math.min(450, incoming.length * 55);
  for (const [key, entry] of incoming) {
    addWord(key, entry, rand(0, window));
  }
}

// Ordered, de-duped map of label -> entry for every trigger token present as a
// whole word in the text.
function matchedEntries(text) {
  const tokens = String(text || "").toLowerCase().match(/[a-zà-ÿ0-9][a-zà-ÿ0-9'+-]*/g) || [];
  const found = new Map();
  for (const token of tokens) {
    const entry = LOOKUP.get(token);
    if (entry && !found.has(entry.label)) found.set(entry.label, entry);
  }
  return found;
}

function addWord(key, entry, inDelay) {
  const el = document.createElement("span");
  el.className = "intake-word" + (entry.bare ? " is-bare" : "");
  el.textContent = entry.label;
  styleWord(el, entry);

  // Measure off-screen, then place, then reveal — one layout read per chip.
  el.style.visibility = "hidden";
  el.style.left = "-9999px";
  layerEl.appendChild(el);
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const pos = placeWord(w, h);

  el.style.left = `${pos.x}px`;
  el.style.top = `${pos.y}px`;
  el.style.setProperty("--rot", `${rand(-9, 9).toFixed(2)}deg`);
  el.style.setProperty("--dx", `${rand(11, 22).toFixed(1)}px`);
  el.style.setProperty("--dy", `${rand(10, 20).toFixed(1)}px`);
  el.style.setProperty("--dur", `${rand(7, 12).toFixed(2)}s`);
  el.style.setProperty("--in-delay", `${Math.round(inDelay)}ms`);
  el.style.setProperty("--float-delay", `${(-rand(0, 6)).toFixed(2)}s`);
  el.style.visibility = "";

  void el.offsetWidth; // commit the placement before the entrance animation
  el.classList.add("is-in");
  active.set(key, { el, cx: pos.x + w / 2, cy: pos.y + h / 2 });
}

function removeWord(key) {
  const record = active.get(key);
  if (!record) return;
  active.delete(key);
  const el = record.el;
  el.classList.remove("is-in");
  el.classList.add("is-leaving");
  el.addEventListener("animationend", () => el.remove(), { once: true });
}

function styleWord(el, entry) {
  el.style.color = entry.color || "var(--ink)";
  if (entry.bg) el.style.background = entry.bg;
  if (entry.border) el.style.borderColor = entry.border;
  if (entry.font) el.style.fontFamily = entry.font;
  el.style.fontWeight = String(entry.weight || 550);
  if (entry.italic) el.style.fontStyle = "italic";
  if (entry.tracking) el.style.letterSpacing = entry.tracking;
  if (entry.caps) el.style.textTransform = "uppercase";
  el.style.fontSize = `${(BASE_SIZE * rand(0.9, 1.7)).toFixed(1)}px`;
}

// Pick a spot in the band around the composer. Tries a handful of candidate points,
// preferring one that clears the other chips; falls back to its best guess.
function placeWord(w, h) {
  const W = stageEl.clientWidth;
  const H = stageEl.clientHeight;
  const bx = boxEl.offsetLeft;
  const by = boxEl.offsetTop;
  const bw = boxEl.offsetWidth;
  const bh = boxEl.offsetHeight;

  const bands = [];
  pushBand(bands, EDGE, bx - GAP - w, EDGE, H - EDGE - h); // left
  pushBand(bands, bx + bw + GAP, W - EDGE - w, EDGE, H - EDGE - h); // right
  pushBand(bands, EDGE, W - EDGE - w, EDGE, by - GAP - h); // top
  pushBand(bands, EDGE, W - EDGE - w, by + bh + GAP, H - EDGE - h); // bottom

  if (!bands.length) {
    return {
      x: clamp(rand(EDGE, W - EDGE - w), 0, Math.max(0, W - w)),
      y: clamp(rand(EDGE, H - EDGE - h), 0, Math.max(0, H - h))
    };
  }

  let best = null;
  for (let i = 0; i < 16; i += 1) {
    const band = weightedPick(bands);
    const x = rand(band.x0, band.x1);
    const y = rand(band.y0, band.y1);
    const candidate = { x, y, cx: x + w / 2, cy: y + h / 2 };
    if (!best) best = candidate;
    if (farEnough(candidate.cx, candidate.cy)) return candidate;
  }
  return best;
}

function pushBand(bands, x0, x1, y0, y1) {
  if (x1 < x0 || y1 < y0) return;
  bands.push({ x0, x1, y0, y1, area: (x1 - x0 + 1) * (y1 - y0 + 1) });
}

function weightedPick(bands) {
  const total = bands.reduce((sum, band) => sum + band.area, 0);
  let roll = Math.random() * total;
  for (const band of bands) {
    roll -= band.area;
    if (roll <= 0) return band;
  }
  return bands[bands.length - 1];
}

function farEnough(cx, cy) {
  for (const { cx: ox, cy: oy } of active.values()) {
    if (Math.hypot(cx - ox, cy - oy) < MIN_DIST) return false;
  }
  return true;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
