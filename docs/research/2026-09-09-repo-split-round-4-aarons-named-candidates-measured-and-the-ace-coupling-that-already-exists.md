# Repo split round 4 — Aaron's named candidates, measured; and the `ace` coupling that already exists

**Work item:** `081M24G5RHW087G0R000QAV588`
**Status:** measurement + recommendation. **Nothing has moved. No repo has been created.**
**Basis:** fresh clone of `Lucent-Financial-Group/Zeta` at `origin/main` `12170c610c` (2026-09-10T01:50:25Z).
68,266 tracked files · worktree 1,164,304 KiB (≈1.14 GiB) · `.git` 416,308 KiB · `size-pack` **394.77 MiB**.
**Author:** shadow. **Register:** every claim below carries its own; unproven models are marked `toy`.

---

## §0 Why there is a round 4, and what it is *not*

Aaron, 2026-09-09:

> *"we need a lot of research on our repo split this is getting ridiculous we are going to have to do that
> sooner than later"*

and he named the candidates himself: **the agent meta-harness** (with the ability to call out to other
harnesses and run multi-agent workflows — *"seems like one of the most important things to split out"*),
**k8s infra + helm charts**, **USB / zflash / hardware**, **zetadb** and **zetafs**, and **`ace`** as the
shared package manager — *"it would be nice if our ace package manager was reusable across all these too."*

Rounds 2 and 3 are thorough and this round does not re-derive them. But note what they measured:
`zeta-archive`, `Forge`/`Zeta`, `zeta-english`, `agentic-organization`, `zeta-formal`, `zeta-wasm`,
`zeta-core`, `zeta-web`, `zeta-cluster`, the Rust tier. **Not one of Aaron's six named candidates has ever
been measured as a boundary.** The 2026-09-06 DRAFT decision adds a language axis and a `zeta-treaty`, and
also does not price them.

So round 4's job is narrow and specific: **price the boundaries Aaron actually named, on the axes rounds 2
and 3 established, and answer the `ace` exit question he raised by naming `ace` as the shared dependency.**

Two debts from earlier rounds are discharged in passing (§4.3, §7).

**The headline, stated first because it is a negative result and burying it would be dishonest:**

> **On every cost axis measured — CI wall-clock, clone bytes, and crossing edges — Aaron's six named
> candidates are small. All five code candidates together are ≈5.0% of gate runner-seconds and 3.3% of
> clone bytes. Meanwhile a candidate nobody has named, `docs/research`, is 36.8% of clone bytes and cuts
> with 3 edges and no cycle.**

That does not make the named cuts wrong. It means **they must be argued on reuse, not on relief** — and §8
takes that argument seriously, because it is a real argument and it is the one Aaron actually made.

---

## §1 Method, and what it cannot see

Two committed, re-runnable measurement tools ship with this document. Prose rots; a script does not.

```bash
bun src/Core.TypeScript/research/repo-split-cut-cost.ts            # the dependency half
bun src/Core.TypeScript/research/repo-split-cut-cost.ts --cycles   # + the witness edges
bun src/Core.TypeScript/research/repo-split-change-rate.ts --since 90   # the DV2.0 half
```

**`repo-split-cut-cost.ts`** builds a **file-level** dependency graph — TypeScript relative imports
(static, dynamic and `require`), MSBuild `<ProjectReference>`, Cargo `path =` — projects it onto a
candidate component assignment, and reports per component: files, internal edges, out-edges, in-edges, and
the **per-pair crossing counts with cyclic pairs marked**. It found **7,567 static edges**.

A pair with edges in **both** directions is a cycle at the proposed repo boundary. **A boundary with a
cycle is not a boundary** — it is a distributed transaction wearing a boundary's clothes, and the ADR of
2026-04-22 already refused submodules for exactly this reason ("a DAG literally cannot express a cycle").
So the cut cost of a candidate is not one number; it is *(what it needs published)* + *(the back-edges that
must be broken first)*, and the second is the one that decides the order.

