---
id: 081KSXN940008QG0R001A4WWX4
priority: P1
status: open
title: "observe.ts agent-loop — implementation + testing checklist (the closed observe→execute→loadWorld loop; toward vendor-store distribution)"
effort: L
ask: aaron 2026-05-31
created: 2026-05-31
last_updated: 2026-06-01
type: umbrella
decomposition: umbrella
depends_on: []
composes_with:
  - 081KSXN940008QG0R002B89QZ1
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R000E5KTPX
  - 081KSXN940008QG0R000R76H45
  - docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md
  - docs/research/2026-05-31-the-whole-thing-one-event-sourced-fold-substrate-gset-bag-zset-identity-observability-controller-world-model-synthesis.md
tags: [observe, agent-loop, event-sourcing, local-llm, execute, sovereign, testing, checklist, vendor-store, umbrella]
---

# 081KSXN940008QG0R001A4WWX4 — observe.ts agent-loop: implementation + testing checklist

## The directive (Aaron 2026-05-31)

> _"lets take our time, save this list somewhere as something we can check off so we both won't
> forget what we are working on with observe.ts lol"_

A shared, checkable tracker for the agent-loop work so the thread isn't lost between sessions. Not
a rush — Aaron 2026-05-31: _"we got lots of testing to do before we add to vendor agent stores but
this is the right shape."_ Check items off as they land; add rows as new gaps surface.

## The loop (what we're building)

```
loadWorld()  →  observe / observeWithLlm  →  render 4×4  →  choose  →  execute (append event)  →  loadWorld()  →  …
```

One fold over one git-native event log. `simulate` is the single pure reducer; `execute` is the
only effectful seam; the folder sink is the sovereign transport. Full picture:
[the synthesis](../../research/2026-05-31-the-whole-thing-one-event-sourced-fold-substrate-gset-bag-zset-identity-observability-controller-world-model-synthesis.md).

## DONE (landed)

- [x] **Pure controller** — `observe(world)→NextAction`, `buildMenu`, `simulate`, `fold`, `replay`
      (v5: state is a projection of the event log). `tools/observe/observe.ts`.
- [x] **4×4 / 16-slot universal action grammar** + render (`grammar-16.ts`, `grammar-16-render.ts`),
      conformance-locked to the observe-act ADR.
- [x] **Golden vectors / DST** (`golden-vectors.ts`).
- [x] **Local-LLM chooser** — `chooseIndex` / `classify` (`tools/accelerator/local-llm.ts`) +
      `ollamaBackend`; **real-model CI gate** `validate-local-llm.ts` + `accelerator-local-llm-validate.yml`
      (validates a REAL ollama choice on a bare runner — chooser-in-isolation).
