---
id: 081KTGEVV7508QG0R0036B2ZJT
type: task
state: done
priority: P1
slug: data-plane-plugin-determinism-lint-contract-restrict-dynamic
title: "Data-plane plugin determinism lint/contract — restrict DynamicValue plugins to fast DETERMINISTIC ops (no non-determinism; DST-safe), with allocation + Big-O awareness"
created: 2026-06-07T07:13:27.781Z
completed: 2026-06-21T04:26:24.417Z
depends_on: []
composes_with: ["081KTGES04808QG0R0010AK90E"]
---

# Data-plane plugin determinism lint/contract — restrict DynamicValue plugins to fast DETERMINISTIC ops (no non-determinism; DST-safe), with allocation + Big-O awareness

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTGEVV7508QG0R0036B2ZJT-*.md` glob. -->

## Source (Aaron 2026-06-07)

> "we need a lint for data plane dynamic value plugins or some specific inherited version of it that
> restricts it to fast deterministic functions for the data plane and does not allow non determinism,
> and it would be great if allocations and big o notation were taken into consideration somehow."

> **Aaron (Feedback 2026-06-20):** "we don't want to restrict to exact determinism like a version number but a deterministic time crystal update loop"

## Why

Data-plane plugins (081KTGES048) run in the **deterministic, DST-replayable core** (manifesto §7 DST;
the whole substrate's replay/consensus depends on determinism). A plugin that reads the clock, randomness,
ambient/global state, or does I/O breaks replay + cross-language byte-lock. So data-plane plugins must be
restricted to **fast, deterministic, bounded** operations — enforced, not hoped.

## The shape of the solution (key insight)

A data-plane plugin is **DATA** (a `DynamicValue` carrying a restricted Rx/Bonsai expression tree), not
arbitrary F#. So the "lint" is best a **validator over the plugin's expression tree** — admit only an
allowed deterministic, bounded op-set — rather than linting arbitrary host code. This is the
"restricted inherited version" Aaron names: a **`DataPlanePlugin` = the plugin contract ∩ a total,
deterministic sublanguage**.

Three constraints to enforce:

1. **Determinism (hard, required).** Forbid non-deterministic sources: clock/`DateTime.Now`,
   randomness/`Guid.NewGuid`, ambient/global mutable state, any I/O, any host-handle. (Same discipline as
   Durable-Functions orchestrator code-constraints; see PRIMITIVE-REGISTRY "resume needs only no-handles".)
   The allowed op-set = pure functions of the ZSet input + the plugin's declared params.
2. **Allocation awareness (soft → enforced).** Prefer zero/bounded allocation; surface a plugin's
   allocation profile. Naledi (performance-engineer) owns the alloc audit shape.
3. **Big-O / complexity awareness (soft).** Each allowed op carries a known complexity; a plugin's
   indexed-view Rx query has a derivable cost bound (DBSP operators have known incremental complexity).
   Goal: reject or flag plugins whose declared views exceed a complexity budget. Hiroshi (asymptotic
   complexity) / Imani (planner cost model) are the relevant lenses.

## Routing (formal-verification — Soraya owns the tool choice)

Which enforcement mechanism per constraint: a **Semgrep/CodeQL** rule for host-code escapes vs. an
**expression-tree validator** over the plugin DynamicValue (the determinism set) vs. a **type-level
restricted-subtype** (`DataPlanePlugin`) vs. a **proof** that the sublanguage is total/deterministic.
Determinism is plausibly a structural validator + a DST cross-check (run twice, same seed → identical
output). Alloc/Big-O are measurement (Naledi) + a cost model (Imani), not a single lint. **Route to
Soraya before authoring** (anti-hammer: pick the tool per constraint class).

## Anchors

- Plugin model: workitem `081KTGES048` · `docs/ROADMAP.md` (file-type plugins) · two-plane DB design doc.
- Determinism: manifesto §7 DST; `.claude/rules/async-all-the-way-truthful-signatures.md` (DST replay);
  PRIMITIVE-REGISTRY (Durable-Functions no-handles/no-non-determinism discipline).
- Alloc/Big-O: performance-engineer (Naledi), complexity (Hiroshi), planner cost model (Imani).
