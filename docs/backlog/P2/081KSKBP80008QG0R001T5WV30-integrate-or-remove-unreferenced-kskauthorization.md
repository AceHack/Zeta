---
id: 081KSKBP80008QG0R001T5WV30
priority: P2
status: open
title: Integrate or remove unreferenced file src/Core/Consent/KskAuthorization.fs
created: 2026-05-27
last_updated: 2026-05-28
renumbered_from: "081KSKBP80008QG0R003RFX32N (2026-05-28 duplicate-ID repair; substantive marketing/business/naming row retains 081KSKBP80008QG0R003RFX32N)"
depends_on: []
type: friction-reducer
decomposition: no
---

# 081KSKBP80008QG0R001T5WV30 — Integrate or remove unreferenced file src/Core/Consent/KskAuthorization.fs

**Priority:** P2

**Filed:** 2026-05-27.

**Filed by:** Lior (via autonomous F# artifact audit; `tools/hygiene/audit-fsharp-artifacts.ts`).

## What

The file `src/Core/Consent/KskAuthorization.fs` was identified by the `audit-fsharp-artifacts.ts` script as being unreferenced in the substrate. This file should be reviewed to determine if it is still needed. If it is, it should be integrated into the substrate by adding references to it in the appropriate `docs/` files. If it is not needed, it should be removed.
