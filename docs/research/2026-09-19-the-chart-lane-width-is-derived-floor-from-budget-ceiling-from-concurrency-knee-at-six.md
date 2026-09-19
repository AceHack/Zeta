# The chart-lane width is derived, not chosen: a floor from the budget, a ceiling from concurrency, and a knee at six

**Work item:** `081M2VMCAJ1087G0R003075RV0` · **Date:** 2026-09-19

**Register:** the constants in §2 and §3 are `metered` — measured today against
the live roster, graph and footprint data. The wall-clock claim in §6 is
explicitly **not** measured and is marked. Nothing here retires a lane or
changes CI; `packLanes` still produces the matrix.

---

## 0. The question

> Aaron 2026-09-18: *"we need to resplit it by helm charts that can be fully
> tested with HA and everything turned on if possible and redudance ... where
> the deps could be not HA ... we were going to try to get to 6 ish lanes ...
> where some common things are always needed in each lane."*

And, on the number:

> *"6 was a estimate a while back."*

This document turns that estimate into a derivation. The answer is six, and
the useful part is **why** — because the reason survives the roster changing
and the estimate does not.

---

## 1. Why one rung cannot answer it

`priceSet` charges a single resource rung to an entire lane. Measured over the
49-chart roster:

| rung | CPU total | lanes | covered |
|---|---:|---:|---:|
| everything at `dev` | 4650m | 2 | 47/49 |
| everything at `metal` | 12365m | 4 | 45/49 |

The first tests nothing at HA. The second is 2.7x the cost and *loses*
coverage — three charts stop fitting a runner at all. Neither answers the
question a deploy lane exists to answer, which is whether a chart works with
replicas and redundancy switched on.

**The two-tier rule.** A lane tests its SUBJECTS; its dependencies only have to
be present and serving. So charge subjects at `metal` and everything they drag
in at `dev`. Paying HA prices for a dependency buys nothing and spends the
budget that would have bought HA for a subject.

Disk and image count are deliberately not re-derived per tier: `buildModel`
loads `footprints` independently of `rung`, so the image set is the same either
way, and inventing a difference the data does not have would be a worse error
than the one being fixed.

---

## 2. The floor — what the budget forces

Under the two-tier rule, with metal's own first-boot set present in every lane:

```
INDIVIDUALLY HA-TESTABLE on one hosted runner: 46/49
FLOOR: 4 lanes
```

Three charts are excluded, each for a named and separately-fixable reason:

| chart | why | shape of the fix |
|---|---|---|
| `gitlab` | cpu 2650m > 2125m | self-hosted runner, or resource tuning |
| `mimir` | cpu 2760m > 2125m | same |
| `hat-system` | image is `...hat-system-operator:placeholder` | a real image; it is currently **counted as zero** |

`hat-system` is the interesting one. An unpriceable chart summed as zero is the
defect class this module already refuses for dropped roster joins — capacity
nobody pays for — so it is reported by name rather than absorbed.

---

## 3. The ceiling — and where "six" actually came from

Two independent ceilings sit above the floor, and neither was invented for this
document:

- **Concurrency, ~6.** `docs/research/2026-09-09-lane-audit-under-the-metal-fidelity-criterion.md`
  records the per-chart-set split sized at **six** concurrent jobs — *"six
  started within a 4–5 s spread; thirty is not evidence-backed"*. Beyond six,
  lanes queue and wall-clock stops improving.
- **Economics, `p > 0.24`.** `docs/research/2026-09-10-packages-and-test-lanes-are-one-axis-*.md`
  derives the stopping rule `p > F / (2F + S)` with `F` measured at 55–67s of
  fixed setup per lane. A finer boundary pays only if each half can skip more
  than about a quarter of the time.

So the width is bracketed: **at least 4 (it must fit), at most ~6 (it must run
in parallel), and never finer than the skip rule pays for.**

---

## 4. The knee

Balanced packing, measured across widths:

| target | covered | max utilisation | headroom |
|---:|---:|---:|---:|
| 4 | 46/49 | 96% | **4%** |
| 5 | 46/49 | 78% | 22% |
| **6** | 46/49 | **67%** | **33%** |
| 7 | 46/49 | 65% | 35% |

4→5 buys 18 points of headroom, 5→6 buys 11, 6→7 buys **2** — and 7 is past the
concurrency ceiling anyway. Six is the knee, and the estimate was right.

---

## 5. Balance is the objective, not a side effect

> Aaron 2026-09-18: *"for balance not absolute greedy cause charts will change
> over time and we want headroom to redesign."*

First-fit-decreasing answers "fewest lanes" by filling each to the cap before
opening the next. Under the two-tier rule it returned 4 lanes holding
**30 / 2 / 5 / 9** subjects, with lane-1 pinned exactly at the 2125m budget.
Every one of those 30 charts was one replica from not fitting.

`packBalanced` minimises the **fullest** lane instead. On the real tree at six:
lanes at 63 / 67 / 66 / 63 / 66 / 65 %. Headroom is what is being bought, and
`maxUtilization` is what reports it.

Least-loaded-first, with each subject going to the lane whose utilisation is
lowest **after** taking it rather than the lane emptiest now — because lane cost
is the size of a UNION, so a subject sharing a closure with a lane may cost it
almost nothing while costing an empty lane its whole closure.

---

## 6. What this does NOT establish

- **Wall-clock.** Balance is by resource utilisation, not by subject count or
  by time-to-Healthy. Lane-4 holds 23 subjects at 63% because they share a
  closure and are collectively cheap. That is correct for *fitting* and
  unproven for *duration*, which is a different objective needing its own
  measurement. **Not measured here.**
- **Optimality.** LPT has a 4/3 bound on makespan and first-fit an upper bound
  on lane count, so the true floor could be 3. Both heuristics are chosen for
  being deterministic and legible — the DST property a CI matrix source needs —
  not for being optimal.
- **That the charts pass at HA.** This prices and packs. Whether a chart is
  actually Synced+Healthy with replicas on is what the lanes would then go and
  find out, and is the entire point of running them.

---

## 7. Pointers

- `src/Core.TypeScript/cluster/lane-partition.ts` — `priceTwoTier`,
  `packBalanced`, `utilizationOf`, `METAL_FIRST_BOOT_BASE`
- `docs/research/2026-09-09-lane-audit-under-the-metal-fidelity-criterion.md` —
  the environment axis (k3s+Cilium is metal's pair), and the concurrency figure
- `docs/research/2026-09-10-packages-and-test-lanes-are-one-axis-the-fixed-lane-cost-bounds-how-finely-you-should-split.md`
  — the `p > F/(2F+S)` stopping rule and the measured `F`
- `full-ai-cluster/k8s/bootstrap/` — the first-boot set the base is derived from
