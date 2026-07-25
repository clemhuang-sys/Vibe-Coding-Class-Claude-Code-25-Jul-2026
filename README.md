# Meridian &amp; Co. — Marketing Consultancy

A single-page marketing site built for a Claude Code class: static HTML, CSS and vanilla
JavaScript with **no frameworks, no build step, no package manager and no dependencies**
beyond one Google Font.

**Live:** https://clemhuang-sys.github.io/Vibe-Coding-Class-Claude-Code-25-Jul-2026/

> **Meridian &amp; Co. is fictional.** Every company detail, statistic and testimonial on the
> page — the "3.8× return", the "60+ brands", the three named clients — is invented
> placeholder copy written to fill the layout. Replace it before this is used for anything
> real.

## What's on the page

| Section | Contents |
|---|---|
| Sticky nav | Brand, anchor links, CTA; collapses to a toggle button below 48rem |
| Hero | Full-viewport headline, subheadline, two CTAs, three-stat proof strip |
| Testimonials | Three cards in a responsive grid (1 → 2 → 3 columns) with a hover/focus lift |
| Enquiry form | Name, Email, Company (optional), Message — validated in JS, submits to Formspree |
| Footer | Contact link and back-to-top |

## Running it

There is no build and no server requirement — relative asset paths mean it works straight
off the filesystem.

```powershell
# Open it
start index.html

# Syntax-check the JS (the closest thing to a test suite here)
node --check script.js

# Only if something ever needs a real origin (nothing currently does)
python -m http.server 8000
```

Verification is manual: open the page, check it at 375 / 768 / 1280px, tab through it
without touching the mouse, and submit the form both empty and correctly filled in.

## Structure

Three files, strictly separated — markup, styling and behaviour never mix. No inline
styles, no inline event handlers.

```
index.html    markup only
styles.css    all styling — token-driven, mobile-first
script.js     all behaviour — nav toggle + form
CLAUDE.md     guidance for Claude Code sessions in this repo
```

**`styles.css`** builds everything from custom properties on `:root` — colour, spacing
(`--space-1`…`--space-6`), radius and shadow. A `prefers-color-scheme: dark` block
re-points those same variables, so anything built from tokens gets dark mode for free.
Every media query is `min-width`; the base styles are the phone layout. A
`prefers-reduced-motion` block disables transitions, animations and the card lift.

**`script.js`** is an IIFE loaded with `defer`, covering two independent concerns: the
mobile nav toggle and the enquiry form. Validation runs off a `rules` object keyed by
element id, and each rule's error text is written to the paragraph whose id is
`<fieldId>-error`. Adding a required field therefore means three coordinated edits — the
input, its matching error paragraph, and a rule function. A field with no rule entry is
treated as optional, which is why `company` validates silently.

## The form

The form is wired to Formspree but ships in **demo mode**. `FORMSPREE_ENDPOINT` at the top
of `script.js` still holds the `{YOUR_FORM_ID}` placeholder, so submitting logs the payload
to the console and shows the success state instead of making a request — a real POST to the
placeholder URL would 404 and make the form impossible to demo.

To go live, paste a real form ID from your Formspree dashboard:

```js
var FORMSPREE_ENDPOINT = 'https://formspree.io/f/xdorwvpk';
```

The `fetch()` path below the demo branch is already fully wired and takes over
automatically. Formspree form IDs are designed to be client-visible, so committing one is
expected rather than a leak.

## Deployment

Pushing to `main` deploys to GitHub Pages via
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml). Because the site
is static, the workflow has no build step — it uploads the repository as-is and hands the
artifact to Pages.

## Accessibility

The page ships with a skip link, landmark elements, `aria-labelledby` on every section,
`aria-expanded`/`aria-controls` on the nav toggle, `role="alert"` error paragraphs, an
`aria-live` status region, 48px minimum touch targets, visible `:focus-visible` rings, and
`aria-hidden` on decorative glyphs. Card hover lifts also fire on `:focus-within` so the
effect isn't mouse-only. Match this bar in new work.
