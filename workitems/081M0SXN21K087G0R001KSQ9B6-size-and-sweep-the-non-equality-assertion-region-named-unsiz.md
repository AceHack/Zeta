---
id: 081M0SXN21K087G0R001KSQ9B6
type: task
state: backlog
priority: P2
slug: size-and-sweep-the-non-equality-assertion-region-named-unsiz
title: "Size and sweep the non-equality assertion region named unsized by the arity sweep"
created: 2026-08-24T12:59:14.867Z
depends_on: []
composes_with: []
---

# Size and sweep the non-equality assertion region named unsized by the arity sweep

## The region PR #14587 named and declined to size

Its own coverage limit, quoted:

> Non-equality checks are entirely outside the detector. It inspects only `=`, `Assert.Equal`,
> `expect().toBe/toEqual`, `assert.equal`. A 2-safety claim discharged with `Assert.True`,
> `Assert.Contains`, or a bespoke predicate is invisible -- and sabotage 1 shows exactly that:
> the taint-style check _"the minted card content carries no clock data"_ PASSED under a live
> clock leak, because the leak carried the phase as a bare integer.
> **Largest unsearched region, unsized.**

## The size

**24,805 non-equality assertion sites across 1,928 test files** (6,078 F#, 18,727 TypeScript).
For comparison the equality half counted 155 self-comparisons in 107 files. Distribution:

| count | verb              |     | count  | verb                     |
| ----- | ----------------- | --- | ------ | ------------------------ |
| 7,132 | `toContain`       |     | 581    | `toBeNull`               |
| 3,400 | `Assert.True`     |     | 522    | `not.toBe`               |
| 1,717 | `toHaveLength`    |     | 488    | `Assert.Fail`            |
| 1,637 | `toMatchObject`   |     | 420    | `toBeDefined`            |
| 1,482 | `toBeGreaterThan` |     | 327    | `not.toBeNull`           |
| 1,043 | `not.toContain`   |     | 320    | `toBeGreaterThanOrEqual` |
| 747   | `toThrow`         |     | 312    | `toBeUndefined`          |
| 710   | `Assert.False`    |     | 295    | `toMatch`                |
| 615   | `toBeLessThan`    |     | 271    | `Assert.Empty`           |
| 600   | `Assert.Contains` |     | 195    | `Assert.NotEqual`        |
| 582   | `toBeCloseTo`     |     | ~1,400 | 33 further verbs         |

The shape of the distribution is the finding: **`toContain` alone is 29% of the region**, and
containment is precisely the verb that makes an absence claim (`not.toContain`, 1,043) look like
a taint proof. The tail is long and mostly benign.

24,805 cannot be adjudicated by hand, so the defect-bearing sub-region was narrowed mechanically
and only that sub-region was read in source.

## The two shapes, hunted separately

**SHAPE A -- an absence assertion standing in for a taint / 2-safety property.** Detected by the
same declaration channel R1 uses (the test NAME), plus a matcher argument naming secret material.
10 sites under a 2-safety name; 144 under either that or a secret-taint literal.

**SHAPE B -- an assertion that cannot fail on its input.** Detected by a whitelist of predicates
that are THEOREMS about the expression's type. Searched all 24,805: **1 live instance**.

## The three buckets -- 87 sites adjudicated in source

| bucket                                                                | count  | disposition    |
| --------------------------------------------------------------------- | ------ | -------------- |
| **1 -- vacuous** (cannot fail under any input)                        | **1**  | replaced       |
| **2 -- near-vacuous** (name/comment claims more than the check tests) | **4**  | 4 arity raised |
| **3 -- correct** (honestly stated)                                    | **82** | left alone     |

Bucket 2 was **not** rounded up to bucket 1, and bucket 3 was **not** rounded down. The 82
breaks down as: 68 `>= 0` comparisons on values that genuinely can be negative (`findIndex`
returns -1; a probability, an MI estimate, a PRNG draw are all real range checks); 8
`Assert.True(true)` that are the success leg of a discriminating `match` whose other leg is
`Assert.True(false, ...)` -- the ENCLOSING check can fail, so its arity matches its claim; and 6
absence assertions backed by an exact-equality pin on the whole output or a positive capability
assertion.

### Bucket 1

**`tests/Tests.FSharp/DurableDiplomacyRankGate.Tests.fs:116`** -- `Assert.True(Set.count caps >= 0)`.
`Set.count` is non-negative by construction, so the line could not fail under any input, while
the comment beside it claimed _"not empty"_. It was worse than vacuous: the cells the test builds
(`makeCell`) wrap a `Bonsai.Const`, whose capability surface is EMPTY, so `negotiateFreedomFirst`
always returns `RefusedNoExit` and **the match arm holding the assertion was never reached --
arity ZERO**. The `| RefusedNoExit _ -> ()` arm beside it meant either outcome passed regardless.
Measured, not supposed: sabotaging `negotiateFreedomFirst` to stop excluding `ExitCapability`
left the test GREEN, and so did forcing `hasExit` to `true`.

### Bucket 2

All four in `tools/setup/persona-keys/machine.test.ts`, all the same shape: a taint claim over a
published artifact discharged by searching for one ASCII rendering of the secret.

- `:158` `not.toContain("PRIVATE")` and `:160` the PEM-armor regex, under the claim _"the registry
  holds ONLY the public key -- no private bytes anywhere in it"_.
- `:263` `not.toMatch(/PRIVATE/)` under _"private stays local"_, in the REAL `ssh-keygen` test.
- `:134` `not.toContain("tester@")` under _"the owner NEVER leaks into the label"_.

## Discrimination -- RED against a sabotage, with the OLD check re-added beside it

### Sabotage 1 -- `machine.ts` publishes the COMPLETE private key, base64-encoded

Losslessly recoverable, and carrying no `PRIVATE` token and no PEM armor -- the exact analogue of
sabotage 1's bare integer.

```
BASELINE          27 pass  0 fail  128 expect() calls
SABOTAGE          27 pass  0 fail  128 expect() calls   <-- the whole private key is published
SABOTAGE + new     25 pass  2 fail                       <-- the equality fails
  Passed  SABOTAGE-CONTROL  expect(published).not.toContain("PRIVATE")
  Passed  SABOTAGE-CONTROL  expect(published).not.toMatch(/BEGIN .*PRIVATE KEY/)
  Passed  SABOTAGE-CONTROL  expect(published).not.toMatch(/PRIVATE/)
  Failed  expect(published.trim()).toBe(<the .pub file ssh-keygen itself wrote>)
REVERTED          27 pass  0 fail  131 expect() calls
```

The replacement is an EQUALITY, which is the point: an absence search enumerates leak shapes and
always misses one, while byte-identity against the intended artifact admits no extra byte in any
encoding. The repo already contains the stronger idiom -- `tools/setup/op-token-setup.test.ts:101`
slides a 12-byte window over the actual secret -- so this is the house pattern, not a new one.

### Sabotage 2 -- `Diplomacy.negotiateFreedomFirst` stops excluding `ExitCapability`

```
  Passed  SABOTAGE-CONTROL  Assert.True(Set.count caps >= 0)      [the OLD check, re-added]
  Failed  Assert.Equal<Set<string>>(Set.singleton "trade", caps)
          Expected: "trade"   Actual: "eve.exit"
```

The fix also repairs the FIXTURE, which was the deeper defect: capability-bearing cells make the
`Allowed -> Negotiated` path the one actually taken, so the arm is reachable at all.

## Can the detector be soundly extended? Partly -- and the partial is shipped

`src/Core.TypeScript/hygiene/audit-check-arity-nonequality.ts`, gated in `gate.yml`, falsified in
both directions by a 24-test suite.

**R4 GATES** provably-unfalsifiable comparisons. Sound because each pattern is a **theorem about
the expression's type**, not an inference about the program: a .NET `Set.count`/`List.length` and
a JS `.length` are non-negative for every value, and `X >= X` is reflexivity. Rice does not bite
because nothing semantic is being decided. Live yield after the fix: **0**, and it goes RED on the
pre-fix tree at exactly `DurableDiplomacyRankGate.Tests.fs:116`.

`indexOf`/`findIndex` are deliberately excluded (they return -1, so `>= 0` is a real "was found"
check -- 10 such sites). `Assert.True(true)` is deliberately excluded: all 8 live instances are
discriminating match arms, and flagging them would round a correct check up to vacuous, which is
this class's own error in reverse.

**R5 is a CENSUS, NOT A GATE.** This is the shape that produced the live bug, and it still may not
gate: of the 10 sites where an absence assertion sits under a 2-safety name, **6 are correct**.
A gate at 60% false positives is not a gate, it is a nuisance that gets suppressed. So 144 sites
across 54 files are counted and ratcheted in BOTH directions, exactly as R2 counts
self-comparisons without judging them.

**Runtime read-set tracing was NOT built** and should stay unbuilt: an observed read-set on one
input is neither an upper nor a lower bound on dependence across all inputs, so it is unsound in
both directions. Arity stays DECLARED, never inferred.

## THE COVERAGE LIMIT -- this pass leaves its own region unsized

Named the way the last one was, because a partial sweep that reads as a cleared class is this
defect one level up.

1. **97% of the tree was outside the EQUALITY detector too, and nobody had noticed.**
   `audit-check-arity.ts` has `SCAN_ROOTS = ["tests"]`, and **1,194 of the tree's 1,230
   `*.test.ts` files live outside `tests/`** (858 `src/`, 220 `agentic-organization/`, 65
   `tools/`). Both bugs fixed here were in that region. The new audit scans repo-wide, so the
   NON-equality half is now the better-covered one -- **the equality half should be re-run at the
   wider scope, and this pass did not do it.** Largest unsearched region now, and it is in the
   OTHER detector.
2. **The 24,805 minus the 87.** Adjudication was mechanical narrowing plus source reading of the
   narrowed set. The other ~24,700 sites were not read. The two hunted shapes are the ones with a
   known failure mode; a third shape nobody has named would not have been found.
3. **R5's vocabulary is a whitelist**, inheriting R1's limit: `declaresTwoSafety` recognises 11
   name patterns, and a taint claim phrased outside them is invisible. The secret-material regex
   is likewise a literal list (`PRIVATE`, `token`, `credential`, ...).
4. **Completeness of an absence predicate is undecidable** (Rice) -- it asks whether two programs
   agree on all inputs. Permanent, not pending.
5. **`Assert.Fail` (488 sites) and `Assert.Throws` / `toThrow` (788) were not analysed.** A
   `toThrow()` with no argument passes on ANY error, including a `TypeError` from a typo in the
   test itself. That is a plausible near-vacuity class and it is unsized.

**Register: `unmetered`.** R4 gates a real class with a real falsifier and R5 ratchets both ways,
so neither is decoration; but R4's live yield after the fix is 0, nothing has been caught in the
wild yet, and the five regions above are unsearched. This does not claim `metered`.

Anchors: Clarkson & Schneider (2008/2010) k-safety - Goguen & Meseguer (1982) noninterference -
Rice (1953) - Denning & Denning, CACM 20(7) 1977 (taint as an information-flow lattice; a string
search is not a lattice join).
