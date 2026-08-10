# Claim - task-browser-database-cas-replace

- **Session ID:** codex-20260810-browser-db-cas
- **Harness:** OpenAI Codex - Vera (GPT-5.5)
- **Claimed at:** 2026-08-10T22:20:57Z
- **ETA:** 2026-08-11T02:00:00Z
- **Scope:** Restore the TypeScript gate, add versioned browser database row selection, implement explicit compare-and-swap replacement through owned controller ports, and exercise the ZetaDB primary storage path.
- **Durable target:** `src/Core.TypeScript/darkhall-ui/`, `src/Core.TypeScript/browser-node/`, focused tests, and this claim.
- **Platform mirror:** [PR #10295](https://github.com/Lucent-Financial-Group/Zeta/pull/10295).

## Boundaries

- Selection remains read-only and does not construct a delta.
- Replacement remains an explicit retract-plus-emit controller command.
- Stale row identity returns typed feedback instead of overwriting newer state.
- IndexedDB remains an adapter; tests must exercise the ZetaDB primary port.
- Existing parallel TypeScript drift is repaired before adding behavior.

## Exit

- Exact TypeScript lint is green.
- Versioned row selection and stale replacement have deterministic tests.
- Replacement flows only through source-owned controller and storage ports.
- ZetaDB primary-path persistence and fallback behavior are both tested.
- The implementation PR is reviewed and merged into `origin/main`.