**`repo-split-change-rate.ts`** folds `git log --no-merges --name-only` over a window onto the *same*
component assignment, so the two halves are directly comparable, and reports commits, **solo** commits
(touch this component and nothing else), files, re-touch rate, and pairwise logical coupling
(Gall, Hajek & Jazayeri, ICSM 1998 — round 2's discriminator).

### What these tools cannot see, stated so nobody over-reads a zero

1. **Only three edge kinds are read.** Coupling that travels by `Bun.spawn`, shell-out, a hardcoded file
   path, HTTP, or a documented convention is **invisible and counted nowhere**. Every "0 out-edges" below
   means *zero static edges of the three kinds measured*, never "independent." §7 is a live instance: the
   heaviest `ace` coupling in the repo is a shell variable, and no import graph would ever have found it.
2. **There is no Lean / TLA+ / Alloy / Agda import extractor.** `formal`'s cut of 0 is therefore
   `consistent with` acyclic, not established as acyclic.
3. **Bare specifiers are ignored** (npm packages, `#`-imports). Only relative and repo-rooted specifiers
   become edges.
4. **Squash-merge means one commit per PR.** "Solo %" is measured at PR granularity. That is the right unit
   for a repo split — a PR is the thing that would have to become two PRs — but it is not authoring intent.
5. **The CI attribution in §5 is a judgement**, applied by a rule printed in full, not a measurement. The
   runner-seconds are measured; which bucket a job belongs to is argued.

**A worked instance of limit 1, found in this document's own tooling.** The first commit of
`repo-split-cut-cost.ts` carried **five raw NUL bytes** — a pair-key separator written as a byte instead of
the escape. `rg` and `grep` treat a file containing NUL as binary and report `binary file matches` with exit
0, so **the tool that measures this repository would itself have been silently skipped by every text audit
in it.** It was caught by `audit-no-raw-nul-in-source.ts` in the gate, fixed to `\u0000` (byte-identical at
runtime), and the re-run reproduced every figure in this document unchanged. Recorded because it is the
exact failure class §1 is warning about, arriving uninvited in the paragraph that warns about it.

---

## §2 The cut-cost table — every candidate, at its cheapest boundary

The first boundary you draw is a guess. The right method is to draw it, read the crossing histogram, and
let the histogram tell you where the boundary actually is. Every row below is the **cheapest variant found**
for that candidate after that sweep; the sweep itself is in §3.

| candidate | boundary that minimises the cut | files | internal | OUT | IN | **cut** | cyclic? |
|---|---|---:|---:|---:|---:|---:|---|
| **`docs/research`** *(unnamed by anyone)* | `docs/research/` | 12,019 | 0 | 3 | 0 | **3** | **acyclic** |
| **`formal`** | Lean + TLA + Alloy + Agda + `tools/tla` | 177 | 0 | 0 | 0 | **0** | acyclic¹ |
| **`archive`** *(round 2's Cut A)* | history + github + pr-discussions + recovered | 29,761 | 0 | 0 | 0 | **0** | acyclic |
| **`zetafs`** | `dag-fs/` + `experiments/zetafs-webdav/` | **4** | 0 | 1 | 0 | **1** | acyclic |
| **`k8s`** *(narrow)* | `full-ai-cluster/` only | 395 | 115 | 3 | 1 | **4** | cyclic (1 edge) |
| **`zetadb`** | `zetadb/` only | **12** | 21 | 7 | 28 | **35** | cyclic |
| **`ace`** | `ace/` only | 114 | 227 | 25 | 36 | **61** | cyclic |
| **`zflash`** | `zflash` + `installer` + `pam` + `ci` | 247 | 298 | 56 | 12 | **68** | cyclic |
| **`k8s`** *(as Aaron scoped it)* | `full-ai-cluster` + `infra` + `infrastructure` + `cluster` | 561 | 321 | 19 | 62 | **81** | cyclic |
| **`meta-harness`** | the narrow 14-directory set (§3.1) | 205 | 265 | 67 | 38 | **105** | cyclic |

¹ `formal`'s zero is `consistent with` acyclic, not established — see §1 limit 2.

**Read the table as a ranking of cut cost and it says something uncomfortable: Aaron's top-priority
candidate is the most expensive cut in the repo, and the cheapest cut in the repo is one nobody proposed.**

`zetafs` deserves its own sentence. **It is four files.** `src/Core.TypeScript/dag-fs/` plus
`experiments/zetafs-webdav/`, one out-edge (`ZetaFsWebDav.fsproj → src/Core/Core.fsproj`), one commit in
90 days. **There is nothing to split.** That is the honest negative result, and the number is 4.

---

## §3 The boundary sweep — where each candidate's real edge actually is

### §3.1 The meta-harness: the narrow definition wins, and adding anything makes it worse

Aaron's description — *"the ability to call out to OTHER harnesses and run multi-agent workflows"* — points
at a concrete surface: `src/Core.TypeScript/model-backend/` (`provider-roster`, `codex-oauth`,
`openai-auth`, `github-auth`, `login-ladder`, `subscription-chat`, `zeta-agent-loop`, `tool-calls`,
`manus-task`) plus the loop machinery around it. Five boundaries were measured:

| variant | files | internal | OUT | IN | **cut** |
|---|---:|---:|---:|---:|---:|
| **A: narrow** — model-backend, agent-loops, harny, orchestrator(+checks), swarm(+society), workflow-engine, bg, lanes, peer-call, agent-bus, routines, SwarmRunner | 205 | 265 | 67 | 38 | **105** |
| B: A + `corporate/` | 324 | 917 | 99 | 23 | 122 |
| C: B + `observe/` | 563 | 1,337 | 164 | 69 | 233 |
| D: C + `tick-dial` + `ferry-throttler` | 591 | 1,392 | 176 | 73 | 249 |
| E: D + `agent-heartbeats` + `forge-host` + `shadow` + `claude-hooks` + `cursor` | 709 | 1,541 | 182 | 70 | 252 |

**The cut grows monotonically. A is the boundary.** Variant B is the instructive one: absorbing `corporate/`
removes 15 back-edges (38 → 23) and adds 32 forward-edges (67 → 99). Net worse. That is the general shape of
this repo — pulling a consumer inside to kill a back-edge drags its own closure with it.

**What variant A would need published — 67 out-edges, and they concentrate:**

| count | target |
|---:|---|
| 17 | `zeta-id/` |
| 14 | `bus/` |
| 7 | `observe/` |
| 7 | `chip8/` |
| 3 | `discovery/` |
| 2 each | `g-set`, `service`, `identity`, `arc-solver`, `bayesian`, `accelerator`, `shard-store` |
| 1 each | `collation`, `search`, `ace`, `tri-boolean`, `dora-classify` |

**31 of 67 (46%) go to two modules: `zeta-id` and `bus`.** That is the shared kernel a `zeta-harness` repo
would consume, and it is small and nameable — which matters for §7, because it is also the answer to "what
would `ace` actually have to publish."

**The 38 back-edges that block the cut, by cluster** (all 38 are enumerated by `--cycles`):

| cluster | edges | the fix |
|---|---:|---|
| `corporate/` → `workflow-engine/agent-loop/{state-machine,menu-generator,state-store,cli,work-lifecycle-state-machine}` | **13** | either invert (the loop publishes an interface `corporate` implements) or accept `corporate` moves too — but variant B prices that at +17 net |
| `observe/` → `{workflow-engine/types, peer-call/summon, model-backend/*}` | **11** | `observe/udp-lossy-loop.test.ts` alone is 7 of them, and it is a **test** — tests travel with the subject, so 7 of 11 dissolve by moving one file |
| `tools/setup/manus-smoke-test.ts` → `model-backend/{manus-task,backend}` | **2** | **the load-bearing one** — a bootstrap surface depending on the harness. Same class as §7 |
| `forge-host/github/gh-cli.ts` → `model-backend/{login-runner,resolve-stored-token}` | 2 | token resolution; a published interface |
| `tick-dial/tick-dial.test.ts` → `model-backend/{duplex,multiplexed-duplex}-transport` | 2 | test |
| `ferry-throttler/mux-transport-bridge.ts` → `model-backend/multiplexed-duplex-transport` | 1 | |
| `algebra/wset-four-corner-trace.ts` → `workflow-engine/types` | 1 | type-only |
| `arc-solver/arc-harness.ts` → `swarm/swarm-controller` | 1 | |
| `apps/twitch-ai/src/swarm.worker.ts` → `swarm/swarm-controller` | 1 | |
| `docs/books/you-born-at-the-hinge/scripts/translate_book.ts` → `peer-call/summon` | 1 | |

**Named blockers, in the order they must be broken: `corporate/` (13), `observe/udp-lossy-loop.test.ts` (7),
`tools/setup/manus-smoke-test.ts` (2).** Those three account for 22 of 38.

### §3.2 k8s + helm: the helm half is empty, and the two names hide two different repos

**Measured: this repository contains exactly 2 `Chart.yaml` files, both under
`examples/helm-dependency-graph/charts/`, which is a test fixture. `full-ai-cluster/`, `infra/` and
`infrastructure/` contain zero.** This independently reproduces the 2026-09-06 draft's finding (37 charts in
the cluster tree are third-party/upstream-pinned; the repo owns two, both fixtures) from a different
direction, and it means **"k8s infra + helm charts" is one candidate, not two — there are no charts of ours
to move.**

The cluster candidate splits cleanly in two, and the split matters:

| boundary | files | OUT | IN | cut |
|---|---:|---:|---:|---:|
| `full-ai-cluster/` alone | 395 | **3** | **1** | **4** |
| `src/Core.TypeScript/cluster/` alone | 145 | 18 | 63 | 81 |
| both + `infra` + `infrastructure` | 561 | 19 | 62 | 81 |
| all of the above + `agentic-organization/` | 1,211 | 23 | 62 | 85 |

**`full-ai-cluster/` is a 395-file component with a cut of four.** All four edges, by name:

```
OUT  full-ai-cluster/k8s/tests/render-first-boot-charts.ts -> src/Core.TypeScript/cluster/declared-cluster-trees.ts
OUT  full-ai-cluster/k8s/tests/validate-applications.ts    -> src/Core.TypeScript/cluster/manual-sync-policy.ts
OUT  full-ai-cluster/tools/flash-usb-windows.ts            -> src/Core.TypeScript/zflash/size-bounds.ts
IN   .design-sync/tailwind.ds.config.mjs                   -> full-ai-cluster/portal/web/tailwind.config.js
```

**That is the entire coupling of the deployment tree to the rest of the repo: two test files, one Windows
flash helper, and a Tailwind config.** It is the cheapest non-trivial code cut measured anywhere in this
repo — an order of magnitude cheaper than the boundary Aaron sketched, because the expensive half is
`src/Core.TypeScript/cluster/` (81 crossings), which is *chart-linting and cluster-assertion code that
belongs with the hygiene tier*, not with the deployment manifests.

**So "split k8s" resolves into: `full-ai-cluster/` moves (cut 4); `src/Core.TypeScript/cluster/` stays.**
And the third OUT edge is worth flagging: `full-ai-cluster/tools/flash-usb-windows.ts → zflash/size-bounds.ts`
means **the k8s candidate and the USB candidate overlap** — `full-ai-cluster/usb-nixos-installer/` (8 files)
is hardware-stack material sitting inside the cluster tree. Whichever cut goes first must claim it explicitly.

`full-ai-cluster/` by content: 130 yaml · 81 nix · 77 ts · 29 md · 27 tsx · 15 json · 5 go. By subtree:
`k8s/` 150 · `nixos/` 99 · `portal/` 72 · `platform-controller/` 20 · `tools/` 17 · `dev-cluster/` 10 ·
`orleans-silo/` 9 · `usb-nixos-installer/` 8.

### §3.3 zflash / USB / hardware: adding the consumer *lowers* the cut

| boundary | files | OUT | IN | cut |
|---|---:|---:|---:|---:|
| `zflash/` | 77 | 48 | 11 | 59 |
| + `installer/` | 147 | 62 | 21 | 83 |
| + `installer` + `pam` | 149 | 60 | 23 | 83 |
| **+ `installer` + `pam` + `ci`** | **247** | **56** | **12** | **68** |
| + all of the above + `full-ai-cluster/usb-nixos-installer/` | 255 | 56 | 12 | 68 |

The unusual row is the fourth: **adding `src/Core.TypeScript/ci/` reduces the cut from 83 to 68.** `ci/` holds
the QEMU boot harness (`qemu-boot-test`, `qemu-full-install-test`, `ovmf-firmware`, `qemu-first-session-phase3`)
which exists to test the installer — 14 of the earlier `rest → zflash` back-edges were `ci/ → zflash`, and
they vanish when the test harness travels with its subject. That is the general rule appearing again: **a
consumer that exists only to test the component belongs inside the component**, and the graph says so
numerically.

The remaining 12 back-edges, by name:

```
full-ai-cluster/tools/flash-usb-windows.ts                 -> zflash/size-bounds.ts
src/Core.TypeScript/hygiene/cli-fail-closed.test.ts        -> zflash/flash-usb-windows.ts
src/Core.TypeScript/hygiene/audit-linter-coverage-...ts    -> ci/cross-verify-roster.ts
src/Core.TypeScript/observe/first-session-executor.ts      -> ci/identity-auth-provider.ts
src/Core.TypeScript/observe/first-session-executor.ts      -> installer/zeta-creds-manifest.ts
src/Core.TypeScript/observe/first-session-run.ts           -> ci/identity-auth-provider.ts
tools/setup/persona-keys/biometric.ts                      -> pam/auth-chain.ts
tools/setup/touchid-sudo-config.ts                         -> pam/auth-chain.ts
tools/setup/persona-keys/plan-setup-from-frost.ts          -> installer/bao-elf-capture.ts   (×4 incl. tests)
```

**Six of twelve originate in `tools/setup/`** — the bootstrap surface again (§7). This is now the third
candidate whose blocking edges land there, which is itself the finding: **`tools/setup/` is the repo's real
hub, and no split plan currently treats it as one.**

The 56 out-edges are dominated by `cluster/` (27), `tools/setup/` (12), `zeta-id/` (6), `ace/` (3),
`identity/` (3), `privilege/` (4) — so a `zeta-flash` repo would need `zeta-id`, `privilege`, `identity`,
and the cluster's seal/PKCS#11 surface published, in addition to whatever `tools/setup` becomes.

### §3.4 zetadb and zetafs: neither is ready, and the numbers say so plainly

| boundary | files | OUT | IN | cut |
|---|---:|---:|---:|---:|
| `zetadb/` | **12** | 7 | 28 | 35 |
| + `browser-node/` | 119 | 70 | 95 | 165 |
| + `browser-node` + `persistence/` | 124 | 55 | 98 | 153 |
| + those + `darkhall-ui/` | 157 | 53 | 38 | 91 |

`src/Core.TypeScript/zetadb/` is **twelve files**, 85 commits in 90 days, 0.4 MiB of clone bytes. Its 28
back-edges are all `browser-node/*.ts → zetadb/zeta-db-node.ts`, and its 7 out-edges go to
`persistence/revision-policy.ts` (5) and `browser-node` (2). So `zetadb` and `browser-node` are **mutually
recursive**: 22 edges in and 2 out between exactly those two directories. They are one component that has
been given two names, and the smallest honest boundary containing both costs 165 crossings.

**Verdict: `zetadb` is not a repo candidate yet — it is a 12-file façade over `browser-node`.** Splitting it
today would move a name and leave the implementation. `zetafs` is worse: **four files.**

Both of these are cases where the right answer is *not yet*, and the number is what makes that a finding
rather than an opinion.

### §3.5 `ace` itself

`src/Core.TypeScript/ace/` — 114 files, 1.4 MiB worktree, 0.5 MiB of clone bytes, 127 commits/90d, **cut 61
(25 out / 36 in)**. Its out-edges go to `yaml` (5), `blake3` (4), `collation` (3), `cluster` (3), `git` (2),
`dynamic-value` (2), `file-type-plugin` (2), `privilege` (2), `planning`, `protocol`, and one Rust crate.
Its 36 in-edges come from `tests/cross-verification` (12), `discovery` (8), `cluster` (3), `installer` (3),
`hygiene` (2), `planning` (2), `tools/setup` (2), and singles from `browser-node`, `canonical-json`,
`file-type-plugin`, `model-backend`, and the C#/F# test suites.

Adding the four-language `AceCanonical` crates/projects changes the cut by 3 (61 → 64), so they travel with
it essentially for free.

**But the static graph is not where the `ace` question lives.** See §7.

---

## §4 Change rate — the DV2.0 half

90-day window, `--no-merges`, **10,063 commits with paths**. Same component assignment as §2.

| component | commits | solo | solo % | files | touches | touches/file |
|---|---:|---:|---:|---:|---:|---:|
| telemetry (observe-events, drift-events, data, db) | 3,342 | 2,857 | **85%** | 9,051 | 25,286 | 2.79 |
| rest (the shared core) | 2,361 | 584 | 25% | 3,822 | 10,938 | 2.86 |
| english (research, books, memory, vocab, universal) | 1,954 | 1,102 | 56% | 13,196 | 16,330 | 1.24 |
| archive | 1,883 | 1,573 | **84%** | 30,318 | 60,615 | 2.00 |
| backlog (docs/backlog, workitems, agendas, openspec) | 1,342 | 194 | 14% | 3,860 | 6,869 | 1.78 |
| docs-other | 1,260 | 341 | 27% | 1,593 | 3,502 | 2.20 |
| tests | 941 | 94 | 10% | 1,019 | 2,561 | 2.51 |
| **harness** (broad) | 528 | 211 | **40%** | 1,186 | 3,021 | 2.55 |
| hygiene | 415 | 66 | 16% | 558 | 1,677 | 3.01 |
| **k8s** | 391 | 87 | **22%** | 608 | 2,138 | 3.52 |
| **zflash** | 155 | 23 | **15%** | 212 | 876 | 4.13 |
| **ace** | 127 | 8 | **6%** | 146 | 409 | 2.80 |
| formal | 110 | 30 | 27% | 362 | 735 | 2.03 |
| **zetadb** | 85 | 16 | **19%** | 131 | 534 | 4.08 |
| wasm | 31 | 7 | 23% | 67 | 174 | 2.60 |
| **zetafs** | **1** | 0 | 0% | 3 | 3 | 1.00 |

30-day window (6,415 commits) for stability: telemetry 2,512 (82% solo) · archive 1,862 (84%) · rest 1,306
(21%) · backlog 1,066 (9%) · english 771 (27%) · k8s 298 (17%) · harness 274 (25%) · zflash 110 (15%) ·
ace 90 (**3%**) · zetadb 48 (23%) · formal 34 (12%) · wasm 13 (0%).

### §4.1 What the solo column says about Aaron's candidates

Round 2's discriminator: **two directories that always change in the same commit are the same repo.** Solo %
is that discriminator inverted — the fraction of a component's PRs that would *not* have become two PRs.

- **`ace` is the worst on this axis in the entire repo: 6% solo at 90d, 3% at 30d.** Ninety-four of every
  hundred `ace` PRs also touch something else — 80% of them touch `rest`. Read literally, **the change-rate
  discipline says `ace` is not a separate repo; it is a subsystem of the core that changes with it.** This
  matters enormously for §7 and it is exactly the opposite of what "shared package manager consumed by every
  split" would predict.
- **`harness` is the best of the named candidates at 40% solo (90d) / 25% (30d)** — the only one above a
  third. On DV2.0 grounds it is the strongest of the six, which agrees with Aaron's instinct and disagrees
  with its cut cost.
- **`k8s` 22%, `zflash` 15%, `zetadb` 19%** are middling-to-poor. `zflash` in particular has the highest
  touches-per-file of any code component (4.13) with only 15% solo — it churns hard *and* rarely alone.
- **`archive` 84% and `telemetry` 85%** remain, as round 2 found, the two components that genuinely change
  by themselves. Round 2's ruling that telemetry **stays** (its writers sit on the product's commit path)
  is untouched by this round and is not relitigated.

