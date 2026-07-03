#!/usr/bin/env bun
// open-backlog.ts — fold work-item events → open backlog Z-set view (081KSXN slice 2b).
//
// Usage:
//   bun src/Core.TypeScript/backlog/open-backlog.ts [--dir workitems] [--json]
//
// Exit codes: 0 ok · 2 usage error.

import { foldWorkItemEvents, openWorkItems } from "../work-items/fold";
import { readEventsFromRoot } from "../work-items/read-events";
import { workItemEventsRoot } from "./new-workitem";

function main(argv: readonly string[]): number {
  const dirIdx = argv.indexOf("--dir");
  const dir = dirIdx >= 0 ? argv[dirIdx + 1]! : "workitems";
  const asJson = argv.includes("--json");

  const events = readEventsFromRoot(workItemEventsRoot(dir));
  const projections = foldWorkItemEvents(events);
  const open = openWorkItems(projections);

  if (asJson) {
    process.stdout.write(`${JSON.stringify(open, null, 2)}\n`);
    return 0;
  }

  if (open.length === 0) {
    process.stdout.write("(no open work-items in event log)\n");
    return 0;
  }

  for (const item of open) {
    process.stdout.write(`${item.workItemId}\t${item.state}\t${item.lastEventAt}\n`);
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
