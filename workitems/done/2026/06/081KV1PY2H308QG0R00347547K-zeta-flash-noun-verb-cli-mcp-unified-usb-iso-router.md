---
id: 081KV1PY2H308QG0R00347547K
type: task
state: done
priority: P1
slug: zeta-flash-noun-verb-cli-mcp-unified-usb-iso-router
title: "zeta flash noun-verb CLI + MCP — unified USB/ISO router"
created: 2026-06-14T00:01:34.755Z
completed: 2026-06-14T00:30:00.000Z
depends_on: []
composes_with: ["081KSGS9H0008QG0R001EZKNCB", "081KSNY2Z0008QG0R0008PN7RQ", "081KSGS9H0008QG0R0011BC7T2"]
---

# zeta flash noun-verb CLI + MCP — unified USB/ISO router

## Delivered (PR #8095 stack)

- **CLI:** `zeta flash …` in `src/Core.FSharp.Cli/Program.fs` → `src/Core.TypeScript/zflash/zeta-flash.ts`
- **MCP:** `zeta_flash` tool in `src/Core.FSharp.Mcp/Program.fs` (args = JSON string array)
- **Registration:** `.mcp.json` / `.cursor/mcp.json` point at `src/Core.FSharp.Mcp` (fixes stale `tools/zeta-mcp` path)
- **Skill:** `zflash-overview` blueprint paths updated to `src/Core.TypeScript/zflash/`

## Follow-on (not this workitem)

- **081KSGS9H0008QG0R0011BC7T2** cascade #6 — QEMU full-install + cluster auto-join (separate backlog row)
