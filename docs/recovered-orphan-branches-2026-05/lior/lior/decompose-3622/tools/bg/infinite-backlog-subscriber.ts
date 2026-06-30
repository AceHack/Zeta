#!/usr/bin/env bun
import { subscribeOnce } from "../bus/subscribe";
import { join } from "node:path";
import { appendFileSync, mkdirSync, existsSync } from "node:fs";

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

export async function infiniteBacklogNudgeHandler(envelope: any) {
  const payload = envelope.payload;
  
  if (!payload || payload.idleMinutes === undefined) {
    console.warn(`[subscriber] Malformed envelope ${envelope.id}: missing idleMinutes`);
    const shardPath = getTickShardPath();
    try {
      appendFileSync(shardPath, `\n- [bus/infinite-backlog-nudge] WARNING: Consumed malformed envelope ${envelope.id}`);
    } catch {}
    return;
  }
  
  const shardPath = getTickShardPath();
  const logEntry = `\n- [bus/infinite-backlog-nudge] Consumed envelope ${envelope.id}: idleMinutes=${payload.idleMinutes}, rationale="${payload.rationale}"`;
  
  try {
    appendFileSync(shardPath, logEntry);
    console.log(`[subscriber] Logged infinite-backlog-nudge to tick shard.`);
  } catch (err) {
    console.error(`[subscriber] Failed to write to tick shard:`, err);
  }

  // Action stub: Queue it for step 3
  if (payload.suggestedTargetRow) {
    console.log(`[subscriber] Queued suggested target row ${payload.suggestedTargetRow} as speculative-work candidate for step 3.`);
  } else {
    console.log(`[subscriber] Triggering decomposition or backlog-grind action for step 3.`);
  }
}

if (import.meta.main) {
  const surface = "otto"; // the agent running this
  subscribeOnce("infinite-backlog-nudge", surface, infiniteBacklogNudgeHandler).catch(console.error);
}
