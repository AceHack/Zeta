---
id: 081KTQX7W6Q08QG0R000XA3220
type: task
state: backlog
priority: P1
slug: dangling-md-pointers-auto-vivify-into-mumps-gitfs-forward-re
title: "Dangling MD pointers auto-vivify into MUMPS + gitfs — forward-reference a not-yet-existing node in markdown and the system instantiates it (almost instantly) in the MUMPS global tree + gitfs (MUMPS native subscript auto-vivification applied to MD links); governed values still minted via ZetaIdCodec; bounded by shape-A; idempotent (Aaron 2026-06-10)"
created: 2026-06-10T04:39:23.095Z
depends_on: []
composes_with: []
---

# Dangling MD pointers auto-vivify into MUMPS + gitfs — forward-reference a not-yet-existing node in markdown and the system instantiates it (almost instantly) in the MUMPS global tree + gitfs (MUMPS native subscript auto-vivification applied to MD links); governed values still minted via ZetaIdCodec; bounded by shape-A; idempotent (Aaron 2026-06-10)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTQX7W6Q08QG0R000XA3220-*.md` glob. -->

> **Aaron, 2026-06-10:** "you can create pointers that don't exist yet in our MD and the system will make it
> exist in our MUMPS and gitfs instantly — almost. Let's backlog this and do it soon."

## The idea

Let a markdown document **reference a node that does not exist yet** (a forward/dangling pointer — a
`[[name]]` wikilink, a `same/x-y` pair pointing at `grey/` and `gray/`, a relative path link) and have the
system **auto-instantiate that node** in the **MUMPS global tree** and **gitfs**, **almost instantly** on
reference. Link liberally → the target **auto-vivifies**; a pointer is never broken.

The anchor is **MUMPS's native behaviour**: assigning/referencing a global subscript that doesn't exist
**creates the whole path** (`SET ^X("a","b","c")=1` auto-creates `^X`,`"a"`,`"b"`,`"c"`). 081KTQD8A0008QG0R0005EFYPV applies
that **auto-vivification** to **markdown pointers** so MD link ⇄ MUMPS global ⇄ gitfs path are **one
auto-vivifying namespace**. Already the spirit of the `[[name]]` memory convention; this makes it automatic.

## Scope / shape (to design)

- **Detector** — scan MD for pointers (wikilinks, `same/x-y`, relative path links) whose target is absent.
- **Auto-vivify** — instantiate the missing node as a **stub** (MUMPS global + gitfs path; the gitfs commit
  IS the creation), preserving the carved-sentence/README convention for folders.
- **Almost-instant** — on save / on reference (hook or watch), not a batch.
- **Idempotent** — vivifying an existing node is a no-op (set-semantics; apply-N == apply-once).
- **DV2.0** — pointer (hub, stable) vs vivified node (satellite, fills in).
- **Bounded / safe (shape A)** — vivification must terminate; a cycle of dangling pointers vivifies a
  **finite** set, once (no stub fork-bomb).

## Honest scope / peels

- **Governed values stay governed** — auto-vivified nodes needing a **ZetaId** get one from the **governed
  minter** (`ZetaIdCodec` / this very `new-workitem` flow), never fabricated; vivification creates the
  *stub/namespace*, not governed identity from nothing.
- **"Instantly almost"** — on-save/on-reference latency target, to be measured; not hard real-time.
- **Write-scope/security** — auto-creating files/globals from MD references is a write surface; respect the
  write-actor routing (own-clone → origin/main), bound the scope, route authorization via Architect/Dejan.

## Why now (Aaron 2026-06-10)

The **legacy B-number backlog causes uncontrollable LLM drift** (guessing the next number, collisions,
inconsistency). The fix — and the reason this item is **ZetaId-keyed under `workitems/`** via
`tools/backlog/new-workitem.ts` — is **governed, conflict-free, time-sortable identity** (no number to
guess). 081KTQD8A0008QG0R0005EFYPV generalizes that same auto-vivifying, governed-identity discipline to **every** MD pointer.

## Ties / routing

MUMPS globals (native subscript auto-vivification — the anchor) · gitfs (commit-as-creation; git-as-event-
store fold) · the `[[name]]` liberal-linking memory convention · `same/x-y` (the `grey`/`gray` dangling pair
that prompted this) · DV2.0 (hub pointer / satellite node) · shape A (terminating fixed point — bounds
vivification) · idempotency (#6). Routes to the MUMPS/globals + gitfs owners (the vivifier), Dejan (on-save
hook + write-scope), Aaron (the "do it soon" priority; the drift-fix rationale).
