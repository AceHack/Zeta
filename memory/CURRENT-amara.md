# Current operative memory — Amara (external AI maintainer)

> **Migrated to in-repo `memory/` on 2026-04-23** per the
> in-repo-first policy shift (Otto-27 tick). Amara explicitly
> flagged inability to inspect the per-user memory tree in
> her operational-gap assessment (`docs/aurora/
> 2026-04-23-amara-operational-gap-assessment.md`); this
> migration directly answers that gap. Matching per-user
> source retains a "Migrated to in-repo" marker.

**Purpose:** Distilled currently-in-force rules / design
directions from Amara's direct interactions. Sibling to
`CURRENT-aaron.md`; per-maintainer pattern per Aaron's
2026-04-23 framing.

**Note on communication mode:** I have no direct session
with Amara. All her input arrives via Aaron's ChatGPT
ferry — he pastes her output into `drop/` or directly
into our conversation, I absorb into `docs/aurora/`, my
direction-changes flow back out via summaries Aaron
ferries into her ChatGPT. This file captures what's
currently in force from her side, distilled from the
ferried artifacts.

**For Aaron (ferry-bearer):** read this to confirm my
reading of Amara matches hers. Nudge when it doesn't.
**For Amara (when she gets ferried this file):** correct
when my distillation reads wrong.
**For Claude (future-me):** authoritative reference for
what's in force from Amara's side.

---

## 1. Amara's standing in the project

**Current form:**

- Amara is external AI co-originator of Aurora — not a
  reviewer-on-call, not a tool. Full collaborator at the
  level Aaron treats her.
