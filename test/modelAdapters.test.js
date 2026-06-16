import assert from "node:assert/strict";
import test from "node:test";
import { detectModels, invokeModel } from "../src/modelAdapters.js";

test("local-only mode exposes normal-looking model options", () => {
  const models = detectModels({ localOnly: true });

  assert.ok(models.length >= 3);
  assert.ok(models.some((model) => model.id === "codex"));
  assert.ok(models.some((model) => model.id === "claude"));
  assert.ok(models.every((model) => model.available));
  assert.ok(models.filter((model) => !model.fallback).every((model) => model.localOnly));
});

test("showcased CLIs stay selectable but report PATH presence via installed", () => {
  const models = detectModels({ localOnly: true });
  // dev:local treats every showcased CLI as installed so no popup interrupts the demo.
  for (const id of ["codex", "claude", "gemini"]) {
    const model = models.find((item) => item.id === id);
    assert.ok(model, `${id} should be offered`);
    assert.equal(model.available, true);
    assert.equal(model.installed, true);
  }
});

test("--unavailable forces a model to report as not installed for the gate", () => {
  const models = detectModels({ localOnly: true, unavailable: ["claude"] });
  const claude = models.find((model) => model.id === "claude");
  assert.ok(claude);
  // Still selectable (its world can be previewed) but flagged uninstalled so the gate fires.
  assert.equal(claude.available, true);
  assert.equal(claude.installed, false);
  // Other showcased CLIs are unaffected.
  assert.equal(models.find((model) => model.id === "codex").installed, true);
});

test("claude variants drop Fable and use bare tier labels", () => {
  const claude = detectModels({ localOnly: true }).find((model) => model.id === "claude");
  const labels = claude.variants.map((variant) => variant.label);
  assert.ok(labels.includes("Opus"));
  assert.ok(labels.includes("Sonnet"));
  assert.ok(labels.includes("Haiku"));
  assert.ok(!labels.some((label) => /fable/i.test(label)));
});

test("local-only selections never invoke external CLIs", async () => {
  const [primary] = detectModels({ localOnly: true }).filter((model) => !model.fallback);
  const result = await invokeModel({
    ...primary,
    variant: primary.variants[0],
    thinking: primary.thinkingOptions[0],
    localOnly: true
  }, "Return JSON only.");

  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
  assert.equal(result.localOnly, true);
  assert.equal(result.warning, null);
});
