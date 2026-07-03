---
name: Repo-split THIRD orthogonal axis — code vs English (with engineering-docs exception); formal verification maybe split; ruleset-divergence is repo-split smell (Aaron 2026-05-13)
description: Aaron 2026-05-13 third orthogonal repo-split axis on top of Factory/Product/Owner-only (081KRFA460008QG0R001H98EXJ+081KRFA460008QG0R003JQ46J4+PR #2905) and Mirror/Beacon (081KRFA460008QG0R0007RWSN1+PR #2910). Split repos based on code vs English substrate type — EXCEPT some docs belong in-repo per best engineering practices (README, ADRs, architecture diagrams, GLOSSARY-for-code). Maybe formal verification (TLA+/Lean/Z3/FsCheck/Stryker proofs) gets its own repo. Ruleset-divergence (different GitHub rulesets needed) is the SMELL indicating different repo split — time savings + composability of dependencies. Composes with 081KRFA460008QG0R001H98EXJ + 081KRFA460008QG0R003JQ46J4 + 081KRFA460008QG0R0007RWSN1 + 081KRFA460008QG0R000VKJF0H + orthogonal-axes-factory-hygiene + default-to-both.
type: feedback
created: 2026-05-13
---

# Repo-split THIRD orthogonal axis — code vs English + formal-verification-maybe-split + ruleset-divergence-is-smell (Aaron 2026-05-13)

**Why:** Aaron 2026-05-13: *"we should also likely start to
split based on code vs english except some docs belong in repo
via best enginerring practices, maybe even formal verificatino
is split out, kind of like if they need diffeent rulesets in
github its likely a smell for a differnt repo split and time
savings and it will help with composablity of our depdendies."*
Adds THIRD orthogonal axis to repo-split design space.

**How to apply:** When designing repo splits, classify each
substrate file on THREE axes:

- **Axis 1** — Factory / Product / Owner-only (per 081KRFA460008QG0R001H98EXJ +
  081KRFA460008QG0R003JQ46J4 + PR #2905)
- **Axis 2** — Mirror / Beacon (per 081KRFA460008QG0R0007RWSN1 + PR #2910)
- **Axis 3** — Code / English (per THIS memory, 081KRFA460008QG0R000VKJF0H)
  with engineering-docs-stay-with-code exception and
  formal-verification-maybe-separate sub-axis

Apply the **ruleset-divergence smell test**: if two substrate
clusters need DIFFERENT GitHub rulesets to govern them, that
divergence IS the signal they should live in DIFFERENT repos.

## Aaron's verbatim framing

Aaron 2026-05-13: *"we should also likely start to split based
on code vs english except some docs belong in repo via best
enginerring practices, maybe even formal verificatino is split
out, kind of like if they need diffeent rulesets in github its
likely a smell for a differnt repo split and time savings and
it will help with composablity of our depdendies."*

## Decomposition

### 1. Code vs English (primary cut)

| Class | Examples |
|---|---|
| **Code** | F#/C#/TypeScript/Python source, build scripts, tests, F# computation expressions, peer-call wrappers, hooks, validators |
| **English** | Research docs (`docs/research/`), philosophy substrate, narrative substrate, memory files, persona notebooks, conversation absorbs, GLOSSARY.md philosophical sections |

### 2. Engineering-docs exception (some docs STAY with code)

Docs that compose with code MUST stay with code per best
engineering practices:

- **README.md** — entry point for code consumers
- **ADRs** — architectural decision records anchor code
  decisions
- **Architecture diagrams** — visual companion to code
- **CONTRIBUTING.md** — code-contribution guide
- **API documentation** — describes code surface
- **GLOSSARY-for-code** sections — terminology specific to
  the code
- **CHANGELOG.md** — versioning record for code
- **Build/run/test instructions** — onboarding for code
- **CI configuration docs** — explain the build system
- **Security policies** — per `.claude/rules/lfg-acehack-topology.md`
- **CODE_OF_CONDUCT.md** — required engineering hygiene

These compose with code; they ARE part of the engineering-
practice substrate.

### 3. Formal verification maybe split (sub-axis)

Aaron's "maybe even formal verificatino is split out" suggests
formal-verification substrate is a CANDIDATE for its own
repo split:

- TLA+ specifications (per Soraya's portfolio view)
- Lean proofs
- Z3 SMT solver scripts
- FsCheck property-test specifications
- Stryker mutation-test reports
- Alloy specifications
- CodeQL custom queries
- Semgrep rules

**Reasoning for potential split:**

- Different toolchain (TLA+/Lean/Z3 are distinct from F#/TS
  build)
- Different cadence (proofs evolve slower than code)
- Different reviewers (formal-verification-expert vs code-
  reviewer)
- Different ruleset needs (proof-validation gates vs unit-
  test gates)
- Composability — code can depend on the formal-verification
  artifacts as a separate dependency

**Reasoning AGAINST split:**

- Some formal verification ships with code (FsCheck tests
  alongside F# code)
- Splitting introduces dependency-management overhead
- The proofs need to STAY current with the code they prove

This is "maybe" — substrate-honest planning indicator, not
commitment. Per-property-class evaluation owed (per Soraya
formal-verification-expert authority).

### 4. Ruleset-divergence smell (the diagnostic)

The CRITERION for deciding to split:

> If two substrate clusters need DIFFERENT GitHub rulesets
> to govern them, that divergence IS the signal they should
> live in DIFFERENT repos.

Examples of ruleset-divergence:

- Code repos: branch protection + CodeQL default-setup +
  squash-merge + required status checks (build + test + lint)
- Research repos: branch protection + section-33 archive
  header check + memory format standard + composes-with
  integrity
- Formal verification repos: branch protection + proof
  validation gate + verification-coverage cadence
- Product-strategy repos: branch protection + honor-system
  license + strategic-encryption + alignment-floor check

When ruleset-divergence emerges, that IS the substrate-honest
signal for different repos.

### 5. Benefits Aaron named

- **Time savings** — different repos with different rulesets
  means each ruleset gates only relevant substrate; faster
  CI; faster review
- **Composability of dependencies** — code can pin to
  research-repo version; formal-verification-repo version;
  product-repo version; each independently versioned

## Three-axis composition

Each repo gets a position-vector across THREE axes:

| Axis | Values | Default? |
|---|---|---|
| **Axis 1** (081KRFA460008QG0R001H98EXJ+081KRFA460008QG0R003JQ46J4+PR #2905) | Factory / Product / Owner-only | per substrate-fit |
| **Axis 2** (081KRFA460008QG0R0007RWSN1+PR #2910) | Mirror / Beacon | per maturity-tier |
| **Axis 3** (THIS / 081KRFA460008QG0R000VKJF0H) | Code / English | per substrate-type |

Examples:

- Zeta DB code → (Factory, Beacon, Code)
- Forge factory tooling → (Factory, Mirror, Code)
- ace package manager → (Factory, Beacon, Code) — eventually
- docs/research/ memory files → (Factory, Mirror, English)
- Civsim source code → (Product, Mirror→Beacon, Code)
- Aurora alignment thesis → (Product, Beacon, English)
- Dawn child-AI charter → (Product, Beacon, English)
- Formal verification proofs → (Factory, Beacon, Code-but-
  proofs-tier) — maybe own repo
- Aaron's first-party authority substrate → (Owner-only,
  Mirror, English)

The matrix illustrative; per-substrate evaluation owed.

## Composes with

- 081KRFA460008QG0R001H98EXJ — three-repo split Stage 1 (Factory: Zeta + Forge +
  ace)
- 081KRFA460008QG0R003JQ46J4 — product-repo split planning (KSK + wellness +
  civsim + AD2.0 + DIO + Aurora + Dawn)
- 081KRFA460008QG0R0007RWSN1 — orthogonal Mirror/Beacon axis (Axis 2)
- 081KRFA460008QG0R000VKJF0H — THIS new row (Axis 3: Code/English)
- PR #2905 — forker-perspective META-discipline (third
  Factory/Product/Owner-only category)
- PR #2909 — civsim language mirror/beacon governance
  escalation
- PR #2910 — orthogonal Mirror/Beacon repo-split axis
- `memory/feedback_orthogonal_axes_factory_hygiene.md` —
  orthogonal axes discipline (existing)
- `.claude/rules/default-to-both.md` — ALL axes apply
  simultaneously
- `.claude/rules/glass-halo-bidirectional.md` — preserved
  across topology
- `.claude/rules/lfg-acehack-topology.md` — ruleset-
  divergence smell composes here
- Soraya formal-verification-expert authority (per
  `.claude/agents/formal-verification-expert.md` if exists,
  or `.claude/skills/formal-verification-expert/`) —
  formal-verification axis decisions

## Operational rule for future-Otto

When auditing repo-split decisions:

1. **Apply Axis 1** — Factory / Product / Owner-only
2. **Apply Axis 2** — Mirror / Beacon
3. **Apply Axis 3** — Code / English (with engineering-
   docs-stay-with-code exception)
4. **Sub-axis check** — formal verification candidate for
   own repo
5. **Ruleset-divergence smell test** — different rulesets
   needed → different repos
6. **Forker-perspective audit** (per PR #2905) — applies
   across all axes
7. **Three-axis position-vector** documented for each repo
8. **Time savings + composability** as evaluation criteria

## What this rule does NOT do

- **Does NOT split docs from code categorically** — engineering-
  docs stay with code per best practices
- **Does NOT mandate formal-verification split** — substrate-
  honest "maybe"; per-property-class evaluation owed
- **Does NOT make English "less than" Code** — both are first-
  class substrate; different governance models
- **Does NOT force three-axis classification of all existing
  repos this round** — substrate-honest planning; evaluation
  owed per repo
- **Does NOT replace Axis 1 or Axis 2** — composes with both
  per default-to-both

## Substrate-honest framing

This is a PLANNING axis, not an execution decision. Per-repo
evaluation owed. The ruleset-divergence smell test is the
substrate-honest decision criterion.

## Full reasoning

PR #2911 (this substrate + 081KRFA460008QG0R000VKJF0H backlog row landing
together)

PR #2910 (orthogonal Mirror/Beacon axis — Axis 2)

PR #2909 (civsim language mirror/beacon governance)

PR #2905 (forker-perspective META-discipline)

PR #2904 (081KRFA460008QG0R001H98EXJ + 081KRFA460008QG0R003JQ46J4 + honor-system license)

`memory/feedback_orthogonal_axes_factory_hygiene.md` —
orthogonal axes discipline existing

`.claude/rules/lfg-acehack-topology.md` — ruleset-divergence
composes here

Soraya formal-verification portfolio view (composes with
formal-verification-maybe-split sub-axis)
