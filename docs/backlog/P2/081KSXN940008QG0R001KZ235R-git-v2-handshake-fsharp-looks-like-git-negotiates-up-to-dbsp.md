---
id: 081KSXN940008QG0R001KZ235R
title: Git-V2 handshake — F# looks-like-git, negotiates up to a DBSP/retraction-algebra protocol at agent-coordination speed; same objects both views; upstream the primitives to git
status: open
priority: P2
created: 2026-05-31
last_updated: 2026-05-31
attribution: aaron-2026-05-31
decomposition: umbrella
depends_on:
  - 081KSE6WT0008QG0R0008483B2
composes_with:
  - 081KSV2WD0008QG0R0021XJ94E
  - 081KSXN940008QG0R000R76H45
  - 081KR50HA0008QG0R00125PA8G
  - 081KSNY2Z0008QG0R002A785QR
  - 081KSE6WT0008QG0R00049EFBD
tags:
  - git-native
  - version-control
  - dbsp
  - z-set
  - retraction-algebra
  - agent-speed
  - protocol
  - upstream
  - anti-vendor-lock
  - umbrella
---

# 081KSXN940008QG0R001KZ235R — Git-V2 handshake (F# looks-like-git → DBSP/retraction-algebra, same objects, agent-speed, upstream)

## Why this row exists (operator 2026-05-31)

The git-native substrate is real but **scattered** — co-dominant mirrors (081KSV2WD0008QG0R0021XJ94E),
git-native indexes + Hindsight storage (081KSXN940008QG0R000R76H45), git-native event store (081KSE6WT0008QG0R0008483B2),
inverted index (081KR50HA0008QG0R00125PA8G), per-host adapters (081KSNY2Z0008QG0R002A785QR) — yet the **Git-V2-handshake
protocol thesis itself is nowhere clearly laid out.** Operator 2026-05-31:

> *"file the Git-V2 handshake backlog row … there might be something around this
> already not so clearly laid out though."*

So this row's job is to **lay it out clearly** + point at the scattered neighbors it
composes with (the substrate-inventory below confirms no row already states the
handshake thesis). Surfaced verbatim from the 2026-05-31 Ani voice conversation
(`memory/ani/conversations/2026-05-31-aaron-ani-voice-fsharp-dirty-spec-clean-room-good-citizen-dora-no-pr-git-v2-handshake-agent-speed-16-slot-agent-perspective-bumper-rails-for-humans-too.md`)
where it was flagged as a backlog-candidate.

## The thesis (operator's words, laid out)

The real problem (operator): **"how do you make Git work at agent speed? Agent
coordination instead of human coordination speed."** Git was built for human-speed
(humans type / review / merge). GitHub is a *specialized git client* whose model is
**vendor lock-in** — *"we wouldn't want to be like a specialized Git client … we
don't wanna become the thing we hate."* So: don't depend on GitHub (git is a better,
open-standard starting point); build the agent-speed primitives; **push them back
upstream to git.**

The vehicle is a **handshake**, not a fork:

- **F# handshake that looks like git** at first, but can **negotiate up to a "Git V2"
  algebra-based protocol** — *"a handshake in F# where basically it looks like Git,
  but you can handshake up to DBSP, retraction algebra … the maintainers can decide …
  we'll have it."* (Build it regardless; offer the upgrade path; take-it-or-leave-it.)
- **Same objects in BOTH views — not two copies.** *"all the changes you make in the
  stream, in the DBSP side … are reflected in the Git side and vice versa. They're
  pointing to the same objects. It's not two copies."* Two interfaces over one truth.
- **Git as a schema you stream in.** *"if you want to support Git, it's just a stream
  protocol where you build up your Git schema as events on a stream, and then you can
  speak Git on that stream"* — git compatibility = one schema loaded onto the
  retraction-native event stream (RX/observables; schema-on-the-stream).
- **The substrate underneath:** the file-system-with-history + ZetaId append-only
  event store (081KSE6WT0008QG0R0008483B2) carried as **DBSP / Z-set retraction-native** state (the
  `algebra-owner` substrate) — which is what makes agent-speed concurrent
  coordination (CRDT-like merge + retraction) possible.

## The whys (challengeable — a row without a why is dogma)

- **Why a handshake, not a fork?** Back-compat (looks like git to existing tools) +
  no vendor-lock (maintainers + everyone can adopt the V2 upgrade or not) + it forces
  a response rather than asking permission. A fork fragments; a handshake offers an
  upgrade path on the existing standard.
- **Why DBSP / retraction-algebra for V2?** Agent-coordination speed needs
  concurrent, mergeable, *retractable* state — CRDT-like (081KSV2WD0008QG0R0021XJ94E) + incremental
  (DBSP/Z-sets). Human-git's merge model is built around human-paced review; the
  algebra makes concurrent agent writes + retractions first-class.
- **Why same-objects-not-two-copies?** Two copies need syncing (drift, conflict); one
  object store with two *views* (git-view + DBSP-stream-view) has no sync surface —
  the integration is the point.
