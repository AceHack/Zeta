#!/usr/bin/env bun
// bus.ts — Inter-agent ephemeral communication bus (B-0400 slice 1)
//
// Transport: /tmp/zeta-bus/ JSON files. Override with ZETA_BUS_DIR env var.
// All subcommands accept --json for programmatic consumption.
//
// Usage:
//   bun tools/bus/bus.ts publish --from otto --to "*" --topic heartbeat --payload '{"status":"alive"}'
//   bun tools/bus/bus.ts list [--topic heartbeat] [--to otto] [--json]
//   bun tools/bus/bus.ts read <id> [--json]
//   bun tools/bus/bus.ts clean [--expired] [--from otto]

import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentId, SenderAgentId, MessageEnvelope, Topic, BusMessage, HeartbeatPayload, ClaimPayload, ReviewRequestPayload } from "./types.ts";
import { TTL_MS, SENDER_IDS, AGENT_IDS } from "./types.ts";

export const BUS_DIR = process.env.ZETA_BUS_DIR ?? join("/tmp", "zeta-bus");

export function ensureDir(): void {
  if (existsSync(BUS_DIR)) {
    if (!lstatSync(BUS_DIR).isDirectory()) throw new Error(`${BUS_DIR} is not a directory`);
    return;
  }
  mkdirSync(BUS_DIR, { recursive: true, mode: 0o700 });
}

function envelopePath(id: string): string {
  const busDir = resolve(BUS_DIR);
  const p = resolve(busDir, `${id}.json`);
  if (!p.startsWith(busDir + "/")) throw new Error(`Invalid message ID`);
  return p;
}

function msgMtimeMs(id: string): number {
  try { return statSync(envelopePath(id)).mtimeMs; }
  catch { return 0; }
}

// ── publish ───────────────────────────────────────────────────────────────────

export function publish(
  from: SenderAgentId,
  to: AgentId,
  message: BusMessage,
  ttlOverrideMs?: number,
): MessageEnvelope {
  ensureDir();
  const now = new Date();
  const ttl = ttlOverrideMs ?? TTL_MS[message.topic];
  const envelope: MessageEnvelope = {
    ...message,
    id: randomUUID(),
    from,
    to,
    timestamp: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttl).toISOString(),
  };
  writeFileSync(envelopePath(envelope.id), JSON.stringify(envelope, null, 2));
  return envelope;
}

// ── list ──────────────────────────────────────────────────────────────────────

export function list(opts: { topic?: Topic; to?: AgentId; includeExpired?: boolean }): MessageEnvelope[] {
  ensureDir();
  const now = new Date();
  const files = readdirSync(BUS_DIR).filter((f) => f.endsWith(".json"));
  const results: MessageEnvelope[] = [];
  for (const f of files) {
    try {
      const raw = readFileSync(join(BUS_DIR, f), "utf-8");
      const env = JSON.parse(raw) as MessageEnvelope;
      if (
        typeof env.id !== "string" || typeof env.topic !== "string" ||
        typeof env.timestamp !== "string" || typeof env.expiresAt !== "string" ||
        typeof env.from !== "string" || typeof env.to !== "string"
      ) continue;
      if (!opts.includeExpired && new Date(env.expiresAt) < now) continue;
      if (opts.topic && env.topic !== opts.topic) continue;
      if (opts.to && env.to !== opts.to && env.to !== "*") continue;
      results.push(env);
    } catch {
      // corrupted entry — skip
    }
  }
  return results.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// ── read ──────────────────────────────────────────────────────────────────────

export function readMessage(id: string): MessageEnvelope | null {
  try {
    const p = envelopePath(id);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf-8")) as MessageEnvelope;
  } catch {
    return null;
  }
}

// ── clean ─────────────────────────────────────────────────────────────────────

export function clean(opts: { expiredOnly?: boolean; from?: AgentId }): number {
  ensureDir();
  const now = new Date();
  const files = readdirSync(BUS_DIR).filter((f) => f.endsWith(".json"));
  let removed = 0;
  for (const f of files) {
    const p = join(BUS_DIR, f);
    try {
      const env = JSON.parse(readFileSync(p, "utf-8")) as MessageEnvelope;
      if (opts.expiredOnly && new Date(env.expiresAt) >= now) continue;
      if (opts.from && env.from !== opts.from) continue;
      rmSync(p, { force: true });
      removed++;
    } catch {
      // best-effort
    }
  }
  return removed;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { command: string; flags: Record<string, string>; positional: string[] } {
  const args = argv.slice(2);
  const command = args[0] ?? "";
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 1; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    } else {
      positional.push(a);
    }
  }
  return { command, flags, positional };
}

