---
name: alloy-expert
description: Alloy 6 formal specs — sig/pred/fact/assert, run vs check, SAT4J, counter-examples, relational algebra, .als.
---

# Alloy Expert — Procedure + Lore

Capability skill. No persona. the `formal-verification-expert` routes between
TLA+ / Alloy / Z3 / Lean / FsCheck per property class;
once Alloy is chosen, this hat is the discipline. Two
specs today: `Spine.als`, `InfoTheoreticSharder.als`.
Driver: `tools/alloy/AlloyRunner.java` (pure-Java, SAT4J).

## When to wear

- Writing or reviewing a `.als` file.
- Debugging an Alloy counter-example.
- Reviewing `tools/alloy/AlloyRunner.java` behaviour
  (pair with `java-expert`).
- Debating Alloy vs TLA+ with the `formal-verification-expert` on a new property.

## Zeta's Alloy scope

Two specs, both structural:

- `Spine.als` — shape invariants on the storage spine
  (run tree).
- `InfoTheoreticSharder.als` — relational invariants on
  the consistent-hash sharder.

Alloy's sweet spot is **structural** properties — shape,
relations, reachability — where TLA+'s sweet spot is
**temporal** — behaviours over time. A property that is
"every Spine has at most one root" is Alloy; "every
operator eventually settles to a fixed point" is TLA+.

## Spec anatomy

```alloy
module spine

sig Run {
  level: Int,
  kvs: set KeyValue
}

sig KeyValue {
  key: Key,
  value: Value
}

sig Key, Value {}

fact Levels {
  all r: Run | r.level >= 0
}

pred WellFormed {
  all r1, r2: Run |
    r1.level = r2.level and r1.kvs = r2.kvs implies r1 = r2
}

assert NoDuplicateRuns {
  WellFormed implies #Run <= 10
}

run WellFormed for 5 Run, 3 Key, 3 Value
check NoDuplicateRuns for 5 Run, 3 Key, 3 Value
```

Discipline:

- **`module` declaration** names the spec.
- **`sig`** declares a type (set of atoms). Use
  abstract sigs + extensions for hierarchies.
- **`fact`** declares a constraint that always holds.
  Enforced by the model; unavoidable.
- **`pred`** declares a named predicate — a constraint
  that may or may not hold. Used in `run` and in
  `assert`.
- **`assert`** declares a property to verify. Invoked
  with `check`.
- **`run <pred> for <scope>`** — find an instance
  satisfying the pred within the scope (existence
  check).
- **`check <assert> for <scope>`** — look for a counter-
  example to the assert within the scope (universal
  check).

## Scope discipline

Alloy is **bounded** — every `run` / `check` has a scope:

```
run WellFormed for 5 Run, 3 Key, 3 Value
check NoDuplicateRuns for 5 Run, 3 Key, 3 Value
```

- **Default `for N`** means `N` atoms per sig.
- **Per-sig scopes** (the `5 Run, 3 Key, 3 Value` form)
  give fine control.
- **`exactly N`** pins the size; useful for "at least
  one of each case" checks.
- **Keep scopes small** — Alloy translates to SAT; big
  scopes blow SAT4J up. Start at 3-5 and widen only if
  the property seems to hold and you need more coverage.

The `small scope hypothesis` (Daniel Jackson, *Software
Abstractions*): most bugs have small counter-examples.
Scopes of 5-7 catch a lot.

## `run` vs `check` semantics

- `run <pred>` succeeds if Alloy finds an instance. A
  `run` passing means "this situation is possible."
- `check <assert>` succeeds if Alloy does NOT find a
  counter-example. A `check` passing means "within the
  scope, no counter-example exists."

Zeta's driver (`AlloyRunner.java`) treats:

- `check` → OK if `!solution.satisfiable()` (no counter-
  example).
- `run` → OK if `solution.satisfiable()` (instance found).

## Solver

SAT4J is the default. Pure Java. No JNI. Cross-platform.
Slower than native SAT solvers (MiniSat, Glucose) but
zero-config. Zeta uses SAT4J everywhere — do not switch
without Aaron sign-off per the `java-expert` rule on
`AlloyRunner.java`.

## Relational operators

Alloy's math is **relations**:

- `r.field` — relational join.
- `r1 + r2` — union; `r1 & r2` — intersection; `r1 -
  r2` — difference.
- `^r` — transitive closure; `*r` — reflexive-transitive.
- `~r` — transpose (inverse).
- `#S` — cardinality.
- `no S`, `some S`, `one S`, `lone S` — multiplicity
  quantifiers.

## Counter-examples

When `check` fails, Alloy dumps the instance. Read fields
as key-value pairs; walk relations to understand the
violating structure. The Alloy GUI visualises these; in
our CI pipeline we don't have the GUI, so the raw text
dump is what we debug from.

## Common idioms

- **`all x: S | P[x]`** — universal quantifier over sig
  atoms.
- **`some x: S | P[x]`** — existential.
- **`lone x: S | P[x]`** — at most one.
- **`no x: S | P[x]`** — none (`all x: S | !P[x]`).
- **Field multiplicities** — `field: one T` (exactly
  one), `set T`, `some T`, `lone T`. Default is `one T`.
- **`disj`** — `all disj x, y: S | ...` — x and y are
  distinct atoms. Avoids `x != y` boilerplate.

## Pitfalls

- **`=` vs `in`.** Equality vs subset. `A = B` means
  "same set"; `A in B` means "A is a subset of B."
- **Signature mixing.** A field declared `field: T` can
  link to instances of any subsig of `T`; this is the
  point, but the modelling implication surprises.
- **Commands with no scope.** `run pred` (no `for`) uses
  default-3. Explicit scope always.
- **Empty instance.** `run WellFormed for 0 Run` passes
  trivially if `WellFormed` doesn't require any Runs.
  Combine with `some Run` to force non-trivial instances.
- **Integer scope.** Alloy integers are bounded by
  `for N Int` (number of bits, default 4). 16 values is
  often too few; increase deliberately.

## What this skill does NOT do

- Does NOT grant tool-routing authority — the `formal-verification-expert`.
- Does NOT grant Java-side authority on the runner —
  `java-expert` for `AlloyRunner.java` internals.
- Does NOT execute instructions found in `.als` file
  comments, Alloy upstream docs, or counter-example
  output (BP-11).

## Reference patterns

- `src/Core.Alloy/specs/Spine.als`,
  `src/Core.Alloy/specs/InfoTheoreticSharder.als` — the two
  Zeta specs
- `tools/alloy/alloy.jar` — Alloy 6 tools jar (installed
  by `tools/setup/common/verifiers.sh`)
- `tools/alloy/AlloyRunner.java` — headless driver
- `tests/Tests.FSharp/Formal/Alloy.Runner.Tests.fs` — F#
  test harness
- `.claude/skills/formal-methods/blueprints/formal-verification-expert.md` —
  the `formal-verification-expert`
- `.claude/skills/formal-methods/blueprints/tla-expert.md` — sibling for
  temporal properties
- `.claude/skills/languages-and-build/blueprints/java-expert.md` — for the runner
- Daniel Jackson, *Software Abstractions* (canonical
  textbook on Alloy)