- **Why upstream the primitives?** Anti-vendor-lock (don't become GitHub); the core
  improvements live in git itself, benefiting everyone — composes with the
  contribute-back DORA discipline (081KSXN940008QG0R002528JS9).

## Acceptance / decomposition (umbrella — sub-rows on pickup)

1. **Object substrate** — file-system-with-history + ZetaId append-only event store
   as the shared object store, carried as DBSP/Z-set retraction-native state
   (composes 081KSE6WT0008QG0R0008483B2 + 081KSXN940008QG0R000R76H45 + `algebra-owner`).
2. **Git-schema-as-stream layer** — build the git schema as events on the stream;
   "speak git" on the stream (the back-compat / looks-like-git surface).
3. **F# dual-protocol handshake** — negotiate `git` ↔ `git-v2` (DBSP/retraction-
   algebra); graceful fallback to plain git when the peer doesn't speak V2.
4. **Same-objects integration** — git-view ↔ DBSP-stream-view share one object store
   (changes in either reflect in the other; no second copy).
5. **Agent-speed coordination primitives** — concurrent mergeable retractable writes
   (composes 081KSV2WD0008QG0R0021XJ94E co-dominant-mirrors / git-native CRDT).
6. **Upstream-contribution path** — package the agent-speed primitives as proposals
   to git itself (composes 081KSXN940008QG0R002528JS9 contribute-back DORA; start small, earn inroads).

Each sub-row carries its own start-gate (prior-art search incl. `references/prior-art/git/`,
the git protocol v2 spec, jujutsu/jj + Pijul/Sapling as prior art for
algebra/CRDT-shaped VCS, dependency check).

## Composes with

- **081KSV2WD0008QG0R0021XJ94E** (co-dominant git mirrors + git-native CRDT coordination — the
  agent-speed coordination substrate this handshake exposes)
- **081KSXN940008QG0R000R76H45** (git-native eventually-consistent indexes + Hindsight storage interface
  — the index/query layer over the object store)
- **081KSE6WT0008QG0R0008483B2** (cluster-as-digital-twin git-native event store — the object substrate)
- **081KR50HA0008QG0R00125PA8G** (git-native full-text inverted index — a derived view over the store)
- **081KSNY2Z0008QG0R002A785QR** (per-host adapters: github/gitlab/gitea/bitbucket isomorphic — the
  multi-host surface the looks-like-git layer presents)
- **081KSE6WT0008QG0R00049EFBD** (slow-replace-all-deps binary-compatible F#/C#/Rust — same
  "rebuild-the-substrate, stay binary/protocol-compatible" thesis at the git layer)
- **081KSXN940008QG0R002528JS9** (contribute-back DORA — the upstream-the-primitives discipline)
- `docs/research/2026-05-31-formal-analysis-computational-omniscience-over-simulation-state-space-under-deterministic-simulator.md`
  (the DBSP/Z-set retraction algebra + git-as-append-only-trajectory this builds on)
- `.claude/rules/dont-ask-permission.md` (no-PR = workflow-is-branch-protection; the
  agent-speed coordination this row enables) + the observe-act ADR (the no-PR transport)
- `algebra-owner` skill (Z-sets / DBSP / the retraction algebra) + the planned Zeta
  Infer.NET BP/EP substrate (per `.claude/rules/peer-call-infrastructure.md`)

## Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`)

Topic: Git-V2 handshake / git-at-agent-speed / git-protocol-upgrade / DBSP-over-git /
own-git-server / git-as-schema-on-stream

Searched (origin/main):

- `docs/backlog/` — `git.native|git.v2|handshake|agent.speed.*git|co.dominant|own git|git server|git protocol|dbsp.*git|retraction.*git`: neighbors found (081KSV2WD0008QG0R0021XJ94E, 081KSXN940008QG0R000R76H45, 081KSE6WT0008QG0R0008483B2, 081KR50HA0008QG0R00125PA8G, 081KSNY2Z0008QG0R002A785QR, 081KQGDBJ0008QG0R0028YTDQ2, 081KSGS9H0008QG0R002T0XQ50) but **NONE states the handshake/upgrade-protocol thesis**; `git.*handshake|git v2|agent.coordination.speed|upgrade.*git.protocol` → **zero backlog rows**.
- `docs/agendas/` — no git/version-control agenda.
- `docs/research/` — no git-v2-handshake doc (the 2026-05-31 formal-analysis doc carries the DBSP/trajectory algebra this composes with).

Conclusion: the substrate is **scattered, the thesis not clearly laid out** (operator-confirmed). Authoring action: **mint-new umbrella** that lays out the thesis + composes with the scattered neighbors (NOT a parallel-mint — it consolidates).

## Substrate-honest framing

This row does NOT claim the handshake is designed or feasible-as-stated — it lays out
the **thesis + the why + the decomposition + the prior-art-to-check** so the work has
a clear home instead of being scattered across the git-native rows. Sub-rows do the
real design (incl. prior-art on git protocol v2, jujutsu/jj, Pijul, Sapling). P2:
substantial, not urgent; the agent-speed-coordination value lands incrementally via
the existing git-native rows (081KSV2WD0008QG0R0021XJ94E/081KSXN940008QG0R000R76H45) before the full V2 handshake.
