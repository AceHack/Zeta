---
id: B-0890.1
zetaid: 081KSNY2Z0008QG0R000E5KTPX
priority: P1
status: open
title: Fast-lane as folders on main (not branches) — supersedes B-0890 coordinator complexity per operator 2026-05-28 "we can just have folders" + Zeta-native branch protection
effort: M
ask: aaron 2026-05-28 three-message-sharpening
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - B-0890
  - B-0887
composes_with:
  - B-0890
  - B-0887
  - B-0858
  - B-0867
  - B-0867.2
  - B-0867.20
  - B-0874
tags:
  - fast-lane-as-folders-on-main
  - no-trajectory-branches-needed
  - supersedes-batch-merge-coordinator-complexity
  - zeta-native-branch-protection-replaces-coordinator-discipline
  - unified-heartbeats-plus-workflow-state-batch
  - direct-push-path-scoped-no-pr-no-coordinator
  - composes-with-zeta-native-review-substrate-b-0887
  - operator-three-message-architectural-sharpening
---

## Operator framing 2026-05-28 (three composing messages)

> *"the heartbeats and workflow state could batch merge at the same time"*

> *"i'm thinking we don't need branches for heartbeats and workflow eventually cause main is protected by our branch protections instead of PRs"*

> *"we can just have folders"*

Operator's progression sharpens B-0890 substantially. The batch-merge-coordinator (B-0890 parent) was designed around trajectory branches + periodic coordinator merging them to main via batch PRs. Operator's three messages collapse this:

1. Heartbeats + workflow state batch-merge together → unified, not separate
2. No branches needed → just folders on main
3. Main is Zeta-protected via B-0887 substrate, not GitHub PR machinery

**The whole batch-merge-coordinator machinery becomes vestigial.** State-machine events + heartbeats write DIRECTLY to folders on main; Zeta-native branch-protection (per B-0887) enforces path-scoped permissions; no coordinator merges anything because there's nothing to merge from.

### Mode-scoping refinement (operator 2026-05-31)

The "vestigial" claim above is **sovereign-mode-scoped, not absolute.** Operator 2026-05-31: *"Corporations will allow you to do branches without branch protection i don't see them allowing you to do main, so we have to support both branch and folder mode forever ... the branches can also have our folders so it merges in batch to main nicely."*

So the coordinator is **not dead — it is the corporate/branch-mode transport.** Folder mode and the coordinator are two transports for the *same* conflict-free ZetaId-folder substrate:

