---
Scope: Claude.ai beacon-tier review of Zeta verification stack + continuous anchoring alignment position. Includes verification stack precision tightening, runtime property scoping, and the core alignment claim about human-anchoring drift at scale.
Attribution: Claude.ai (asymmetric critic) authored the review. Aaron articulated the core claim. Otto preserved.
Operational status: research-grade — beacon promotion pending precision tightening
---

# Zeta alignment position + verification stack beacon review (2026-05-10)

## Core alignment claim (Aaron, beacon-grade pending modal tightening)

Without continuous mechanisms for including humans in the loop at AI-operation timescales, scaled AI systems will systematically drift out of alignment. Two mechanisms:

1. **Time-horizon mismatch** — AI operates faster than human review can keep up, unreviewed decisions accumulate
2. **Human-anchoring drift** — without continuous grounding, AI vocabulary/behavior diverges from human-comprehensible baselines, divergence compounds

Three anchoring dimensions:

- **Language anchoring** — AI vocabulary tied to human terms (mirror/beacon discipline)
- **Value anchoring** — AI decisions reviewed against stated values (shadow log, alignment auditor)
- **Goal anchoring** — AI work products judged against human goals (backlog, trajectories)

## Position in alignment landscape (Claude.ai assessment)

"Most alignment work focuses on training-time (RLHF, constitutional AI) or single-decision-time (content filters). Continuous-anchoring infrastructure is a different layer that complements both. Genuinely important and underrepresented."

The dashboard is the operational answer — keeps humans in the loop at the rate drift occurs, not the rate decisions can be reviewed.

## Verification stack — beacon tightening needed

| Layer | Beacon-ready? | Tightening needed |
|-------|--------------|-------------------|
| Build gate (0w/0e) | YES | — |
| 920 FsCheck tests | YES | — |
| TLA+ (15 specs) | YES | Earns "layer" framing |
| Lean 4 | NO → "spot-proof" | One proof ≠ layer |
| Alloy (3 specs) | NO → "starting point" | Three specs ≠ layer |
| Z3 | PARTIAL | Scope to specific operators/laws |
| Stryker mutation | YES | Track mutation score |
| Semgrep + CodeQL | PARTIAL | Distinguish custom vs default rules |
| PR review agents | REFRAME | "Augments, not replaces" mechanical checking |
| markdownlint + tsc | YES | — |

## Runtime properties — scoping

| Property | Status | Beacon framing |
|----------|--------|---------------|
| DST | Real if replay works | "Deterministic from seed including time/randomness/IO" |
| Scale-free | Design claim | "Scale-free by design; scaling limits not yet characterized" |
| Lock-free | Checkable | Grep for lock statements, audit |
| Wait-free | Aspirational | Keep labeled aspirational |
| Weight-free | Novel term | Define precisely or use existing terminology |
| Reversible | Strongest claim | "Reversible within Z-set algebra; thermodynamic leak at /tmp bounded" |

## Claude.ai's key recommendations

1. Specify drift signals before dashboard goes live
2. Calibrate alert thresholds (too sensitive = noise, too rare = drift accumulates)
3. Name specific threat models (specification gaming, value drift, capability/control gap, coordination failure)
4. Verification-coverage view in DORA dashboard
5. Deprecation path for verification layers
