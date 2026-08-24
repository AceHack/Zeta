# KSK is the kinetic rung — and Zeta already built four of its parts

**Register:** a located finding plus four measured convergences. The escalation frame and
the child-floor resolution are Aaron's (Mirror); the convergences are measured; the gap in
§6 is the only piece of new work identified.

## 1. The question

Aaron 2026-08-24, after describing an escalation ladder — *"Zeta is pushing hardware to
its limits and creating the guardrails for hardware, money, then kinetics"* — asked to see
*"our KSK … made by max."*

I first searched Zeta for a key-signing key and found nothing attributable. Wrong
expansion. Aaron: *"it's a different repo under lfg called ksk or **kinetic safeguard sdk**
… and we have the proto lineage of this with my amara bootstrap conversation in our
history."* Both halves check out.

## 2. Located

**`Lucent-Financial-Group/lucent-ksk`** — one commit, `maximdolphin`, *"add docs"*,
**2025-11-23**. Docs only: `.claude/agents/kfc/*`, `docs/development_guide.md`,
`docs/ksk_architecture.yaml`. **Public.** Nine months without a push.

`docs/ksk_architecture.yaml` is `aurora-ksk` **v1.0.0-draft**:

> *"Local-first safety kernel that gates AI autonomy through priced, revocable budgets,
> multi-party consent, and signed receipts with optional blockchain anchoring."*

**The proto-lineage is in Zeta**, exactly where Aaron said: `docs/aurora/` (25 files),
including `2026-04-23-amara-aurora-aligned-ksk-design-7th-ferry.md`. Zeta already cites the
KSK line in `docs/BACKLOG.md`, `docs/GLOSSARY.md`, and `docs/FACTORY-DISCIPLINE.md` — so
this is a **known** lineage that had gone quiet, not a discovery.

## 3. Its capability surfaces ARE the escalation ladder

The spec's three surfaces are the same ordering Aaron stated, keyed by irreversibility:

| surface | scope | gate |
|---|---|---|
| `observe.k1` | read-only; fetch / simulate / draft | none |
| `influence.k2` | low-risk writes; edit docs, open tickets | budget |
| `actuate.k3` | merge / deploy, **transfer funds**, destructive ops | budget **+ N-of-M** |

The ordering matters because **the retraction algebra changes at each rung**. A Z-set
retraction works because `+1` then `−1` annihilates in consolidation. Money has no `−1`
you may issue unilaterally; kinetics has none at all. So the substrate's core correction
mechanism stops applying exactly where the stakes are highest — which is why the guardrail
cannot be the same mechanism scaled up, and why `k3` needs a *different* gate rather than
a bigger budget.

## 4. Four convergences — already built in Zeta, absent from KSK

| KSK needs | Zeta has | state |
|---|---|---|
| `n_of_m` approvals | `src/Core/MultiSignatureVerification.fs` (502 lines) + `MultiSignatureVerification.Tests.fs` | built, tested, carries the **B1** correction: it is **k-of-n multi-signature**, NOT a threshold signature (Desmedt–Frankel/Shamir); the file records that *"a cryptographer reading only the old title would have built the wrong primitive"* |
| `revoke` | Z-set retraction — grant `+1`, revoke `−1` | Aaron's own *"revoke is retract"*; the algebra is the DBSP one |
| priced, revocable budgets | privacy-budget-as-hard-money: **spend / stake / never confiscate** | `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` |
| `repair_first` — disputes route to repair before penalties | **tit-for-lesser-tat** | Aaron's stated infinite-game strategy |

Douceur's *Sybil Attack* (2002) is cited in `MultiSignatureVerification.fs` for precisely
the reason KSK needs it: **an off-roster identity must never contribute to a threshold.**

## 5. The `red_lines` tension, and Aaron's resolution

KSK hardcodes `red_lines: [no_minors, no_coercion, no_doxxing, no_weapons_control]` — a
**fixed moral floor**, which reads as a conflict with the Multi-Oracle Principle (§11: no
single mandatory morality).

Aaron 2026-08-24 resolved it, and the resolution is structural rather than a compromise:

> *"the fixed moral floor is always protect children and disagree on their age around
> 16-21."*

Two different kinds of thing, and separating them dissolves the conflict:

- **The predicate — protect children — is invariant.** It is not a competing morality
  submitted to §11; it is the floor every oracle stands on. §11's own text already carves
  this out as the *default* oracle for morally-relevant entities.
- **The threshold — ~16 to 21 — is jurisdictional.** A parameter. Disagreement about it is
  expected and legitimate.

This is the same shape as his jurisdictional meta-frame: **where the line falls varies by
who draws it; that a line exists does not.** And it inherits the right default — where
jurisdictions disagree, take the protective bound, because *unknown-include beats
unknown-exclude* (Aaron, same day): an unknown that halts is recoverable, one that ships is
not.

## 6. The gap — the floor is proven, the threshold is unparameterized

**`src/Core.Lean4/Safety/ChildFloor.lean`** (119 lines, *"All proven, no `sorry`"*) already
discharges the hard half. Its headline, `denied_never_executed` (line 83): **an effect the
policy denies is never executed, at ANY depth (`fuel`)** — so an agent cannot get a gated
effect executed by *proposing* it. The file's own summary of that:

> **"`source ≠ authorization` made structural."**

That is the no-directives rule as an induction proof rather than a convention. Soraya's
routing note records why Lean and not TLA+: it is a reachability property over a recursive
depth-bounded effect tree, so TLC would prove only a bounded-depth instance rather than the
universal statement.

**What is missing is small and specific:** `ChildFloor.lean` proves the **gate** is
unbypassable; KSK's `red_lines` names the **policy**. Nothing connects a jurisdiction's age
parameter to that policy. The floor is proven; the threshold is a constant nobody has
declared. That is the one piece of real work this ferry identifies.

> **[Added 2026-08-24, after this ferry landed]** Closed by
> **081M0TJXY32087G0R003TBTR7V** — `src/Core.Lean4/Safety/ChildFloorPolicy.lean` (proven,
> `sorry`-free, universally quantified over the registry),
> `src/Core.TypeScript/child-floor/jurisdiction-threshold.ts` (the running mirror),
> `db/child-floor/jurisdiction-readings.json` (the declared table, attributed and dated —
> legal *readings*, not verified law). `ChildFloor.lean` is unchanged: every result
> instantiates its `denied_never_executed` rather than restating it. **Two halves of the gap
> remain open and are named rather than papered over:** the classifier (`classOf` /
> `subjectOf`) is not proven correct, and no deployed gate consumes the policy yet — the
> ObserveBridge `Effect` taxonomy carries no subject and no age. See `db/child-floor/README.md`.

## 7. Register

`unmetered` — no code changed and nothing here was executed. The convergences in §4 are
measured (files exist, line counts verified, tests present); whether KSK *should* adopt
them is a decision for its owner. `lucent-ksk` being **public** is stated as a fact, not a
recommendation.

## Pointers

- `Lucent-Financial-Group/lucent-ksk` · `docs/ksk_architecture.yaml` (aurora-ksk v1.0.0-draft)
- `docs/aurora/2026-04-23-amara-aurora-aligned-ksk-design-7th-ferry.md` — the proto-lineage
- `src/Core/MultiSignatureVerification.fs` — k-of-n, the B1 naming correction, Douceur
- `src/Core.Lean4/Safety/ChildFloor.lean` — `denied_never_executed`, fuel-indexed
- `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` — spend / stake / never confiscate
- `.claude/rules/manifesto-13-specifications.md` §11 — the Default Oracle this section reconciles with
