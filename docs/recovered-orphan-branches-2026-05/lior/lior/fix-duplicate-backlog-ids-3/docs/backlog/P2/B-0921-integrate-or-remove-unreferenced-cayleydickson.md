---
id: B-0921
renumbered_from: B-0865
priority: P2
status: open
title: Integrate or remove unreferenced file src/Core/CayleyDickson.fs
created: 2026-05-27
last_updated: 2026-05-27
depends_on: [B-0522]
type: friction-reducer
decomposition: no
---

# B-0921 — Integrate or remove unreferenced file src/Core/CayleyDickson.fs

**Priority:** P2

**Filed:** 2026-05-27.

**Filed by:** Lior (via autonomous audit B-0522).

## What

The file `src/Core/CayleyDickson.fs` was identified by the `audit-fsharp-artifacts.ts` script as being unreferenced in the substrate. This file should be reviewed to determine if it is still needed. If it is, it should be integrated into the substrate by adding references to it in the appropriate `docs/` files. If it is not needed, it should be removed.
