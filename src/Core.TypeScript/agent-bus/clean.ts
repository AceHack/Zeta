#!/usr/bin/env bun
/**
 * Agent-bus Phase 1 (B-0954) — clean expired envelopes.
 *
 * Scans the agent-bus folder recursively, parses files to check their expiration
 * (expiresAt < now), deletes any expired files locally, stages them, commits,
 * and pushes directly to main.
 */
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { AGENT_BUS_ROOT } from "./types";
import { coauthorFor } from "../../../tools/observe/event-sink-folder";
import type { SenderAgentId } from "../bus/types";

function walkJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walkJson(p));
    else if (entry.endsWith(".json")) out.push(p);
  }
  return out;
}

function gitPushCleanup(paths: string[]): void {
  const opts = { stdio: "inherit" as const };
  const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf-8" }).trim();
  if (branch !== "main") {
    throw new Error(`agent-bus clean must run on a main checkout (on '${branch}'); use a bus worktree on main`);
  }

  execFileSync("git", ["fetch", "origin", "main"], opts);
  const ahead = execFileSync("git", ["rev-list", "--count", "origin/main..HEAD"], { encoding: "utf-8" }).trim();
  if (ahead !== "0") {
    throw new Error(
      `agent-bus clean: local main is ${ahead} commit(s) ahead of origin/main; reconcile before cleanup`,
    );
  }

  const gitPaths = paths.map((p) => p.replaceAll("\\", "/"));
  for (const p of gitPaths) {
    execFileSync("git", ["rm", "-f", p], opts);
  }

  const from = (process.env.ZETA_SENDER_ID ?? "lior-antigravity") as SenderAgentId;
  const commitMsg = [
    `bus(clean): prune ${String(gitPaths.length)} expired envelope(s)`,
    "",
    "Pruned expired agent-bus envelopes (B-0954, no-PR direct-to-main).",
    "",
    coauthorFor(from),
  ].join("\n");

  execFileSync("git", ["commit", "--no-verify", "-q", "-m", commitMsg, "--", ...gitPaths], opts);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      execFileSync("git", ["push", "origin", "HEAD:main"], opts);
      return;
    } catch {
      try {
        execFileSync("git", ["pull", "--rebase", "origin", "main"], opts);
      } catch {
        try {
          execFileSync("git", ["rebase", "--abort"], opts);
        } catch {}
        throw new Error(
          "agent-bus clean: rebase conflict during cleanup push. Re-run cleanup.",
        );
      }
    }
  }
  execFileSync("git", ["push", "origin", "HEAD:main"], opts);
}

export function cleanExpired(
  root: string = process.env.ZETA_AGENT_BUS_DIR ?? AGENT_BUS_ROOT,
  noPush = false,
): string[] {
  if (!existsSync(root)) return [];
  const now = new Date();
  const deleted: string[] = [];

  const files = walkJson(root);
  for (const file of files) {
    try {
      const raw = readFileSync(file, "utf-8");
      const content = JSON.parse(raw) as Record<string, unknown>;
      if (
        content &&
        typeof content === "object" &&
        typeof content.expiresAt === "string" &&
        new Date(content.expiresAt) < now
      ) {
        rmSync(file, { force: true });
        deleted.push(file);
      }
    } catch {
      // Ignore malformed files
    }
  }

  if (deleted.length > 0 && !noPush) {
    gitPushCleanup(deleted);
  }

  return deleted;
}

if (import.meta.main) {
  const noPush = process.argv.includes("--no-push");
  const deleted = cleanExpired(undefined, noPush);
  console.log(JSON.stringify({ count: deleted.length, pruned: deleted }));
}
