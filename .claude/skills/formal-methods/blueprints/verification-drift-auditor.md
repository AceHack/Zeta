---
name: verification-drift-auditor
description: Verification drift detection — audit Lean, TLA+, Z3, Semgrep against external sources for staleness and breakage.
---

# Verification Drift Auditor — Procedure

This is a **capability skill**. It encodes the *how* of
checking that our verification artifacts match their external
sources. The owning persona is the `formal-verification-expert`
(Soraya) at `.claude/agents/formal-verification-expert.md` —
this is her audit surface, not a new persona.

## Why this skill exists

Round-35 case study. `src/Core.Lean4/Lean4/DbspChainRule.lean`
shipped a theorem named `chain_rule`, advertised as "the DBSP
chain rule from Budiu et al.", with F# / TLA+ / Lean all
cross-referencing that name. A peer-reviewer cross-check
against arXiv:2203.16684 §3 uncovered that:

1. The paper's chain rule (Proposition 3.2) states
   `(Q1 ∘ Q2)^Δ = Q1^Δ ∘ Q2^Δ` where `Q^Δ := D ∘ Q ∘ I`, with
   **no preconditions**.
2. Our formalisation proved `Dop (f ∘ g) = f ∘ Dop g` with
   `Dop := f - f ∘ zInv`, requiring `f`, `g` both **linear and
   time-invariant**.

These are two different theorems. The paper result is stronger
(no preconditions) and uses a different definition of the
incremental operator (`D ∘ Q ∘ I`, not `D ∘ Q`). We would have
cited a weaker corollary as "Proposition 3.2" in a paper
submission — a credibility risk for POPL / PLDI targets in
`ROADMAP.md`.

No automation caught this. The audit surfaced it. The drift
auditor's job is to catch the next one before it ships.

## Scope

Every verification artifact in the repo that **claims fidelity
to an external source**. The auditor is tool-agnostic: the list
of verification backends grows over time (Alloy, F*, Stainless,
LiquidF# if it ever revives, Dafny, Viper, Lean's own mathlib,
whatever lands in round 40+), and the scope expands with the
portfolio rather than being re-scoped row-by-row.

### Scope rule (stable)

An artifact is **in scope** iff it satisfies all three:

1. It is a **verification artifact** — something that makes a
   falsifiable mathematical claim (a Lean theorem, a TLA+
   invariant, a Z3 lemma, a FsCheck property, an Alloy fact,
   an F\* refinement, etc.).
2. It **claims fidelity** to an external source — the
   artifact's name, its docstring, or a nearby comment cites
   a paper, a textbook, an RFC, or a canonical algorithm by
   author-year.
3. The **claim is external-facing** — somebody reading the
   artifact could reasonably conclude "this formalises
   X from paper Y". Purely internal algebraic identities
   with no external citation are out of scope (they go to
   `code-review-zero-empathy`).

### Tool registry (swappable)

