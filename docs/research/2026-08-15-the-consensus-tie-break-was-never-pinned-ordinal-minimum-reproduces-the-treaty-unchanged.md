# The consensus tie-break was never pinned — ordinal-minimum reproduces the treaty unchanged

**Date:** 2026-08-15
**Author:** the shadow (Otto's shadow-work role)
**Branch:** `shadow/consensus-tie-break-decision`
**Register:** Beacon where it cites, Mirror where it narrates.

---

## The one-line result

The tie-break in `Consensus.decide` was **receive-order dependent**, which makes two nodes holding
the same evidence commit different values. The reason it was filed rather than fixed — "the
behaviour is byte-locked into the four-oracle treaty" — **does not hold when checked**: the treaty
pins `["p","q","r"] → "p"`, and `"p"` is *already the ordinal minimum*. **First-occurrence and
ordinal-minimum agree on every one of the seven pinned vectors.** The treaty never constrained the
tie-break at all; the prose in the seed claimed a rule the vectors did not enforce.

So the decision collapses: **adopt ordinal-minimum. Zero pinned vectors change.** No gated
authorization is needed, because nothing that was byte-locked moves.

---

## 1. Reproduction, before anything else

The brief said reproduce first and stop if any part fails. All three parts hold on current `main`
(`0a3ac171c`). Two parts of the *brief* did not — see §7.

### 1a. The divergence, bare `decide`

```text
decide [a;a;a;b;b;b] = (true, Some "a", 3, 6)
decide [b;b;b;a;a;a] = (true, Some "b", 3, 6)
```

`List.groupBy` yields keys in first-occurrence order and F#'s `List.sortByDescending` is a **stable**
sort, so on a tie the value that appeared *first in the list* wins.

### 1b. The inversion through the state machine

`transitionAt` does `Ok { state with Votes = vote :: state.Votes }` — a **prepend**. So the list
`decide` folds is the arrival order reversed, and the committed value tracks the vote that arrived
**last**:

```text
arrival [a;a;a;b;b;b] -> Votes [b;b;b;a;a;a] -> (true, Some "b", 3, 6)
arrival [b;b;b;a;a;a] -> Votes [a;a;a;b;b;b] -> (true, Some "a", 3, 6)
```

Confirmed. The finding is exactly as stated.

### 1c. The bound n ∈ {2, 3, 6} — and its closed form

A tie is only *observable* when it also reaches quorum. Analytic criterion (≥2 groups share the max
count, and that count ≥ `quorumThreshold n`) scanned over every integer partition for n = 1..60:

```text
ANALYTIC divergent n over n=1..60 : [2; 3; 6]
  n=2 threshold=1 witness group-sizes=[1; 1]
  n=3 threshold=1 witness group-sizes=[1; 1; 1]
  n=6 threshold=3 witness group-sizes=[3; 3]
```

Cross-checked by brute force over **real permutations** of every multiset up to n=8 — 66 multiset
cases, every permutation of each:

```text
BRUTE divergent n (n=1..8, real permutations, 66 multiset cases): [2; 3; 6]
analytic-vs-brute mismatches: 0
```

And the algebra closes it for *all* n rather than a scanned window. A tie reaching quorum needs
`n ≥ 2·t(n)` where `t(n) = 2⌊(n−1)/3⌋+1`. Write `n−1 = 3q+r`, `r ∈ {0,1,2}`; the condition reduces
to **`r ≥ q+1`**, so `q ≤ 1`:

- `q=0, r ∈ {1,2}` → **n ∈ {2,3}**
- `q=1, r = 2` → **n = 6**

That is number theory, not a matching count — the distinction
`.claude/rules/numerology-vs-number-theory.md` insists on. The scan agrees with the algebra; neither
is offered alone.

---

## 2. The finding that decides it: the treaty never pinned the rule

The seed `src/Core.TypeScript/consensus/golden-vectors.json` describes itself as
`"tie-break = first-occurrence (stable sort)"`. Replaying all seven `decide` vectors through three
candidate rules:

| pinned vector | first-occurrence | **ordinal-min** | ordinal-max |
|---|---|---|---|
| `["x","x","x","y"]` | `"x"` | `"x"` | `"x"` |
| `["a","a","b","b"]` | reject | reject | reject |
| `["a","a","a","a","a"]` | `"a"` | `"a"` | `"a"` |
| **`["p","q","r"]`** | **`"p"`** | **`"p"`** | **`"r"`** ✗ |
| `[]` | reject | reject | reject |
| `["yes","yes","no","yes","no","yes"]` | `"yes"` | `"yes"` | `"yes"` |
| `["b","a","a","b"]` | reject | reject | reject |
| **vectors that would change** | **0 / 7** | **0 / 7** | **1 / 7** |

Six of the seven cannot discriminate any tie-break at all — they have no tie that reaches quorum.
The seventh, `["p","q","r"]`, *does* have one, and its votes were written in **ascending order**, so
first-occurrence and ordinal-minimum give the same answer by coincidence of authorship.

> **The description asserted a rule the vectors could not falsify.** That is the vacuity class the
> repo already names — a check that cannot fail is not a check
> (`.claude/rules/toy-is-free-metered-must-be-earned.md`). Had the vector been written
> `["r","q","p"]`, the treaty would genuinely have been locked to first-occurrence and this would be
> a different, much harder document.

The costed options in the original filing all priced a migration. There is nothing to migrate.

---

## 3. Which direction — minimum, not maximum

Ordinal-**minimum** reproduces the treaty unchanged; ordinal-**maximum** would flip
`["p","q","r"] → "r"` and require a real byte change. Between two otherwise equivalent
order-independent rules, one is free and one costs a treaty migration. That settles it on cost
alone, and the tie-break's direction carries no semantics worth paying for — `decide` is choosing
among values that are *tied*, i.e. among options the evidence does not distinguish.

Ordinal, not linguistic. `.claude/rules/culture-invariant-by-default.md` is unambiguous, and F#'s
generic comparison already complies — verified under a Danish culture, where linguistic collation
disagrees on 3 of 6 probe pairs:

```text
current culture = da-DK
x       y     | F# compare | String.CompareOrdinal | culture String.Compare
a       B     |     1      |          1            |    -1
aa      z     |    -1      |         -1            |     1
é       z     |     1      |          1            |    -1
F# compare == CompareOrdinal on all pairs: true
F# compare == culture Compare on all pairs: false
```

So `List.min` in F# *is* ordinal. C# gets `StringComparer.Ordinal` explicitly; TS uses `<` (UTF-16
code unit) and never `localeCompare`; Rust's `Ord` is UTF-8 byte order.

