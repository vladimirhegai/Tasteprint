import assert from "node:assert/strict";
import test from "node:test";
import {
  contrastRatio,
  createColorSystem,
  createColorToolPrompt,
  createThemeColorTokens,
  isSafeCssColor,
  suggestThirdColor
} from "../src/colorTools.js";
import { loadReferenceColorLibrary } from "../src/referenceLibrary.js";

test("color system repairs light accents and chooses readable text on accent", () => {
  const system = createColorSystem({ primary: "#76B900", dark: false });

  assert.ok(system.contrast.primaryOnCanvas >= 3);
  assert.ok(system.contrast.primaryInkOnPrimary >= 4.5);
  assert.notEqual(system.tokens.primaryInk, "#FFFFFF");
});

test("theme color tokens expose UI-ready accent states", () => {
  const theme = createThemeColorTokens({ primary: "#FFE066", dark: false });

  assert.match(theme.primarySoft, /^#[0-9A-F]{6}$/);
  assert.match(theme.primaryHover, /^#[0-9A-F]{6}$/);
  assert.match(theme.hairlineStrong, /^#[0-9A-F]{6}$/);
  assert.ok(contrastRatio(theme.primaryInk, theme.primary) >= 4.5);
  assert.ok(contrastRatio(theme.primaryInk, theme.primaryHover) >= 4.5);
});

test("third color suggestion stays distinct and contrast-checked", () => {
  const suggestion = suggestThirdColor("#5E6AD2", "#2A2B31", {
    dark: false,
    background: "#F7F7F5"
  });

  assert.match(suggestion.hex, /^#[0-9A-F]{6}$/);
  assert.notEqual(suggestion.hex, "#5E6AD2");
  assert.ok(contrastRatio(suggestion.hex, "#F7F7F5") >= 3);
});

test("CSS color safety rejects inline-style injection values", () => {
  assert.equal(isSafeCssColor("#5E6AD2"), true);
  assert.equal(isSafeCssColor("oklch(62% 0.19 262)"), true);
  assert.equal(isSafeCssColor("#fff; background: red"), false);
});

test("color tool can mine selected awesome-design references", async () => {
  const packageRootUrl = new URL("../", import.meta.url);
  const library = await loadReferenceColorLibrary(["apple", "linear", "stripe", "nvidia"], packageRootUrl);
  const system = createColorSystem({
    primary: "#5E6AD2",
    dark: true,
    referenceLibrary: library
  });
  const prompt = createColorToolPrompt({
    primary: "#5E6AD2",
    dark: true,
    referenceLibrary: library
  });

  assert.equal(library.length, 4);
  assert.ok(library.some((reference) => reference.colors.length > 0));
  assert.ok(system.referenceSeed);
  assert.match(prompt, /referenceColorLibrary/);
});