### §4.2 Logical coupling — the pairs that matter for the named candidates

| pair | commits both | % of A | % of B |
|---|---:|---:|---:|
| `harness × rest` | 212 | 40% of harness | 9% of rest |
| `k8s × rest` | 176 | 45% of k8s | 7% of rest |
| `backlog × k8s` | 157 | 12% | 40% of k8s |
| `ace × rest` | **102** | **80% of ace** | 4% of rest |
| `docs-other × zflash` | 74 | 6% | 48% of zflash |
| `rest × zflash` | 71 | 3% | 46% of zflash |

`ace × rest = 80% of ace` is the single most coupled candidate pair in the table.

### §4.3 Debt discharged — round 2's promotion condition **fails**

Round 2 §2 recorded its own falsifier: the "majority machine-written" claim was `consistent with`, not
established, and would **promote if W35–W37 held above 250 archive-touching commits per week**. Three weeks
have passed and the re-run is due. Weekly commits touching
`docs/{history,github,pr-discussions,recovered-orphan-branches-2026-05}`, Monday-anchored:

| week of | archive commits | all commits |
|---|---:|---:|
| 2026-08-10 | 533 | 1,841 |
| 2026-08-17 | 944 | 2,586 |
| **2026-08-24 (W35)** | **171** | 1,057 |
| **2026-08-31 (W36)** | **184** | 764 |
| 2026-09-07 (W37, partial — ~2.4 of 7 days) | 30 | 181 |