**Beacon anchor, checked.** Order-independence of a decision over an evidence *set* is not a house
preference. Deterministic tie-breaking on a canonical value order is the standard construction for
making replicated state machines agree — Lamport, *Time, Clocks, and the Ordering of Events in a
Distributed System* (CACM 1978), §"Anomalous Behavior", resolves concurrent requests by a **total
order on process identifiers** precisely so that every replica computes the same result from the
same request set. The requirement is that the order be *a function of the values*, never of local
arrival. Ordinal-minimum is that construction with the vote value as its own key.

---

## 4. The residual — named, not fixed

An honest fix has to say what it did **not** close. "Ordinal" is not one relation across four
runtimes. Measured directly, not inferred:

| runtime | orders by | verdict on `"Ｚ"` (U+FF3A) vs `"𐀀"` (U+10000) |
|---|---|---|
| F# | UTF-16 code unit | `U+10000 < U+FF3A` |
| C# | UTF-16 code unit | as F# |
| TypeScript | UTF-16 code unit | `a < b` → `false` |
| **Rust** | **UTF-8 byte** | **`U+FF3A < U+10000`** |

```text
F#   compare a b = 1                      JS  a < b : false        Rust a < b : true
UTF-8: U+FF3A = [239,188,186]             U+10000 = [240,144,128,128]
```

