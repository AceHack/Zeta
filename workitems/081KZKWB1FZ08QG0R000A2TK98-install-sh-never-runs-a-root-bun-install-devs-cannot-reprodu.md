---
id: 081KZKWB1FZ08QG0R000A2TK98
type: bug
state: backlog
priority: P2
slug: install-sh-never-runs-a-root-bun-install-devs-cannot-reprodu
title: "install.sh never runs a root bun install — devs cannot reproduce lint (TS) locally, causing false 'CI is red' conclusions"
created: 2026-08-09T18:25:09.631Z
depends_on: []
composes_with: []
---

# install.sh never runs a root bun install — devs cannot reproduce lint (TS) locally, causing false 'CI is red' conclusions

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZKWB1FZ08QG0R000A2TK98-*.md` glob. -->

## The gap

`tools/setup/install.sh` (and everything it delegates to under `tools/setup/`) **never runs a
root `bun install`** — verified: no non-`--global` `bun install` anywhere in `tools/setup/*.sh`
or `tools/setup/common/*.sh`. So a fresh `install.sh` leaves the repo's npm
**devDependencies uninstalled**.

CI's `lint (TS)` job installs them itself, as its own separate step
(`.github/workflows/gate.yml`, "Install npm devDependencies (typescript@6.0.3 + eslint stack)"
→ `bun install --frozen-lockfile`).

**Consequence:** a developer or agent who runs `install.sh` and then runs the lint the way CI
runs it gets phantom `TS2307: Cannot find module '<devDep>'` errors for every devDependency —
errors that do not exist in CI. `install.sh` reports success, so nothing signals the gap.

## Why this is worth a row (it already cost accuracy twice, same day)

2026-08-09, verified: local `bun src/Core.TypeScript/lint/lint-typescript.ts` reported
`TS2307 Cannot find module 'playwright'` in `browser-node/browser-pwa-smoke.ts`, while CI's
`lint (TS)` on the *same commit* was **green**. `playwright` is correctly declared in
`devDependencies` AND present in `bun.lock` — it was simply never installed locally.

**Two independent reviewers (Otto and Kira) both concluded "lint (TS) is red on main" from that
phantom error.** Otto additionally mis-routed the "bug" to the browser-node owner, who had
nothing to fix. A single `bun install` reduced local errors to **0, exactly matching CI**.

That is the real cost: the gap does not break a build, it **silently corrupts review
conclusions** — the most expensive kind of failure because it looks like a finding.

## Fix options (§24 decision — needs the install-script owner)

The shared `install.sh` is consumed three ways (dev laptops, CI runners, devcontainer images),
so this is deliberately NOT being changed unilaterally:

1. **Run `bun install` in the setup flow** — closes the gap for every consumer. Consideration:
   `--frozen-lockfile` would make a stale lockfile a hard `install.sh` failure for everyone
   (arguably correct, but a blast-radius change); without the flag, a dev laptop could silently
   drift from `bun.lock`.
2. **Add a lint-preflight check** — have `lint-typescript.ts` detect missing `node_modules` /
   unresolvable devDeps and fail with "run `bun install` first" instead of emitting TS2307s that
   read like real type errors. Smallest blast radius; fixes the *misleading* half directly.
3. **Both** — (2) is the honest-error guard, (1) is the parity fix.

Recommendation: at minimum (2), because the failure mode is *misdiagnosis*, not inconvenience —
the errors must not be able to masquerade as findings.

## Cross-refs

- GOVERNANCE §24 — one install script, three consumers (the parity discipline this violates).
- `.github/workflows/gate.yml` — the `lint (TS)` job that installs devDeps separately.
- Evidence: Lumen's `15128cfe` (29 strict-mode fixes) verified green in CI while both local
  reviewers saw red.
- Owner: devops (Dejan) + DX (Bodhi — this is first-60-minutes contributor friction).
