---
id: 081M0QF7ZVY087G0R003Q4Q18D
type: task
state: done
priority: P2
slug: twitch-ai-is-a-self-contained-vite-app-with-no-ci-job-its-ow
title: "twitch-ai is a self-contained vite app with no CI job — its own tsc and vite build run nowhere"
created: 2026-08-23T14:08:57.726Z
completed: 2026-08-23T22:40:11.170Z
depends_on: []
composes_with: []
---

# twitch-ai is a self-contained vite app with no CI job — its own tsc and vite build run nowhere

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QF7ZVY087G0R003Q4Q18D-*.md` glob. -->

## What was measured

`src/apps/twitch-ai` ships its own `package.json` (`vite ^8.2.0`, `typescript ~6.0.2`),
its own `bun.lock`, its own `tsconfig.json` (`include: ["src"]`), and its own scripts
(`build: "tsc && vite build"`, `build:gh-pages`, `dev`, `preview`).

`grep -rl twitch-ai .github/workflows/` returns **nothing**. None of those scripts is
run anywhere in CI. The three sibling vite apps are in the same position and are also
excluded wholesale from the root `tsconfig.json`:

- `demo/identity-dla-site`
- `full-ai-cluster/portal/web`
- `src/Renderers/website`

So today the ONLY thing that typechecks `src/apps/twitch-ai/src/**` is the root
`tsc` in `lint (TS)`, which reaches it incidentally via `include: ["**/*.ts"]`.
That is not nothing — it is what caught the inert LLM branch in `swarm.worker.ts`
(#14169, #14185) — but it checks the app under the ROOT project's settings
(`lib: ["esnext"]`, `types: ["bun"]`), not the app's own
(`lib: ["ES2023","DOM"]`, `types: ["vite/client"]`). The app's real build is
never executed, so `vite build` breaking would not be visible until someone ran it
by hand.

## Why it is filed now

`vite.config.ts` landed in #14200 and reddened `lint (TS)` on `main`
(`error TS2307: Cannot find module 'vite'`) — a real error, correctly NOT
reclassified by the 081KZKWB1FZ unprovisioned-environment guard, because `vite` is
absent from the ROOT `package.json`. The unblock excluded that ONE file from the root
project and deliberately left `src/**` in it.

That exclude is honest but it is a patch on a symptom: the root `tsc` was never the
right checker for this app, and the app has no other. Naming the gap rather than
letting the exclude imply coverage that does not exist.

## What done looks like

Either:

1. **Give the app a CI job** — `bun install && bun run build` inside
   `src/apps/twitch-ai` (its own lockfile, its own tsconfig, its own vite). Then the
   whole app, `vite.config.ts` included, is checked by its real checker, and the
   tree can be excluded from the root project the way the other three are; or
2. **Decide the app is not shipped** and say so, in which case the root `tsc` reaching
   into it is the accident and the tree should be excluded with that stated.

Not acceptable: leaving the exclude in place while the comment above it is the only
record that nothing checks the file.

Applies equally to `demo/identity-dla-site`, `full-ai-cluster/portal/web` and
`src/Renderers/website`, which are the same shape and the same gap.
