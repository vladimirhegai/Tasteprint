# DESIGN.md

## Product

**Tasteprint** is an open-source onboarding tool that helps builders create a personal `DESIGN.md` for their app.

The user gives a product info dump, answers guided questions, picks reference apps, explains what they like about those references, then receives a project-specific design system that can be used by Claude Code, Gemini CLI, Codex CLI, Cursor, and other AI coding agents.

## Design Thesis

Tasteprint should feel like a calm design director interviewing the user.

It should not feel like a generic SaaS setup wizard.

The interface should be premium, quiet, precise, and useful. It should make the user feel like their rough taste is being turned into a serious design artifact.

The product’s core feeling:

> Apple’s restraint, Linear’s precision, Stripe’s soft technical polish, and Runway’s editorial confidence, without directly copying any brand.

## Personality

### Primary Traits

* Premium
* Calm
* Precise
* Editorial
* Technical
* Tasteful
* Focused
* Trustworthy

### Secondary Traits

* Creative
* Opinionated
* Minimal
* Agent-native
* Slightly cinematic

### Avoid

* Generic SaaS gradients
* Loud rainbow design
* Childish onboarding
* Crypto/Web3 visual language
* Overly playful mascot branding
* Dense admin-dashboard feeling
* Looking like a clone of Apple, Linear, Stripe, or Runway
* Too many colors
* Too many cards
* Too much copy per screen

## Core Design Rule

One screen, one decision.

Tasteprint onboarding should never show a giant form. It should guide the user through a sequence of small, high-quality decisions.

Each screen should feel intentional:

1. Ask one sharp question.
2. Give just enough context.
3. Let the user answer quickly.
4. Move forward with a subtle, premium transition.

## Inspiration

### Apple

Use Apple as the base for premium restraint.

Borrow:

* Spacious layouts
* Calm hierarchy
* Near-invisible UI
* Large confident headings
* Minimal color usage
* Single clear primary action
* Product-as-artifact feeling

Do not copy:

* Apple’s exact typography
* Product tile layouts too literally
* Blue CTA system exactly
* Consumer hardware showroom feeling

### Linear

Use Linear for precision and technical credibility.

Borrow:

* Dark graphite surfaces
* Tight product UI framing
* Hairline borders
* Compact controls
* Sparse accent color
* Sharp typography
* Keyboard-first product feeling

Do not copy:

* Full Linear dark marketing page
* Lavender everywhere
* Issue-tracker visual language
* Overly dense product screenshots

### Stripe

Use Stripe lightly for soft technical polish.

Borrow:

* Indigo as a premium technical accent
* Smooth atmospheric gradients in rare moments
* Thin elegant type feeling
* Clear transactional CTAs
* Soft product mockup depth

Do not copy:

* Big colorful gradient mesh as the whole brand
* Fintech dashboard language
* Multiple bright gradient stops everywhere

### Runway

Use Runway for editorial confidence.

Borrow:

* Cinematic pacing
* Strong black/white contrast
* Editorial section rhythm
* Minimal decoration
* Serious creative-tool tone

Do not copy:

* Full film-festival aesthetic
* Overly austere monochrome
* Photography-heavy pages unless needed

## Visual Direction

### Name

Quiet Premium

### Description

A premium onboarding interface that feels like a guided design consultation. The UI is calm and sparse, with strong typography, controlled whitespace, subtle graphite panels, and a single indigo accent. The experience should feel designed, not generated.

### One-Sentence Style Prompt

Design Tasteprint as a quiet premium onboarding tool: spacious like Apple, precise like Linear, softly technical like Stripe, and editorial like Runway.

## Color System

### Brand Colors

