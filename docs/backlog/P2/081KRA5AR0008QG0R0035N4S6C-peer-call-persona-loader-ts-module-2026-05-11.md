---
id: 081KRA5AR0008QG0R0035N4S6C
priority: P2
status: open
title: Peer-call persona-loader.ts — shared CURRENT-*.md loader with clear error (081KQDTYV0008QG0R001VJP216 child)
parent: 081KQDTYV0008QG0R001VJP216
tier: factory-tooling
effort: S
ask: New TS module tools/peer-call/persona-loader.ts that exports loadPersona(name): Promise<string> — reads memory/CURRENT-${name}.md or throws typed error that callers render as an exit-1 message. No CLI parsing or process exit here. Used by all three entrypoints. Pure TS, Bun fs.
created: 2026-05-11
last_updated: 2026-05-11
depends_on:
  - 081KRA5AR0008QG0R000Y6102S
composes_with:
  - tools/peer-call/grok.ts
  - tools/peer-call/gemini.ts
  - tools/peer-call/codex.ts
tags: [riven-2026-05-11, peer-call, ts-first, module-extract]
type: implementation
decomposition: atomic
classification: blocked-on-081KRA5AR0008QG0R000Y6102S
---

# 081KRA5AR0008QG0R0035N4S6C — Peer-call persona-loader.ts (shared module)

## Source

Depends on 081KRA5AR0008QG0R000Y6102S survey. Extracts the duplicated persona load into single source of truth so flag impl is 3 lines.

## What

Implement `tools/peer-call/persona-loader.ts`:

- async function loadPersona(name: string): Promise<string>
- Uses Bun.file, readFile, UTF8
- On missing: throw a typed `PersonaLoadError` or return an error value; entrypoints decide console rendering and exit code
- On success: return the markdown string (for injection as Layer 1)

## Acceptance criteria

- [ ] Standard repo gate remains applicable: `dotnet build -c Release` and `dotnet test Zeta.sln -c Release` are not waived by this row
- [ ] Focused TS check or Bun test covers the module
- [ ] Unit test (minimal) covers missing-file error path
- [ ] Zero duplication with existing scripts

## Out of scope

- No CLI flag parsing
- No deprecation wrappers
- No docs update

This is the data-plane primitive the refactor rests on. TS-first per Rule 0.
