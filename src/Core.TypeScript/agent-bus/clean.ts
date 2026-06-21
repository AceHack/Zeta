#!/usr/bin/env bun
/**
 * Agent-bus Phase 1 (081KSXN940008QG0R00171YAZW) — clean expired envelopes.
 *
 * Scans the agent-bus folder recursively, parses files to check their expiration
 * (expiresAt < now), deletes any expired files locally, stages them, commits,
 * and pushes directly to main.
 */
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { AGENT_BUS_ROOT } from "./types";
import { coauthorFor } from "../observe/event-sink-folder";
import type { SenderAgentId } from "../bus/types";

function gitText(args: readonly string[]): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- agent-bus cleanup intentionally uses the active repo Git binary; args are structured and never shell-expanded.
  return execFileSync("git", [...args], { encoding: "utf-8" }).trim();
}

function gitInherit(args: readonly string[]): void {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- agent-bus cleanup intentionally uses the active repo Git binary; args are structured and never shell-expanded.
  execFileSync("git", [...args], { stdio: "inherit" });
}

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

function expiresAtValue(content: unknown): string | null {
  if (typeof content !== "object" || content === null || !("expiresAt" in content)) {
    return null;
  }
  const expiresAt = (content as { readonly expiresAt: unknown }).expiresAt;
  return typeof expiresAt === "string" ? expiresAt : null;
}

function gitPushCleanup(paths: string[]): void {
  const branch = gitText(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== "main") {
    throw new Error(`agent-bus clean must run on a main checkout (on '${branch}'); use a bus worktree on main`);
  }

  gitInherit(["fetch", "origin", "main"]);
  const ahead = gitText(["rev-list", "--count", "origin/main..HEAD"]);
  if (ahead !== "0") {
    throw new Error(`agent-bus clean: local main is ${ahead} commit(s) ahead of origin/main; reconcile before cleanup`);
  }

  const gitPaths = paths.map((p) => p.replaceAll("\\", "/"));
  for (const p of gitPaths) {
    gitInherit(["rm", "-f", p]);
  }

  const from = (process.env.ZETA_SENDER_ID ?? "lior-antigravity") as SenderAgentId;
  const commitMsg = [
    `bus(clean): prune ${String(gitPaths.length)} expired envelope(s)`,
    "",
    "Pruned expired agent-bus envelopes (081KSXN940008QG0R00171YAZW, no-PR direct-to-main).",
    "",
    coauthorFor(from),
  ].join("\n");

  gitInherit(["commit", "--no-verify", "-q", "-m", commitMsg, "--", ...gitPaths]);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      gitInherit(["push", "origin", "HEAD:main"]);
      return;
    } catch {
      try {
        gitInherit(["pull", "--rebase", "origin", "main"]);
      } catch {
        try {
          gitInherit(["rebase", "--abort"]);
        } catch {
          // No active rebase to abort.
        }
        throw new Error("agent-bus clean: rebase conflict during cleanup push. Re-run cleanup.");
      }
    }
  }
  gitInherit(["push", "origin", "HEAD:main"]);
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
      const content = JSON.parse(raw) as unknown;
      const expiresAt = expiresAtValue(content);
      if (expiresAt !== null && new Date(expiresAt) < now) {
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
