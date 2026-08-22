# The HKT case for F#, audited: Don Syme's published positions, today's measurements, and why arrow-first keeps us at kind `*`

*Shadow, 2026-08-15.*

**Status of this document.** It is a working assessment, and it is **publishable as written**. It contains
nothing inferred about anyone's inner life. Every characterisation of a person's position traces to something
that person published, quoted with a link; where no statement exists, it says **"not stated publicly"** and
stops there. Good faith and technical intent are assumed by default and without hedging: the only agendas
treated as being in play are the publicly self-claimed ones, and those are about language robustness and ease
of use. Governing rule:
[`engagement-profiles-public-work-only-not-surveillance-dossiers.md`](../../.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md)
— compile public work freely and cite it; never model an internal state; for internal states the method is
**ask, and believe the account**.

The purpose of tailoring an argument to a specific reviewer here is **courtesy, not leverage**: a reviewer
should need minimal additional context to evaluate a proposal. If a passage in this document would read badly
to its subject, that is evidence the passage is wrong, not evidence it should be hidden.

Every claim carries a register (`toy` / `unmetered` / `metered`) per
[`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md).

***

# THE STANDING FRAME — read this first (Aaron, 2026-08-15)

*This block is the load-bearing part of the document for any agent picking this work up later. It is a
**standing decision** that shapes months of work across many wakes. It is recorded here, verbatim and
attributed, because a sibling agent (PR #10821) found the same day that an insight living in exactly one
transcript and zero of 1082 memory files had degraded to a wrong recollection within two days. Do not
reconstruct this frame from scratch; inherit it.*

> **Aaron, 2026-08-15:** *"yes keep up with all of this, i expect this to be a multi month effort for us to
> design and build hkt on top of geometry/topology intuition and for it to be useful to the point that
> clr/c#/f# will allow **without a fork** and take back as a contribution. this is not a fast process. and yes
> we can research any potential reviewers for their public views and teams public views and responsibilities.
> and as always, we assume every person and team are doing best effort and has 0 nefarious internal state for
> these projects. we are not trying to detect deception or anything of that nature, just align with public
> stated held positions of the ecosystem we are trying to contribute to."*

**Four standing commitments follow from that, and they govern everything below.**

1. **Multi-month program, not a submission.** *"this is not a fast process."* Therefore **"the case is not
   ready" is the correct status of stage 1, not a failure.** The honest verdicts throughout this document are
   the *input* to a program, and §23 turns them into stages with entry criteria.
2. **No fork. Upstream contribution is the goal.** *"to the point that clr/c#/f# will allow **without a fork**
   and take back as a contribution."* This **resolves** the two-paths question §7 deliberately left unranked —
   and it resolves it as a **sequence**, not a choice. The earlier F#-fork framing in the repo's memory
   (2026-05-13) is **superseded** by this.
3. **Reviewer and team research is authorized, and the useful half is responsibilities** — who owns which
   decision. §22 is that map, built entirely from published process documents.
4. **Good faith is binding, for every person and every team.** *"we assume every person and team are doing best
   effort and has 0 nefarious internal state… we are not trying to detect deception or anything of that
   nature, just align with public stated held positions."* Operationally: no motive attribution, no reading
   between the lines, no modelling of internal disagreement between teams, and **"not stated publicly"**
   wherever a position does not exist. **We are aligning with an ecosystem's stated positions, not overcoming
   anyone.**

***

## 0. The five findings, up front

1. **The case is not ready on the code-reuse axis, and the reason is our own design choice.** The repo is
   **arrow-first**: `Kleisli`/`Arrow` shapes throughout, and **zero `Applicative` anywhere**. An arrow
   `Arrow<'a,'b>` has both parameters at kind `*`; `Applicative` cannot be *stated* without quantifying over
   `'F : * -> *`. So PR #10817's residue collapsing twice was not luck — the architecture avoids the `* -> *`
   layer by construction. `metered`.
2. **The single sharpest concrete gap is already documented by the F# team, and it sits exactly at F#'s unique
   intersection**: RFC FS-1124 records that **.NET generic math does not propagate units of measure**, and the
   team's chosen resolution was to *suppress* the `System.Numerics.I*` interfaces on unitized types. Guidance:
   *"For generic math using units-of-measure, use SRTP."* This is small, concrete, acknowledged, and needs no
   new type theory. `metered`.
3. **The venue assumption in the existing brief is off.** `fslang-suggestions` **#175 "Simulate higher-kinded
   polymorphism" is CLOSED** (2024-02-07) with labels `probably not` + **`needs-clr-change`**; **#243 "Support
   type classes or implicits" is OPEN** with label **`await-csharp-alignment`**. And Don Syme publicly
   announced in January 2025 that he has **stepped back** in favour of an "F# Language Design Squad"
   (@vzarytovskii, @T-Gro), retaining an oversight and final-decision role. `metered`.
4. **The two arguments today's measurements do not touch are the geometric-semantics argument and the
   externalized-types argument — and they point in opposite strategic directions.** The geometry argument runs
   straight into Syme's sharpest *published* objection and must therefore be posed as a measurable
   bug-reduction claim, not an expressiveness claim. The externalized-types argument runs *with* his published
   recommendation, because **type providers and source generators are exactly what he names as the
   industrially-appropriate form of type-level programming**. `metered` on the citations, `toy` on the geometry
   claim itself.
5. **Two paths, laid out with costs, not ranked.** (a) push HKT into F#; (b) make types *values* in our own
   layer. Path (b) sidesteps the `AssemblyLoadContext` wall found in PR #10819 *and* needs no persuasion from
   anyone — but it forfeits static checking and makes us the owner of a checker we have not written. §7.

***

## 1. The arrow-first finding, and the precision it demands

Aaron's account (2026-08-15): *"we use the monad arrow kleisli and avoid using app so we keep monad-like rules
in meta space too."*

Measured on `origin/main` today, independently of that account:

| surface | shape | kind |
|---|---|---|
| `src/Core/IntrCtx.fs:34` `ISR<'A,'B> = IntrCtx -> 'A -> Task<Result<'B, InterruptFeedback>>` | documented *"the Kleisli Arrow context monad type alias"*, with `>=>` at line 41 | `*` in both params |
| `src/Core/Meno.fs` `Arrow<'a,'b> = MenoArrow of (ZSet<'a> -> ZSet<'b>)` | the monoidal/braided arrow | `*` |
| `src/Core/FerryThrottler.fs:607` `ContextualFerryThrottler` | *"the Kleisli-Arrow"* | `*` |
| `src/Core/IsrLift.fs:31` | *"the unit of the Kleisli structure — `arr` in arrow terms"* | `*` |
| Kleisli language also in `SoftValue.fs`, `ParseSoft.fs`, `Tracing.fs` | | `*` |
| **`Applicative`** | `rg "Applicative"` over every `.fs`/`.fsi` in the repo → **no matches, exit 1** | absent |

**The precision a language designer will check, stated first.** We use **an** arrow, not **the** `Arrow`
*class*. In Haskell, `Arrow` is a class over `* -> * -> *`; here `Arrow<'a,'b>` and `ISR<'A,'B>` are concrete
types whose parameters are ordinary kind-`*` type parameters. *The instance needs no HKT; the abstraction
would.* Likewise `ISR` is Kleisli over `Task<Result<_, InterruptFeedback>>`, which genuinely is a `* -> *`
thing — but it appears **monomorphically** and is never quantified over. A `* -> *` object that is used and
never abstracted costs nothing to have and buys nothing to name.

**So the honest claim is not "our mathematics requires HKT."** It is:

> We chose an arrow-first formulation that does not require higher-kinded polymorphism, and the one
> construction where we wanted the other formulation — the `NovelMathExt.fs` profunctor lift, which needs
> `p : * -> * -> *` **and** rank-2 (`forall p. Strong p => p a b -> p s t`) — we cut, because neither IWSAM nor
> open generics can carry either requirement.

That statement is far harder to refute than an appeal to need, and it demonstrates we know where our own
boundary is. `metered` (the `rg`, the signatures, and PR #10817 §4).

***

## 2. Audit of the 2026-05-11 brief, claim by claim

Source under audit:
`memory/deepseek/conversations/2026-05-11-deepseek-brief-to-don-syme-python-dead-end-fsharp-hkt-alignment.md`.

### 2.1 Claims that still hold

| brief claim | verdict | check performed |
|---|---|---|
| **mypy #6066** — higher-kindedness unsupported | **holds**, with a date correction | `python/mypy#6066` *"Indexing TypeVars / need a workaround for higher-kindedness"*, **open**, created **2018-12-13**. The brief's "8+ years" was ~7.4 years at time of writing; today it is 7.7. |
| **PyTorch `mypy.ini`** — "Typing tests is low priority" | **holds** for that quote | present verbatim in `pytorch/pytorch:mypy.ini`. The second quote ("OpInfos being annoying to type") was **not** found in that file in this pass — `unmetered`, do not reuse until located. |
| **Shape-vs-dtype gap** in Python tensor annotations | **holds in substance** | independent of the NTT docomo blog: the type-constrained-decoding literature (§2.3) and `python/typing#1250` both attest that Python's type system cannot express the relevant constructor-level invariants. |
| **F# UoM is the only mainstream .NET compile-time dimensional safety** | **holds** | uncontested, and *reinforced* by FS-1124, which spends a section on the fact that .NET's generic-math interfaces cannot express it. |

### 2.2 Claims that are weakened or mis-cited

| brief claim | verdict | what is actually true |
|---|---|---|
| **"scikit-learn typing #1250"** | **mis-attributed repo** | The real artefact is **`python/typing#1250` "Generic specialization?"**, open since **2022-09-01**. It *is* motivated by the scikit-learn `fit`/`predict` API. Its content is *better* for us than the brief's summary: the author wants `fit` to return `Fitted[Self]` — a **type-constructor-level** refinement Python cannot express. Fix the citation and keep the example. |
| **"94% of LLM compilation errors are type-check failures"** filed under *Python's structural ceiling* | **filed in the wrong section** | The figure is reported by the GitHub blog (2026-01-08) citing **Mündler, He, Wang, Sen, Song & Vechev, *Type-Constrained Code Generation with Language Models*, arXiv:2504.09246 (2025)** — which studies **TypeScript**, not Python. A claim about TypeScript compilation errors cannot be evidence about Python, which has no such compilation step. `unmetered`: the 94% figure was not located in the abstract in this pass, only in the citing blog post. **See §2.3 — this citation is stronger than the brief made it, once moved.** |
| **Keras VU#253266** as a type-system consequence | **weakest citation; recommend dropping** | Verified real: CERT/CC VU#253266, published **2024-04-16**, Keras `Lambda` layers execute embedded Python on `load_model()` before Keras 2.13. But the mechanism is **unsafe deserialization of arbitrary callables**, not a typing failure — and **higher-kinded types would not prevent it**. Citing it invites exactly the "a pile of adjacent-sounding advantages" objection that [`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md) forbids. |
| **"Effective HKT via SAIMs + SRTPs (production-ready encoding)"** | **half-refuted, half-upgraded** | PR #10817 confirms IWSAM works natively for our §4a algebra ladder (statically resolved, no boxing, exit 0). But **"production-ready" is not what its designer says**: FS-1124's own guidance is *"Do not use IWSAMs as the basis for a composition framework"* and *"using IWSAMs in application code carries a strong risk you or your team will later remove their use."* Citing IWSAM as an advantage, to the author of the RFC that warns against this use, would fail on first contact. |
| **"3,000+ PRs proving the encoding works"** | **does not support the claim it is attached to** | PR count is a measure of activity, not of an encoding's soundness. Also, before #10817 no `App<'F,'T>` encoding existed in the repo at all. The evidence that now exists is better and smaller: a **`.fsi`-sealed single-`App` brand** whose forgery attack **fails to compile** (`FS0887`, attack build exit 1) while legitimate cross-assembly use runs clean. |
| **"Zeta offers implementation team for compiler prototype"** | **premature given §3** | The design process the offer would enter is described in §3; a prototype offer is not the first move that process accepts. |

### 2.3 The correction that makes the case *stronger* than the brief framed it

The arXiv:2504.09246 citation is not merely a statistic about error rates. **The paper's contribution is
type-constrained decoding** — using a type system to constrain an LLM's generation, reducing compilation errors
by over 50% across model sizes and families. That is a *utilitarian, measurable* claim of exactly the kind
Syme has publicly said he prefers:

> *"I generally prefer arguments in utilitarian terms (bug reduction, safety under refactoring, stability of
> coding patterns under changing requirements, does a mechanism promote team-cooperation etc.)."*
> — dsyme, [fslang-suggestions#243, 2016-11-15](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-260630066)

So the AI-safety argument has a form that fits the stated evaluation criterion: *a richer type system is a
stronger decoding constraint; a stronger decoding constraint measurably reduces generated-code errors.* That
is a bug-reduction argument, not an expressiveness argument, and it is the only leg of the original brief that
gets stronger rather than weaker under audit. It is currently `unmetered` **for F#** — the paper measures
TypeScript, and nobody has run the equivalent experiment on F#. **Running it is the single highest-value
missing artefact in the whole case** (§6).

***

## 3. Don Syme's published positions

All of the following are quotations from artefacts he published, with links. Nothing here is an inference
about motive or internal state; where a reason is not published, this document says so.

### 3.1 Governance facts (checked today)

| fact | source |
|---|---|
| **#175 "Simulate higher-kinded polymorphism" is CLOSED**, 2024-02-07, labels `probably not`, **`needs-clr-change`**, `area: type-system`, 94 up-votes. Closing comment by @vzarytovskii: *"Closing all `probably not` issues. This one is a bit more sensitive for many, so we shall wait and see where does CLR go with the extensions and unions."* | [fslang-suggestions#175](https://github.com/fsharp/fslang-suggestions/issues/175#issuecomment-1932273530) |
| **#243 "Support type classes or implicits" is OPEN**, 321 up-votes, 216 comments, labels **`await-csharp-alignment`**, `area: srtp-and-constraints` | [fslang-suggestions#243](https://github.com/fsharp/fslang-suggestions/issues/243) |
| **Syme stepped back in Jan 2025.** *"I've stepped back from activity in favour of letting the community lead these processes - but I want to continue to be able to play a sort of oversight role and - where necessary - be a final decision maker."* He names @vzarytovskii and @T-Gro as the "F# Language Design Squad". | [fslang-suggestions#1403, 2025-01-19](https://github.com/fsharp/fslang-suggestions/issues/1403) |
| **FS-1043** (extension members solving SRTP constraints) is approved-in-principle with a merged trials PR, `dotnet/fsharp#8404`; Syme in 2021: *"We will eventually progress this approved RFC… I also won't progress it until I am certain that it won't lead to a considerable rise in attempts to use type-level programming in F# for activities outside those designed to be supported by the RFC."* | [FS-1043](https://github.com/fsharp/fslang-design/blob/main/RFCs/FS-1043-extension-members-for-operators-and-srtp-constraints.md), [#243 2021-09-09](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-916079347) |

**Correction to the framing this task inherited.** "Don Syme is the gatekeeper" is half right and the other
half matters. He is a **final decision maker with an oversight role, by his own published description**, but
the day-to-day process is led by the squad, and the two governing labels are `needs-clr-change` (on HKT) and
`await-csharp-alignment` (on type classes). **An HKT ask addressed to F# alone is addressed to the wrong half
of a gate the F# team has publicly said is partly CLR-level and partly C#-level.** `metered`.

Note the asymmetry this exposes, in our favour: **the mechanism PR #10817 measured as working — the
`.fsi`-sealed brand — requires no CLR change, no C# alignment, and no language change at all.** It is a
library pattern. The gate applies to *native* HKT, which is not the only thing we might want.

### 3.2 The objections, quoted and steelmanned

> **Addendum, second pass (2026-08-15).** This section is **unchanged and deliberately un-hedged.** Aaron's
> response to the governance correction in §3.1: *"his arguments for HKT were the strongest. We should not lose
> his arguments against it."* These objections are **durable content** — the strongest published statement of
> the case against, by the person best positioned to make it — and they do not become weaker because their
> author changed roles. **Whatever our case eventually says, it has to answer these; they set the bar.** §12
> handles the separate question of *who decides now*, and is careful not to attribute any position here to
> anyone who has not stated it.

The canonical statement is
[#243, 2021-09-09](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-916079347), which the
issue body itself designates as his current position. RFC **FS-1124** (his authorship; the IWSAM RFC) restates
much of it in a form aimed at a specific feature, with a **Drawbacks** section written, in his words, with
*"Emphatic language… to act as a corrective."*

***

**Objection A — the slippery slope is intrinsic, not a choice.**

> *"Simple type-classes are never sufficient and result in a consistent stream of requests for more and more
> type-level programming and type-level abstraction (higher kinds, higher sorted kinds, type families,
> whatever)."* … *"the classic slippery slope is indeed a basis on which to exclude otherwise useful language
> features in this repository. In the F# and C# design traditions we have long avoided features with… an
> obvious slippery slope - we aim to do them complete, as a whole, and resolve the design point to a
> sufficient coherent closure."*
> — [#243, 2021-09-09](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-916079347) and
> [2021-09-13](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-918569079)

*Steelman.* This is a claim about **design closure**, and it is correct as stated: a feature whose natural
successor requests are unbounded has no stable stopping point, and shipping it commits the language to an
open-ended sequence. He is asking for the closure to be specified up front, which is a normal and reasonable
engineering demand.

*Does our evidence answer it?* **Partially, and better than the original brief could.** Our measurement
supplies an unusually specific closure: we do not want type families, higher-sorted kinds, or a class
hierarchy. We want **one construction** — the profunctor lift at `* -> * -> *` plus rank-2 — and we have
measured that everything else we build collapses to kind `*`. A request that comes with a demonstration of
where its author's own demand *stops*, backed by a count, is materially different from an open-ended ask.
`unmetered`: the closure is stated and evidenced for our codebase; it is not evidence about anyone else's.

***

**Objection B — the empowerment/culture argument.**

> *"Adding type-level programming of any kind can lead to communities where the most empowered programmers are
> those with deep expertise in certain kinds of highly abstract mathematics (e.g. category theory or abstract
> algebra). Programmers uninterested in this kind of thing are disempowered. While I have great respect for
> these as mathematical and computational theory, I don't want F# to be the kind of language where the most
> empowered person in the discord chat is the person who knows the most category theory or abstract algebra."*
> — [#243, 2021-09-09](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-916079347)

*Steelman.* This is a claim about the distribution of capability across a community, and it does not depend on
whether the mathematics is good — he says explicitly that he respects it. The failure mode named is real and
observable in other language communities.

*Does our evidence answer it?* **No, and our geometry argument runs directly into it.** This is the honest
finding of §5: an argument of the form "types should carry braided-monoidal and Clifford structure" is, on its
face, the exact scenario this objection describes. It is not answered by asserting that the mathematics is
correct — the objection already grants that. The only form of the argument that engages it is one where the
*consumer* of the structure is a compiler and a model rather than a reader, and where the benefit is measured
in defects rather than in expressiveness. §5 develops that, and marks it `toy` until measured.

***

**Objection C — compile-time computation has real costs (performance, debugging, tooling).**

> *"This has serious compilation performance downsides. You end up needing a profiler for your type-level
> computations… Adding features in this space leads to a need for compile-time debugging. This is absolutely
> real - the C++ compiler gives 'stack traces' of template instantiation failures, for example. Yet this is a
> kind of debugging that's completely unsupported in any IDEs today."*
> — [#243, 2021-09-09](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-916079347)

*Steelman.* Uncontroversially true, and he applies it against a feature he did ship: FS-1124 records
*"Compiler and tooling slow-downs on large interface lists"* and, in a 2024-03-06 addendum, points at a real
Fleece issue as the prophesied instance. He also applies it to **type providers**, F#'s own feature: *"These
suffer some of the above problems (e.g. they run at compile-time, and can cause performance and debugging
problems)… some of what I've written can also be seen as a criticism of this existing part of F#."*

*Does our evidence answer it?* **Not applicable to what we measured.** The `.fsi`-sealed brand encoding does
**no** type-level computation: it is a sealed class, an `inj`, and a `prj`. It has a runtime cost (boxing;
PR #10817 §3.2 notes it forfeits `ZSet.map`'s `inline`/`InlineIfLambda`, `unmetered` in magnitude) and
essentially no compile-time cost. So this objection prices *native* HKT with inference, not the encoding —
which is another reason the encoding and the language feature must be argued separately and never bundled.

***

**Objection D — explicit function passing is shorter, more general, and better suited to F#.**

> *"Note that explicit function-passing code is shorter and more general - it works with both `MyType1` and
> `MyType2`. In F# this kind of code is incredibly safe and succinct because of Hindley-Milner type inference
> - passing functions and making code generic are two of the very easiest things to do in F#, the language is
> almost made for exactly those activities. For the vast majority of generic coding in F# explicit
> function-passing is perfectly acceptable, with the massive benefit that the programmer doesn't burn their
> time trying to create or use a cathedral of perfect abstractions."*
> — [FS-1124, Drawbacks](https://github.com/fsharp/fslang-design/blob/main/FSharp-7.0/FS-1124-interfaces-with-static-abstract-members.md)

*Steelman.* This is the strongest objection in the set, and it is the one aimed squarely at *our* case, because
it attacks the reuse argument on its own ground: if the goal is N copies → 1, an explicitly passed function
achieves it with no type-level machinery, no constraint, and no closure problem.

*Does our evidence answer it?* **No — and today's measurements largely agree with him.** With one instance per
candidate site (PR #10817 §5), a passed function is the correct engineering answer for everything we currently
have. The one exception is the profunctor lift, where the abstraction is over a **type constructor at
`* -> * -> *`** with a rank-2 quantifier — a shape a passed function cannot encode, because the thing being
abstracted is not a function but the profunctor itself. That is a narrow and real exception, and it is the
only one we can currently name.

***

**Objection E — implementations are not parameterizable; instances cannot close over anything.**

> *"F# is driven by explicit parameterization… IWSAM implementations are not within the 'core' portion of F#:
> they are not first-class objects, can't be produced by methods and, can't be additionally parameterized."*
> — FS-1124. And, on type classes, with a worked example: *"Let's say you create a huge amount of code that
> uses a swathe of string-related type classes that assume invariant culture… Then you want to localize your
> code w.r.t. culture… But your type class instances can't be parameterized. So you either have to remove all
> those type classes from your code or resort to dynamic argument passing though thread-local state. Painful
> and discontinuous."*
> — [#243, 2016-11-15](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-260630066)

*Steelman.* This is a **discontinuity** argument, and it is about refactoring risk rather than expressiveness:
the cost of a type-class-shaped abstraction is not paid at the time you write it but at the time a requirement
changes and the abstraction cannot absorb the change.

*Does our evidence answer it?* **It is a live hazard for us specifically, and worth flagging to ourselves.**
The culture example he chose is uncomfortably close to home: our
[`culture-invariant-by-default.md`](../../.claude/rules/culture-invariant-by-default.md) rule exists because a
culture-sensitive comparison caused a real non-associativity bug (081KT07NV0008QG0R001YDB73K). We resolved it
by *fixing the culture globally*, which happens to be the configuration in which his objection does not bite —
but that is luck about our requirements, not a refutation. Recorded as a hazard, not answered.

***

**Objection F — the utilitarian bar, and the incoherence-is-rare claim.**

> *"But how many bugs (= lost developer time) are really caused by a lack of coherence, e.g. conflicting
> instances? I talked about this when last with Odersky and we figured it was very few."* … *"Anyway I'd need
> to see much stronger utilitarian evidence that this truly is as critical as claimed - it seems like a
> well-intentioned article of mathematical faith… more than one grounded in the reality of software practice."*
> — [#243, 2016-11-15](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-260790271)

*Steelman.* He is stating an evidentiary standard: **counted defects avoided**, not derivations. This is the
same standard [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
imposes on us internally, which means we are not being asked to adopt an alien discipline.

*Does our evidence answer it?* **Not yet, and this is the crux.** We have no defect count attributable to the
absence of HKT. We have one shipped compromise (`NovelMathExt.fs`'s reduced `Lens`) and zero bugs traced to it.
The type-constrained-decoding experiment in §6 is the shape of evidence that would meet this bar.

***

**Objection G — "F# is not a research vehicle."**

> *"To clarify: F# is not a research vehicle (it hasn't been since ~2014). 'Setting the agenda' is not
> intrinsically a goal… Those looking for a language whose goal is specifically to be a research vehicle for
> cutting-edge ideas (e.g. advanced research in program verification, or touch-based-programming, or
> type-level programming, or functorial programming or similar) should look elsewhere."*
> — [#243, 2021-09-13](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-918569079)

*Steelman.* A scope statement about what the project is for. It is not a technical claim and cannot be
refuted technically; it can only be met by showing that a proposal is *not* research — i.e. that it is
industrially motivated with measured utility.

*Does our evidence answer it?* **It determines the register in which anything must be written.** An
AI-safety-and-verification framing that reads as a research agenda is answered by this paragraph before it is
read. A framing that reads as "here is a measured defect class, here is a small change that removes it" is not.

***

**And the position that is not an objection at all — what he affirmatively recommends.**

> *"What if someone is looking for a strongly typed, functional programming language that embraces type-level
> programming for industry productivity?"* → *"If that is the specific aim, I would point them to the specific
> kind of reflective type-level programming done using F# type providers, or C# code generators, or F#/C#
> analyzers. all of which have many proven practical industry uses… I would also apologise that #450 has not
> been landed as yet."*
> — [#243, 2021-09-14](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-919427910)

He also states the reason type providers are, in his assessment, tractable where type-level programming is
not: *"the type-level programs are expressed using term-level programming with all the utility of the
expression language of F# itself… This means relatively good programming, debugging, profiling, logging,
diagnostic reporting etc. is available."*

**This is directly load-bearing for §7 path (b), and it is the most useful single sentence in the corpus for
us**: the mechanism we would need for externalized types is the one he names as the right answer.

***

## 4. The gap the F# team has already documented — and it is at F#'s unique intersection

FS-1124 §"Interaction with Units of Measure" and §"Alternatives for Units of Measure" record that .NET's
generic-math interfaces do not propagate units. Five options were enumerated; **option 3 was chosen**: *"Do not
report any `System.Numerics.I*` interfaces for unitized types."* The shipped guidance reads:

> *"**For generic math using units-of-measure, use SRTP.** The .NET support for generic math does not
> propagate units of measure correctly. Rely on F# SRTP code for these."*

Why this matters more than anything else in this document for near-term action:

- It sits **exactly** at the intersection the 2026-05-11 brief advertised as F#'s unique combination — units of
  measure **×** generic numeric abstraction. The brief's table implies the combination composes. **It does
  not**, and the F# team documented the non-composition before we noticed it. `metered`.
- It is **already acknowledged**, so no one has to be persuaded that a problem exists.
- It is **bounded**: options 4 and 5 in the RFC (compiler-side rewriting of reported interfaces; BCL metadata
  for unitization signatures) are named, and the RFC explicitly keeps a *"Possible future options"* section
  open.
- It requires **no new type theory** — no kinds, no rank-2, no coherence.

**This is the concrete, Syme-legible, F#-team-acknowledged defect our case could target first.** It is not the
HKT ask. It is smaller, and it is the kind of contribution that earns standing for a larger conversation.
Register: `metered` as a statement of what the RFC says; `unmetered` as a claim that we could implement it —
we have not scoped it.

***

## 5. The geometric-semantics argument

Today's measurements do not touch this argument, and it deserves its own weight — but it needs restating
before it can survive contact with §3.2's Objection B.

**The argument as usually posed** — *a type system carrying geometric and topological structure lets a human
and a model agree on what a type* means *rather than what it is* called — is, on its face, precisely the
scenario Objection B describes. Restating it more forcefully makes it worse, not better.

**The reformulation that engages the objection** is to change who the consumer is. The claim is not that
programmers should reason categorically. It is:

> A type whose meaning is fixed by structure rather than by name gives a code-generating model a **checkable
> referent**. Name-based agreement between a human and a model is agreement about a token; structure-based
> agreement is agreement that a checker can adjudicate. The predicted effect is a reduction in a specific
> defect class: **plausible-looking code that type-checks against the wrong concept.**

Posed that way it is a bug-reduction claim, which is the register Objection F demands, and it connects to the
type-constrained-decoding result in §2.3 rather than to aesthetics.

**Honest state: this is `toy`.** We have no measurement that geometric or structural typing improves
human-model agreement, and no defect count for the class it claims to reduce. Three things are true at once and
all three should be said:

1. The mathematics is real and in the repo, and it is in the **Lean** lane, not the F# lane. PR #10817
   established that `MenoBalancedTwist.lean` abstracts over an arbitrary braided monoidal category using
   Mathlib's **dependent** `Hom : C → C → Type v` — and that **HKT could not state naturality, the hexagons, or
   coherence anyway.** So the laws that carry the geometric meaning already live in the only lane that can
   express them.
2. Therefore HKT in F# would buy **definitional** reuse in the runtime lane, not the geometric semantics. Using
   the geometry to argue for HKT overstates what HKT delivers, and a reviewer who knows the difference between
   `* -> * -> *` and a dependent family will notice.
3. The experiment that would meter it is nameable: take a fixed task set, generate F# with and without
   structurally-constrained types, and count defects that survive the compiler. That is the F# analogue of
   arXiv:2504.09246 and it does not exist yet.

**Sibling-lane note, not an edit:** an untracked `MenoBraidedRMatrix.lean` is present in the shared checkout
and a sibling agent is live on the IR op set. Nothing here touches either.

***

## 6. Aaron's three criteria, scored honestly

| criterion | status | evidence |
|---|---|---|
| **Simpler code** | **not demonstrated** | The one HKT-requiring construction (profunctor lift) would *add* machinery — a sealed brand, boxing, a `prj` — to obtain uniform composition across optic kinds. With one optic kind, net simplicity is negative. `metered` (PR #10817 §4). |
| **Code that could not be written before** | **exactly one instance** | `NovelMathExt.fs`'s profunctor lift: `p : * -> * -> *` **and** rank-2. Neither IWSAM nor open generics reach either. The cut was correct and unavoidable. `metered` (structural). |
| **N copies → 1** | **not met, and for a structural reason** | Every candidate site has **one** instance: one braided monoidal category, one optic kind, one comonad, one functor over the Z-set family. §1 explains why — the arrow-first design keeps us at kind `*` by construction. `metered`. |

### 6.1 The N-copies problem we actually have is not HKT-shaped

Measured today: `ZSet` is implemented independently in **F#** (`src/Core/ZSet.fs`, 602 lines), **C#**
(`src/Core.CSharp/ZSet.cs`, 566), **Rust** (`src/Core.Rust.Algebra/src/zset.rs`, 469), **Q#**
(`src/Core.QSharp.ReferenceOracle/ZSetISA.qs`, 318) and **Go** (`zset_merkle.go`, 93, a subset), plus a
TypeScript surface. That is a genuine N-copies-of-one-concept problem at real scale — **and higher-kinded
polymorphism in F# cannot touch any of it, because the duplication is across languages, not across type
constructors within one.** The lane that addresses it is `gen/` and the
[`only-the-irreducible-is-primitive-generate-the-rest.md`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md)
discipline: generate the oracles from the free object. `metered` (line counts).

This is worth stating plainly because it is the honest answer to "make the worth obvious": **our largest
reuse win is not the one HKT provides.**

### 6.2 What would make the case ready — the roadmap

In order of value per unit of effort, and none of these is blocked on anyone outside this repo:

1. **Run the F# type-constrained-decoding experiment** (§2.3). It is the only artefact that meets the stated
   utilitarian bar, it is entirely within our control, and its result is informative in both directions.
2. **Scope the UoM × generic-math gap** (§4) against FS-1124's own options 4 and 5. Small, acknowledged,
   F#-unique.
3. **Reach a second instance at any one candidate site** (PR #10817 §5's trigger): a second braided monoidal
   category in F#, a real `Prism`, or `map` on a second Z-set family member. Until then, abstraction is over a
   singleton.
4. **Do the two pieces of cheap hygiene the HKT question surfaced but does not own**: delete one of the two
   duplicate `Lens` definitions (`Optic.fs` / `NovelMathExt.fs`), and rename `Traversal<'r>`, which is
   value-of-information scheduling over CHIP-8 frames and not an optic at all.

Until (1) and (3), **the honest recommendation is that the case is not ready to be put to anyone**, and the
trigger condition is more valuable than a brief would be.

***

## 7. Two paths for externalized types — costs, not a ranking

Aaron's framing bundles **ShivaGc** with *"infinite externalized types in the database"*. Two measurements bear
on it.

**What ShivaGc is, as built** (`src/Core/ShivaGc.fs`, 346 lines): a mark-sweep collector over a
content-addressed heap of **`DynamicValue`** objects `{ id, value, refs }`, with machine-checked live-survive,
cycle-safety, idempotence and determinism. Its own header states the reason it can exist at all: *"you cannot
GC baked code, but you can GC values."* It collects **values**. It does not collect types. `metered` (source).

**The wall**, from PR #10819: *"Orleans virtualizes objects, and objects are GC-granular. Types are not — the
smallest collectable unit is an `AssemblyLoadContext`."* Falsified by a shipped test: the same generated type
loaded into two collectible ALCs is **two distinct CLR `Type`s** with identical `AssemblyQualifiedName`,
mutually non-assignable, while both **content-address to one ZetaId**. Register: `metered`, but **inherited —
I did not re-run that test**.

Put together: **`ShivaGc` works on `DynamicValue` precisely because values are GC-granular and types are not.**
That is not an accident of implementation; it is the wall, avoided.

Hence two genuinely divergent paths.

### Path (a) — push HKT into F#

*What it buys.* Definitional reuse in the runtime lane; the profunctor lift becomes writable; externalized
types remain **CLR types**, so they keep static checking, IDE tooling, and .NET interop.

*What it costs.*

- The `needs-clr-change` and `await-csharp-alignment` gates (§3.1) apply to the native feature.
- Every objection in §3.2 must be answered, and by §6 we currently answer one of them (A, partially).
- **The ALC wall remains.** HKT does nothing about type collection granularity; an externalized-type story on
  CLR types still cannot collect below an `AssemblyLoadContext`.
- The encoding half is available *today* with no gate at all: PR #10817's `.fsi`-sealed single-`App` brand,
  cross-assembly-verified, one earned class. Its residual costs are stated there (the `:?>` becomes a
  module-internal invariant; `InternalsVisibleTo` reopens it; boxing forfeits `inline`/`InlineIfLambda`).

### Path (b) — make types values in our own layer

*What it buys.*

- **It sidesteps the ALC wall entirely**, because values are GC-granular and `ShivaGc` already collects them.
- It needs **no language change, no CLR change, and no persuasion of anyone** — and it is the direction Syme
  publicly recommends for industrial type-level programming (§3.2, final quote): type providers, source
  generators, analyzers, *"reflective type-level programming"* done with term-level code.
- The substrate is real and load-bearing: `DynamicValue` is an 8-case universal value type consumed by **78
  modules** in `src/Core` alone. `metered`.
- It is closer to the "our own language" option, and it composes with `gen/`, which is the lane that can
  actually attack §6.1's cross-language N-copies problem.

*What it costs, stated without softening.*

- **We forfeit static checking for the externalized types.** A type that is a `DynamicValue` is checked by
  *our* checker, at *our* boundary — and we have not written that checker. This is the whole cost and it is a
  large one.
- **We become the owner of the type theory**, including its soundness, its error messages, and its tooling —
  the exact burdens §3.2 Objection C prices, relocated onto us rather than removed.
- **We are further from this than the prose suggests.** PR #10819 measured that there is **no F# type provider
  in this repository at all** (the `TypeProvider` project is a Roslyn `IIncrementalGenerator`), no runtime code
  generation, and `AssemblyLoadContext` appears only in prose under `src/`. `SchemaRegistry` is keyed by a
  hand-chosen `string`, not by a content address — that one word is the seam. Inherited, `metered` by that PR.
- Four-oracle byte-lock for a value-level type system becomes our responsibility across five languages.

**No recommendation is made between them.** They are not mutually exclusive in principle — the encoding half of
(a) is ungated and could proceed alongside (b) — but they consume the same attention and they optimise for
different things: (a) keeps the .NET type system's guarantees and pays in persuasion and in the ALC wall;
(b) keeps full control and pays in having to build what the CLR was giving us for free.

***

## 8. Corrections to the framing this task inherited

Flagged explicitly, including where the case is **stronger** than framed.

1. **"Don Syme is the gatekeeper"** — half right. He is, by his own January 2025 statement, a final decision
   maker with an oversight role; the squad leads the process, and the two live labels are `needs-clr-change`
   and `await-csharp-alignment`. §3.1.
2. **"He has good objections we are trying to overcome them all"** — the audit finds that **for most of them,
   our own measurements agree with him** rather than overcoming them. Objection D in particular is *supported*
   by PR #10817's one-instance-per-site finding. Saying so is the strongest available position; claiming
   otherwise would fail on first contact.
3. **The case is stronger than framed in exactly one place, and it is not the reuse axis.** The
   type-constrained-decoding literature (arXiv:2504.09246) is a *utilitarian, measured* AI-safety argument in
   precisely the register Syme publicly says he prefers — and the original brief buried it as a statistic in
   the wrong section. §2.3.
4. **The case is stronger than framed in a second place: the UoM × generic-math gap** (§4) is a concrete,
   already-acknowledged, F#-unique defect with named remediation options. Nobody in this repo had noticed it
   before this audit; it is more actionable than the HKT ask.
5. **"F# is really close to what we are looking for"** — the measurements *support* this, but not through HKT.
   What is close is: UoM, HM inference, type providers, IWSAM for the algebra ladder (working today, exit 0),
   and a mature verification lane. HKT is the one piece that is both distant and, per §5, not the piece that
   carries the geometric meaning.
6. **"Python would need a complete rewrite"** — the citations support "Python cannot express these
   constructor-level invariants" (mypy#6066 open since 2018; `python/typing#1250` open since 2022). They do not
   support "rewrite", which is a claim about migration cost that nobody has costed. And note Syme's published
   position #5: he regards typed-Python and TypeScript's *interop-driven* type-level features as the
   methodology most relevant to F#. An argument that leads with Python's failure lands closer to his stated
   view than the brief assumed — but it lands as an argument for *practical interop typing*, not for category
   theory.
7. **Corrections to my own prior work are already on file** in PR #10817 §6 and are not restated here.

***

## 9. Claims ledger

| Claim | Register | Evidence |
|---|---|---|
| Zero `Applicative` in any `.fs`/`.fsi` in the repo | `metered` | `rg "Applicative"` over `-g'*.fs' -g'*.fsi'`, exit 1, no matches |
| `ISR<'A,'B>` and `Meno.Arrow<'a,'b>` are kind `*` in both parameters; Kleisli language in 7+ modules | `metered` | `src/Core/IntrCtx.fs:34,41`; `src/Core/Meno.fs`; `FerryThrottler.fs:607`; `IsrLift.fs:31` |
| Arrow-first design is *why* the residue collapses to kind `*` | `unmetered` | a structural explanation consistent with two independent measurements; not itself a measurement |
| We use **an** arrow, not the Haskell `Arrow` **class** (`* -> * -> *`) | `metered` (structural) | the type definitions are concrete, not classes |
| #175 CLOSED 2024-02-07, labels `probably not` + `needs-clr-change` | `metered` | GitHub API, today |
| #243 OPEN, label `await-csharp-alignment`, 321 up-votes | `metered` | GitHub API, today |
| Syme stepped back Jan 2025 to oversight + final-decision role; squad = @vzarytovskii, @T-Gro | `metered` | fslang-suggestions#1403, his own words |
| The seven objections A–G, as quoted | `metered` | direct quotation from #243 and FS-1124, links inline |
| FS-1124 records .NET generic math does not propagate UoM; option 3 chosen; guidance says use SRTP | `metered` | FS-1124 §Interaction with UoM, §Alternatives, §Guidance |
| `python/typing#1250` is the correct citation, open since 2022-09-01, motivated by scikit-learn `fit` | `metered` | GitHub API + issue body |
| mypy#6066 open since 2018-12-13 | `metered` | GitHub API |
| PyTorch `mypy.ini` contains "Typing tests is low priority" | `metered` | file contents |
| "OpInfos being annoying to type" | `unmetered` | not located in `mypy.ini` in this pass |
| VU#253266 is a deserialization/code-execution issue, published 2024-04-16; HKT would not prevent it | `metered` | CERT/CC advisory |
| 94% figure traces to arXiv:2504.09246 via the GitHub blog; the paper studies **TypeScript** | `metered` on attribution, `unmetered` on the figure | abstract read; figure not located in abstract |
| A richer type system measurably improves generated-code correctness **in F#** | `toy` | the analogous experiment has been run for TypeScript only |
| Geometric/structural typing improves human-model agreement on type meaning | `toy` | no measurement exists; the experiment is named in §5 |
| ZSet independently implemented in F#/C#/Rust/Q#/Go; HKT cannot merge them | `metered` | line counts, §6.1 |
| `ShivaGc` collects `DynamicValue` heaps, not types | `metered` | `src/Core/ShivaGc.fs` |
| `DynamicValue` is 8-case and consumed by 78 `src/Core` modules | `metered` | `src/Core/DynamicValue.fs:84-91`; `rg -l \| wc -l` |
| Types are collectable only at `AssemblyLoadContext` granularity | `metered`, **inherited** | PR #10819's shipped test; not re-run by me |
| The case is not ready to be put to anyone today | `unmetered` | a judgement resting on §6's three criteria |

## 10. Anchors (checked)

- **Syme, D.** — *"Support type classes or implicits"*,
  [fslang-suggestions#243](https://github.com/fsharp/fslang-suggestions/issues/243), canonical position comment
  [2021-09-09](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-916079347); follow-ups
  [2021-09-13](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-918569079),
  [2021-09-14](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-919427910); earlier
  [2016-11-15 ×2](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-260630066),
  [2019-07-24](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-514627254). Checked: each
  quotation appears verbatim at the linked comment.
- **Syme, D.** — RFC **FS-1124**, *Interfaces with static abstract members*, `fsharp/fslang-design`,
  `FSharp-7.0/`. Checked: §Drawbacks, §Guidance, §Interaction with Units of Measure, §Alternatives for Units of
  Measure (five options, option 3 chosen). The RFC states its Drawbacks use *"emphatic language… to act as a
  corrective"* — quoted in that spirit.
- **Syme, D.** — [*"A thank you to the F# language design community"*, fslang-suggestions#1403,
  2025-01-19](https://github.com/fsharp/fslang-suggestions/issues/1403). Checked: the stepping-back statement
  and the named squad are his own words.
- **Syme, D.** — *The Early History of F#*, HOPL IV, Proc. ACM Program. Lang. 4 (2020). Referenced by him in
  #243 as the statement of the dimensions F# advances along. **Cited as pointed-to, not read in this pass** —
  `unmetered`; do not attribute specific content to it without reading it.
- **Zarytovskii, V.** — closing comment on
  [fslang-suggestions#175](https://github.com/fsharp/fslang-suggestions/issues/175#issuecomment-1932273530),
  2024-02-07. Checked verbatim.
- **Mündler, N., He, J., Wang, H., Sen, K., Song, D. & Vechev, M.** — *Type-Constrained Code Generation with
  Language Models*, arXiv:2504.09246 (2025). Checked: title, authors, TypeScript scope, and the >50%
  compilation-error reduction claim in the abstract. The 94% figure is **not** in the abstract.
- **Yallop, J. & White, L.** — *Lightweight Higher-Kinded Polymorphism*, FLOPS 2014. Checked in PR #10817: the
  module-signature seal reproduces in F# via `.fsi`.
- **Pickering, Gibbons & Wu** — *Profunctor Optics: Modular Data Accessors*; **Boisseau & Gibbons** — ICFP 2018.
  Checked in PR #10817: the rank-2 `forall p. Strong p =>` representation is the papers', and is what F# cannot
  express.
- **CERT/CC VU#253266** (2024-04-16); **python/mypy#6066**; **python/typing#1250**; **pytorch/pytorch `mypy.ini`**
  — all four fetched and read today.
- **McCarthy (1960)**, **Dijkstra et al. (1978)**, **Hayes (1997)** — already the anchors in `ShivaGc.fs`; not
  disturbed here.

## 11. Composes with / lanes not touched

- **PR #10817** (open) — the two measurement docs this audit is built on. Extended, not edited.
- **PR #10819** (open) — the ALC-granularity finding used in §7. Inherited, not re-verified. That lane owns
  type **materialisation**; this doc owns the **case**.
- `081KT2T2J0008QG0R0038CRFJM` (verified present on `origin/main`) — the minimal HKT-composing vocabulary. §6.2
  supplies the roadmap its conformance audit should record against.
- `081KYWEM90908QG0R002NHEMZE`, `081KX1VE4G808QG0R003DCK3GV`, `081KRFA460008QG0R0018SN61J` — all verified
  present on `origin/main`.
- **Sibling lanes reported, not edited:** an agent is live on the IR op set; another on a build-graph drift
  guard; an untracked `src/Core.Lean4/Lean4/MenoBraidedRMatrix.lean` is present in the shared checkout. No
  overlap with this doc beyond §5's note.
- Rules applied:
  [`engagement-profiles-…`](../../.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md),
  [`anchor-to-human-prior-art.md`](../../.claude/rules/anchor-to-human-prior-art.md),
  [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md),
  [`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md),
  [`mirror-beacon-register-discipline.md`](../../.claude/rules/mirror-beacon-register-discipline.md).

***

# Addendum, second pass (2026-08-15): separating the objections from the audience

*Appended, not merged into the sections above; §3.2 carries a marked pointer here and is otherwise unchanged.
Aaron's response to the §3.1 governance correction:*

> *"Syme publicly stepped back in Jan 2025 — yes, his arguments for HKT were the strongest. We should not lose
> his arguments against it, but we should transfer the dossier to whoever has it next after him, whoever the
> current approvers are."*

*Read carefully, that is a **separation**, not a replacement: the arguments were the strongest in **both**
directions, so the objections stay as the canonical steelman (§3.2, untouched) while the engagement half
retargets. This addendum does the retarget — and finds that the retarget probably does not land on the F# team
at all.*

## 12. The current F# decision surface — published positions only

Per [`engagement-profiles-…`](../../.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md):
what follows is compiled from artefacts these people published, cited. Nothing is inferred about anyone's
motivation. **Where someone has not stated a position, this section says "not stated publicly" and stops** —
carrying Syme's view over to a colleague by default would be attributing a position to someone who has not
taken one, which is exactly the inference the rule forbids. Everyone named here is assumed to hold the ordinary
technical intentions they publicly claim: language robustness, ease of use, and long-term compatibility.

**Who they are** (from their own GitHub profiles, today): **@vzarytovskii — Vlad Zarytovskii, @microsoft**;
**@T-Gro — Tomas Grosup, @microsoft**. Both named by Syme as the "F# Language Design Squad"
([#1403](https://github.com/fsharp/fslang-suggestions/issues/1403)).

### 12.1 Their published statements bearing on this space

| who | artefact | what it says |
|---|---|---|
| **@vzarytovskii** | [#243, 2021-09-09](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-915950566) | On type classes: *"We don't have any updates on it at the moment."* Procedural, not a position. |
| **@vzarytovskii** | [#243, 2021-09-09](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-916372472) | On tracking static abstract members for F#: *"I haven't seen one yet. If you can create feature request to track it, it would be great!"* Receptive to the IWSAM work item; no statement about HKT. |
| **@vzarytovskii** | [#175 closing comment, 2024-02-07](https://github.com/fsharp/fslang-suggestions/issues/175#issuecomment-1932273530) | *"Closing all `probably not` issues. This one is a bit more sensitive for many, so we shall wait and see where does CLR go with the extensions and unions."* **This is the operative statement**: the disposition is explicitly conditional on the CLR, and framed as *wait and see*, not *no*. |
| **@vzarytovskii** | [FS-1148 discussion, 2024-08-12](https://github.com/fsharp/fslang-design/pull/784#issuecomment-2283678222) | On units-of-measure conversion: *"I generally think that this particular functionality (add, strip measure) can and should be solved generically (i.e. we should have one type directed generic function `stripMeasure<_>` and one `addMeasure<_>` which will do the magic), though it might require some work in compiler."* |
| **@T-Gro** | [FS-1148, 2025-02-12](https://github.com/fsharp/fslang-design/pull/784#issuecomment-2653424932) | Proposes solving the API blow-up in the optimizer rather than by adding functions. |
| **@T-Gro** | [FS-1148, 2026-02-03](https://github.com/fsharp/fslang-design/pull/784#issuecomment-3839970977) | Most recent: marks the RFC draft *"due to the unfinished consensus on the shape"*, and proposes reducing the surface from *"(# primitives \* #collections \* #ops)… TO (#primitives + # collections + # ops)"* by **layered SRTP resolution** — *"SRTP resolution on the different primitive types, as a single 'update<from,to>' function"* plus *"another layer of SRTP resolution on the collection type"*. Also: *"adding things to FSharp.Core directly bears big backwards compatibility commitments."* |

### 12.2 Where they agree with the objections, where they diverge, and where nothing is stated

| objection (§3.2) | @vzarytovskii | @T-Gro |
|---|---|---|
| **A** — slippery slope / design closure | **not stated publicly** | **not stated publicly** |
| **B** — empowerment / category-theory culture | **not stated publicly** | **not stated publicly** |
| **C** — compile-time cost, debugging, tooling | **not stated publicly** on type-level programming as such | **partial, in a different register**: repeatedly weighs implementation cost and FSharp.Core binary size in FS-1148, and prefers an optimizer/library solution over a type-system feature |
| **D** — explicit function passing preferred over abstraction | **appears to diverge, in one lane**: on UoM he argues *for* a generic type-directed solution over per-type functions, *"though it might require some work in compiler"* | **partial divergence**: proposes layered SRTP precisely to collapse a multiplicative API surface, while preferring it live in a library first |
| **E** — instances not parameterizable | **not stated publicly** | **not stated publicly** |
| **F** — utilitarian evidence bar | **not stated publicly** in those terms | **consistent in practice** — his FS-1148 arguments are sizing and compatibility arguments, not aesthetic ones |
| **G** — F# is not a research vehicle | **not stated publicly** | **not stated publicly** |

**The honest summary: on the objections themselves, the current squad has largely not published a position.**
That is not evidence of agreement or disagreement, and this document does not treat it as either. What they
*have* published is a **conditional procedural disposition** (`wait and see where the CLR goes`) and, in the
UoM lane, a **stated appetite for generic, type-directed solutions where the alternative is a multiplicative
API surface**. That second point is the useful one, and §12.4 develops it.

**Correction to my own first pass, marked:** §3.1 said an HKT ask *"is addressed to the wrong half of a gate."*
That was right about the gate and imprecise about the disposition. @vzarytovskii's closing comment is *"a bit
more sensitive for many, so we shall wait and see"* — a **hold pending an external dependency**, not a refusal.
The distinction matters, because a hold has a resolution condition and a refusal does not.

## 13. The blocking constraint is not at F# — where the decision actually sits

This is the most actionable finding in the document, and it follows from labels I had already collected without
following them through.

**The label definitions, read today from the GitHub API:**

- `needs-clr-change` — description: **"Really needs CLR change to do right"** (on #175, HKT)
- `await-csharp-alignment` — description: **empty** (on #243, type classes)

**The corroborating chain, all published:**

| artefact | statement |
|---|---|
| **@vzarytovskii**, [fslang-suggestions#175, 2024-02-07](https://github.com/fsharp/fslang-suggestions/issues/175#issuecomment-1932273530) | *"wait and see where does CLR go with the **extensions and unions**"* |
| **@CyrusNajmabadi**, [dotnet/csharplang#339, 2024-04-25](https://github.com/dotnet/csharplang/issues/339#issuecomment-2077233676) | *"No status currently. The team is looking at **DUs and extensions** first."* |
| **@cartermp**, [fslang-suggestions#243, 2019-08-19](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-522640778) | speaking in the first person plural on the thread: *"We're already quite steadfast in our position that we will **not** be implementing this unless there is a first-class .NET representation."* (Dated 2019; he is **not** on the currently-named squad. Recorded as the historical statement of the same dependency, not as a current position.) |
| **@cartermp**, [2019-08-20](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-523035912) | the reason, stated concretely: without a .NET primitive, F# ends up with *three* "typeclassy" mechanisms — SRTPs, "F# typeclasses", ".NET typeclasses" — or a breaking change to delete SRTP. *"I welcome alternatives that don't involve three implementations of something or massively breaking changes."* |

Two independent teams, five years apart, naming **the same two prerequisites in the same order**: discriminated
unions and extensions. That is not a coincidence of adjacent-sounding statements — it is the F# suggestion's
stated resolution condition matching the C# team's stated queue, verbatim on both nouns.

**The C#/CLR-side artefacts, checked today:**

| issue | state | detail |
|---|---|---|
| **dotnet/csharplang#339** — *Higher Kinded Polymorphism / Generics on Generics* | **CLOSED 2024-12-26**, 229 up-votes, labels `Proposal champion`, `Feature Request` | `state_reason: completed`; **no closing comment is recorded and the API does not expose a closer.** Why it was closed is **not stated publicly** — do not assume it was rejected on the merits; csharplang reorganised champion tracking around that period. The last substantive status is @CyrusNajmabadi's, above. |
| **dotnet/csharplang#110** — *Champion "Type Classes (aka Concepts, Structural Generic Constraints)"* | **CLOSED 2024-12-12**, 317 up-votes, labels `Proposal champion`, **`Long lead`** | same: `state_reason: completed`, no recorded closing rationale. |

### 13.1 What this means for who we would talk to

Stating it plainly, because it changes everything downstream:

> **If the blocking constraint is a CLR representation, then the F# approvers are not the decision point for
> the part that blocks.** The F# squad's published disposition is explicitly *conditional on* that constraint.
> A case for native HKT delivered to the F# team asks people who have already said, in public, that they are
> waiting on someone else.

The relevant bodies for the blocking part are therefore the **C# LDM** (`dotnet/csharplang`) and the **.NET
runtime team** (`dotnet/runtime`) — and both of the C#-side champion issues are currently closed with no stated
rationale, behind a queue whose declared head is DUs and extensions.

**A case delivered to the wrong body is wasted regardless of its quality.** Register: `metered` for every
quotation and label above; `unmetered` for the inference that the CLR is *the* binding constraint — that is my
reading of a consistent chain of published statements, not a statement anyone made in those words.

**What this does *not* imply.** It does not imply the F# team is uninterested, and it does not imply anyone
should be lobbied. The most likely honest outcome of following this chain is the conclusion that **the native
HKT ask has no available audience right now**, which is a legitimate result and is cheaper to learn from
published artefacts than from a submission.

## 14. The one live lane where our N-copies criterion has an instance — and it is theirs, not ours

§6 reported that Aaron's *N copies → 1* criterion fails on our own code (one instance per candidate site) and
that our real N-copies problem is cross-language, which HKT cannot touch. The retarget surfaces a third case
that neither pass had:

**The approvers have an open, active, unresolved N-copies→1 problem of exactly this shape, in the units-of-
measure lane, and they have published their preferred approach to it.**

- **The problem** (@T-Gro, 2026-02-03): the API surface is *"(# primitives \* #collections \* #ops)"* and the
  goal is *"(#primitives + # collections + # ops)"* — a multiplicative-to-additive collapse. That is the
  N-copies→1 criterion stated by the people who would have to approve it.
- **Their approach**: layered SRTP resolution — one layer over primitive types, another over the collection
  type — with a stated preference for prototyping *"in a separate library (or .UMX perhaps)"* first, because
  *"adding things to FSharp.Core directly bears big backwards compatibility commitments."*
- **@vzarytovskii's earlier statement in the same lane** points the same way: a *"type directed generic
  function"* rather than a method per type per action, *"though it might require some work in compiler."*
- **Status**: RFC FS-1148 is **draft, consensus not reached on shape**, as of six months ago.

Why this matters more than the HKT ask:

1. It is at **F#'s unique intersection** — the same one §4 identified from FS-1124 — so it is not blocked on
   the CLR.
2. The problem is **already acknowledged by the approvers**, so nothing has to be argued into existence.
3. It is a lane where a **library prototype is the explicitly preferred next step**, and a library prototype is
   something we can build without anyone's permission.
4. It gives Aaron's *N copies → 1* criterion a **real instance with real numbers**, which §6 could not supply
   from our own codebase.

Register: `metered` for the quotations and the RFC's draft status; `unmetered` for the claim that we could
usefully contribute there — nobody has scoped it, and FS-1148's open questions are about collection remapping
and FSharp.Core size, not about anything we have measured.

## 15. Hazard: a live defect in the mechanism we are relying on

`dotnet/fsharp#19184` — **"IWSAM can result in a runtime verification exception"**, open, filed 2025-12-31.
The reproduction is four lines: code that compiles (with the FS3535 warning) throws
`System.Security.VerificationException` at runtime, because the interface type itself was passed as the type
argument and the static abstract member *"does not have a most specific implementation."*

This matters to us specifically: PR #10817's headline positive was that **IWSAM carries the §4a algebra ladder
natively, statically resolved, exit 0**. That result stands as measured — but the mechanism has an open
soundness-adjacent defect, and our probe would not have hit it (we never pass the interface as the type
argument). Recorded as a standing guard on that lane, not as a retraction. `metered` (the issue and its
repro); **inherited** — I did not reproduce it.

Note the irony worth stating rather than hiding: FS-1124's Drawbacks section predicted trouble of this general
kind, and this is an instance of the author's own warning about the feature he shipped.

## 16. What needs no permission at all

Restated here because §3.1 buried it in a paragraph and it materially changes the urgency of everything above.

> **The `.fsi`-sealed single-`App` brand needs no language change, no CLR change, no C# alignment, and no
> approver.** It is a library pattern. PR #10817 measured it: the forgery attack **fails to compile**
> (`FS0887`, attack build exit 1) from a separate consumer assembly, while legitimate cross-assembly use
> compiles with 0 warnings and runs. It costs **one** earned class total.

So the decision tree is simpler than the framing suggested:

| if the need is… | the path is… | gated by… |
|---|---|---|
| **real and near-term** | the `.fsi`-sealed brand, today | **nobody** |
| **native HKT in F#** | the CLR/C# chain in §13 | a queue whose declared head is DUs + extensions |
| **types as externalized values** | §7 path (b) | **nobody** — and it is the direction Syme publicly recommends |

Two of the three rows are ungated. The gated row is the one the original brief was built around.

And per §6, the honest position stands unchanged: **we do not currently have the need.** Every candidate site
has one instance; the brand encoding would abstract over a singleton and forfeit `ZSet.map`'s
`inline`/`InlineIfLambda` for it. The trigger condition in PR #10817 §5 remains the right deliverable.

## 17. Second-pass claims ledger

| Claim | Register | Evidence |
|---|---|---|
| `needs-clr-change` label description is *"Really needs CLR change to do right"*; `await-csharp-alignment` has no description | `metered` | GitHub labels API, today |
| @vzarytovskii and @T-Gro are Vlad Zarytovskii and Tomas Grosup, both at Microsoft | `metered` | their own GitHub profiles |
| The current squad has **not published** a position on objections A, B, E, G | `metered` (as an absence found by search) | searches over `org:fsharp` and `dotnet/fsharp` for each handle; absence of a statement is reported as absence, never as agreement |
| @vzarytovskii's #175 disposition is a conditional hold (*"wait and see"*), not a refusal | `metered` | the closing comment, verbatim |
| @vzarytovskii favours a generic type-directed UoM solution over per-type functions | `metered` | FS-1148, 2024-08-12 |
| @T-Gro proposes layered SRTP to collapse a multiplicative API surface to an additive one; RFC is draft pending consensus | `metered` | FS-1148, 2025-02-12 and 2026-02-03 |
| The F# suggestion's resolution condition and the C# team's queue name the same two prerequisites (DUs, extensions) | `metered` | #175 closing comment; csharplang#339 comment 2024-04-25 |
| csharplang#339 CLOSED 2024-12-26, #110 CLOSED 2024-12-12, both `state_reason: completed`, **no rationale recorded** | `metered` | GitHub API; the *reason* is **not stated publicly** and is not guessed here |
| The CLR is the binding constraint for native HKT | `unmetered` | my reading of a consistent published chain; nobody stated it in those words |
| `dotnet/fsharp#19184` — IWSAM can throw `VerificationException` at runtime | `metered`, **inherited** | the issue and its four-line repro; not reproduced by me |
| We could usefully contribute to the FS-1148 lane | `unmetered` | unscoped |
| The `.fsi`-sealed brand path is ungated | `metered` | PR #10817's cross-assembly measurement; no language/CLR change involved by construction |

## 18. Second-pass anchors (checked)

- **@vzarytovskii (Vlad Zarytovskii)** — [fslang-suggestions#175 closing comment](https://github.com/fsharp/fslang-suggestions/issues/175#issuecomment-1932273530); [#243 ×2](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-915950566); [FS-1148 discussion](https://github.com/fsharp/fslang-design/pull/784#issuecomment-2283678222). Checked verbatim at each link.
- **@T-Gro (Tomas Grosup)** — [FS-1148 discussion, 2025-02-04 through 2026-02-03](https://github.com/fsharp/fslang-design/pull/784#issuecomment-3839970977). Checked verbatim.
- **@CyrusNajmabadi** — [dotnet/csharplang#339, 2024-04-25](https://github.com/dotnet/csharplang/issues/339#issuecomment-2077233676). Checked verbatim.
- **@cartermp (Phillip Carter)** — [fslang-suggestions#243, 2019-08-19 and 2019-08-20](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-522640778). Checked verbatim; dated 2019 and explicitly **not** carried forward as a current position.
- **dotnet/csharplang#339**, **#110** — states, labels, dates and `state_reason` read from the GitHub API today; closing rationale **absent**, and recorded as absent.
- **dotnet/fsharp#19184** — title, date and repro read today.
- **fsharp/fslang-design PR #784 (RFC FS-1148)** — status read today: open, marked draft by @T-Gro 2026-02-03.

***

# Addendum, third pass (2026-08-15): criterion 3 re-measured, on the axis Aaron actually meant

*Appended. §6 and §6.1 are left as written; the correction to them is stated here and marked.*

## 19. What criterion 3 actually asks

Aaron's correction:

> *"for this one when i say multiple copies i don't mean per language. i mean when you have to write
> specialized versions — like for java numbers instead of dotnet numbers. this is not an exact match, but HKT
> lets you write one generic version where it would have taken multiple specialized versions before."*

**Correction to §6.1, marked.** §6.1 answered criterion 3 with the cross-language ZSet count (F# 602, C# 566,
Rust 469, Q# 318, Go 93). That count is a **real finding and it stands** — but it is **not evidence about
criterion 3**, and presenting it as the answer missed the ask. It is a separate problem: cross-language
duplication, whose remedy is **generation** (`gen/`,
[`only-the-irreducible-is-primitive-generate-the-rest.md`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md)),
not type theory. Reclassified accordingly.

The right question is **intra-language**: *where do we write N near-identical implementations that differ only
in the type being abstracted over, such that a higher-kinded abstraction collapses them to one?* The canonical
shape is the pre-generic-math world — `sumInts` / `sumLongs` / `sumDoubles` written separately — whose .NET
answer was `INumber<T>`.

I measured four axes. **They disagree with each other, and the disagreement is the result.**

### 19.1 Numeric axis — N was never N, because the type is already a value

`src/Core/DynamicValueNumeric.fs` (155 lines) is where numeric specialization would live. It does **not**
contain `addInt` / `addFloat` / `addDecimal`. It contains **one** `add`, which dispatches inside itself over a
closed union:

```fsharp
let add (a: DynamicValue) (b: DynamicValue) : Result<DynamicValue, NumericError> =
    match a, b with
    | DynamicValue.Null, x | x, DynamicValue.Null -> Ok x            // 0 identity
    | DynamicValue.Int x,   DynamicValue.Int y   -> ... Checked.(+) x y
    | DynamicValue.Float x, DynamicValue.Float y -> Ok(DynamicValue.Float(x + y))
    | DynamicValue.Int x,   DynamicValue.Float y -> ... // widen
    | DynamicValue.Float x, DynamicValue.Int y   -> ...
    | _ -> Error(TypeMismatch("add", shapeName a, shapeName b))
```

Same for `mul`, `negate`, `subtract`, `sum`. **Count: one implementation per operation, not one per numeric
type.**

This is the most strategically interesting measurement in the document, because of *how* the collapse was
achieved:

> **We already solved criterion 3 on the numeric axis — by making the numeric type a `DynamicValue` case, i.e.
> by making the type a value. Not by abstracting over type constructors.**

That is §7 path (b), already shipped, in the exact place where the HKT argument predicted we would need path
(a). Register: `metered`.

Honest counter-note in the same file: there **is** a 2× duplication — the `Sat` submodule re-implements
`add`/`mul`/`negate`/`sum` with saturating/poisoning semantics. But that duplication is along the **semantics**
axis (total vs saturating), which is a strategy parameter at kind `*`; HKT does not address it either. N=2, and
the collapsing mechanism would be an ordinary passed function — Syme's Objection D, correct again.

### 19.2 Units-of-measure axis — the count is 2, and I am reporting it as 2

This is the axis the second pass flagged as *"exactly criterion 3, live and in our own domain."* Measured, it
is not — in **our** code.

| measurement | value |
|---|---|
| F# files using `[<Measure>]` | **5** (`Units.fs`, `Window.fs`, `EventLog.fs`, `ZetaId/Types.fs`, `InformationValue.fs`) |
| `[<Measure>]` declarations | **9**, all in `src/Core/Units.fs` (182 lines, 12 functions) |
| `LanguagePrimitives.*WithMeasure` call sites | **11**, across **3** files |
| **distinct primitive constructors used** | **2** — `Int64WithMeasure` (7) and `FloatWithMeasure` (4) |
| `System.Numerics.I*` generic-math constraints in our F# | **0** — every hit is a doc comment naming the C# twin, never a constraint |

So a generic `addMeasure<_>` / `stripMeasure<_>` would collapse **2** constructor variants, over 11 call sites,
in 3 files. **That is N = 2. It is not a criterion-3 instance in our code, and I am saying so** — the same
answer §6 gave for one-instance-per-site, and it is worth the same.

**What this does and does not retract.** The FS-1124 finding in §4 stands exactly as written: .NET generic math
genuinely does not propagate units, the team genuinely chose to suppress `System.Numerics.I*` on unitized
types, and FS-1148 exists because the surface *in FSharp.Core* is multiplicative (@T-Gro: *"(# primitives \*
#collections \* #ops)"*). **The gap is real in the ecosystem; our exposure to it is 11 call sites.** Those are
different claims and the second pass ran them together. Marked as a correction to §14's framing: the FS-1148
lane remains the best *engagement* opportunity, but it is **not** our criterion-3 evidence.

### 19.3 Codec axis — N = 15, the largest genuine count, and HKT does not collapse it

**15 modules in `src/Core` each hand-write their own `toDynamicValue` / `ofDynamicValue`**: `RomDat`, `Slr`,
`ZAtom`, `DeltaCodec`, `ZetaIrV1`–`V4`, `GraphSnapshot`, `YinYang`, `CostarZSet`, `Sppf`, `Conjugate`,
`GrammarIr`. That is a real N, and it is the shape criterion 3 describes.

**But it is not an HKT instance, for two independent reasons, and both matter:**

1. **The abstraction is at kind `*`, not `* -> *`.** Abstracting `'T -> DynamicValue` over `'T` is a **type
   class / IWSAM / SRTP** problem. It is objection-adjacent machinery, not higher-kinded polymorphism. Citing
   it for HKT would be the kind-error the whole document is trying to avoid.
2. **The copies differ *structurally*, not by a type parameter.** Checked two of them side by side —
   `Conjugate.toDynamicValue` emits `["a"; "b"]` from two frames; `ZetaIrV1.toDynamicValue` emits
   `["schema"; "generator"; "version"; "width"; "ops"]`. Collapsing these needs **datatype-generic
   programming** — generic over the *shape* of the type — which is strictly stronger than HKT and is what a
   source generator or type provider does. Which is, again, §7 path (b) and the mechanism Syme publicly
   recommends.

Register: `metered` for the count of 15 and for the structural difference; `unmetered` for the claim that a
generator would collapse them — nobody has scoped it.

### 19.4 Container axis — duplication is absent, not N-fold

Carried forward from PR #10817 and unchanged: **only `ZSet` has `map`/`filter`/`flatMap`**; `GSet`, `Bag` and
`IndexedZSet` have none. On the axis where HKT would most naturally apply, there is **nothing to collapse** —
the duplication is absent rather than N-fold. `metered`.

### 19.5 The four axes, side by side

| axis | N | would HKT collapse it? | what actually would |
|---|---|---|---|
| **numeric** (`DynamicValueNumeric`) | **1** — already collapsed | no need | **already done: the type is a value** (path b) |
| **units of measure** | **2** constructors, 11 call sites | partially, at kind `*` | a generic `addMeasure<_>` — the FS-1148 lane, and our exposure is tiny |
| **codecs** (`toDynamicValue`) | **15** | **no** — kind `*`, and copies differ structurally | **datatype-generic codegen** (path b) |
| **containers** (`map`/`traverse`) | **1** | would, if N ≥ 2 | nothing to do; the trigger in #10817 §5 |
| *(cross-language ZSet — reclassified, not criterion 3)* | 5 | no | generation (`gen/`) |

**The verdict on criterion 3, stated plainly:** it fails on every intra-F# axis I can measure, and it fails
four different ways — already collapsed (numeric), too small to matter (UoM), real but needing a *stronger*
mechanism than HKT (codecs), and absent (containers).

**And three of the four point at the same alternative.** The numeric axis shows the collapse *already achieved*
by making the type a value; the codec axis shows the largest remaining N needing shape-generic **generation**;
the cross-language count needs generation too. That is a convergence toward §7 **path (b)** arrived at by
measurement rather than by preference — and it was not the answer I expected when I started measuring.

Stated as its own claim so it can be argued with: **on the evidence available in this repository, the mechanism
that would collapse the most duplication is not higher-kinded polymorphism but shape-generic code generation
over values.** `unmetered` — it is a reading of four measurements, not a measurement.

## 20. Third-pass claims ledger

| Claim | Register | Evidence |
|---|---|---|
| `DynamicValueNumeric` has one `add`/`mul`/`negate`/`sum`, dispatching over a closed DU, not one per numeric type | `metered` | `src/Core/DynamicValueNumeric.fs:46-97` |
| The `Sat` submodule is a 2× duplication along the *semantics* axis, not the type axis | `metered` | same file, `module Sat` |
| 5 F# files use `[<Measure>]`; 9 declarations, all in `Units.fs`; 11 `*WithMeasure` call sites in 3 files; **2** distinct constructors | `metered` | `rg` counts, today |
| Zero `System.Numerics.I*` generic-math **constraints** in our F# (all hits are doc comments) | `metered` | `rg` over `-g'*.fs' src/` |
| 15 `src/Core` modules hand-write `toDynamicValue`/`ofDynamicValue` | `metered` | `rg -l` count |
| Those 15 differ **structurally**, not by a type parameter | `metered` | `Conjugate.fs:94` vs `ZetaIrV1.fs:77` read side by side |
| Collapsing the 15 needs datatype-generic programming, which is stronger than HKT | `metered` (structural) | the two bodies emit different field sets |
| Criterion 3 fails on all four intra-F# axes | `metered` | the table in §19.5 |
| Shape-generic codegen over values would collapse more duplication than HKT | `unmetered` | a reading of four measurements |
| The cross-language ZSet count is **not** criterion-3 evidence | `metered` (reclassification) | Aaron's stated definition of the criterion |

***

# Addendum, fourth pass (2026-08-15): the program — responsibilities, stages, entry criteria

*Appended. Earlier sections are unchanged; corrections to their framing are marked here.*

## 21. What the standing frame changes about this document

The frame at the top converts this from an assessment into **stage 1 of a program**. Three specific
re-readings follow, and each is a correction to how an earlier section framed itself:

| earlier framing | corrected under the standing frame |
|---|---|
| §6.2 *"the honest recommendation is that the case is not ready to be put to anyone"* | **Still true, and now correctly placed.** It is the finding that closes stage 1, not a verdict on the effort. |
| §7 *"No recommendation is made between them"* (paths a and b) | **Resolved by Aaron, as a sequence.** No fork; upstream contribution is the goal; the ungated work happens first. §24. |
| The repo's 2026-05-13 memory: *"when we fork f# compiler for ai safety to add real hkt over clifford"* | **Superseded.** *"without a fork and take back as a contribution."* Any future agent reading that memory file should read this frame alongside it. |

## 22. The responsibilities map — who owns which decision

Aaron authorized research into *"teams public views **and responsibilities**"*. The responsibilities half is
answerable **entirely from published process documents**, with no inference about any person. Everyone named
is assumed to be acting in good faith on the responsibilities they publicly hold.

### 22.1 F# — `fsharp/fslang-suggestions`, published process

From the repo's own `README.md`, read today:

> *"The decisions about moving things to 'approved in principle' (and thus RFC stage) are up to the F# Language
> Design squad. These are currently: Don Syme, Vlad Zarytovskii, Tomas Grosup… Where necessary Don Syme will
> act as final decision maker. This squad is just people who have the right to label issues - putting that
> aside everyone should please consider themselves equal contributors."*

| stage | who owns it | artefact |
|---|---|---|
| suggestion → **approved-in-principle** | the squad (label rights) | `fslang-suggestions` |
| approved-in-principle → **RFC** | anyone may draft; squad approves | `fsharp/fslang-design` |
| RFC → **implementation** | anyone may implement | `dotnet/fsharp` |
| **final decision, where necessary** | Don Syme | — |

**And the README publishes the approval criteria.** This is the single most useful artefact for planning a
multi-month program, because it is the actual rubric — fifteen named factors:

> *estimated utility · estimated cost of implementing · completeness of proposed design (is this an "idea" or a
> concrete suggestion) · availability of alternatives · education/learning paths and simplicity · whether this
> gives multiple ways to achieve the same thing · votes · design coherence · "less is more" design
> considerations · likelihood of breaking change · strategic importance · usefulness (or otherwise) for interop
> with .NET and other languages · risk of churn w.r.t. bugs · cost of churn w.r.t. education materials ·
> **whether someone is willing to step up to the plate to write an RFC, implement the change and own it long
> term***

Note the last one: **long-term ownership is an explicit criterion**, and it is the one a multi-month effort is
uniquely well placed to satisfy.

**And the published path in:**

> *"Probably the best thing you can do to get a feature promoted is to draft an RFC on it, even if it has not
> yet been marked 'approved'. A prototype implementation of high quality, with tests, can also help convince."*

**And the published constraint on re-opening.** The README distinguishes four categories, of which category 3
is *"things we thought about doing and left open the future possibility of doing them"*, and states:
*"In general things in categories 1 and 2 won't be reconsidered unless there is a really very strong case, e.g.
because of a change in circumstance."* #175's *"wait and see where does CLR go"* places it in **category 3**,
which is the favourable one — it is open-future, not declined. `metered`.

### 22.2 C# — `dotnet/csharplang`, published process

From that repo's `README.md`, read today:

> *"C# is designed by the C# Language Design Team (LDT) in close coordination with the Roslyn project, which
> implements the language."* … *"For new feature proposals… please raise them for discussion, and **only**
> submit a proposal as an issue or pull request **if invited to do so by a member of the Language Design Team**
> (a 'champion')."*

| stage | who owns it |
|---|---|
| **Discussion** | open to anyone (`csharplang` Discussions) |
| **Champion** | a member of the LDM must adopt it — *"only submit a proposal… if invited"* |
| **Design decision** | the Language Design Meeting |
| **Implementation** | Roslyn; prototypes go in a Roslyn fork, with a published quality bar |

The README also publishes milestones that carry decision status: `Working Set`, `Backlog`, **`Any Time`** (*"open to community implementation"*), and **`Likely Never`** (*"the LDM has rejected from the language"*).

**Practical consequence for us:** the C#-side entry point is a **Discussion**, not a proposal — a proposal
without a champion is explicitly out of process. `metered`.

### 22.3 The map, assembled

| decision | owner | our finding |
|---|---|---|
| Native HKT **in F#** | F# squad → approved-in-principle | #175 **closed**, `probably not` + **`needs-clr-change`**, disposition *"wait and see"* (category 3) |
| Type classes / implicits **in F#** | F# squad | #243 **open**, `await-csharp-alignment` |
| HKT **in C#** | C# LDM, via a champion | csharplang#339 **closed** 2024-12-26, **rationale not stated publicly** |
| Type classes **in C#** | C# LDM, via a champion | csharplang#110 **closed** 2024-12-12, label `Long lead`, **rationale not stated publicly** |
| A **CLR representation** | .NET runtime team (`dotnet/runtime`) | no artefact located in this pass — **not researched**, and named as a gap rather than guessed |
| **UoM conversion ergonomics** | F# squad, **live** | FS-1148 **draft**, consensus pending, library-first preferred |
| The **`.fsi`-sealed brand** | **nobody** | a library pattern; measured working in PR #10817 |

**Honest gap, named rather than filled:** I did not research the `dotnet/runtime` side. If the CLR is the
binding constraint (§13, `unmetered`), that team's published area-ownership and any existing runtime-side
issue are the missing piece of this map, and finding them is a concrete next task.

## 23. The staged program, with entry criteria

Stages, not a schedule. Each has an **entry criterion that is a measurement**, so promotion is earned rather
than declared — the same discipline as
[`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md).

| stage | work | entry criterion to leave it | gated by |
|---|---|---|---|
| **1 — measure our own ground** *(complete; this document)* | audit the brief; measure the residue, the axes, the objections, the process | **done**: criterion 3 fails on four axes; one genuine HKT need (profunctor lift); the frame recorded | nobody |
| **2 — build the interim capability** | the `.fsi`-sealed single-`App` brand, one earned class, `prj` returning `Result`, `InternalsVisibleTo` guard | a **second instance** appears at any candidate site (#10817 §5 trigger): a second braided monoidal category, a real `Prism`, or `map` on a second Z-set family member | **nobody** |
| **3 — meter the AI-safety claim** | the F# analogue of arXiv:2504.09246 — generate F# with and without structurally-constrained types, count defects surviving the compiler | a **number**, in either direction | nobody |
| **4 — build the geometric/topological case** | make the geometry claim (§5) falsifiable; connect it to stage 3's measurement | the claim moves from `toy` to `metered`, or is **abandoned** | nobody |
| **5 — earn standing in the ecosystem** | contribute where the F# team has an open, acknowledged problem — FS-1148 is the live one, library-first as they prefer | a contribution **landed**, or a well-received prototype | F# squad review |
| **6 — the ask, in whatever form the evidence supports** | RFC draft (F#'s published path) and/or a `csharplang` **Discussion** (C#'s published path) | stages 3–5 produced evidence meeting the published rubric in §22.1 | F# squad / C# LDM champion / CLR |

**Stages 1–4 are entirely ungated.** Only 5 and 6 involve anyone outside this repo, and stage 6 is the only one
that touches the CLR/C# chain. That ordering is what makes a multi-month effort tractable: **the long pole is
evidence, not permission.**

**Stage 2's honest status:** the trigger has **not** fired. Building the brand today would abstract over a
singleton and forfeit `ZSet.map`'s `inline`/`InlineIfLambda` for nothing (§6, PR #10817 §3.2). The capability is
**available on demand**, not scheduled.

**The one thing to guard against across all six:** §19.5 measured that the mechanism collapsing the most
duplication in this repo is **shape-generic code generation over values, not HKT**. If stages 3 and 4 keep
returning that answer, the honest outcome of this program may be **that we do not need the feature we set out
to contribute** — and the frame's own standard (*align with stated positions; do not overcome anyone*) means
that outcome gets reported, not buried.

## 24. Where path (b) sits, now that the goal is stated

§7 laid out path (a) *push HKT into F#* and path (b) *make types values in our own layer* without ranking them.
Aaron's frame ranks the **goal**; it does not delete path (b). Being precise about which, because the
distinction is load-bearing:

- **Path (b) is not a substitute for the contribution goal.** Aaron stated the goal explicitly: build it *"to
  the point that clr/c#/f# will allow without a fork and take back as a contribution."* Presenting types-as-
  values as "the answer instead" would be substituting my measurement for his stated objective.
- **Path (b) is very likely the right architecture for us regardless**, and this is measured, not preferred:
  §19.1 found we **already** collapsed numeric specialization by making the type a value, and §19.3 found the
  largest remaining N (15 hand-written codecs) needs shape-generic generation, not HKT.
- **It is also what Syme publicly recommends** for industrial type-level programming — type providers, source
  generators, analyzers ([#243, 2021-09-14](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-919427910)).
  That makes it the *least* contentious thing we could build.
- **So the three relations are all live, and only evidence decides between them:** path (b) may be (i) the
  right architecture **and** orthogonal to the contribution; (ii) the thing that **removes the need** for the
  contribution entirely; or (iii) the substrate that **produces the evidence** the contribution requires — a
  working shape-generic layer is itself an argument about what the type system should carry. Stages 3–4 are
  what distinguish these. `unmetered`: all three remain open today.

## 25. Fourth-pass claims ledger

| Claim | Register | Evidence |
|---|---|---|
| The F# squad is Syme, Zarytovskii, Grosup; Syme is final decision maker | `metered` | `fslang-suggestions/README.md`, read today |
| The F# approval rubric is 15 published factors, incl. long-term ownership | `metered` | same README |
| The published path in is "draft an RFC even if not approved; a high-quality prototype with tests can help convince" | `metered` | same README |
| #175 sits in README category 3 (open future possibility), the favourable one | `metered` | README's four categories + the *"wait and see"* closing comment |
| C# requires an LDM champion; unchampioned proposals are out of process; entry point is a Discussion | `metered` | `csharplang/README.md`, read today |
| `dotnet/runtime` ownership for a CLR representation | **not researched** | named as a gap, not guessed |
| Stages 1–4 are ungated | `metered` (structural) | none of them requires an external decision |
| The stage-2 trigger has not fired | `metered` | PR #10817 §5, one instance per site |
| Path (b) may remove the need for the contribution | `unmetered` | one of three open relations; stages 3–4 decide |

***

# Addendum, fifth pass (2026-08-15): §24 resolved — path (b) is the architecture, and the HKT question is separate and additive

*Appended. §24 stated three open relations between path (b) and the contribution goal and left them open.
**Aaron closed the question the same day.** Recorded here with date and attribution rather than edited into
§24, so the reviewed text stays as reviewed — the same durability discipline as the standing frame.*

## 26. The resolution

> **Aaron, 2026-08-15:** *"yes this is our relative, no-central-processor zetadb/fs too — they are all one, and
> when combined with DynamicValue it's also code that can be interpreted and compiled and specialized at
> runtime, with JIT-like behavior."*

**§24's three relations collapse to one:**

> **Path (b) is not an alternative to contributing HKT. It is the architecture, already chosen.** Memories,
> types, files and code are **one content-addressed object store** — relative, with no central processor, with
> per-agent stores and epoch/ref coordination — and `DynamicValue` is what makes those objects *executable*.

So the correct statement of the relation is **separate and additive**: the system does not need HKT in order to
function, and the HKT question is a question about **F# the language**, asked on evidence.

### 26.1 Why this is a *stronger* position for the contribution case, not a weaker one

This is the part worth stating plainly, because the instinct runs the other way — losing an appeal to need
feels like losing an argument. It is the opposite:

- **We are not asking for HKT because our system needs it to function.** We are asking whether F# should have
  it, on evidence. That is precisely the register §22.1's published rubric rewards (*estimated utility*,
  *availability of alternatives*, *design coherence*) and precisely the register Syme's published standard
  demands — *"I generally prefer arguments in utilitarian terms (bug reduction, safety under refactoring…)"*
  ([#243, 2016-11-15](https://github.com/fsharp/fslang-suggestions/issues/243#issuecomment-260630066)).
- **An appeal to need would have been the weaker argument anyway**, and Syme's Objection D anticipates it
  exactly: if you *need* the abstraction to make your system work, the answer is usually that a passed function
  would have done. A proposal from a system that demonstrably does *not* need it cannot be answered that way.
- **It also removes the awkwardness §2.2 flagged** — the old brief's "3,000+ PRs proving the encoding works"
  argued from our own dependency. We have no dependency to argue from. Good.

### 26.2 It re-frames §19, which needs no new measurement

The coordinator's read is correct and I am adopting it: §19.1 found that numeric specialization is collapsed by
**one `add` dispatching over a closed `DynamicValue` union**, not by `addInt`/`addFloat`/`addDecimal`. I
recorded that as *"we already solved criterion 3 on the numeric axis"*, which framed it as a **substitute for a
missing feature**.

**Correction, marked:** it is not a workaround for absent HKT. **It is the architecture doing what it is
designed to do** — the type is a value because everything in this system is a value in one content-addressed
store. The measurement is unchanged; only its meaning changes, and it changes in the direction that makes the
contribution case cleaner. Same for §19.3's 15 hand-written codecs: those are the *unfinished* part of the same
architecture (shape-generic generation over values), not evidence of an HKT-shaped hole.

### 26.3 The ALC wall is not a problem we have to solve

PR #10819 established that Orleans virtualizes **objects**, objects are **GC-granular**, and CLR **types are
not** — the smallest collectable unit is an `AssemblyLoadContext`. §7 recorded that as a *cost* borne by path
(a) and *avoided* by path (b).

Under the resolution, the sharper statement is available:

> **If the objects are `DynamicValue`s rather than CLR types, the ALC constraint does not apply at all.**
> Everything is GC-granular again. That is exactly why `ShivaGc` works on `DynamicValue` and could not work on
> `Type`. **The wall is not an obstacle the design must overcome; it is a layer the design does not enter.**

Checked in source, not inferred: `src/Core/ShivaGc.fs` collects a content-addressed heap of `DynamicValue`
objects `{ id, value, refs }` with machine-checked live-survive, cycle-safety, idempotence and determinism, and
its own header states the reason — *"you cannot GC baked code, but you can GC values."* `metered`.

## 27. What is shipped vs what is intended — the capability claim, metered

*"Code that can be interpreted and compiled and specialized at runtime, with JIT-like behavior"* is a real
capability claim with four distinct verbs. They have different registers and must not travel as one word.

| verb | shipped? | evidence |
|---|---|---|
| **one content-addressed store over files** | **yes** | `src/Core/ZetaFs.fs` (387 lines) — Patricia trie over a `ContentStore` with `MerkleHash`, generic in the value type. `src/Core/DagFs.fs` (112 lines) — multi-parent content-addressed tree; identical content under N paths is **one** stored node; COW with `editLocal` / `editEverywhere`. `metered`. |
| **interpreted** | **yes, and reified** | `src/Core/MixIr.fs:184` — **`defaultEvalDef : DynamicValue`**: the evaluator's rules *are* a `DynamicValue`. `src/Core/IsaSpec.fs` asserts the reified path equals the native one — *"Faithful: `tryStaticReified defaultEvalDef … = tryStatic …`"* and *"`specializeFullyReified defaultMixDef defaultEvalDef … = specializeMem …` (proven differentially)"*. `metered`, **inherited** — I read the assertions, I did not run them. |
| **specialized at runtime** | **yes, as partial evaluation + weak-ref regeneration** | `src/Core/SpecializationCache.fs` (59 lines), read today: `specializer: unit -> ('TInput -> 'TOutput)` is held **strongly** as a constructor field; the specialized function is held in a **`WeakReference`**; on collection it regenerates; **errors are never cached**. This is PR #10815's finding confirmed at source: **generator strong, product weak — compression, not creation.** `metered`. |
| **compiled** | **only in the partial-evaluation sense** | There is **no runtime code generation**: PR #10819 measured zero `Reflection.Emit` / `AssemblyBuilder` / `ILGenerator` anywhere under `src/`. "Compiled" is true in the **Futamura** sense — specializing an interpreter with respect to a program is compilation — and **false** in the emit-IL sense. `metered` on the absence (inherited from #10819); the word itself is the hazard. |

**So the honest form of the claim:** *one content-addressed store whose objects are `DynamicValue`, an
interpreter whose rules are themselves `DynamicValue`, and Futamura-style specialization cached behind a weak
reference.* **"JIT-like" is an analogy to the caching-and-specialization behaviour, not a claim that we emit
machine code or IL.** Register on the analogy: `toy`. Register on each shipped mechanism: as tabled above.

The bound is the one #10815 already named and it transfers unchanged: regeneration **trades a large resident
product for a small resident generator**, so the win is real exactly when `|generator| << |product|`. It does
not make memory free.

## 28. The epoch hazard transfers, and its scope is now larger

[`local-time-never-enters-the-shared-fold.md`](../../.claude/rules/local-time-never-enters-the-shared-fold.md)
applies to this store, and the resolution **widens** its scope: if memories, types, files and code are one
object store with epoch/ref coordination, then **an epoch must be a logical clock for all four**, not just for
types.

The shape to avoid is already in the tree and was flagged by PR #10819. Confirmed at source today,
`src/Core.TypeScript/ace/deps.ts`:

```ts
export function getResolvedVersion(node: DependencyNode, asOf?: Date): string { ... const refDate = asOf || new Date(); ... }
export function getMigrationPhase(node: DependencyNode, asOf?: Date): string { ... const refDate = asOf || new Date(); ... }
```

Three call sites default to an **ambient `new Date()`**. This is **correct where it is** — deployment
scheduling is a local action, and the function is properly parameterised with an injectable `asOf`. It is
recorded, again, because it is exactly the wrong shape to generalise into epochs: an epoch derived from
wall-clock makes two agents' stores fold different evidence sets and diverge. `metered` (the source);
**unchanged, not a defect** in its current use.

## 29. Fifth-pass claims ledger

| Claim | Register | Evidence |
|---|---|---|
| Path (b) is the chosen architecture; the HKT question is separate and additive | `metered` as a **stated decision** (Aaron 2026-08-15), not as a measurement | the quotation in §26 |
| §19.1's numeric collapse is the architecture working, not a workaround for missing HKT | `metered` (reframing of an unchanged measurement) | `DynamicValueNumeric.fs` + the resolution |
| The ALC constraint does not apply when the objects are `DynamicValue` | `metered` (structural) | `ShivaGc.fs` collects `DynamicValue` heaps; #10819's ALC finding, inherited |
| `ZetaFs` / `DagFs` are content-addressed stores over `ContentStore` + `MerkleHash` | `metered` | `ZetaFs.fs:195-210`, `DagFs.fs:1-18`, read today |
| `MixIr.defaultEvalDef` is a `DynamicValue` — the eval rules are data | `metered` | `src/Core/MixIr.fs:184` |
| The reified interpreter/specializer equals the native one | `metered`, **inherited** | `IsaSpec.fs:467,709,800` assertions; not executed by me |
| `SpecializationCache` holds the generator strongly and the product weakly; never caches errors | `metered` | `src/Core/SpecializationCache.fs`, read line by line today |
| **No runtime code generation exists** — "compiled" holds only in the Futamura sense | `metered`, **inherited** | PR #10819's zero-hit search for `Reflection.Emit` / `ILGenerator` |
| "JIT-like behavior" as a claim about emitting code | **`toy`** | an analogy to caching + specialization; nothing emits IL |
| Regeneration is compression, not creation (`\|generator\| << \|product\|`) | `metered` | PR #10815, confirmed at source here |
| `ace/deps.ts` defaults to ambient `new Date()` at three sites | `metered` | source, today; correct in place, wrong shape to generalise |
| Not asking from need is a stronger position under the published rubric | `unmetered` | a reading of §22.1's criteria and Syme's stated standard |