The current in-scope tools are listed below with their paths
and citation markers. **This list is expected to grow**; a
new tool is added as a new row rather than as a new drift
class or a new procedure. When a new tool enters the
portfolio (per `formal-verification-expert`'s routing table),
it gains a row here in the same round.

| Tool | Artifact locations | Citation markers to grep |
|---|---|---|
| Lean 4 | `tools/lean4/**/*.lean` | docstring lines containing `arXiv:`, `DOI:`, venue names (`VLDB`, `POPL`, `PLDI`, `SIGMOD`, `ICFP`), or author-year (`Budiu et al.`, `Gupta-Mumick`) |
| TLA+ | `tools/tla/specs/**/*.tla` | module-level `\* Paper: ...`, `\* Proposition N.M of ...`, `\* Algorithm X of ...` |
| Z3 / SMT | `docs/formal/**/z3-*.md`, `**/*.smt2` | top-of-file citation block, `; Paper: ...` |
| FsCheck | `tests/**/*.fs` (and `src/**/*.fs` for in-line properties) | XML doc comments / `///` comments citing a paper or named theorem |
| Alloy | `tools/alloy/**/*.als` | `-- Paper: ...`, module-header comments |
| F\* (if adopted) | `tools/fstar/**/*.fst` | `(* Paper: ... *)` |
| Future tool | `<path pattern>` | `<marker pattern>` (add row on adoption) |

Rows are **swappable**. When `proof-tool-coverage.md` promotes
a tool from *Assess* to *Trial* / *Adopt*, the Architect or
the owning expert adds a row here in the same round — not a
separate round. The drift procedure (§"Procedure") does not
change; only the enumeration targets do.

### Out of scope

- Internal algebraic properties with no external citation.
- Benchmark-only code (`bench/**`) — perf is not fidelity.
- Test fixtures that exercise our own API shape, not a paper
  theorem.

## Six drift classes

Every finding is classified by one of these six classes. The
classes are stable; new findings extend existing rows rather
than adding new classes.

### Class 1 — Name drift

The theorem / property / spec carries a name that
overclaims relative to what it actually proves.

**Example.** `chain_rule` (round 35) named after Proposition
3.2 but proving a Theorem-3.3 corollary.

**How to catch.** Compare the artifact's name + docstring
label against the source's exact statement. If our statement
matches a *different* named theorem in the same paper, that is
a Class 1 drift (the paper already has a name for what we
proved, and it's not the name we used).

### Class 2 — Precondition drift

The artifact carries preconditions the source does not require,
or omits preconditions the source does require.

**Example (over-conditioned).** `chain_rule` (round 35) required
both operators linear + time-invariant; Proposition 3.2 has no
preconditions.

**Example (under-conditioned).** A TLA+ invariant that forgets
a "bounded buffer" hypothesis the paper stated for its proof.

**How to catch.** Line-diff the paper's hypotheses against the
artifact's hypotheses. Preconditions never freely drop off.

### Class 3 — Statement drift

The symbolic form diverges. The paper's operator is
`D ∘ Q ∘ I`; our operator is `D ∘ Q`. The paper's quantifier is
`∀Q1, Q2`; our quantifier is over only LTI `Q1, Q2`. The paper's
equality is on operators; our equality is pointwise on one
stream.

**How to catch.** Side-by-side rewrite: paper's goal shape on
the left, artifact's goal shape on the right. Any symbolic
mismatch that is not purely notational (e.g. `∘` vs `.`) is a
Class 3 drift.

### Class 4 — Definition drift

The artifact defines a helper term (e.g. `Dop`) in a way that
does not match the paper's corresponding term (e.g. `Q^Δ`).
When the definitions differ, every theorem stated in terms of
them differs too — so this class is often the root cause of
Class 3 findings.

**Example.** Our `Dop f := f - f ∘ zInv` (= `D ∘ f` when `f` is
linear) is definitionally distinct from the paper's
`Q^Δ := D ∘ Q ∘ I`. Same name "D"-style differential, different
operator.

**How to catch.** Every named term in the artifact (`Dop`,
`I`, `D`, `Qdelta`, `nextEpoch`) must have an explicit
mapping entry in the registry (§"Registry" below) pointing
back to the source's name for the same concept, or an
explicit note that it is a local helper without a source
counterpart.

### Class 5 — Numbering drift

The cited number (Proposition 3.2, Theorem 2.22, Equation 4.1)
is stable across the paper's drafts? **Not reliably.** arXiv
v1 numbering drifts from VLDB-final numbering drifts from
journal-final numbering. A citation that was correct in round
20 may be stale in round 40.

**Example.** Proposition 3.2 in Budiu et al. arXiv v1 might be
renumbered Proposition 4.1 in the VLDB Journal 2025 extension.

**How to catch.** Every citation must pin a **version**: a
specific arXiv version identifier (`arXiv:2203.16684v1`, not
`arXiv:2203.16684`), a DOI, or a canonical published venue.
A bare citation without version is a Class 5 drift to fix.

### Class 6 — Source-decay drift

The cited source no longer exists, has been retracted, or has
been superseded. Less common for foundational papers, but
critical for early-preprint citations and tool documentation.

**How to catch.** Periodic re-fetch of cited URLs (WebFetch /
WebSearch). Any 404, retraction notice, or "this paper has
been replaced by..." is a Class 6 drift.

## Registry — the auditor's map

A single file `docs/research/verification-registry.md`
maintains the (artifact → source) mapping. One row per
verification artifact that cites an external source. The
registry is the ground truth the auditor diffs against.

Row shape:

```markdown
### `<fully-qualified-name>`

- **Artifact.** `<path>:<line>` (Lean theorem / TLA+ property /
  Z3 lemma / FsCheck property).
- **Paper.** `<author-year>` — `<title>` — `<venue>` —
  `<pinned-version>` (e.g. `arXiv:2203.16684v1`).
- **Paper statement.** (verbatim, ≤ 4 lines, with the paper's
  exact symbols — transliterate Unicode where needed.)
- **Our statement.** (as it appears in the artifact, copy-paste.)
- **Preconditions diff.** (paper vs artifact — flag any
  asymmetry.)
- **Definition map.** (our helper terms → paper's terms.)
- **Last audit.** (date, auditor, round number, drift-class
  findings: "none" | "Class N: <one-line>".)
```

The registry is **append-only** for entries; rows are
**updated in place** for their "Last audit" block as audits
run. No row is silently removed — a removed artifact gets an
explicit "retired round N, replaced by <row>" terminator.

## Procedure — running an audit

Invoked by the Architect every 5-10 rounds, or after any
commit that adds a theorem / property / spec with an external
citation. The auditor does NOT edit the proof files — she
files findings and hands off to the `formal-verification-expert`
or the Architect.

### Step 1 — enumerate the citing artifacts

Walk the scope paths (§"Scope") and grep for citation markers:

```bash
grep -rnE 'arXiv:|doi\.org/|Budiu|Gupta-?Mumick|Proposition [0-9]+\.|Theorem [0-9]+\.' \
  tools/lean4 tools/tla/specs src tests docs/formal
```

Any hit without a matching registry row is a **Class 0:
unregistered citation**. File as a finding; recommend the
owner add a registry row in the same round.

### Step 2 — per-artifact drift check

For each registered artifact:

1. Re-read the artifact (don't trust the registry's
   verbatim-ness — it may be stale).
2. Re-fetch (or re-read from local cache) the paper section
   cited.
3. Walk the six drift classes in order; record findings.

### Step 3 — triage findings

Each finding gets a severity:

- **P0 — Shipped with wrong statement.** Paper submission
  risk, reviewer-credibility risk, or a downstream client
  (`F#` production code) relying on a theorem that doesn't
  say what it claims. The chain-rule case was P0.
- **P1 — Statement correct but over-/under-conditioned.** The
  theorem is true as stated, but the hypotheses don't match
  the paper. Usable internally, misleading externally.
- **P2 — Naming / numbering / cosmetic.** No mathematical
  drift; just drift in labels that will confuse a future
  reader. Fix eventually.
- **P3 — Source-decay preliminary.** Cited URL 404; the
  artifact may still be correct but the citation needs repair.

### Step 4 — output

A drift-audit report at
`docs/research/verification-drift-audit-YYYY-MM-DD.md` with:

```markdown
# Verification Drift Audit — round N — YYYY-MM-DD

## Top findings

1. **<artifact>** — P0 — Class <N>: <one-line>.
   - Source: <paper + version>.
   - Fix: <one-line recommendation>.
   - Handoff: <formal-verification-expert | Architect | owner of file>.

...

## Registry rows added / updated
- `<row-name>`: (added | updated: last-audit field).

## Notebook entry
(One paragraph logged to `memory/soraya/NOTEBOOK.md`.)
```

### Step 5 — hand-off

The audit report is the Architect's input for the next
round-close. The Architect routes each finding:

- **P0** → immediate fix in the round that follows.
- **P1** → added to the backlog with a rounded ETA.
- **P2** → scheduled to a hygiene sweep round.
- **P3** → logged to `memory/soraya/NOTEBOOK.md` and
  revisited next audit.

## What this skill does NOT do

- Does **not** edit any proof / spec / property / test file.
  It files findings; the edit goes via the owning expert.
- Does **not** prove new theorems. A "missing" proof is a
  different skill's job (`formal-verification-expert`).
- Does **not** replace peer review of a paper submission. It
  guards against drift; the paper itself still needs a human
  mathematician read.
- Does **not** treat the registry as authoritative over the
  paper. If the registry disagrees with the paper, the paper
  wins — update the registry (BP-08 analogue: the source of
  truth is the source, not our copy).

## Red flags the auditor escalates immediately

Seeing any of these in an artifact is an immediate P0 finding
regardless of severity heuristics:

- An artifact cites a paper **without a pinned version**
  (bare `arXiv:XXXX.XXXXX`, not `v1` / `v2`).
- A Lean theorem named after a paper proposition whose paper
  statement contains a quantifier (`∀Q1, Q2`) while the Lean
  statement quantifies over a subset (e.g. `LTI Q1, LTI Q2`).
- A TLA+ property whose safety invariant drops a hypothesis
  the paper declared in the pre-condition of the proof.
- A FsCheck property whose generator bounds differ from the
  paper's stated problem domain (e.g. paper says "positive
  integers", our generator says `int`).

## Reference patterns

- `docs/research/verification-registry.md` — the ground-truth
  map (created on first invocation if absent).
- `docs/research/chain-rule-proof-log.md` — the round-35
  motivating case study.
- `docs/AGENT-BEST-PRACTICES.md` — BP-NN rule IDs the auditor
  cites when a violation corresponds to a stable rule.
- `memory/soraya/NOTEBOOK.md` — the auditor's own
  state file, bounded by the notebook-hygiene rules in
  `.claude/skills/experience-and-product/blueprints/agent-experience-engineer.md`.
- `.claude/agents/formal-verification-expert.md` — the owning
  persona.
- `docs/TECH-RADAR.md` — ring assignments for formal tools
  (helps classify artifacts when the citation-to-tool mapping
  is ambiguous).

## Invocation cadence

- **Scheduled.** Every 5-10 rounds, same cadence as
  `skill-tune-up` and `factory-audit`.
- **Triggered.** Any commit introducing a new `theorem` /
  `lemma` / TLA+ property / FsCheck property with an external
  citation.
- **Manual.** When the Architect or a human maintainer flags
  a specific artifact ("is this actually what the paper
  says?") — exactly the round-35 chain-rule trigger that
  motivated this skill.
