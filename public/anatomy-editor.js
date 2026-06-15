// Anatomy editor — a dev-only tool for positioning the intro's CTA-hover blueprint.
//
// Activated by `npm run dev:anatomy` (which opens the site at /?anatomy). app.js
// freezes the intro on its static frame, pins the blueprint revealed, then hands the
// stage here. Every call-out becomes draggable: grab the round handle on a dot/ring
// to move the whole call-out, or drag a label to move just the label (its leader
// re-aims live). When it looks right, "Copy" puts the measured positions on the
// clipboard as CSS you can paste straight back to me.
//
// Nothing in here runs unless the flag is set, so the normal flow is untouched.

// Per call-out: which coordinate scheme its anchor uses in styles.css, and whether
// its leader should auto-aim at the label while dragging.
//   word — anchored to the wordmark; emitted as `left: calc(50% ± em); top: em`
//          (so it scales with the responsive display font).
//   cta  — anchored to the fixed-size button; emitted as `left: calc(50% ± px);
//          bottom: px`.
const NODE_CONFIG = {
  "bp-type": { scheme: "word", autoLeader: true },
  "bp-cap": { scheme: "word", vbracket: true },
  "bp-track": { scheme: "word", autoLeader: true },
  "bp-base": { scheme: "word", autoLeader: true },
  "bp-accent": { scheme: "cta", autoLeader: true },
  "bp-action": { scheme: "cta", bracket: true },
  "bp-grid-note": { scheme: "cta", autoLeader: true }
};

export function mountAnatomyEditor(root) {
  const anatomy = root.querySelector(".intro-anatomy");
  const wordmark = root.querySelector(".intro-wordmark");
  if (!anatomy || !wordmark) {
    return;
  }

  anatomy.classList.add("is-edit");
  injectStyle();

  const bps = [...anatomy.querySelectorAll(".bp")];
  pinToPixels(bps, anatomy);

  let drag = null;
  const panel = buildPanel(() => refresh());
  const textarea = panel.querySelector(".ae-out");
  const status = panel.querySelector(".ae-status");

  function refresh() {
    textarea.value = generateCss(bps, anatomy, wordmark);
  }

  function onDown(event, bp, mode) {
    event.preventDefault();
    event.stopPropagation();
    const target = mode === "tag" ? bp.querySelector(".bp-tag") : bp;
    drag = {
      bp,
      mode,
      target,
      startX: event.clientX,
      startY: event.clientY,
      left: parseFloat(target.style.left) || 0,
      top: parseFloat(target.style.top) || 0
    };
    capturePointer(event);
    document.body.style.userSelect = "none";
  }

  window.addEventListener("pointermove", (event) => {
    if (!drag) {
      return;
    }
    drag.target.style.left = `${drag.left + (event.clientX - drag.startX)}px`;
    drag.target.style.top = `${drag.top + (event.clientY - drag.startY)}px`;
    if (drag.mode === "tag") {
      recomputeLeader(drag.bp);
    }
  });

  window.addEventListener("pointerup", () => {
    if (!drag) {
      return;
    }
    drag = null;
    document.body.style.userSelect = "";
    refresh();
  });

  for (const bp of bps) {
    const handle = document.createElement("span");
    handle.className = "ae-handle";
    handle.title = "Drag to move this call-out";
    handle.addEventListener("pointerdown", (event) => onDown(event, bp, "whole"));
    bp.appendChild(handle);

    const tag = bp.querySelector(".bp-tag");
    if (tag) {
      tag.title = "Drag to move this label";
      tag.addEventListener("pointerdown", (event) => onDown(event, bp, "tag"));
    }
  }

  panel.querySelector(".ae-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      flash(status, "Copied to clipboard ✓");
    } catch {
      textarea.select();
      flash(status, "Press Ctrl+C to copy");
    }
  });

  panel.querySelector(".ae-reset").addEventListener("click", () => {
    location.reload();
  });

  refresh();
}

// Freeze each call-out and label at its current rendered pixel position so dragging
// is absolute and we no longer fight the calc()/em rules from styles.css.
function pinToPixels(bps, anatomy) {
  const base = anatomy.getBoundingClientRect();
  for (const bp of bps) {
    const rect = bp.getBoundingClientRect();
    const tag = bp.querySelector(".bp-tag");
    const tagRect = tag ? tag.getBoundingClientRect() : null;
    bp.style.left = `${rect.left - base.left}px`;
    bp.style.top = `${rect.top - base.top}px`;
    bp.style.right = "auto";
    bp.style.bottom = "auto";
    if (tag && tagRect) {
      tag.style.left = `${tagRect.left - rect.left}px`;
      tag.style.top = `${tagRect.top - rect.top}px`;
      tag.style.right = "auto";
      tag.style.bottom = "auto";
    }
  }
}

