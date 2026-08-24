# `child-floor/` — the jurisdictional threshold for a proven floor

The **predicate** is invariant: protect children. The **threshold** is a parameter, and this
directory is where it is declared.

Aaron 2026-08-24:

> *"the fixed moral floor is always protect children and disagree on their age around 16-21."*

Two different kinds of thing, and separating them is the whole design. The predicate is not a
competing morality submitted to the Multi-Oracle Principle (`manifesto-13-specifications.md`
§11) — it is the floor every oracle stands on, which §11's own text carves out as the *default*
oracle for morally-relevant entities. The threshold is jurisdictional, and disagreement about
it is expected and legitimate.

## Where each half lives

| half | surface | register |
|---|---|---|
| the gate is unbypassable | `src/Core.Lean4/Safety/ChildFloor.lean` — `denied_never_executed` | **proven** (no `sorry`) |
| the floor cannot be switched off by a jurisdiction; unknown fails closed | `src/Core.Lean4/Safety/ChildFloorPolicy.lean` | **proven**, for ALL registries |
| the executable resolver | `src/Core.TypeScript/child-floor/jurisdiction-threshold.ts` | **tested** (falsifiers + hostile fixtures) |
| the shipped table | `jurisdiction-readings.json` (here) | **declared** — see below |
| the table is well-formed and the band agrees across oracles | `src/Core.TypeScript/hygiene/lint-child-floor-registry.ts` | **tested**, runs in CI |

## The register on this table — read this before trusting an entry

**Every `readings` entry is a legal READING, not verified law, and nothing here is legal
advice.** A reading is one named party's interpretation of one jurisdiction at one date. It is
revisable, it may be wrong, and its being in a JSON file in a git repository confers no
authority on it whatsoever. `attributedTo` and `dated` are required fields precisely so that
an entry can never read as an anonymous statement of fact.

**`readings` currently ships EMPTY, and that is a state, not an omission.** No attributed legal
review exists yet, so every jurisdiction resolves to `21` — the highest threshold in the band,
the most protective answer available. That is the correct fail-closed position for a registry
nobody has reviewed. It is also deliberately inconvenient: the way to get a lower threshold is
for a named person to make and date a reading, which is the gate this design wants.

`candidates` records where a reading is *wanted*. Candidates carry no `threshold`, are never
consulted by the resolver, and assert nothing about any jurisdiction's law.

## What is guaranteed no matter what this file says

Proven in `ChildFloorPolicy.lean`, universally quantified over the registry — so editing this
file cannot invalidate any of it:

1. **No entry can lower the floor.** A reading whose `threshold` is outside `[16, 21]` is not
   accepted; the resolver then falls through to the protective bound. `threshold: 0` does not
   disable the gate, it is simply ignored (`no_registry_lowers_the_floor`, and the executable
   sabotage controls in `ChildFloorPolicy.lean` §6 and the TS test suite).
2. **An unknown jurisdiction denies rather than admits.** Unrecognized code, rejected reading,
   or no jurisdiction named at all ⇒ `21`, which denies at least everything every known
   jurisdiction denies (`unknown_denies_superset`). Aaron, same day: *"unknown include is
   better than unknown exclude"* — an unknown that halts is recoverable, one that ships is not.
3. **Disagreement takes the protective bound.** Several jurisdictions in play ⇒ the max, never
   an average and never the first match (`resolveAll_ge_each`).
4. **Unknown age denies.** `unknownAge` is a real state with no admitting branch
   (`unknown_age_denies`); it is never collapsed into a number.
5. **And therefore it never executes.** Composed with the already-proven gate: a child-gated
   effect on a subject under 16 is not executed at ANY depth, under ANY registry
   (`under_bandLow_never_executed`).

## What is NOT guaranteed — the real remaining gap

The proofs are conditional on a **classification**: `classOf` (is this effect child-gated?) and
`subjectOf` (whose age is this?) are the deployment's decoders, and nothing here proves either
is correct. A mis-classified effect is admitted correctly *for the class it was given*. That is
the next piece of work, and it is a bigger one than this was.

Also not shipped: no deployed gate consumes this policy yet. `ChildFloor.lean` mirrors
`src/Core.FSharp.ObserveBridge/{Effects,SubstrateHandler}.fs`, whose `Effect` taxonomy has no
subject and no age, so wiring the policy into it would mean extending that taxonomy — a design
change, not a plug-in. The policy is **declared and proven**, not **deployed**.

## Adding a reading

1. A named party makes the reading and dates it. This is the part that is not automatable.
2. Add an object to `readings` with `jurisdiction` (slash-separated scope path, the shape
   `src/Core.TypeScript/planning/competence-attribution.ts` already uses), `threshold`,
   `attributedTo`, `dated` (ISO-8601), and `basis` (what the reading rests on).
3. `bun src/Core.TypeScript/hygiene/lint-child-floor-registry.ts` must pass. It refuses an
   out-of-band threshold, a missing attribution or date, a duplicate jurisdiction, a candidate
   carrying a threshold, and a band that disagrees with the Lean or the TypeScript.

Removing a reading is always safe in the protective direction: the jurisdiction reverts to the
unknown case, which is `21`.

## Pointers

- `docs/research/2026-08-24-ksk-is-the-kinetic-rung-and-zeta-already-built-four-of-its-parts.md`
  §5–§6 — the `red_lines` tension, Aaron's resolution, and the gap this closes
- `.claude/rules/manifesto-13-specifications.md` §11 — the Default Oracle the predicate is
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the register discipline the table above obeys
- `docs/DEDICATION.md` — *"an invariant floor with a jurisdictional threshold"*, named there as
  a pattern the repository keeps producing
- `workitems/081M0TJXY32087G0R003TBTR7V-*.md`