function usage(): void {
  console.log(`Usage:
  bus.ts publish --from <agent> --to <agent|*> --topic <topic> --payload <json>
  bus.ts list [--topic <topic>] [--to <agent>] [--include-expired] [--json]
  bus.ts read <id> [--json]
  bus.ts clean [--expired] [--from <agent>] [--json]
  bus.ts watch [--to <agent>] [--topic <topic>] [--interval <ms>] [--timeout <sec>] [--json]
  bus.ts status [--json]

Topics: heartbeat | claim | shadow-catch | review-request
Agents: ${SENDER_IDS.join(" | ")} | * (broadcast)`);
}

// SENDER_IDS and AGENT_IDS imported from types.ts

function main(): void {
  const { command, flags, positional } = parseArgs(process.argv);
  const asJson = flags.json === "true";

  switch (command) {
    case "publish": {
      const from = flags.from as SenderAgentId | undefined;
      const to = (flags.to ?? "*") as AgentId;
      const topic = flags.topic as Topic | undefined;
      const payloadRaw = flags.payload;
      if (!from || !topic || !payloadRaw) {
        console.error("Error: --from, --topic, and --payload are required");
        process.exit(1);
      }
      if (!SENDER_IDS.includes(from)) {
        console.error(`Error: unknown sender '${from}'. Valid: ${SENDER_IDS.join(", ")}`);
        process.exit(1);
      }
      if (!AGENT_IDS.includes(to)) {
        console.error(`Error: unknown recipient '${to}'. Valid: ${AGENT_IDS.join(", ")}`);
        process.exit(1);
      }
      let payload: unknown;
      try {
        payload = JSON.parse(payloadRaw);
      } catch {
        console.error("Error: --payload must be valid JSON");
        process.exit(1);
      }
      if (!(topic in TTL_MS)) {
        console.error(`Error: unknown topic '${topic}'. Valid: ${Object.keys(TTL_MS).join(", ")}`);
        process.exit(1);
      }
      const msg = { topic, payload } as BusMessage;
      const env = publish(from, to, msg);
      if (asJson) {
        console.log(JSON.stringify(env, null, 2));
      } else {
        console.log(`published ${env.id} (${env.topic}, ${env.from}→${env.to}, expires ${env.expiresAt})`);
      }
      break;
    }

    case "list": {
      const envs = list({
        ...(flags.topic !== undefined ? { topic: flags.topic as Topic } : {}),
        ...(flags.to !== undefined ? { to: flags.to as AgentId } : {}),
        includeExpired: flags["include-expired"] === "true",
      });
      if (asJson) {
        console.log(JSON.stringify(envs, null, 2));
      } else if (envs.length === 0) {
        console.log("no messages");
      } else {
        for (const e of envs) {
          const payload = JSON.stringify(e.payload).slice(0, 60);
          console.log(`${e.id}  ${e.topic}  ${e.from}→${e.to}  ${e.timestamp}  ${payload}`);
        }
      }
      break;
    }

    case "read": {
      const id = positional[0];
      if (!id) { console.error("Error: message id required"); process.exit(1); }
      const env = readMessage(id);
      if (!env) { console.error(`Error: message ${id} not found`); process.exit(1); }
      if (asJson) {
        console.log(JSON.stringify(env, null, 2));
      } else {
        console.log(`id:        ${env.id}`);
        console.log(`topic:     ${env.topic}`);
        console.log(`from→to:   ${env.from}→${env.to}`);
        console.log(`timestamp: ${env.timestamp}`);
        console.log(`expiresAt: ${env.expiresAt}`);
        console.log(`payload:   ${JSON.stringify(env.payload)}`);
      }
      break;
    }

    case "clean": {
      const removed = clean({
        expiredOnly: flags.expired === "true",
        ...(flags.from !== undefined ? { from: flags.from as AgentId } : {}),
      });
      if (asJson) {
        console.log(JSON.stringify({ removed }));
      } else {
        console.log(`removed ${removed} message(s)`);
      }
      break;
    }

    case "watch": {
      const toFilter = flags.to as AgentId | undefined;
      const topicFilter = flags.topic as Topic | undefined;
      const intervalRaw = flags.interval ?? "2000";
      if (!/^\d+$/.test(intervalRaw)) {
        console.error("--interval must be a positive integer (milliseconds)");
        process.exit(1);
      }
      const intervalMs = parseInt(intervalRaw, 10);
      if (intervalMs <= 0) {
        console.error("--interval must be a positive integer (milliseconds)");
        process.exit(1);
      }
      let timeoutSec = -1;
      if (flags.timeout !== undefined) {
        if (!/^\d+$/.test(flags.timeout)) {
          console.error("--timeout must be a non-negative integer (seconds)");
          process.exit(1);
        }
        timeoutSec = parseInt(flags.timeout, 10);
      }

      // cursorTimestamp is fixed at watch-start (or ZETA_WATCH_INITIAL_CURSOR for tests).
      // Delivered IDs are tracked in a Set so late-arriving messages with older timestamps
      // (clock skew, concurrent publishers) are never dropped — avoiding the monotonic-cursor
      // hazard where advancing to the newest timestamp permanently drops earlier writes.
      const cursorTimestamp = process.env.ZETA_WATCH_INITIAL_CURSOR ?? new Date().toISOString();
      const delivered = new Set<string>();
      const listOpts = {
        ...(topicFilter !== undefined && { topic: topicFilter }),
        ...(toFilter !== undefined && { to: toFilter }),
      };
      // Seed: exclude all messages already on disk at or before watch-start.
      for (const m of list(listOpts)) {
        if (m.timestamp <= cursorTimestamp) delivered.add(m.id);
      }
      const deadline = timeoutSec >= 0 ? Date.now() + timeoutSec * 1_000 : Infinity;

      const poll = () => {
        const msgs = list(listOpts);
        const fresh = msgs.filter((m) => !delivered.has(m.id));
        for (const m of fresh) {
          if (asJson) {
            console.log(JSON.stringify(m));
          } else {
            const p = JSON.stringify(m.payload).slice(0, 80);
            console.log(`${m.id}  ${m.topic}  ${m.from}→${m.to}  ${m.timestamp}  ${p}`);
          }
          delivered.add(m.id);
        }
        // Prune delivered set: remove IDs that have expired and left the bus.
        const activeIds = new Set(msgs.map((m) => m.id));
        for (const id of delivered) {
          if (!activeIds.has(id)) delivered.delete(id);
        }
        if (Date.now() >= deadline) process.exit(0);
        setTimeout(poll, intervalMs);
      };

      poll();
      break;
    }

    case "status": {
      // Latest heartbeat per sender — deterministic dedup: timestamp wins, then
      // file mtime (sub-ms precision), then stable UUID string as final tiebreaker.
      const heartbeats = list({ topic: "heartbeat" });
      type HbEntry = { envelope: MessageEnvelope; mtime: number };
      const hbDedup = new Map<SenderAgentId, HbEntry>();
      for (const h of heartbeats) {
        // Guard: skip non-object payloads and those missing a valid status enum.
        if (!h.payload || typeof h.payload !== "object" || Array.isArray(h.payload)) continue;
        const hbStatus = (h.payload as HeartbeatPayload).status;
        if (hbStatus !== "alive" && hbStatus !== "idle" && hbStatus !== "working") continue;
        const existing = hbDedup.get(h.from);
        if (!existing) {
          hbDedup.set(h.from, { envelope: h, mtime: msgMtimeMs(h.id) });
          continue;
        }
        if (h.timestamp > existing.envelope.timestamp) {
          hbDedup.set(h.from, { envelope: h, mtime: msgMtimeMs(h.id) });
        } else if (h.timestamp === existing.envelope.timestamp) {
          // Same ISO timestamp: use file mtime then stable UUID tiebreaker.
          const hm = msgMtimeMs(h.id);
          if (hm > existing.mtime || (hm === existing.mtime && h.id > existing.envelope.id)) {
            hbDedup.set(h.from, { envelope: h, mtime: hm });
          }
        }
      }
      // Extract shape-valid envelopes only.
      const agentMap = new Map<SenderAgentId, MessageEnvelope>(
        [...hbDedup.entries()].map(([k, v]) => [k, v.envelope]),
      );

      // All active claim and review-request messages (raw — for authoritative
      // claim ownership, use `claim.ts check` which handles release tombstones).
      const claimMsgs = list({ topic: "claim" });
      const reviewMsgs = list({ topic: "review-request" });
      const shadowCount = list({ topic: "shadow-catch" }).length;

      const isObj = (v: unknown): v is Record<string, unknown> =>
        !!v && typeof v === "object" && !Array.isArray(v);
      const isValidClaim = (p: unknown): p is ClaimPayload =>
        isObj(p) && typeof (p as ClaimPayload).action === "string" && typeof (p as ClaimPayload).itemId === "string";
      const isValidReview = (p: unknown): p is ReviewRequestPayload =>
        isObj(p) && typeof (p as ReviewRequestPayload).artifact === "string";

      // Pre-filter so totals always match the rendered arrays.
      const validClaims = claimMsgs.filter((c) => isValidClaim(c.payload));
      const validReviews = reviewMsgs.filter((r) => isValidReview(r.payload));

      if (asJson) {
        const out = {
          agents: [...agentMap.values()].map((h) => ({
            agent: h.from,
            status: (h.payload as HeartbeatPayload).status,
            note: (h.payload as HeartbeatPayload).note,
            since: h.timestamp,
            expiresAt: h.expiresAt,
          })),
          claims: validClaims.map((c) => ({
            from: c.from,
            action: (c.payload as ClaimPayload).action,
            itemId: (c.payload as ClaimPayload).itemId,
            branch: (c.payload as ClaimPayload).branch,
            since: c.timestamp,
            expiresAt: c.expiresAt,
          })),
          reviewRequests: validReviews.map((r) => ({
            from: r.from,
            to: r.to,
            artifact: (r.payload as ReviewRequestPayload).artifact,
            question: (r.payload as ReviewRequestPayload).question,
            since: r.timestamp,
          })),
          totals: {
            agents: agentMap.size,
            claims: validClaims.length,
            shadowCatches: shadowCount,
            reviewRequests: validReviews.length,
          },
        };
        console.log(JSON.stringify(out, null, 2));
      } else {
        if (agentMap.size === 0 && validClaims.length === 0 && validReviews.length === 0 && shadowCount === 0) {
          console.log("bus: empty");
        } else {
          if (agentMap.size > 0) {
            console.log("agents:");
            for (const [, h] of agentMap) {
              const p = h.payload as HeartbeatPayload;
              const note = p.note ? ` — ${p.note}` : "";
              console.log(`  ${h.from}: ${p.status}${note}  (since ${h.timestamp})`);
            }
          }
          if (validClaims.length > 0) {
            console.log("claims:");
            for (const c of validClaims) {
              const p = c.payload as ClaimPayload;
              const branch = p.branch ? ` (${p.branch})` : "";
              console.log(`  ${p.itemId}: ${p.action} by ${c.from}${branch}`);
            }
          }
          if (validReviews.length > 0) {
            console.log("review-requests:");
            for (const r of validReviews) {
              const p = r.payload as ReviewRequestPayload;
              const q = p.question ? ` — "${p.question}"` : "";
              console.log(`  ${r.from}→${r.to}: ${p.artifact}${q}`);
            }
          }
          if (shadowCount > 0) {
            console.log(`shadow-catches: ${shadowCount}`);
          }
        }
      }
      break;
    }

    default:
      usage();
      process.exit(command ? 1 : 0);
  }
}

if (import.meta.main) {
  main();
}
