# Shadow lesson log — the guard I wrote to catch blind instruments was itself blind, and a refuted finding is a result

**Date:** 2026-08-14 · **Branch:** `shadow/blind-breaker-and-split-pressure-classifier` ·
**Work-items:** `081M0148RV6087G0R001BN31P0` (breaker) · `081M010W1BP087G0R002M2BNVW` (classifier)

Two findings were handed to me from the backpressure investigation (PR #10693), filed and not
fixed, with the standing instruction to **reproduce or refute** each before touching anything.
Both partially refuted. Both refutations were worth more than the fixes would have been on
their own.

---

## 1. The lesson that cost the most: my scan floor did not scan

I wrote `lint-heat-kind-classifier-agreement.ts` with an aggregate scan floor — *fail if fewer
than 20 kind literals were inspected* — precisely because a check that stops matching reports
"clean" forever. Then I planted a mutant that disabled one of the four extraction patterns,
which is the exact drift the floor exists to catch.

**The lint exited 0 and printed `OK`.**

The corpus had only fallen 33 → 30, still above 20, because the surviving patterns happened to
cover most of the same strings. The floor was real, the number was wrong, and a wrong number is
indistinguishable from no check at all.

The fix was not a bigger number — a bigger aggregate floor still cannot tell *which* route went
dark, and it breaks noisily on legitimate removals. It was a **per-pattern floor**: every named
extraction route must contribute at least one match. The same mutant now exits 1 with
`extraction route 'fsharp-emitter-inline' matched 0 times`.

**The lesson, stated so it transfers:** an aggregate floor measures the *sum* of independent
instruments, so it cannot detect the failure of any one of them. Redundancy in the numerator
hides a zero. If a check has N routes, it needs N floors — the aggregate is a bonus, not the
guard.

And the meta-lesson, which is the one I would have missed: **I only found this because I
planted the mutant.** Reading the design, the floor looked correct. The brief's instruction —
*do not add a check you cannot demonstrate failing* — is not a documentation requirement. It is
the only thing that distinguishes a guard from a comment.

---

## 2. A refuted finding is a result, and it changed the fix

**Finding 1** was reported as *nested breakers: when the outer opens, the inner sees no
traffic, its error rate falls to zero, and it reads healthy.* That does not exist here.
`RetryPolicy.withCircuitBreaker` is a pure stateless decision on `ctx.Attempt` — no error
estimator, no half-open, nothing to starve. Nesting it is legal and harmless.

But the **class** was live, in a different breaker, in a form nobody had named:
`export-cb-snapshot.ts` returned `CLOSED` / `"assuming healthy"` for an identity with **zero
envelopes**. Same inversion, no nesting required — an agent still emitting idle heartbeats read
`OPEN`, an agent gone completely silent read green.

Had I gone looking only for the nested shape, I would have reported "does not reproduce" and
walked past the live one. **Reproduce the class, not the sentence.**

**Finding 2** ran the other way. The mechanism reproduced exactly as described (3 of 3
dual-token probes disagreed), but the enumeration the finder had explicitly *not* done showed
**0 of 32 live kinds disagree**. Latent, not live — and that refutation is what made the fix
safe to make, because it proved that deleting one of the two classifiers changes no behaviour
today. The finder's refusal to claim liveness was correct, and stating the uncertainty is what
let the next agent close it cheaply instead of expensively.

---

## 3. Owned error: I wrote a work-item ID before minting it

While writing the breaker fix I put `081M0269RTM087G0R0035GS6TV` into two source files as the
work-item reference — a ZetaId I had **invented**, not minted. The real ID, once
`new-workitem.ts` ran, was `081M0148RV6087G0R001BN31P0`. I caught it at mint time and corrected
both files.

It would have shipped as a dangling cross-reference: a citation to evidence that does not
exist, in a file whose whole subject is instruments that report states they never measured. The
same defect class, committed by me, in the commit that fixes it.

**Guard for next time:** mint first, then write. An identifier is evidence; do not forward-declare it.

---

## 4. What I did not touch, and why

- **`SoftThrottle.fs`** — PR #10693 measured against it without modifying it, and that baseline
  is load-bearing for its results. Read, not edited.
- **`heat.ts` encoder bodies** and the **`TemperatureReadout` treaty schema** — sibling agents
  hold those. My classifier fix stayed inside `Heat.fs` + three call sites and needed neither.
  Worth recording that the *better* fix — a typed deferral/destruction field instead of a
  substring match, `081M00TNWM8087G0R0027ACGKY` — **would** have crossed that boundary. The
  cheap fix was chosen partly on coordination grounds, and that is a real cost, named rather
  than hidden.

---

## Anchors

- **Goguen & Meseguer (1982)**, noninterference — the discipline `dv2-data-split` §7 states, and
  the frame under which "zero observations" is a *missing channel crossing*, not a benign one.
- **Kahn (1974)** / **Brock–Ackerman (1981)** — the determinacy result PR #10693 anchors the
  composition law on; the pressure/loss bit is what selects which regime an operator is in,
  which is why two classifiers of it was worth closing even while latent.
- The eleven-plus structurally-unfailable checks found across this repo this week, including one
  in `package.json`. This log adds a twelfth — **found in my own guard, before it shipped.**

---

## 5. Correction, 2026-08-17: the fix I guarded is not the fix that landed

Everything above §4 stands as written on 2026-08-14. This section is appended rather than edited
in, because the error is in the *relationship* between the log and the repo, and rewriting the
log would hide it.

**What I believed when I wrote the lint.** §2 records the classifier fix as *"`HeatSignature.isPressureKind`
DELETED; `HeatSignal.isPressureKind` is now `kind |> ofKind |> isPressure`"*. I wrote
`lint-heat-kind-classifier-agreement.ts` to guard exactly that shape, and PART B pinned the
classifier **by name**: the raw substring probes may be read by `ofKind` and by nothing else.

**What actually landed.** PR **#10804** (Grok, 2026-08-15) fixed the same work-item first, and
differently — better:

- `HeatSignature.isPressureKind` was **not** deleted. A **third** binding,
  `HeatSignature.classifyKind : string -> KindClass`, became the single ordered chain and the
  only consumer of the probes; **both** routes were rewritten to read it.
- The chain's **order was inverted**. Pre-fix `ofKind` tested forgetting first, so a dual-token
  kind read `Forgotten` — *not pressure*. `classifyKind` tests backpressure first, so a
  dual-token kind is **pressure**. That is the fail-safe direction: missing a pressure signal is
  what makes `TemperatureReadout` read cold for a room under genuine backpressure.

So the branch carried F# assertions (`Assert.False(HeatSignal.isPressureKind "prune-backpressure")`)
that encode the **pre-#10804 semantics**, and landing them would have re-inverted a
deliberate fail-safe choice. That is the sharper half of this correction: the stale lint was
loud and cost a red PR; the stale *test* was quiet and would have cost the behaviour.

**The lesson, stated so it transfers.** A structural model of code, held in a lint, is a
**cache of someone else's file** — and this repo already knows what an unvalidated cache does.
Pinning the classifier by name did not guard anything: the defect is **arity** (how many
bindings decide the bit), and a name-pin catches **renames**. It generated exactly one signal in
its life, and that signal was a false positive against correct code.

The rewrite makes the model structural rather than nominal, and pays for the lost name-pin with
checks the name-pin could never have made:

| | first draft | after |
|---|---|---|
| finds the classifier | by the name `ofKind` | **discovers** the unique binding that consumes the probes |
| second classifier via named probes | caught | caught |
| second classifier that **inlines** `kindContains` | **missed** | caught (B2) |
| the same, **named like a probe** (`is*Kind`) | **missed** | caught (B2b — an orphan probe nothing reads) |
| the two pressure tables disagreeing on **membership** | **missed** | caught (B3) |
| a **miswired** `ofKind` arm (`Denied -> Forgotten`) | **missed** | caught (B3, via the parsed map) |
| the classifier renamed | **false positive** | green, and the new name is printed |

B2b is the one I would have missed by reading: I added B2 (fence `kindContains`), and only found
that a second classifier *named* `isSomethingKind` parses as a legitimate token predicate and
walks straight past it **because I planted that mutant**. Same meta-lesson as §1, second time in
the same file. The design looked right twice; the mutant disagreed twice.

**Register, honestly.** B3 guards *two agreeing tables*, not *one table* — the pressure bit is
still enumerated twice, once over `KindClass` and once over `HeatSignal`. Post-#10804 those two
cannot disagree on an **input** (both funnel through `classifyKind`), only on **membership**, and
B3 is what makes membership drift fail loudly. Collapsing them to one table is filed as
`081M07Z23EX087G0R003N676FT` rather than done here, because it is an F# change to a load-bearing
file and this branch is a lint correction.

**And one more owned error, the twin of §3.** §3 was *"I wrote a work-item ID before minting
it."* This is *"I wrote a guard for a fix before the fix landed."* Both are the same shape —
**asserting a fact about the repo from my own intent instead of from the repo** — which is
`look, don't infer` failing twice in one branch, once about an identifier and once about a file.