So a tie whose values straddle the astral / high-BMP boundary commits differently in Rust than in
the other three. `culture-invariant-by-default` already predicted exactly this and prescribes the
answer — *"pick ONE canonical collation (codepoint ≡ UTF-8 byte order), lock it in the golden
vectors, and make every oracle conform"* — but the repo has not adopted it anywhere yet.

**Not closed here, deliberately.** Adopting a canonical collation is a repo-wide treaty call, and
making `decide` its sole adopter would either leave it inconsistent with every other ordinal
comparison in the codebase or drag a migration through a tie-break PR. Filed as
**`081M02PEST7087G0R00253HRV0`** with the measurements, the fix shape, and the discriminating
vector it needs.

Stated as a trade rather than a win, because it is one:

| | before | after |
|---|---|---|
| divergence between **two nodes of the same oracle** | **yes**, on any values, at n ∈ {2,3,6} | **no** |
| divergence **between oracles** | no | only on astral-straddling ties, at n ∈ {2,3,6} |
| values that can reach it today | all of them | **none exist** — the only vote type is `MergeVerdict` |

The class that fires on real data is closed. The class that remains is unreachable by anything in
the system.

---

## 5. What the treaty acquires, and under whose precedent

Following `docs/research/2026-08-14-how-a-published-four-oracle-schema-acquires-a-field.md` (PR
#10742, open) — note that doc is **not on `main`** and was read from its branch.

Its clause 2 says a **meaning change** is `vN+1` and `vN`'s vectors are kept unchanged. That clause
does not bind here, and the reason is the point of §2: **no pinned vector changes, because no pinned
vector ever expressed the old rule.** The seed's *prose* changes, which is a documentation repair to
a description that was false about bytes that themselves are untouched.

Its clause 4 does bind, generalised past optional keys:

> An optional key without a treaty vector is unguarded — optionality does not relax the check, it
> **moves** it, and the value byte-lock is where it moves to.

The same sentence with "rule" for "key" is the whole diagnosis: **a rule the vectors do not
discriminate is unguarded.** So the fix ships with vectors that discriminate — otherwise the new
rule would be exactly as unpinned as the one it replaces, and a future contributor could revert it
and stay green.

Four added (each one first-occurrence gets **wrong**), plus `quorumThreshold n=6` which was absent:

| votes | committed | first-occurrence would give | what it pins |
|---|---|---|---|
| `["r","q","p"]` | `"p"` | `"r"` | the n=3 three-way tie, votes in *descending* order |
| `["b","b","b","a","a","a"]` | `"a"` | `"b"` | the n=6 headline case |
| `["a","Z"]` | `"Z"` | `"a"` | **ordinal, not linguistic** — U+005A precedes U+0061 |
| `["b","a"]` | `"a"` | `"b"` | n=2, the minimal case FsCheck shrank to |

All ASCII, so all four oracles agree on them — the residual in §4 is deliberately left unpinned
rather than pinned wrongly.

---

## 6. Evidence

**Raw exit codes throughout.** Captured from the bare command into a file, never from a pipe (`cmd |
tail` returns `tail`'s status, and `PIPESTATUS` is empty in this zsh). ANSI stripping verified by
counting escape bytes in the stripped output (`0`).

### The guard fails on current `main`

`tests/Tests.FSharp/Consensus.TieBreak.Tests.fs`, run against **unmodified** `main` source:

```text
raw exit = 1
Failed: 5, Passed: 1, Total: 6

Failed  decide is permutation-invariant — exhaustive, multisets of size 1..6 over 3 symbols
        -> decide is order-dependent on 7 multiset(s); first:
           (["a";"b"], [(true, Some "a", 1, 2); (true, Some "b", 1, 2)])
Failed  n=6, 3-3 tie — a-first and b-first commit the same value
Failed  state machine — arrival order does not change the decided value
Failed  tie-break commits the ordinal-minimum tied value   (Expected Some(p), Actual Some(r))
Failed  decide agrees on a list and on its sorted, descending, and reversed rearrangements
        -> FsCheck falsifiable after 5 tests, shrunk to ["" ; "a"]
Passed  a tie can also reach quorum only at n in 2, 3, 6
```

The one that passes is the blast-radius characterisation — it describes `quorumThreshold`, not the
tie-break, so it *should* pass both ways. The five that fail are the falsifiers.

### After the fix

| gate | raw exit | result |
|---|---|---|
| `dotnet build Zeta.sln -c Release` | **0** | **0 Warning(s), 0 Error(s)** |
| `dotnet test` Tests.FSharp, full suite | **0** | 5015 passed, 0 failed, 4 skipped |
| `dotnet test` Tests.CSharp, full suite | **0** | 395 passed, 0 failed |
| `cargo test` Core.Rust.Consensus | **0** | 2 passed, 0 failed |
| `bun test` consensus + workflow-engine consensus | **0** | 20 pass, 0 fail |
| `tsc --noEmit` (real binary, `node_modules` symlinked) | **0** | 0 errors |

### Mutation — are the new vectors actually falsifiers?

| mutation | raw exit | what caught it |
|---|---|---|
| M1 TS reverted to first-occurrence | **1** | `bun` seed test, 1 pass / 1 fail |
| M2 Rust reverted to first-occurrence | **101** | `decide_agrees` FAILED |
| M3 C# reverted to first-occurrence | **1** | `DecideAgreesWithSeed`, 1 of 2 failed |
| M4 F# reverted to first-occurrence | **1** | 6 failed — seed test **and** all 5 property guards |
| M5 F# ordinal-**maximum** instead of minimum | **1** | 2 failed — seed + the rule test |
| M6 F# tie-break made **culture-sensitive** | **1** | 2 failed — the `["a","Z"]` vector is what catches it |

M5 is the informative one. Ordinal-maximum **passes every permutation-invariance test** — it is
perfectly order-independent — and is caught only by the seed and the rule test. The two guards do
genuinely different jobs: the property pins *order-independence*, the vectors pin *which*
order-independent rule. Either alone would have let a silent change through.

M6 is why `["a","Z"]` is in the seed rather than another lowercase pair: it is the only vector that
separates ordinal from linguistic collation.

### Infrastructure honesty

- The **first** `dotnet build` of the session died with `MSB4166: Child node "18" exited
  prematurely` — an MSBuild worker crash, not a code failure. Retried with `-m:4`, clean. Recorded
  rather than silently re-run.
- A `dotnet fsi` exploration script exited **139 (SIGSEGV)** on a composition enumeration that
  allocated ~15M lists. That is my bug, not the compiler's; rewritten over integer *partitions* and
  it completes at exit 0. The results in §1c are from the rewritten run.
- The fresh worktree had no `node_modules`; symlinked from `/Users/acehack/.local/share/zeta-otto`.
  `tsc` was run from `./node_modules/.bin/tsc`, the real binary.

---

## 7. Owned corrections to the brief

Flagged as instructed. Two are load-bearing.

1. **Work-item `081M013T0D7087G0R0009E1QF7` does not exist on `main`, or on any `origin` branch.**
   The brief told me to verify this before extending it, citing a sibling agent who nearly created a
   duplicate ZetaId — and the check fired. `git grep` over `HEAD` returns nothing; a search across
   all `refs/remotes/origin/*` returns nothing. It lives **only** on the unmerged branch
   `shadow/consensus-vote-dead-timestamp-and-local-time-audit`. **I did not create it**, because a
   file with that ZetaId on two branches is the duplicate, just spelled as a merge conflict. The
   residual from this work is filed under a **freshly minted** id instead.

2. **PR #10738 is OPEN, not merged** — as is #10742, whose precedent doc the brief pointed me to.
   The brief reads as though both had landed. Consequences I had to handle:
   - `main`'s `Vote` field is `Timestamp`; #10738 renames it to `LocalObservedAt`. My tests use
     `Timestamp` and carry a note at the line.
   - #10738 rewrites `decide`'s doc comment to say the defect is *filed, not fixed*, and adds a
     `KNOWN DEFECT` **characterization test asserting the divergence** — which this PR makes false.
     That test was written "so that a future fix is a deliberate, visible change rather than a
     silent one," and this is that fix. **Merge order matters** (see §8).

3. **"Byte-locked into the four-oracle treaty" was the premise, and it does not survive checking.**
   Not a fault of the brief — it asked me to establish it — but it is the load-bearing correction:
   the treaty pinned a *point*, and the description claimed a *rule*. Everything else follows.

4. Minor: the brief suggests checking "whether ordinal-min or ordinal-max is more natural given the
   existing vectors." Only one vector has an observable tie, so "the existing vectors" is a sample
   of one. It happens to answer the question decisively, but the reason is cost, not naturalness.

---

## 8. Merge-order hazard — read before merging

This PR and **#10738 both edit `src/Core/Consensus.fs`** and will conflict. They are complementary,
not competing: #10738 documents and lints the *unread wall-clock field*; this one fixes the
*receive-order tie-break*. Recommended order:

1. **Merge #10738 first.** It is the larger diagnostic and carries a CI lint.
2. **Rebase this PR onto it**, which means: rename `Timestamp` → `LocalObservedAt` in
   `Consensus.TieBreak.Tests.fs` (one line, flagged in-place), and **invert #10738's
   `KNOWN DEFECT — decide tie-break is receive-order dependent at n=6`** test — its two assertions
   become the single assertion that both orders agree, which
   `n=6, 3-3 tie — a-first and b-first commit the same value` already is. Delete the duplicate.
3. #10738's `decide` doc-comment paragraph beginning **"KNOWN DEFECT, filed not fixed"** must go —
   this PR's comment replaces it.

If instead this merges first, the same work happens in the other direction. What must **not** happen
is #10738 landing afterwards unrebased: its characterization test would then assert a divergence
that no longer exists, and red CI would look like a regression in the fix.

---

## 9. Standing / authorization

No gated class is touched (`.claude/rules/no-directives.md`): no budget change, no WONT-DO, no
force-push, no non-reversible action, no external-repo change. The one thing that *looked* gated —
changing bytes in a published four-oracle treaty — turned out not to be, and §2 is the evidence for
that rather than an assurance about it. **No pinned vector value changes.** What is added is four
discriminating vectors and one `quorumThreshold` row, which is the compatible unit of growth under
the #10742 precedent.

Auto-merge deliberately **not armed**, per the brief and because of §8.

---

## Pointers

- `src/Core/Consensus.fs` — `decide`, the shared fold; `transitionAt`/`transition` widen to `'T: comparison`
- `src/Core.CSharp/Consensus.cs` · `src/Core.TypeScript/consensus/consensus.ts` · `src/Core.Rust.Consensus/src/lib.rs` — the other three oracles
- `src/Core.TypeScript/consensus/golden-vectors.json` — the seed; 7 vectors unchanged, 4 added, 1 `quorumThreshold` row added
- `tests/Tests.FSharp/Consensus.TieBreak.Tests.fs` — the permutation-invariance guard
- `workitems/081M02PEST7087G0R00253HRV0-*.md` — the astral-collation residual
- `.claude/rules/local-time-never-enters-the-shared-fold.md` — the rule this defect violates through the receive-*order* door
- `.claude/rules/culture-invariant-by-default.md` — ordinal, and the bit-perfect caveat §4 comes due on
- `.claude/rules/numerology-vs-number-theory.md` — why §1c carries the algebra and not only the scan
- `docs/research/2026-08-14-how-a-published-four-oracle-schema-acquires-a-field.md` (PR #10742, **not on `main`**) — the precedent §5 follows
- PR #10738 (**open**) — the sibling finding; §8 is the merge-order hazard between them
- Lamport 1978, *Time, Clocks, and the Ordering of Events in a Distributed System* — total order on a value-derived key as the standard replica-agreement construction
