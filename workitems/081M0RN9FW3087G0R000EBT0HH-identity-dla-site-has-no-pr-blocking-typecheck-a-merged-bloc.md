---
id: 081M0RN9FW3087G0R000EBT0HH
type: task
state: closed
priority: P2
slug: identity-dla-site-has-no-pr-blocking-typecheck-a-merged-bloc
title: "identity-dla-site has no PR-blocking typecheck — a merged block-comment break rode main for 2h and killed every Pages deploy"
created: 2026-08-24T01:13:52.771Z
depends_on: []
composes_with: []
---

# identity-dla-site has no PR-blocking typecheck — a merged block-comment break rode main for 2h and killed every Pages deploy

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0RN9FW3087G0R000EBT0HH-*.md` glob. -->

## What happened

PR #14523 (merged 2026-08-23 23:10Z) added the Tsirelson-caveat text to
`demo/identity-dla-site/src/components/OracleWorm.tsx` inside its `/** */`
header. The prose contained the characters `*/` (in `ρ*/√2`), which
terminates a TS block comment early — everything after parsed as code and
`pnpm check` failed with syntax errors ("Did you mean 'while'?" on the word
"White" in a citation).

Nothing at PR time checks that project: the root `lint (TS)` type-checks the
ROOT tsconfig only, and the site's own `tsc` runs solely inside
`pages-deploy.yml` (`identity-dla-pages-build.ts` → `pnpm check`), which is
not in the required-check set. So the break merged green and every Pages
deploy went red for ~2 hours (runs 32676453376 … 32678892765, 10+
consecutive failures across unrelated shas) — the live LLMTV page silently
served a bundle that predated a full day of shipped work.

The syntax break itself was fixed in the PR that carries this workitem.

## What this asks for

The same move D0 of #14503 made for `src/apps/twitch-ai` (PR #14522):

1. A drift-check CI job that runs the site's own `pnpm check` (and ideally
   its `vite build`) on PRs touching `demo/identity-dla-site/**`, claimed in
   `src/Core.TypeScript/ace/build-graph.json` so the completeness audit owns
   it.
2. Prove the job discriminates (break → red → restore → green, links in the
   PR body), per the D0 acceptance pattern.
3. Whether the job joins the `gate (required)` floor is a treaty amendment —
   leave it to the consent path, as with the twitch-ai job.

## Pointers

- `workitems/081M0QF7ZVY087G0R003Q4Q18D-*` — the twitch-ai instance of the
  same gap class (fixed by D0 of #14503).
- `.github/workflows/pages-deploy.yml` — the only current checker.
- `src/Core.TypeScript/discovery/identity-dla-pages-build.ts` — the build
  entry that runs `pnpm check`.
