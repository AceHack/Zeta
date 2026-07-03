#!/usr/bin/env bun
// dora-metrics.ts — DORA Bag-folds over work-item events (081KSXN slice 3).
//
// Usage:
//   bun src/Core.TypeScript/backlog/dora-metrics.ts [--dir workitems]
//
// Exit codes: 0 ok

import { computeDoraMetrics } from "../work-items/dora-fold";
import { readEventsFromRoot } from "../work-items/read-events";
import { workItemEventsRoot } from "./new-workitem";

function main(argv: readonly string[]): number {
  const dirIdx = argv.indexOf("--dir");
  const dir = dirIdx >= 0 ? argv[dirIdx + 1]! : "workitems";

  const events = readEventsFromRoot(workItemEventsRoot(dir));
  const metrics = computeDoraMetrics(events);
  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
