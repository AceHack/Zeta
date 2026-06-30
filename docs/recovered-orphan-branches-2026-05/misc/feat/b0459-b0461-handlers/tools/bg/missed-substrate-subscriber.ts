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

export async function missedSubstrateCascadeHandler(envelope: any) {
  const payload = envelope.payload;
  
  if (!payload || !payload.prNumber || !payload.branchRef) {
    console.warn(`[subscriber] Malformed envelope ${envelope.id}: missing prNumber or branchRef`);
    const shardPath = getTickShardPath();
    try {
      appendFileSync(shardPath, `\n- [bus/missed-substrate-cascade] WARNING: Consumed malformed envelope ${envelope.id}`);
    } catch {}
    return;
  }
  
  const shardPath = getTickShardPath();
  const logEntry = `\n- [bus/missed-substrate-cascade] Consumed envelope ${envelope.id}: prNumber=${payload.prNumber}, branchRef=${payload.branchRef}, missedCommitCount=${payload.missedCommitCount}, rationale="${payload.rationale}"`;
  
  try {
    appendFileSync(shardPath, logEntry);
    console.log(`[subscriber] Logged missed-substrate-cascade to tick shard.`);
  } catch (err) {
    console.error(`[subscriber] Failed to write to tick shard:`, err);
  }

  // Reports the drift to the tick output
  console.log(`[subscriber] MISSED SUBSTRATE CASCADE DETECTED! PR #${payload.prNumber} branch ${payload.branchRef} has ${payload.missedCommitCount} missed commits. Open a recovery PR manually if needed.`);
}

if (import.meta.main) {
  const surface = "otto"; // the agent running this
  subscribeOnce("missed-substrate-cascade", surface, missedSubstrateCascadeHandler).catch(console.error);
}
