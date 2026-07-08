---
id: 081KX1KWD7N08QG0R003BPE84B
type: task
state: in_progress
priority: P1
slug: smart-cascading-teardown-warn-blast-radius-owner-consent-gat
title: "Smart cascading teardown: warn + blast-radius + owner-consent gates on extra-care nodes"
created: 2026-07-08T19:38:00.000Z
depends_on: []
composes_with: ["081KVP2M1QS08QG0R000JSXE1E", "081KVNXBR4S08QG0R0015DHBBN"]
---

# Smart cascading teardown: warn + blast-radius + owner-consent gates

## Why

Design already exists (`docs/research/2026-06-21-smart-cascading-teardown-user-sovereign-deletion-each-user-own-git-repo.md`).
Teardown primitive shipped (#9000) + lifecycle triad closed (#9022). Missing: cascade-with-warnings,
extra-care stop nodes, owner-consent for memories, refuse force-reset of another's encrypted vault.

## Done when

1. `tools/setup/persona-keys/cascade-teardown.ts` (or extend `teardown.ts`) that:
   - enumerates dependents (machines/certs/registrations tied to the target key/CA)
   - returns a **blast-radius plan** before any wipe
   - classifies nodes: `cascade` | `extra-care-warn` | `owner-consent-required` | `refuse-cross-user`
2. Extra-care classes (warn + explicit ack, never silent auto-delete):
   - persona memories
   - physical hardware state tied to keys
   - unrecoverable encrypted data (G-set residual)
3. Owner-consent gate: refuse deleting another user's memories / force-resetting their Personal vault
4. Dry-run default; `--confirm` + biometric still required for destructive path
5. Tests in `cascade-teardown.test.ts` + gap-closed assertion in `onboarding-roundtrip.test.ts`
6. Round-trip harness still green (sandbox-only)

## Slice 1 (this PR) — plan + gates, no live memory wipe

Ship the **planner + classification + consent refusal** with injected effects. Do not implement
real memory-store deletion yet — assert the gate refuses cross-user and requires owner ack for
extra-care. Wire CLI flag `--cascade` on teardown-cli that prints the plan.

## Anchors

Research doc above; `teardown.ts` (#9000); manifesto §5/§6; round-trip harness.
