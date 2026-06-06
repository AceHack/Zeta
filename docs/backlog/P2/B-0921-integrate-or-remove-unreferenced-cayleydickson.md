---
id: B-0921
zetaid: 081KSKBP80008QG0R000HSFMET
priority: P2
status: open
title: Integrate or remove unreferenced file src/Core/CayleyDickson.fs
created: 2026-05-27
last_updated: 2026-05-28
renumbered_from: "B-0865 (2026-05-28 duplicate-ID repair; substantive ARC-AGI-3 benchmark row retains B-0865)"
depends_on: []
type: friction-reducer
decomposition: no
---

# B-0921 — Integrate or remove unreferenced file src/Core/CayleyDickson.fs

**Priority:** P2

**Filed:** 2026-05-27.

**Filed by:** Lior (via autonomous F# artifact audit; `tools/hygiene/audit-fsharp-artifacts.ts`).

## What

The file `src/Core/CayleyDickson.fs` was identified by the `audit-fsharp-artifacts.ts` script as being unreferenced in the substrate. This file should be reviewed to determine if it is still needed. If it is, it should be integrated into the substrate by adding references to it in the appropriate `docs/` files. If it is not needed, it should be removed.
