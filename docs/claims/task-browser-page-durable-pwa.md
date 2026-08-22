# Claim - task-browser-page-durable-pwa

- **Session ID:** codex/20260822-bpdp
- **Harness:** codex
- **Claimed at:** 2026-08-22T15:42:00Z
- **ETA:** 2026-08-22T19:42:00Z
- **Scope:** Wire the shipped Dark Hall browser page through the durable room and causal checkpoint composition.
- **Durable target:** `src/Core.TypeScript/darkhall-ui/`, focused browser tests, the real PWA smoke path, and this claim.
- **Platform mirror:** none

## Notes

Builds on merged PR #13007. The page must recover room and causal state through
the owned IndexedDB checkpoint port, drain pending writes before shutdown, and
retain typed backpressure instead of silently dropping unfinished persistence.
The claim also carries the eight-path workitem reference repair found by the
mandatory pre-push auto-vivify gate before this branch could publish.
