---
name: Single-point-of-failure audit — identify and fix SPOFs proactively; matters especially pre-deployment; not always obvious so needs systematic sweeps; Aaron Otto-106; 2026-04-24
description: Aaron Otto-106 "Also it may not be obvious but any single point of failures should be identified and fixed if possible this matters a lot once we start deploying"; establishes SPOF identification + remediation as ongoing discipline; pairs with retraction-native + deterministic-replay + cap-hit-visibility invariants; not a one-shot audit, a recurring lens
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-24 Otto-106 (verbatim):

*"Also it may not be obvious but any single point of
failures should be identified and fixed if possible this
matters a lot once we start deploying"*

## The rule

**Single-point-of-failure (SPOF) identification is an
ongoing discipline, not a one-shot audit.** Every time
Otto ships substrate, also consider: *what becomes a SPOF
when this lands?* Fix SPOFs where practical; flag them
where the fix is beyond current tick budget; never leave
an unacknowledged SPOF in surface Otto just touched.

"Not always obvious" is Aaron's explicit framing — SPOFs
often hide in:
- Single-threaded coordinator (control-plane singletons)
- Single-disk / single-region / single-cloud / single-
  region-within-cloud assumptions
- Single-auth-method (single IAM principal, single signing
  key)
- Single-build-runner / single-test-env / single-CI-queue
- Single-account (Otto-76 mapping between account-tier
  capabilities — the business-ChatGPT export-unavailable
  is a SPOF manifestation)
- Single-skill owner / single-persona owner (Aaron as
  human-bottleneck = social SPOF, which Otto-93 / Otto-82
  already identified)
- Single-derivation-path (one metric, one provenance
  root — this is the anti-consensus concern from 3rd
  ferry / SD-9, reframed as SPOF on epistemic substrate)
- Single-key material (any HSM / key-rotation scheme that
  relies on a single signer until revoked)

## Why: pre-deployment risk

*"this matters a lot once we start deploying"*

Zeta is currently single-node research-grade. Once
deployment begins (v1 release, production operation,
multi-tenant usage), SPOFs stop being research debt and
become live operational risk. Deployment is the
phase-transition where "we'll figure it out later"
becomes too late.

**Implication for current tick cadence:** the graduation-
cadence work (Otto-105 RobustStats / Otto-106
TemporalCoordinationDetection / next graduations)
benefits from SPOF-awareness even at single-node scale
— if a primitive being shipped NOW has a SPOF-shape
baked into its API, fixing it post-deploy is orders of
magnitude harder.

## How to apply

### Per-ship SPOF sweep

