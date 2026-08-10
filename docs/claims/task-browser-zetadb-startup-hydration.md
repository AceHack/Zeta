# Claim - task-browser-zetadb-startup-hydration

- **Session ID:** codex/0809-hydr
- **Harness:** OpenAI Codex - Vera (GPT-5.5 max)
- **Claimed at:** 2026-08-10T00:33:02Z
- **ETA:** 2026-08-10T02:00:00Z
- **Scope:** Hydrate the production Dark Hall browser page from its persisted ZetaDB image before reporting the page live.
- **Durable target:** `src/Core.TypeScript/darkhall-ui/darkhall-browser-page.ts`, its focused tests, the browser PWA smoke, and this claim.
- **Platform mirror:** GitHub pull request.

## Evidence

- The active browser page starts service-worker transport and lifecycle coordination but does not compose the source-owned browser ZetaDB runtime.
- The real multi-tab fixture already proves finite peer-triggered rereads, while a freshly opened production page still waits without reading its existing database image.

## Exit

- Active-page startup performs one bounded empty-delta database tick before reporting `live`.
- The page runtime exposes bounded database ticks and its current database readout.
- A real Chromium PWA smoke writes a row, closes the writer, and proves a fresh page reconstructs that row from IndexedDB without a peer invalidation.
- Focused and repository gates are green.
