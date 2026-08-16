#!/usr/bin/env bun

import { spawnSync } from "node:child_process";

export interface PreparedHeartbeatBranch {
  readonly head: string;
  readonly remoteFound: boolean;
  readonly carried: boolean;
}

export type PrepareHeartbeatResult =
  | { readonly ok: true; readonly value: PreparedHeartbeatBranch }
  | { readonly ok: false; readonly error: string };

interface GitResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

const AGENT_RE = /^[A-Za-z0-9](?:[A-Za-z0-9_-]|\.(?=[A-Za-z0-9_-])){0,62}$/;

function git(cwd: string, args: readonly string[]): GitResult {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", [...args], { cwd, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.error) {
    return { status: -1, stdout: "", stderr: result.error.message };
  }
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

function failed(operation: string, result: GitResult): PrepareHeartbeatResult {
  const detail = (result.stderr || result.stdout).trim();
  return { ok: false, error: `${operation} failed${detail ? `: ${detail}` : ""}` };
}

/**
 * Rebuild a mutable heartbeat lane over current main without discarding its unflushed tree delta.
 *
 * The previous lane is merged with `--squash`: commits that already landed through an earlier
 * squash contribute no staged change, while still-unflushed files remain staged for this tick's
 * ordinary commit. A content conflict is typed backpressure; the remote lane is never modified.
 */
export function prepareHeartbeatBranch(agent: string, cwd: string = process.cwd()): PrepareHeartbeatResult {
  if (!AGENT_RE.test(agent) || agent.endsWith(".lock")) {
    return { ok: false, error: `agent must be one safe branch component; got ${agent}` };
  }

  const head = `heartbeat/${agent}`;
  const remoteRef = `refs/remotes/origin/${head}`;
  const fetchMain = git(cwd, ["fetch", "origin", "+refs/heads/main:refs/remotes/origin/main"]);
  if (fetchMain.status !== 0) return failed("fetch main", fetchMain);

  const probe = git(cwd, ["ls-remote", "--exit-code", "--heads", "origin", `refs/heads/${head}`]);
  if (probe.status !== 0 && probe.status !== 2) return failed("probe heartbeat lane", probe);
  const remoteFound = probe.status === 0;
  if (remoteFound) {
    const fetchLane = git(cwd, ["fetch", "origin", `+refs/heads/${head}:${remoteRef}`]);
    if (fetchLane.status !== 0) return failed("fetch heartbeat lane", fetchLane);
  }

  const checkout = git(cwd, ["checkout", "-B", head, "origin/main"]);
  if (checkout.status !== 0) return failed("reset heartbeat lane over main", checkout);

  if (remoteFound) {
    const merge = git(cwd, ["merge", "--squash", "--no-commit", remoteRef]);
    if (merge.status !== 0) return failed("carry unflushed heartbeat state", merge);
  }

  const staged = git(cwd, ["diff", "--cached", "--quiet", "--exit-code"]);
  if (staged.status !== 0 && staged.status !== 1) return failed("inspect carried heartbeat state", staged);
  return { ok: true, value: { head, remoteFound, carried: staged.status === 1 } };
}

function parseAgent(argv: readonly string[]): { readonly ok: true; readonly agent: string } | { readonly ok: false } {
  return argv.length === 2 && argv[0] === "--agent" && argv[1] !== undefined
    ? { ok: true, agent: argv[1] }
    : { ok: false };
}

if (import.meta.main) {
  const parsed = parseAgent(process.argv.slice(2));
  if (!parsed.ok) {
    console.error("usage: prepare-heartbeat-branch.ts --agent <lane>");
    process.exit(2);
  }
  const result = prepareHeartbeatBranch(parsed.agent);
  if (!result.ok) {
    console.error(`prepare-heartbeat-branch: ${result.error}`);
    process.exit(1);
  }
  console.log(
    `[heartbeat] ${result.value.head}: ${result.value.remoteFound ? "remote found" : "new lane"}; ` +
      `${result.value.carried ? "unflushed state staged" : "no unflushed state"}`,
  );
}
