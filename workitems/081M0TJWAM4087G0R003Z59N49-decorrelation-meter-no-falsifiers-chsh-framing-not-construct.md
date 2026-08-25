---
id: 081M0TJWAM4087G0R003Z59N49
type: bug
state: backlog
priority: P1
slug: decorrelation-meter-no-falsifiers-chsh-framing-not-construct
title: "decorrelation-meter: no falsifiers, CHSH framing not constructible, and five scoring inversions"
created: 2026-08-24T19:10:13.124Z
depends_on: []
composes_with: []
---

# decorrelation-meter: no falsifiers, CHSH framing not constructible, and five scoring inversions

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0TJWAM4087G0R003Z59N49-*.md` glob. -->

Review of `src/Core.TypeScript/observe/decorrelation-meter.ts` (Alexa/Kiro, merged #14848,
275 lines, zero tests). Every finding below was reproduced against the as-merged code before
being written down.

## The concept is right and is wanted

Measuring whether fleet decorrelation is real rather than assumed is load-bearing:
`src/Bayesian/CondorcetBoundary.fs` caps effective identity at `N_eff = N/(1+(N-1)rho) -> 1/rho`,
and `src/Core/SocietyUsefulWork.fs` records this society's actual rho as UNMEASURED. The module's
own stated intent — "measure, never assert 2*sqrt(2)" — is the correct intent. The failure is that
the implementation defeats it. Nothing here is an argument for deleting the module.

## P0

1. **Zero falsifiers.** 275 lines of measurement on `main` that nothing could distinguish from a
   stub. `.claude/rules/toy-is-free-metered-must-be-earned.md`: unfalsified is `unmetered`.
2. **Forced agreement scored as maximum independence.** A menu of one option gives
   `expectedByChance = 1`, denominator `1 - 1 = 0`, the guard returns excess `0`, and the fold
   reports `coefficient = 1.0`, band `"strongly-independent"`. Two agents that could not possibly
   disagree read as maximally decorrelated. Reproduced.
3. **Agreement compared raw `chosenIndex` across different menus.** The same code averages
   `(dA.options.length + dB.options.length) / 2`, so it had already measured the menus to differ,
   and then compared indices anyway. Agent A choosing `"ship"` and agent B choosing
   `"delete-prod"`, both at index 0, scored perfect agreement (`coefficient 0.000`). The record
   carries a `chosen` LABEL field that would have made this correct; it was not read. Reproduced.
4. **Unmeasured reported as measured.** Absent data file returns `coefficient: 0, chshS: 2,
   band: "correlated"` — structurally "the fleet is perfectly redundant". Only the prose `summary`
   said INSUFFICIENT DATA, and structured consumers do not read prose. Piped into `N_eff` this
   turns "no data" into "the fleet is worth one agent". Reproduced.
5. **The CHSH framing is not constructible from this input and the mapping is where the assertion
   moved.** See the analysis section below.

## P1

6. **One malformed line zeroes the whole file.** Read + `.map` inside one `try`; the catch returns
   `[]`. Measured: 24 valid records plus one bad line yielded 0 decisions. A corrupt file is
   indistinguishable from an absent one. Reproduced.
7. **`Array.find` silently truncated to the first decision per agent per window.** Every other
   decision in that window was discarded with no counter.
8. **Anti-correlation flattened onto independence.** Agents that never agree give excess < 0,
   `1 - excess > 1`, clamped to `1.0` — byte-identical to genuine independence. Negative rho is
   meaningful to `N_eff` (it raises it). Reproduced.
9. **`expectedByChance = 1/mean(|A|,|B|)` is wrong for unequal or non-identical menus** and is
   biased upward, which biases reported decorrelation upward. It flattered the fleet. The correct
   quantity comparing labels is `|A intersect B| / (|A| * |B|)`.
10. **The `"suspicious"` band was unreachable.** It sat behind `coefficient <= 1.0` after a `[0,1]`
    clamp; its own comment said "should not happen with the clamp". The header called it the
    metering-error flag. A branch that cannot fire is not a check.
11. **`groupConcurrentTicks` docstring was false.** "Concurrent if within `windowMs` of each other"
    describes a proximity relation; the code does fixed-offset bucketing. 1 ms apart across an edge
    are never compared; 119 s apart inside one bucket are treated as simultaneous.
12. **Unparseable `at` produced bucket `"NaN"`,** silently making every malformed row mutually
    concurrent. Reproduced.
13. **Culture-sensitive `localeCompare` shipped** (#14868 fixed it separately). Nothing pinned it,
    so nothing would have caught it coming back.

## P2

14. **Dead code.** Zero importers on `main`. The `model` field — the module's own headline
    decorrelation source — is present in every record and never read.
15. **Regressive duplicate of a settled F# lineage.** `src/Core/DecorrelationMeter.fs` already did
    CHSH here, went through adversarial review (PR #10010), and was demoted to a live-channel /
    superdeterminism detector over spacelike pairs only. `docs/pitch/economic-thesis-*` calls it
    "the earlier scope-limited CHSH form, superseded". The TS module reintroduced the retired
    framing with the inference running backwards.

## Why the CHSH framing had to go rather than be renamed

- **Not constructible.** CHSH needs four correlators across two settings per party. Pairwise
  agreement on one tick is one correlator with no settings. Missing structure, not sampling error.
- **No information.** `S = 2(1+c)` is affine and invertible. Its only effect was to place
  `2*sqrt(2)` at `c ~ 0.414` on a scale the mapping itself chose — numerology in the exact sense of
  `.claude/rules/numerology-vs-number-theory.md`.
- **Self-refuting.** Header: "S > 2*sqrt(2): impossible if measured honestly". Its own best case
  `c = 1` gives `S = 4 > 2.828`.
- **Inference inverted.** `DecorrelationMeter.fs` establishes that a passive shared common cause
  IS a local-hidden-variable model and sits at or below `|S| <= 2`; `S > 2` convicts a live channel,
  and `S <= 2` never acquits. The removed mapping read high S as independence.
- **The ring corners do not supply settings.** `FourCornerOwnership` names weight rings, and
  `wset-four-corner-trace.ts` refuses the bridge in its own docstring.

## Disposition

Landed on `fix/decorrelation-meter-falsifiers-and-chsh-framing`: `chshS` removed with the reasons
recorded in-file rather than deleted, findings 2/3/4/6/7/8/9/10/11/12 fixed, and 38 falsifiers
added. 15 mutations applied, 15 killed (14 at runtime, 1 by `tsc`).

Open, NOT done here, for the module's owner:

- Fixed-offset bucketing vs a real proximity relation is a semantics decision, not a bug fix
  (proximity is not transitive; it needs a design). Pinned as a known limit in §12.
- **This coefficient is NOT the rho in `N_eff`.** That rho is pairwise ERROR correlation; this is
  choice agreement with no ground truth. Two agents that are both always right agree perfectly and
  have no error correlation at all. Joining a correctness signal is the next piece of work.
- Stratifying by `model` family is the obvious next measurement, deliberately left undone.