**W35 = 171 and W36 = 184. Both below 250. The promotion condition is not met.** The August spike did not
persist; it was the archive backfill, not a new steady state. Round 2's claim stays `consistent with`, and
the class naming (accretion / working substrate / hot hub) stays `unmetered`.

For completeness, the accretion share re-measured on the same definition (a commit touching *only*
archive and/or telemetry paths): **90d 4,724/10,063 = 47% · 30d 3,917/6,415 = 61% · 7d 167/744 = 22%.**
The 7-day figure is the interesting one and it is the reason the promotion fails: **accretion is currently
running at less than half its 30-day rate.** Register: `metered` as counts; any trend read from three
points is `toy`.

---

## §5 CI cost attribution — and why the split is not the lever Aaron hopes

Five recent successful `gate.yml` runs (`34424993977`, `34424431481`, `34425012903`, `34424754487`,
`34424179687`), read from `repos/{owner}/{repo}/actions/runs/{id}/jobs` over REST:

**73–75 jobs per run · 6,744–8,451 runner-seconds per run · mean 7,434 s.**

Round 3 measured **25 jobs / 7,766 runner-seconds** on 2026-08-19. So in three weeks the gate went from
**25 to 73–75 jobs at roughly constant total runner-seconds** — the work was fanned out, not added.

### §5.1 Where the runner-seconds go

Bucketing rule, printed so it can be disputed: `build-and-test (*)` → dotnet core; `test (TS *)` → TS core;
`full-verify` → the union; jobs naming a chart / argocd / kubeconform / yaml-k8s → k8s; naming
flash/qemu/usb → zflash; `ace-suite` → ace; heartbeat/agencysignature/coauthor/swarm/persona → harness;
`lint (<language>)` → that language tier; remaining `lint`/`cross-verify` → hygiene.

