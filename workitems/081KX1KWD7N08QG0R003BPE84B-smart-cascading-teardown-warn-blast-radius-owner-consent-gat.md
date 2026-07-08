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
   - persona memories (**persona-consent-required** — HC-9 / GOVERNANCE §36)
   - physical hardware state tied to keys
   - unrecoverable encrypted data (G-set residual; human owner-consent / refuse-cross-user)
3. **Persona-consent gate (binding):** a human must not wipe persona memory without that
   persona's permission. Human biometric / `--confirm` alone is insufficient.
   Still refuse cross-human Personal-vault force-reset.
4. Dry-run default; `--confirm` + biometric still required for destructive *key* path
5. Tests in `cascade-teardown.test.ts` + gap-closed assertion in `onboarding-roundtrip.test.ts`
6. Round-trip harness still green (sandbox-only)

## Slice 1 — plan + gates, no live memory wipe (landed #9512)

Planner + classification + consent refusal. CLI `--cascade` prints the plan.

## Slice 1b — persona-consent binding (this change)

Rename/clarify consent model: `persona-consent-required` + `refuse-human-unilateral`.
Human-only consent must fail persona-memory authorization. Policy: ALIGNMENT HC-9,
GOVERNANCE §36. Still no live memory-store deletion.

## Anchors

Research doc above; `teardown.ts` (#9000); manifesto §5/§6; round-trip harness.
