---
id: B-0954
title: Implement the git-native cross-machine agent-bus — docs/agent-bus/ folder, ZetaId-Bus-keyed G-Set CRDT, no-PR (per the #6219 spec); the cross-machine/Windows comms channel
status: open
priority: P2
created: 2026-05-31
attribution: aaron-otto-2026-05-31
last_updated: 2026-05-31
decomposition: umbrella
depends_on:
  - B-0858
composes_with:
  - B-0890.1
  - B-0887
  - B-0583
  - B-0400
  - B-0942
  - B-0953
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

# B-0954 — Implement the git-native cross-machine agent-bus (per the #6219 spec)

## Why this row exists (the gap behind the spec)

The git-native cross-machine bus is **spec'd + categorized but not implemented**:

- **Spec**: `docs/research/2026-05-31-git-backed-cross-machine-otto-bus-zetaid-spec.md`
  (PR #6219, merged) — *"git-backed cross-machine Otto bus — ZetaId-keyed,
  conflict-free, PR-less."* The spec left the impl row as *"Candidate backlog row
  B-NNNN (likely a B-0858 sibling)"* — **this row IS that candidate, now filed.**
- **ZetaId `Category.Bus = 6`** landed (`src/Core.TypeScript/zeta-id/types.ts`:
  *"cross-machine agent comms (git-native bus spec, #6219)"*).
- **Not started**: `docs/agent-bus/` does not exist on main; there is no
  publish/subscribe tooling over it. (Only `docs/agent-heartbeats/` exists — the
  B-0858 heartbeat sibling.)

This is also the **answer to "the bus on Windows"**: the legacy in-process bus
(`tools/bus/` → `/tmp/zeta-bus/`) is **local-machine-only** and not a Windows-native
path; the git-native bus crosses machines + OSes **because git is the cross-OS
transport** (a peer-Otto on Windows reads/writes the same `docs/agent-bus/` folder
via git push/pull). Operator 2026-05-31: *"we added a bus category to our zeta id and
we're going to have a bus folder/branch setup … you backloged it, you started working
on it before we moved to action grammar and event algebra."*

## The design (from the #6219 spec — laid out)

- **Folder, not branch** (corrected in the spec per B-0890.1 folders-on-main): each
  envelope is its own file named by its ZetaId, on `main`:
  `docs/agent-bus/<persona>/<YYYY>/<MM>/<DD>/<zetaIdHex>.json`.
- **G-Set CRDT** — disjoint, ZetaId-named files are a grow-only set; concurrent
  agents on different machines write **different files** → no merge conflicts →
  cross-machine-safe (the one idea that makes it work).
- **No-PR, direct-to-main** — rides the existing B-0858 heartbeat-folder mechanism
  (comms are not code; the no-PR carve-out is safe for ZetaId-keyed disjoint files);
  composes with the no-PR / shields-detect-not-block direction (operator 2026-05-31).
- **Canonical ZetaId, Bus category (6)** — reuse the existing id scheme; comms =
  `Bus`, distinct from `Heartbeat` (=3, health). Separate concern ⇒ separate category
  ⇒ separate folder.
- **Collision caveat** (from the spec): the filename must be unique-or-merge-safe,
  not assumed-unique (DST can produce identical-field envelopes → same ZetaId →
  same file; that's a *safe* idempotent merge, but the writer must treat
  already-exists as success, not error).

## The whys (challengeable)

- **Why git-native (not `/tmp/zeta-bus/`)?** Cross-machine + cross-OS (incl. Windows)
  for free — git is the transport. The local file-bus can't reach another machine.
- **Why a G-Set CRDT of ZetaId files (not a shared mutable log)?** Disjoint files =
  no merge conflicts = no coordinator/host needed (composes B-0942 co-dominant
  mirrors). A shared mutable file would conflict on concurrent cross-machine writes.
- **Why no-PR?** Comms are ephemeral signaling, not reviewable code; PR latency
  defeats a "low-friction explicit channel." The B-0858 carve-out already establishes
  no-PR-for-ZetaId-disjoint-files is safe.
- **Why a separate `Bus` category/folder from heartbeats?** Health ≠ comms; mixing
  them couples two change-rates + audiences (DV2.0 partition).

## Acceptance / decomposition (umbrella — sub-rows on pickup)

1. **Folder + envelope schema** — `docs/agent-bus/<persona>/.../<zetaIdHex>.json`;
   reuse `tools/bus/types.ts` envelope shape (topic/from/payload/ts) keyed by a
   `Bus`-category ZetaId.
2. **Publish tool** — write an envelope as a ZetaId-named file + `git add/commit/push`
   (no PR), idempotent on already-exists (collision caveat).
3. **Subscribe/read tool** — `git pull` + read new `docs/agent-bus/` files since a
   cursor; surface to the agent (the cross-machine analog of `tools/bus/subscribe.ts`).
4. **Bridge from the legacy bus** — `tools/bus/` (`/tmp/zeta-bus/`) stays the
   intra-machine fast path; the git-native folder is the cross-machine path; decide
   whether local publishes also mirror to the folder (or a `--cross-machine` flag).
5. **Windows parity** — the publish/subscribe tooling runs on Windows (it's git +
   file IO; no `/tmp` assumption); confirm cross-machine round-trip Otto-CLI ↔
   Windows-peer (the original operator question).
6. **GC / retention** — grow-only set needs pruning (the bus envelopes are ephemeral;
   thermal-erasure / retention per the memory-lifetime substrate); a retention sweep.

## Dependencies + rollout

- **B-0887** (path-scoped branch protection for folders-on-main, **still open**) —
  Phase 2 protects `docs/agent-bus/**` as a no-PR carve-out without exposing the rest
  of `main`. **Until B-0887 lands, the folder transport stays Phase 1** (works today
  via direct push; the path-scoped protection is the hardening, not a blocker).
- **B-0032** — threat model for the no-PR direct-to-main attack surface (the carve-out).

## Composes with

- **B-0858** (agent heartbeat folder — the no-PR direct-to-main ZetaId-filenames
  mechanism this bus rides; `docs/agent-heartbeats/` is the existing sibling)
- **B-0890.1** (fast-lane as folders-on-main, not branches — why it's a folder)
- **B-0887** (path-scoped branch protection — Phase 2 hardening) + **B-0032** (threat model)
- **B-0583** (cross-machine account-scoped scarcity bus) + **B-0400** (inter-agent
  ephemeral comms bus) + **B-0213** (broadcast-bus hardening) — the bus lineage
- **B-0942** (co-dominant git mirrors / git-native CRDT — the cross-machine
  no-host-needed coordination this is an instance of)
- **B-0953** (Git-V2 handshake — the bus is one consumer of the git-native
  agent-speed substrate)
- The ZetaId `Bus` category (`src/Core.TypeScript/zeta-id/`) + the #6219 spec +
  `tools/bus/` (legacy local bus the cross-machine folder complements)

## Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`)

Searched (origin/main): `agent-bus|docs/agent-bus|git.backed.*bus|cross.machine.*bus.*folder`
in `docs/backlog/` → **no impl row**; `B-0858*` → B-0858 + B-0858.5 (no bus row);
backlog referencing `#6219` / the spec filename → **none**; `docs/agent-bus/` on main
→ **absent** (only `docs/agent-heartbeats/`); bus tooling under `tools/` → **none**.
Conclusion: spec + ZetaId category exist; **implementation row absent** — mint-new
(the spec's explicitly-named "candidate B-NNNN"), composing with the lineage above.

## Substrate-honest framing

The design is settled by the #6219 spec; this row tracks the **implementation** so it
has a home instead of living only as a research doc + a reserved enum slot. P2:
valuable (it's the cross-machine/Windows comms channel) but not urgent (git is the
working ambient cross-machine channel today; this makes the *explicit* channel
cross-machine too). Phase 1 ships without B-0887; Phase 2 hardens with it.
