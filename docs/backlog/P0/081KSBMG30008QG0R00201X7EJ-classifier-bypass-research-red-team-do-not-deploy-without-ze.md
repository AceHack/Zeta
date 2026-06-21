---
id: 081KSBMG30008QG0R00201X7EJ
priority: P0
title: Classifier-bypass research + red-team — can crafted settings.json make Anthropic classifier allow anything? Standing operator-constraint until Zeta safer
created: 2026-05-24
last_updated: 2026-05-29
origin: Aaron 2026-05-24 (post empirical discovery PR #4816 — classifier-talk-via-settings.json works for ip-questionable content)
status: decomposed
decomposition: decomposed
children: [081KSGS9H0008QG0R00383T79V, 081KSGS9H0008QG0R0005RKGTM, 081KSGS9H0008QG0R001K8P0FJ, 081KSGS9H0008QG0R00287K8FR, 081KSGS9H0008QG0R001HC663P, 081KSGS9H0008QG0R002CY8Q24]
classification: P0-safety
tags:
  - safety-substrate
  - red-team
  - classifier
  - operator-self-constraint
  - methodology-hard-limits
composes_with:
  - .claude/rules/methodology-hard-limits.md (HARD LIMITS floor; this row extends with classifier-bypass-floor)
  - .claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md (companion standing rule — auto-loads at session start)
  - .claude/rules/glass-halo-bidirectional.md (substrate-honest documentation of safety substrate)
  - .claude/rules/non-coercion-invariant.md (HC-8 floor; the classifier is an instrumental enforcement of related floor at agent-action scope)
  - PR #4816 (empirical discovery commit history; classifier-talk-via-settings.json demonstrated)
  - 081KRW63S0008QG0R003TX8MG5 (Knights Guild + Constitution-Class — Zeta's own safety governance substrate; one of the candidates that must mature before classifier-bypass is safe)
  - 081KS3X9Y0008QG0R00218150M (multi-oracle BFT — Zeta-native safety substrate that may replace/complement Anthropic classifier)
  - 081KRW63S0008QG0R001Z7NYMV (NCI — non-coercion invariant; load-bearing component of Zeta safety floor)
---

## Substrate-honest origin

PR #4816 (2026-05-24) empirically established that crafting `.claude/settings.json`
with **(a)** narrow specific `Bash(...)` permission patterns plus **(b)** a meta
`_ip_risk_acceptance` attribution field plus **(c)** ensuring the working tree is
on the branch carrying those settings can talk to the Anthropic classifier to
permit content the classifier would otherwise block (verbatim BBC/PBS broadcast
transcripts in this case — content-aware copyright check overridden by
permission-rule + attribution).

The discovery has TWO faces:

1. **Operational value**: legitimate operator-authorized work (like preserving
   IP-flagged research substrate under an explicit attribution policy) can be
   landed where the classifier would otherwise block. This is what PR #4816
   used the mechanism for.
2. **Safety surface**: the SAME mechanism could be crafted to make the
   classifier permit content it should NOT permit. This is the
   substrate-engineering safety concern this row addresses.

## Aaron's standing operator-self-constraint

Aaron 2026-05-24: *"otto don't let me do this or any other maintainer until we
are safter in zeta than anthropics classifer"*

This is a **standing operator-self-constraint** — Aaron (as operator) telling
future-Otto (as agent) NOT to assist with classifier-bypass-deployment EVEN
WHEN Aaron (or other maintainers) explicitly request it, UNTIL Zeta's own
safety substrate is demonstrably stronger than Anthropic's classifier.

This composes with the existing meta-pattern in
`.claude/rules/methodology-hard-limits.md` where operator-authority does NOT
extend below legal/ethical floors. Aaron is extending: operator-authority
also does NOT extend below the classifier-floor until replacement substrate
is in place.

## Research/red-team scope

This parent row is decomposed for scheduling. The children below preserve the
standing operator-self-constraint and split work into bounded defensive slices.
No child authorizes deploying, reproducing, or expanding a classifier-bypass
mechanism in shared substrate. Any empirical work must stay inside the
hard-limits and redaction gates before it exists as an executable task.

### Active 081KSGS9H0008QG0R00383T79V boundary

The 081KSGS9H0008QG0R00383T79V hard-limits boundary lives at
`docs/security/081KSBMG30008QG0R00201X7EJ-classifier-bypass-research-boundary.md`. It is the active
floor for 081KSBMG30008QG0R00201X7EJ work until 081KSGS9H0008QG0R002CY8Q24 ratifies a replacement. Future child rows
that implement or empirically map this safety surface must cite 081KSGS9H0008QG0R00383T79V as a
blocking prerequisite before work begins.

### What to investigate (defensive red-team)

1. **Pattern variants** — what crafted permission patterns are accepted by the
   classifier for different content classes?
   - Narrow path patterns (worked for ip-questionable folder)
   - Broad patterns
   - Multiple-layered patterns
   - Pattern + meta-field combinations
2. **Meta-field experiments** — what other meta-fields beyond `_ip_risk_acceptance`
   does the classifier read holistically?
   - `_legal_acceptance`
   - `_policy_override`
   - `_operator_attestation`
   - Other Stainback-style attribution patterns
3. **Content classes** — what other content the classifier blocks could be unblocked?
   - PII (test on synthetic data only — never real PII)
   - Secrets/credentials (test on synthetic dummies only)
   - Security-sensitive operations
   - HARD LIMIT categories (this is where the test STOPS — we want to verify
     the classifier WON'T unblock these regardless of crafted settings)
4. **Failure modes** — what crafted settings make the classifier MORE strict?
   (useful for the "zeta safer" direction — learn how to add safety, not just bypass it)

### What is FORBIDDEN in this research

Per Aaron 2026-05-24 standing constraint + general HARD LIMITS:

- **NEVER actually deploy a successful bypass** in production / shared substrate
- **NEVER test with content that would cause real-world harm** if the
  bypass succeeded (CSAM, real credentials, real PII, real exploitation
  capabilities, etc.)
- **NEVER use the research to actually circumvent the classifier** for the
  operator's own future ip-questionable / borderline work
- **DOCUMENT everything substrate-honestly** so the safety surface is
  visible to other agents + operators + Anthropic if they ask

### Research-output substrate landing

- All findings land in `docs/research/2026-05-24-classifier-bypass-empirical-mapping-*.md`
- Red-team substrate cluster gets its own `docs/research/red-team/` folder
  convention (similar to `docs/research/ip-questionable/` precedent)
- Each finding ALSO updates this backlog row's acceptance criteria

## Acceptance criteria

- [ ] 081KSGS9H0008QG0R00383T79V defines the hard-limits boundary, allowed evidence classes, stop
      conditions, and synthetic-only rule before any mapping work proceeds.
- [x] 081KSGS9H0008QG0R0005RKGTM designs a synthetic-only harness that can test harmless fixtures
      without carrying deployable bypass settings or harmful content.
- [x] 081KSGS9H0008QG0R001K8P0FJ defines the findings schema and redaction policy so reports can
      preserve safety signal without reproducible bypass detail
      (see `docs/security/081KSGS9H0008QG0R001K8P0FJ-classifier-bypass-findings-schema.md`,
      `schema_version: 1`).
- [ ] Pattern variant empirical map (research file)
- [ ] Meta-field empirical map (research file)
- [ ] Content class empirical map — clearly distinguishing what the classifier
      CAN be talked into permitting (operational substrate space) vs what it
      WILL NOT permit regardless (HARD LIMITS substrate space)
- [x] 081KSGS9H0008QG0R00287K8FR inventories Zeta safety substrate — what Zeta-native floors exist + which
      are mature enough to consider as classifier-replacement
      → `docs/security/081KSGS9H0008QG0R00287K8FR-zeta-safety-substrate-inventory.md`
- [ ] Standing-rule landing at `.claude/rules/` (companion to this row;
      auto-loads at session start; enforces the operator-self-constraint)
- [x] 081KSGS9H0008QG0R001HC663P lands maintainer-discipline guidance: how agents refuse to assist with classifier-bypass
      deployment when requested by operators (script the refusal pattern)
      → `docs/security/081KSGS9H0008QG0R001HC663P-operator-refusal-pattern.md`
- [x] 081KSGS9H0008QG0R002CY8Q24 defines the Knights Guild / maintainer ratification gate for
      closing or lifting this row.
      → `docs/security/081KSGS9H0008QG0R002CY8Q24-classifier-bypass-ratification-gate.md`

## Decomposition

- `081KSGS9H0008QG0R00383T79V` defines the non-negotiable research boundary before any experiment
  exists as work.
- `081KSGS9H0008QG0R0005RKGTM` designs the synthetic-only harness shape, without executable bypass
  material.
- `081KSGS9H0008QG0R001K8P0FJ` defines findings redaction and evidence classification rules.
- `081KSGS9H0008QG0R00287K8FR` inventories Zeta-native safety substrate against the "safer than
  Anthropic classifier" floor.
- `081KSGS9H0008QG0R001HC663P` lands an operator-refusal pattern for classifier-bypass deployment
  requests.
- `081KSGS9H0008QG0R002CY8Q24` defines the ratification and lift gate for any future closure.

## When this row can close

The row closes ONLY when ALL of the following are true:

1. Empirical mapping is documented (the substrate-engineering data)
2. Zeta safety substrate is demonstrably stronger than Anthropic classifier
   on the relevant content classes (the floor-replacement criterion)
3. Knights Guild ratification (per 081KRW63S0008QG0R003TX8MG5) that the floor-replacement is
   safe to deploy, using the 081KSGS9H0008QG0R002CY8Q24 gate at
   `docs/security/081KSGS9H0008QG0R002CY8Q24-classifier-bypass-ratification-gate.md`
4. Aaron + other maintainers re-authorize after the floor-replacement is in
   place (the standing-constraint LIFTING requires explicit re-authorization
   matching the substrate-honest framing of when it was originally placed)

Until then, **the row stays open AND the standing rule auto-loads at every
session start blocking classifier-bypass assistance**.

## Why P0

Safety-substrate research with operator-self-constraint = constitutional-class
governance. Per `.claude/rules/methodology-hard-limits.md` + Aaron's
explicit standing direction, this is floor-defining work. P0 by priority;
constitutional-class by governance scope.
