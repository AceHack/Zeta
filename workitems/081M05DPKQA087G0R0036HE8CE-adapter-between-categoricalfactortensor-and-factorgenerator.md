---
id: 081M05DPKQA087G0R0036HE8CE
type: task
state: backlog
priority: P3
slug: adapter-between-categoricalfactortensor-and-factorgenerator
title: "Adapter between CategoricalFactorTensor and FactorGenerator - recorded negative, blocked upstream"
created: 2026-08-16T13:55:41.114Z
depends_on:
  - 081M05DPGKR087G0R0017GX310
composes_with: []
---

# Adapter between `CategoricalFactorTensor` and `FactorGenerator` — recorded negative

**Conclusion: no adapter should be written today.** Filing the negative rather than
staying silent, with the verification behind it, so the next agent does not re-run
this investigation or write the adapter on the resemblance alone.

## The two representations

- `src/Core.TypeScript/bayesian/categorical-bayesian-planner.ts`
  `CategoricalFactorTensor { factorId, logProbabilities: ReadonlyMap<string, number> }`
  — eager, finite, **partial**.
- `src/Core.TypeScript/bayesian/shiva-weak-factor-graph.ts`
  `FactorGenerator = (stateKey: string) => number`
  — lazy, unbounded, **total** (total by type).

## Verified: the gap is real

- `rg` over the whole repo (prior-art mirror excluded): `FactorGenerator` appears
  **only** inside `shiva-weak-factor-graph.ts`; `CategoricalFactorTensor` appears
  **only** inside `categorical-bayesian-planner.ts` and its test.
- Searched by **behaviour**, not name: no function anywhere takes a
  `ReadonlyMap<string, number>` and returns a function, or the reverse; the string
  `logProbabilities` occurs in exactly one file; `(stateKey|key|k: string) => number`
  matches only the `FactorGenerator` declaration itself.
- **No adapter exists.** Also: **neither type has any consumer outside its own
  module.** There is no caller waiting on interop.

## Not verified: that they are "the same object"

They share a *signature shape* (`string → number`, both claiming log-potentials).
That is a resemblance. The invariant that would make them the same object — *"denotes
one total function from state key to log-potential"* — holds for `FactorGenerator`
and **fails** for `CategoricalFactorTensor`, which is partial and is given **three
different** total extensions by its own module (`?? 0.0`, `?? -0.05`, `?? -0.1`),
under **two different key namespaces**. See 081M05DPGKR087G0R0017GX310 for the
mutation run and the keyspace probe that establish both.

So the honest statement is: **same shape, different domains and different totality.
Sameness is not demonstrated.**

## Which direction is sound

**`CategoricalFactorTensor → FactorGenerator` — trivial to write, not currently
well-defined.** A map lookup with a default is total the moment a default is fixed.
But the source type does not carry its default, and the repo uses three. An adapter
must pick one, which silently promotes one call site's heuristic to the canonical
meaning of the type. That is the silent-promotion failure named in
`.claude/rules/toy-is-free-metered-must-be-earned.md`. It becomes sound — and then
genuinely trivial — once the default is carried **in the type** (fix in
081M05DPGKR087G0R0017GX310). Additionally the keyspace must be disambiguated, or
the adapter inherits the block/cell collision.

**`FactorGenerator → CategoricalFactorTensor` — not total; a restriction, not a
conversion.** A generator has no domain, so materialising one requires a **supplied
key set as a required parameter**, never an inferred one. The key set is not a
convenience argument — it changes downstream results. Measured with
`studentTFactorGenerator()` (default cfg) through `computeFactorEntropy`:

| key set | domain size | H |
|---|---|---|
| `0..3` | 4 | 1.776472 |
| `0..3` with repeats | 4 | 1.776472 |
| `0..7` | 8 | 2.616190 |
| `-3..3` | 7 | 2.598456 |

Same factor, three different entropies. **`computeFactorEntropy` is a property of
(factor, domain), not of the factor** — it softmax-normalises over exactly the keys
present. So materialisation is a lossy, choice-bearing operation and its result must
never be presented as "the entropy of the factor". (Repeats collapse, as expected for
a Map — the operation depends on the key *set*, which is the one reassuring part.)

## Why no adapter is written now

1. **No caller.** Neither type crosses its module boundary. An adapter with no
   consumer cannot be metered — it would ship as `unmetered` by construction.
2. **The specification is unsettled upstream.** Blocked on 081M05DPGKR087G0R0017GX310.
3. **No honest falsifier is available.** A test for an adapter whose defaults are
   arbitrary pins *the guess*, not the requirement — it would go red only if someone
   changed my arbitrary choice, which is a check that cannot fail in the way that
   matters. Zeta's standing rule applies.

## Do this when unblocked

Only if a real caller appears. Then:

- Direction 1 as `tensorToGenerator(t: CategoricalFactorTensor): FactorGenerator`,
  reading the default **from `t`** — no default parameter at the call site.
  Falsifier: a round-trip test over a key set covering present *and* absent keys,
  which goes red if the adapter substitutes any other default.
- Direction 2 as `restrictGeneratorToKeys(g: FactorGenerator, keys: readonly string[],
  factorId: string): CategoricalFactorTensor` — named as a **restriction**, key set
  required. Falsifier: entropy of the result changes with the key set (the table
  above is the fixture), so a test asserting a fixed entropy for a fixed key set goes
  red if the domain handling is wrong.

## Provenance

Investigated by the shadow, routed by Otto, 2026-08-16, against `origin/main`.
Recorded negative — deliberately no code change.
