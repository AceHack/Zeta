---
id: B-1030
zetaid: 081KT2T2J0008QG0R003ZFLASH1
priority: P1
status: open
title: "zeta flash noun-verb CLI + MCP — unified USB/ISO install-media router over hexagonal zflash ports (composes #7229, B-0844, B-0891)"
effort: M
ask: riven 2026-06-11
created: 2026-06-11
last_updated: 2026-06-11
depends_on: []
composes_with:
  - B-0844
  - B-0891
  - B-0831
tags: [zflash, zeta-cli, mcp, usb, iso, hexagonal, install-media, noun-verb]
---

## Problem

USB/ISO install capabilities live under Bun entrypoints (`cli.ts`, `flash-and-inject.ts`, …).
Operators and agents should invoke **`zeta flash`** (noun–verb grammar + MCP tool), not raw `bun …/zflash/cli.ts` paths.

Research #7229 and ferry docs describe unification; PR #7264 named `zeta flash` as the target surface.

## Scope

- [x] Thin F# shell dispatch: `zeta flash …` → `src/Core.TypeScript/zflash/zeta-flash.ts`
- [x] Router subcommands: `usb`, `inject`, `inspect`, passthrough to mac `cli.ts`
- [ ] MCP tool registration mirroring the same router (no duplicate logic)
- [ ] Skill path update (`flash-cluster-iso`) to cite `zeta flash` not bun paths
- [ ] Trajectory `docs/trajectories/usb-zflash-installer/RESUME.md` path hygiene

## Acceptance

1. `zeta flash --help` and `zeta flash usb --help` work from repo root with bun on PATH.
2. All zflash CLIs live under `src/Core.TypeScript/zflash/` (no `full-ai-cluster/tools/` copies).
3. MCP exposes at least `flash_usb` delegating to the router.
4. CI path filters include `src/Core.TypeScript/zflash/**`.

## Notes

Slice landed in riven/zflash-unify-zeta-flash-cli (router + migration). MCP + skill updates are follow-on within this row.
