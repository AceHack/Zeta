---
id: 081KRQ1AB0008QG0R003WPKZ69
priority: P1
status: open
title: "Riven Cursor Terminal loop graceful shutdown tombstone"
tier: agent-infrastructure
effort: S
created: 2026-05-16
last_updated: 2026-05-16
renumbered_from: 081KRQ1AB0008QG0R000SASDNE
depends_on: [081KRMEXM0008QG0R00037RGNY]
tags: [riven, cursor, terminal, background-service, graceful-shutdown]
type: feature
---

# Riven Cursor Terminal loop graceful shutdown tombstone

## Origin

Decomposed from 081KRMEXM0008QG0R00037RGNY. To keep the initial IDE-native autonomous gate focused, the graceful shutdown and tombstone broadcast logic is peeled off into this atomic task.

## Acceptance criteria

- [ ] Terminal close or process termination is trapped (`SIGINT`, `SIGTERM`, window close).
- [ ] Writes a tombstone to the broadcast bus (`topic: "tombstone"`) indicating offline status.
- [ ] Releases any in-flight claims associated with the terminal loop instance.
- [ ] Cleans up the `~/.cursor/riven-terminal-loop-state.json` lockfile.
