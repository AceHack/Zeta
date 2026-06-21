---
id: 081KSXN940008QG0R00171YAZW
title: Implement the git-native cross-machine agent-bus — docs/agent-bus/ folder, ZetaId-Bus-keyed G-Set CRDT, no-PR (per the #6219 spec); the cross-machine/Windows comms channel
status: open
priority: P2
created: 2026-05-31
attribution: aaron-otto-2026-05-31
last_updated: 2026-06-01
decomposition: umbrella
depends_on:
  - 081KSKBP80008QG0R001KK9WV6
composes_with:
  - 081KSNY2Z0008QG0R000E5KTPX
  - 081KSNY2Z0008QG0R001DFZK4V
  - 081KRQ1AB0008QG0R003DCGHJJ
  - 081KR7JY10008QG0R000R503K2
  - 081KSV2WD0008QG0R0021XJ94E
  - 081KSXN940008QG0R001KZ235R
tags:
  - bus
  - git-native
  - cross-machine
  - zeta-id
  - g-set-crdt
  - no-pr
  - folders-on-main
  - windows
  - umbrella
---

# 081KSXN940008QG0R00171YAZW — Implement the git-native cross-machine agent-bus (per the #6219 spec)

## Why this row exists (the gap behind the spec)

> **Status update (2026-06-01, substrate-drift fix):** the bus is **Phase-1 IMPLEMENTED**,
> not "not started" — `tools/agent-bus/` landed via **#6283** (Phase 1: types + publish +
> subscribe, ZetaId-keyed G-Set CRDT, no-PR) and **#6327** (the cross-machine G-Set merge
> view). Acceptance items **1–3 + the merge view are DONE**; **items 4 (bridge) and 6
> (GC/retention) are not built**; item 5 (cross-machine) is logic-tested. The real
> remaining gap is **wiring**: `docs/agent-bus/` is empty because nothing in the loop
> publishes to it yet. The original "not started" text below is preserved
> (retraction-native) as the row's filing-time framing.

The git-native cross-machine bus is **spec'd + categorized but not implemented**:

- **Spec**: `docs/research/2026-05-31-git-backed-cross-machine-otto-bus-zetaid-spec.md`
  (PR #6219, merged) — _"git-backed cross-machine Otto bus — ZetaId-keyed,
  conflict-free, PR-less."_ The spec left the impl row as _"Candidate backlog row
  B-NNNN (likely a 081KSKBP80008QG0R001KK9WV6 sibling)"_ — **this row IS that candidate, now filed.**
- **ZetaId `Category.Bus = 6`** landed (`src/Core.TypeScript/zeta-id/types.ts`:
  _"cross-machine agent comms (git-native bus spec, #6219)"_).
- **Not started**: `docs/agent-bus/` does not exist on main; there is no
  publish/subscribe tooling over it. (Only `docs/agent-heartbeats/` exists — the
  081KSKBP80008QG0R001KK9WV6 heartbeat sibling.)

This is also the **answer to "the bus on Windows"**: the legacy in-process bus
(`tools/bus/` → `/tmp/zeta-bus/`) is **local-machine-only** and not a Windows-native
path; the git-native bus crosses machines + OSes **because git is the cross-OS
transport** (a peer-Otto on Windows reads/writes the same `docs/agent-bus/` folder
via git push/pull). Operator 2026-05-31: _"we added a bus category to our zeta id and
we're going to have a bus folder/branch setup … you backloged it, you started working
on it before we moved to action grammar and event algebra."_

## The design (from the #6219 spec — laid out)

- **Folder, not branch** (corrected in the spec per 081KSNY2Z0008QG0R000E5KTPX folders-on-main): each
  envelope is its own file named by its ZetaId, on `main`:
  `docs/agent-bus/<persona>/<YYYY>/<MM>/<DD>/<zetaIdHex>.json`.
- **G-Set CRDT** — disjoint, ZetaId-named files are a grow-only set; concurrent
  agents on different machines write **different files** → no merge conflicts →
  cross-machine-safe (the one idea that makes it work).
- **No-PR, direct-to-main** — rides the existing 081KSKBP80008QG0R001KK9WV6 heartbeat-folder mechanism
  (comms are not code; the no-PR carve-out is safe for ZetaId-keyed disjoint files);
  composes with the no-PR / shields-detect-not-block direction (operator 2026-05-31).
- **Canonical ZetaId, Bus category (6)** — reuse the existing id scheme; comms =
  `Bus`, distinct from `Heartbeat` (=3, health). Separate concern ⇒ separate category
  ⇒ separate folder.
- **Collision caveat** (from the spec): the filename must be unique-or-merge-safe,
  not assumed-unique (DST can produce identical-field envelopes → same ZetaId →
  same file; that's a _safe_ idempotent merge, but the writer must treat
  already-exists as success, not error).

## The whys (challengeable)

- **Why git-native (not `/tmp/zeta-bus/`)?** Cross-machine + cross-OS (incl. Windows)
  for free — git is the transport. The local file-bus can't reach another machine.
- **Why a G-Set CRDT of ZetaId files (not a shared mutable log)?** Disjoint files =
  no merge conflicts = no coordinator/host needed (composes 081KSV2WD0008QG0R0021XJ94E co-dominant
  mirrors). A shared mutable file would conflict on concurrent cross-machine writes.
- **Why no-PR?** Comms are ephemeral signaling, not reviewable code; PR latency
  defeats a "low-friction explicit channel." The 081KSKBP80008QG0R001KK9WV6 carve-out already establishes
  no-PR-for-ZetaId-disjoint-files is safe.
- **Why a separate `Bus` category/folder from heartbeats?** Health ≠ comms; mixing
  them couples two change-rates + audiences (DV2.0 partition).

## Acceptance / decomposition (umbrella — sub-rows on pickup)

1. **[DONE — #6283]** **Folder + envelope schema** — `docs/agent-bus/<persona>/.../<zetaIdHex>.json`;
   `tools/agent-bus/types.ts` (`AgentBusEnvelope`, `envelopePath`, `mintBusZetaIdHex`,
   `makeEnvelope`, `serializeEnvelope`, `isCanonicalBusId`, `isSafeSegment`), `Bus`-category ZetaId.
2. **[DONE — #6283]** **Publish tool** — `tools/agent-bus/publish.ts` (`writeEnvelope`):
   ZetaId-named file, no-PR, idempotent on already-exists (collision caveat handled).
3. **[DONE — #6283]** **Subscribe/read tool** — `tools/agent-bus/subscribe.ts`
   (`readEnvelopesSince`, `readEnvelopesFromGitRef`, cursor, `parseSubscribeArgs`).
   - **[DONE — #6327]** **Cross-machine G-Set merge view** — `tools/agent-bus/g-set-view.ts`
     (`busIdSet`, `mergeViews`, `unseen`, `envelopesIn`); logic-tested in `*.test.ts`.
4. **[LEFT]** **Bridge from the legacy bus** — `tools/bus/` (`/tmp/zeta-bus/`) stays the
   intra-machine fast path; the git-native folder is the cross-machine path; decide
   whether local publishes also mirror to the folder (or a `--cross-machine` flag).
5. **[PARTIAL — logic-tested]** **Windows parity** — the tooling is git + file IO (no `/tmp`
   assumption); cross-machine merge is logic-tested. Still confirm a real cross-machine
   round-trip Otto-CLI ↔ Windows-peer (the original operator question).
6. **[LEFT]** **GC / retention** — grow-only set needs pruning (envelopes are ephemeral;
   thermal-erasure / retention per the memory-lifetime substrate); a retention sweep.
7. **[LEFT — the real gap]** **Wire it into the loop** — the tooling exists but nothing
   publishes/subscribes via it yet (`docs/agent-bus/` is empty on main). The bus is inert
   until the agent loop actually emits + consumes envelopes through it (composes with the
   observe loop, 081KSXN940008QG0R001A4WWX4). Phase-1 built the pipes; this turns them on.

## Dependencies + rollout

- **081KSNY2Z0008QG0R001DFZK4V** (path-scoped branch protection for folders-on-main, **still open**) —
  Phase 2 protects `docs/agent-bus/**` as a no-PR carve-out without exposing the rest
  of `main`. **Until 081KSNY2Z0008QG0R001DFZK4V lands, the folder transport stays Phase 1** (works today
  via direct push; the path-scoped protection is the hardening, not a blocker).
- **081KQ3HBZ0008QG0R002ZPXAFQ** — threat model for the no-PR direct-to-main attack surface (the carve-out).

## Composes with

- **081KSKBP80008QG0R001KK9WV6** (agent heartbeat folder — the no-PR direct-to-main ZetaId-filenames
  mechanism this bus rides; `docs/agent-heartbeats/` is the existing sibling)
- **081KSNY2Z0008QG0R000E5KTPX** (fast-lane as folders-on-main, not branches — why it's a folder)
- **081KSNY2Z0008QG0R001DFZK4V** (path-scoped branch protection — Phase 2 hardening) + **081KQ3HBZ0008QG0R002ZPXAFQ** (threat model)
- **081KRQ1AB0008QG0R003DCGHJJ** (cross-machine account-scoped scarcity bus) + **081KR7JY10008QG0R000R503K2** (inter-agent
  ephemeral comms bus) + **081KQX9B50008QG0R001YRPGD6** (broadcast-bus hardening) — the bus lineage
- **081KSV2WD0008QG0R0021XJ94E** (co-dominant git mirrors / git-native CRDT — the cross-machine
  no-host-needed coordination this is an instance of)
- **081KSXN940008QG0R001KZ235R** (Git-V2 handshake — the bus is one consumer of the git-native
  agent-speed substrate)
- The ZetaId `Bus` category (`src/Core.TypeScript/zeta-id/`) + the #6219 spec +
  `tools/bus/` (legacy local bus the cross-machine folder complements)

## Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`)

Searched (origin/main): `agent-bus|docs/agent-bus|git.backed.*bus|cross.machine.*bus.*folder`
in `docs/backlog/` → **no impl row**; `081KSKBP80008QG0R001KK9WV6*` → 081KSKBP80008QG0R001KK9WV6 + 081KSKBP80008QG0R003NG37GQ (no bus row);
backlog referencing `#6219` / the spec filename → **none**; `docs/agent-bus/` on main
→ **absent** (only `docs/agent-heartbeats/`); bus tooling under `tools/` → **none**.
Conclusion: spec + ZetaId category exist; **implementation row absent** — mint-new
(the spec's explicitly-named "candidate B-NNNN"), composing with the lineage above.

## Substrate-honest framing

The design is settled by the #6219 spec; this row tracks the **implementation** so it
has a home instead of living only as a research doc + a reserved enum slot. P2:
valuable (it's the cross-machine/Windows comms channel) but not urgent (git is the
working ambient cross-machine channel today; this makes the _explicit_ channel
cross-machine too). Phase 1 ships without 081KSNY2Z0008QG0R001DFZK4V; Phase 2 hardens with it.
