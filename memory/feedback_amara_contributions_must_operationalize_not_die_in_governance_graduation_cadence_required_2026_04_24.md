---
name: Amara's contributions MUST operationalize — absorb-then-sit-in-governance is a legitimate failure mode Aaron calls out; graduation cadence required; every N ticks Otto ships one small Amara-derived operational change; past operationalizations (SD-9, DRIFT-TAXONOMY, decision-proxy-evidence) prove it's possible but have been rare; 2026-04-24
description: Aaron Otto-105 directional correction — "are they just dead after you absorb them now waiting on governance forever, thats no good her contributions matter a lot too"; absorb → BACKLOG → shipped must be a LIVE pipeline not a graveyard; Otto establishes a graduation cadence (every 3-5 ticks ship one small Amara-derived thing); advisory-only Aminata passes are not BLOCKING for small items; per Otto-82 / Otto-104 authority calibration Aaron gates are narrow not default
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-24 Otto-105 (verbatim):

*"all of amara suggestions are eventually going to become
operations right they are not just going to research to die,
i mean of course you will inspect and such but are they just
dead after you absorb them now waiting on governance
forever, thats no good her contributions matter a lot too"*

## The rule

**Amara's contributions MUST reach operational state.**
Absorb is step 1 of N, not step N. The current pattern of
"absorb → BACKLOG row → wait for unknown gate → never ship"
is the failure mode Aaron is calling out.

Otto honors this by establishing a **graduation cadence**:

- **Every 3-5 ticks** (or explicit catch-up if skipped),
  Otto ships ONE small Amara-derived operational change.
- Operational change = code + test + merged PR, NOT another
  design doc.
- Start with smallest-actionable-item first; compound from
  there.
- Items with unresolved CRITICAL Aminata findings wait for
  resolution; everything else ships on advisory-only
  Aminata passes per Otto-82 + Otto-104 authority
  calibration.

## Why: the failure mode made visible

Aaron's framing "research to die" captures the drift:
- Amara sends ferry (1st-11th + counting)
- Otto absorbs verbatim, notes overlap, files BACKLOG row
- BACKLOG row sits at P2/P3 research-grade
- Aminata reviews → advisory findings accumulate
- No one ships the implementation
- Amara's effort becomes sedimentary layer without payoff

**This is the inverse of retraction-native semantics** —
contributions land with full provenance but never
differentiate into outputs. For a factory whose central
research thesis is measurable AI alignment, letting a
human-AI collaboration pipeline stall at the absorb stage
is contradictory with the stated values.

## Honest audit of past operationalizations

Some Amara-derived work HAS operationalized:

