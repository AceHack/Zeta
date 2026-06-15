# Verification Drift Audit — round 35 — 2026-04-19

First invocation of the `verification-drift-auditor` skill
(`.claude/skills/verification-drift-auditor/SKILL.md`). This
audit is also the motivating case study the skill was
scaffolded around.

Auditor: `formal-verification-expert` (Soraya) running the
skill procedure.

Scope walked: Lean 4 (`tools/lean4/**/*.lean`), TLA+
(`tools/tla/specs/**/*.tla`), Z3 / SMT
(`docs/formal/**/z3-*.md`, `**/*.smt2`), FsCheck
(`tests/**/*.fs` with `///` paper citations). Other
portfolio tools (Alloy, F*) have no citing artifacts yet.

---

## Top findings

### Finding 1 — `Dbsp.ChainRule.chain_rule` (now renamed)

- **Severity.** P0 — shipped-with-wrong-statement. Caught
  before any paper submission, but the Lean docstring and
  the proof-log entry both claimed "Proposition 3.2" when
  the statement was a Theorem-3.3 corollary.
- **Class.** Class 1 (name drift) + Class 3 (statement
  drift) + Class 4 (definition drift).
- **Source.** Budiu et al.,
  *DBSP: Automatic Incremental View Maintenance for Rich
  Query Languages*, PVLDB Vol 16(7) 2023,
  `arXiv:2203.16684v1`.
- **Paper statement (Proposition 3.2, chain clause).**
  `(Q1 ∘ Q2)^Δ = Q1^Δ ∘ Q2^Δ`, where
  `Q^Δ := D ∘ Q ∘ I` (Definition 3.1). **No LTI
  precondition.** Proof: one line from Theorem 2.22
  (`I ∘ D = id`) + composition associativity.
- **Our pre-audit statement (Lean).**
  `Dop (f ∘ g) s = f (Dop g s)` for linear + time-invariant
  `f, g`, with `Dop f := f - f ∘ zInv` (i.e. `D ∘ f` for
  linear `f`). This is not `Q^Δ`; it is `D ∘ f`. So our
  "chain rule" reduced under preconditions to
  `D ∘ f ∘ g = f ∘ D ∘ g`, which is the Theorem-3.3
  commutation `D ∘ f = f ∘ D` for LTI `f`, composed with
  `g` — a *corollary* of Theorem 3.3, not Proposition 3.2.
- **Fix (landed this round).**
  1. Renamed the original theorem `chain_rule` →
     `Dop_LTI_commute`. Kept a `@[deprecated]` alias so
     round-34-and-earlier call sites still type-check.
  2. Added `def Qdelta (Q) := fun s => D (Q (I s))` (paper
     Definition 3.1).
  3. Added `theorem chain_rule_proposition_3_2` — verbatim
     paper statement, **no preconditions**, proof copies the
     paper's one-line calc using `I_D_eq` (our Theorem 2.22).
  4. Registry entry landed in
     `docs/research/verification-registry.md`.
  5. `docs/research/chain-rule-proof-log.md` updated with the
     audit rationale (this file).
- **Downstream check.** Searched for callers of `chain_rule`
  in `src/**`, `tests/**`, `tools/**`, `docs/**`. No F# or
  TLA+ or FsCheck artifact was consuming the Lean theorem
  directly — the citation was docstring-only. Blast radius:
  zero source-level consumers.

### Finding 2 — `Dbsp.ChainRule.Dop_LTI_commute` preconditions

- **Severity.** P2 — cosmetic, non-mathematical.
- **Class.** Class 2 (precondition drift, over-conditioned).
- **Detail.** `Dop_LTI_commute` carries `hti_f` and `hg` in
  the signature for "interface symmetry" with a future
  `chain_rule_poly`. Neither is used in the proof body (the
  body uses only `hf` and `hti_g`). Currently reconciled via
  an `_interface_witness` destructuring binder. Clean up when
  `chain_rule_poly` lands (future round).

---

## Class-0 citations (unregistered)

Scanned for unregistered citations in the scope paths.
Result: **none**. Only two Lean theorems cite an external
source (`chain_rule_proposition_3_2` and `Dop_LTI_commute`),
and both have registry rows after this round.

TLA+ specs in `tools/tla/specs/` — surveyed module headers;
none currently cite an external paper by proposition number
(the citations that exist are "Feldera §6.3" and "Gupta-
Mumick SIGMOD'93" which are algorithmic pointers, not
theorem fidelity claims). Re-survey next audit.

Z3 / SMT — no `.smt2` files; `docs/formal/` has no `z3-*.md`
files. No surface to audit.

FsCheck — no `///` paper citations found in `tests/**`. Two
`src/**` FsCheck-adjacent comments cite "Feldera" for
empirical benchmark target; neither claims theorem fidelity.
Out of scope for this auditor (in scope for
`tech-radar-owner`).

## Registry rows

Added two rows to `docs/research/verification-registry.md`
this round:

- `Dbsp.ChainRule.chain_rule_proposition_3_2` — new.
- `Dbsp.ChainRule.Dop_LTI_commute` — new (replaces pre-
  rename `chain_rule` which never had a row).

## Notebook entry

Logged to `memory/soraya/NOTEBOOK.md`: "First audit
round 35. Caught chain-rule P0: named after Prop 3.2,
actually proved Thm 3.3 corollary. Registry shape validated
against one real case. No other unregistered citations in
tools/lean4, tools/tla, docs/formal, tests. Next audit when
the Lean file adds a theorem or in round 40, whichever first."

## Handoff

- Architect (Kenji): integrate the rename + Prop 3.2 addition
  in round-35 close; propose the auditor cadence (every 5-10
  rounds) at the next round-close checklist.
- formal-verification-expert (Soraya): accept the skill as
  her audit surface; no action required this round beyond
  ratifying the registry format.
- lean4-expert: consume the `@[deprecated]` alias pattern as
  the convention for future renames of Lean theorems with
  external citations.