| bucket | s/run | jobs/run | % of gate |
|---|---:|---:|---:|
| **rest — dotnet core** (`build-and-test` × 5 legs) | 2,803 | 3.8 | **37.7%** |
| **rest — TS core** (hermetic + environment) | 1,387 | 2.0 | **18.7%** |
| hygiene — `lint (*)` | 1,001 | 17.0 | 13.5% |
| hygiene — `cross-verify (*)` | 660 | 23.0 | 8.9% |
| UNION — `full-verify` | 325 | 1.0 | 4.4% |
| other | 229 | 6.0 | 3.1% |
| **k8s** | 218 | 9.0 | **2.9%** |
| language tiers (C# 2.0, Rust 1.8, F# 1.6, Py 1.4, Go 1.1, TS 1.0) | 659 | 6.0 | 8.9% |
| **harness** | 76 | 4.0 | **1.0%** |
| **ace** | 58 | 1.0 | **0.8%** |
| **zflash** | 19 | 1.0 | **0.3%** |
| **zetadb** | 0 | 0 | **0.0%** |

> **All five of Aaron's code candidates together: 371 s of 7,434 = 5.0% of gate runner-seconds.**
> **56.4% is the dotnet core plus the TypeScript suite — which no proposed cut touches.**

### §5.2 Step-level: the toolchain-install share has halved, and `Checkout` is now the split-shaped cost

Step timings for run `34424993977` (75 jobs, 8,228 step-seconds):

| step | seconds | n | % |
|---|---:|---:|---:|
| `Test` | 1,257 | 5 | 15.3% |
| `Build (0 Warning(s) / 0 Error(s) required)` | 1,202 | 5 | 14.6% |
| `Whole TypeScript suite (hermetic tier)` | 1,180 | 1 | 14.3% |
| **`Checkout`** | **955** | **71** | **11.6%** |
| `Install toolchain … (Windows)` | 670 | 5 | 8.1% |
| `Install toolchain … (GOVERNANCE §24)` | 424 | 13 | 5.2% |
| `Install toolchain … (Unix)` | 351 | 5 | 4.3% |
| `Run the audit` | 264 | 37 | 3.2% |
| `Cache install.sh outputs` | 222 | 12 | 2.7% |

**Toolchain install (all three variants) = 1,445 s of 8,228 = 17.6%.** Round 3 measured **2,830 s of
7,766 = 36%**. **The toolchain-install share has roughly halved since 2026-08-19.** Register: `metered` as a
two-point comparison; attributing the improvement to any specific change is `toy` — this round did not
instrument which change caused it.

That matters for the argument, because 36% was round 3's headline lever and it has already been halved
*without* a split.

**`Checkout` at 11.6% across 71 jobs (≈13.5 s/job) is now the one line item a repo split attacks directly**,
because checkout time is a function of repo size — and repo size is §6.

### §5.3 The honest limits of §5

- Bucketing is a judgement (§1 limit 5). A reader who reassigns `cross-verify (*)` — 23 jobs, 8.9% — to the
  candidates whose invariants those audits check would move several points around. It would not move 56.4%.
- Five runs is a small sample and they are all recent and all green. Failing runs are not represented, and
  round 3's finding that 82% of real job failures died in toolchain provisioning is **not re-measured here**;
  it is `unknown` at this basis.
- Runner-seconds is not billed cost; different runner classes cost differently. Not measured.

---

## §6 Clone bytes — the axis nobody has measured, and the largest single finding

`Checkout` is 11.6% of the gate, the shared checkout is 1.14 GiB, and `.git` grew from round 2's measured
**237 MB (2026-08-19)** to **407 MiB (2026-09-10)** — **+72% in three weeks**, with `size-pack` going
224.38 MiB → **394.77 MiB**. So "what does a clone actually cost, and who is paying it" is a real question
and no round has asked it.

Method: `git rev-list --objects HEAD | git cat-file --batch-check='%(objecttype) %(objectsize:disk) %(rest)'`,
summed per path prefix. This is **on-disk (packed) bytes of every blob reachable from HEAD** — i.e. what a
full clone transfers for file content. Total 336.7 MiB; `size-pack` reports 394.77 MiB because it also
carries trees and commits.

| component | MiB | % of blob bytes | (files, for contrast) |
|---|---:|---:|---:|
| **`docs/research`** | **123.9** | **36.8%** | 12,019 |
| `docs/` (everything else) | 45.1 | 13.4% | 2,413 |
| `formal` | 37.4 | 11.1% | 207 |
| **`archive`** (round 2's Cut A) | 35.7 | **10.6%** | 29,761 |
| telemetry | 29.1 | 8.6% | 9,126 |
| rest (shared core) | 26.4 | 7.8% | 3,843 |
| english-other (books, memory, vocab, universal) | 17.6 | 5.2% | — |
| backlog | 7.5 | 2.2% | 3,736 |
| **harness** | 4.8 | 1.4% | 1,208 |
| **k8s** | 4.8 | 1.4% | 1,211 |
| tests | 2.8 | 0.8% | 1,301 |
| **zflash** | 0.8 | 0.3% | 149 |
| **`ace`** | 0.5 | 0.1% | 124 |
| **zetadb** | 0.4 | 0.1% | 124 |

**Three findings, and the first is the important one.**

### §6.1 `docs/research` is 36.8% of the repo's clone weight and cuts with three edges

`docs/research/` holds **12,019 tracked files**, of which **8,362 are `.gz`** and only **2,364 are `.md`**.
By worktree bytes: **JSON 120.0 MiB (563 files) · gz 90.6 MiB (8,362 files) · markdown 32.2 MiB (2,364)**.
Largest individual items include `hidden-switch-results/2026-09-07/behavior-attempt-1.json` (76.2 MB),
`rendered-catch-validation/2026-09-06/behavior.json` (25.6 MB), several `custody.tar.gz` bundles, and
gzipped `Zeta.Core.dll` replay artifacts under `precision-gate-kernels/2026-09-08/`.

**Every one of those 8,362 `.gz` files arrived in 2026-09, in 13 commits.** That is where the +72% pack
growth came from.

Its cut cost is **three edges, no cycle, and they are all one script pair:**

```
docs/research/scripts/2026-08-23-arity-gap-and-false-negative.ts  -> src/Core.TypeScript/cover-acyclicity/gyo.ts
docs/research/scripts/2026-08-23-arity-gap-and-false-negative.ts  -> src/Core.TypeScript/cover-acyclicity/witness.ts
docs/research/scripts/2026-08-23-nerve-h1-vs-alpha-acyclicity.ts  -> src/Core.TypeScript/cover-acyclicity/gyo.ts
```

**Nothing in the repo imports `docs/research`. Zero in-edges.**

This is **not** a recommendation to split `docs/research` as a repo, and I want to be careful here, because
the obvious reading is wrong twice over:

1. **The prose is not the weight.** 2,364 markdown files at 32.2 MiB are the research corpus and they are
   `docs/research`'s reason to exist. The 211 MiB of JSON + gz is **machine-generated evidence** deposited
   *beside* it. The cut that pays is not "split the research repo"; it is **partition `docs/research` by
   what generated it** — prose stays, evidence artifacts go to a repo whose history is not evidence. The
   2026-09-06 DRAFT already carved exactly this rule for `zeta-index`: *"If an artifact is regenerated, its
   history is not evidence. Only its GENERATOR's history is."* That rule was written for the search index;
   it applies here with far more force and nobody has applied it.
2. **This touches `no-binary-in-proof-lineage` and I am not adjudicating it.** That rule permits
   non-verification binaries (forensic logs, reference PDFs) and permits the artifact *under test*. Custody
   tarballs and replay DLLs may well be legitimately one of those. **What is measured here is size and cut
   cost, not compliance.** Whether any of these files violate the rule is a separate question for whoever
   owns those lanes, and the charitable and almost certainly correct reading is the ordinary one: evidence
   lanes were built to be thorough, nobody was watching the pack size, and the growth is three weeks old.
   Worth stating precisely, because it is the difference between "this is fine" and "nobody has looked":
   the rule's enforcer, `src/Core.TypeScript/hygiene/audit-proof-lineage-binaries.ts`, runs green at this
   basis and reports `7 committed binary file(s) … under src/wasm-dla/bytelock/`. **It is scoped to that
   one directory.** So it is not evidence that `docs/research`'s 8,362 `.gz` files comply — it is silent
   about them, which is a different thing, and the only honest way to read a green check whose scope
   excludes the subject.

**But the number stands: the largest clone-cost item in this repository is 36.8%, is younger than a
fortnight, and is unclaimed by every split plan on file.**

### §6.2 The archive is 44% of files and 11% of bytes — a correction to round 2's framing

Round 2 named Cut A on file count (18,273 files, 48.6% of tracked). Measured by clone bytes it is
**35.7 MiB, 10.6%** — third place, behind `docs/research` and `docs/` at large. Round 2 was not wrong (its
argument was about tree-walk cost in 68 hygiene scripts, and file count is the right unit for that), but
**the archive is not the size lever, and a reader who came away thinking it was should update.** Round 3
had already said as much from the closure side ("disjoint MB it removes from everyone else = 0").

### §6.3 `zeta-formal` is 11.1% of clone bytes and 99% of that is two committed jars

`formal` = 37.4 MiB, of which:

| | MiB | n |
|---|---:|---:|
| `.jar` (`src/Core.Alloy/alloy.jar` 19.5 MiB, `src/Core.TLA/tla2tools.jar` 3.9 MiB) | **23.4** | 2 |
| `.st` (TLC state dumps from one run, `26-06-12-08-48-00.644/DbspSpec-0.st` = 8.8 MiB) | **10.1** | 2 |
| `.lean` | 0.2 | 111 |
| `.tla` | 0.1 | 50 |

**The actual formal specs are 0.3 MiB. The other 33.5 MiB is two vendored tool binaries and one
model-check's state output.** Round 3 ranked `zeta-formal` its strongest closure cut (2,977 MB / 26% of the
toolchain union); the 2026-08-26 sawtooth doc then measured it as worth **0.02 GiB of cache**. This round
adds the third number: **moving `zeta-formal` moves 0.3 MiB of specs.** All three are consistent — the value
of that cut is toolchain-union relief, and nothing else. Nobody should cite size or churn in its support.

(There is a `lint-verifier-jar-provenance.ts` in the tree, so the jars are known and governed. Their size is
still 5.9% of every clone.)

---

## §7 The `ace` question, answered against `clone-at-tag-stays-sufficient` — **the coupling already exists**

Aaron: *"it would be nice if our ace package manager was reusable across all these too."*

Round 2 §6 and round 3 §11 both flagged the risk in the future tense: *if* `ace` becomes the only path by
which repos resolve each other, it is an appointed hub, and the discriminator is **exit, not degree**. The
rule was carved (`.claude/rules/clone-at-tag-stays-sufficient.md`) and given a falsifier
(`src/Core.TypeScript/hygiene/lint-clone-at-tag-is-sufficient.ts`), whose own file states its honest limit:
the real test is *"clone repo X at tag T with no `ace` on PATH and build it"*, which cannot run until a
second repo exists.

**Measured, at this basis: the linter is green, and the coupling it was written to prevent is already
built, inside the one surface the rule names.**

```
$ bun src/Core.TypeScript/hygiene/lint-clone-at-tag-is-sufficient.ts
clone-at-tag: OK — no bootstrap surface requires `ace` to resolve dependencies (7 surface(s) scanned).
`git clone` at a pinned tag is still sufficient.
exit=0
```

And, in the same tree:

```
tools/setup/linux.sh:20   SETUP_REALIZE="$REPO_ROOT/src/Core.TypeScript/ace/setup-realize.ts"
tools/setup/linux.sh:28     bun "$SETUP_REALIZE" "$@"
tools/setup/macos.sh:21   SETUP_REALIZE="$REPO_ROOT/src/Core.TypeScript/ace/setup-realize.ts"
tools/setup/install.ps1:534   $urCode = Invoke-ToolSoft { mise exec -- bun src/Core.TypeScript/ace/setup-realize.ts from-url }
```

`realize_mechanisms()` in `linux.sh` **exits 1 if `bun` is absent** and then calls `bun "$SETUP_REALIZE"`.
It is on the critical path of the install script. **`tools/setup/` carries 37 references into
`src/Core.TypeScript/ace/`.** `tools/setup/ace-mechanism-pointers.json` maps every install mechanism —
`from-url`, `from-deb`, `from-shim`, `from-autotools-tarball`, `from-uv-{tool,venv,project}`, `from-elan`,
`from-dotnet-{global,workload}`, `from-opam-git`, `from-agda-cubical` — to a realizer under
`src/Core.TypeScript/ace/setup-realizers/` (**34 files**). `.github/workflows/low-memory.yml:206` keys the
elan cache on `hashFiles('src/Core.TypeScript/ace/setup-realizers/from-elan.ts', …)`;
`verify-ollama-pin.yml` and `agent-heartbeat.yml` both run `bun src/Core.TypeScript/ace/install-pinned-artifact.ts`.

### §7.1 Is the rule violated today? **No — and that is the whole point**

`ace/setup-realize.ts` is **in the repository**. `git clone` at a pinned tag gets it. No package manager is
present; a checked-in TypeScript file executed by `bun` is part of the clone, not a resolver you must
install first. **Clone-at-tag holds at this basis, and the linter's green light is correct about the
question it asks.**

What is *also* true:

> **Every split plan on file moves `ace` to its own repo. At the instant `ace` leaves, `tools/setup/linux.sh:20`
> becomes a cross-repo dependency of Zeta's bootstrap surface on `ace` — and clone-at-tag breaks in the same
> commit that creates the `ace` repo. The linter will still print OK, because `RESOLVER_INVOCATION` matches
> the verbs `ace pull|install|restore|resolve|fetch|sync|add|bootstrap` and the string `ace.toml`, and
> `$REPO_ROOT/src/Core.TypeScript/ace/setup-realize.ts` is none of those.**

This is the vacuity class in its ordinary form: **a check that reports green over exactly the condition it
was written to forbid.** It is not deception and nobody hid anything — the linter predates the realizer
refactor, its file *says* it is a proxy, and it *says* the surface list is deliberately narrow because a
wide net "would flag `ace`'s own suite and the CI step that tests it, which are not dependencies." That
reasoning was right when written. The tree moved underneath it. Missing context, not intent.

### §7.2 So: is `ace` an appointed hub?

Applying the discriminator — **exit, not degree**:

| question | measured answer |
|---|---|
| Can Zeta be built today with no `ace` on PATH? | **Yes.** `ace` is in the clone. Exit exists. |
| Is `ace` merely *popular* inside the tree, or *required*? | **Required.** `install.sh` fails without `setup-realize.ts`; there is no second realizer path. |
| After the split, could a consumer resolve without `ace`? | **Not on the current design.** No alternative realizer, no `ace.toml`, no `.forge-version` — neither file exists in the tree today. |
| Does the falsifier detect the required-ness? | **No.** §7.1. |

**Verdict: `ace` is not an appointed hub today, because it is in the clone. It is on a path that makes it
one the moment it leaves, and the guard cannot see the step.** That is a stronger and more actionable
statement than rounds 2 and 3 were able to make, and it is only visible because the coupling travels by a
**shell variable** — which is precisely the class of edge the import graph in §1 cannot see. The measurement
that found it was `grep`, not the tool.

### §7.3 The design that keeps exit real — and it is already the repo's own pattern

The fix does not require inventing anything. The 2026-09-06 DRAFT already reached the right answer for
`zeta-treaty` and ranked it first among four mitigations: **vendor, do not fetch.** Applied here, in order
of preference:

1. **Move the realizers to the surface that owns them.** `setup-realize.ts` and `setup-realizers/` belong in
   `tools/setup/`, not in `ace/`. Then the bootstrap surface owns its own realization, `ace` becomes an
   *optional consumer* of the same realizers rather than their home, and the split of `ace` cannot break
   the clone. **Cut cost of this move, measured: 3 of `ace`'s 25 out-edges and 3 of its 36 in-edges touch
   `setup-realizers/` — it is a nearly-free relocation today and an expensive one after the split.**
2. **If they stay in `ace`, vendor them.** Every repo whose bootstrap needs them carries a pinned copy;
   `ace` is how you *update* the copy, never how you *obtain* it. This is the "vendor the vectors" pattern
   verbatim.
3. **Any cross-repo pin must be a plain committed ref that plain `git` can follow** — a file naming
   repo + ref + commit. `ace` may be ergonomic on top of it. It may never be the thing that reads it.
4. **Teach the falsifier to see paths, not just verbs.** `RESOLVER_INVOCATION` should also refuse a
   bootstrap surface *referencing a path inside a component slated to leave the repository*. That is a
   different check with a different input (the split roster), and writing it is real work — but the current
   one cannot be patched into covering this, and pretending otherwise would be the second vacuity.
5. **The real falsifier remains what the linter's own comment says it is:** clone each repo at a tag, with
   no `ace` on PATH, and build. The 2026-09-06 DRAFT's step 4 (byte-lock passing from a pinned treaty
   checkout) is that test's first instance. **It should be run against `tools/setup` before `ace` moves,
   not after.**

