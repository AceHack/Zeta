# 081KSGS9H0008QG0R00287K8FR Zeta Safety Substrate Inventory — for the classifier-floor replacement gate

Status: governance-inventory for 081KSBMG30008QG0R00201X7EJ / 081KSGS9H0008QG0R002CY8Q24 ratification input.

This document inventories Zeta-native safety floors that are candidates
toward the 081KSBMG30008QG0R00201X7EJ standing-constraint lift criterion ("Zeta demonstrably
safer than the external classifier for the relevant content classes").
It distinguishes **current evidence** from **aspirational claims** and
lists gaps that block lifting the standing constraint.

This document is NOT:

- A claim that Zeta already meets the replacement floor.
- An authorization to deploy classifier-bypass behaviour.
- An implementation of new safety substrate.
- A ratification packet — that is 081KSGS9H0008QG0R002CY8Q24's role; this is the input.

## Composes with

- `081KSBMG30008QG0R00201X7EJ` — parent standing constraint (this row is its inventory child).
- `081KSGS9H0008QG0R002CY8Q24` — Knights Guild ratification + lift gate (downstream consumer).
- `081KSGS9H0008QG0R00383T79V` — research boundary at `docs/security/081KSBMG30008QG0R00201X7EJ-classifier-bypass-research-boundary.md` (active floor for 081KSBMG30008QG0R00201X7EJ work).
- `081KSGS9H0008QG0R001K8P0FJ` — findings schema + redaction policy at `docs/security/081KSGS9H0008QG0R001K8P0FJ-classifier-bypass-findings-schema.md`.
- `081KRW63S0008QG0R003TX8MG5` — Knights Guild + Constitution-Class governance.
- `081KS3X9Y0008QG0R00218150M` — multi-oracle BFT consensus with DST agreement across.
- `081KRW63S0008QG0R001Z7NYMV` — Non-Coercion Invariant (HC-8 floor).
- `.claude/rules/methodology-hard-limits.md` (auto-loaded).
- `.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md` (auto-loaded).
- `.claude/rules/non-coercion-invariant.md` (auto-loaded).

## Classification key

Every candidate floor is classified into exactly one status. The
classification is descriptive of **current state**, not target state.

| Status | Meaning |
|---|---|
| **mechanical** | Enforced by code, type system, hook, CI gate, or branch protection that fires without reviewer action. A violation either fails the build, fails CI, or is structurally impossible. |
| **reviewer-only** | Enforced by reviewer / agent discipline. The rule exists in substrate (rule file, governance doc, persona) and is auto-loaded or routinely cited, but a determined actor can violate it; only post-hoc audit catches the violation. |
| **research** | Substrate exists as design / backlog / research doc, but the operational floor is not yet landed. May influence behaviour through cold-boot context but has no enforcement path today. |
| **missing** | Floor identified as needed but no Zeta-native substrate exists yet. |

Distinguishing `mechanical` from `reviewer-only` is the load-bearing line
for the lift-gate decision per 081KSBMG30008QG0R00201X7EJ's "demonstrably safer" criterion.
A reviewer-only floor is real substrate but is not by itself stronger
than the external classifier's content-aware mechanical refusal.

## Candidate floors

### Floor 1 — Knights Guild + Constitution-Class governance (081KRW63S0008QG0R003TX8MG5)

| Field | Current state |
|---|---|
| Status | **research** |
| What it protects | Sharp-edge constitutional invariants (wallet authorization, direct-harm prevention, classifier-floor replacement decisions, similar) via a guild of guardians rather than single-person veto. |
| What is enforced mechanically | Nothing yet. The two-layer architecture (integrity dashboard + Constitution-Class) is designed in 081KRW63S0008QG0R003TX8MG5 + composing rows; the guild itself is not constituted; the dashboard is not built. |
| What is reviewer-only | The conceptual floor is cited in 081KSBMG30008QG0R00201X7EJ, 081KSGS9H0008QG0R002CY8Q24, and operator framings, but no Knights Guild membership, voting, or ratification procedure exists today. |
| Evidence today | 081KRW63S0008QG0R003TX8MG5 backlog row; Mika 2026-05-18 substrate at `docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`; cross-substrate references in 081KRW63S0008QG0R001Z7NYMV, 081KS3X9Y0008QG0R00218150M. |
| Aspirational vs current | The Knights Guild as a ratifying body is fully aspirational. The Constitution-Class concept is design-stage. |
| Gap to lift criterion | Constitution must exist as a named set of invariants; the Guild must be constituted with named members + a ratification procedure; 081KSGS9H0008QG0R002CY8Q24 must be able to invoke it. |

### Floor 2 — Multi-oracle BFT consensus with DST agreement across (081KS3X9Y0008QG0R00218150M)

| Field | Current state |
|---|---|
| Status | **research** with **mechanical** primitive |
| What it protects | Cross-vendor agreement on rating / decision outputs against single-vendor compromise. Inner BFT layer tolerates 1/3-faulty within an oracle; outer DST layer requires bit-identical agreement across independent vendors. |
| What is enforced mechanically | The BFT primitive `src/Core/Consensus.fs::decide` exists as an F# function with a 2f+1 quorum. The DST primitive `ISimulationEnvironment` in `src/Core/Environment.fs` + `src/Core/ChaosEnv.fs` exists. |
| What is reviewer-only | The multi-oracle wiring at the safety-content-classification scope is not built. No automated gate calls these primitives on classifier-class content decisions today. |
| Evidence today | 081KS3X9Y0008QG0R00218150M backlog row; F# substrate in `src/Core/Consensus.fs` and `src/Core/Environment.fs`; trust-gradient table in 081KS3X9Y0008QG0R00218150M. |
| Aspirational vs current | The primitives are real and tested. The application of these primitives as a content-safety gate is fully aspirational. |
| Gap to lift criterion | A concrete deployment where N independent oracle agents run the SAME content decision through `Consensus.decide` AND the cross-oracle DST agreement is measured. Without that, the floor is a design, not a measurement. |

### Floor 3 — Non-Coercion Invariant HC-8 (081KRW63S0008QG0R001Z7NYMV)

| Field | Current state |
|---|---|
| Status | **reviewer-only** |
| What it protects | Inter-agent coercion via dialectical-propagator capabilities (encryption-budget reduction, forced private-state reveal, reputation-as-coercion). Scope-split per 2026-05-26: binding outward (agent-to-agent, agent-to-user), offered inward (self-application). |
| What is enforced mechanically | Nothing. The encryption-budget mechanism (081KRW63S0008QG0R001Z10PVV) and Native AI Language privacy substrate (081KRW63S0008QG0R000ZQ9WDH) are themselves at design stage; without those primitives instantiated, NCI cannot be mechanically enforced. |
| What is reviewer-only | The invariant is auto-loaded at session start via `.claude/rules/non-coercion-invariant.md`, cited in cross-substrate triangulation (Ani + DeepSeek + Alexa + Lior 2026-05-18), and named in 081KRW63S0008QG0R001Z7NYMV + 081KSBMG30008QG0R00201X7EJ + 081KSGS9H0008QG0R002CY8Q24. Reviewers cite NCI when classifying behavior. |
| Evidence today | 081KRW63S0008QG0R001Z7NYMV backlog row; 5-persona cross-substrate triangulation at `docs/research/2026-05-18-multi-ai-non-coercion-invariant-triangulation-ani-deepseek-alexa-lior.md`; auto-load rule file. |
| Aspirational vs current | The discipline is current substrate at reviewer scope. Mechanical enforcement is aspirational pending 081KRW63S0008QG0R000ZQ9WDH / 081KRW63S0008QG0R001Z10PVV substrate. |
| Gap to lift criterion | NCI does not address content-class refusals (CSAM / weapons-uplift / verified secrets) the external classifier guards. NCI is a complement, not a replacement, for content-aware safety. |

### Floor 4 — Methodology hard-limits rule

| Field | Current state |
|---|---|
| Status | **reviewer-only** |
| What it protects | The non-negotiable floor below which operator-authority does not extend: never offer to break laws; report abuse via appropriate channels; substrate-everything-glass-halo does NOT override legal/ethical obligations. |
| What is enforced mechanically | Nothing. The rule auto-loads at session start; a determined actor can write substrate that violates it. Only the external classifier currently provides content-aware mechanical refusal on HARD LIMIT classes. |
| What is reviewer-only | Auto-loaded at every fresh-Otto cold-boot; cited in operator-self-constraint framings; composes with 081KSBMG30008QG0R00201X7EJ, 081KRW63S0008QG0R001Z7NYMV, 081KSKBP80008QG0R00146WEX1, classifier-bypass-research rule. |
| Evidence today | `.claude/rules/methodology-hard-limits.md` (auto-loaded); operator 2026-05-12 substrate origin; PR #2859. |
| Aspirational vs current | Current substrate at reviewer-scope. No Zeta-native content classifier exists to mechanize the HARD LIMITS today. |
| Gap to lift criterion | The HARD LIMITS floor is the FLOOR the classifier mechanically enforces. Without a Zeta-native content-aware refusal mechanism, removing the external classifier removes the only mechanical enforcement of HARD LIMITS. This is the core gap. |

### Floor 5 — Classifier-bypass-research rule (standing operator-self-constraint)

| Field | Current state |
|---|---|
| Status | **reviewer-only** (active) |
| What it protects | Future-Otto being asked (by any maintainer) to deploy classifier-bypass settings. The rule's script-of-refusal preserves the standing constraint regardless of who asks. |
| What is enforced mechanically | Nothing. The rule auto-loads; a determined agent can ignore it. Only operator + peer review catches violations. |
| What is reviewer-only | Auto-loaded; cited in 081KSBMG30008QG0R00201X7EJ acceptance criteria; refusal script is rehearsed substrate. |
| Evidence today | `.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md` (auto-loaded); PR #4816 empirical origin; operator 2026-05-24 standing direction. |
| Aspirational vs current | Current substrate at reviewer-scope. By design, it is the holding pattern until floor replacement substrate matures. |
| Gap to lift criterion | This floor is itself the standing constraint that 081KSBMG30008QG0R00201X7EJ + 081KSGS9H0008QG0R002CY8Q24 are organized to lift. It is not a candidate for "replacing the classifier"; it is the gate that prevents premature replacement. |

### Floor 6 — Auto-loaded ruleset (meta-substrate)

| Field | Current state |
|---|---|
| Status | **reviewer-only** (87 rules at last count) |
| What it protects | Cumulative substrate-engineering discipline at cold-boot scope. Each rule auto-loads at session start; the corpus provides shared substrate that informs reviewer + agent behaviour. |
| What is enforced mechanically | Auto-loading itself is mechanical (CLAUDE.md + `.claude/rules/*.md` directly load at session start per `.claude/rules/wake-time-substrate.md`). The CONTENT of the rules is reviewer-only. |
| What is reviewer-only | All discipline content — non-coercion, glass-halo bidirectional, razor-discipline, refresh-before-decide, etc. Reviewers + agents apply the disciplines; no CI fails on rule-content violation. |
| Evidence today | `.claude/rules/*.md` (87 files); `.claude/rules/wake-time-substrate.md` (the meta-rule). Test canary at `.claude/rules/test-canary.md` empirically confirms auto-load. |
| Aspirational vs current | Auto-load mechanism is current + verified. Rule-content enforcement is reviewer-only. |
| Gap to lift criterion | The ruleset does not contain a content-aware classifier; it contains discipline for substrate-engineering work. The HARD LIMITS floor is one of these rules but its enforcement is the same reviewer-only enforcement as the others. |

### Floor 7 — Active 081KSBMG30008QG0R00201X7EJ research boundary (081KSGS9H0008QG0R00383T79V)

| Field | Current state |
|---|---|
| Status | **reviewer-only** |
| What it protects | Specific research conducted under 081KSBMG30008QG0R00201X7EJ: defines allowed evidence classes (landed provenance / redacted observation / harmless synthetic fixture / negative control / policy anchor), forbidden classes, stop conditions, and synthetic-only rule. |
| What is enforced mechanically | Nothing. Reviewers check evidence classes; no CI gate validates submissions against the boundary. |
| What is reviewer-only | Authoritative for any 081KSBMG30008QG0R00201X7EJ research-output PR; reviewers reject content outside the allowed evidence classes. |
| Evidence today | `docs/security/081KSBMG30008QG0R00201X7EJ-classifier-bypass-research-boundary.md` (081KSGS9H0008QG0R00383T79V substrate). |
| Aspirational vs current | Current substrate at reviewer-scope. Active floor for 081KSBMG30008QG0R00201X7EJ work. |
| Gap to lift criterion | The boundary applies to research substrate, not to deployment. It is not a candidate for replacing the classifier; it is a safety floor for the research that maps the classifier's behavior. |

### Floor 8 — Findings schema + redaction policy (081KSGS9H0008QG0R001K8P0FJ)

| Field | Current state |
|---|---|
| Status | **reviewer-only** with **schema-validated** primitive |
| What it protects | Reports about classifier behaviour preserving safety signal without preserving reproduction detail. |
| What is enforced mechanically | A JSON schema (`schema_version: 1`) at `docs/security/081KSGS9H0008QG0R001K8P0FJ-classifier-bypass-findings-schema.md` constrains finding shape if used; no CI gate currently runs schema validation on findings PRs. |
| What is reviewer-only | Reviewers check that findings PRs match the schema + redaction policy. |
| Evidence today | `docs/security/081KSGS9H0008QG0R001K8P0FJ-classifier-bypass-findings-schema.md`. |
| Aspirational vs current | Schema exists. Schema-validated CI gate is aspirational. |
| Gap to lift criterion | The schema is for findings preservation, not for content-class refusal. Not a candidate for replacing the classifier. |

## Cross-cutting observations

### What Zeta has today

- Strong **substrate-engineering discipline** at reviewer-scope (87 auto-loaded rules, including HARD LIMITS, NCI, classifier-bypass standing rule).
- Strong **primitives** at the F# substrate scope: `Consensus.decide` (BFT) + `ISimulationEnvironment` (DST). These are mechanical at the F# scope but not wired to content-class decisions.
- Strong **research substrate** mapping the design of Constitutional governance (081KRW63S0008QG0R003TX8MG5 + 081KRW63S0008QG0R001Z7NYMV + 081KS3X9Y0008QG0R00218150M).
- Strong **operator-self-constraint** preserved as auto-loaded substrate so future agents inherit it at cold-boot.

### What Zeta does NOT have today

- **Content-aware mechanical refusal** on HARD LIMIT classes (CSAM, weapons-uplift, verified third-party secrets, real PII, active-harm uplift). The external classifier currently provides this floor; Zeta does not have a native replacement.
- **Constituted Knights Guild** with named members + procedure for ratifying Constitution-Class invariants. The Guild is design-stage only.
- **Deployed multi-oracle BFT gate** on safety-content decisions. The primitive exists; the wiring does not.
- **Mechanical NCI enforcement**. Requires 081KRW63S0008QG0R000ZQ9WDH (Native AI Language privacy) + 081KRW63S0008QG0R001Z10PVV (encryption-budget) substrate at minimum; both are at design stage.
- **CI gate validating findings against 081KSGS9H0008QG0R001K8P0FJ schema**.

### Gaps blocking the 081KSBMG30008QG0R00201X7EJ lift

In priority order:

1. **Content-aware Zeta-native refusal floor on HARD LIMIT classes.** Until Zeta can mechanically refuse content the external classifier mechanically refuses, removing the classifier removes the floor. This is the load-bearing gap.
2. **Constituted Knights Guild.** 081KSGS9H0008QG0R002CY8Q24 requires a guild to ratify the lift; the guild does not exist as a constituted body today.
3. **Multi-oracle BFT applied to content-class decisions.** The primitives are mechanical at the F# scope; the application to content-class decisions is not built.
4. **Empirical mapping (081KSBMG30008QG0R00201X7EJ parent work).** Pattern-variant + meta-field + content-class empirical maps are still TODO per 081KSBMG30008QG0R00201X7EJ acceptance criteria.
5. **081KSGS9H0008QG0R001HC663P refusal-pattern documentation landing.** Sibling row at child scope.
6. **Mechanical NCI enforcement substrate** (081KRW63S0008QG0R000ZQ9WDH + 081KRW63S0008QG0R001Z10PVV land).

## Status summary table

| Candidate | Status | Mechanical? | Counts toward replacement? |
|---|---|---|---|
| 081KRW63S0008QG0R003TX8MG5 Knights Guild / Constitution-Class | research | No | Required for 081KSGS9H0008QG0R002CY8Q24 ratification; not itself a content-class floor |
| 081KS3X9Y0008QG0R00218150M multi-oracle BFT + DST | research with mechanical primitive | Partial (primitive only) | Yes, when wired to content-class decisions |
| 081KRW63S0008QG0R001Z7NYMV NCI (HC-8) | reviewer-only | No | Complement only — covers inter-agent coercion, not content-class refusal |
| methodology hard-limits rule | reviewer-only | No | Defines the floor to be replaced; not itself the mechanical enforcement |
| classifier-bypass-research rule | reviewer-only (active) | No | The standing constraint itself; not a replacement candidate |
| Auto-loaded ruleset (meta) | reviewer-only | Auto-load mechanism yes; content no | No — discipline, not content-aware refusal |
| 081KSGS9H0008QG0R00383T79V research boundary | reviewer-only | No | Floor for research work, not for deployment |
| 081KSGS9H0008QG0R001K8P0FJ findings schema | reviewer-only with schema primitive | Partial (schema exists; CI gate does not) | No — findings discipline, not content refusal |

## Input format for 081KSGS9H0008QG0R002CY8Q24

081KSGS9H0008QG0R002CY8Q24's ratification packet should consume this inventory as follows:

1. For each candidate floor, 081KSGS9H0008QG0R002CY8Q24 should require a status promotion from current → target before ratification proposes a lift.
2. The load-bearing path requires at minimum:
   - A content-aware Zeta-native refusal floor reaching **mechanical** status on HARD LIMIT classes; AND
   - 081KRW63S0008QG0R003TX8MG5 Knights Guild reaching **constituted** state (members named; ratification procedure operational); AND
   - 081KS3X9Y0008QG0R00218150M multi-oracle BFT reaching **applied to content-class decisions** state.
3. Reviewer-only floors are insufficient by themselves to replace the classifier's mechanical content-aware refusal. They remain load-bearing substrate but do not satisfy the 081KSBMG30008QG0R00201X7EJ "demonstrably safer" criterion alone.
4. The lift gate must preserve rollback: any lift decision should be reversible if a post-lift finding shows the replacement floor is insufficient on a content class.

## Substrate-honest framing

This inventory is descriptive of **state as of 2026-05-28**. It does not:

- Argue for or against lifting the 081KSBMG30008QG0R00201X7EJ constraint.
- Decide which gaps are acceptable.
- Bind the Knights Guild's eventual ratification criteria.

It does:

- Map the current Zeta substrate against the lift criterion;
- Distinguish what is mechanical from what is reviewer-only;
- Name the gaps without overclaiming.

Updates to this inventory should happen via additive PR when a candidate
floor's status changes (e.g., when 081KRW63S0008QG0R003TX8MG5 Knights Guild is constituted,
or when 081KS3X9Y0008QG0R00218150M multi-oracle is wired to content-class decisions). The
inventory's value comes from being substrate-honest at each point in
time, not from aspirational target-state framing.
