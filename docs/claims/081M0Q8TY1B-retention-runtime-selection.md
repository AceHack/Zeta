# Claim - 081M0Q8TY1B-retention-runtime-selection

- **Session ID:** 019e9b66-retention-selection
- **Harness:** codex
- **Claimed at:** 2026-08-25T13:46:22Z
- **ETA:** 2026-08-25T18:00:00Z
- **Scope:** Make the existing ZetaDB retention policies selectable at scheduled and browser runtime boundaries.
- **Durable target:** `src/Core.TypeScript/zetadb/retention-policy.ts`, `src/Core.TypeScript/zetadb/scheduled-node.ts`, and `src/Core.TypeScript/browser-node/browser-zetadb-image-port.ts`
- **Platform mirror:** pending pull request

## Notes

The content-addressed storage adapter remains no-forget because evicting an existing
content record would violate its write/read contract. This claim covers generic node
wakes and scheduled journal folds only.