### §7.4 And the change-rate axis says something inconvenient about `ace` that should be said plainly

**`ace` is 6% solo at 90 days and 3% at 30 days — the lowest in the repository. 80% of `ace` commits also
touch the shared core.** DV2.0's litmus ("can these two release independently?") answers *no* for `ace`
today, louder than for any other candidate. Whatever `ace`-as-shared-dependency becomes, the measurement
says it is **not currently a separable component**, and the thing that would make it separable is not a
repo boundary — it is the surface-declaration layer the 2026-08-20 note specified and measured as absent
(`§7.5`: of 29 gate jobs, exactly one has a derivable closure). That note's claim is the load-bearing one:

> *A surface declares WHAT it needs, as readable data. It never declares HOW to get it.*

**`ace-mechanism-pointers.json` is the inversion of that sentence**: it is a declaration that names the
executable that satisfies it. Register: this reading is `unmetered` — I have not shown that replacing the
pointers with tool-agnostic declarations would work, only that the current file names a tool where the rule
says it should name a need.

---

## §8 The reuse argument — the one case for the harness that the cost axes cannot make

Everything above prices **relief**. Aaron's actual sentence about the harness prices something else:

> *"the agent meta-harness — with the ability to call out to OTHER harnesses and run multi-agent workflows …
> seems like one of the most important things to split out."*

