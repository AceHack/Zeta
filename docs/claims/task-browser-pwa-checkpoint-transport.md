# Claim - task-browser-pwa-checkpoint-transport

- **Session ID:** codex/20260808-bpct
- **Harness:** codex
- **Claimed at:** 2026-08-08T17:54:51Z
- **ETA:** 2026-08-08T21:00:00Z
- **Scope:** Select a controlled service worker for Dark Hall tab coordination, fall back to BroadcastChannel, and expose the selected transport in the room readout.
- **Durable target:** `src/Core.TypeScript/browser-node/`, `src/Core.TypeScript/darkhall-ui/`, tests, and PR
- **Platform mirror:** none

## Notes

Builds on the bounded service-worker checkpoint relay and its controlled-before-rooms lifecycle. The browser tab coordinator remains transport-agnostic.
