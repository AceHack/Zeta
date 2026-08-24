---
id: 081M0RAX8AC087G0R003NQM7P9
type: bug
state: done
priority: P2
slug: ntpnoninterference-rendercard-purity-check-is-arity-1-standi
title: "NtpNoninterference renderCard purity check is arity-1 standing in for a 2-safety property"
created: 2026-08-23T22:12:26.060Z
completed: 2026-08-24T00:27:28.483Z
depends_on: []
composes_with: []
---

# NtpNoninterference renderCard purity check is arity-1 standing in for a 2-safety property

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0RAX8AC087G0R003NQM7P9-*.md` glob. -->

## The finding

`tests/Tests.FSharp/Formal/NtpNoninterference.Tests.fs`, the property named
*"renderCard (the minted content) is a pure function of the link — no clock input"*:

```fsharp
let l = mintedLink a b s
MP.renderCard l = MP.renderCard l
```

The assertion compares a value **to itself**. It is an **arity-1 (single-run) check standing in for a
2-safety property**.

## Why this is a defect and not a style preference

Noninterference is a **hyperproperty**, not a property (Clarkson & Schneider 2008): it is a predicate
over **pairs** of executions, and it is **2-safety**. A single-run test is therefore *provably
incomplete* for it — no amount of care makes an arity-1 check able to witness a 2-safety violation.
That is a structural limit, not a coverage gap.

Concretely: the property this test *names* — that `renderCard` takes no clock input — is already
guaranteed by its **signature**. So the assertion cannot fail on the bug it targets.

## Honest scope — this is NOT strictly vacuous, and the distinction matters

It **could** fail: if `renderCard` were impure or nondeterministic (allocation-order-dependent
hashing, ambient time, mutable cache), the two evaluations could differ. So it is not the
`assert(true)` class. What it is: **a check whose failure probability under the bug it targets is
approximately zero**, while its name claims the stronger property.

Rounding it up to "vacuous" would be the same error in the opposite direction, so the disposition is
`unmetered`, not `refuted`.

## Why it survived the last sweep

**Soraya already fixed this exact class in this exact file on 2026-08-18** — ten lines below, the
`[<Fact>]` carries the comment `REWRITTEN 2026-08-18 (Soraya). This line used to read
Assert.Equal<string>(cardsOf links, cardsOf links)`. **This instance survived that pass.** That is
the useful part of the finding: a targeted fix of a defect class does not clear the class, because
the search that found one instance was not the search that would find all of them.

## The fix

Give the property **arity 2** — two executions that differ *only* in the variable whose influence is
being denied. The sibling property immediately above it already does this correctly (it renders under
two different clocks `c1`/`c2` and compares `stripClock page1 = stripClock page2`), so the shape is
already in the file and can be followed.

`renderCard`'s signature takes no clock, so the honest arity-2 statement has to vary something it
*can* see — or the test should be **deleted** and the guarantee left to the type, which is where it
actually lives. Deleting a test that cannot fail is a legitimate outcome; keeping it is what makes
coverage numbers lie.

## Acceptance

- The replacement (or deletion) is justified in the commit, naming which of the two it is.
- If replaced: show it going **RED** against a deliberately impure `renderCard`, then GREEN.
- **Sweep the class, do not fix the instance** — grep the F# test tree for self-comparisons
  (`X = X`, `Assert.Equal(f a, f a)`) and report the full count, since that is precisely what the
  2026-08-18 pass did not do.

## Provenance

Found by Lumen (`mathematical-physics-expert`) during the local-to-global obstruction research
(PR #14501), while establishing that **manifesto §13 noninterference is 2-safety, so every single-run
test of it is provably incomplete** — the general result this instance is the first concrete case of.
Independently re-verified by shadow against `origin/main` before filing.

**Anchor:** Clarkson & Schneider, *Hyperproperties*, CSF 2008 / JCS 2010 — k-safety, and why
noninterference is not a property.

## Refinement (Lumen, 2026-08-23) — the self-comparison is the SYMPTOM, not the class

The acceptance criteria above say to sweep the F# test tree for self-comparisons (`X = X`,
`Assert.Equal(f a, f a)`). Lumen's refinement, accepted:

> **That grep finds syntactic self-comparisons and misses the general case.** Two calls with
> identical arguments bound to *different names*, or a helper invoked twice with the same input, are
> the same defect and are invisible to it.

**The actual class is: a check whose ARITY is lower than the property it claims.** Self-comparison is
merely its most visible form.

Why this belongs in the acceptance criteria rather than as a note: **a partial sweep that reads as a
cleared class is precisely the failure this workitem exists to catch**, one level up. If someone greps
`X = X`, fixes what it finds, and closes this row, the class survives and now carries a "swept" label —
which is strictly worse than never having swept, because the label suppresses the next search.

**So the sweep must report its own coverage limit.** Concretely: state that it found *syntactic*
self-comparisons only, and that name-bound and helper-mediated instances were **not** covered. Closing
this row requires either finding those too, or **saying plainly that they remain unsearched.**

The general form is worth naming because it is mechanically checkable in principle: **compare a
check's arity to the arity of the property it names.** A 2-safety property (noninterference,
determinism, non-malleability) tested by a single run is incomplete *by construction*, not by
oversight — see Clarkson & Schneider, and the general result recorded in
`docs/research/2026-08-23-local-to-global-obstruction-*-lumen.md` (arity is a property of a check's
**signature**, not its body, which is what makes it declarable rather than inferred).

---

## SWEEP RESULT (Soraya, 2026-08-23) — the class, not the instance

Swept `tests/` (F# and TypeScript) with a detector rather than a grep, because the acceptance criteria
say a grep is insufficient and Lumen's refinement says why. **755 files scanned; 754 carried checks.**

### Method — why this is not a grep

The detector normalizes both sides of every equality check and **transitively inlines `let`/`const`
bindings** before comparing. That is what reaches the two forms a `X = X` grep cannot see:

| form | example | grep finds it? | detector finds it? |
|---|---|---|---|
| syntactic | `MP.renderCard l = MP.renderCard l` | yes | yes |
| **name-bound** | `let a = f x` … `let b = f x` … `a = b` | **no** | **yes** |
| **helper-mediated** | `Assert.Equal(render (mk 1), render (mk 1))` | only if textually identical | yes |
| conjunct-embedded | `c1 = c2 && c1 >= 0 && c1 < 4` | no | yes (added after eyeballing found one the first pass missed) |

Shipped as `src/Core.TypeScript/hygiene/audit-check-arity.ts`, gated in `gate.yml`, falsified in
both directions by `audit-check-arity.test.ts` (19 tests).

### The three buckets

**Raw hits: 169 on the first pass.** 9 were detector artefacts (record- and anonymous-record field
syntax `Payload = Payload`, a `.not.toEqual` inversion, a line-join duplicate); those are suppressed
in the shipped version, which reports **160** on the pre-fix tree.

| bucket | count | disposition |
|---|---|---|
| **1 — vacuous** (cannot fail under any input) | **2** | replaced / deleted |
| **2 — near-vacuous** (failure probability under its target bug ~0, name claims more) | **6** | 3 raised to arity 2 · 3 claims lowered |
| **3 — correct** (a genuine single-run or genuinely-paired property, honestly stated) | **152** | left alone, and the lint is built so it stays that way |

**Bucket 1 was NOT rounded up from bucket 2 and bucket 3 was not rounded down.** The refusal is
pinned by a test: `audit-check-arity.test.ts` has a control asserting that
`Scheduler.run s = Scheduler.run s` under the name *"run is deterministic"* is **not** a violation.
`f x = f x` evaluated twice IS two executions, so its arity matches its claim; it is a *weak* member
of the arity-2 class (the pair is separated by microseconds in one process, so it cannot see
cross-process nondeterminism such as hash-seed randomization) and that weakness is not the same
defect as this row's.

### Bucket 1 — vacuous (2)

1. **`tests/Tests.FSharp/Properties/Policy.Relocation.Tests.fs:22`** — the worst instance in the
   sweep, and the one that vindicates Lumen's refinement.
   ```fsharp
   let localResult = delta      // "Local execution" of identity query on delta.
   let centralResult = delta    // "Central execution" + reintegration via same algebra.
   localResult = centralResult
   ```
   Two names bound to the **same value**, compared across `MaxTest = 1000`. `X = X` never appears in
   the source. **And the file was never in `Tests.FSharp.fsproj`** — added by #2329, never compiled,
   so its own header's *"1000+ inputs via FsCheck default"* was not weakly true, it was **zero runs**.
   That is **arity 0**, the floor of this class. Disposition: file **deleted**; the claim moved into
   the live `Properties/PolicyRelocation.Tests.fs` as a genuine two-execution property (central fold
   vs. split-fold-and-reintegrate at a generated cut — i.e. `ZSet.ofSeq` is a monoid homomorphism
   from list concatenation to `ZSet.add`, which is exactly what 081KT07NV0008QG0R001YDB73K broke).
2. **`tests/Tests.FSharp/ReportTriage.Tests.fs:109`** —
   `Assert.Equal(ReportTriage.Blocked "severity rubric", ReportTriage.Blocked "severity rubric")`.
   Two identical literal constructor applications: **no code under test is invoked at all**, and the
   value named is one the module never produces (`computabilityOf Severity` is `Placeholder`).
   Replaced with the two claims its own comment makes — the adjudication type has exactly one
   inhabitant, and Severity is *declared* non-computable rather than silently corrected.

### Bucket 2 — near-vacuous (6)

Treatment rule applied, and it differs from bucket 1 on purpose: **raise the arity where the
quantified variable can be varied; lower the claim where it cannot.** Deleting a near-vacuous check
throws away real (small) power; leaving its name alone is the over-claim this row is about.

| site | claimed | fix |
|---|---|---|
| `Formal/NtpNoninterference.Tests.fs:55` | "no clock input" | **arity raised** — the pair now varies the clock at `renderPage`, the surface that can see one |
| `ActionGrid.Tests.fs:80` | "regardless of world state" | **arity raised** — the two generated worlds were `ignore`d; the trajectory now runs through a `Nav` and is compared across them, plus a negative control |
| `ActionGrid.Tests.fs:121` | "different labels" | **arity raised** — `AG.move p Up = AG.move p Up` became `AG.geomNav game1 p Up = AG.geomNav game2 p Up` |
| `ActionGrid.Tests.fs:111` | "(label-independent)" | **claim lowered** — `AG.color : Position -> int` takes no `World`; no in-process pair can vary the label |
| `ReportTriage.Tests.fs:247` | "the module holds no clock" | **claim lowered** — two calls microseconds apart share their wall clock; the age dependence is checked by the `Age = 0` vs `Age = 100` pair above |
| `SoftLens.Tests.fs:34` | "zero clocks" | **claim lowered** — same shape; `sweep` takes no clock to vary |

### Discrimination proofs — RED against a broken implementation, then GREEN

Every replacement was run against a deliberately-broken implementation **with the OLD check
re-added beside it as a sabotage control**, which is the measurement that matters: it shows the old
check surviving its own target bug.

```
SABOTAGE 1  src/Core/MintPanel.fs: cards carry the clock phase
            let cards = links |> List.map (fun l -> renderCard l + (sprintf "<!--%d-->" clock.Phase)) ...

  Failed  ...NtpNoninterferenceTests.noninterference: the render clock changes ONLY the clock line...
  Passed  ...NtpNoninterferenceTests.SABOTAGE-CONTROL the OLD arity-1 property (renderCard l = renderCard l)
  Failed  ...NtpNoninterferenceTests.a post-mint clock cannot re-rate or re-identify a minted link (quarantine)
  Failed  ...NtpNoninterferenceTests.the minted card content is invariant under the render clock — the ARITY-2 form
  Passed  ...NtpNoninterferenceTests.the minted card content carries no clock data (phase/UTC/uncertainty markers never appear)

