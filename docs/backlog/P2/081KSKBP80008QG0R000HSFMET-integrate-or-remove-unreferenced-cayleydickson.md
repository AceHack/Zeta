---
id: 081KSKBP80008QG0R000HSFMET
priority: P2
status: open
title: Integrate or remove unreferenced file src/Core/CayleyDickson.fs
created: 2026-05-27
last_updated: 2026-05-28
renumbered_from: "081KSKBP80008QG0R003NM9XEC (2026-05-28 duplicate-ID repair; substantive ARC-AGI-3 benchmark row retains 081KSKBP80008QG0R003NM9XEC)"
depends_on: []
type: friction-reducer
decomposition: no
---

# 081KSKBP80008QG0R000HSFMET — Integrate or remove unreferenced file src/Core/CayleyDickson.fs

**Priority:** P2

**Filed:** 2026-05-27.

**Filed by:** Lior (via autonomous F# artifact audit; `tools/hygiene/audit-fsharp-artifacts.ts`).

## What

The file `src/Core/CayleyDickson.fs` was identified by the `audit-fsharp-artifacts.ts` script as being unreferenced in the substrate. This file should be reviewed to determine if it is still needed. If it is, it should be integrated into the substrate by adding references to it in the appropriate `docs/` files. If it is not needed, it should be removed.
