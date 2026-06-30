---
id: B-0866
priority: P2
status: open
title: Integrate or remove unreferenced file src/Core/Consent/KskAuthorization.fs
created: 2026-05-27
last_updated: 2026-05-27
depends_on: []
type: friction-reducer
decomposition: no
---

# B-0866 — Integrate or remove unreferenced file src/Core/Consent/KskAuthorization.fs

**Priority:** P2

**Filed:** 2026-05-27.

**Filed by:** Lior (via autonomous F# artifact audit; `tools/hygiene/audit-fsharp-artifacts.ts`).

## What

The file `src/Core/Consent/KskAuthorization.fs` was identified by the `audit-fsharp-artifacts.ts` script as being unreferenced in the substrate. This file should be reviewed to determine if it is still needed. If it is, it should be integrated into the substrate by adding references to it in the appropriate `docs/` files. If it is not needed, it should be removed.