```yaml
colors:
  canvas: "#F7F7F5"
  canvas_pure: "#FFFFFF"
  canvas_warm: "#F3F1EC"

  graphite_950: "#0B0B0D"
  graphite_900: "#111114"
  graphite_850: "#17171B"
  graphite_800: "#1F2024"
  graphite_700: "#2A2B31"

  ink: "#151517"
  ink_soft: "#2B2C30"
  ink_muted: "#6D7078"
  ink_subtle: "#9A9EA8"
  ink_on_dark: "#F6F6F4"
  ink_on_dark_muted: "#B8BCC7"

  hairline: "#E1E1DD"
  hairline_strong: "#C9CAC4"
  hairline_dark: "#2B2C31"

  primary: "#5E6AD2"
  primary_hover: "#7480EA"
  primary_pressed: "#4C55B8"
  primary_soft: "#ECEEFF"
  primary_glow: "rgba(94, 106, 210, 0.18)"

  success: "#27A664"
  warning: "#C9862B"
  danger: "#D94A4A"
```

### Usage

* Use `canvas` as the default onboarding background.
* Use `canvas_pure` for focused input areas and preview cards.
* Use `graphite_950` for cinematic intro screens, final preview screens, and code/document preview panels.
* Use `primary` only for the main CTA, selected states, progress highlights, and focus rings.
* Do not introduce a second brand accent.
* Do not use decorative rainbow gradients.
* Use gradients only as a rare atmospheric finish on completion screens.

### Primary Gradient

Use this only in hero or completion moments:

```yaml
gradients:
  premium_wash:
    type: radial-layered
    colors:
      - "rgba(94, 106, 210, 0.20)"
      - "rgba(180, 160, 255, 0.12)"
      - "rgba(255, 255, 255, 0)"
```

The gradient should feel like light in the room, not a startup background.

## Typography

### Font Stack

```yaml
typography:
  sans:
    family: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  mono:
    family: "Geist Mono, JetBrains Mono, SFMono-Regular, ui-monospace, Menlo, monospace"
```

Use Inter as the default open-source font. Geist Sans is also acceptable. Do not use playful or rounded startup fonts.

### Type Scale

```yaml
typography:
  display:
    size: "56px"
    weight: 600
    line_height: 1.04
    letter_spacing: "-0.045em"

  hero:
    size: "44px"
    weight: 600
    line_height: 1.08
    letter_spacing: "-0.035em"

  title:
    size: "32px"
    weight: 600
    line_height: 1.12
    letter_spacing: "-0.025em"

  question:
    size: "28px"
    weight: 600
    line_height: 1.18
    letter_spacing: "-0.022em"

  lead:
    size: "18px"
    weight: 400
    line_height: 1.55
    letter_spacing: "-0.01em"

  body:
    size: "16px"
    weight: 400
    line_height: 1.55
    letter_spacing: "-0.005em"

  body_strong:
    size: "16px"
    weight: 600
    line_height: 1.45
    letter_spacing: "-0.005em"

  caption:
    size: "13px"
    weight: 400
    line_height: 1.45
    letter_spacing: "0"

  eyebrow:
    size: "12px"
    weight: 600
    line_height: 1.2
    letter_spacing: "0.08em"
    text_transform: uppercase

  button:
    size: "14px"
    weight: 600
    line_height: 1.2
    letter_spacing: "-0.005em"

  mono:
    size: "13px"
    weight: 400
    line_height: 1.55
    letter_spacing: "-0.01em"
```

### Typography Rules

* Use negative letter-spacing on large headings.
* Use weight 600 for headings, not 700 or 800.
* Body copy should feel calm and readable.
* Eyebrows should be uppercase, but use them rarely.
* Monospace is only for file paths, CLI commands, generated markdown previews, and agent names.
* Do not use more than two font families.

## Layout

### Spacing

```yaml
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  section: "80px"
  section_lg: "112px"
```

### Layout Rules

* Use an 8px base grid.
* Onboarding screens should be centered and narrow.
* Default content width for question screens: 680px.
* Wider preview screens can use 960px to 1120px.
* Avoid full dashboard layouts during onboarding.
* Never show more than one major decision at a time.
* Use vertical rhythm instead of visual clutter.

### App Frame

Tasteprint should use a minimal app shell:

