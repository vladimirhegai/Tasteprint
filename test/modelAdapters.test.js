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
