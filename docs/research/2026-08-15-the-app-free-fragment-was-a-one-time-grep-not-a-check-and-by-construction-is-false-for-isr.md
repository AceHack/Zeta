# The `app`-free fragment was a one-time grep, not a check — and "by construction" is false for ISR

**Register:** Beacon for the type theory, Mirror for the recall thread. The load-bearing
line is a **correction to a merged doc**, so it is stated flatly.

Aaron asked, 2026-08-15, whether there was *"some formal check that we did not use `app`
anywhere in our code … I think we were trying to prove homoiconicity."* This is the search
result. The recollection is **substantially real and correctly sourced to `ISR`** — and
three of its details are wrong in ways that matter.

***

## What was found

The artefact is
`docs/research/ip-questionable/2026-08-13-frederic-schuller-toe-constructive-gravity-einstein-derived-from-maxwell-predictivity-aaron-forwarded.md`,
**§"Addendum — which 'arrow', precisely (Aaron, 2026-08-13)"**, lines 286–331. Merged in
PR #10351 / #10360.

The claim, verbatim (lines 316–320):

> **And it holds in the code, checked rather than taken on report.** `src/Core/IsrLift.fs`
> exposes exactly two constructors … Grepping the module for `app`, `bind`, `Bind`, `>>=`
> returns **nothing**. The ISR arrow sits inside the `app`-free fragment by construction.

So the "formal check" was **a grep, run once, in a session, and recorded in prose.** It is
not a test, not a lint, and not wired to CI.

## Which sense of `app` — a fourth one, not on the brief's list

The search brief offered three candidate senses (`App<'F,'T>` HKT encoding; `ap`/`<*>`
applicative; the CCC evaluation morphism `app : B^A × A → B`). **The artefact uses none of
them.**

The sense in use is **Hughes's `ArrowApply` operator `app`** — *Generalising Monads to
Arrows*, Science of Computer Programming 37 (2000). Signature `app :: a (a b c, b) c`. The
load-bearing theorem the doc cites is **`ArrowApply` ≅ `Monad`**: an Arrow equipped with
`app` has exactly monadic expressive power, and conversely.

This is why **Aaron's memory of "it let us keep monad-like structure in the meta language"
is right about the association and inverted in valence.** `app` is what *grants* monadic
power; the design point was to *stay out* of it, because the `app`-free fragment is the one
where a pipeline's shape is fixed at construction and therefore **statically analysable** —
which is what the CHIP-8 cost predictor needs. Hughes's original motivation was precisely
this static analysability.

The CCC reading in the brief was a reasonable hypothesis and is **not** what happened.
Worth noting because it points the other way: the repo does not avoid cartesian closure — it
**claims it**. `docs/PRIOR-ART-LIST.md` lists *Cartesian Closed Category* (Lambek; Conal
Elliott, *Compiling to Categories*, ICFP 2017) as **"the proper algebraic home for the typed
self-representing meta-language (DynamicValue)."** Avoiding `app` in the ISR arrow and
claiming a CCC home for DynamicValue are **two different threads about two different
objects**; they have not been conflated in-tree, and they should not be merged now.

## Corrections to the recollection

| recalled | actual |
|---|---|
| connected to **`ISR`** | **correct** — `IsrLift.fs` / `IntrCtx.fs` is exactly the site |
| connected to the **braided monoid** | **no** — zero overlap; `rg -l -i 'ArrowApply\|app-free' src/ tests/` returns nothing, and nothing in the Meno-braided line references it |
| in service of **homoiconicity** | **no** — in service of the **CHIP-8 cost-predictivity** claim (the light/dark axis). Homoiconicity is a genuinely adjacent thread in the same corpus (DynamicValue / CCC / `cross-lane-equivalence.test.ts:130`), which is a very plausible source of the cross-wire |
| a **formal check** | **a one-time grep recorded in prose.** No executable falsifier exists |

## The absence claim is true today; the "by construction" claim is false

Two separable claims got welded into one sentence, and only the first survives.

**True.** A bare `app` identifier appears **0 times** in F# sources:

```
rg --pcre2 '(?<![A-Za-z0-9_.])app(?![A-Za-z0-9_])' --glob '*.fs' src/   # 0 matches
```

`IsrLift.fs` is 33 lines with exactly `ofPolicy` and `ofPure`; `IntrCtx.fs` has no `bind`,
`Bind`, or `>>=`. The grep reproduces.

**False.** *"…sits inside the `app`-free fragment **by construction**."* "By construction"
asserts a **type-level obstruction** — that the type could not admit `app` even if someone
wrote it. It does admit it. From `src/Core/IntrCtx.fs:34`:

```fsharp
type ISR<'A, 'B> = IntrCtx -> 'A -> Task<Result<'B, InterruptFeedback>>
```

That is a Kleisli arrow over the monad `Task<Result<_, InterruptFeedback>>` under a Reader —
and `IntrCtx.fs:17` says so in its own words: *"the error channel for the **ISR monad**."*
Hughes 2000 §5 gives `Kleisli m` as an `ArrowApply` instance for **any** monad `m`. So `app`
is definable in one line. Checked, not inferred — this compiles and runs under `dotnet fsi`
against the exact type shape:

```fsharp
let app<'a, 'b> : ISR<ISR<'a, 'b> * 'a, 'b> =
    fun ctx (f, a) -> f ctx a
```

The honest statement is **`app`-free by absence, maintained by nobody having written it** —
which is exactly the condition that needs a falsifier, because nothing stops the next commit.

## The scope is narrower than the sentence reads

The grep was scoped to one 33-line module. One layer out, the property does not hold.
`src/Core/Meno.fs:170` defines a genuine monadic bind in the `MenoBuilder` computation
expression:

