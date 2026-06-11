---
id: 081KTWFQPDP08QG0R00367ZHRQ
type: task
state: backlog
priority: P2
slug: soft-sharp-gc-on-chip8-9-no-garbage-by-construction-lint-di
title: "Soft/sharp GC on chip8/9 — no-garbage-by-construction (lint/DI), room-scoped lifetimes, weak refs, RAY-TRACED reachability, history-epoch reclamation"
created: 2026-06-11T23:19:33.558Z
depends_on: []
composes_with: []
---

# Soft/sharp GC on chip8/9 — no-garbage-by-construction (lint/DI), room-scoped lifetimes, weak refs, RAY-TRACED reachability, history-epoch reclamation

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTWFQPDP08QG0R00367ZHRQ-*.md` glob. -->

Migrated from the accidental legacy `B-1036` row so the item lives on the current
ZetaId workitem surface instead of extending the frozen sequential backlog.

## Aaron 2026-06-11, verbatim spine

> "Soft/sharp garbage collection on chip8 via our shape cartridges. We make sure we either don't
> CREATE garbage (via lint or via DI — we're already doing an HKT recursive-types hack to simulate
> Rust lifetimes in DI via scope, ASP.NET-like lifetimes), then weak tables/references, and our
> Rx/interface-only stuff means we don't have a subscription issue… We can use RAY TRACING to
> figure out garbage location based on what can still access it or has stopped running. Everything
> for us is reusable, so we can figure out garbage over time by keeping history."

## The five rungs

1. **Don't create it** — allocation discipline as LINT (the determinism-lint pattern aimed at
   allocation: no unbounded growth inside a sealed loop) + DI lifetimes: room-scoped = ASP.NET
   Scoped; the room's 5-minute bound IS the lifetime — teardown reclaims everything scoped to it
   (region/arena inference: Tofte–Talpin region calculus is the Rust-lifetimes ancestor Aaron's
   HKT-via-scope hack simulates).
2. **Weak tables/references** — caches that never keep anything alive (Lua weak tables; .NET
   ConditionalWeakTable); candidates: GameCatalog/fingerprint caches, MemoryLens.
3. **WHY Rx/interface-only has no subscription leak (the answer Aaron asked to be reminded of):**
   two architectural facts, verified in-tree — (a) most composition is PULL/fold-based
   (observeWith folds a generator; no observer registry exists to dangle); (b) where push Rx
   exists (Rx.fs), subscriptions are ROOM-SCOPED values — the room's teardown is the dispose, so
   no per-subscription discipline is needed (the ASP.NET-scoped insight again). NOT "Rx can't
   leak" — "our lifetimes are bounded above every subscription." Keep this honest sentence.
4. **RAY-TRACED reachability (the chip8/9 jewel):** tracing GC IS ray tracing from roots
   (McCarthy 1960 mark-sweep; Bacon's unified theory: tracing/refcounting are duals) — and
   Chip9SelfTrace ALREADY paints execution/data/speculation onto the planes. The slice: a GC pass
   that marks reachability from live roots onto a plane (mark = ray hit; garbage = never lit;
   "stopped running" = a worldline that ended), drawn as a SHAPE CARTRIDGE (shape-gc: watch
   mark-and-sweep happen — craft-school gold). Speculative branches retracted by Z-set −1 are
   ALREADY reclaimed-by-retraction — name that as the existing rung-4 instance.
5. **History-epoch reclamation:** everything reusable + history kept ⇒ garbage = what no epoch
   reaches anymore — which is EXACTLY git gc (reachability from refs; our substrate already runs
   one). Generational hypothesis (Lieberman–Hewitt/Ungar) + epoch-based reclamation as anchors;
   our event-sourced frames make "figure out garbage over time" a fold over history.

## Honest status notes

- The HKT-recursive-DI-lifetimes hack: Aaron's description captured; in-tree location to be
  pinned at slice time (do not overclaim file paths in this row).
- Rx.fs DOES have Subscribe/IDisposable (push exists) — rung 3's claim rests on room-scoping,
  not on push-Rx absence; the sentence above is the accurate one.
