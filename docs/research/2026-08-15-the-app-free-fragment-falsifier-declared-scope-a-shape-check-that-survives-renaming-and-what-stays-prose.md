# The `app`-free fragment falsifier — declared scope, a shape check that survives renaming, and what stays prose

**Register:** Beacon for the type theory, Mirror for the build notes. This is the **implementation
half** of a finding a sibling agent established the same day; the finding is in
[`2026-08-15-the-app-free-fragment-was-a-one-time-grep-not-a-check-and-by-construction-is-false-for-isr.md`](2026-08-15-the-app-free-fragment-was-a-one-time-grep-not-a-check-and-by-construction-is-false-for-isr.md)
(PR #10821). That document is the source of every claim restated here; nothing in it is re-litigated.

Aaron, on reading it: *"we want this in repo somewhere and make sure it progresses."*

***

## What shipped

| artefact | what it is |
|---|---|
| `registry/app-free-fragment.json` | The **declared scope** — five modules claiming `app`-freedom with a stated reason each, four declared explicitly outside, one recorded unchecked caveat, and an empty structural-exemption list. |
| `tests/Tests.FSharp/AppFreeFragment.Tests.fs` | Three checks plus their mutation and scope tests. Runs under `dotnet test Zeta.sln -c Release`. |

The sibling's own diagnosis was the design constraint, and it is worth repeating because it is the
part that is easy to skip:

> **The allowlist *is* the content — the grep's real defect was undeclared scope.**

So the manifest is not configuration for the check. It is the artefact, and the check is its executor.

## The three layers, and why three

| | what it reads | scope | what it is for |
|---|---|---|---|
| **C1 totality** | source text, comments stripped | all of `src/**/*.fs` | Every file using the `ISR<` type must be classified `fragment` or `outside`. This is the layer that closes the original defect: scope cannot drift in silently, because an unclassified file is red. |
| **C2 structural** | .NET reflection over `Zeta.Core` | whole assembly, exemptions by type name | No member anywhere has `app`'s **type shape**. Name-independent. |
| **C3 syntactic** | source text, comments stripped | declared `fragment` only | No `app`/`bind` binding, `.Bind` member, `>>=`, or computation-expression builder. This is the layer that **must** stay scoped. |

C3 alone would be the grep with a CI badge. C2 alone would miss `Meno`-style monadic code that is
outside the fragment for reasons of *construct*, not of *type*. C1 alone checks nothing about `app`
at all — it checks that somebody decided.

## The structural layer, and the fact it turns on

`ISR<'A,'B>` is a *type abbreviation*, so the compiled signature never mentions it — and **F#
eta-expands**, which flattens the arrow into trailing method parameters. Measured by reflection on
the Release build, 2026-08-15:

```text
IsrLift.ofPure     params (FSharpFunc<a,b>, IntrCtx, a)       ret Task<Result<b, InterruptFeedback>>
ISR.(>=>)          params (ISR<A,B>, ISR<B,C>, IntrCtx, A)    ret Task<Result<C, InterruptFeedback>>
app                params (IntrCtx, ISR<a,b>, a)              ret Task<Result<b, InterruptFeedback>>
```

That third row was obtained by actually writing `app` into `IsrLift.fs` and reflecting on the
result, not by reasoning about what F# would emit.

The three rows hand over the discriminator directly. In a flattened signature, everything **before**
the last `IntrCtx` parameter is supplied at *construction*; everything **after** it is the arrow's
*value channel*. Hughes's `app` is precisely *an arrow arriving through the value channel*:

- `>=>` takes two arrows — but as **construction** arguments. The pipeline shape is fixed before the
  first tick. Legitimate, and it must stay legitimate, or the check bans every combinator in the
  fragment and gets itself deleted.
- `app` takes an arrow **in the value channel**. The continuation is chosen by a value flowing
  through the pipeline, which is exactly what `ArrowApply ≅ Monad` says costs you static
  analysability.

No name appears in that rule. That is the point of it.

## Evidence — the mutation runs

Raw exit codes, each command run directly rather than through a pipe (a pipeline's status is the
last command's, which printed `Build FAILED` at `EXIT=0` for another agent today).

**Baseline, unmutated:**

```text
REVERT_BUILD_EXIT=0            dotnet build Zeta.sln -c Release      0 Warning(s) / 0 Error(s)
REVERTED_TEST_EXIT=0           Passed! - Failed: 0, Passed: 10, Total: 10
FULL_TEST_EXIT=0               dotnet test Zeta.sln -c Release       Tests.FSharp.dll  5065 passed, 0 failed
```

**Mutation A — Hughes's `app`, verbatim, appended to `src/Core/IsrLift.fs`:**

```fsharp
let app<'a, 'b> : ISR<ISR<'a, 'b> * 'a, 'b> =
    fun ctx (f, a) -> f ctx a
```

```text
MUTATION_A_BUILD_EXIT=1        MSB4166 child node exited prematurely  ← infrastructure flake
MUTATION_A_BUILD_RETRY_EXIT=0  0 Warning(s) / 0 Error(s)
MUTATION_A_TEST_EXIT=1         Failed! - Failed: 2, Passed: 8, Total: 10
```

Exactly the two **claim** tests went red, each naming the module and the construct:

```text
C2 structural — no member of Zeta.Core has the ArrowApply type shape
  Zeta.Core.IsrLift.app
      Hughes ArrowApply shape: value-channel parameter 'f' of an ISR-returning member is
      itself an ISR arrow (…). An arrow arriving through the value channel makes the
      pipeline shape value-dependent (ArrowApply == Monad, Hughes 2000).

C3 syntactic — declared-fragment sources contain no monadic construct
  src/Core/IsrLift.fs:36  Hughes ArrowApply binding named `app`
      let app<'a, 'b> : ISR<ISR<'a, 'b> * 'a, 'b> =
```

**Mutation B — the same operator under a name no identifier grep would find:**

```fsharp
let relayCarried (ctx: IntrCtx) (carried: ISR<'a, 'b>) (value: 'a) : Task<Result<'b, InterruptFeedback>> =
    carried ctx value
```

```text
MUTATION_B_BUILD_EXIT=1        MSB6006 "dotnet" exited with code 134  ← SIGABRT flake
MUTATION_B_BUILD_RETRY_EXIT=0  0 Warning(s) / 0 Error(s)
MUTATION_B_TEST_EXIT=1         Failed! - Failed: 1, Passed: 9, Total: 10
```

**C3 stayed green. C2 went red**, naming `Zeta.Core.IsrLift.relayCarried`. That asymmetry is the
whole result: the identifier layer is blind to a rename, and the shape layer is not. If only C3
existed, mutation B would have shipped under a passing gate — which is the failure mode the sibling
named ("an identifier-only grep re-encoded as a lint would be the same defect with a CI badge").

**Both flakes are the ones already on today's list** (MSBuild worker-node death; `dotnet` SIGABRT
134). Each was retried exactly once and passed. Recorded rather than quietly re-run.

## The check must not fire outside the declared scope — proved in both directions

A lint that flags legitimate monadic code is disabled the week it lands, so this is pinned rather
than asserted. `src/Core/Meno.fs` and `src/Core/SagaBuilder.fs` **do** contain constructs C3 bans —
`MenoBuilder.Bind` selects its continuation arrow from a runtime value (`let (MenoArrow h) = g
span.[i].Key`), and `SagaBuilder` is a full computation expression that ingests `ISR` through
`liftISR`. The test asserts *both* halves:

- they are declared `outside`, and never in `fragment`; **and**
- scanning them **does** produce hits.

The second half is what makes the first half mean anything. If they were green because the scanner
happened not to match them, the exclusion would be luck rather than a decision, and the manifest
would be decoration.

## What C1 found immediately, and an error of my own

On first run, C1 reported two files nobody had classified: `src/Core/SchedulerShedHeat.fs` and
`src/Core/SoftThrottle.fs`. Both turned out to mention `ISR<'S,'S>` **only inside docstrings**
explaining what `Handler.Run` cannot see — zero code-level uses. Both layers now strip comments
before matching, because forcing a manifest entry for every prose mention would fill the allowlist
with noise and erode exactly the signal it exists to carry.

**My error, recorded rather than smoothed over:** my first inventory of ISR-using modules came from
an `rg` run against a clone whose `main` was stale, and it missed both files. The totality check
found them on its first execution. That is a small instance of the same lesson the whole artefact is
about — *a check that ran once, by hand, is not a check* — and it happened to the person writing the
check, in the middle of writing it.

## A boundary case inside the fragment, declared rather than passed

`SoftScheduler.fs:113`:

```fsharp
type HandlerK<'S> =
    { Name: string
      Matches: InterruptKind -> bool
      RunK: InterruptKind -> ISR<'S, 'S> }
```

`RunK` selects an arrow from a **runtime value** — the arriving interrupt — and `driveK` applies it
per arrival. That is the bind-continuation *shape*, and it is the closest thing to `app` anywhere in
the declared fragment. The original grep never reached this module.

**Neither layer flags it, and neither can by type.** `InterruptKind -> ISR<'S,'S>` is
type-indistinguishable from `SoftChip8Scheduler.timerIsr : int -> ISR<Frame,Frame>`, which is an
ordinary construction-time-parameterised builder and entirely legitimate. Separating them requires
dataflow — *does the argument originate inside the pipeline?* — which this checker does not do.

So it is written into the manifest as an `uncheckedCaveats` entry, and a test asserts that the entry
**stays there** and that the shape is genuinely present in the compiled type. The fragment claim
holds for `Handler`/`drive` and is **unverified** for `HandlerK`/`driveK`.

## Which lane, and a correction to the brief

The brief asked for *"an allowlist-scoped hygiene lint … wire it where it will actually run … pick a
lane that blocks."* I did the second and third and **not** the first, deliberately.

`src/Core.TypeScript/hygiene/` **does not block.** Since the drift-and-heal ADR flip (2026-08-01),
`gate (required)` rolls up only four jobs — `build-and-test`, `lint (semgrep)`, `cross-verify`,
`full-verify` — and `gate.yml` states in its own comment that re-adding a job to that list *"= adding
to the floor = treaty-amendment consent path."* A hygiene lint would run, report, and merge red. For
an artefact whose entire subject is *a check that did not run looking like one that passed*, that
placement would have been self-refuting.

Amending the floor is a **gated class**. The shadow inherits standing authority and does not extend
it into one, so the answer was not to ask for an exception but to use a lane that already blocks:
the check is a **test**, and `dotnet test Zeta.sln -c Release` runs inside `build-and-test`.

**I also did not write a second TypeScript implementation.** Two checkers over one manifest would
drift, and the one that drifts is the one nobody runs. Cost, stated plainly: `hygiene/scoped-lint.ts`
will not surface this locally — you get it from `dotnet test`, and in CI from the gate.

## Register — what is now metered, and what is still prose

`toy-is-free-metered-must-be-earned.md` governs, and the promotion is **partial by construction**.
Reading the whole original sentence as validated would repeat the overclaim in a new place.

**Now metered** (a falsifier exists, it fails when the property is false, and mutation-testing shows
which mutation reddens which check):

- No member of `Zeta.Core` has the ArrowApply **type shape** — under any name.
- The five declared modules contain no `app`/`bind` binding, `.Bind` member, `>>=`, or CE builder.
- Every `ISR<`-using source file is **classified**, so the scope of the claim is written down and
  changing it is a visible diff.

**Still prose, and not upgraded by this PR:**

- *"The predictor computes cost ahead of execution **because** the pipeline's shape cannot depend on
  values flowing through it."* The check establishes the antecedent, not the consequent. Nothing here
  measures the CHIP-8 cost predictor's accuracy or ties it to the fragment property. That link is the
  next falsifier, and it is a different one.
- *"No arrow on this path is chosen by a value flowing through it."* The checker is a **proxy** for
  this. It catches the known spellings and the ArrowApply type shape; it does not do dataflow, so
  `HandlerK.RunK` sits inside the fragment unverified.
- **"By construction" remains false and this changes nothing about that.** `app` is still definable
  in one line and still compiles. The property is `app`-free **by absence**, now maintained by a
  falsifier instead of by nobody having written it.

### What the check cannot catch — stated, not implied

1. **Dataflow.** A value-selected arrow whose *type* looks like a construction-time builder. The
   named live instance is `HandlerK.RunK`.
2. **Boxing / `obj` / reflection.** An arrow smuggled through an untyped channel has no shape to
   detect.
3. **Depth.** `containsIsr` walks nested record and union fields to a bound of 8. Deeper than that,
   an arrow in a wrapper is not found.
4. **Block comments.** Only `//` comments are stripped, so `(* … *)` text is still scanned by C3.
5. **Unannotated inference.** C1 keys on the textual `ISR<`. A module whose ISR usage is entirely
   inferred is not classified — and therefore is not scanned by C3 either. C2 still covers it, since
   reflection sees erased abbreviations.
6. **Other assemblies.** C2 scans `Zeta.Core`. An ArrowApply-shaped member elsewhere is not seen.

## Anchors (checked, not merely cited)

- **John Hughes, *Generalising Monads to Arrows*, Science of Computer Programming 37(1–3), 2000.**
  Source of `arr`/`>>>`/`first`, of `app` and `ArrowApply`, of `ArrowApply ≅ Monad`, and of static
  analysability as the stated motivation for the weaker interface. *Entailment checked* by the
  sibling document; this one adds no new use of the paper beyond what it established.
- **Lambek — cartesian closed categories.** Cited only to **exclude**: the CCC evaluation morphism
  `app : Bᴬ × A → B` is a different `app`, and it is the sense the repo *claims* for DynamicValue
  rather than avoids. The manifest says so in its own `description`, so a later reader cannot pick
  up the wrong `app` from the registry alone.

## Pointers

- `registry/app-free-fragment.json` — the declared scope; the artefact
- `tests/Tests.FSharp/AppFreeFragment.Tests.fs` — the executor, its mutation tests and its limits
- `docs/research/2026-08-15-the-app-free-fragment-was-a-one-time-grep-not-a-check-and-by-construction-is-false-for-isr.md` — the finding this implements (PR #10821)
- `docs/research/ip-questionable/2026-08-13-frederic-schuller-toe-constructive-gravity-einstein-derived-from-maxwell-predictivity-aaron-forwarded.md` §"which 'arrow', precisely" — the original claim
- `src/Core/IntrCtx.fs`, `src/Core/IsrLift.fs`, `src/Core/SoftScheduler.fs`, `src/Core/SoftChip8Scheduler.fs`, `src/Core/SoftIsr.fs` — the declared fragment
- `src/Core/SagaBuilder.fs`, `src/Core/Meno.fs` — declared outside; the proof that the check is scoped
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the register applied above
- `.github/workflows/gate.yml` `gate-required` — the four-job floor, and why this is a test
