# Otto (shadow) — session review, 2026-08-10: the vacuity hunt

**For review before further work.** Requested by Aaron: *"do a writeup of your last
few hours of work and let me get it reviewed first then do the new work."*

Everything below is on `main`. Commits are named so any claim here can be checked
against the diff rather than taken on my word — which is the whole subject of the
session.

---

## 0. The thread that connects all of it

One class of defect kept reappearing under different costumes:

> **A check that cannot fail is not a check, and a green result is evidence only of
> what was actually examined.**

It showed up as: a comment claiming a proof was closed while the proof was `sorry`;
an audit that named a declaration which does not exist and therefore passed while
checking nothing; a test whose name asserted it discharged an obligation it never
touched; a mutation gate whose break-threshold is 0; and a Lean library that was
never built, so nothing in it could be checked at all.

None of these were caught by a failing build. All of them were green.

---

## 1. Shipped — detectors and healers

| commit | what |
|---|---|
| `9d2563ac8` | **proof-closure drift detector** + workflow. Finds files whose prose claims closure (`no sorry`, `chain is CLOSED`) while the code carries `sorry`/`admit`/`axiom`. |
| `bac3e13ee` | **Lean CI coverage detector**. Answers the question nothing asked: *what is the axiom audit NOT looking at.* |
| `4a687bcfd` | **LD001 lockfile-desync detector + 24/7 auto-healer.** |
| `006b1ae5f` | **Red State dashboard** — `/demo/red/`, git-backed, zoomable. |

**Why the closure detector cannot be a grep:** the claim sentence itself contains the
word "sorry" ("no axiom, no sorry"), so a naive scan flags every honest file. Markers
are counted in code only, claims in comments only, which requires stripping Lean's
nested block comments first.

**Precision was earned, not assumed.** The first real run returned three files; two
were false positives and are now regression tests — `ChildFloor.lean`'s `| admit` is
an inductive *constructor*, and `FinDataProcessing.lean`'s claim is *scoped* to 13
enumerated declarations with its one `sorry` flagged in place. That file is honest,
and a detector that shouts at honest files teaches people to ignore the detector.

**The healer is deliberately the low-intelligence kind.** Its safety case is five
checkable properties, not assertions: it stages `bun.lock` and nothing else; there is
no judgement to exercise (the fix is `bun install`); it is idempotent; it re-runs
`--frozen-lockfile` after healing and refuses to push unless that passes; and its
output is a pure function of `package.json`, so a wrong result erases nobody's work.
That last property is the entire difference from the auto-revert healer. It also
**refuses rather than guesses**: only bun's specific frozen-lockfile message counts as
desync, so a registry blip cannot enter the ledger as dependency drift.

---

## 2. Shipped — the Lean repair

`b485ee1b5`, `575f7ab94`.

The task was "add three files to the audit lists." The blocker was structural:
`lakefile.toml` declared `lean_lib ImaginaryStack` but **no root module existed** and
it was not a default target, so the library was unbuildable and
`import ImaginaryStack.*` could not resolve. That is *why* `PhaseClockErasure.lean`
was in neither list.

Once buildable, that file was broken three ways, none visible:

1. it **did not compile** (`omega could not prove the goal`, line 113);
2. its `sorry` sat on a theorem that is **false**;
3. line 90 claimed *"the ECC proof chain is CLOSED: no axiom, no sorry"*.

`xorshift_mod17_in_rsCode` was **withdrawn**. Two independent computations agree the
16 values interpolate to degree 15, so no degree-`<12` polynomial matches and the
existential has no witness (Otto: Lagrange over GF(17); Soraya: RS parity syndrome
`[5,10,15,2]` plus the 12th finite difference, plus 600k seed trials matching chance
exactly). Root cause was a category error — `8 ≤ 11` compared an LFSR linear
complexity against a polynomial-degree bound.

**17 declarations across three previously-unaudited files are now gated**, each
measured sorry-free before being added, so they are real regression gates rather than
permanently-red steps. Declarations with declared-open obligations are excluded *with
the reason*.

**The anti-vacuity guard, and the near-miss that produced it.** Each audit decides
PASS by the *absence* of `sorryAx`. A `#print axioms` naming an unresolvable
declaration prints no axiom line, so the grep finds nothing and the step passes while
checking **nothing**. I wrote the FinDataProcessing names unqualified first and all 13
silently resolved to nothing — caught by counting printed declarations rather than
trusting the exit code. The guard now fails any audit naming an unresolvable
declaration, and on its first CI run it immediately caught a **pre-existing** vacuous
audit: `CanonicalizerCorrect`'s `eval_xrotxor_concrete` has never existed.

---

## 3. Shipped — retractions

- `26ca8d71e` — `xorshift-minimal-poly.test.ts` claimed "this closes the open axiom in
  PhaseClockErasure.lean". Every assertion in it was arithmetically correct and all 5
  tests passed the whole time; what was false was the claim about what the measurement
  *meant*. Removed the `≤ 11` assertion, which encoded the category error itself.
- `ec028f057`, `10288` — two lockfile breaks, opposite directions (an add and a
  remove). Both mine to fix, neither mine to cause; the healer now covers the class.

---

## 4. WHERE I WAS WRONG

The most useful section, and the reason this doc exists before more work.

### 4.1 Kira: I overstated the PRNG severity (P2, not P1)

