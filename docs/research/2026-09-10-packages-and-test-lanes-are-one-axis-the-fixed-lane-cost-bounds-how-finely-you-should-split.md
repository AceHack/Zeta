# Packages and test lanes are one axis; the fixed lane cost bounds how finely you should split; and the boundary should be derived from co-change, not from the directory tree

**Work item:** 081M26NHRM9087G0R0029WZGHS · **Date:** 2026-09-10
**Register:** the constants in §2 are `metered` (measured today, from one gate run's per-step timings). The decision rule in §3 is arithmetic over those constants. The co-change proposal in §4 is `toy` — nothing is built.

---

## 0. The objective, in Aaron's words

> *"number of packages vs number of test lanes — this is what we are always trying to minimize over time. we want to test all our ideas, but in the minimal number of path filters and reorganization."*

And, earlier the same day, on the repo split:

> *"we want to try to split based on best variables."*

Those are the same question, and this document argues they are the same *object*.

---

## 1. A path filter is a soft package boundary; a package is a hard path filter

Both declare exactly one thing: **which files can affect which consumers.**

| | declares | enforced by | cost per boundary |
|---|---|---|---|
| **path filter** | files → checks | a `if:` condition in YAML | one lane's fixed setup |
| **package / repo** | files → dependents | dependency resolution | a version, a release, a resolution step, a treaty surface |

They differ in **hardness** and in **what the fixed cost is denominated in** — not in kind. A package boundary is a path filter that the build system enforces instead of a workflow author; a path filter is a package boundary you get to have without paying for a release.

**So "packages vs lanes" is one axis in two currencies, and the quantity to minimise is the total number of BOUNDARIES**, subject to still covering the test space. That is a set-cover problem, not a philosophy.

It also explains why the multirepo debate never resolves by argument. Splitting a repo is *buying a hard boundary at a high fixed price*; adding a path filter is *renting a soft one cheaply*. Both answer "what can this change affect?" — so the honest question is never *"mono or multi"* but **"what is the cheapest boundary that answers this, and is it worth its fixed cost?"**

---

## 2. The constant that decides it, measured today

From gate run `34532486225` (PR #17264 — a telemetry flush of four files), per-step timings:

| lane | fixed setup **F** | scan **S** |
|---|---:|---:|
| `lint (C#)` | 60s (35 checkout + 17 cache + 2 apt + 25 toolchain) | 70s |
| `lint (Rust)` | 55s | 56s |
| `lint (semgrep)` | 67s | 64s |

**Every lane carries a fixed cost of roughly 55–67 seconds that does not shrink with the diff.** That is the whole reason this is an optimisation and not a preference: if `F` were zero, you would split forever and skip everything.

Whole run, for scale: **76 jobs, 3,409 CPU-seconds, 267s wall-clock** — on a diff of two JSON shards and two markdown files.

---

## 3. The stopping rule

Take one lane with fixed cost `F` and scan `S` that today always runs. Split it into two lanes, each with the same fixed cost and half the scan, each now skippable with probability `p`. Splitting pays when:

```
(1 − p) · (2F + S)   <   F + S
⟺        p           >   F / (2F + S)
```

With today's numbers (`F ≈ 60s`, `S ≈ 126s` for the two halves together):

> **p > 60 / (120 + 126) ≈ 0.24**

**A finer boundary is worth its fixed cost only if it lets each half skip more than about a quarter of the time.** Below that, splitting makes the average change *slower*, and the tidier structure is a cost dressed as an improvement.

Two consequences worth stating plainly:

- **`F` is the brake on granularity, for lanes and packages alike.** A repo split has a much larger `F` — a release, a version, a resolution step, and one more surface on which the four-oracle treaty can drift — so the skip probability required to justify it is correspondingly higher. That is the quantitative form of *"this is getting ridiculous."*
- **Lowering `F` is worth more than splitting.** Cutting the 60s setup in half changes the threshold to ~0.14 and makes a whole class of splits worth doing that are not worth doing today. **Cache and toolchain work is boundary-creating work**, which is not how it usually gets prioritised.

---

## 4. "Split on the best variables" — derive the boundary from co-change

The directory tree is a boundary someone chose once, for reasons that may no longer hold. The **co-change graph is measured**: which files actually change together, over the repository's real history.

That gives the ranking the objective needs. For a candidate boundary `B`:

> **expected saving = P(a change touches only one side of B) × (F + S) of the lanes B would let you skip**

and boundaries are worth taking in that order until the §3 threshold stops paying. Files that always change together belong on the same side; files that never co-change are a candidate boundary the tree may not currently reflect.

**This is the abstraction-agent loop again, and deliberately so.** Propose candidate boundaries (variables), prune the ones that never discriminate (a boundary no change ever respects is a constant column) and the ones that duplicate another (two boundaries with the same co-change partition are one boundary), then let a **solver** decide: replay the last N months of merged PRs against the candidate and count what would actually have been skipped. That is a falsifier with a real negative available — a proposed split whose replay saves nothing is refuted, before anyone moves a file.

**Register: `toy`.** No co-change matrix has been computed here, and the replay harness does not exist. What today establishes is only that the inputs are all present — `git log`, the lane roster, and the measured `F` and `S`.

**Honest limits, before anyone builds it:**
- Co-change is **historical**, so it encodes yesterday's coupling. A boundary derived from it is a bet that the coupling persists, and it will be wrong exactly where the architecture is changing fastest — which is where you most want it right.
- **Correlated co-change is not causal coupling.** Two files edited together by one agent in one session is one observation, not evidence of a dependency (`rhoIcc` 0.549/0.628, `effectiveCount` **1.43 from N=3** — the fleet's own measured correlation). Deduplicating by session and by author is required before the counts mean anything.
- The replay measures *skips*, never *correctness*. A split that skips more and also stops catching a real defect is a loss the objective cannot see, which is why §3's rule is a floor on cost and never a sufficient reason.

---

## 5. Anchors (Beacon)

The core claim here is fifty years old and worth citing rather than re-deriving.

- **Parnas (1972), *On the Criteria To Be Used in Decomposing Systems into Modules*** — decompose by **what changes together** (information hiding), never by the flowchart. Aaron's *"split based on best variables"* is this paper's thesis, and §4 is its measurable form.
- **Baldwin & Clark (2000), *Design Rules: The Power of Modularity***, and Steward (1981) on the **Design Structure Matrix** — modular boundaries as options with a purchase price. The `F` in §3 is that price.
- **Gall, Hajek & Jazayeri (1998)** on logical coupling; **Zimmermann, Weißgerber, Diehl & Zeller (2004), *Mining Version Histories to Guide Software Changes*** — co-change mined from version control as the empirical dependency signal, which is exactly §4's input.
- **Conway (1968)** — the boundary you ship is the boundary your organisation already has; relevant here because the fleet's agents are the organisation.

---

## Pointers

- `src/Core.TypeScript/ci/path-domains.ts` — soft boundaries, declared and falsified
- `docs/research/2026-09-10-a-failure-taxonomy-...md` — what a lane must be able to SAY for a skip to be distinguishable from an outage
- `docs/research/2026-09-10-reduce-bash-history-to-zero-...md` — the same "rank by the right variable" move applied to CLI verbs
- `docs/research/2026-09-10-abstraction-agent-elicits-variables-not-weights-...md` — the propose/prune/solve loop §4 instantiates
- `.claude/rules/dv2-data-split-discipline-activated.md` — DV2.0 partitions by **change rate**, which is co-change under another name