- [x] **`execute`** — the impure twin for `free_time` + `self_reflect` (append + simulate; all other
      kinds `not-yet-executable`). `tools/observe/execute.ts` (#6310).
- [x] **`loadWorld`** — read side: backlog channel (selector = oracle) + mode from folding the event
      log; schema-on-read; closes the loop. `tools/observe/load-world.ts` (#6316).
- [x] **`folderSink`** — real EventSink: ZetaId-named JSON, folder-direct-to-main, conflict
      discipline (ahead-check + rebase --autostash + targeted undo), idempotency, path-traversal
      guard, Result-only. `tools/observe/event-sink-folder.ts` (#6312, merged).
- [x] **Synthesis + transport correction + key-custody design + hardware-to-buy** (#6304/#6306/#6307).

## LEFT (the testing + impl backlog — ordered)

- [ ] **Effectful action kinds in `execute`** — `do_item` first, then `respond_to_operator`,
      `decompose`, `explore`, `play`, `edit_grammar`. **With the executed-event envelope**
      (`ActionExecutionStarted` / `Succeeded` / `Failed` / `ModeChanged`) so **replay folds
      observations, never redoes commands** (the design-review caution). _This is the #1 gap — "the
      loop including actions" isn't real until the meaningful actions execute._
  - [x] **`do_item` Phase-1 envelope + executor port** — design 081KT07NV0008QG0R001CBQ2X2 (#6342) + impl (#6344):
        `ActionObservation` (Started/Succeeded/Failed), injected `CommandExecutor` port (fake /
        OCI-runtime tiers), `foldObservations` (no executor ⇒ replay can't re-run), command-vs-
        observation split, terminal-append reconcile-needed handling. **Sibling module
        (`tools/observe/do-item.ts`) — NOT yet integrated into the unified `execute` dispatch.**
  - [ ] **Integrate `do_item` into unified `execute`** + Phase-2 real executors (podman/docker OCI
        per 081KT07NV0008QG0R001CBQ2X2 §2.2; podman declared in manifests #6346) + the remaining kinds
        (`respond_to_operator`, `decompose`, `explore`, `play`, `edit_grammar`).
- [ ] **End-to-end closed-loop integration test** — `loadWorld → observeWithLlm → execute →
folderSink → loadWorld` as ONE flow against a real temp git repo (today every piece is unit-
      tested in isolation with mocks/fakes; the closed loop isn't integration-tested). _(Partial —
      logic-level done; real-git variant remains; see sub-items.)_
  - [x] **Closed-loop LOGIC integration** — `tools/observe/closed-loop.test.ts` (#6340):
        `observeWithLlm(mock backend) → execute → fold` as one flow, with the KEY invariant
        **`fold(initial, sink.appended) === executed world`** (the durable log reconstructs the
        executed state — "state is a projection of the event log" proven through the real
        execute+sink seam, not just in-memory `simulate`). Mock backend + fake sink (no ollama,
        no git) so CI is an always-green shield. Covers single-tick, multi-tick loop, DST
        determinism, and the not-yet-executable boundary.
  - [ ] **Real-temp-git-repo variant** — same flow against a real temp repo through the real
        `folderSink` + `gitCommitToMain` (composes the next item).
- [ ] **Real-temp-git-repo test of `gitCommitToMain`** — the sovereign-transport path is currently
      logic-only (every unit test injects a fake `commit`); a real `git init` temp repo would
      actually run on-main-guard + ahead-check + commit + push + rebase + autostash + targeted undo.
- [ ] **Real-model loop test** — `observeWithLlm` / `runLoop` driven by a real ollama (today only the
      isolated `chooseIndex` is real-model-validated; the loop is mock-only).
- [ ] **Date-partitioned write in `folderSink`** — sink currently writes flat `<eventDir>/<id>.json`;
      081KSNY2Z0008QG0R001K6HJ7Z / the bus partition `YYYY/MM/DD/{id}.json`. `loadWorld` already recurses; decide
      flat-vs-partitioned + align the writer.
- [ ] **Corporate batch-to-main transport** — the other rail (swap the `commit` fn for the 081KSNY2Z0008QG0R0017JSTGD
      batch-merge coordinator; same event shape).
- [ ] **`observe-loop` TS skill** — `.claude/skills/observe-loop/` packaging the four modules + a
      fresh-git-repo bootstrap procedure (per `zeta-ships-with-skills-immediate-value`). After the
      above are tested.
- [ ] **4-language loop fan-out — two frontiers led, met in the middle → the 4-oracle** (Aaron
      2026-05-31). Once the **TS loop APIs are stable** (the items above) AND **golden-vectors ✓ in
      all 4** (TS/Rust/C#/F#, against the one canonical `golden-vectors.json` oracle — DONE, the safe
      ground), build the observe loop per the role-split below. Don't build on shaky ground: locked
      golden-vectors first, then the loop. The 4-language fold (081KSXN940008QG0R0002287MP) is the proof the pattern
      works.

  | Language | Role on the loop       | Frontier                                                                                                              |
  | -------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
  | **TS**   | LEAD                   | git-native / **text** frontier (pioneers the folder-direct-to-main sink)                                              |
  | **F#**   | LEAD                   | filesystem / **binary-efficient** frontier (pioneers the stateful-binary sink)                                        |
  | **C#**   | **meet in the middle** | both formats — .NET sibling, so it reaches the binary side; distribution-tier, so it reaches the git-native side      |
  | **Rust** | **meet in the middle** | both formats — native/low-level, so it reaches the binary side; ubiquitous tooling, so it reaches the git-native side |

  **Why meet-in-the-middle = the 4-oracle**: "frontier" means _who pioneers_, NOT
  language-exclusivity. Each format needs **≥2 independent implementations** or the
  golden-vectors cross-check is not Byzantine-fault-tolerant — one buggy compiler could agree with
  itself. TS+F# each LEAD one format; **C# and Rust meet in the middle by implementing BOTH**, so
  every format ends with ≥2 impls and all four compilers vote on the one oracle. That four-way vote
  IS the **4-oracle** ("the compilers don't lie"). Each frontier needs its OWN golden-vectors
  (text round-trip AND binary round-trip → same logical events) so the two frontiers stay
  parity-locked.

- [ ] **F# dual-track backend — git-native + filesystem-binary-efficient** (Aaron 2026-05-31).
      The EventSink today is folder-direct-to-main (git-native). The DB-design ADR's "two backends"
      means the loop is backend-agnostic: a **git-native** sink AND a **filesystem binary-efficient**
      sink. **F# carries the binary-efficient filesystem-native track first** (F# = the binary
      backend per the DB-design ADR); as each track becomes not-shaky, **all 4 languages get the same
      dual mode** (git-native + binary) per the meet-in-the-middle table above, F# leading the binary
      side, TS leading the git-native side, C#+Rust completing both.
- [ ] **Vendor-agent-store distribution** — gated on all the above + "lots of testing" (Aaron).

## Composes with

- [081KSXN940008QG0R002B89QZ1](../P2/081KSXN940008QG0R002B89QZ1-workflow-dus-first-class-bft-oracle-compiler-summons-and-observe-keystone-research-then-build-aaron-2026-05-31.md) — workflow DUs + BFT-oracle/compiler summons + observe-keystone research (the research-stage sibling; this row is the operational build+test tracker)
- [081KSKBP80008QG0R000B3Y19A](081KSKBP80008QG0R000B3Y19A-workflow-engine-v1-fsharp-du-state-machine-git-append-only-four-corner-monad-banned-if-universal-action-grammar-otto-five-modifications-multi-participant-non-cage-aaron-mika-kestrel-otto-2026-05-27.md) — workflow engine v1 (the grammar + Otto's 5 modifications)
- [081KSNY2Z0008QG0R000E5KTPX](081KSNY2Z0008QG0R000E5KTPX-fast-lane-as-folders-on-main-not-branches-supersedes-coordinator-complexity-per-operator-2026-05-28-zeta-native-branch-protection.md) — folders-direct-to-main (the sovereign transport)
- [081KSXN940008QG0R000R76H45](../P2/081KSXN940008QG0R000R76H45-git-native-eventually-consistent-text-indexes-sorted-inverted-graph-plus-git-native-hindsight-storage-interface-aaron-2026-05-31.md) — eventually-consistent git-native indexes (the read accel over the same log)
- the observe-act 16-direction ADR + the synthesis research doc (linked above)

## Status

Open. The loop's skeleton is fully landed (controller + execute + sink + loadWorld); the work left
is making the _meaningful_ actions execute (with the executed-event envelope) and the _real_ tests
(end-to-end, real-git, real-model) that a vendor-store-grade artifact needs. Take it slow; check
items off as they land.