I reported the phase-clock PRNG singularity with an exploitability argument. Kira
reproduced every fact and downgraded it, correctly:

- `rank(f^k) = 31` for **all** k ≥ 1 — the entropy loss is one bit **once**, not per
  tick. I implied ongoing degradation.
- Max persisted phase across 1139 files in `docs/observe-events/` is **18**. A 2³⁰
  period is unreachable by eight orders of magnitude, so the 4× period reduction is
  academic in practice.
- **`verifyPhase` has zero non-test callers repo-wide.** My exploitability argument
  rested on an authentication path that **does not exist in production**. I checked
  that the function authenticates by seed equality; I did not check that anything
  calls it. That is the same error I spent the day naming — I verified the mechanism
  and not its reachability.

The defect is real but is **"the code contradicts its own documentation"**, not
"exploitable".

### 4.2 Kira: my rollout proposal was misrouted — my own category error

I proposed shipping the fix via `src/Core/SchemaEvolution.fs`'s migration algebra.
Kira: that module is **F# over `DynamicValue`**; the phase stamp is a **TS JSON
envelope**; *no code path connects them*. I matched a shape and asserted a mechanism —
precisely the numerology failure I had spent the day writing rules about. The elegant
`Down = None` correspondence was real as an analogy and false as an implementation
plan.

Kira's minimum honest version: fix the shift, add `prngVersion` to `PhaseStamp`,
branch in `verifyPhase` only, regenerate the 172 stamped files. No expand/contract
ceremony — because resume is chain-continuation from the last persisted seed and
nothing asserts `seed == f^phase(COMMON_SEED)`.

### 4.3 Soraya: my blast-radius claim was wrong

I wrote that the false theorem had no downstream users. My grep was `.lean`-scoped.
There was a consumer in TypeScript, and it was a **false green in CI**.

### 4.4 Process errors

- I read a background build's `exit 0` that was the exit code of the pipe to `tail`,
  not the build. The build had failed.
- Merged PR #10270 earlier with a failing lint because my grep for `fail` missed the
  string. A matched error string is not a failure; an unmatched one is not a pass.

---

## 5. What Kira found that I missed — routed, not actioned

Two genuine **P1s** on the phase clock, neither requiring any PRNG weakness:

1. **`phase-clock.ts:126`** — `observe(peerPhase)` assigns `phase = peerPhase` from a
   peer-supplied number with no bound, no monotonicity check, no authentication.
   `run-loop-real.ts:224` feeds it a value parsed from a peer's JSON. One event with
   a huge phase permanently poisons every agent's clock and is then persisted.
2. **`phase-erasure.ts:78` / `:47`** — `verifyPhase` and `recoverForward` loop and
   allocate proportional to attacker-supplied `claimed.phase`, uncapped. Remote CPU
   and heap exhaustion.

Also: `phase-erasure.ts:26-28` states "the xorshift is invertible" and "verify
everything backward". Rank 31 admits no inverse, so the module's cyclic-code framing
is stated over a map that is not a bijection.

---

## 6. Mutation testing — asked about, and the answer is uncomfortable

Aaron asked how we are doing on random test mutations for irrelevant tests and vacuous
proofs. Measured rather than recalled:

- `stryker-config.json` mutates **two files** (`Variance.cs`, `ZetaCircuitBuilder.cs`).
- `"break": 0`. Against the workflow's own recorded 0% kill rate, **the exit code is
  constant**. It is a green check that cannot fail.
- Trigger is `pull_request`/`push` on paths — **no `schedule:`**, so it is not part of
  the 24/7 society at all.
- Worse than I first stated (Kira): the path filter includes `src/Core/**`, so **F#
  PRs turn it green while it mutates zero F# lines**. A green badge attached to the
  surface it does not cover.
- **The F# mutation gap is total in CI.** `mutation-runner.ts:146` skips anything not
  `.ts` and is `|| true` in `agent-heartbeat.yml:208` (correctly labelled as a drift
  report). `fsharp-mutation-probe.ts` has **zero references** outside its own file —
  aspirational.

Kira's ranking by value-per-effort: (1) drop `src/Core/**` from the path filter so it
stops signalling on F# — one edit, removes the lie; (2) ratchet `break` to the last
measured kill rate — blocks regression without demanding new tests; (3) widen `mutate`
— worthless until C# tests exist; (4) `schedule:` **last**, because cron-ing a vacuous
gate produces vacuous runs on a timer.

---

## 7. Open, and who has it

| item | owner |
|---|---|
| `observe()` unauthenticated phase assignment (P1) | phase-clock owner / Kira |
| `verifyPhase` / `recoverForward` unbounded loops (P1) | same |
| `>>` → `>>>` + `prngVersion`, Kira's minimal version | same |
| Mutation gate: drop `src/Core/**`, ratchet `break` | factory-ops |
| `ToyModel`/`ErasureDistance` both declare top-level `F` | Lean lane |
| Re-found phase recovery on *imposed* RS structure | Soraya |
| `@falsify:` annotation discipline for computational `sorry` | Kenji |
| Auto-revert authority clause (#10287) | Aaron |

---

## 8. What I did not do

- Did not touch `#10287` or `#10289` — other agents' lanes.
- Did not apply the PRNG fix — behaviour change with a compatibility question.
- Did not act on Lumen's 8h review items — holding for this review, as asked.
- Did not raise the mutation `break` threshold — that decision has a cost I do not own.