* Top-left wordmark.
* Top-right small utility actions: `Exit`, `Skip`, or `Docs`.
* Centered onboarding content.
* Bottom area reserved for progress and navigation.
* No heavy sidebar during onboarding.

## Surface System

```yaml
surfaces:
  page:
    background: "{colors.canvas}"
    color: "{colors.ink}"

  elevated:
    background: "{colors.canvas_pure}"
    border: "1px solid {colors.hairline}"
    radius: "{radii.xl}"

  dark_panel:
    background: "{colors.graphite_950}"
    color: "{colors.ink_on_dark}"
    border: "1px solid {colors.hairline_dark}"
    radius: "{radii.xl}"

  soft_panel:
    background: "{colors.canvas_warm}"
    border: "1px solid rgba(21, 21, 23, 0.06)"
    radius: "{radii.xl}"

  selected:
    background: "{colors.primary_soft}"
    border: "1px solid rgba(94, 106, 210, 0.38)"
    radius: "{radii.xl}"
```

## Radius

```yaml
radii:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "18px"
  xxl: "28px"
  pill: "9999px"
```

### Radius Rules

* Use `xl` for reference cards and choice cards.
* Use `md` for inputs.
* Use `pill` only for primary CTAs, compact tags, and progress chips.
* Avoid over-rounding everything.
* Never use playful bubble shapes.

## Elevation

```yaml
shadows:
  none: "none"
  soft: "0 1px 2px rgba(15, 15, 18, 0.04), 0 8px 32px rgba(15, 15, 18, 0.06)"
  panel: "0 24px 80px rgba(15, 15, 18, 0.10)"
  glow_primary: "0 0 0 6px rgba(94, 106, 210, 0.12)"
```

### Elevation Rules

* Default to hairline borders, not shadows.
* Use `soft` shadow only for floating preview cards.
* Use `panel` shadow only in final reveal or modal states.
* Never use glow effects except for subtle focus states.
* No neumorphism.
* No heavy SaaS card shadows.

## Motion

### Timing

```yaml
motion:
  fast: "120ms"
  base: "180ms"
  slow: "280ms"
  ease: "cubic-bezier(0.16, 1, 0.3, 1)"
```

### Motion Rules

* Transitions should feel precise and quiet.
* Question changes should slide/fade by 8 to 12px.
* Selected cards should lift by 1 to 2px max.
* Buttons may scale to 0.98 on press.
* Completion reveal may use a slower fade and slight upward motion.
* No bounce.
* No confetti by default.
* Respect `prefers-reduced-motion`.

## Components

### Button Primary

```yaml
button_primary:
  background: "{colors.primary}"
  color: "#FFFFFF"
  radius: "{radii.pill}"
  padding: "10px 18px"
  height: "40px"
  font: "{typography.button}"
  hover:
    background: "{colors.primary_hover}"
  pressed:
    background: "{colors.primary_pressed}"
    transform: "scale(0.98)"
  focus:
    outline: "2px solid {colors.primary}"
    outline_offset: "3px"
```

Usage:

* Continue
* Generate DESIGN.md
* Install agent instructions
* Save changes

Only one primary button should appear in a viewport.

### Button Secondary

```yaml
button_secondary:
  background: "{colors.canvas_pure}"
  color: "{colors.ink}"
  border: "1px solid {colors.hairline}"
  radius: "{radii.pill}"
  padding: "10px 16px"
  height: "40px"
```

Usage:

* Back
* Edit
* Preview
* Skip

### Choice Card

Used for vibe words, product types, and design directions.

```yaml
choice_card:
  background: "{colors.canvas_pure}"
  border: "1px solid {colors.hairline}"
  radius: "{radii.xl}"
  padding: "{spacing.lg}"
  hover:
    border: "1px solid {colors.hairline_strong}"
    transform: "translateY(-1px)"
  selected:
    background: "{colors.primary_soft}"
    border: "1px solid rgba(94, 106, 210, 0.38)"
```

Rules:

