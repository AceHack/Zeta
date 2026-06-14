#!/usr/bin/env bun
/**
 * service/loop-tick.ts — unified per-tick entry point for all personas.
 *
 * Usage: bun loop-tick.ts --persona <name>
 *
 * Replaces all per-persona tick scripts (kiro-loop-tick.ts, riven-loop-tick.ts, etc.).
 * Persona determines paths, harness CLI, and broadcast identity — NOT code paths.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { getPersona, listPersonas } from "./persona-registry";
import { resolveEnv } from "./env-schema";

// --- Parse --persona arg ---
const personaIdx = process.argv.indexOf("--persona");
if (personaIdx === -1 || !process.argv[personaIdx + 1]) {
  console.error(`Usage: bun loop-tick.ts --persona <name>`);
  console.error(`Valid personas: ${listPersonas().map(p => p.name).join(", ")}`);
  process.exit(1);
}
const personaName = process.argv[personaIdx + 1]!;
const personaConfig = getPersona(personaName);
if (!personaConfig) {
  console.error(`Unknown persona: ${personaName}`);
  console.error(`Valid personas: ${listPersonas().map(p => p.name).join(", ")}`);
  process.exit(1);
}

// --- Resolve environment ---
const env = resolveEnv(personaName);
const home = homedir();
const worktree = env.worktree;
const stateDir = env.stateDir;
const logDir = env.logDir;
const ref = env.ref;

const lockDir = join(stateDir, "lock");
const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const lockTtlMs = Number(process.env["ZETA_LOOP_LOCK_TTL_SECONDS"] ?? "120") * 1000;
const fetchTimeoutMs = Number(process.env["ZETA_LOOP_FETCH_TIMEOUT_SECONDS"] ?? "45") * 1000;

mkdirSync(stateDir, { recursive: true });
mkdirSync(logDir, { recursive: true });

// --- Utilities ---
function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function log(message: string): void {
  appendFileSync(join(logDir, "runner.log"), `${nowIso()} [${personaName}] ${message}\n`);
}

function exec(command: string, args: string[], timeoutMs: number): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd: worktree,
    encoding: "utf8",
    env: {
      ...process.env,
      ZETA_LOOP_PERSONA: personaName,
      ZETA_LOOP_WORKTREE: worktree,
      ZETA_LOOP_STATE_DIR: stateDir,
      ZETA_LOOP_LOG_DIR: logDir,
      ZETA_LOOP_REF: ref,
      PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${join(home, ".local/bin")}:${join(home, ".bun/bin")}`,
    },
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    status: result.status ?? (result.signal ? 124 : 1),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? String(result.error ?? ""),
  };
}

function lines(text: string): string[] {
  return text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
}

// --- Lock ---
function acquireLock(): boolean {
  try {
    mkdirSync(lockDir, { recursive: false });
    writeFileSync(join(lockDir, "metadata"), `pid=${process.pid}\nrun_id=${runId}\npersona=${personaName}\nacquired_at=${nowIso()}\n`);
    return true;
  } catch {
    try {
      const meta = readFileSync(join(lockDir, "metadata"), "utf8");
      const pidMatch = meta.match(/^pid=(\d+)$/m);
      if (pidMatch) {
        const pid = Number(pidMatch[1]);
        try { process.kill(pid, 0); return false; } catch { /* stale */ }
      }
      const acquiredMatch = meta.match(/^acquired_at=(.+)$/m);
      if (acquiredMatch?.[1]) {
        const age = Date.now() - new Date(acquiredMatch[1]).getTime();
        if (age < lockTtlMs) return false;
      }
      rmSync(lockDir, { recursive: true, force: true });
      mkdirSync(lockDir, { recursive: false });
      writeFileSync(join(lockDir, "metadata"), `pid=${process.pid}\nrun_id=${runId}\npersona=${personaName}\nacquired_at=${nowIso()}\n`);
      return true;
    } catch { return false; }
  }
}

function releaseLock(): void {
  try { rmSync(lockDir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// --- Broadcast ---
const broadcastDir = join(home, ".local/share/zeta-broadcasts");

function readBroadcasts(): void {
  const peers = listPersonas().filter(p => p.name !== personaName);
  for (const peer of peers) {
    const path = join(broadcastDir, `${peer.name}.md`);
    if (existsSync(path)) {
      const content = readFileSync(path, "utf8").trim();
      if (content) log(`broadcast from ${peer.name}: ${content.split("\n")[0] ?? "(empty)"}`);
    }
  }
}

function writeBroadcast(summary: string): void {
  mkdirSync(broadcastDir, { recursive: true });
  writeFileSync(join(broadcastDir, `${personaName}.md`), [
    `# ${personaName} broadcast — ${nowIso()}`,
    "",
    "## Background tick status",
    summary,
  ].join("\n"));
}

// --- Heartbeat tick ---
function tick(): void {
  readBroadcasts();

  // Fetch
  const fetch = exec("git", ["fetch", "origin"], fetchTimeoutMs);
  const fetchOk = fetch.status === 0 ? "ok" : `exit-${fetch.status}`;

  // Gather state
  const claims = exec("git", ["branch", "-r", "--list", "origin/claim/*"], 10_000);
  const claimCount = lines(claims.stdout).length;

  const prs = exec("gh", ["pr", "list", "--state", "open", "--json", "number", "--jq", "length"], 30_000);
  const prCount = prs.stdout.trim() || "?";

  const dirty = exec("git", ["status", "--porcelain"], 10_000);
  const dirtyCount = lines(dirty.stdout).length;

  // Write heartbeat
  const hbDir = join(stateDir, "heartbeats");
  mkdirSync(hbDir, { recursive: true });
  const hbFile = join(hbDir, `${personaName}-tick.json`);

  writeFileSync(hbFile, JSON.stringify({
    session: `${personaName}/${personaConfig!.label}`,
    harness: personaName,
    claim: "host-loop",
    branch: ref,
    worktree,
    updated_at: nowIso(),
    status: "active",
    dirty_count: String(dirtyCount),
  }, null, 2));

  const summary = `tick complete run_id=${runId} persona=${personaName} fetch=${fetchOk} claims=${claimCount} open_prs=${prCount} dirty=${dirtyCount}`;
  log(summary);
  writeBroadcast(summary);
}

// --- Main ---
if (!acquireLock()) {
  log(`skip: lock held by another tick run_id=${runId}`);
  process.exit(0);
}

try {
  tick();
} catch (err) {
  log(`error: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  releaseLock();
}
