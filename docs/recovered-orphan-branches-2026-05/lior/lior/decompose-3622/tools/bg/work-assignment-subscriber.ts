#!/usr/bin/env bun
import { subscribeOnce } from "../bus/subscribe";
import { join } from "node:path";
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Ensure the directory for tick shards exists (or mock it in tests)
function getTickShardPath(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hhmm = `${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}Z`;
  
  const dir = join(process.cwd(), "docs", "hygiene-history", "ticks", String(yyyy), mm, dd);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return join(dir, `${hhmm}.md`);
}

export async function workAssignmentHandler(envelope: any) {
  const payload = envelope.payload;
  
  if (!payload || !payload.rowId) {
    console.warn(`[subscriber] Malformed envelope ${envelope.id}: missing rowId`);
    const shardPath = getTickShardPath();
    try {
      appendFileSync(shardPath, `\n- [bus/work-assignment] WARNING: Consumed malformed envelope ${envelope.id} (missing rowId)`);
    } catch {}
    return;
  }
  
  // Log envelope content to current tick shard
  const shardPath = getTickShardPath();
  const logEntry = `\n- [bus/work-assignment] Consumed envelope ${envelope.id}: rowId=${payload.rowId}, priority=${payload.priority}, rationale="${payload.rationale}"`;
  
  try {
    appendFileSync(shardPath, logEntry);
    console.log(`[subscriber] Logged assignment ${payload.rowId} to tick shard.`);
  } catch (err) {
    console.error(`[subscriber] Failed to write to tick shard:`, err);
  }

  // Action stub: Queue it for step 3
  console.log(`[subscriber] Queued row ${payload.rowId} as speculative-work candidate for step 3.`);

  // Optional AC: invoke claim acquire
  console.log(`[subscriber] Attempting to claim ${payload.rowId}...`);
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync(
    "bun",
    ["tools/bus/claim.ts", "acquire", "--from", "otto", "--item", payload.rowId],
    { stdio: "inherit" }
  );

  if (result.status === 0) {
    console.log(`[subscriber] Successfully claimed ${payload.rowId}.`);
  } else {
    console.log(`[subscriber] Failed to claim ${payload.rowId} (conflict or error). Skipping.`);
  }
}

if (import.meta.main) {
  const surface = "otto"; // the agent running this
  subscribeOnce("work-assignment", surface, workAssignmentHandler).catch(console.error);
}