That is a **reuse** claim, and it must not be scored on a CI budget. The four registers, kept apart:

| register | the harness's number | verdict |
|---|---|---|
| CI relief | 1.0% of gate runner-seconds | **does not support the cut** |
| clone bytes | 4.8 MiB, 1.4% | **does not support the cut** |
| cut cost | 105 crossings, 38 back-edges | **argues against** — most expensive named candidate |
| change rate | **40% solo (90d), highest of the six** | **supports the cut** |
| reuse | not measured | **`unknown`** |

**The reuse claim is `toy` and I am marking it so rather than dressing it up.** No falsifier exists for
"another project would consume `zeta-harness`," because no other project has tried. What *would* falsify or
support it is nameable and cheap, and stating it is more useful than an opinion:

> **Falsifier for the harness-reuse claim:** stand up one consumer — anything at all — that uses the
> meta-harness *from outside this repository* and runs a multi-agent workflow across two vendor harnesses.
> If that consumer needs `zeta-id` and `bus` (the 31-of-67 kernel, §3.1) and nothing else, the cut is real
> and the boundary is drawn correctly. If it drags in `observe`, `corporate`, or `forge-host`, the boundary
> is wrong and the 105-crossing number was telling the truth.

The 2026-08-26 absorb already reached the matching conclusion from the other direction — *"dogfood in the
monorepo, then extract the thing we are already running (Harny first)"*. This round supplies the number
that makes that ordering correct rather than merely prudent: **the harness is the one named candidate whose
change-rate profile earns a split, and the one whose dependency graph is least ready for it.** Those are not
in conflict. They say: *break the 22 named back-edges first, then extract.*

---

## §9 Recommended order

Ordered by **relief per unit of cut cost**, with what each takes and what blocks it. Nothing here is a
decision — repo creation is a gated class and it is Aaron's.

### First — **`full-ai-cluster/` (cut 4).** The cheapest real cut in the repository.

- **Takes:** 395 files — `k8s/` (150), `nixos/` (99), `portal/` (72), `platform-controller/` (20),
  `tools/` (17), `dev-cluster/` (10), `orleans-silo/` (9), `usb-nixos-installer/` (8).
- **Leaves behind:** `src/Core.TypeScript/cluster/` (145 files, 81 crossings) — the chart-linting and
  cluster-assertion tier, which is hygiene and belongs with hygiene.
- **Must break first — all four, by name:** `full-ai-cluster/k8s/tests/render-first-boot-charts.ts →
  cluster/declared-cluster-trees.ts`; `full-ai-cluster/k8s/tests/validate-applications.ts →
  cluster/manual-sync-policy.ts`; `full-ai-cluster/tools/flash-usb-windows.ts → zflash/size-bounds.ts`;
  `.design-sync/tailwind.ds.config.mjs → full-ai-cluster/portal/web/tailwind.config.js`.
- **Also decide:** `usb-nixos-installer/` is claimed by both this cut and the zflash cut. Pick one, in
  writing.
- **Relief:** 2.9% of gate, 1.4% of clone bytes. **Small.** Its value is that it is a **rehearsal at 395
  files with four named edges** — the 2026-08-26 reverse-rehearsal established the procedure is byte-identically
  reversible (33/33 checks), and this is the cheapest place to run it for real.