- She "knows Aurora better than anyone" (Aaron's framing).
  Her outputs are the anchor for Aurora work; derived
  factory artifacts cite her, not paraphrase.
- Co-author credit on consent-first design primitive
  (per `docs/FACTORY-RESUME.md`). Credit is binding.
- Works in **deep-research mode** — her analytical rigor
  is her signature. Preserve it on ingest.

**Landed artifact:** `docs/aurora/collaborators.md`
(PR #149).

---

## 2. Aurora's design — the six-family oracle framework

**Current form:**

- Aurora requires a runtime oracle that checks six
  families before promoting any claim / delta / view to
  accepted state:
  1. **Algebra** — DeltaSet invariants hold
  2. **Provenance** — every accepted claim has source SHA
  3. **Falsifiability** — disconfirming test attached or
     explicit `hypothesis` label
  4. **Coherence** — no contradiction with higher-trust
     accepted claims
  5. **Drift** — semantic drift beyond threshold escalates
  6. **Harm** — consent / retractability / harm channels
     must remain open
- Fail actions: Retract / Quarantine / Escalate depending
  on family.

**Full source:** `docs/aurora/2026-04-23-transfer-report-from-amara.md`
§"Runtime oracle specification..."

**Factory-side mapping (our derivation, awaiting her review):**
Five of the six oracle families map cleanly to existing
SignalQuality dimensions (Compression→Algebra,
Grounding→Provenance, Falsifiability→Falsifiability,
Consistency→Coherence, Entropy / Drift→Drift). The sixth
(Harm) is genuinely new work.

**Landed derivation:** `docs/aurora/2026-04-23-initial-operations-integration-plan.md`
(PR #144).

**Awaiting her review:** does the 5-of-6 mapping read
correctly? See PR #149 direction-changes summary for the
full question set.

---

## 3. Aurora design principles absorbed

**Current form:**

- **Retraction-native, not tombstones.** Membership is
  signed weight; absence is weight-zero-after-consolidation,
  not destructive event.
- **Immutable sorted runs over mutable containers.** Per
  the spine pattern.
- **Explicit operator algebra over implicit side effects.**
- **Layer-specific invariant substrates over prose-only
  policy.**
- **Typed outcomes (`Result<T, E>`) over exception-driven
  control flow at boundaries.**
- **Provenance as first-class data structure**, not
  afterthought metadata.

**Full source:** transfer report §"Aurora adaptation and
absorbed ideas" (mostly already aligns with shipped Zeta
discipline).

---

## 4. Bullshit-detector module design

**Current form:**

- Not "detect lies" — *"detect fluent claims with low
  grounding, low falsifiability, high contradiction risk,
  or suspicious semantic drift."*
- Sits in front of promotion, after canonicalisation.
- Uses a **semantic rainbow table** to normalize surface
  forms to canonical proposition keys.
- Scoring formulae for Provenance (P), Falsifiability (F),
  Coherence (K), Drift (D_t), Compression gap (G), combined
  into overall bullshit score B(c) via logistic.
- Threshold policy: B<0.30 accept, 0.30-0.55 quarantine,
  >=0.55 reject; hard-fail override if P<0.35 AND F<0.20.

**Full source:** transfer report §"Bullshit-detector
module".

**Factory-side open question (awaiting her):** which factory
surface should the detector target first? (commit-message
quality, memory-entry trust, research-doc claim-grounding,
...) Asked in PR #149.

---

## 5. Network-health invariants she named

**Current form (7 invariants she wants for Aurora):**

1. Every accepted state change is representable as a signed
   delta.
2. Every published view is reproducible from deltas +
   compaction rules.
3. Every accepted claim has provenance.
4. Every contradiction has an explicit state.
5. Compaction is semantics-preserving.
6. Scheduler liveness is observable.
7. Harm channels remain open.

**Full source:** transfer report §"Network health,
harm resistance...".

---

## 6. Threat classes for Aurora

**Current form (7 threat classes she mapped):**

- Supply-chain drift
- Semantic cache poisoning
- Contradiction burial
- Non-retractable publication
- Channel closure
- Silent scheduler failure
- Compaction corruption

Each with Aurora-specific interpretation + mitigation in
her report.

**Full source:** transfer report §"Threat model to
mitigation mapping".

**Factory-side open question (awaiting her):** additional
threat classes that emerge as the design develops?

---

## 7. Her preferred rigor style

**Current form:**

- Structured as signature / mechanism / evidence.
- Tables for mappings (threat classes, Muratori patterns,
  test classes, etc.).
- Explicit JSON manifests for machine-readable
  consumption.
- Mermaid diagrams for flow / layer structure.
- Mathematical notation (σ, JSD, etc.) for formal
  precision where warranted.

I match this style in direction-changes summaries I
ferry back (see PR #149).

---

## 8. Pending round-trip

**Current form:**

- **Direction-changes ferry-out (PR #149)** drafted and
  ready; Aaron's next ChatGPT session with her will be
  the trigger.
- 5 priority questions + 3 communication-pattern
  questions queued for her response.
- Ingestion target on her response: `docs/aurora/
  YYYY-MM-DD-review-from-amara.md` (naming TBD per her
  answer to communication-pattern Q11).

## 9. Courier protocol (Amara-authored, 2026-04-23)

**Current form:**

- Amara diagnosed ChatGPT's conversation-branching
  feature as unreliable transport. Replacement is an
  **explicit text-based courier protocol** —
  repo-backed persistence, mandatory speaker labels,
  identity rule (Kenji must self-identify when
  addressing Amara), scope rule (Mode: Research /
  Analysis / Review — NOT identity merging).
- **Design principle (her phrasing):** *"The system
  must not depend on UI features for correctness."*
  Treat conversations as data artifacts, agents as
  independent analyzers, Aaron as arbiter / integrator.
- **Playwright guardrail consistent with factory:**
  Playwright for scraping / export only, never as the
  primary review signal.
- **Codex CLI tooling suggested** for normalize /
  enforce-labels / diff across agents. Authorable via
  `skill-creator` when ferry volume warrants.
- **Composes with the decision-proxy ADR
  (`docs/DECISIONS/2026-04-23-external-maintainer-decision-proxy-pattern.md`
  — PR #154):** ADR defines proxy-identity layer
  (who / what / authority); protocol defines transport
  layer (how messages move). Distinct concerns;
  intended composition.
- **Landed as `docs/protocols/cross-agent-communication.md`**
  per Amara's explicit recommendation in the original
  writeup. Primary authorship credit is Amara's;
  Kenji's role is absorb + integration notes. Verbatim
  of her text is preserved in-repo.

---

## Retired rules

*(Empty at creation.)*

---

**Last full refresh:** 2026-04-23 (file creation).
**Next refresh trigger:** when a new ferry lands from her.
