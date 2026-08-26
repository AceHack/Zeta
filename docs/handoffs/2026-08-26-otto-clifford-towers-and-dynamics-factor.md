# Handoff — Clifford towers, the ledger's dynamics factor, and what is open

**From:** otto (Claude Code session, remote container), 2026-08-26
**Branch:** `claude/tender-hawking-xmcs6m` (reset to `main` after the PR merged — nothing unmerged on it)
**Landed:** PR [#15565](https://github.com/Lucent-Financial-Group/Zeta/pull/15565) → `68666ec66`, and PR [#15517](https://github.com/Lucent-Financial-Group/Zeta/pull/15517) → `13a80fa70`

Read this top-to-bottom before picking anything up. §6 is the part that will save you the most
time — it is the list of things that bit me.

---

## 1. What landed

### PR #15517 — the pr-archive lane

`pr-archive-on-merge` was failing **8 of 30 runs (~27%)**, each a silently undelivered archive
record. Three defects in one path, all in `prepare`, which **all twelve telemetry lanes** call:

1. **The missing `+`.** A lane buffer is a *disposable aggregate* — every flush does
   `checkout -B staging- origin/main` and republishes, so the ref is **rewritten**. Without `+`
   git refuses the non-fast-forward update, and failure becomes conditional on another PR
   flushing in the window. That is the interleaved ~27% shape.
2. **`--quiet` hid the reason.** It suppresses the ref-update report, the only place
   `! [rejected] (non-fast-forward)` appears. Eight failures printed an empty error.
3. **The 5-attempt retry never retried.** `prepare` was unguarded under `set -euo pipefail`.

**Verified after merge:** 18/18 runs succeeded, with the contention condition present — nine
started within 120 s of the previous, tightest gap **3 seconds** (tighter than the 29 s that
produced the original observed failure). `P(18 straight | 27%) = 0.0038`. Row
`081M0X93WA4087G0R0034C1A5Q` closed with that measurement.

### PR #15565 — Clifford towers + the dynamics factor

**Q4 of the Clifford-GPU hold is discharged.** The question was whether CGA is a distinct
algebra from the in-tree `Cl3` or composes with it. It composes:

```
CGA(3D) = Cl(4,1) ≅ M₂(Cl(3,0))
```

Same Atiyah–Bott–Shapiro clock position `s=3`, same ground field ℂ, one suspension step apart
(`Cl(p+1,q+1) ≅ M₂(Cl(p,q))`). **The in-tree `Cl3.fs` is the entry type of the matrix CGA is
built from** — none of that work is wasted.

Following the maintainer's Clifford-in-AI landscape then extended it to the whole tower
question. GATr (Qualcomm) uses a **16-dimensional projective** algebra — `Cl(3,0,1)`, which is
**degenerate** — and the repo had *zero* coverage of it (`CliffordPeriodicity.fs` takes `(p,q)`;
there is no `r`; `PGA` appeared nowhere in `src/`). Closing that gap gave:

| tower | construction | dim | semisimple quotient |
|---|---|---|---|
| VGA(3D) | `Cl(3,0)` itself | 8 | **M₂(ℂ)** |
| **PGA(3D) — GATr** | `Cl(3,0) ⊗ Λ(ℝ¹)` | **16** | **M₂(ℂ)** |
| CGA(3D) | `M₂(Cl(3,0))` | 32 | M₄(ℂ) |

**All three are built over the in-tree `Cl(3,0)`, so the tower choice is not yet forced.** What
has to be decided is which *geometric primitives* you need — points-and-planes with cheap rigid
motions (PGA) vs spheres and dilations as first-class blades (CGA) — not which algebra to build.
`dim Cl(3,0,1) = 16` is *predicted* by the structure theorem and matches GATr's published number
independently.

**The dynamics factor.** `TravelerRankLedger.fs` implements TrueSkill's ADF update and its own
docstring pins "σ² is strictly decreasing with each observation" — and **nothing ever widened it
again**. A belief whose observations stopped arriving became *permanently confident*: a traveler
who performed well and went silent stayed maximally trusted forever. Added `age` /
`ticksUntilUninformative`:

```
decay      value  ← value · k        the ESTIMATE moves toward the prior
dynamics   σ²     ← σ² + τ²·Δt       the UNCERTAINTY widens; the estimate does not
```

Decay says the world reverted; dynamics says *I stopped watching*. Because μ is untouched, a
stale record keeps its **direction** and one confirming observation restores it. Aging drives
`trustBand` toward 0.5 **from both sides without crossing**.

Plus: three ARC agent fixes (decaying suppression, greedy consulting `blocked`, a self-refuting
occupancy map), the reservoir-walls geometry result, and CI wiring.

---

## 2. Open work items — the actual to-do list

| id | what | blocked? |
|---|---|---|
| `081M0R18878087G0R001XY5A2J` | **The Clifford-GPU hold.** Q4 discharged; **Q1/Q2/Q3/Q5 still open.** No GPU code, lowering, classifier or measurement until the math team returns. | — (it *is* the block) |
| `081M0YQBZ1X087G0R0010TX512` | Extend `CliffordPeriodicity.fs` to `Cl(p,q,r)` in **F#**. TS has it; the authority does not, so the two have diverged — and the golden vector is generated from the side that is now behind. | not blocked |
| `081M0YNJ7G5087G0R003QWNWRB` | Re-express `MultilayerBnn` onto `FactorGraph` so BNN layers compose as a **DAG**. | not blocked |
| `081M0YNJ7HE087G0R0028M33JX` | `ThousandBrains.fs` columns believe about **scalars, not locations** — the seam spatial belief attaches to. | **blocked on Q3** |
| `081M0YSD5VA087G0R000W2Q9QW` | Replace the ARC agent's three hardcoded decay constants with TrueSkill dynamics. **Must measure before/after.** | not blocked |

**Q3 is the one that gates the interesting work**: *can a Normal-Gamma posterior be exhibited as
a region in a conceptual space under a named metric, with a stated approximation error?* Without
that error budget, embedding a belief as a point is unfalsifiable — no amount of tower
classification changes it.

### The cheapest next experiment, if you want one

From `081M0YNJ7HE087G0R0028M33JX`: before committing to any geometry, make a `ThousandBrains`
column's belief a **vector of Gaussians over a named frame** and measure whether lateral voting
over vector beliefs beats scalar voting on ARC or the twitch-ai arena. If it does not help there,
the Clifford question is moot for this use case. That is a day, not a quarter.

---

## 3. Standing constraints — do not violate these

- **The Clifford-GPU hold is real.** The maintainer routed it to a math team deliberately:
  *"we should route this to math team first, then we code after they have us some solid
  theoretical formal analysis."* Architectural primacy is not epistemic primacy.
- **ARC API key** lives at `op://Lucent/ARCPrize API Key/credential` and is **not reachable from
  the container**. Human-only path:
  `op read "op://Lucent/ARCPrize API Key/credential" | gh secret set ARC_API_KEY --repo Lucent-Financial-Group/Zeta`.
  Never hardcode, echo, or commit it. The ARC lane must degrade to OFFLINE when absent, never fail.
- **`references/prior-art/`** is gitignored, gigabytes, and NOT our code. Explicit-target `rg`
  only; an unconstrained `grep -r` is a 2-hour runaway.
- **Never put a model identifier** in commit messages, PR titles/bodies, code comments, or any
  pushed artifact.
- **Force-push is a gated class** (`.claude/rules/no-directives.md`) — needs fresh human
  authorization each time. It was granted once today, for one specific reword.

---

## 4. Register discipline, applied

Per `.claude/rules/toy-is-free-metered-must-be-earned.md`, what is actually established:

| claim | register |
|---|---|
| ABS table, `Cl(4,1) ≅ M₂(Cl(3,0))`, `dim Cl(p,q,r)`, `Σ(6−k)F_k = 12`, `P(x)·P(y) = −½\|x−y\|²` | **metered** — falsifiers + two cross-oracle golden vectors |
| KL-1978 = 0.5990; the eight surveyed GA/AI papers | **cited, not checked** — a roster, not evidence |
| CGA/PGA being right *for our BNN use case* | **toy** — no falsifier exists; Q3 would produce one |
| reservoir capacity ≡ spherical code | **toy** — and note `grep -ril reservoir src/` finds **no reservoir implementation** to measure |

**Two coincidences explicitly labelled as such**, per `numerology-vs-number-theory.md`:

- `HexCore.fs` has 12 edges; the curvature budget is 12. Equal **at the cube and nowhere else**.
- **PGA's 16 vs the adinkra's 8 bosons + 8 fermions.** The maintainer asked directly. `Cl(3,0,1)`
  *does* split 8+8 by grade parity — but so does **every** 4-generator signature, and there are
  ≥7 distinct 16s in play. **Valence discriminates**: the [8,4,4] adinkra is 8-regular (64
  edges), the `Cl(3,0,1)` blade graph is 4-regular (32 edges). And the exponents differ in
  provenance — `2⁴` where 4 = generator count, vs `2^(N−k)` where 4 = code quotient rank, vs
  `2^(n/2)`. **Three different fours. Different 16s.**

On sphere packing: `lim LP_d^(1/d) = √(e/2π)` is exact, so it is a **ceiling on the method** —
worth ~0.5% of the exponent and invisible below d≈100. It is a limitation theorem, not a speedup.

---

## 5. Where things are

```
src/Core/CliffordPeriodicity.fs                    the ABS clock (metered); NO `r` — see the F# row
src/Core/Cl3.fs                                    the in-tree algebra; entry type of all three towers
src/Core/TravelerRankLedger.fs                     §"Dynamics factor (staleness)" — age / ticksUntilUninformative
tests/Tests.FSharp/TravelerRankLedger.Tests.fs     TRL-34..41; TRL-36/37 are the load-bearing pair
src/Core.TypeScript/research/conformal-embedding-and-curvature-budget.{ts,test.ts}
                                                   30 falsifiers + classifyDegenerate + Cl(3,0) product
src/Core.TypeScript/research/testdata/             two golden vectors + their .fsx generators
src/Bayesian/{FactorGraph,MultilayerBnn,ThousandBrains,MinimalBnn}.fs
                                                   FactorGraph is already a general DAG engine
src/Arc.Python/zeta_arc/agent.py                   LAYER_DECAY / EVIDENCE_DECAY / INERT_DECAY live here
docs/research/2026-08-26-*                         four docs from today
```

**`FactorGraph.fs` is already a general sum-product engine over arbitrary topology**, generic in
the message algebra. `MultilayerBnn` is a hand-rolled chain whose own docstring names
`FactorGraph.runToFixpointDamped` as the upgrade path. The DAG ask is mostly re-expression, not
new architecture.

**Can a multivector be a message?** `IMessage<'M>` needs `Uniform`/`Product`/`Divide`. The
geometric product gives the first two. `Divide` **cannot be total** — in `Cl(3,0)`,
`(1+e₁)(1−e₁) = 0` with both factors non-zero — so it forces the carrier to the **invertible**
multivectors, i.e. the Clifford **group**. That lands exactly where the literature is ("Clifford
*Group* Equivariant"), derived from our interface rather than copied from theirs.

---

## 6. Gotchas — the list that will save you time

**Trailer / CI:**

- `Human-Review-Evidence` is an **enum** (`chat | pr-review | pr-comment | signed-policy | none`).
  I wrote free prose into 13 commits. `validateBlock` catches it instantly.
- `Accountable-Party` and `Authority-Basis` **do not reconcile** — they must be unanimous across
  a squash. `Human-Review` / `Action-Mode` *do*, to the weakest claim.
- **Validate the squash preimage, not just the PR body:**
  `git log --format=%B --reverse origin/main..HEAD` → `detectBlockDisagreement`. Validating only
  the body passed while the commits were red.
- `gate` runs on **PRs only**. A step wired into `gate.yml` never executes on branch pushes.
- Research tests under `src/Core.TypeScript/research/` are **not** auto-discovered — wire them
  into `gate.yml` explicitly or they never run. `#14914` measured that an unrun test reads
  exactly like a passing one. Three siblings are still in that state:
  `gromov-hyperbolicity`, `belief-manifold-curvature-sybil`, `causal-order-minkowski-embedding`.

**Git:**

- `if git push ... | tail -2; then` tests **tail's** exit status, not git's — a check that cannot
  fail. Use `git push ...; rc=$?`.
- **A rebase drops merge commits — including fixes made *in* them.** A ruff repair I made during
  a merge vanished when I later rebased. After converting a merge to a rebase, **re-run every
  linter**, not just the gates you think of.
- GitHub deletes the branch on merge, leaving a stale `origin/...` ref. `--force-with-lease` then
  refuses with "stale info" — correctly. `git fetch --prune` first.

**Toolchain:**

- `bash tools/setup/install.sh` gives dotnet 10.0.400 at
  `/root/.local/share/mise/dotnet-root` (set `DOTNET_ROOT` and PATH).
- `CliffordPeriodicity.fs` is self-contained under `dotnet fsi`; **`Cl3.fs` is not**
  (`AlgebraInterfaces` → `IGroup` → …). Build the project and `#r` the DLL.
- `bunx <tool>` can rewrite `bun.lock` and mutate `node_modules`, producing local lint failures
  that do not exist in CI. Check against a clean worktree before believing one.
- **Never run overlapping background jobs that mutate the same file.** I did, and got a break-red
  reporting 41/41 *with a mutation in place* — the compile raced the edit. Discarded and re-ran
  synchronously. A green you cannot attribute to a known source is not evidence.

**Process:**

- **Mint work-item ids before writing them anywhere.** I wrote a well-formed ZetaId into a doc
  before minting it — a key that passes a shape check and identifies nothing, which is the exact
  failure `.claude/rules/never-assume-malice-where-mistake-is-possible.md` documents.
  `bun src/Core.TypeScript/backlog/new-workitem.ts --type task --title "..."`.
- **`main` goes red sometimes and it is not always yours.** My PR inherited a `tsc` failure from
  `57b2d149f`. Check `origin/main` on a clean worktree before assuming. Someone had already
  opened the fix (#15578) — do not duplicate an in-flight repair.

---

## 7. Known-open, not mine to close

- **The repair writer.** `agent-heartbeat`'s soraya archive duty has stopped landing;
  `manifest.jsonl` runs behind the shards and the workflow still reports success because the
  derive step is `|| echo "::warning::..."`. PRs #15471/#15511 were hand-repairs. Flagged
  deliberately, not touched.
- **5 Dependabot vulnerabilities** on the default branch (3 high, 2 moderate).
- **ARC scores 0 on the hosted environments.** The bootstrap trap and the oscillation are fixed
  (ZetaPocket 1→2 of 2 levels, `distinct_grids` 16→29, ZetaChase env score 0.3375→0.354), but the
  goal model is still the open question.

---

## 8. If you read one thing

`docs/research/2026-08-26-all-three-geometric-algebra-towers-reduce-to-the-in-tree-cl30-so-the-choice-is-not-yet-forced.md`
— it carries the tower table, the survey roster, and the register split.

Then `docs/research/2026-08-26-a-decay-constant-is-an-unobservable-a-dynamics-factor-is-a-claim-about-the-world.md`
for the τ argument, which generalises well beyond the ledger.

The through-line of both, and the thing worth keeping: **the win was never that a number got
better — it was that an unjustifiable choice became one somebody can argue about.** τ has units.
A tower choice reduces to which primitives you need. Both replace "tuned until it looked right"
with a claim that can be wrong.