* Choice cards should be readable in 2 seconds.
* Use short titles and one-line descriptions.
* Selected states should feel calm, not loud.
* Avoid checkmarks unless selection is ambiguous.

### Reference Card

Used for Apple, Linear, Stripe, Runway, Vercel, Raycast, Nvidia, etc.

```yaml
reference_card:
  background: "{colors.canvas_pure}"
  border: "1px solid {colors.hairline}"
  radius: "{radii.xl}"
  padding: "{spacing.md}"
  preview_area:
    height: "140px"
    radius: "{radii.lg}"
    background: "{colors.canvas_warm}"
  title:
    font: "{typography.body_strong}"
  description:
    font: "{typography.caption}"
    color: "{colors.ink_muted}"
```

Rules:

* Reference cards should show mood, not screenshots that imply copying.
* Use abstract previews: surface, type, spacing, and color hints.
* Ask what the user likes about each selected reference.
* Never treat brand references as clone targets.

### Question Screen

```yaml
question_screen:
  max_width: "680px"
  align: "center"
  vertical_padding: "{spacing.section}"
  eyebrow:
    font: "{typography.eyebrow}"
    color: "{colors.ink_muted}"
  title:
    font: "{typography.question}"
  helper:
    font: "{typography.lead}"
    color: "{colors.ink_muted}"
```

Rules:

* One question per screen.
* Helper copy should be short.
* Do not exceed 2 lines of helper copy.
* Use examples when the question is abstract.

### Freeform Input

```yaml
freeform_input:
  background: "{colors.canvas_pure}"
  border: "1px solid {colors.hairline}"
  radius: "{radii.xl}"
  padding: "{spacing.lg}"
  min_height: "144px"
  font: "{typography.body}"
  placeholder_color: "{colors.ink_subtle}"
  focus:
    border: "1px solid {colors.primary}"
    box_shadow: "{shadows.glow_primary}"
```

Usage:

* Product info dump
* “What do you like about this?”
* Anti-inspiration
* Final edit prompt

### Progress

Progress should be language-based, not a generic numbered stepper.

```text
Context → Taste → References → Direction → DESIGN.md
```

Rules:

* Use small text and subtle dividers.
* Active step uses `primary`.
* Completed steps use `ink`.
* Upcoming steps use `ink_subtle`.

### Design Direction Card

Used when Tasteprint generates 3 possible directions.

```yaml
design_direction_card:
  background: "{colors.canvas_pure}"
  border: "1px solid {colors.hairline}"
  radius: "{radii.xxl}"
  padding: "{spacing.xl}"
  title:
    font: "{typography.title}"
  thesis:
    font: "{typography.body}"
    color: "{colors.ink_muted}"
  tags:
    radius: "{radii.pill}"
    background: "{colors.canvas_warm}"
```

Rules:

* Generate 3 directions max.
* Each direction needs a name, one-sentence thesis, good-for line, and avoid line.
* The user should be able to mix directions.

### DESIGN.md Preview

```yaml
design_md_preview:
  background: "{colors.graphite_950}"
  color: "{colors.ink_on_dark}"
  border: "1px solid {colors.hairline_dark}"
  radius: "{radii.xxl}"
  padding: "{spacing.xl}"
  font: "{typography.mono}"
```

Rules:

* Preview should feel like a crafted artifact.
* Show the most important sections first:

  * Design Thesis
  * Colors
  * Typography
  * Components
  * Agent Instructions
* Use syntax highlighting very subtly.
* Do not make the code preview visually louder than the onboarding.

## Onboarding Flow

### 1. Welcome

Goal: Make the product feel premium immediately.

Title:

> Create the design file your AI agent should have asked for.

Subtitle:

> Tasteprint interviews you, learns your taste, and generates a project-specific DESIGN.md for Claude, Gemini, Codex, Cursor, and other AI coding tools.

Primary CTA:

> Start

Secondary CTA:

> View example

Visual:

A dark `DESIGN.md` preview card floating on a quiet off-white canvas.