// Re-aim a straight leader from its dot (the call-out origin) to the near edge of its
// label, so dragging a label keeps the line connected on screen.
function recomputeLeader(bp) {
  if (!NODE_CONFIG[keyOf(bp)]?.autoLeader) {
    return;
  }
  const leader = bp.querySelector(".bp-leader");
  const tag = bp.querySelector(".bp-tag");
  if (!leader || !tag) {
    return;
  }
  const left = parseFloat(tag.style.left) || 0;
  const top = parseFloat(tag.style.top) || 0;
  const width = tag.offsetWidth;
  const height = tag.offsetHeight;
  const connectY = top + height / 2;
  let connectX;
  if (left + width < 0) {
    connectX = left + width; // label sits left of the dot → meet its right edge
  } else if (left > 0) {
    connectX = left; // label sits right of the dot → meet its left edge
  } else {
    connectX = left + width / 2; // overlapping horizontally → meet its centre
  }
  const angle = (Math.atan2(connectY, connectX) * 180) / Math.PI;
  const distance = Math.hypot(connectX, connectY);
  const startGap = 5;
  const endGap = 6;
  leader.style.setProperty("--bp-angle", `${angle.toFixed(1)}deg`);
  leader.style.width = `${Math.max(0, Math.round(distance - startGap - endGap))}px`;
  leader.style.left = `${(Math.cos((angle * Math.PI) / 180) * startGap).toFixed(1)}px`;
  leader.style.top = `${(Math.sin((angle * Math.PI) / 180) * startGap).toFixed(1)}px`;
}

