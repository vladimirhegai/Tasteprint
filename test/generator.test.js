import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createDesignMd,
  createFallbackDirections,
  createPlanFromState,
  createSkillMd,
  uniqueOutputPath,
  validateDesignMd,
  validateSkillMd,
  writeGeneratedFiles
} from "../src/generator.js";

const sampleState = {
  intake: "Tasteprint is an onboarding tool for founders and product teams that generates DESIGN.md and SKILL.md files for AI coding agents.",
  intakeAnswers: {
    productType: "Developer tool",
    audience: "Founders, product teams, and builders"
  },
  personality: ["Premium", "Technical", "Calm"],
  avoid: ["Generic SaaS", "Apple clone", "Too colorful"],
  references: ["apple", "linear", "stripe"],
  referenceLikes: {
    apple: { selected: ["Spacing", "Premium feel"], note: "Use restraint, not the showroom style." },
    linear: { selected: ["Interface density", "Hairline borders"], note: "" },
    stripe: { selected: ["Soft technical polish"], note: "Keep gradients rare." }
  },
  directions: [
    {
      id: "direction-a",
      name: "Quiet Premium",
      thesis: "Tasteprint should feel like a calm design director for agent-native product teams.",
      goodFor: "Premium local tools and AI-assisted onboarding.",
      avoid: "Generic SaaS gradients.",
      tags: ["Premium", "Technical", "Calm"]
    }
  ],
  selectedDirections: ["direction-a"],
  optionalAdditions: ["More premium"]
};

test("generated DESIGN.md follows the expected section order", () => {
  const plan = createPlanFromState(sampleState);
  const designMd = createDesignMd(sampleState, plan);
  const validation = validateDesignMd(designMd);

  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.match(designMd, /^---\nversion: alpha/m);
  assert.match(designMd, /## Overview[\s\S]*## Colors[\s\S]*## Typography[\s\S]*## Layout[\s\S]*## Elevation & Depth[\s\S]*## Shapes[\s\S]*## Components[\s\S]*## Do's and Don'ts/);
});

test("fallback directions carry an expanded palette for dev:local theming", () => {
  const directions = createFallbackDirections(sampleState);

  assert.equal(directions.length, 3);
  for (const direction of directions) {
    assert.match(direction.accentHex, /^#[0-9A-Fa-f]{6}$/, `accentHex on ${direction.id}`);
    assert.equal(typeof direction.dark, "boolean");
    assert.ok(direction.colors, `colors on ${direction.id}`);
    assert.match(direction.colors.primary, /^#[0-9A-Fa-f]{6}$/, `colors.primary on ${direction.id}`);
    assert.match(direction.colors.canvas, /^#[0-9A-Fa-f]{6}$/, `colors.canvas on ${direction.id}`);
  }
});

test("locked direction palette flows into generated DESIGN.md colors", () => {
  const locked = createFallbackDirections(sampleState)[1];
  const state = { ...sampleState, lockedDirection: locked };
  const designMd = createDesignMd(state, createPlanFromState(state));

  assert.equal(validateDesignMd(designMd).valid, true);
  assert.ok(designMd.includes(`primary: "${locked.colors.primary}"`));
});

test("generated SKILL.md keeps Codex-compatible frontmatter", () => {
  const plan = createPlanFromState(sampleState);
  const skillMd = createSkillMd(sampleState, plan);
  const validation = validateSkillMd(skillMd);

  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.match(skillMd, /^---\nname: .+\ndescription: .+\n---/m);
  assert.doesNotMatch(skillMd.split("---")[1], /license:|metadata:/);
});

test("copy-safe output paths avoid overwriting existing files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tasteprint-"));
  try {
    await writeFile(join(dir, "DESIGN.md"), "existing", "utf8");
    await writeFile(join(dir, "SKILL.md"), "existing", "utf8");

    assert.equal(await uniqueOutputPath(join(dir, "DESIGN.md")), join(dir, "DESIGN-copy.md"));

    const plan = createPlanFromState(sampleState);
    const files = await writeGeneratedFiles(dir, {
      designMd: createDesignMd(sampleState, plan),
      skillMd: createSkillMd(sampleState, plan)
    });

    assert.equal(files.designPath, join(dir, "DESIGN-copy.md"));
    assert.equal(files.skillPath, join(dir, "SKILL-copy.md"));

    const writtenDesign = await readFile(files.designPath, "utf8");
    assert.match(writtenDesign, /^---\nversion: alpha/m);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
