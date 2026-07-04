---
id: 081KZETA0007040005
priority: P1
status: open
title: Flip ZETA_EXECUTOR=codegen on live cron tick — first autonomous code generation
created: 2026-07-04
last_updated: 2026-07-04
depends_on: []
tags: [observe-loop, codegen, autonomous, executor, cron]
type: task
---

# Flip ZETA_EXECUTOR=codegen on live cron tick

Everything is wired (codegen-executor.ts, run-loop-real.ts, backlog reader fixed).
Set ZETA_EXECUTOR=codegen in the cron environment and let the observe loop fire
Claude on an actual backlog item for the first time.

## Acceptance criteria

- The cron tick (launchd plist or equivalent) exports ZETA_EXECUTOR=codegen
- First real tick picks an unblocked P1 item and invokes Claude CLI
- Claude produces code on a claim branch (not just a claim file)
- The branch is pushed to origin
- Observe event log records the do_item execution (Started/Succeeded/Failed)
- If the tick fails (Claude errors, timeout), the system degrades gracefully
  (event logged as Failed, item stays in backlog for next tick)
