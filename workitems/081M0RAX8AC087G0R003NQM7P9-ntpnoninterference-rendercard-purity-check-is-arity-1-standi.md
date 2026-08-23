---
id: 081M0RAX8AC087G0R003NQM7P9
type: bug
state: backlog
priority: P2
slug: ntpnoninterference-rendercard-purity-check-is-arity-1-standi
title: "NtpNoninterference renderCard purity check is arity-1 standing in for a 2-safety property"
created: 2026-08-23T22:12:26.060Z
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