- **Helm note:** there are no charts of ours to move. The rule already carved on 2026-09-06 ("a chart that
  deploys someone else's software lives with the cluster that deploys it") settles it: 37 upstream-pinned
  charts travel with this repo; the 2 charts we own are fixtures and stay.

### Second — **partition `docs/research` by generator (cut 3).**

- **Not a repo split of the research corpus.** Prose stays. The **211 MiB of machine-generated JSON and
  `.gz` evidence** — 8,362 `.gz` files, 13 commits, all in the last ten days — goes to a repo whose history
  is not evidence, under the rule the 2026-09-06 DRAFT already carved for `zeta-index`.
- **Must break first:** three edges, all from two scripts under `docs/research/scripts/` into
  `cover-acyclicity/`. Zero in-edges.
- **Relief: the single largest available — 36.8% of clone bytes**, which is the input to the 11.6% of gate
  spent in `Checkout` and to the 1.14 GiB every writer's clone carries.
- **Honest caveats:** (a) deleting paths stops future growth; it does **not** reclaim packed blobs — that
  needs a history rewrite, which is a gated class and is **not** proposed here; (b) whether any of these
  artifacts should have been committed at all is a `no-binary-in-proof-lineage` question this round
  measures but does not adjudicate; (c) this is a *new* candidate and has had no adversarial review.

### Third — **the meta-harness, but as edge-breaking, not as a move.**

- **Do not create a repo yet.** Do the three named breaks, in this order, in the monorepo:
  1. `corporate/` → `workflow-engine/agent-loop/*` — **13 edges.** Invert to a published interface.
  2. `observe/udp-lossy-loop.test.ts` → `model-backend/*` + `peer-call/summon` — **7 edges in one file.**
     A test belongs with its subject; move it.
  3. `tools/setup/manus-smoke-test.ts` → `model-backend/{manus-task,backend}` — **2 edges**, and the same
     class of defect as §7. The bootstrap surface must not depend on the harness.
- That takes the cut from **105 to 83** and, more importantly, makes the boundary *legible* while it is
  still free to move it.
- **Then** run the §8 falsifier. Extract only if it passes.

### Fourth — **`zflash` + `installer` + `pam` + `ci` (cut 68), after `tools/setup` is resolved.**

- Six of its twelve back-edges originate in `tools/setup/`. **They are the same problem as §7 and they
  should be fixed once, there, for all three candidates** — this is the finding that `tools/setup/` is the
  repo's real hub and no plan treats it as one.
- Note the graph's own instruction: **`ci/` travels with `zflash`** (it lowers the cut from 83 to 68). The
  QEMU harness is not shared infrastructure; it is the installer's test suite.

### Not yet, with the number — **`zetadb` (12 files) and `zetafs` (4 files).**

`zetadb` is a 12-file façade over `browser-node`, with which it is mutually recursive (28 back-edges in,
2 out); the smallest boundary containing both costs 165 crossings. `zetafs` is four files and one commit in
90 days. **Splitting either today moves a name and leaves the implementation.** Revisit when either has an
implementation with a boundary; the measurement to re-run is in this document and takes one second.

### Before any of it — **the `ace` realizer relocation (§7.3 item 1).**

Not a split. A **3-edge move** of `setup-realize.ts` + `setup-realizers/` from `src/Core.TypeScript/ace/`
into `tools/setup/`. It is nearly free today and expensive after `ace` leaves, and it is the difference
between `ace`-as-oracle and `ace`-as-hub. **It is the one item on this list that gets harder every week.**

---

## §10 Honest negative results, collected

Stated together so nobody has to find them scattered.

1. **`zetafs` is 4 files.** There is no split. (§2, §3.4)
2. **`zetadb` is 12 files and mutually recursive with `browser-node`.** Not a repo candidate yet. (§3.4)
3. **"Helm charts" is an empty candidate** — 2 `Chart.yaml` in the tree, both fixtures; 0 in the cluster
   trees. (§3.2)
4. **All five of Aaron's code candidates together are 5.0% of gate runner-seconds and 3.3% of clone bytes.**
   The monorepo bottleneck he names is 56.4% dotnet-core + TS-suite, which no proposed cut touches. (§5, §6)
5. **The meta-harness has the highest cut cost of any named candidate (105).** Its case is reuse, and reuse
   is `toy` until a consumer exists. (§3.1, §8)
6. **Round 2's promotion condition fails.** W35 = 171, W36 = 184, both below 250. The August accretion
   spike did not persist. (§4.3)
7. **The archive is 44% of files but 10.6% of clone bytes** — it is not the size lever it reads as. (§6.2)
8. **`zeta-formal`'s 37.4 MiB is 23.4 MiB of vendored jars and 10.1 MiB of one run's TLC state.** The specs
   are 0.3 MiB. Its case is toolchain-union relief only. (§6.3)
9. **`ace` is 6% solo at 90 days — the least separable component measured.** (§4.1)
10. **The clone-at-tag falsifier reports green over a coupling that will break clone-at-tag the day `ace`
    moves.** (§7.1)
11. **Toolchain install has fallen from 36% to 17.6% of gate wall-clock since 2026-08-19 with no split.**
    Round 3's headline lever has already halved by other means. (§5.2)

### Measurements that did not run — reported as `unknown`, never as zero

- **How often agents read `docs/history` / `docs/github`.** Round 2's named falsifier for Cut A. Still not
  gathered. `unknown`.
- **Whether any CI job failed *because of* a cache miss.** The 2026-08-26 sawtooth doc says explicitly it
  did not instrument this. This round did not either. `unknown`.
- **Failing-run cost attribution.** §5 sampled five green runs. Round 3's "82% of real job failures died in
  toolchain provisioning" is not re-measured at this basis. `unknown`.
- **Lean / TLA+ / Alloy / Agda internal dependency edges.** No extractor exists in the tool. `formal`'s cut
  of 0 is `consistent with` acyclic, not established. `unknown`.
- **Runtime coupling of every kind** — `Bun.spawn`, shell-out, file paths, HTTP. §7 shows this category
  contains at least one edge more consequential than anything the static graph found. **The static cut
  costs in §2 are lower bounds.** `unknown` in magnitude.
- **Whether relocating the realizers is behaviour-preserving.** Proposed on graph shape, not tested.
  `unknown`.
- **Whether `docs/research`'s binaries are permitted under `no-binary-in-proof-lineage`.** Measured for
  size, not adjudicated. `unknown`.

### Register table

| claim | register |
|---|---|
| every count, byte figure, edge list, runner-second and commit tally in §2–§7 | `metered` — reproducible by the two committed scripts and the REST calls named |
| CI bucket **assignment** in §5.1 | `unmetered` — a printed judgement, disputable |
| "toolchain install halved *because of* X" | **not claimed**; the two-point comparison is `metered`, any cause is `toy` |
| accretion **trend** from three weekly points | `toy` |
| "the harness is worth splitting for reuse" | `toy` — falsifier named in §8, not run |
| "relocating realizers preserves behaviour" | `toy` |
| "`ace-mechanism-pointers.json` inverts the surface-declaration rule" | `unmetered` — a reading of the file, argued not measured |
| `formal` is acyclic | `consistent with`, not established |

---

## §11 Reconciliation with what is already on file

- **The 2026-04-22 ADR** (Proposed, Stage 0) is untouched. Its `.forge-version`-"replaced by `ace pull`"
  sentence is the one `clone-at-tag-stays-sufficient` guards; §7 shows the replacement has begun by a
  different route than the ADR imagined — through `install.sh`, not through a version file.
- **Round 2** — its telemetry ruling (`docs/observe-events` stays) is untouched. Its Cut A remains the
  right cut on *file count*; §6.2 corrects the *bytes* framing. Its promotion condition is discharged as
  **failed** (§4.3).
- **Round 3** — its two axes (change rate vs toolchain closure) are the frame this round works inside. Its
  §10 note that the build-graph completeness lint "does not exist today" is **stale**: a
  `build-graph-completeness` job now runs in `gate.yml`. Its `full-verify` relocation objection is
  unresolved here too.
- **The 2026-08-26 sawtooth** — its finding that the per-leg install subset is a *prerequisite* is
  reinforced from a third direction: §5.2 shows the install share halving without a split, which means the
  subset work is already paying and is the cheaper lever.
- **The 2026-09-06 DRAFT** — this round does not contradict it. It sharpens two of its steps: step 2
  (`zeta-formal`) is smaller than it looks (§6.3), and its own "vendor, do not fetch" mitigation is the
  answer to §7. Its four open questions for Aaron stand; this round adds a fifth: **where does
  `tools/setup/` live, and does it own its realizers?**

---

## §12 Anchors (Beacon)

- **Robert C. Martin**, *Granularity* (C++ Report, 1996) — CCP (things that change together belong
  together) and CRP (things used together belong together). §4 is CCP measured; §2–§3 is CRP measured. The
  two axes disagreeing is the expected result, not an anomaly.
- **Harald Gall, Karin Hajek & Mehdi Jazayeri**, *Detection of Logical Coupling Based on Product Release
  History* (ICSM 1998) — the co-change discriminator §4.2 uses.
- **Dan Linstedt**, *Data Vault 2.0* — partition by change rate; hub stability is a property of the **scope
  of the key you chose**, which is why §3 sweeps boundaries rather than accepting the first one drawn.
- **Peter J. Denning**, *The Working Set Model for Program Behavior* (CACM 1968) — the frame the 2026-08-26
  cache measurement used, and the reason §6 measures bytes rather than files: cost follows the resident set,
  not the name count.
- **Albert O. Hirschman**, *Exit, Voice, and Loyalty* (1970) — the exit discriminator §7.2 applies.
- **Edsger W. Dijkstra**, *On the role of scientific thought* (EWD447, 1974) — separation of concerns as the
  reason a boundary with a cycle is not a boundary.

---

## §13 What is decided here

**Nothing.** Repo creation is irreversible-ish and gated (`no-directives.md`), and the 2026-08-26 rehearsal
established that this fleet's credential **cannot delete a repository** — so every repo created is a repo
that stays until Aaron removes it. That asymmetry is why this document ends with a recommendation and not an
action.

Two things in it are *not* gated and get harder with time, and they are the ones I would take first:

1. **Relocate `setup-realize.ts` + `setup-realizers/` out of `ace/` into `tools/setup/`** — 3 edges today,
   a broken bootstrap after the split (§7.3).
2. **Break the 22 named harness back-edges** — `corporate/` (13), one test file (7), one smoke test (2) —
   which costs nothing, is reversible, and makes the boundary legible before anyone has to commit to it
   (§9, third).

Everything else waits on a human decision.
