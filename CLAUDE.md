# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page marketing site for **Meridian & Co.**, a fictional marketing consultancy. Built as a teaching/demo artefact: static HTML, CSS and vanilla JS with **no frameworks, no build step, no package manager, and no dependencies** beyond one Google Font `<link>`.

All company details, statistics and testimonials are invented placeholder copy. Treat them as such — don't present them as real, and flag them if the site is ever headed somewhere public.

## Running and verifying

There is no build, no linter, no test suite. Do not introduce npm, a bundler, or a framework without asking first — "opens directly from the filesystem" is a deliberate constraint, and relative asset paths must keep working over `file://`.

```powershell
# Run it: just open the file
start index.html

# Syntax gate for the JS (the closest thing to a test here)
node --check script.js

# Only if something needs a real origin (it currently doesn't)
python -m http.server 8000
```

Verification is manual: open the page, check 375 / 768 / 1280px widths, tab through with the mouse untouched, and submit the form both empty and valid.

## Architecture

Three files, strictly separated — markup in `index.html`, all styling in `styles.css`, all behaviour in `script.js`. Keep it that way; no inline styles or handlers.

### styles.css — token-driven, mobile-first

Every colour, space, radius and shadow is a custom property on `:root`. **Use the tokens; don't write ad-hoc pixel or hex values** — spacing comes from the `--space-1`…`--space-6` scale. A `prefers-color-scheme: dark` block re-points the same variables, so anything built from tokens gets dark mode for free and anything hard-coded breaks it.

Other conventions that are load-bearing:

- **Every media query is `min-width`.** Base styles are the phone layout. Adding a `max-width` query inverts the cascade this file depends on.
- `color-mix()` is always preceded by a plain-colour fallback declaration on the same property. Preserve that pairing.
- A `prefers-reduced-motion` block kills all transitions/animations and the card hover lift. New motion must be covered by it.
- `scroll-padding-top` is keyed to `--nav-h` so anchor targets clear the sticky nav — changing the nav height means changing that token, not the padding.

### script.js — nav toggle + form

Wrapped in an IIFE, loaded with `defer`. Two independent concerns: the mobile nav toggle, and the enquiry form.

**The form's cross-file contract** is the main thing to understand. Validation is driven by a `rules` object keyed by *element id*:

```
<input id="email">  ←→  rules.email  ←→  <p id="email-error" role="alert">
```

`showError()` finds the error paragraph by convention (`field.id + '-error'`) and toggles `aria-invalid`. So **adding a required field means three coordinated edits**: the input in `index.html`, a matching `id="<fieldId>-error"` paragraph next to it, and a rule function in `script.js`. A field with no rule entry is treated as optional (this is why `company` validates silently).

The form carries `novalidate` — the custom JS owns validation entirely, so browser-native bubbles never appear.

### Two gotchas worth not re-discovering

1. **Demo mode is intentional.** `FORMSPREE_ENDPOINT` at the top of `script.js` still contains the `{YOUR_FORM_ID}` placeholder. `IS_PLACEHOLDER` detects this and short-circuits submission — it logs the payload and fakes success instead of POSTing, because a real request to the placeholder URL would 404 and make the form impossible to demo. The live `fetch()` path below it is fully wired and runs as soon as a real form ID is pasted in. Don't "fix" the missing network call by deleting the branch unless a real endpoint is being added.

2. **Read inputs via `form.elements.name`, never `form.name`.** `HTMLFormElement.name` reflects the form's own attribute and shadows the named-input getter, so `form.name.value` throws.

## Accessibility baseline

The page already has: a skip link, landmark elements, `aria-labelledby` on each section, `aria-expanded`/`aria-controls` on the nav toggle, `role="alert"` error paragraphs, an `aria-live` status region, 48px minimum touch targets, `:focus-visible` rings, and `aria-hidden` on decorative glyphs. Card hover lifts also fire on `:focus-within` so they aren't mouse-only. Match this bar in new work rather than adding it back later.
