---
id: 081M23NT5VX087G0R000KAFE45
type: task
state: backlog
priority: P2
slug: ace-refresh-pin-and-refresh-as-one-mechanism-for-pinned-depe
title: "ace refresh: pin and refresh as one mechanism for pinned dependencies"
created: 2026-09-09T18:10:20.157Z
depends_on: []
composes_with: []
---

# ace refresh: pin and refresh as one mechanism for pinned dependencies

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23NT5VX087G0R000KAFE45-*.md` glob. -->

## Why

Maintainer, 2026-09-09: *"we want to keep quantum circuit ... also lets come up with
a refresh mechanism and put it in our ace package manager that's what it's for for
the pinned dependencies."*

Scorecard `PinnedDependenciesID` had 18 open alerts (MEASURED 2026-09-09: 8
containerImage, 3 nugetCommand, 3 downloadThenRun, 2 npmCommand, 2 pipCommand). A
previous agent declined to blind-pin digests because *pinning without a refresh
mechanism freezes base images and can worsen posture* — which is the design brief,
not an obstacle: a pin nobody can refresh is how a posture rots, and a refresh that
does not re-pin is how integrity is lost. One mechanism, both halves.

## What landed

- `tools/setup/manifests/pinned-refs` — the registry. A MIRROR of pins written at
  their point of use; nothing in any build path reads it.
- `tools/setup/manifests/pinned-refs-receipts` — append-only re-measure receipts.
- `src/Core.TypeScript/ace/refresh-pins.ts` — `--verify` / `--report` / `--resolve`
  / `--refresh`. Effects injected (§13); container + npm-advisory resolvers real;
  nuget / npm-lock / pip named and reporting UNKNOWN, never fresh.
- 8 container base images pinned inline by digest (closing alerts #888 #889 #283
  #284 #238 #181 #179 #176). Every digest resolved against the registry HTTP API
  v2 AND cross-checked against Scorecard's independently computed remediation
  digest — all six distinct refs agreed byte for byte.
- `src/Core.TypeScript/hygiene/lint-mathjs-dismissal-premise.ts` — the enforcer for
  the alert-#15 disposition.
- Both, plus both test suites, wired into `gate` beside
  `lint-clone-at-tag-is-sufficient.ts`.

Design, with the clone-at-tag argument and where it disagrees with the existing
ace design: `docs/agendas/ace-package-manager/2026-09-09-ace-refresh-pin-and-refresh-are-one-mechanism-design.md`.

## Follow-ups deliberately NOT done here

- `nuget` / `npm-lock` / `pip` row shapes (their pin is a lockfile, not a digest at
  a point of use) — 10 of the 18 alerts.
- Unifying `update=follow-tag|frozen` with `ace-mechanism-pointers.json`'s
  `"update": "pinned"`.
- `downloadThenRun` is NOT a follow-up here: it belongs to `from-url` +
  `repin-rolling.ts` (081M23ESC5B087G0R002HJ39DG).
- Nothing runs `--report` on a schedule yet. Staleness is observable, not yet
  OBSERVED, and a reporter nobody runs is a silence — named in the design's honest
  limits rather than glossed. Deliberate: the runner pool is saturated and a cron
  workflow is a fleet-resource decision, not a rider on a security change.