```fsharp
member _.Bind<'a, 'b, 'c ...> (MenoArrow f, g: 'b -> Arrow<'a, 'c>) : Arrow<'a, 'c> =
```

and its body selects an arrow **from a runtime value** — `let (MenoArrow h) = g span.[i].Key`.
That is precisely value-dependent structure: the continuation's shape is not knowable before
running. By the same `ArrowApply ≅ Monad` theorem the doc invokes, **`Meno` is outside the
`app`-free fragment.** (`.Bind` members also exist in `AgentIntegrate.fs`, `Result.fs`,
`SagaBuilder.fs`.)

This does not contradict the doc's literal words, which named `IsrLift.fs`. It does mean the
summary sentence — *"The ISR arrow sits inside the `app`-free fragment"* — reads broader than
what was checked, and a reader would reasonably carry it further than the evidence goes.

## Register verdict

Under `toy-is-free-metered-must-be-earned.md`: the predictivity claim's type-theoretic half
is **unmetered**, not metered. It is implemented, used, reasoned about correctly, and has
**no falsifier**. The doc's own closing line —

> This is the anchor-taxonomy discipline working as intended: a **checked** anchor rather
> than a cited one.

— is the overclaim in miniature. It was checked *once, by hand*. A check that ran in a
session and left no artefact behind is indistinguishable, one commit later, from a check
that never ran.

## The smallest check that would falsify it

Scope is the whole design question, so state the claim first in the form a test can refuse:

> **Claim (falsifiable form).** Every module on the CHIP-8 cost-prediction composition path
> stays inside Hughes's `app`-free Arrow fragment: it exposes `arr`-like lifts and
> `>>>`/`>=>` composition, and exposes **no** operation whose result *arrow* is selected by a
> runtime *value* — no `app`, no `Bind`/`>>=`, no computation-expression builder.

The minimal mechanical falsifier is a hygiene lint over an **explicit, checked-in allowlist**
of path modules (`IsrLift.fs`, `IntrCtx.fs`, and whatever else the predictor composes), which
fails if any of them contains a bare `app` identifier, a `.Bind` member, `>>=`, or a
`Builder()` type. Roughly 40 lines beside the existing checks in
`src/Core.TypeScript/hygiene/`, wired into the gate.

Two properties are what make it worth writing rather than re-grepping:

1. **It must be mutation-tested.** Adding `let app ctx (f, a) = f ctx a` to `IsrLift.fs` must
   turn the gate red. A lint that cannot fail is the vacuity class, and this file's whole
   point is that a check nobody can fail is not a check.
2. **The allowlist is the actual content.** The grep's defect was undeclared scope. Writing
   the module list down converts "the ISR arrow is `app`-free" from a vibe into a claim with
   an edge — and makes adding a module to the predictor path a decision someone has to make
   explicitly rather than by drift.

**Not implemented here.** Sibling agents are live on the IR minimal-op-set and a build-graph
drift guard, and a new hygiene lint plausibly overlaps both. This is the specification; the
build should be routed deliberately.

What the claim would have to mean for the check to be meaningful: *not* "the string `app`
is absent" (trivially satisfiable by renaming), but **"no arrow on this path is chosen by a
value flowing through it."** The lint is a cheap proxy for that; the honest label on the
proxy is that it catches the known spellings and would miss a novel one.

## Anchors (checked, not merely cited)

- **John Hughes, *Generalising Monads to Arrows*, Science of Computer Programming 37(1–3),
  2000.** Source of `arr`/`>>>`/`first`, of `app` and the `ArrowApply` class, of
  `ArrowApply ≅ Monad`, and of static analysability as the stated motivation for the weaker
  interface. *Entailment checked:* the paper supports every use made of it above, including
  `Kleisli m` as an `ArrowApply` instance.
- **Lambek — cartesian closed categories / Curry–Howard–Lambek.** Cited here only to
  **exclude** it: the CCC evaluation morphism `app : B^A × A → B` is a different `app` from
  Hughes's, and it is the sense the repo *claims* (for DynamicValue) rather than avoids.
  Conflating the two would invert the reading of both threads.

## Pointers

- `docs/research/ip-questionable/2026-08-13-frederic-schuller-toe-constructive-gravity-einstein-derived-from-maxwell-predictivity-aaron-forwarded.md` §"which 'arrow', precisely" — the artefact
- `src/Core/IntrCtx.fs:17,34,41` — the `ISR` type, the "ISR monad" docstring, `>=>`
- `src/Core/IsrLift.fs` — the 33 lines the grep covered
- `src/Core/Meno.fs:153-181` — `MenoBuilder.Bind`, the value-dependent arrow selection
- `tests/cross-verification/_harness/cross-lane-equivalence.test.ts:130` — the only
  homoiconicity test; asserts same-IR, **not** `app`-absence
- `docs/PRIOR-ART-LIST.md` — the CCC/Lambek anchor, for the *other* thread
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the register this doc applies

## Search coverage (so a later reader knows what was excluded)

Session transcripts under
`/Users/acehack/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/*.jsonl` (three
files, 1.8 GB): the `ArrowApply` thread appears in exactly one
(`3d14f5c3-…`, 7 hits) plus one incidental hit in today's session. The 1.4 GB 2026-08-13
transcript carries the **CCC/homoiconicity** thread (18 `Lambek` hits, 25 "cartesian closed")
and **zero** `ArrowApply` — the two threads are genuinely separate, which is consistent with
the recollection cross-wiring them.

Local memory (`…/memory/*.md`, 1082 files): **zero** files mention `ArrowApply` or
`app-free`. The insight was never written to memory — it exists only in the merged ferry doc
and the transcript.

No lint, test, or CI check anywhere in-tree references `app`-freedom or `ArrowApply`.