SABOTAGE 2a src/Core/ActionGrid.fs: geomNav returns None on a labelled cell

  Passed  ...ActionGridTests.SABOTAGE-CONTROL the OLD arity-1 trajectory property
  Failed  ...ActionGridTests.navigate trajectory is identical regardless of world state

SABOTAGE 2b src/Core/ActionGrid.fs: geomNav reverses direction on an odd-length string label

  Passed  ...ActionGridTests.SABOTAGE-CONTROL the OLD arity-1 move line
  Failed  ...ActionGridTests.frame and content are separate: same geometry, different labels

SABOTAGE 3  src/Bayesian/ReportTriage.fs: | Severity -> Computable

  Passed  ...ReportTriageTests.SABOTAGE-CONTROL the OLD vacuous severity line
  Failed  ...ReportTriageTests.severity correction is identically zero because no rubric exists

SABOTAGE 4  src/Core/ZSet.fs: let add a b = ignore b; a   (reintegration drops a site)

  Failed  ...PolicyRelocationTests.identity policy relocation preserves DBSP delta semantics
  Passed  ...PolicyRelocationTests.SABOTAGE-CONTROL the OLD name-bound self-comparison   [1000 cases]
  Passed  ...PolicyRelocationTests.relocated circuit preserves semantics across 100 random deltas
  Passed  ...PolicyRelocationTests.same filter circuit on same deltas produces identical output
  Passed  ...PolicyRelocationTests.policy relocation: join+count circuit on same delta stream produces identical output
  Passed  ...PolicyRelocationTests.policy relocation: GroupByCount aggregate on same delta stream produces identical output