### 2. Product Dump

Question:

> What are you building?

Input placeholder:

> Paste your messy product description here. Features, audience, vibe, competitors, screenshots, anything.

Rules:

* Encourage messy input.
* Do not make the user organize it yet.
* The interface should make a chaotic info dump feel safe.

### 3. Product Type

Question:

> What kind of product is this?

Options:

* SaaS app
* Developer tool
* AI product
* Creative tool
* Marketplace
* Mobile app
* Internal tool
* Other

### 4. Audience

Question:

> Who is this for?

Options should be editable.

Examples:

* Founders
* Developers
* Designers
* Marketers
* Product teams
* Enterprise buyers
* Consumers
* Power users

### 5. Vibe Selection

Question:

> How should it feel?

Let the user pick up to 3:

* Premium
* Minimal
* Technical
* Creative
* Calm
* Fast
* Editorial
* Dense
* Spacious
* Futuristic
* Trustworthy
* Playful
* Sharp
* Warm

### 6. Anti-Vibe

Question:

> What should it not feel like?

Options:

* Generic SaaS
* Too playful
* Corporate
* Crypto
* Childish
* Too colorful
* Too empty
* Too dense
* Apple clone
* Linear clone
* Startup template
* Dashboard sludge

### 7. Reference Selection

Question:

> Pick references that match your taste.

Show grouped references:

* Premium: Apple, Stripe, Linear, Vercel
* Technical: Nvidia, GitHub, Raycast, Warp
* Creative: Runway, Framer, Figma, Webflow
* Editorial: WIRED, The Verge, Runway
* Dark: Linear, Superhuman, Raycast, Nvidia

Rules:

* Let users pick 2 to 5.
* Show abstract style previews.
* Avoid implying brand copying.

### 8. Taste Clarification

For each selected reference, ask:

> What do you like about this?

Options:

* Typography
* Spacing
* Color
* Motion
* Layout
* Density
* Mood
* Buttons
* Product screenshots
* Editorial tone
* Dark mode
* Minimalism

Then provide freeform:

> Anything specific?

### 9. Generate Directions

Tasteprint should generate 3 directions.

Example:

1. Quiet Premium
   Calm, spacious, polished, editorial. Best for serious SaaS and AI tools.

2. Graphite Studio
   Dark, precise, technical, creative. Best for agent tools and power-user workflows.

3. Soft Technical
   Light canvas, subtle indigo, refined gradients. Best for onboarding and trust-building.

Rules:

* The user picks one.
* The user can mix them.
* The user can give a final adjustment prompt.

### 10. Final Preview

Show:

* Design thesis
* Color palette
* Typography
* Reference interpretation
* Component rules
* Agent instructions

Primary CTA:

> Create DESIGN.md

Secondary CTAs:

> Edit direction
> Regenerate
> Copy summary

### 11. Agent Installation

Question:

> Where should Tasteprint install this?

Options:

* `DESIGN.md`
* `CLAUDE.md`
* `AGENTS.md`
* `GEMINI.md`
* `.cursor/rules`
* Codex instructions
* Copy only

Agent pointer text:

```md
When making frontend or UX changes, read ./DESIGN.md first.
Follow its typography, colors, spacing, layout, component, and motion rules.
If the user asks for a design change that conflicts with DESIGN.md, ask before changing the design direction.
```

## Agent Instructions

When generating UI for Tasteprint:

### Always

* Keep the interface calm and premium.
* Use one primary action per screen.
* Use generous whitespace.
* Use tight, confident typography.
* Use hairline borders and tonal surface changes.
* Keep accent color scarce.
* Make the final `DESIGN.md` feel like an artifact.
* Treat brand references as inspiration attributes, not clone targets.
* Let users explain taste in plain language.

### Never

* Create a generic dashboard onboarding flow.
* Use loud gradients behind every section.
* Add playful illustrations unless explicitly requested.
* Add mascots.
* Use more than one accent color.
* Use heavy shadows.
* Use bouncy motion.
* Center long paragraphs.
* Make the user answer 20 questions before seeing value.
* Copy Apple, Linear, Stripe, Runway, or any other brand directly.

