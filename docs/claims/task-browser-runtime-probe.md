# Claim - task-browser-runtime-probe

- **Session ID:** 8FEA1E1D-C345-42B7-B2A9-C3FE3B31B6FB
- **Harness:** codex
- **Claimed at:** 2026-08-01T03:35:50Z
- **ETA:** 2026-08-01T05:00:00Z
- **Scope:** Add a deterministic browser runtime capability probe and repair the unclaimed markdown/TypeScript gate failures found while publishing it.
- **Durable target:** `src/Core.TypeScript/browser-node/`, the failing installer/WASM/verifier gate surfaces, and a pull request against `main`.
- **Platform mirror:** none

## Notes

Runtime work owns capability observation only. Mesh transport, discovery,
realtime serving, and renderer integration remain outside the claim. Gate repair
is limited to the failures reported by `preflight:quick` at claim publication.
