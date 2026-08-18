# Formal verification, consolidated — the proofs, the math, and the code pushed together

*Soraya (formal-verification-expert), 2026-08-18. Routing + coverage audit. The
one-line ask from Aaron was "push the proofs, math and code together" and get an
honest picture of what is **proven** versus **asserted**.*

Governing discipline: [`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
— three states, **toy** / **unmetered** / **metered**, and unlabelled work is
`unmetered`, never "real" by default. The enemy is the **vacuity class**: *a check
that did not run must never look like a check that passed.*

---

## 0. The headline, before the tables

**The portfolio is in better shape than the folklore says, and its weak points are
not where you would guess.** The TLA+ leg is the most honestly-documented
verification surface in the repo. The soft spots are in the *enforcement* layer —
the linters and auditors that are supposed to keep the claims true — and in a
handful of individual tests that name a guard and never execute it.

Four vacuous or near-vacuous checks were found and three were repaired in this
pass, each with a **mutation proof that the replacement actually fails** when the
code it guards is broken. Detail in section 4.

---

## 1. Inventory — what exists, and what runs

| Tool | Artefacts | In `gate (required)`? | What it establishes | Status |
|---|---|---|---|---|
| **TLA+ / TLC** | 36 `.tla` modules (34 model-checked) + **53 pinned model runs** in `registry/tlc-models.json` | **Yes** — `Tlc.Runner.Tests.fs`, via `dotnet test Zeta.sln` (`gate.yml:456`) | State-machine safety, concurrency interleaving, quorum/BFT safety | **metered** |
| **TLAPS** | `NciSafetyProofs.tla`, `NciNonUrgencyProofs.tla` | Separate workflow `tlaps-proof.yml` (paths-filtered) | Unbounded proof, not bounded model-check | **metered**, not in the PR-blocking lane |
| **Lean 4** | 48 `.lean` files; ~30 headline lemma families under a `#print axioms` audit | **Yes** — `lean-proof.yml`, and the audit runs through `run-checked.ts` | Machine-checked theorems; `sorryAx` in the axiom set fails the job | **metered** |
| **Z3 / SMT** | 9 `.smt2` obligations + `Z3.Laws.Tests.fs`; z3 4.16.0 / cvc5 1.3.4 version-pinned | **Yes** — `gate.yml:2015` pins the solvers; laws run under `dotnet test` | Pointwise algebraic + bit-vector identities | **metered** |
| **Alloy** | 6 `.als` models + `AlloyRunner.java` | **Yes** — `Alloy.Runner.Tests.fs` | Bounded structural / relational shape | **metered** |
| **FsCheck** | 587 `[<Fact>]`/`[<Property>]`/`[<Theory>]` attributes under `tests/Tests.FSharp/Formal/` alone | **Yes** | Generative execution of the real code paths | **metered** |
| **Stryker.NET** | `stryker-config.json` | Own workflow, paths-filtered to `src/Core.CSharp/**` | Mutation coverage of 2 C# files | **unmetered — see section 3** |
| **`mutation-runner.ts`** | first-party, F#-capable | `agent-heartbeat.yml` only | Per-tick sampled falsifier check | **metered but not gating** |
| **Semgrep** | `.semgrep-floor.yml` (blocking) + `.semgrep.yml` (drift) | **Yes** | Lint-level taint / pattern | **metered** |
| **CodeQL** | `codeql.yml` | Yes | Dataflow / adversarial input | **metered** |

**The number that matters.** The TLA+ leg alone is **53 gated model runs**, of
which **14 expect a VIOLATION** — a run that going *green* would be the failure.
That negative-control ratio (26%) is the single strongest honesty signal in the
whole portfolio, and it is why I am not going to spend this round hardening TLA+.

---

## 2. The TLA+ registry is the model the rest of the portfolio should copy

`registry/tlc-models.json` pins module x config x **every flag** and records, per
model, whether the deadlock check actually constrains anything:

| `deadlock` field | count | meaning |
|---|---|---|
| `off-cfg` | 25 | `CHECK_DEADLOCK FALSE`, declared in the `.cfg`, with a reason |
| `on` | 6 | genuinely checked and genuinely able to fail |
| **`on-vacuous`** | **22** | check is on, and **cannot fail** — an unconditional `Stutter` disjunct, or `Next == UNCHANGED vars` |

**22 of 53 runs carry a deadlock check that makes no claim, and the registry says
so in its own text.** That is the opposite of the vacuity class: the check is
still there, and the artefact refuses to let its green be read as evidence. Two
entries go further and refuse to assert a state count at all, because a
halt-on-violation run's exploration order depends on worker count.

Nothing to route here. The routing call is: **new specs must land with a registry
entry that names its own vacuity, or they do not land.**

---

## 3. Where the portfolio is genuinely thin

| Gap | Why it matters | Routing call |
|---|---|---|
| **Stryker `"break": 0`** and `mutate: ["Variance.cs", "ZetaCircuitBuilder.cs"]` | The mutation gate's exit code is constant against its own recorded 0% kill rate. It **cannot fail.** | Already named in `stryker-mutation.yml`'s own header (2026-08-15) and deliberately left to the operator — raising the threshold demands C# tests that do not exist. **Correctly deferred, not hidden.** Do not read a green Stryker job as mutation evidence. |
| **`mutation-runner.ts` is not in `gate`** | The one first-party falsifier-of-falsifiers runs only on the heartbeat tick | Leave it. A mutation run is minutes per mutant; the PR lane cannot carry it. But **do not cite it as gate coverage.** |
| **`BftLiveness` is `tier: extended`** | 43 min under the pinned `workers=1`; too slow for the PR lane | Already declared in the registry rather than dropped. Route to a scheduled lane. |
| **`PredictiveLookahead` liveness deliberately un-gated** | mixing a state CONSTRAINT with a liveness PROPERTY is unsound in TLC and yields a **spurious PASS** | Correct call, already documented. The reformulation as a separate `LiveSpec` is the P2 follow-up. |
| **`audit-formal-artifacts.ts` mismeasures** | It reports 21 TLA+ specs and 39 formal tests as `UNREFERENCED`. Its predicate is *"does any file under `docs/**/*.md` contain this path"* — mention-in-prose. All 34 gated TLA modules are pinned in `registry/tlc-models.json`, which it never reads. | **The field is named `substrateStatus` and reads as "is this wired up".** It is not. Worse in the other direction: name-dropping a genuinely orphaned spec in one markdown file flips it to `referenced`. Routed as a follow-up; not repaired here because the fix is to re-point it at the runners' own rosters, which is an M. |

---

## 4. The vacuity findings — four found, three repaired, each with a mutation proof

### V1 — `lint-discharge-certificate-consistency.ts` scanned ZERO rows and printed a tick **(repaired)**

The rule doc names this lint as the mechanical enforcer of section A
(*"refuses a section-A row whose evidence disagrees or is absent"*). Its predicate
matches the literal string `§A — DISCHARGED`. That phrase survives on exactly six
lines of the register and **all six are inside `DEMOTED §A → §B` banners** that
the predicate correctly excludes. It ran in `gate.yml:1335` and printed:

```
[discharge-consistency] OK 0 section-A DISCHARGED row(s) scanned; every cited certificate agrees.
```

A green over the empty set. *"0 findings"* and *"0 measurements"* are different
facts and the message gave them the same words — the identical failure the Lean
axiom audit was fixed for on 2026-08-15, where a crashed `lean` produced no output,
`grep` found no `sorryAx`, and the step passed having proved nothing.

**Repair, two parts:**

1. The empty scan is now reported as an empty scan, and names its follow-up
   (`081M0B2R2BQ087G0R000EC2E9Y`). Widening the matcher to the live `PROVEN`
   phrasing is **not** done here: section A is a 43-row table containing nested
   sub-tables, a naive widening flags 23 "rows" of which most are sub-table lines,
   and shipping that blind turns `gate` red on `main` with false positives —
   which is how a real check gets switched off.
2. **A section-A anchor check was added, and it has live jurisdiction.** Every
   backticked artifact token in section A must resolve to a tracked file. **It went
   red on `main`** (see V2) and is green after that repair. 49 anchors now checked
   on every PR.

A design property worth stating: inside section A, **backticks mean "this is an
anchor."** The repair note in the register deliberately writes the dead filename
*without* backticks, because prose about a dead name must not wear the marks of a
live one.

### V2 — a section-A row cited a file that has never existed **(repaired)**

Row 25, "Reticulum Transport Integration", is marked `PROVEN (FsCheck), 2026-07-03`
and named `ReticulumTransport.fs`. There is no such file, and there never has been.
`RT-1`/`RT-2` in `tests/Bayesian.Tests/Integration.Tests.fs` call
`MeshLatencyModel.buildLatencyMap` — the module is `src/Bayesian/MeshLatencyModel.fs`.

The row's *claim* was fine; its *citation was unopenable*. That is an anchor cited
but never **checked** — precisely the failure
[`anchor-to-human-prior-art`](../../.claude/rules/anchor-to-human-prior-art.md)
names. Anchor repaired, and V1's new check is what stops it recurring.

*(Honest note while I was in there, not repaired: `RT-1` asserts
`Assert.Equal(2.5, slowLatency)` because `buildLatencyMap` is currently the
identity on `RttSeconds`. The row's word "converts" oversells a projection. Left
alone — a wording question for the row's author, not a vacuity.)*

### V3 — `ComputeReceipt.Tests.fs` CR-6 and CR-7 could not fail **(repaired)**

Both tests are named for the degenerate guard at `src/Core/ComputeReceipt.fs:81`.
Both routed through `SoftValue.ofWeighted []` and matched on the result:

```fsharp
match SoftValue.ofWeighted [] with
| None -> Assert.True(true)          // <- the ONLY reachable path
| Some emptyVal -> Assert.Equal(None, CR.compute emptyVal valid 10 100L)
```

`ofWeighted` returns `None` for the empty list **unconditionally**, so the `Some`
arm is dead code and the only executed statement in either test is
`Assert.True(true)`. The guard they are named for was **never executed by any
test.** The comment even admits it — *"so we skip this test"* — which is the tell:
the test was demoted in prose and kept its confident name.

This matters more than it looks. `SoftValue` is a public record, so the empty
value the smart constructor refuses to build **can still be constructed
directly** — which is exactly the state the guard defends against.

**Repair:** construct `{ Candidates = [] }` directly, plus a **negative control**
(`CR-6b/7b`) so the pair cannot be satisfied by a `compute` that returns `None`
for everything.

**Mutation proof.** Replacing the guard with `if false then`:

```
Failed  CR-6 compute returns None for empty prior
  Expected: null
  Actual:   Some({ IV = infinity; DeltaJ = 1000.0; DeltaU = infinity; ... })
Failed  CR-7 compute returns None for empty posterior
  Expected: null
  Actual:   Some({ IV = 0.0; DeltaJ = 1000.0; DeltaU = -1000.0; Heat = 1000.0; LandauerRatio = 1e+15 })
```

Both new tests kill the mutant; the old pair passed under it. And the mutant's
output shows what the guard was holding back: **`IV = infinity`** — an unbounded
information-value on a thermodynamic receipt.

Worth filing beside the register: **section-A row 16 ("Eve's Small-Rooms
Principle") names `ComputeReceipt.Tests.fs` as its evidence**, and two of that
file's tests could not fail. The row is not thereby wrong — CR-1..CR-5 and
CR-8..CR-12 are real — but it is exactly why V1's anchor check checks *existence*
and stops there: **sufficiency is not a lint's judgement to make**, and pretending
otherwise would be a new vacuity wearing a fix's clothes.

### V4 — a noninterference proof whose second assertion compared an expression to itself **(repaired)**

`tests/Tests.FSharp/Formal/NtpNoninterference.Tests.fs`, inside the `[<Fact>]`
*"a post-mint clock cannot re-rate or re-identify a minted link (quarantine)"*:

```fsharp
// and the cards themselves are unchanged
let cardsOf links = links |> List.map MP.renderCard |> String.concat ""
Assert.Equal<string>(cardsOf links, cardsOf links)
```

The comment claims a second, independent quarantine check — *unchanged across the
two clocks*. `cardsOf` takes no clock, both sides are the same expression, and the
assertion cannot fail for any implementation of anything. This is the exact shape
Aaron reported finding in his own mod-8 work: **two predicates asserted to agree
when they are the same predicate.**

**Repair:** make the claim the comment intends. Extract the grid region from the
page rendered under each clock and compare it **exactly** to the standalone card
rendering.

**Mutation proof, including a correction to my own first draft.** My first repair
used `Assert.Contains(cards, page)`. I mutated `renderPage` to append `<!--x-->`
inside the grid — and **`Assert.Contains` survived it**, because a page with junk
appended still *contains* the cards. My own fix was too weak, and it was caught
only because I ran the mutant instead of arguing about it. The exact-extraction
version kills it:

```
Failed  a post-mint clock cannot re-rate or re-identify a minted link (quarantine)
  Expected: ...<b>9</b></div></div>
  Actual:   ...<b>9</b></div></div><!--x-->
```

The load-bearing detail: under that mutant the **other three tests in the file,
including the pre-existing two-clock property, all passed.** The mutant is
clock-independent, so a two-clock comparison cannot see it. The strengthened
assertion catches a leak class nothing else in the file catches — which is the
whole justification for it existing as a second check.

### Not vacuous, and worth defending — the `f(x) = f(x)` family

The scan flagged **41 F# and 33 TypeScript** assertions of the form
`Assert.Equal(f x, f x)` / `expect(f(x)).toBe(f(x))`. **Most of these are
legitimate and should not be deleted.** They are the falsifier for manifesto
section 13, noninterference: they fail exactly when `f` reads an ambient source —
a wall clock, an un-seeded RNG, hash-seed-dependent dictionary order.
`SE.runNci seed n cands ticks`, `DExc.shuffle 42UL arr`, `fold(initial, events)`
are all genuine.

The honest discriminator, stated so it can be applied rather than argued:

> **A determinism assertion is metered iff the callee's transitive call graph can
> reach an ambient source. Otherwise it is unmetered decoration.**

By that rule a handful are decoration — `ReportTriage.domainKey "billing" "eu" =
ReportTriage.domainKey "billing" "eu"` over an `sprintf` of two strings cannot
reach anything ambient. Left alone deliberately: they sit beside the real check on
the line above, they cost one line, and deleting them buys nothing while risking
the removal of a genuine one by a future reader who does not know the rule. **The
rule is the deliverable here, not a deletion.**

Likewise **not** vacuous: the 101 `Assert.True(false, "message")` hits are the
standard F# match-fallthrough fail-with-message idiom, and `Assert.True(true, ...)`
paired with it in the *other* arm is a pattern discrimination, not a tautology.

---

## 5. Frozen-core register — checked against reality

- **49 section-A anchors now resolve**, mechanically, on every PR. One did not
  before today (V2).
- **No section-B toy is cited elsewhere as discharged.** The six `§A — DISCHARGED`
  strings that remain are all inside their own demotion banners, and the
  register's A-method notes are unusually careful about direction of dependency —
  the "Row 15 orthogonal to section-B-ks" note explicitly forbids reading the open
  KS-entropy rung as support for the closed Condorcet row.
- **Row numbers have drifted** and the register says so, redirecting `#22` and
  `#23` by hand rather than mass-renumbering. Cite section-A rows **by title**.
- **Row 15's own metered boundary is stated by its author**: metered as
  *mathematics*, unmetered as a claim about Zeta's actual agents, because nobody
  has estimated rho or c for the live fleet. That is the discipline working.

---

## 6. `CliffordPeriodicity` — the file named in the brief is **not on `main`**

The brief described `src/Core/CliffordPeriodicity.fs` as having "landed today
(mod-8 Clifford classification, 27 tests)". At `origin/main` `90e96dc542` **no such
file exists.** It is in **open PR #12014** (`shadow/ferry-geometric-unity-iceberg`),
whose own body says 20 tests, not 27. Recording the discrepancy because a coverage
map that quietly counts an unmerged file is the same failure class as everything
above.

Judged from the diff, by the same standard:

- **Good:** `classify` is anchored to Atiyah-Bott-Shapiro (*Clifford Modules*,
  Topology 3 (1964) Suppl. 1, 3-38) with the table checked against known
  isomorphisms rather than asserted; the `(((p - q) % 8) + 8) % 8` normalisation
  correctly handles .NET's remainder-not-modulus, and says so in a comment.
- **The vacuity Aaron already found is real and is in this diff:**
  `admitsDoublyEvenSelfDualCode length = length > 0 && length % 8 = 0` and the
  dimension predicate `dimension > 0 && dimension % 8 = 0` are the same predicate
  on different names. A test asserting they agree cannot fail unless someone edits
  one and not the other. **Routing call: that is not a test, it is a refactor
  waiting to happen** — either collapse them to one function with two call sites,
  or give each a *distinguishing* case the other gets wrong. It is his find, in his
  branch; I am not editing an open PR.
- **Routing for the rest of that PR:** `classify` is an **algebraic-law identity**
  over a finite index set. The primary tool is exhaustive F# enumeration over
  `s` in `0..7`, which is what it has. Cross-check is **not** warranted (P1, not
  P0) — a wrong Morita class surfaces as a failing acceptance test in-round, and
  reaching for Lean here would be human-weeks for a table lookup.

---

## 7. Routing calls, consolidated

| Property class | Where it lives now | Call |
|---|---|---|
| State-machine safety / concurrency | TLA+ + registry | **Correct tool. Keep.** New specs land with a registry entry naming their own vacuity, or they do not land. |
| Machine-checked theorems | Lean + `#print axioms` via `run-checked.ts` | **Correct tool.** The `run-checked` discipline (no measurement is not no findings) should be the template for every audit script in `hygiene/`. |
| Pointwise algebraic identity | Z3 / SMT, solver-pinned | **Correct tool.** Do not promote these to Lean. |
| Structural shape | Alloy, 6 models | Under-used. Two models (`IdentityReissuable`, `ThreeColoring`) are cited in no doc; check the runner's roster before assuming they are orphaned. |
| Mutation coverage | Stryker (cannot fail) + `mutation-runner.ts` (not gating) | **The weakest leg.** Neither can block a PR. Named, not hidden. |
| Section-A register integrity | `lint-discharge-certificate-consistency.ts` | Anchor half now live (49 checked). Certificate half filed at `081M0B2R2BQ087G0R000EC2E9Y`. |
| Formal-artifact inventory | `audit-formal-artifacts.ts` | **Mismeasures.** Re-point at the runners' rosters; until then do not quote its `UNREFERENCED` count. |

---

## 8. What I did not do

- Did **not** write or modify any TLA+ spec, Lean proof, Z3 lemma, or Alloy model.
  Routing only; the artefacts are their authors'.
- Did **not** widen the discharge matcher blind (see V1) — a check that goes red
  with false positives is a check that gets disabled.
- Did **not** delete the `f(x) = f(x)` family. The discriminating rule is the
  deliverable.
- Did **not** touch open PR #12014.

## Pointers

- `registry/tlc-models.json` — the pinned model roster; the honesty standard
- `src/Core.TypeScript/hygiene/lint-discharge-certificate-consistency.ts` — the section-A anchor check
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` — sections A and B
- `.claude/rules/toy-is-free-metered-must-be-earned.md` and `.claude/rules/anchor-to-human-prior-art.md`
- `workitems/081M0B2R2BQ087G0R000EC2E9Y-widen-lint-discharge-certificate-consistency-to-the-live-sec.md`
- `memory/soraya/NOTEBOOK.md` — round targets + portfolio metric