## Copywriting Voice

Tasteprint should speak like a calm senior designer.

### Voice

* Clear
* Direct
* Slightly editorial
* Helpful
* Confident
* Not cute
* Not corporate

### Good Copy

> Paste the messy version. Tasteprint will structure it.

> Pick references for taste, not imitation.

> What should your app never look like?

> Here are three directions your product could take.

> Your DESIGN.md is ready.

### Bad Copy

> Let’s make something awesome!

> Supercharge your design workflow with AI magic.

> Choose your vibe aesthetic!

> Unlock premium design in seconds.

## Accessibility

* Maintain WCAG AA contrast for all text.
* Touch targets should be at least 40px, preferably 44px on mobile.
* Keyboard navigation must work for all cards and options.
* Selected cards need both visual and semantic state.
* Do not rely on color alone for selection.
* Respect reduced motion.
* Inputs need clear labels, not placeholder-only labels.

## Responsive Behavior

### Desktop

* Center onboarding content.
* Reference cards can use 3 columns.
* Preview screens can use 2 columns: summary left, `DESIGN.md` preview right.

### Tablet

* Reference cards use 2 columns.
* Preview stacks vertically.
* Keep bottom navigation sticky.

### Mobile

* Single-column layout.
* Larger tap targets.
* Reduce display size from 56px to 36px.
* Hide non-essential navigation.
* Keep primary CTA visible at bottom.

## Implementation Notes

### CSS Variables

Use semantic variables:

```css
:root {
  --canvas: #F7F7F5;
  --canvas-pure: #FFFFFF;
  --canvas-warm: #F3F1EC;

  --graphite-950: #0B0B0D;
  --graphite-900: #111114;
  --graphite-850: #17171B;

  --ink: #151517;
  --ink-muted: #6D7078;
  --ink-subtle: #9A9EA8;
  --ink-on-dark: #F6F6F4;

  --hairline: #E1E1DD;
  --hairline-dark: #2B2C31;

  --primary: #5E6AD2;
  --primary-hover: #7480EA;
  --primary-pressed: #4C55B8;
  --primary-soft: #ECEEFF;

  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 18px;
  --radius-xxl: 28px;
  --radius-pill: 9999px;
}
```

### Tailwind Mapping

Recommended theme direction:

```js
colors: {
  canvas: "var(--canvas)",
  "canvas-pure": "var(--canvas-pure)",
  "canvas-warm": "var(--canvas-warm)",
  graphite: {
    950: "var(--graphite-950)",
    900: "var(--graphite-900)",
    850: "var(--graphite-850)",
  },
  ink: {
    DEFAULT: "var(--ink)",
    muted: "var(--ink-muted)",
    subtle: "var(--ink-subtle)",
    inverse: "var(--ink-on-dark)",
  },
  primary: {
    DEFAULT: "var(--primary)",
    hover: "var(--primary-hover)",
    pressed: "var(--primary-pressed)",
    soft: "var(--primary-soft)",
  },
  hairline: {
    DEFAULT: "var(--hairline)",
    dark: "var(--hairline-dark)",
  },
}
```

## Example Final Screen

The final screen should feel like a quiet reveal.

Layout:

* Dark graphite preview card centered on warm canvas.
* Title: `Your DESIGN.md is ready.`
* Subtitle: `Tasteprint turned your product context, references, and taste notes into an agent-readable design system.`
* Primary CTA: `Copy DESIGN.md`
* Secondary CTA: `Install agent files`
* Small action: `Edit direction`

Do not use confetti. Use a subtle fade-in and a soft primary glow behind the preview card.

## Definition of Good

Tasteprint’s design is successful if a user thinks:

> This feels like a serious design tool, not a random AI wrapper.

And:

> I did not know how to describe my taste, but now I have a design system my coding agent can follow.