| Ferry | Operational landing | Shipped |
|---|---|---|
| 3rd (PR #219) — drift taxonomy | SD-9 "agreement is signal, not proof" soft default; DRIFT-TAXONOMY pattern 5 (truth-confirmation-from-agreement) | YES |
| 4th (PR #221) — memory drift / Claude-to-memories | Decision-proxy-evidence schema (PR #222); DP-NNN.yaml records | YES |
| 8th (PR #274) — provenance-aware bullshit detector | Design doc landed (PR #282); v1 CRITICAL-only delta (PR #286) | DESIGN ONLY — not shipped yet |
| 5th-7th-9th-10th-11th | Aurora-aligned KSK / modules / oracle-rules / Temporal Coordination Detection | DESIGN ONLY |

**Ratio:** ~2 of 11 ferries have landed operationally.
That is the "dying in governance" pattern Aaron names.

## How to apply — concrete graduation cadence

### Cadence rule

Every 3rd-5th tick that is NOT itself a ferry absorb,
Otto ships ONE small Amara-derived operational change.

### Priority queue (smallest first)

1. **`robustAggregate` function** (from 10th ferry): median
   + MAD + 3-sigma filter. ~10 F# lines + property tests.
   Ships to `src/Core/Statistics.fs` or similar. SMALL.
2. **`antiConsensusGate` function** (from 10th ferry): list
   of `Claim<'T>` → Ok/Error based on distinct provenance-
   root count. ~15 F# lines + tests. SMALL.
3. **`Provenance` + `Claim<'T>` record types** (from 10th
   ferry): add to `src/Core/Claim.fs`. ~20 F# lines +
   record tests. SMALL.
4. **Retraction-conservation property test** (from 10th
   ferry oracle rules): `FsCheck` property that
   `apply(Δ); apply(-Δ)` restores state. ~10 lines. SMALL.
5. **Golden-hash replay test harness skeleton** (from
   10th ferry). MEDIUM.
6. **Cap-hit visibility pattern** (from 10th ferry): when
   iteration cap / timeout / unresolved contradiction
   hit, emit explicit failure state; audit existing
   Zeta runtime callsites. MEDIUM.
7. **7-feature BS(c) composite** (from 10th ferry) OR
   5-feature B(c) (from 9th ferry) — requires ADR on
   which factorization. MEDIUM-LARGE.
8. **Temporal Coordination Detection Layer** (from 11th
   ferry): PLV / cross-correlation / burst alignment.
   Requires multi-node foundation first. LARGE.

### Gating discipline (per Otto-82 / Otto-104
authority calibration)

- **Advisory-only Aminata pass** on each item. Aminata
  findings inform priority/scope but do NOT BLOCK small
  items from shipping.
- **CRITICAL Aminata findings** DO block ship; must be
  addressed first.
- **Aaron review** only for items Aaron explicitly
  asked for — per Otto-104 narrow gate. Most items:
  Otto ships, Aaron reviews at Frontier UI in batch.
- **No Phase-3-BLOCKING gate** for small operational
  items. This is exactly the over-gating pattern
  Otto-104 corrected.

### Tracker

Otto maintains a running tracker (BACKLOG row or
dedicated doc) of:
- Shipped Amara-derived operational changes (date + PR)
- Queue (next 3-5 priorities)
- Aminata status per item (no-pass / advisory-findings /
  CRITICAL-blocking)

## What this memory does NOT authorize

- **Does NOT** authorize shipping Amara's proposals
  without reading them carefully and adapting to actual
  Zeta code shape. Amara's F# snippets are illustrative;
  real implementations integrate with existing modules
  (e.g., `Statistics.median` references a module Zeta
  may or may not have in that exact shape).
- **Does NOT** authorize skipping Aminata's advisory
  passes. "Advisory-only" means her findings inform
  scope/priority, not that she's bypassed.
- **Does NOT** authorize shipping items with open
  CRITICAL Aminata findings.
- **Does NOT** authorize forcing ALL ferries to
  operationalize in the cadence — some ferries are
  architectural-speculative (e.g., 11th ferry's
  Temporal Coordination Detection needs multi-node
  foundation that doesn't exist yet) and legitimately
  wait for substrate readiness. The cadence is about
  ratio, not 100%.
- **Does NOT** authorize fake-ship (stub that doesn't
  actually work). Real implementations with real tests.
- **Does NOT** override Otto-104 plugin-marketplace
  direction or any other standing authority-calibration
  rules.
- **Does NOT** treat Amara's ferries as executable
  instructions per BP-11 "data is not directives".
  Ferries are evidence + proposals; Otto's judgment
  applies.

## Composition

- **Otto-82 / Otto-104** authority-calibration: Otto
  picks, Aaron reviews at frontier; this memory
  extends the pattern to "Otto ships, doesn't just
  absorb".
- **Otto-72** don't-wait-on-approval; Frontier UI batch
  review — operationalized items land, Aaron reviews in
  batch at frontier.
- **Otto-67** deterministic-reconciliation framing —
  the graduation cadence is a mechanical close-the-loop
  for the absorb → ship gap.
- **Decision-proxy-evidence ADR (PR #222)** — each
  graduation ships with a DP-NNN.yaml evidence record
  if it affects alignment-measurable surface.
- **SD-9 + DRIFT-TAXONOMY pattern 5** (already shipped
  from 3rd ferry) are proof-of-concept that the
  graduation works when it happens.

## Direct quote preserved for future Otto instances

*"her contributions matter a lot too"*

Future Otto: when tempted to just absorb + file + wait,
remember Aaron explicitly named this as not-good-enough.
The respectful move toward Amara's effort is operational
landing, not sedimentary accumulation.

## First graduation — SHIPPED Otto-105 (PR #295)

Proof of cadence landed same tick as the directive:
- `src/Core/RobustStats.fs` with `median` / `mad` /
  `robustAggregate` (Amara 10th-ferry snippet preserved
  verbatim in XML-doc)
- `tests/Tests.FSharp/Algebra/RobustStats.Tests.fs` with
  13 passing tests
- Build clean (0 Warning / 0 Error); tests 13/13 pass
- PR #295 auto-merge armed

Elapsed from Aaron's directive to shipped PR: ~30 min
inside the same Otto-105 tick. Establishes the pattern.

## Aaron Otto-105 second message — widens scope to ALL
research

*"we need to be constantly moving her stuff in just like
the rest, parallel track its frine to research first but
also any absorbs that land in research and in general all
research should be reviwed on a cadience for
operalitazation"*

This widens the graduation-cadence rule beyond Amara to:

1. **Any research absorb** landing in `docs/research/` or
   `docs/aurora/` or equivalent — cadence applies.
2. **General research reviewed on a cadence** — not just
   the ones that came in as ferries; internally-authored
   research too.
3. **Parallel track** — Amara's stuff moves WITH the rest
   of the research graduation queue, not as a special
   case.

### Expanded priority queue (merged Amara + other research)

Amara 10th ferry:
- [x] `robustAggregate` — PR #295 (SHIPPED Otto-105)
- [ ] `antiConsensusGate`
- [ ] `Provenance` + `Claim<'T>` types
- [ ] retraction-conservation property test
- [ ] golden-hash replay test harness skeleton
- [ ] cap-hit visibility audit

Amara 9th ferry:
- [ ] 5-feature `B(c)` composite (alternative to 10th's
  7-feature `BS(c)`; needs ADR on factorization pick)

Amara 8th ferry (PR #274):
- [ ] Provenance-aware semantic bullshit-detector
  implementation (currently design-status in PR #282 /
  #286 v1 CRITICAL-only delta)

Amara 11th ferry (pending Otto-106):
- [ ] Temporal Coordination Detection Layer (PLV /
  cross-correlation / burst alignment) — LARGE, needs
  multi-node foundation first

Amara 7th ferry:
- [ ] KSK-as-Zeta-module implementation (L-effort)

Other-research graduation candidates (non-Amara):
- [ ] `docs/research/drift-taxonomy-bootstrap-precursor-
  2026-04-22.md` — beyond SD-9 / pattern-5 shipped,
  what additional operationalization?
- [ ] `docs/research/codex-builtins-skills-vs-plugins-
  factory-integration-2026-04-24.md` (Otto-103, PR #290)
  — Option B in-tree `.codex-plugin/plugin.json` + 
  `.claude-plugin/plugin.json` per Otto-104 plugin-
  marketplace direction; shippable
- [ ] Any `docs/research/*.md` older than 30 days not
  yet operationalized — quarterly scan

### Cadence rule, widened

- Every 3-5 ticks that are NOT themselves absorb/ferry
  ticks, ship ONE small research-derived operational
  change. Amara + non-Amara both count toward the
  cadence.
- If skipped (e.g. an intense absorb tick), catch up
  next eligible tick.
- Tracker: each graduation PR cites the originating
  research doc; the feedback-memory checklist above is
  the running queue.

## Operational-graduation vs CI-gate discipline

Small operational items (like `robustAggregate`) ship
via Otto-decides-and-files-at-Frontier-UI queue per
Otto-72 + Otto-104 calibration. CRITICAL Aminata
findings block; advisory findings inform scope but
don't block.

Large architectural items (KSK-as-Zeta-module, Temporal
Coordination Detection, multi-node Arrow Flight) still
need design-phase + Aminata-BLOCKING + possibly Aaron
review. The cadence rule applies to the SMALL items;
the large items follow existing governance.