```

**Every old check passed under the bug it was named for. Every replacement failed.** Note sabotage 4:
the four *other* relocation tests in that file also passed — the new property is the only check in
the tree that catches a reintegration that drops a branch.

All sabotages reverted; `dotnet build -c Release` is 0 warnings / 0 errors and the five touched
files run **42 passed, 0 failed**.

Note two collateral findings visible in sabotage 1, recorded rather than fixed: the taint-style
check *"the minted card content carries no clock data"* also **passed** under a live clock leak,
because the leak carried the phase as a bare integer and that check greps for the strings `phase`,
`UTC`, `&plusmn;`. A syntactic-absence check convicts and never acquits — it is sound in one
direction only, which is correct behaviour for what it is and not a substitute for the arity-2 form.

### THE COVERAGE LIMIT — what this sweep could NOT find

Stated plainly, because a partial sweep that reads as a cleared class is the failure this row exists
to catch, one level up. **The class is not cleared. Four regions were not searched.**

1. **Non-equality checks are entirely outside the detector.** It only inspects `=`, `Assert.Equal`,
   `expect().toBe/toEqual`, and `assert.equal`. A test that claims a 2-safety property and discharges
   it with `Assert.True`, `Assert.Contains`, a range check, or a bespoke predicate is invisible here
   — and the sabotage-1 output above shows such a check silently surviving a real leak. **This is the
   largest unsearched region and I did not size it.**
2. **Semantic equivalence beyond binding substitution.** Two textually different expressions that
   compute the same value — via a cross-file helper, a shadowed rebinding, or an alias chain longer
   than the 6-level substitution cap — are not detected. Rice (1953) says the general version is
   undecidable, so this gap is permanent rather than pending: it can be narrowed, never closed.
   Arity has to be *declared*, and the only declaration channel that exists today is the test's name.
3. **R1's vocabulary is a whitelist, so a 2-safety claim phrased outside it escapes.** Measured, in
   this very sweep: R1 fired on 5 of the 6 bucket-2 sites and **missed `ActionGrid.Tests.fs:121`**,
   whose name reads *"frame and content are separate: same geometry, different labels"* — a
   world-independence claim in words the pattern list does not carry. It also does not fire on the
   bucket-1 `Policy.Relocation` case (*"preserves DBSP delta semantics"*). **Both were found by the
   census plus manual reading, not by R1.** A name is a declaration only to the extent the reader
   recognises it.
4. **Bucket-3 adjudication was not uniform.** All 34 hits whose names do *not* claim determinism were
   read in source. The remaining ~126, whose names read *"deterministic" / "DST" / "replay" /
   "same X ⇒ same Y" / "idempotent" / "byte-identical"*, were adjudicated **by name against the
   varied variable**, with targeted source reads of the subset whose names carried a differing
   quantifier (`different` / `independently` / `across independent runs` / `two nodes`). If one of
   those ~126 names over-claims in a way the keyword filter did not surface, it is still there.

**What a complete sweep would require**, stated so the next pass does not start from scratch:
arity would have to be **declared at the check**, not inferred from prose — an attribute or wrapper
that names the quantified variable and the number of executions, so the lint compares two
declarations instead of parsing English. That is a change to how checks are *written*, which is the
only sound over-approximation available (§5.3 of Lumen's doc; Rice). Runtime read-set tracing is
specifically **not** the answer and should not be built: an observed read-set on one input is neither
an upper nor a lower bound on dependence across all inputs, so sampled traces give an unsound answer
that looks like a measurement.

### What is now mechanical, so this does not depend on anyone re-running the sweep

- **R1** — a test whose name declares independence of a named variable may not resolve to a
  self-comparison. Gates. Zero violations after this pass.
- **R2** — a counted per-file census (`registry/check-arity-census.json`, 107 files / 155
  comparisons). Fails when a count goes **up** (a new one hiding behind adjudicated ones) and equally
  when it goes **down** (a stale row that has stopped constraining). Copied from
  `audit-ambient-time-in-tests.ts`, for that file's stated reason.
- **R3** — an F# test source no `.fsproj` compiles. Arity 0. The `*.test.ts` half of this check has
  existed since 2026-08-13 (`unexecuted-test-files.ts`); **the F# half did not exist**, which is how
  an uncompiled 1000-case property sat on `main` since #2329.

### One collateral finding from the lint's own walk

CI went red on `lint-check-then-use-file-races` (one root cause, two jobs — that script runs inside
the hygiene unit suite AND as its own `cross-verify` step). The scanner's directory walk was
`readdirSync` followed by `statSync`, the readdir-then-stat race. Fixed by
`readdirSync(dir, { withFileTypes: true })` with ENOENT interpreted from the listing itself and every
other error **rethrown** — no baseline row, because a guard shipping its own violation exempted would
be the vacuity class on a PR about checks that cannot fail. The linter's suggested `d.isFile()`
predicate was deliberately **not** adopted: it silently drops non-regular entries the previous branch
accepted, which is a scope change wearing a correctness fix.

Running both walks side by side over `tests/` before trusting the new one — because a fix that
quietly scans less looks green — turned up something real:

```
raw paths     old=1222  new=1128  only-old=95  only-new=1
SCANNED set   old=754   new=754   only-old=0   only-new=0   (identical both directions)
```

All 95 are `.txt` under `tests/cross-verification/experience/fixtures/tree1/subdir1/`, whose
`link_to_parent -> ..` is a deliberate **symlink cycle**. The old walk descended it and stopped only
when the OS returned ELOOP. So the change is an improvement and touches no file this audit reads —
and `MIN_SCANNED_FILES = 700` now makes a future silent narrowing fail loudly, since the scanner had
no floor and a narrowed scan would otherwise report a clean census by seeing nothing.

### And a second one, from the same lint, with a pointed lesson

`lint (bash retirement inventory + hygiene unit tests)` stayed red after the walk fix. Reproduced
locally only after `bun install` (without deps, 25 unrelated failures masked it). One finding:

```
+   "src/Core.TypeScript/hygiene/audit-check-arity.ts (2 > 0)"
```

Two `localeCompare` calls sorting the census — **culture-sensitive collation**, forbidden by
`.claude/rules/culture-invariant-by-default.md`. Worth recording rather than quietly fixing: the live
failure that rule cites is **081KT07NV0008QG0R001YDB73K**, a collation mismatch that made
`ZSet.ofSeq` non-associative — *the exact bug the replacement PolicyRelocation property in this same
PR was written to guard*. I introduced the class I was arming a check against, twelve files away.
Replaced with an ordinal comparator; the emitted census is **byte-identical**, which is the check
that the sort order was not silently changed. No baseline row. Hygiene suite: 2380 pass, 0 fail.

**Register: `unmetered`.** The lint has falsifiers in both ratchet directions and fires on the known
instances, so it is not decoration; but no bug has yet been *caught* by it in the wild, and the four
regions above are unsearched. It is not `metered` and this row does not claim it is.