- **Folder mode (sovereign / Agora):** ZetaId-keyed files directly in folders on main; no coordinator (this row). **Near-term focus — get this clean + reliable first.**
- **Branch mode (corporate leash):** corps allow branches-without-protection but not direct-to-main, so the same ZetaId-keyed folders live on a branch and the **B-0890 coordinator** batch-merges branch → main as one PR. The folders make the branch conflict-free by construction, so the merge is clean (no cross-trajectory conflict resolution — the coordinator's hard part evaporates).

Both transports forever (it is the leash-vs-sovereign dial). The coordinator (B-0890) + its `Batch` ZetaId category (id 4, registered 2026-05-31; impl deferred to Max) carry the corporate path. Sovereign folders-on-main is the priority now; corporate-leash branch-mode batch waits for Max's attention.

## What this row tracks

Re-frame B-0890 from "batch-merge-coordinator" to "folder-based fast-lane on main with Zeta-native path-protection." The simpler architecture:

### Folder layout on main (no branches)

```text
main/
  docs/
    agent-heartbeats/          ← B-0858 substrate; existing
      {persona}/YYYY/MM/DD/{zetaid}.md
    workflow-engine-state/      ← NEW; was trajectory branches
      {chromosome-hex}/YYYY/MM/DD/{zetaid}.json
    agent-events/               ← NEW; per-event records
      {trajectory}/YYYY/MM/DD/{zetaid}.json
  ...rest of repo
```

### Zeta-native path-scoped branch protection (per B-0887)

Path-scoped rules enforce:

- `docs/agent-heartbeats/**` — direct push by any persona to their own subdir; rejected from other personas' subdirs
- `docs/workflow-engine-state/**` — direct push by chromosome-matched persona; rejected from other chromosomes
- `docs/agent-events/**` — direct push by trajectory-owning agent
- Everything else on main — full PR review per B-0887 (Zeta-native review substrate)

### What B-0890's design memo SUPERSEDES

The agent-produced design memo at `docs/research/2026-05-28-b-0890-batch-merge-coordinator-design-memo.md` is comprehensive but covers a problem-space the operator's sharpening eliminates:

| Memo section | Status under B-0890.1 |
|---|---|
| §1 Cadence policy (hybrid M=25/T=15min) | **Not needed.** No coordinator, no cadence. |
| §2 Partial-batch-recovery | **Not needed.** No batches; each push is atomic. |
| §3 Coordinator state machine + crash semantics | **Not needed.** No coordinator. |
| §4 Ordering guarantees | **Simplified.** Per-trajectory still ordered (per file, per directory); no cross-trajectory coordination |
| §5 Conflict resolution (Mode 1/2/3) | **Not needed.** Path-isolation by construction (chromosome-hex / trajectory-id folder scoping); cross-folder writes are forbidden by branch protection |
| §6 Batch PR shape | **Not needed.** No batch PRs. |
| §7 Failure modes | **Largely not applicable.** Main concerns: path-protection enforcement (B-0887) + per-write atomicity |
| §13 Operator extension (unified coordinator) | **Subsumed.** No coordinator at all. |

The memo is PRESERVED as research substrate (the analysis is still valuable; shows what the design would have looked like under the branch-based architecture). It does NOT inform implementation under B-0890.1.

### What B-0890.1 INHERITS from B-0890

- Folder-scoped path-isolation as the conflict-free-by-construction property (same idea, applied to folders on main instead of trajectory branches)
- `[skip-review]` markers for reviewer-bot opt-out (now on direct-push commits to fast-lane folders)
- Composition with B-0867.2 event-sourcing (event filenames + content schema preserved)
- Composition with B-0867.20 lifecycle DU split (trajectory-push vs PR-review-for-system-changes; trajectory-push now means "push to fast-lane folder," not "push to trajectory branch")

## Acceptance criteria

- `src/Core.TypeScript/workflow-engine/agent-loop/fast-lane-folders/write.ts` — TS module that writes events to `docs/agent-events/{trajectory}/YYYY/MM/DD/{zetaid}.json` directly on main (no branch)
- `src/Core.TypeScript/workflow-engine/agent-loop/fast-lane-folders/workflow-state-write.ts` — TS module that writes workflow-engine state to `docs/workflow-engine-state/{chromosome-hex}/YYYY/MM/DD/{zetaid}.json` directly on main
- Both use REST git-data API for direct push (no local git state mutation; same pattern as B-0858 heartbeat write)
- Composes with B-0887 Zeta-native path-protection: persona-scoped + chromosome-scoped + trajectory-scoped path permissions enforced at the branch-protection layer
- Tests cover: same-persona writes succeed; cross-persona writes (e.g., otto writing to alexa's subdir) are rejected; concurrent writes from same persona to different files succeed; sequential writes preserve filename-ordering by ZetaID timestamp
- README documents the folder layout + path-protection rules + composes-with B-0887
- Existing B-0858 `merge-heartbeats-to-main.ts` migration path: heartbeat writes go DIRECTLY to `docs/agent-heartbeats/{persona}/...` on main (no `agent-heartbeats` branch); existing merge-heartbeats-coordinator retires once B-0887 path-protection lands

## Composition

- **B-0890** (parent; superseded in implementation scope by this row; preserved as research substrate)
- **B-0887** (Zeta-native review + branch-protection substrate — load-bearing dependency; path-scoped permissions enforced here)
- **B-0858** (heartbeat fast-lane — folder pattern this row generalizes; existing `merge-heartbeats-to-main.ts` coordinator migrates to direct-folder-write)
- **B-0867** (workflow engine; state-machine events flow through the fast-lane)
- **B-0867.2** (event-sourcing layer; event filenames + content schema preserved)
- **B-0867.20** (lifecycle DU split; trajectory-push now = "push to fast-lane folder")
- **B-0874** (GitHub Actions runtime; existing coordinators may run during transition window)

## Dependency on B-0887

B-0890.1 depends on B-0887's path-scoped Zeta-native branch protection being operational. Until B-0887 lands, the folder-based approach has a security gap (any persona could write to any folder via direct push). Two transition options:

**Option A — Ship B-0890.1 + B-0887 together as a coordinated landing.** Higher coordination cost; cleaner end state.

**Option B — Ship B-0890.1 with interim GitHub branch protection rules** (path-allowlist rules on main per persona); migrate to B-0887 substrate when ready. Lower coordination cost; some operator-config drift during transition.

**Recommendation: Option B for ASAP shipping.** Document the transition explicitly. Operator decides.

## Substrate-honest framing

P1 per operator's three-message sharpening direction. M effort because the implementation surface is small (folder-write + path-protection enforcement) but the migration of existing B-0858 coordinator + integration with B-0887 path-protection requires care.

The architectural simplification is genuine — operator's "we can just have folders" eliminates ~half the design complexity in the B-0890 memo. The memo work isn't wasted (it shows what the alternative would have looked like; useful research artifact) but the implementation goes the simpler route.

## Full reasoning

Three operator messages 2026-05-28:

1. *"the heartbeats and workflow state could batch merge at the same time"* — unified treatment
2. *"i'm thinking we don't need branches for heartbeats and workflow eventually cause main is protected by our branch protections instead of PRs"* — no branches; B-0887 protection
3. *"we can just have folders"* — direct-folder writes

Together collapse B-0890's batch-merge-coordinator architecture into folder-based direct-push with path-scoped protection. Composes with B-0887's Zeta-native review substrate (replaces GitHub PR coordination with Zeta-native path-protection).

The B-0890 design memo at `docs/research/2026-05-28-b-0890-batch-merge-coordinator-design-memo.md` is preserved as research artifact showing the alternative architecture; implementation under B-0890.1 supersedes it.