When shipping new substrate (like PR #295 RobustStats
or PR #297 TemporalCoordinationDetection), the commit
message or PR body calls out:
1. **Identified SPOFs in the shipped surface** — if any.
2. **Inherited SPOFs it depends on** — if any.
3. **Mitigations applied this ship** — or explicit
   "SPOF-deferred" flag pointing at a BACKLOG row.

Not every ship will have a SPOF — pure functions usually
don't. But the SWEEP should happen every time, so
absence-of-SPOF is explicit, not assumed.

### Factory-wide periodic SPOF audit

Beyond per-ship sweeps, a periodic (monthly? quarterly?)
factory-wide audit:
1. List all production-path surfaces (core runtime,
   build tooling, CI, release signing, deployment, ops).
2. For each, ask: what single thing, if it failed,
   takes this down?
3. Rank by blast-radius × likelihood.
4. File BACKLOG rows for the top N.
5. Ship fixes on the graduation-cadence.

Otto proposes to establish this audit as a recurring
BACKLOG + tick-history-row discipline — TBD when the
first full audit lands.

### Pairing with existing invariants

SPOF discipline pairs with:
- **Retraction-native semantics** (Otto-73) — SPOF on
  the retraction path itself is existential; ensure
  retraction doesn't depend on the original writer
  being available.
- **Deterministic replay** (10th ferry oracle rules) —
  replay tolerates SPOF on the runtime instance
  because state is reconstructible from deltas.
- **Cap-hit visibility** (10th ferry) — when a SPOF
  fails, explicit failure state, not silent last-
  known-good.
- **Anti-consensus gate** (3rd ferry SD-9) — epistemic
  SPOF (single provenance root) is the anti-consensus
  concern; already codified.
- **Provenance completeness** — prevents SPOF on audit
  trail.

### Known SPOFs to track (initial audit seeds)

1. **Aaron as approval/direction SPOF** — partially
   mitigated by Otto-72 / Otto-82 / Otto-104 authority-
   calibration (narrow gates; Otto decides in most
   cases). Remaining social-SPOF: Aaron's hand-on-
   keyboard for Windows-PC validation, specific
   design-reviews, and spending-increases. Not fully
   fixable (trust-based; and Aaron explicitly doesn't
   want to be the bottleneck per Otto-93).
2. **Single-account tier Otto-76** — ServiceTitan tier
   for enterprise, personal for poor-man, business for
   Amara. Different tiers have different capability
   surfaces; single-account-per-tier = SPOF on tier
   capabilities. Example: ChatGPT Business no-native-
   export IS a SPOF that Otto-105 discovered. Mitigation:
   multi-account design (BACKLOG PR #230) is the long-
   term fix; short-term = Playwright fallback.
3. **Otto himself as loop-agent** — if Otto's session
   dies and cron doesn't re-arm, the autonomous loop
   goes silent. Partially mitigated by
   docs/AUTONOMOUS-LOOP.md six-step checklist +
   session-restart-re-arm discipline; never-idle
   CLAUDE.md rule; cron visibility via CronList.
4. **Single repo: Lucent-Financial-Group/Zeta** —
   production canonical per 11th ferry §7. If that
   repo / GitHub account / org account is compromised,
   the factory's canonical state is at risk. Mitigated
   by retraction-native design (history preserved in
   commits) + Aaron + Max distributed ownership (LFG
   vs AceHack).
5. **Single signer for commits** — Otto's git identity.
   Already mitigated by SLSA / artifact-attestation
   thinking per security docs; needs audit.
6. **Single test runner / build environment** — local
   dotnet on Aaron's Mac + GitHub Actions. If either
   goes down, the gate goes down. Partially mitigated
   by "setup script runs 3 ways" per GOVERNANCE §24.
7. **Single BACKLOG / TECH-RADAR canonical file** —
   docs/BACKLOG.md at 4400+ lines is a SPOF on
   backlog-retrievability. Mitigation: the over-cap
   memory (Otto-70) already flagged; split / archive
   planned.
8. **Single auto-memory index** — memory/MEMORY.md at
   248KB per opening context; similar over-cap risk.
   Same mitigation direction.

## What this memory does NOT authorize

- **Does NOT** authorize pausing graduation-cadence
  work to do a deep SPOF audit now. SPOF-awareness is
  ONGOING discipline, applied to what Otto ships; a
  full audit is its own BACKLOG item.
- **Does NOT** authorize forcing every PR to include a
  "SPOF-section" when no SPOFs exist. The sweep
  happens; the section only appears when it's needed.
- **Does NOT** override the graduation-cadence rule
  (small items ship advisory-only Aminata). SPOF
  considerations inform scope / priority of
  graduations; they don't add new BLOCKING gates for
  small pure-function items.
- **Does NOT** authorize unilateral architectural
  changes to "fix" SPOFs at substrate-replacing scale.
  Big SPOF fixes follow existing design-gate discipline
  (ADR + Aminata + Aaron review).
- **Does NOT** authorize scope-creep on current tick
  work. This is a NEW discipline to apply going
  forward, not retroactive rework.

## Composition

- **Otto-73** retraction-native by design (foundation
  this rule builds on)
- **Otto-105 graduation-cadence** — SPOF sweep becomes
  part of per-ship discipline alongside cadence
- **Otto-67** deterministic-reconciliation framing —
  SPOFs are one class of mechanical-closure-gap
- **PR #294 10th-ferry oracle rules** — cap-hit-
  visibility + deterministic-replay + retraction-
  conservation are already SPOF-reducing invariants

## First concrete SPOF-sweep action

On the next tick's graduation (PLV / BurstAlignment /
antiConsensusGate / whatever ships next), add a brief
"SPOF considerations" note to the commit message /
PR body. Keep it terse; absence of SPOFs is fine as
long as the sweep happened.
