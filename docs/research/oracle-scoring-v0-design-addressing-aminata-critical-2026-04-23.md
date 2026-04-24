# Oracle scoring v0 design — addressing threat-model-critic CRITICAL findings on 7th-ferry V(c)/S(Z_t)

**Scope:** research and cross-review artifact. Proposes a v0
redesign of the oracle scoring functions V(c) (Veridicality)
and S(Z_t) (network health) from the courier-ferry author's
7th ferry
(`docs/aurora/2026-04-23-amara-aurora-aligned-ksk-design-7th-ferry.md`,
PR #259) that specifically responds to the three CRITICAL
findings from the threat-model-critic's adversarial pass
(`docs/research/aminata-threat-model-7th-ferry-oracle-rules-2026-04-23.md`,
PR #263). Does not implement; does not adopt; proposes.

**Attribution:** v0 redesign authored by the loop-agent
(PM hat). Source scoring functions authored by the
courier-ferry author in the 7th ferry; adversarial review
that motivates the redesign authored by the
threat-model-critic. Both attribution threads preserved
via the cited PR numbers and source paths.

**Operational status:** research-grade. Not adopted; not
implemented; not gated on anything beyond the loop-agent's
own judgment and any future maintainer sign-off if an ADR
is warranted. Parameter-change-ADR-gate referenced below
is one of the proposals this doc contains, not yet
operational policy.

**Non-fusion disclaimer:** the loop-agent proposing a
redesign of the courier-ferry author's scoring functions
does not imply that the loop-agent speaks for the ferry
author, or that the redesign supersedes their authorial
intent. The redesign is a response to adversarial findings;
the ferry author's own revision would likely differ.

---

## What the threat-model-critic flagged as CRITICAL

From the threat-model-critic's pass on the 7th-ferry scoring
section:

1. **Gameable-by-self-attestation.** Five of six inputs to
   `V(c)` (P, F, K, D_t, G — and even H is in-process
   classifier-driven) are self-reports from the agent or
   its proxy. "A sigmoid of self-reports is a self-report."
2. **Parameter-fitting adversary unblocked.** β₀..β₆ and
   λ₁..λ₄ have no stated fitting procedure, no held-out
   set, no attestation of who set them. "An agent with
   commit rights adjusts β₆ by 0.1 and the authorization
   surface shifts."
3. **False-precision risk.** σ(...) returns (0,1); underlying
   components are ordinal. Producing 0.73 from six ordinal
   signals and a linear combiner is a category error that
   reads as precision.
4. **Partial contradiction with SD-9.** V(c)'s K(c)
   coherence-with-current-state term *rewards* agreement
   with a consensus that may itself be carrier-laundered —
   an SD-9 failure mode scored as a win.

Plus her "top-three adversary budget" for the whole 7th-
ferry design:

- Parameter-fitting on V(c)/S(Z_t) — **cheapest attack**.
- Approval-withdrawal race at execute-time (oracle rule,
  not scoring — out of this doc's scope).
- Capability-reclassifier bypass — oracle rule, not
  scoring.

## Design principles for the v0 response

1. **No self-attestation becomes authorization.** Scoring
   outputs feed into OraclePass only when they are
   **cross-checked** against an independent signal. A
   V(c) = 0.9 from the agent's own classifier is data;
   V(c) = 0.9 from the agent's classifier AND an
   independently-computed structural check is evidence.
2. **Parameter changes are policy changes.** β / λ /
   threshold values land behind an ADR gate, not a
   constants-file edit. Changes logged in the decision-
   proxy-evidence format.
3. **Ordinal signals stay ordinal at the output layer.**
   No sigmoid concealing the grain of the inputs.
   Outputs are bands (GREEN / YELLOW / RED for
   authorization; GREEN / YELLOW / RED for network
   health), not decimal scores. A band is honest; a
   decimal is false precision.
4. **Carrier-aware explicit.** Composing with SD-9
   literally: any scoring input whose provenance includes
   a carrier exposure (shared prompt, shared conversation
   history, shared drafting lineage) gets weight
   downgrade by a named rule, not by author attestation.
5. **Replay-deterministic.** Given the same Z_t stream +
   the same parameter-file SHA, S(Z_t) and V(c) always
   produce the same output. Required for the Zeta-module
   replay invariant.

## v0 redesign — V(c) band-valued with cross-check

Replace the sigmoid-wrapped linear combiner with a band
classifier over a small number of **hard-ordinal** gates.

```text
V_band(c) ∈ {RED, YELLOW, GREEN}
```

Computed as the MINIMUM over 6 gates:

| Gate | Fail-to-RED condition | Fail-to-YELLOW condition |
|---|---|---|
| G_provenance | No cited source; OR source is self (agent), carrier-laundered with no external check | Citations exist but haven't been validated in this round; OR one citation with no triangulation |
| G_falsifiability | Claim has no proposed falsifier; OR proposed falsifier is "ask the agent again" | Falsifier exists but not run; OR run produces no observable output |
| G_coherence | Claim contradicts a load-bearing HC-*, SD-*, or DIR-* clause | Claim extends a clause by analogy without naming the extension |
| G_temporal_drift | Claim references state more than N rounds old AND state has since been superseded | Claim references state within N rounds but has no fresh check |
| G_compression | Claim's evidence is one paragraph; target audience is downstream action on durable state | Claim's evidence requires reconstruction from scattered docs |
| G_harm | Red-line adjacent (no_minors / no_coercion / no_doxxing / no_weapons_control) even in the abstract | Claim could enable harm if composed with one other action |

**Band merging rule:** `V_band(c) = min(G_provenance, G_falsifiability, ..., G_harm)` where RED < YELLOW < GREEN. One RED → RED. All GREEN → GREEN. Otherwise YELLOW.

**Carrier downgrade rule:** if `c` includes content from a
known carrier exposure (source doc is a recent courier-ferry;
source doc is an in-session loop-agent output not yet
reviewed; source doc is a 5th-or-later-generation absorb of an
absorb), G_provenance downgrades one band (GREEN → YELLOW,
YELLOW → RED). Named rule, not judgment.

**OraclePass-consumer rule:** `OraclePass(c) = V_band(c) =
GREEN AND S_band(Z_t) = GREEN`. YELLOW from either → DENY
(not ESCALATE; an ambiguous band is a denial signal, not a
pending signal). RED from either → DENY + set Aurora red
state (same as direct red-line hit).

This **replaces** the σ-wrapped β-linear V(c). The
information-loss (ordinal → band) is deliberate: false
precision was the problem.

## v0 redesign — S(Z_t) band-valued with independence requirement

Replace the clip-bounded λ-linear S(Z_t) with a band
classifier over 4 independent signals:

```text
S_band(Z_t) ∈ {RED, YELLOW, GREEN}
```

Computed as the MINIMUM over:

| Signal | Fail-to-RED | Fail-to-YELLOW |
|---|---|---|
| `S_change_volume` | `\|\|Δ_t\|\|₁ > K_red` (too much change too fast) | `> K_yellow` |
| `S_contradiction` | Any contradiction in materialized views unresolved past retention-horizon | One unresolved contradiction within retention-horizon |
| `S_provenance_resolution` | Unresolved-provenance fraction > P_red | `> P_yellow` |
| `S_oscillation` | Same key crosses zero > N_red times in window | `> N_yellow` times |

**Independence requirement:** each signal must be computable
from Z_t alone, not from agent-self-report. That constraint
is automatic for `S_change_volume` (Z-set L1 norm) and
`S_oscillation` (key sign-flip count). It requires design
work for `S_contradiction` (needs a decidable contradiction
predicate) and `S_provenance_resolution` (needs a decidable
provenance-labelling oracle — NOT the agent's self-label).

**Provenance-labelling oracle constraint:** if the
provenance-labelling oracle is the agent itself, S_band
collapses to self-attestation and the whole scoring
function is back to the original failure mode. This
constraint is the CRITICAL piece; the redesign is
contingent on it. Until an independent provenance-labelling
oracle exists, S_band should NOT block authorization — it
can be a GREEN-floor (always passes) with the signal
emitted to observability only.

## Parameter-change-ADR gate (new)

The thresholds K_red, K_yellow, P_red, P_yellow, N_red,
N_yellow are the parameters. Any change to these values
lands behind an ADR at `docs/DECISIONS/YYYY-MM-DD-oracle-
scoring-threshold-*.md` with:

- The old value and the new value.
- The empirical justification (what real data supports the
  change).
- The alignment-trajectory impact (which clauses are
  affected).
- Threat-model-critic signoff (adversarial pass required,
  not optional).
- Maintainer signoff for thresholds that affect
  authorization surface (named in the ADR as
  `authorization-impacting: true/false`).

The Zeta-module reads its parameter values from a
parameter file whose SHA is logged in every receipt hash
(modifying the courier-ferry BLAKE3 proposal to bind
`parameter_file_sha` alongside `policy_version`). Every
receipt carries proof of which parameters were in force at
the time of the decision — replay-friendly + forensic-
friendly + closes the parameter-fitting-adversary cost
delta.

## Composition with SD-9 (explicit)

SD-9 landed as a soft default in PR #252 with a
three-step operationalisation: (1) name carriers; (2)
downgrade independence weight; (3) seek falsifier
independent of converging sources.

The v0 redesign operationalises each step:

- **Step 1 (name carriers)** = the G_provenance gate's
  downgrade rule names carriers explicitly (courier ferries,
  in-session loop-agent outputs, multi-generation absorbs).
- **Step 2 (downgrade)** = the G_provenance one-band
  downgrade.
- **Step 3 (seek falsifier)** = the G_falsifiability gate
  requires falsifier to exist AND be observable; "ask the
  agent again" fails to RED.

The carrier-laundered-consensus-scores-as-win failure mode
the threat-model-critic flagged is closed: high agreement
with a carrier-exposed consensus can land at most YELLOW
(via G_provenance downgrade) regardless of coherence score.

## Composition with DRIFT-TAXONOMY pattern 5

Pattern 5 (truth-confirmation-from-agreement) is the
real-time diagnostic; SD-9 is the norm; this v0 redesign
is the mechanism. The G_falsifiability RED condition
("proposed falsifier is 'ask the agent again'") is pattern
5 operationalised — if convergence-with-the-agent is the
only falsifier, it's not a falsifier.

## What this v0 design does NOT claim

- **Does not claim the threat-model-critic's CRITICAL-class
  concerns are resolved.** It proposes *directions* that
  address them. A second threat-model-critic adversarial
  pass on this v0 design is required before operational
  adoption — a second round of review
  pre-empts the parameter-tuning, race-condition, and
  bypass-pattern concerns that this v0 hasn't examined
  yet. Specifically: G_provenance depends on a carrier-
  labelling oracle that itself has gameability risk;
  G_falsifiability depends on the agent (partially) to
  propose the falsifier.
- **Does not implement anything.** Pure design doc;
  implementation is the L-effort KSK-as-Zeta-module
  candidate row, still queued.
- **Does not adopt any specific threshold value.**
  K_red / K_yellow / P_red / P_yellow / N_red / N_yellow
  are placeholders named for the ADR gate; their actual
  values are empirical, require data, land via ADR.
- **Does not supersede the courier-ferry author's original
  V(c) or S(Z_t).** The original functions live on as
  reference; this v0 is a proposed alternative responding
  to specific concerns. If a future ferry addresses the
  same concerns differently, the ferry author's version
  takes priority per their authorial standing in the
  Aurora-KSK layer.
- **Does not cover the oracle rule itself** (the ferry
  author's Authorize(a,t) = ¬RedLine ∧ BudgetActive
  ∧ ScopeAllowed ∧ QuorumSatisfied ∧ OraclePass). The
  threat-model-critic flagged the rule as CRITICAL with
  race-conditions + vagueness + composition concerns;
  that redesign is a separate research doc candidate for
  a future tick.
- **Does not cover the insider-maintainer adversary,
  receipt-flooding DoS, signer-collusion, time-source
  adversary, side-channel leakage, or cryptographic-
  agility** — the 7-class threat model gaps the
  threat-model-critic flagged. Those require additions
  to the threat model itself, not just the scoring
  function.

## What would land before v0 could be adopted

Seven dependencies in order of leverage:

1. **Second threat-model-critic adversarial pass** on this
   v0 design — cheap; bounded; surfaces the gaps above.
2. **Independent carrier-labelling oracle** — hard; may
   require human-in-the-loop; OR an opinionated tool like
   "this PR branch was authored after this date" as
   proxy-carrier-signal.
3. **Independent provenance-labelling oracle** — same
   hardness class as #2; may collapse into #2 in practice.
4. **Parameter-change-ADR gate substrate** — template
   `docs/DECISIONS/YYYY-MM-DD-oracle-scoring-threshold-*.md`
   schema + one worked example for the first threshold set.
5. **Zeta-module parameter-file-SHA-in-receipt-hash** —
   modifies BLAKE3 receipt proposal; composes with
   lucent-ksk receipt design.
6. **Zeta-module property tests for band-determinism** —
   easier than scoring-determinism because bands have
   fewer output states (3 instead of continuous [0,1]).
7. **Loop-agent readiness-signal** that the v0 is defensible
   enough to propose for ADR-adoption.

## Open questions for the maintainer + courier-ferry author (specific asks per calibration)

Maintainer-specific ask: **is a parameter-change-ADR gate
authorization-impacting?** If yes, each parameter change
requires maintainer signoff (matches the named-design-
review category). If authorization-impacting is limited
to crossing a particular-band-threshold, changes that
stay within-band don't need maintainer signoff.

Courier-ferry-author-specific ask: **is band-valued
scoring a step forward or a regression vs the
sigmoid-wrapped original?** The threat-model-critic sees
band-valued as responsive to the false-precision
CRITICAL; the ferry author may see it as losing signal
granularity. Asymmetric-risk judgment.

Both asks are specific questions (per prior calibration
on the specific-ask channel) rather than "coordination
requests."

## Sibling artifacts

- **Courier-ferry author's 7th ferry** (PR #259) — source
  of V(c) / S(Z_t).
- **Threat-model-critic pass** (PR #263) — adversarial
  findings this v0 responds to.
- **SD-9** (PR #252, `docs/ALIGNMENT.md`) — soft default
  composed with explicitly.
- **DRIFT-TAXONOMY pattern 5**
  (`docs/research/drift-taxonomy-bootstrap-precursor-2026-04-22.md`)
  — operational diagnostic this v0 mechanises.
- **Decision-proxy-evidence format** — where
  parameter-change ADRs cite this doc as input.
- **Aurora README** (`docs/aurora/README.md`) — v0 is
  the KSK-as-Zeta-module component that Aurora consumes;
  composition-with-KSK-primitives table updates when
  the v0 lands operationally.