// Emit ready-to-paste CSS for every call-out, in the same em / calc(50% ± px) scheme
// styles.css uses, plus a comment with the raw stage-relative anchor in pixels.
function generateCss(bps, anatomy, wordmark) {
  const fontSize = parseFloat(getComputedStyle(wordmark).fontSize);
  const rect = anatomy.getBoundingClientRect();
  const centerX = rect.width / 2;
  const lines = [
    `/* Tasteprint anatomy — measured at fontSize=${fontSize.toFixed(2)}px, ` +
      `stageW=${Math.round(rect.width)}px, stageH=${Math.round(rect.height)}px */`,
    ""
  ];

  for (const bp of bps) {
    const key = keyOf(bp);
    const config = NODE_CONFIG[key] || { scheme: "word" };
    const anchorX = parseFloat(bp.style.left) || 0;
    const anchorY = parseFloat(bp.style.top) || 0;

    lines.push(`/* ${key} — anchor @ (${Math.round(anchorX)}, ${Math.round(anchorY)}) stage-rel px */`);
    if (config.scheme === "word") {
      lines.push(`.${key} { left: calc(50% ${signEm((anchorX - centerX) / fontSize)}); top: ${(anchorY / fontSize).toFixed(3)}em; }`);
    } else {
      lines.push(`.${key} { left: calc(50% ${signPx(anchorX - centerX)}); bottom: ${Math.round(rect.height - anchorY)}px; }`);
    }
    if (config.bracket) {
      lines.push(`.${key} { width: ${Math.round(bp.offsetWidth)}px; }`);
    }

    const tag = bp.querySelector(".bp-tag");
    if (tag) {
      lines.push(`.${key} .bp-tag { left: ${Math.round(parseFloat(tag.style.left) || 0)}px; top: ${Math.round(parseFloat(tag.style.top) || 0)}px; }`);
    }

    const leader = bp.querySelector(".bp-leader");
    if (leader) {
      const angle = (leader.style.getPropertyValue("--bp-angle") || getComputedStyle(leader).getPropertyValue("--bp-angle") || "0deg").trim();
      lines.push(`.${key} .bp-leader { --bp-angle: ${angle}; width: ${Math.round(leader.offsetWidth)}px; }`);
    }

    if (config.vbracket) {
      const vbracket = bp.querySelector(".bp-vbracket");
      if (vbracket) {
        lines.push(`.${key} .bp-vbracket { height: ${(vbracket.offsetHeight / fontSize).toFixed(3)}em; }`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function capturePointer(event) {
  // setPointerCapture can throw if the pointer isn't active (e.g. synthetic events);
  // it is a nicety, not load-bearing, so never let it break a drag.
  try {
    event.currentTarget.setPointerCapture?.(event.pointerId);
  } catch {
    /* ignore */
  }
}

function keyOf(bp) {
  return [...bp.classList].find((name) => name !== "bp" && name.startsWith("bp-")) || "bp";
}

function signEm(value) {
  return value >= 0 ? `+ ${value.toFixed(3)}em` : `- ${Math.abs(value).toFixed(3)}em`;
}

function signPx(value) {
  const rounded = Math.round(value);
  return rounded >= 0 ? `+ ${rounded}px` : `- ${Math.abs(rounded)}px`;
}

function flash(element, message) {
  element.textContent = message;
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => {
    element.textContent = "";
  }, 2400);
}

function buildPanel(onRefresh) {
  const panel = document.createElement("div");
  panel.className = "ae-panel";
  panel.innerHTML = `
    <h2 class="ae-grip" title="Drag to move this panel">Anatomy editor</h2>
    <p>Drag a <strong>dot handle</strong> to move a call-out · drag a <strong>label</strong> to move it. Then copy.</p>
    <textarea class="ae-out" readonly spellcheck="false"></textarea>
    <div class="ae-row">
      <button class="ae-btn primary ae-copy" type="button">Copy positions</button>
      <button class="ae-btn ghost ae-reset" type="button">Reset</button>
    </div>
    <div class="ae-status" role="status"></div>
  `;
  document.body.appendChild(panel);
  makePanelDraggable(panel, panel.querySelector(".ae-grip"));
  // Re-measure if the window is resized mid-session.
  window.addEventListener("resize", onRefresh);
  return panel;
}

// Let the whole panel be dragged by its title bar so it never blocks a call-out.
function makePanelDraggable(panel, grip) {
  let move = null;
  grip.addEventListener("pointerdown", (event) => {
    const rect = panel.getBoundingClientRect();
    move = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    panel.style.right = "auto";
    capturePointer(event);
    event.preventDefault();
  });
  window.addEventListener("pointermove", (event) => {
    if (!move) {
      return;
    }
    panel.style.left = `${Math.max(0, event.clientX - move.dx)}px`;
    panel.style.top = `${Math.max(0, event.clientY - move.dy)}px`;
  });
  window.addEventListener("pointerup", () => {
    move = null;
  });
}

function injectStyle() {
  if (document.getElementById("anatomy-editor-style")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "anatomy-editor-style";
  style.textContent = `
    .intro-anatomy.is-edit .bp,
    .intro-anatomy.is-edit .bp-leader,
    .intro-anatomy.is-edit .bp-tag,
    .intro-anatomy.is-edit .bp-bracket,
    .intro-anatomy.is-edit .bp-vbracket { transition: none !important; }
    .intro-anatomy.is-edit .bp-tag {
      pointer-events: auto;
      cursor: grab;
      outline: 1px dashed transparent;
      outline-offset: 3px;
    }
    .intro-anatomy.is-edit .bp-tag:hover { outline-color: color-mix(in srgb, var(--primary) 45%, transparent); }
    .ae-handle {
      position: absolute;
      left: -13px;
      top: -13px;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      pointer-events: auto;
      cursor: grab;
      z-index: 2;
    }
    .ae-handle:hover { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--primary) 55%, transparent); }
    .ae-handle:active { cursor: grabbing; }
    .ae-panel {
      position: fixed;
      left: 16px;
      top: 16px;
      z-index: 99999;
      width: 320px;
      padding: 14px;
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #dededa;
      box-shadow: 0 16px 48px rgba(20, 21, 23, 0.16);
      color: #1c1c1f;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .ae-panel h2 { margin: 0 0 6px; font-size: 13px; font-weight: 650; }
    .ae-grip { cursor: move; user-select: none; }
    .ae-panel p { margin: 0 0 10px; font-size: 12px; line-height: 1.5; color: #6d7078; }
    .ae-panel p strong { color: #1c1c1f; font-weight: 600; }
    .ae-out {
      width: 100%;
      height: 200px;
      resize: vertical;
      box-sizing: border-box;
      padding: 9px;
      border: 1px solid #e4e4e0;
      border-radius: 8px;
      background: #fafafa;
      color: #222;
      font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      line-height: 1.45;
    }
    .ae-row { display: flex; gap: 8px; margin-top: 10px; }
    .ae-btn { flex: 1; border: 0; border-radius: 8px; padding: 9px 10px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .ae-btn.primary { background: #5e6ad2; color: #fff; }
    .ae-btn.primary:hover { background: #7480ea; }
    .ae-btn.ghost { background: #efefec; color: #222; }
    .ae-btn.ghost:hover { background: #e5e5e1; }
    .ae-status { margin-top: 8px; min-height: 16px; font-size: 12px; font-weight: 600; color: #1f9d78; }
  `;
  document.head.appendChild(style);
}
