# The recovered non-backlog residue — 125 files triaged, 7 still live

**Date:** 2026-08-15
**Agent:** shadow (Claude Code, claude-opus-5)
**Prompt:** Aaron — the remaining sweep the B-NNNN census explicitly did not do: the WIP code and
research/misc files in the recovery quarantine.

**Answer in one line:** the residue is **125 files, not 131**; **48 LANDED, 14 SUPERSEDED,
56 ABANDONED-CORRECTLY, and 7 LIVE** — and the 7 collapse to **3 items**, of which one is a
workflow on `main` today that dispatches a file that does not exist.

***

## 0. Corrections to the brief (flagged, as asked)

**(1) The 68 / 63 counts are wrong, and they were never anyone's measurement.** The brief
attributes them to the prior agent; the prior agent attributes them to the quarantine README
(*"the ~68 code files and ~63 research/misc the quarantine README counts"*). The README's own
numbers are `~86 + ~68 + ~63 = ~217`. Measured:

| | README claim | measured | delta |
|---|---|---|---|
| total files in quarantine | ~217 | **207** | −10 |
| `B-NNNN`-named (prior sweep's scope) | ~86 | **82** (63 unique ids) | −4 |
| **non-backlog residue (this sweep)** | **~131** | **125** | **−6** |

The 82 figure reproduces the prior sweep exactly, so the two sweeps partition the same 207 files
with no overlap and no gap. The `~68 / ~63` split is also wrong in shape, not just size: the
residue is **89 code-ish / 30 md+txt / 6 extensionless**, not 68/63. The README's numbers were
estimates that have been quoted three times as if measured — that is the bulk-verdict failure the
prior sweep already named, repeating one layer up.

**(2) The prior sweep is not on `main`.** It lives on unmerged branch
`shadow/lost-bnnnn-recovered-branch-sweep-2026-08-15` (commit `6e47ac90f`), along with the 3
work-items it minted. Anything reading `main` for it will find nothing. This is a continuation of
that commit, not of anything merged.

**(3) The branch set is a directory on `main`, not the archive tags.** The prior sweep scoped to
`docs/recovered-orphan-branches-2026-05/` — a build/lint-excluded quarantine **tracked on `main`**.
I used the same source, so this is a continuation rather than a parallel reinvention. The archive
tags the brief suggested are a **different and much larger corpus**; §5 reports that delta.

**(4) Nothing in this sweep was ever "lost".** Every one of the 125 files is on `main` right now,
inside the quarantine. `LIVE` here therefore means *"still valuable and still not at a canonical
path"*, not *"missing"*. That distinction is what keeps the LIVE bucket small and honest.

***

## 1. The census

**125 files. Every file carries exactly one class and a cited path, commit, or symbol.**

| class | count | share |
|---|---|---|
| LANDED — equivalent content on `main`, usually at a different path | **48** | 38% |
| SUPERSEDED — the idea landed in a different, better form | **14** | 11% |
| ABANDONED-CORRECTLY — dead end | **56** | 45% |
| **LIVE — genuinely unlanded and still valuable** | **7** | **5.6%** |

Reproduce:

```bash
git ls-files docs/recovered-orphan-branches-2026-05 | wc -l          # 207
git ls-files docs/recovered-orphan-branches-2026-05 | grep -c 'B-[0-9]'   # 82  (prior sweep)
git ls-files docs/recovered-orphan-branches-2026-05 | grep -vc 'B-[0-9]'  # 125 (this sweep)
```

***

## 2. LIVE — 7 files, 3 items

### Item A — the accelerator move-next loop (5 files)

**This is the one with a live consumer on `main` that is already broken.**

`.github/workflows/accelerator-move-next.yml` is on `main`, `workflow_dispatch`-able, and line 99
runs:

```
bun src/Core.TypeScript/accelerator/move-next-harness.ts --agent "$AGENT" --max-iterations 1
```

That file **does not exist on `main`** — `src/Core.TypeScript/accelerator/` holds only
`local-llm.ts`, `local-llm.test.ts`, `validate-local-llm.ts`. Independently,
`docs/accelerator/EVENT-STORE-SCHEMA.md` links twice (lines 8 and 223) to
`tools/accelerator/event-store-schema.ts`, also absent. The workflow header additionally cites
`docs/accelerator/README.md`, which does not exist either.

The workflow checks out branch `accelerator/pr-less-git-monster` and runs the harness *from there*
— so the missing path on `main` is not by itself the defect. The defect is that the branch is gone:

```
git ls-remote --heads origin 'refs/heads/main'            -> 9b21dbd6b...   (control passes)
git ls-remote --heads origin 'refs/heads/accelerator/*'   -> (empty)
```

Both halves are therefore absent: the branch that held the harness is pruned, and the quarantine
copy is the only surviving one. Tracking row **`081KSNY2Z0008QG0R003X1QWYG`** (P1, `status: open`,
"GitHub Actions recursion as infinite runtime platform") is live and describes exactly this loop —
and its §"Invokes" line points at
`src/Core.TypeScript/workflow-engine/agent-loop/state-machine.ts`, which **does** exist. So the
decision surface landed and only the glue is missing.

- `tools/accelerator/move-next-harness.ts` (374 lines) — the bounded self-re-dispatch cycle
  (`MAX_ITERATIONS`, `HALT_SENTINEL`, `replayState`, `runCycle`, `runLoop`).
- `tools/accelerator/move-next-harness.test.ts`
- `tools/accelerator/event-store-schema.ts` (239 lines) — the `@1` envelope types the schema doc
  documents (`EventEnvelope`, `validateEnvelope`, `RetractionEvent`, `eventPath`).
- `tools/accelerator/event-store-schema.test.ts`
- `misc/accelerator/pr-less-git-monster/events/otto/01KSVK4B6TDTRV10E2QEF2VWP3.json` — the only
  surviving event instance, i.e. the only sample of the schema in the wild.

**Why it still matters:** a dispatchable workflow whose first real step cannot succeed is the
vacuity class wearing a green badge — a check that cannot run must not read as one that passed.
**Cost to land:** small for honesty (delete or disable the workflow + fix the two doc links);
medium for capability (move 2 modules + 2 tests to `src/Core.TypeScript/accelerator/`, repoint the
workflow at `main`, decide whether the pruned event stream still matters). **These are different
decisions and should be priced separately** — the honesty fix is worth doing whether or not the
capability is wanted.

### Item B — `ENGAGEMENT_MODES_AND_ACTIVATION_DESIGN.md` (1 file)

A 300-line design doc for `EngagementPolicy` — the tenant-configurable "on-ness" dial (always-on,
scheduled, trigger-gated, requirement-driven, issue-sourced), held explicitly orthogonal to the
autonomy dial.

Evidence it drops straight in: it carries the `agentic-organization/docs/` frontmatter convention;
every doc in its `extends`/`composes_with` lists is on `main`; and **all five `code_anchors`
exist**:

```
agentic-organization/packages/application/src/control-plane-guard.ts   OK
agentic-organization/packages/application/src/intake.ts                OK
agentic-organization/packages/application/src/observe.ts               OK
agentic-organization/packages/application/src/schedule-authority.ts    OK
agentic-organization/deploy/run-org-cadence.ts                         OK
```

Evidence it is not already there: `rg 'EngagementPolicy'` over `main` (quarantine excluded) returns
**nothing**, and `agentic-organization/docs/` has no engagement/activation doc.

**Cost to land:** trivial — one file copy to `agentic-organization/docs/`. It is a design, not an
implementation, so landing it costs a review and buys discoverability in the doc set it was
written for.

### Item C — the Axis-3 ADR (1 file)

`docs/DECISIONS/2026-05-14-axis3-code-english-formal-verification-design.md`, 78 lines,
`**Status:** Accepted`, author Otto — the third axis (Code vs English substrate, plus the
formal-verification dimension) of the repo-split model that `dv2-data-split-discipline-activated.md`
still leans on.

`docs/DECISIONS/` holds 56 decisions and **none of them is this one**; `rg -i 'axis-3'` over live
surfaces finds only `docs/BACKLOG.md` and memory. Its tracking row
`081KRHWGX0008QG0R002893S6E` is P1 `status: open`.

**Why it still matters:** an *accepted* decision absent from the decision record is a decision the
next agent cannot find, which is how the same argument gets re-litigated. **Cost to land:** trivial
— one file copy, no code.

**Not minting rows for any of these.** Three items is a list Aaron can read; bulk-minting is how a
live backlog gets buried (the prior sweep's own §6 note).

***

## 3. How the big blocks resolved — the LIVE bucket is small because most of it really did land

**zflash (13 files) → LANDED.** `full-ai-cluster/tools/zflash*.ts` migrated to
`src/Core.TypeScript/zflash/*` (PR-8076 hexagonal-ports consolidation, PR-8095 tools→src). Checked
by export set, not filename: recovered `zflash-lib.ts` exports **28**, `src/Core.TypeScript/zflash/lib.ts`
exports **34**, and `comm -23` of the two sets is **empty** — a strict superset.

**merge1 (37 files) → 14 LANDED, 23 ABANDONED-CORRECTLY.** These are WIP implementations against
the `agentic-organization/ZetaMerge/Merge1/01–10` specs, which are on `main`. Resolved per slice by
finding the *defining* site:

| slice | verdict | evidence |
|---|---|---|
| §02 observe loop | LANDED | `src/Core.TypeScript/observe/do-item.ts` + `do-item.test.ts` define `executeDoItem`, `foldObservations`, `ExecutorTier`, `RunSpec`; the fixture `observe-golden-vectors.json` is **byte-identical** to `src/Core.TypeScript/observe/golden-vectors.json` |
| §03 state machine | LANDED (4/6) | `src/Core.TypeScript/workflow-engine/agent-loop/state-machine.ts` + `src/Core/WorkflowEngine.fs` (`MenuOption`, `AgentState`, `transition`); `FreeTime` in `packages/domain/src/records.ts` |
| §05 workflow engine | LANDED | `FourCornerOwnership` in `src/Core/ShapeAcceptance.fs` + `src/Core/WSet.fs`; command surface in `command-contract.ts` / `command-pipeline.ts` |
| §07 hat system | LANDED | `hat-lifecycle.ts`, `hat-guardrails.ts`, `hat-authority-port.ts`; `hat-definition`/`hat-binding` in `packages/domain/src/index.ts` |
| §01 operator algebra | ABANDONED | `Operator`, `StrictOperator`, `OutputBuffer` appear **only** in the spec `.md` |
| §04 inter-agent bus | ABANDONED | `TransportPort`, `EnvelopeReceipt`, `ClaimCoordinator` appear **only** in spec `.md`; `ports.ts` has no transport; the adopted path is the NATS adapter `apps/workers/src/adapters/nats-js-transport-connection.ts` |
| §06 formal verification | ABANDONED | `FormalVerificationPort`, `SocietyClosureCertificate`, `SoakGate` appear **only** in spec `.md`; the adopted substrate is `src/Core.FSharp.Z3Verify/`, `src/Core.TLA/`, `tools/soraya-formal-coverage/` |
| §03 `private-register` / `agent-state-store` | ABANDONED | `PrivateRegister`, `RelationConsent`, `NonCollapse` appear **only** in spec `.md` |

The reason the unadopted half is **ABANDONED-CORRECTLY and not LIVE**: Merge1 is a plan to migrate
agent work *into* `agentic-organization/`, and the repo went the **other way** — `tools/*` →
`src/Core.TypeScript/*`. `ZetaMerge` has **no live inbound reference** on `main` (only PR-archive
rows). The slices that landed did so *outside* the plan's target files. A migration plan whose
direction was reversed is a dead end, and its unadopted slices are dead with it.

**Migrations that made recovered files look missing** (the renamed-on-landing trap, all confirmed by
content or by a landing PR): `tools/hygiene/check-role-ref-*.sh` → `src/Core.TypeScript/hygiene/*.ts`;
`tools/riven/riven-cursor-terminal-loop.sh` → `src/Core.TypeScript/riven/*.ts`;
`dev-cluster-lib.ts` → `src/Core.TypeScript/cluster/dev-cluster/lib.ts` + `cluster/adapters/container-host.ts`
(PR-8078 removed the superseded shell scripts); `tools/setup/common/agent-clis.sh` → ACE
setup-realizers (`src/Core.TypeScript/ace/setup-realizers/from-bun-global.ts`) under the documented
bash-retirement program; `local-llm.sh` → `src/Core.TypeScript/accelerator/local-llm.ts`.

**Two README-filed items are done.** The quarantine README says `BinaryCode.fs` and `ZSetW.fs` were
"filed as work-items so unique code isn't forgotten". Both are on `main` now:
`src/Core/BinaryCode.fs` (+ `tests/Tests.FSharp/BinaryCode.Tests.fs`, work-item in
`workitems/done/2026/07/`) and `src/Core/ZSetW.fs` (290 recovered → **396** lines, plus
`bench/Benchmarks/ZSetWBench.fs` and `src/Zeta.Generators/ZSetWRingGenerator.cs`).

**A coverage question I opened and closed.** Recovered `ZSetW.Tests.fs` (224 lines) exercises a
**tropical** weight ring; `main`'s `ZSetW.Tests.fs` (173 lines) tests only the int64 bridge — which
looked like a vacuous polymorphism check. It is not: `tests/Tests.FSharp/Algebra/TropicalPaths.Tests.fs`
references both `ZSetW` and `Tropical`, and `Provenance.Tests.fs` / `RationalRing.Tests.fs` cover
further rings. Coverage moved, it did not vanish. LANDED.

**`no-python-files.allowlist` (2 copies) → ABANDONED-CORRECTLY, and deliberately so:** PR-8130,
*"chore(lint): fully retire the no-python-files guard (Python is now first-class)."* Resurrecting it
would re-add a retired guard.

**One open P1 row whose recovered implementation is still not worth landing.**
`missed-substrate-subscriber.ts` implements `missedSubstrateCascadeHandler` for row
`081KRHWGX0008QG0R000JMEYBH` (P1, `status: open`). Detection landed
(`src/Core.TypeScript/bg/missed-substrate-detector.ts` defines `CascadeFinding`), the handler did
not. But the recovered file is a 50-line sketch that takes `envelope: any`, logs with `console.log`,
returns no `Result`, and reads `new Date()` ambiently — it violates result-over-exception and the
ambient-clock guard, and would not pass today's gates. **ABANDONED-CORRECTLY:** the row is on `main`
and open, so the intent is not lost; only a prototype is, and it should be rewritten rather than
resurrected.

***

## 4. Method — and the two instruments that failed their controls

Both produced clean, plausible, wrong output before being caught. Recorded because the output looked
fine.

**Instrument 1 — the identifier index, scored 0/3 on known positives.** I built a
600k-identifier index of `main` to test symbol presence. Control run: `ZSetW` → **ABSENT**, though
`src/Core/ZSetW.fs` is right there. Cause: `rg -N` suppresses *line numbers*, not *filenames*, so
every row was `path:token` and no exact match could ever hit. After stripping the prefix the same
controls read `verifyAuthorizedWebAuthnAssertion` PRESENT, `ZSetW` PRESENT, `AdinkraCode` PRESENT,
`zzzNotARealSymbolQqq` ABSENT. **A membership test that cannot return true is not a test** — and it
would have reported every recovered file as unlanded.

**Instrument 2 — the F# symbol extractor, wrong in the other direction.** My `^ *(let|type)` grep
over `.fs` files returned `a`, `ab`, `b`, `z`, `w`, `s`, `e` — local bindings inside test bodies,
not API. It scored `ZSetW.Tests.fs` at 5/18 and the number was meaningless. Abandoned for `.fs` and
replaced with direct test-name comparison. Symbol extraction is a TS/JS instrument here; it does not
transfer to F#.

**Third guard, applied and passed.** `git ls-remote --heads origin 'refs/heads/accelerator/*'`
returned empty. Empty is exactly what a broken command also returns, so I ran `refs/heads/main`
first as a known positive (returned a SHA) and counted all heads (**1469**). Only then did the empty
result become a finding.

**What positive evidence was accepted as LANDED:** a defining site on `main` (`export … <sym>` /
`type <sym>`), a byte-identical file, an export superset via `comm -23`, or a named landing PR in
`docs/history/pr-reviews/`. Symbol *presence* in the index was never sufficient on its own — in a
600k-token index, `Checkpoint` and `Operator` are noise.

**What I did not do:** re-verify the prior sweep's 63 backlog ids; triage the archive-tag corpus
(§5); or run the build/test gate, since this PR adds one Markdown file and touches no build input —
`docs/research` appears **0 times** in `src/Core.TypeScript/ace/build-graph.json`, so no
`derive --write` is required (checked, not assumed).

***

## 5. The branch-set delta — the archive tags are a separate, much larger corpus

The brief asked whether my branch set and the prior sweep's disagree. They do, and the gap is real
but mostly explained.

The recovery tags exist and are intact: **323** `archive/*` tags (265 under `archive/2026-06-13/`,
53 under `archive/2026-06-13-acehack/`), of which **314 are not reachable from `main`**. Their trees
hold **15,805** distinct paths, **3,209** of which have no same-path counterpart on `main` — about
**25× the quarantine's 125**.

Nearly all of that is the renamed-on-landing trap at scale:

| tag-only paths | count | explanation |
|---|---|---|
| `docs/backlog/**` | 1,155 | **all 1,155 are `B-NNNN` files** — the ZetaId migration renames; the prior sweep's scope |
| `memory/persona/**` | 510 | `memory/persona/<x>/` → `memory/<x>/` (`memory/aarav/` etc. on `main`; only 7 files remain under `memory/persona/`) |
| `.claude/skills/**` | 255 | skills reorganization |
| `tools/**` | ~500 | the `tools/` → `src/Core.TypeScript/` migration |

A deterministic sample of the 2,054 non-backlog tag-only paths (every 100th) finds **18 of 21 have
their basename on `main`**. Extrapolated, roughly 200–300 paths across the tag corpus would survive
a basename check and need real content triage.

**I did not triage them, and that is a scoped gap, not a clean bill.** It is a separate sweep of a
different corpus, and reporting a sample as if it were a census is the failure this whole exercise
is about. What I can state: the tags are present, nothing needs restoring to keep them readable, and
**no deletion is proposed** — the scheduled cooling-tag GC owns that, and per
`docs/trajectories/world-model-convergence/RESUME.md` it was due 2026-06-20 while the tags are still
here.

***

## 6. Overlaps with siblings — reported, not edited

- **Bonsai ↔ codegen / the `reify` inverse** (`src/Core/Bonsai.fs`, contended): no contact. Nothing
  in the 125 touches `Bonsai.fs` or the reify path.
- **VISION / roadmap:** Item B (`EngagementPolicy`) is a product-shaped design for the agentic-org
  doc set and is the one item a roadmap owner may want a say in. Not edited.
- **The prior sweep's lane:** its 3 minted work-items and its census live on
  `shadow/lost-bnnnn-recovered-branch-sweep-2026-08-15`, still unmerged. If that branch lands after
  this one, both docs should end up in `docs/research/` with no conflict — they touch disjoint files.
- **B-0732 / B-0733 are live ZetaId rows on `main`** (`081KSE6WT0008QG0R002YBWBB1`,
  `081KSE6WT0008QG0R00102H071`) — confirmed still present; no B-number was minted or assumed
  orphaned in this sweep.

***

## 7. What this says about bulk verdicts, one layer up

The prior sweep's closing note was that *"a bulk verdict on a heterogeneous pile reads as an audit
but is a guess"*, and it proved it for the README's `~86 stale B-xxxx`. The same README's `~68 code
/ ~63 research` label has now been quoted by a task brief and by a prior agent as though it were a
measurement. It was off by 6 in total and wrong in shape.

The cheap check that catches it is the one that keeps being skipped: **count the thing before
describing it.** `git ls-files <dir> | wc -l` costs nothing and is the difference between an audit
and a guess.

The residue itself was, in the end, mostly what the README hoped: **86% of it is landed, superseded,
or correctly dead.** The quarantine's preserve-don't-prune call was right, and it is the reason a
374-line harness that a live workflow still dispatches was recoverable at all.

***

## 8. Pointers

- Quarantine: `docs/recovered-orphan-branches-2026-05/README.md`
- Prior sweep (unmerged): commit `6e47ac90f`, branch `shadow/lost-bnnnn-recovered-branch-sweep-2026-08-15`
- Item A: `.github/workflows/accelerator-move-next.yml` · `docs/accelerator/EVENT-STORE-SCHEMA.md` ·
  row `081KSNY2Z0008QG0R003X1QWYG` (P1, open)
- Item B: `agentic-organization/docs/` (target) · `agentic-organization/packages/application/src/control-plane-guard.ts`
- Item C: `docs/DECISIONS/` (target) · row `081KRHWGX0008QG0R002893S6E` (P1, open)
- Merge1 specs: `agentic-organization/ZetaMerge/Merge1/README.md`
- Rules applied: `.claude/rules/workitems-mint-with-zetaid.md` (no `B-NNNN` minted; nothing minted at
  all) · `toy-is-free-metered-must-be-earned.md` (§5's extrapolation is labelled as a sample, not a
  census) · `numerology-vs-number-theory.md` (a basename match is a count, not an identification —
  which is why every LANDED verdict cites a defining site, a byte-identity, or a landing PR)
