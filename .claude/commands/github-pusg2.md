---
description: Scan for secrets, then push to GitHub, write the README, deploy to Pages via Actions, and fill in the repo About section
argument-hint: "[repo-url] (optional — falls back to the existing origin remote)"
---

Publish this project to GitHub end to end: security scan, push, README, GitHub Pages
deployment via Actions, and a populated About section linking to the live page.

Target repo: $ARGUMENTS
If that is empty, use the existing `origin` remote. If there is no `origin` and no
argument, stop and ask for the repo URL — do not guess or create a repo.

Work through the phases in order. **Phase 2 gates everything else** — nothing may leave
this machine until the scan is clean.

## Phase 1 — Preflight

- Check whether this is a git repo (`git rev-parse --is-inside-work-tree`). If not,
  `git init -b main`.
- Check `git config user.name` / `user.email`. If unset, set them **locally** on this repo
  only (never `--global`), and say in your report which identity you used.
- Check `git remote -v`. Add `origin` if missing.
- Run `git ls-remote <url>` to confirm the remote exists and is reachable, and to see
  whether it already has commits. If it has commits you did not create, fetch and inspect
  before pushing — never force-push over someone else's history.

## Phase 2 — Security scan (blocking)

Run this **before the first push**, and re-run it before every later push. A scan that
happens after publication is worthless: once something reaches GitHub it must be treated as
compromised even if you delete the commit, because forks, caches and the API retain it.

Scan the working tree **and** the existing git history (`git log -p`) for:

- `.env`, `.env.*`, `*.pem`, `*.key`, `*.pfx`, `id_rsa`, `*.keystore`, `credentials.json`,
  `service-account*.json`, `*.sqlite`, `*.bak`
- High-entropy strings and known token shapes: `ghp_`, `gho_`, `github_pat_`, `sk-`,
  `sk-ant-`, `AKIA`, `AIza`, `xox[baprs]-`, `-----BEGIN .* PRIVATE KEY-----`
- Assignments matching `(api[_-]?key|secret|token|password|passwd|client[_-]?secret|
  connection[_-]?string)\s*[:=]` with a non-placeholder value
- Personal data that should not be public: real email addresses, phone numbers, internal
  hostnames, absolute paths containing a username
- Per-machine or per-user config that does not belong in a repo — in particular
  `.claude/settings.local.json`

Handling rules:

- **Never print a suspected secret in your output.** Report file, line number and the kind
  of match only.
- Placeholders are fine and expected — `{YOUR_FORM_ID}`, `xxx`, `changeme`, `example.com`.
  Confirm they are genuinely unreplaced rather than assuming.
- Publishable-by-design public identifiers (a Formspree form ID, a Firebase web config, a
  Stripe **publishable** key) are not leaks. Say so explicitly rather than silently
  ignoring them.
- If you find anything real: **stop, push nothing**, name the files, and ask how to
  proceed. If it is already in the history, say plainly that rotating the credential is the
  only real fix — rewriting history alone does not undo exposure.

Then fix `.gitignore` before staging: `.env*`, `.claude/settings.local.json`, `node_modules/`,
build output, editor dirs, and OS cruft (`Thumbs.db`, `desktop.ini`, `.DS_Store`). Verify
with `git status --short` that nothing unwanted is staged, and check `git ls-files` after
committing.

## Phase 3 — README

Create `README.md`, or update it in place if one exists (preserve sections the user wrote —
do not overwrite the file wholesale). It should cover:

- What the project is, in one or two sentences, and the live URL once Phase 5 produces one
- **Any fabricated, placeholder or demo content, called out near the top.** If the site
  contains invented company names, statistics or testimonials, say so before a reader can
  mistake them for real
- How to run it locally — exact commands, and explicitly note if there is no build step
- How to verify it, including manual checks if there is no test suite
- Project structure and any conventions a contributor would otherwise break
- Configuration a user must supply themselves (endpoints, API keys, placeholders to replace)
- How deployment works

Match the repo's existing tone. Do not invent features, benchmarks, badges or a licence
that is not actually present.

## Phase 4 — Commit and push

- Stage deliberately and review `git status --short` before committing.
- Write a real commit message: a short subject line, then body text explaining why.
- Push (`git push -u origin main` on the first run).
- Confirm success — check the exit code and `git status -sb` showing the branch in sync.

## Phase 5 — GitHub Pages via Actions

Only for repos that serve a static site. Skip with a note if that does not apply.

Create `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .          # add a build step here if the project has one
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Known gotcha — Pages must exist before the workflow can publish to it.** If Pages has
never been enabled, `Configure Pages` fails and the site 404s. `enablement: true` on
`configure-pages` often does *not* fix this: the built-in `GITHUB_TOKEN` is frequently
refused on the create call. Check with `GET /repos/{owner}/{repo}/pages` — a 404 means it is
not enabled.

To enable it, prefer in this order:

1. `gh api -X POST repos/{owner}/{repo}/pages -f build_type=workflow`, if `gh` is installed.
2. Ask the user to set **Settings → Pages → Source: GitHub Actions** — a five-second click.
3. Only if the user has asked you to handle it without their involvement, use the git
   credential already on the machine. **Never print the token.** Note that this shell has
   stdin on the null device, so piping into `git credential fill` silently fails — route it
   through `cmd` with real input redirection:

   ```powershell
   cmd /c "git credential fill < request.txt"   # request.txt: protocol=https / host=github.com / blank line
   ```

   Capture `password=` into a variable, use it for the API call, and print only the result.

Enabling Pages does not itself trigger a run — dispatch the workflow
(`POST /actions/workflows/deploy-pages.yml/dispatches` with `{"ref":"main"}`) or push.

Then **verify for real**: poll `/actions/runs` until the run completes, confirm every step
succeeded, and fetch the live URL plus its CSS/JS assets, checking for HTTP 200 and correct
content types. Do not report success off a green workflow alone.

## Phase 6 — About section

Set all three fields, then confirm them with an unauthenticated read so you are reporting
what visitors actually see:

- **Description** — `PATCH /repos/{owner}/{repo}` with `description`. One clear sentence.
  If the content is fictional or a demo, lead with that.
- **Homepage** — the same PATCH with `homepage` set to the Pages URL from Phase 5. This is
  the link shown at the top of About.
- **Topics** — `PUT /repos/{owner}/{repo}/topics` with `{"names":[...]}`. Roughly 8–14,
  lowercase, hyphenated, drawn from the actual stack and purpose. No invented tags.

## Report

Finish with: what was scanned and what the scan found (including deliberate placeholders),
what was committed and pushed, the live URL with the evidence it is actually serving, and
the About fields as they now read. State anything you could not complete and exactly what
the user needs to do about it.
