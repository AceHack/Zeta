---
id: 081KRFA460008QG0R0028CR0N9
priority: P1
status: closed
title: "Shadow observer slice 5 — Zeta CLI distribution + demo packaging"
tier: product-feature
effort: XS
created: 2026-05-13
last_updated: 2026-05-13
parent: 081KR7JY10008QG0R0008NGW95
depends_on: [081KRFA460008QG0R000GVCKHE]
classification: buildable-now
decomposition: atomic
owners: [architect]
type: feature
tags: [shadow, autocomplete, cli, distribution, demo, glass-halo]
---

# Shadow observer slice 5 — Zeta CLI distribution + demo packaging

## Origin

081KR7JY10008QG0R0008NGW95 decomposition 2026-05-13. Final slice: make `zeta shadow` part of the
installed Zeta surface and ready for an external CLI demo.

## Acceptance criteria from 081KR7JY10008QG0R0008NGW95 this slice satisfies

- [x] Deployable as part of Zeta CLI install

## Technical context

After slice 4 (081KRFA460008QG0R000GVCKHE) lands `tools/shadow/zeta-shadow.ts` and a `package.json`
`scripts.shadow` entry, this slice promotes it to a proper `bin` entry and adds
the README section + end-to-end smoke test that validates the full install path.

## Scope

### `package.json` `bin` field

Add:
```json
"bin": {
  "zeta-shadow": "tools/shadow/zeta-shadow.ts"
}
```

This makes `zeta-shadow` available via `bun link` in a local workspace, or
available on PATH after the package is published and installed. Note: the root
`package.json` is currently `private: true`; global install requires either
`bun link` (dev) or publishing to a registry first.

### README section

Add a `## Shadow mode` section to `tools/shadow/README.md` (create if absent):

- Installation: `bun install && bun run shadow -- --dry-run --once`
- Flags: `--delay`, `--detect-cmd`, `--dry-run`, `--once`, `--loop-interval`,
  `--loop`, `--log-file`
- Glass Halo: explain that all shadow submissions are logged to
  `tools/shadow/shadow-observer.log` with `(shadow)` attribution
- Safety model: human is live circuit breaker; `Ctrl-C` = immediate stop
- Demo recipe: `zeta-shadow --detect-cmd "your-script.sh" --delay 2000` for
  an external UI demo

### Glass Halo log format note

The existing log format (JSON per line, `type: "accepted" | "overridden" | …`)
is already Glass Halo compliant. Add a one-liner to README showing a sample
`accepted` event so the demo presenter can point to it.

### End-to-end smoke test

Add `tools/shadow/smoke-test.ts`:

- Runs `bun tools/shadow/zeta-shadow.ts --once --dry-run --detect-cmd "echo hello"`
- Asserts exit code 0
- Asserts log file contains `"type":"accepted"` line

Invoke from `bun test` via `smoke-test.test.ts` (or add as a `scripts` entry).

### Tests (3 new, ~50 total, 0 failures)

- 1 smoke test: `bun tools/shadow/zeta-shadow.ts --once --dry-run --detect-cmd "echo hello"` exits 0
- 1 smoke test: log file written with `(shadow)` attribution
- 1 validation test: `package.json` `bin["zeta-shadow"]` entry points to an existing file

## Acceptance

- [x] `package.json` `bin["zeta-shadow"]` entry present and points to valid file
- [x] `tools/shadow/README.md` has `## Shadow mode` section with flags + Glass Halo note
- [x] End-to-end smoke test passes (`bun test tools/shadow/smoke-test.test.ts`)
- [x] 3 new tests, 0 failures
- [x] "Deployable as part of Zeta CLI install" 081KR7JY10008QG0R0008NGW95 criterion satisfied

## Pre-start checklist

**Prior-art search** *(state at time of authoring; all items below are now implemented)*:

- `package.json` `bin` — was empty at authoring; `bin["zeta-shadow"]` added in this slice
- `tools/shadow/README.md` — did not exist at authoring; created with `## Shadow mode` section in this slice
- 081KR7JY10008QG0R0008NGW95 acceptance criteria: "Deployable as part of Zeta CLI install — slice 4"

**Dependency check:**

- `depends_on: [081KRFA460008QG0R000GVCKHE]` — needs `zeta-shadow.ts` entry point from slice 4
- `parent: 081KR7JY10008QG0R0008NGW95`
