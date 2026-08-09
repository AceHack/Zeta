# Claim - task-browser-zetadb-invalidation

- **Session ID:** codex/0809-bd91
- **Harness:** codex
- **Claimed at:** 2026-08-09T22:08:13Z
- **ETA:** 2026-08-10T02:00:00Z
- **Scope:** Relay finite ZetaDB image invalidations across browser tabs and refresh each peer through its own bounded wake.
- **Durable target:** `src/Core.TypeScript/browser-node/`, `src/Core.TypeScript/darkhall-ui/`, and focused tests
- **Platform mirror:** pending PR

## Notes

The service worker remains a message relay. It does not own or continuously execute the database.
