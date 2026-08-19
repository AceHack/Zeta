# Repo-split round 2: the change-rate partition is measured, and the first cut is not the one the ADR drew

Status: **design**, built on **measured** churn. Every quantitative claim below
carries its command and its window so it can be re-run and falsified; every
non-measured claim is labelled `toy` or `unmetered` per
[`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md).

Measurement basis: `origin/main` at `d59cd4a2` (2026-08-19 17:04 UTC), clone
taken fresh this round. Two windows are used throughout — **90d**
(`--since=2026-05-21`, 9,183 commits) and **30d** (`--since=2026-07-21`, 3,672
commits) — because a single window cannot distinguish a standing rate from a
two-week spike, and one of the findings below turns on exactly that distinction.

---

## 0. What is already settled, so this round adds rather than repeats

Four prior artifacts own ground this doc does not re-take.

| Prior art | What it settled | Register |
|---|---|---|
| `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md` | The **concept** cut: Zeta (product) / Forge (factory) / ace (package manager). Peer repos, **not** submodules, because the three form a dependency **cycle** and submodules assume a DAG. `.forge-version` pin + `repository_dispatch` as the interim glue. 4-stage migration. | **Proposed**, never advanced past Stage 0 |
| `081KRFA460008QG0R001H98EXJ` (Stage 1) | Full day-one scaffolding, `tools/scaffold/create-repo.ts`, dry-run verified 2026-05-14 (12 planned operations per repo), `workflow_dispatch` apply gate | `status: open` — **the `--apply` was never run** |
| `081KRFA460008QG0R0007RWSN1` (Axis 2) | Mirror/Beacon as an **orthogonal** split axis; decomposed into 4 child rows | all 4 children `status: open` |
| `081KRFA460008QG0R000VKJF0H` (Axis 3) | Code/English + formal-verification sub-axis; **the ruleset-divergence smell test**; decomposed into 5 child rows | 1 child closed (prior-art audit), 4 open |
| PR #12179 (2026-08-18) | **Service** decomposition, authority tiers A0-A6, and the transferable theorem below | merged |

Two facts from that table are load-bearing and neither is a criticism.

**MEASURED — the split has not started.** `gh repo list Lucent-Financial-Group`
today returns Zeta, `lucent-financial-group.github.io`, civsim, lfg-ascend,
lucent-ksk, lucent-infrastructure, lucent-documentation, lucent-frontend,
lucent-user-service, lucent-api-gateway. **`Forge` and `ace` do not exist.**
Stage 1 has been one `workflow_dispatch` away since 2026-05-14. Ninety-eight
days of planning sits on top of an un-executed create step. That is the honest
starting position, and it is *why* this round is worth running: the design was
drawn in April against an April tree, and the tree has changed shape since in a
way that moves the first cut.

**The transferable theorem from #12179.** That doc is about services, not repos,
and this one does not re-enter it. But it proved one thing at the process layer
that transfers verbatim to the repository layer:

> **A seam that is not an isolation boundary is not a seam; it is a drawing of
> one.** Two tiers co-resident in the same OS user *are the same tier*.

The repo-layer form, which this doc adopts as its discriminator:

> **Two directories that always change in the same commit are the same repo.**
> Splitting them does not create a boundary; it creates a distributed
> transaction wearing a boundary's clothes.

That is what makes the split question **measurable** rather than tasteful, and
it is the same move #12179 made: replace an inherited assumption with a
measurement. What follows is the measurement.

---

## 1. DV2.0 applied to the actual tree — the change-rate partition, measured

[`dv2-data-split-discipline-activated.md`](../../.claude/rules/dv2-data-split-discipline-activated.md)
says partition substrate by **change rate**: hubs (stable keys), links
(relationships), satellites (fast-changing attributes). Aaron's own recorded
intuition is that DV2.0 is the source of the repo-split smell. So the first job
is to stop guessing at change rates and fold them.

### 1.1 The discriminator that matters is not rate — it is re-touch

Command (90d):

```
git log origin/main --since=2026-05-21 --name-only --format='%n__C__' | <fold>
```

| Directory | touches | distinct files | files re-touched | touches/file | **re-touch %** |
|---|---|---|---|---|---|
| `docs/history` | 12,609 | 8,545 | 3,069 | 1.48 | 36 |
| `docs/github` | 8,680 | 8,572 | 4 | 1.01 | **0** |
| `src/Core.TypeScript` | 7,023 | 2,932 | 2,024 | 2.40 | 69 |
| `docs/backlog` | 5,227 | 2,289 | 1,550 | 2.28 | 68 |
| `docs/observe-events` | 3,347 | 2,728 | 5 | 1.23 | **0** |
| `data` | 3,319 | 1,046 | 11 | 3.17 | **1** |
| `docs/research` | 3,132 | 1,591 | 801 | 1.97 | 50 |
| `memory` | 2,869 | 1,638 | 665 | 1.75 | 41 |
| `tests` | 2,751 | 1,144 | 488 | 2.40 | 43 |
| `tools` | 1,692 | 669 | 359 | 2.53 | 54 |
| `src/Core` (F#) | 1,611 | 467 | 267 | 3.45 | 57 |
| `.claude` | 1,576 | 953 | 504 | 1.65 | 53 |
| `docs/(root files)` | 982 | 93 | 57 | 10.56 | 61 |
| `docs/hygiene-history` | 801 | 729 | 66 | 1.10 | 9 |
| `.github` | 690 | 79 | 72 | 8.73 | **91** |
| `docs/drift-events` | 252 | 248 | 1 | 1.02 | **0** |
| `docs/trajectories` | 330 | 69 | 61 | 4.78 | 88 |

**The finding: raw churn rate is the wrong DV2.0 axis for this tree, and
re-touch percentage is the right one.** `docs/history` and `.github` have
churn rates a factor of six apart and would sort to opposite ends of a
rate-ordered list — but they are not the same *kind* of thing at all, and the
re-touch column says so immediately. Three classes fall out cleanly with no
threshold-fitting:

- **Accretion** (re-touch ~0%): written once, never revisited. `docs/github`
  (0%), `docs/observe-events` (0%), `docs/drift-events` (0%), `data` (1%),
  `docs/hygiene-history` (9%). These grow monotonically; the "change rate" of
  any individual file is **zero**.
- **Working substrate** (re-touch 40-70%): `src/Core.TypeScript`, `src/Core`,
  `tests`, `tools`, `docs/research`, `docs/backlog`, `memory`, `.claude`.
- **Hot hubs** (re-touch >75%, few files, high rate): `.github` (91% of 79
  files), `docs/trajectories` (88% of 69), root markdown (76% of 59).

That third class is exactly DV2.0's **hub**: small, stable-keyed, edited
constantly. The first class is the **satellite** in its purest form. The middle
is where links and satellites are tangled together, and it is where a naive cut
would do damage.

**Register note.** The three-class partition is `metered`: the re-touch column
is the falsifier and it separates the classes without a tuned threshold (the
gaps are 9%→36% and 69%→88%). The *naming* of the classes is `unmetered` — it
is a description, not a prediction.

### 1.2 Size: two thirds of this repo is machine-written and never read back by a human

| Directory | files | KB |
|---|---|---|
| `docs/history` | 8,573 | 17,304 |
| `docs/github` | 8,572 | 14,288 |
| `docs/observe-events` | 2,728 | 11,064 |
| `docs/hygiene-history` | 1,313 | 7,404 |
| `docs/pr-discussions` | 921 | 6,516 |
| `docs/recovered-orphan-branches-2026-05` | 207 | 2,684 |
| `data` | 1,045 | 4,616 |
| **machine-written subtotal** | **23,607** | **~62 MB** |
| `src` | 3,416 | 60,732 |
| `memory` | 1,950 | 40,332 |
| `docs/research` | 1,756 | 28,648 |
| `tests` | 1,123 | 8,540 |
| `agentic-organization` | 648 | 8,152 |
| `.claude` | 471 | 5,000 |
| **total tracked** | **37,577** | — |

`.git` is 237 MB; `size-pack` 224.38 MiB; worktree 584 MB. **63% of tracked
files are machine-written accretion.** `docs/` alone is 26,459 of 37,577 files,
and 22,562 of those 26,459 (85%) are the accretion class.

This is not a theoretical cost. It is **already measured in the repo**, by
another agent, in `src/Core.TypeScript/hygiene/audit-cluster-tree-consumers.ts`:

> MEASURED 2026-08-17 on this repo: the first implementation filtered only in JS
> and took **17.4 s wall**, because `docs/history/`, `docs/pr-discussions/` and
> `docs/github/` are most of the tracked files (35,122 total, 15,711 after
> exclusions) and every one of them was read and scanned just to be discarded.
> With the pathspec: **0.9 s wall** warm. A 17 s gate step is one nobody keeps.

That is a 19x cost on one gate step, paid by the presence of the archive, and
already worked around by hand in one tool. `git grep -l "git ls-files\|readdirSync"`
over `src/Core.TypeScript/{hygiene,lint}` returns **68 scripts** that walk the
tracked tree. Each one either pays that cost or carries its own hand-maintained
exclusion list — which is the same defect at 68 sites.

---

## 2. The commit stream is now majority machine-written

The change-rate table describes files. The thing a repo boundary actually
governs is **commits**, so fold those too.

Grouping commits by which class of path they touch (a commit is "pure machine"
when *every* path it touches is in the accretion class):

| window | commits | pure-machine | share | mixed |
|---|---|---|---|---|
| 90d (`--since=2026-05-21`) | 9,183 | 2,281 | **25%** | 376 (4%) |
| 30d (`--since=2026-07-21`) | 3,672 | 1,872 | **51%** | 348 (9%) |
| 7d (`--since=2026-08-12`) | 1,903 | 987 | **52%** | 300 (16%) |

**Half of everything landing on `main` today is a machine appending to a log.**
That is a change in the repo's nature since the April ADR, and the ADR could not
have accounted for it because `docs/github/`, `docs/observe-events/` and
`data/tick-shards/` did not exist in their current form then.

**Honest caveat, and it is a real one.** The cold-archive component is
concentrated in the last two weeks:

```
weekly commits touching docs/{history,github,pr-discussions,recovered-*}
W21 22 · W22 105 · W23 4 · W24 3 · W25 2 · W27 15 · W28 1 · W33 312 · W34 414
```

Two consecutive weeks at 312 and 414 is a **sustained lane**, not a one-shot
backfill — `pr-archive-on-merge.yml` writes on every merge, so the rate is
structurally tied to merge volume. But **two weeks is not a trend**, and the
claim "the repo is now majority machine-written" is therefore `consistent with`
the data and **not** established. Re-run the fold in three weeks; if W35-W37
hold above 250/week, it promotes.

---

## 3. Logical coupling: which candidate repos actually change together

Co-change is the classic empirical test for a module boundary (Gall, Hajek &
Jazayeri, *Detection of Logical Coupling*, ICSM 1998; Ball & Eick's earlier
change-history visualisations). It answers the question the discriminator in §0
asks: **do these two directories always change in the same commit?**

Groups: `PRODUCT` = `src/**` (non-TS) + `tests` + `bench` + `clis` + `gen` +
`db` + `vocab` + `universal` + `shapes` + `schemas` + `models`; `FACTORY` =
`src/Core.TypeScript` + `tools` + `.github` + `.claude` + `hooks` + `githooks` +
`scripts`; `COLD-ARCHIVE` = `docs/{history,github,pr-discussions,recovered-*}`;
`HOT-LOG` = `docs/{observe-events,drift-events,hygiene-history}`; `TELEMETRY` =
`data/**`; `ENGLISH` = `docs/{research,books,letters,craft,pitch,agendas,governance,design}`;
`BACKLOG` = `docs/backlog` + `workitems` + `docs/trajectories` + `docs/handoffs`;
`CLUSTER` = `full-ai-cluster` + `cluster` + `infra` + `infrastructure` +
`machines` + `network` + `dns`; `MEMORY` = `memory/**`; `REST` = everything else
under `docs/` and root.

### 90d (9,183 commits)

| group | commits | solo | **solo %** |
|---|---|---|---|
| ENGLISH | 2,203 | 1,455 | 66 |
| FACTORY | 1,946 | 931 | 48 |
| PRODUCT | 1,807 | 756 | 42 |
| REST | 1,489 | 471 | 32 |
| BACKLOG | 1,390 | 375 | 27 |
| TELEMETRY | 1,163 | 705 | 61 |
| HOT-LOG | 1,138 | 471 | 41 |
| **COLD-ARCHIVE** | **878** | **786** | **90** |
| MEMORY | 511 | 336 | 66 |
| CLUSTER | 237 | 120 | 51 |
| AGENTIC-ORG | 66 | 49 | 74 |

### 30d (3,672 commits) — the columns that move

| group | commits | solo % (30d) | solo % (90d) |
|---|---|---|---|
| **COLD-ARCHIVE** | 726 | **90** | **90** |
| TELEMETRY | 984 | 54 | 61 |
| ENGLISH | 489 | 54 | 66 |
| FACTORY | 737 | 44 | 48 |
| HOT-LOG | 1,030 | 36 | 41 |
| PRODUCT | 585 | **16** | 42 |
| MEMORY | 22 | 9 | 66 |

Top coupled pairs (90d, count / %ofA / %ofB):

| pair | count | %ofA | %ofB |
|---|---|---|---|
| HOT-LOG x TELEMETRY | 446 | 39 | 38 |
| HOT-LOG x PRODUCT | 321 | 28 | 18 |
| **FACTORY x PRODUCT** | **305** | **16** | **17** |
| ENGLISH x FACTORY | 274 | 12 | 14 |
| ENGLISH x PRODUCT | 259 | 12 | 14 |
| COLD-ARCHIVE x PRODUCT | 76 | 9 | 4 |
| COLD-ARCHIVE x HOT-LOG | 76 | 9 | 7 |

**Four results, and two of them contradict the intuition ordering in the
2026-05-13 work items.**

1. **`COLD-ARCHIVE` is 90% solo in both windows.** It is the most independent
   group in the tree by a wide margin, and its independence is *stable across
   windows* — the one group whose number does not move. Nothing else comes close.

2. **`PRODUCT`'s apparent independence collapses under the 30d window: 42% → 16%.**
   That looked alarming until decomposed. The cause is `HOT-LOG x PRODUCT`:
   of the 324 commits touching both an archive-class path and product code,
   **323 are `docs/observe-events`**. The society's proposal-gated commit path
   writes an observe-event on essentially every product commit
   (`src/Core.TypeScript/planning/proposal-gated-commit.ts`). So
   `docs/observe-events` is **not an archive at all** — it is running state,
   written synchronously with the work. Grouping it with `docs/history` was my
   first cut and it was wrong; the re-touch column hid it (both read 0%) and
   only the co-change fold exposed it. **An append-only file store is not
   automatically a satellite.** `docs/history` is cold (written at merge, read
   only by its own tooling); `docs/observe-events` is hot (written by the actor
   loop, on the product's critical path). They differ by *who writes them and
   when*, not by their access pattern.

3. **`FACTORY x PRODUCT` is 16%/17% at 90d and 15%/19% at 30d — stable.** This
   is the price of the ADR's headline Zeta/Forge cut, and it is now a number
   rather than an argument: **roughly one commit in six on either side would
   become a cross-repo pair.** Not fatal, not free.

4. **`ENGLISH` is the largest single group (2,203 commits) and 66%/54% solo.**
   Axis 3 (code vs English) has more empirical support than Axis 1 by solo
   rate — but see §5, because it also has a cheaper alternative already shipped.

---

## 4. The ruleset-divergence smell test, actually run

Work item `081KRHWGX0008QG0R000BS8Y4R` (GitHub ruleset divergence audit) has been
`status: open` since 2026-05-14. It is cheap. Run:

```
gh api repos/Lucent-Financial-Group/Zeta/rulesets
```

| id | name | target ref | rules | bypass |
|---|---|---|---|---|
| 16189060 | Branch Safety | `~DEFAULT_BRANCH` | `deletion`, `non_fast_forward` | none |
| 16134995 | CI Gate | `~DEFAULT_BRANCH` | `required_status_checks` | `RepositoryRole` |
| 15256879 | Default | `~DEFAULT_BRANCH` | (none) | none |
| 16934633 | **Heartbeat Branch Protection** | **`refs/heads/heartbeat/*`** | `deletion` | none |
| 19490341 | Code Quality Copilot review | `~DEFAULT_BRANCH` | — | *disabled* |

**MEASURED: the ruleset-divergence signal fires exactly once in this repo, and
it fires on the telemetry lane.** Four of five rulesets govern the default
branch. The one ref-scoped divergence is `heartbeat/*`, and it is *weaker* —
deletion protection only, no required status checks.

That divergence is not cosmetic; `CLAUDE.md` records the mechanism that forced it:

> telemetry lanes no longer push to `main` (ruleset "CI Gate" requires
> `gate (required)` at push time, no bypass actors), they park on `heartbeat/*`
> and flush via PR.

So the repo already contains **one worked instance of Aaron's own smell test**:
a class of writes whose rate is incompatible with the code lane's gate, which
was resolved by giving it a different ref namespace and a different ruleset.
Under the smell test as Aaron stated it — *"if they need different rulesets in
github its likely a smell for a different repo split"* — the branch-namespace
workaround is the smell, and the split is the thing the smell points at.

**Register: `consistent with`, not `is`.** One divergence is a single data
point, and a branch-scoped ruleset is not the same object as a repo-scoped one.
What is established is that (a) the divergence exists, (b) it is on the
telemetry/archive axis and nowhere else, and (c) it converges with the 90%-solo
and 51%-of-commits findings from independent folds. Three independent
measurements pointing at the same cut is the strongest signal in this document
— and per
[`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md)
I am obliged to ask whether they are three confirmations or one thing in three
costumes. They are close to one: all three are downstream of "machine-written
accretion has a different write pattern than authored code." That is one
mechanism, measured three ways. It is still the best-supported cut here; it is
just not three times better supported.

---

## 5. Candidate cut-lines, each with its cost named

A cut with an unnamed cost is a preference. Each candidate below carries what it
creates, what CI has to change, and what breaks for agents.

### Cut A — `zeta-archive`: the cold merge archive (`docs/{history,github,pr-discussions,recovered-orphan-branches-2026-05}`)

**Moves:** 18,273 files, ~40.8 MB — **48.6% of tracked files** for ~4% of the
authored surface.

**Why it is first:** 90% solo in both windows; the only group whose independence
does not move between windows; the directly-measured 19x gate-step cost;
one-of-one ruleset divergence points the same way.

**Cost, named — and it is larger than the churn numbers suggest.** A classifier
run over `git grep -lI` for these paths across `src/`, `tools/`, `.github/`,
`.claude/`, with each hit read in context to separate *exclusion* references
from *consumption* references:

| path | referencing files | exclusion-only | **consuming** |
|---|---|---|---|
| `docs/history/` | 26 | 5 | **21** |
| `docs/github/` | 20 | 1 | **19** |
| `docs/pr-discussions/` | 10 | 0 | **10** |
| `docs/recovered-orphan-branches-2026-05/` | 9 | 2 | **7** |

My prior going in was that these directories would be write-only and the cut
would be nearly free. **That prior was wrong and the measurement killed it.**
The consumers are real and include four CI workflows —
`pr-archive-on-merge.yml` (writer), `pr-manifest-integrity.yml` (verifier),
`agent-heartbeat.yml`, `agent-reviewer.yml` — plus
`src/Core.TypeScript/forge-host/github/{archive-pr-reviews,consume-pr-archives,derive-pr-manifest,pr-manifest-shards,reconcile-review-archive}.ts`
and the legacy-`B-NNNN` resolution chain
(`backlog/b-ref-resolve.ts` resolves refs *into* the archive; `b-ref-scope.ts`
exempts it from policing).

So the cut is not free. What it is, is **cleanly bounded**: every consumer is in
one subsystem (`forge-host/github/` plus the backlog id-resolver), and every
consumer is **factory** code, not product code. On the ADR's own Zeta/Forge
sorting rule the archive and its readers land on the *same* side — Forge. That
is the argument for Cut A being the first move rather than a later one: it does
not cross the Zeta/Forge line, so it can be taken *before* that line is drawn.

**CI change:** `pr-archive-on-merge.yml` must push to a second repo (a token
scoped to `zeta-archive` with `contents:write`), and `pr-manifest-integrity.yml`
must check out two repos. `b-ref-resolve.ts` needs the archive present to
resolve legacy ids — either as a second checkout in the jobs that run it, or the
lint accepts unresolvable-into-archive refs, which weakens it.

**What breaks for agents:** an agent that greps for a prior PR's review body no
longer finds it in its own clone. That is a genuine capability loss and it is
the strongest argument *against* Cut A — the archive exists so that agents can
read what was said. Mitigation is a shallow second clone, which every agent must
now know to make. **Not measured:** how often agents actually read the archive.
That number would settle the argument and I do not have it. **This is the
falsifier for Cut A and it should be gathered before the cut, not after.**

### Cut B — `Forge` / `Zeta`, the ADR's headline cut

**Cost, named:** `FACTORY x PRODUCT` = 305 commits/90d — **16% of factory
commits, 17% of product commits become cross-repo pairs.** Stable across
windows, so this is a rate rather than an artifact.

**The sharpest cost is not churn — it is the byte-lock rendezvous.** MEASURED:
`tests/cross-verification/` holds 35 primitive directories; each contains
`vectors.yaml` plus `{ts,fsharp,cs,rust,go,python}-output.json`. Those outputs
are **committed**, and they are written by per-language suites that live in
`src/`:

```
src/Core.Rust.{TriBoolean,Blake3,Yaml,AceCanonical,Sha256,Algebra,ZetaId}/tests/cross_verify.rs
tests/Tests.FSharp/{ZetaIrV1Gen.CrossVerify,ZSetMerkle,ZSetMerkleProof.CrossVerify}.Tests.fs
src/Core.TypeScript/ace/build-graph.test.ts
```

`bun src/Core.TypeScript/ci/cross-verify-all.ts` then asserts all of them agree,
in one checkout, in one job, and **fails if any primitive dir lacks an oracle**
(assert-don't-skip).

This makes `tests/cross-verification/` a **write-shared rendezvous directory
across every language implementation** — the one place in the tree where an
atomic multi-language commit is the mechanism. Splitting language
implementations across repos converts a build-time invariant into a distributed
agreement problem. Per
[`only-the-irreducible-is-primitive`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md),
the N-oracle byte-lock **is** the error-correcting code for cross-language
drift; a split that makes the byte-lock non-atomic disables the ECC at exactly
the moment it starts being needed more.

**This does not forbid Cut B** — the ADR's Forge/Zeta line does not run through
`src/Core.*`; it runs between `src/Core.TypeScript` (factory tooling) and the
rest. But `src/Core.TypeScript/ace/build-graph.test.ts` writes into the
rendezvous, so the line as drawn does cut the byte-lock once. That one crossing
must be resolved before Cut B, not during it.

**CI change:** `.forge-version` pin + `repository_dispatch`, per the ADR. 69
workflow files exist today; the factory-owned ones move, the product-owned ones
stay, and the ~30-job `gate.yml` has to be partitioned. This is the largest CI
change of any candidate here.

**What breaks for agents:** every clone assumption in the fleet.
`.claude/skills/`, `.claude/agents/`, `.claude/rules/` move to Forge, so an
agent working on Zeta has no rules in its clone unless Forge is vendored,
submoduled, or fetched. **This is the single largest agent-facing cost in the
whole design and the ADR does not price it.** It also interacts with
`shared-checkout-is-view-only` / GOVERNANCE §35: clone-per-writer becomes
clone-per-writer-per-repo.

### Cut C — `zeta-english`: `docs/{research,books,letters}` + `memory/`

**Support:** ENGLISH is the biggest group (2,203 commits/90d) at 66%/54% solo;
MEMORY is 66% solo at 90d. Axis 3, Aaron's May framing.

**Cost, named — and it is mostly already paid.** `gate.yml` already ships a
`path-filter` job that emits `code=false` for PRs touching only
`docs/**`, `memory/**`, `openspec/**`, `.claude/**`, `data/**`, and root
markdown. **The code/English boundary already exists as a CI boundary; it is
soft, and it is shipped.** So the marginal benefit of Cut C is not "docs PRs
stop running the build" — that is already true. The marginal benefit is
narrower: repo-scoped ruleset divergence, and a smaller product clone.

The honest question for Cut C is therefore *what does a hard boundary buy that
the soft one does not*, and the answer measured today is **only ruleset
divergence** — for which §4 found no English-vs-code demand. **Cut C is
`unmetered`: no measurement currently supports it over the shipped soft
boundary.** MEMORY's 30d solo rate of 9% (on only 22 commits) is too small a
sample to read either way.

### Cut D — `agentic-organization/`

**Moves:** 648 files, 8 MB, its own `package.json`, `Dockerfile`,
`docker-compose.yml`, `tsconfig.json`. 74% solo at 90d; **4 commits in the last
30 days.**

**Cost:** near zero. **Value:** also near zero — it is dormant. Worth doing as a
tidy-up when something else is already moving; not worth a round of its own.
The one thing it *does* buy is a rehearsal: a real second repo, real
cross-repo CI, at 648 files instead of 18,273.

### Not a cut — `docs/observe-events`, `docs/drift-events`, `data/`

Named explicitly so a later round does not re-propose it. `HOT-LOG x PRODUCT` =
321 commits, 323/324 of the archive-product coupling. These are written
synchronously with product work by `proposal-gated-commit.ts` and the drift
lane. Splitting them makes an ordinary product commit a two-repo transaction.
They stay.

The apparent counter-argument — that `data/` and the heartbeat lanes already
park off `main` — is the *branch* workaround from §4, not evidence for a repo
cut. `TELEMETRY x HOT-LOG` = 446 (39%/38%): telemetry and the hot logs move
together, and both touch product. If telemetry ever splits, it splits *with*
the hot log, and only after the writers stop being on the product's commit path.

---

## 6. Discipline check, and the one §1 problem found

| # | Discipline | Reading on this design |
|---|---|---|
| 1 | **Scale-free** | **Problem found — see below.** |
| 2 | Lock/wait-free | The byte-lock rendezvous (§5, Cut B) is the one place where a split introduces coordination on shared mutable state. Named, not solved. |
| 3 | Weight-free | A repo boundary is a permanent authority surface (who may merge where). Cut A's archive repo grants no authority anyone does not already have — its writer is a workflow. Cut B *does* create authority weight: Forge governs the rules Zeta obeys. |
| 4 | DST | Determinism is unaffected by repo topology **except** through the byte-lock: replay across four oracles requires all four at one revision. A split needs a version-pin that is itself part of the replayed state. |
| 5 | DV2.0 | §1 — and the correction that re-touch, not rate, is the operative axis for this tree. |
| 6 | Idempotency | The archive lanes are append-only and content-keyed, so a cross-repo push retries safely. This is why Cut A is mechanically the easiest to make correct. |
| 7 | Noninterference | Each cut adds a declared channel (`.forge-version`, a dispatch, a second checkout). That is *more* metered than an implicit in-tree dependency, provided the channel is declared. An undeclared cross-repo read at runtime would be an ambient leak. |

### The §1 problem, stated plainly

The ADR's connection mechanism has two stages, and the second one is a
manifesto §1 violation as currently written:

> **ace as eventual mediation layer.** Once `ace` ships, the version-file +
> dispatch pattern is replaced by `ace pull forge@<version>` and
> `ace pull zeta@<version>`.

**If `ace` becomes the only path by which repos resolve each other, `ace` is an
appointed hub.** Per
[`itron-hub-patent-boundary-p2p-is-the-upgrade`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md),
the defect is *appointment*, not concentration, and the discriminator is
**exit**:

- Can a repo be consumed without `ace` — plain `git clone` at a tag? Then `ace`
  is an **oracle**: deference freely chosen, however popular it becomes.
- Must resolution route through `ace`? Then `ace` is a **hub** in the strict
  sense, and "we wrote it ourselves" is no comfort. Hirschman: where exit is
  absent, the concentration holds you.

**The design requirement this yields, and it is cheap if adopted now:**
`.forge-version` (or its successor) must remain a **sufficient** resolution
mechanism forever, not a transitional one. `ace` may be the good path; it must
never be the only path. A test that clones each repo at a pinned tag with no
`ace` present and builds is the falsifier. Stated now because it costs nothing
before `ace` exists and is very expensive after.

Note this does *not* touch the ADR's Ouroboros framing, which is about
bootstrapping, not mediation. Ouroboros is fine; mandatory mediation is not.

**A second, smaller §1 note.** Cut B makes Forge the repo that governs how every
other repo is worked on. That is a designated authority, which is §3 weight, not
§1 — but it is the same shape one level down. The mitigation is the same:
Zeta must remain buildable and contributable with no Forge checkout present.

---

## 7. What this round adds, stated so it can be checked

1. The change-rate partition is **measured** on the real tree, and the operative
   DV2.0 axis for this tree is **re-touch percentage**, not churn rate. (§1)
2. `docs/observe-events` is **not** an archive; it is running state on the
   product's commit path. Grouping it with `docs/history` by access pattern is a
   trap that only co-change exposes. (§3)
3. The cold merge archive is **48.6% of tracked files and 90% solo in both
   windows** — the most independent group in the tree, and the only one whose
   independence is window-stable. (§1-3)
4. The Forge/Zeta cut price is a number now: **~1 commit in 6.** (§3)
5. The **ruleset-divergence audit** (`081KRHWGX0008QG0R000BS8Y4R`, open since
   2026-05-14) is run: one divergence, on the telemetry lane. (§4)
6. The archive's consumers are **real and bounded** — 57 consuming files, all in
   `forge-host/github/` and the backlog id-resolver, all factory-side. My "the
   archive is write-only" prior was wrong and is recorded as wrong. (§5)
7. The byte-lock rendezvous is named as the sharpest constraint on any
   `src/`-crossing cut. (§5)
8. The `ace`-as-mandatory-mediator §1 problem is named while it is still free to
   fix. (§6)

---

## 8. The decision, as a question with options

Aaron: **which cut is taken first, and is it taken at all this quarter?**

The measured position is that Cut A is the best-supported by a wide margin and
Cut B is the one the ADR is written for. Those are not the same answer, and I am
not collapsing them into a recommendation.

**Option 1 — Take Cut A first (`zeta-archive`), leave Zeta/Forge for later.**

- *Buys:* 48.6% of tracked files leave the working clone; the 19x gate-step cost
  and the 68 hand-maintained exclusion sites stop growing; a real second repo
  exists to learn cross-repo CI on, at low stakes.
- *Costs:* four workflows change; 57 consuming files need a resolution path;
  agents lose in-clone grep over prior PR reviews unless they take a second
  clone. That last cost is **unmeasured** and is the reason this is a question.
- *Does not touch* the ADR's Zeta/Forge line, so nothing is foreclosed.

**Option 2 — Execute ADR Stage 1 as written (create `Forge` + `ace` empty).**

- *Buys:* unblocks the 98-day-old plan; the scaffolding is built, dry-run
  verified, one `workflow_dispatch` away.
- *Costs:* creates two repos with nothing in them and no forcing function to
  fill them — the same state that has held since May, now with more surface to
  keep green. Stage 2 (the content move) is where the 1-in-6 cross-repo commit
  rate and the whole-fleet clone-assumption change land, and neither is priced.
- *Note:* repo creation is irreversible-ish and is a gated class under
  `no-directives.md`. This one is genuinely Aaron's.

**Option 3 — Take neither; harden the soft boundaries instead.**

- *Buys:* `path-filter` already gives the code/English separation; the archive
  exclusion could be centralised once (one shared `SKIP_DIR_PREFIXES`, already
  half-built in `b-ref-scope.ts`) instead of 68 times; zero cross-repo cost.
- *Costs:* does nothing about clone size (584 MB worktree, 237 MB `.git`), and
  the ruleset divergence stays a branch-namespace workaround. The accretion rate
  compounds — if the 51%-of-commits figure holds, this option gets worse monthly.
- *This is the honest do-nothing-yet option and it is not obviously wrong.*

**Option 4 — Measure the one number that would settle Option 1, then decide.**

- The open question under Cut A is how often agents read `docs/history/` and
  `docs/github/`. That is measurable: instrument or sample the reads, or simply
  ask the fleet.
- *Buys:* turns the only unmeasured cost in the best-supported cut into a
  measured one. Costs a few days.
- *Costs:* a few days, during which the archive grows by ~2,000 files at the
  current rate.

**One thing I would flag as needing a decision regardless of the above:** the
`ace`-as-mandatory-mediator §1 requirement in §6. It costs nothing to adopt now
("`.forge-version` stays sufficient forever") and is expensive to retrofit. It
does not depend on which cut is taken.

---

## Pointers

- `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md` — the concept cut, Stage 0, still `Proposed`
- `docs/backlog/P1/081KRFA460008QG0R001H98EXJ-*` — Stage 1, scaffolding built, `--apply` never run
- `docs/backlog/P1/081KRFA460008QG0R0007RWSN1-*` (Axis 2 Mirror/Beacon) · `081KRFA460008QG0R000VKJF0H-*` (Axis 3 code/English + ruleset smell) — the two orthogonal axes; §4 above discharges the ruleset half of Axis 3
- `docs/research/2026-08-18-the-pre-k8s-layer-is-the-recovery-plane-*.md` (PR #12179) — the service-layer sibling; source of the "a seam that is not an isolation boundary is not a seam" theorem this doc transposes to repositories
- [`dv2-data-split-discipline-activated.md`](../../.claude/rules/dv2-data-split-discipline-activated.md) — the change-rate lens; §1 above is its application, including the correction that re-touch is the operative axis here
- [`itron-hub-patent-boundary-p2p-is-the-upgrade.md`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md) — appointed vs emergent hub, exit as the discriminator; §6's §1 finding
- [`only-the-irreducible-is-primitive-generate-the-rest.md`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md) — the generator IS the ECC; why the byte-lock rendezvous constrains any `src/`-crossing cut
- [`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md) — §4's independence check on three converging measurements
- `src/Core.TypeScript/hygiene/audit-cluster-tree-consumers.ts` — the in-repo 17.4s→0.9s measurement
- `src/Core.TypeScript/ci/cross-verify-all.ts` + `tests/cross-verification/` — the byte-lock rendezvous
- `.github/workflows/gate.yml` `path-filter` — the shipped soft code/English boundary
- **Anchors (Beacon).** Logical coupling from change history: Gall, Hajek & Jazayeri, *Detection of Logical Coupling Based on Product Release History* (ICSM 1998); Ball, Kim, Porter & Siy, *If Your Version Control System Could Talk* (ICSE '97 workshop) — co-change as the empirical test for a module boundary, which is what §3 runs. Modular decomposition by change-locus: Parnas, *On the Criteria To Be Used in Decomposing Systems into Modules* (CACM 1972) — decompose by what changes together, not by flowchart, which is the same claim DV2.0 makes about storage. Exit as the discipline on concentration: Hirschman, *Exit, Voice, and Loyalty* (1970) — §6. Failure-domain independence: Gray, *Why Do Computers Stop* (Tandem TR 85.7, 1985).
