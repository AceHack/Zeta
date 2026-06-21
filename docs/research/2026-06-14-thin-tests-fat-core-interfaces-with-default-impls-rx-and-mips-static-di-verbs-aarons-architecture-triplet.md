# Thin tests, fat core · interfaces-with-default-impls + Rx · MIPS static-DI verbs (Aaron's architecture triplet)

Aaron 2026-06-14, three beats in one breath, while overriding the WSet demotion ("why are we
keeping in tests? we need in real code"):

> "The test framework should be THIN on top of real code." /
> "Most is just interfaces and Rx, nothing more — interfaces have default impls." /
> "And MIPS: static DI injected verbs."

## 1. THE THIN-TEST LAW (the WSet promotion's general form)

Substance lives in `src/` — tests are a THIN layer that exercises real code, never a place where
real capability hides. Rodney's razor demoted WSet to a fixture on the no-consumer measurement;
Aaron's override sets the direction the razor couldn't see: **consumers arrive ON the shelf, not
before it exists** — the shelf is the product. The razor's bar (a load-bearing consumer) stays as
the standing TODO in WSet's header; the dissent is recorded, the decision is the human's. Standing
rule: when a test needs machinery, the machinery goes to Core and the test thins.

## 2. INTERFACES + RX, NOTHING MORE — and interfaces carry DEFAULT IMPLS

The architecture's default form: **pure interfaces (universal shapes) + Rx streams**. Shared
behavior lives in DEFAULT INTERFACE IMPLEMENTATIONS (C# DIMs / F# default members), NOT in base
classes — the interfaces-free-classes rule completed: a default impl is shape-with-a-suggestion
(zero instance state, overridable, generator-readable), where a base class is weight (state,
capture, the thing `gen/` cannot read). Rx is the composition glue between shapes; everything
else must justify itself. (Beacon: C# 8 default interface methods; the Rx contract; our
`universal/` shapes as the interface library.)

## 3. MIPS: STATIC-DI INJECTED VERBS (081KTSZN10008QG0R001BCCTXT's wiring observation)

Max's MIPS treaty room wires its verbs (sim/mea/cut + the action-grammar verbs) by **static
dependency injection over interfaces**: the verb set is declared as interface deps resolved at
composition time (compile-time-known, DST-deterministic, ZetaId-addressable per universal/port) —
no runtime service-locator, no reflection scan. The machine's behavior is the sum of its injected
verbs; swapping a verb = swapping an adapter behind the port. This is the chip8 lesson
(capability upgrades as injected interfaces) made the FIRST-CLASS wiring style for machine #2 (an observation Max can adopt or push back on — not a mandate).

## Pointers

- `src/Core/WSet.fs` (the promotion + the recorded dissent — the worked example of law 1)
- `universal/port.md` · `universal/` (the interface library) · `gen/` (why no classes: generators
  read interfaces) · `.claude/rules/interfaces-free-classes-earned-under-rules.md` (this triplet
  extends it: default impls are still weight-free)
- 081KTSZN10008QG0R001BCCTXT (MIPS — the static-DI verb wiring lands there) · `src/Core/Rx.fs`

## 4. THE FORM TEST (Aaron, completing the triplet into a quartet)

> "This is why we have the universal interfaces folder — everything is basically that, or it's a
> smell. That, or Rx, or MIPS verbs."

The whole-system form check, one sentence: every piece of real code is one of THREE forms —
(a) a **universal interface** (a shape in `universal/`, default impls allowed, generator-readable),
(b) **Rx** (the composition/stream glue between shapes), or
(c) **static-DI injected verbs** (the MIPS wiring style — interface deps resolved at composition
time). Anything that is none of the three is a SMELL: not forbidden, but it owes an explanation
(the earned-class register — weight must be justified under rules/). This is the review question
to ask of any new file: *which of the three is it — and if none, why?*

## Register note (Aaron, same hour): "we don't have doctrine"

Correct — the word is RETIRED (second catch this stream; the first was 2026-06-11). These are
OBSERVATIONS: Aaron's, captured faithfully, adoptable and contestable by any traveler. Nothing
here binds by authority — the only directive is that there are no directives. The file's framing
is corrected to match.
