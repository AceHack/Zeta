# Zeta portal

The human+agent **top-down view** of the platform — the "UI base for everything".
A dependency-free Bun server (BFF) + a Fluent/Azure-styled SPA. Three views:

- **Resources** — everything deployed, grouped by category (game / web / database /
  app) with health badges, the operating persona, exposure/host, and child objects.
- **Create** — the blueprint catalog. New deployable types appear here as **data**
  (the same engine renders them all); each surfaces its variables for the form.
- **Needs me** — the no-directives action queue: pending authorizations agents
  **proposed**, which only a **human** may grant (source ≠ authorization). Approve /
  Deny posts the grant and clears the item.

## Architecture

```
 Browser (SPA)  ──fetch──►  /api/*  ──►  handle()  ──►  PlatformData
   ui/ (static)              api.ts        (pure)         ├─ K8sPlatform  (live Deployables/Blueprints from the cluster)
                                                          └─ Room source  (git-event-store-backed, once the persona runtime lands)
```

- `src/viewmodel.ts` — **pure** view models (resource groups, catalog, room view,
  needs-me board). Fully unit-tested.
- `src/api.ts` — the BFF: pure request routing over an injected `PlatformData`.
- `src/data-k8s.ts` — reads Deployables + Blueprints live from the k8s API (mounted
  service-account, no heavy dependency). Rooms come from an injected source.
- `src/data-memory.ts` / `src/demo.ts` — in-memory platform + a seeded demo.
- `src/server.ts` — Bun.serve: `/api/*` → BFF, everything else → the static SPA.
- `src/ui/` — the vanilla SPA (index.html + styles.css + app.js), no build step.

## Develop

```bash
bun install
bun test          # 19 tests: view models + BFF endpoints + grant flow
bun run typecheck # tsc --noEmit, strict
bun run demo      # PORTAL_DEMO=1 — runs with seeded data, no cluster, on :8080
bun run start     # in-cluster: live resources from k8s
```

## Seam

The collaboration **Room** pane (the per-resource event stream) and live `needs-me`
data become real when Rooms are persisted to the git-native event store and the
≥3 vendor-diverse personas drive them (COLLABORATION-MODEL §9). The portal already
renders Rooms from any `PlatformData` source — that backend slots in unchanged.
The `Deploy` button activates with the same provisioning flow.
