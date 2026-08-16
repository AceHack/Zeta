#!/usr/bin/env bun
/**
 * service/loop-tick.ts — unified per-tick entry point for all personas.
 *
 * Usage: bun loop-tick.ts --persona <name>
 *
 * Replaces all per-persona tick scripts (kiro-loop-tick.ts, riven-loop-tick.ts, etc.).
 * Persona determines paths, harness CLI, and broadcast identity — NOT code paths.
 *
 * Two execution modes for the agent gate:
 *   v0 (CLI): spawn the persona's harness CLI with a work prompt (otto→claude, kiro→kiro-cli)
 *   v1 (observe-inline): loadWorld() → observe() → execute() — no LLM for deterministic picks
 *
 * Set ZETA_LOOP_OBSERVE_INLINE=1 to use v1. Default is v0 (CLI shelling).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
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
const useObserveInline = process.env["ZETA_LOOP_OBSERVE_INLINE"] === "1";
const hostToolPath = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
  join(home, ".local", "bin"),
  join(home, ".bun", "bin"),
];
const executionPath =
  env.toolPathPrefix === undefined ? hostToolPath.join(delimiter) : [env.toolPathPrefix, ...hostToolPath].join(delimiter);

mkdirSync(stateDir, { recursive: true });
mkdirSync(logDir, { recursive: true });

// --- Utilities ---
function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function log(message: string): void {
  appendFileSync(join(logDir, "runner.log"), `${nowIso()} [${personaName}] ${message}\n`);
}

function getSignalNumber(signal: string): number {
  const signals: Record<string, number> = {
    SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGILL: 4, SIGTRAP: 5,
    SIGABRT: 6, SIGFPE: 8, SIGKILL: 9, SIGUSR1: 10, SIGSEGV: 11,
    SIGUSR2: 12, SIGPIPE: 13, SIGALRM: 14, SIGTERM: 15
  };
  return signals[signal] ?? 0;
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
      PATH: executionPath,
    },
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
  });
  
  let status = result.status;
  if (status === null) {
    if (result.error && (result.error as any).code === "ETIMEDOUT") {
      status = 124;
    } else if (result.signal) {
      status = 128 + getSignalNumber(result.signal);
    } else if (result.error) {
      status = 127;
    } else {
      status = 1;
    }
  }

  return {
    status,
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
  } catch (err: any) {
    if (err.code !== "EEXIST") {
      log(`ERROR: lock acquisition failed with system error: ${err.message}`);
      console.error(`ERROR: lock acquisition failed: ${err.message}`);
      return false;
    }
    try {
      const metaPath = join(lockDir, "metadata");
      if (!existsSync(metaPath)) {
        log(`WARNING: lock directory exists but metadata is missing. Forcing recreation.`);
        rmSync(lockDir, { recursive: true, force: true });
        mkdirSync(lockDir, { recursive: false });
        writeFileSync(join(lockDir, "metadata"), `pid=${process.pid}\nrun_id=${runId}\npersona=${personaName}\nacquired_at=${nowIso()}\n`);
        return true;
      }
      const meta = readFileSync(metaPath, "utf8");
      const pidMatch = meta.match(/^pid=(\d+)$/m);
      if (pidMatch) {
        const pid = Number(pidMatch[1]);
        try { process.kill(pid, 0); return false; } catch { /* stale process */ }
      }
      const acquiredMatch = meta.match(/^acquired_at=(.+)$/m);
      if (acquiredMatch?.[1]) {
        const age = Date.now() - new Date(acquiredMatch[1]).getTime();
        if (age < lockTtlMs) return false;
      }
      log(`WARNING: lock is stale or process is dead. Cleaning up stale lock.`);
      rmSync(lockDir, { recursive: true, force: true });
      mkdirSync(lockDir, { recursive: false });
      writeFileSync(join(lockDir, "metadata"), `pid=${process.pid}\nrun_id=${runId}\npersona=${personaName}\nacquired_at=${nowIso()}\n`);
      return true;
    } catch (innerErr: any) {
      log(`ERROR: lock cleanup/acquisition failed: ${innerErr.message}`);
      console.error(`ERROR: lock cleanup/acquisition failed: ${innerErr.message}`);
      return false;
    }
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
async function tick(): Promise<void> {
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

  // --- Agent gate (gated work cycle) ---
  let agentStatus = "disabled";
  const { gateInterval, gateTimeout, harness } = personaConfig!;
  const dryRun = process.env["ZETA_LOOP_DRY_RUN"] === "1";
  const agentStateFile = join(stateDir, "last-agent-run.json");

  if (gateInterval > 0 && !harness.ideNative) {
    let lastRun: { updated_at?: string } = {};
    try { lastRun = JSON.parse(readFileSync(agentStateFile, "utf8")); } catch { /* first run */ }
    const lastTime = lastRun.updated_at ? new Date(lastRun.updated_at).getTime() : 0;
    const elapsed = Date.now() - lastTime;

    if (elapsed >= gateInterval * 1000) {
      log(`agent-gate start persona=${personaName} run_id=${runId}`);

      if (dryRun) {
        agentStatus = "dry-run";
        log(`dry-run: would invoke ${harness.command}`);
      } else if (useObserveInline) {
        // v1: observe-inline — load world, pick action, execute directly
        agentStatus = await runObserveInline();
      } else {
        // v0: CLI shelling — spawn the persona's harness with a prompt
        const prompt = buildWorkPrompt(personaName, prCount, claimCount, dirtyCount);
        const args = harness.args.map(a => a.replace("{{PROMPT}}", prompt));
        const gate = exec(harness.command, args, gateTimeout * 1000);
        agentStatus = gate.status === 0 ? "ok" : `exit-${gate.status}`;
        log(`agent-gate end persona=${personaName} status=${gate.status}`);

        writeFileSync(agentStateFile, JSON.stringify({
          run_id: runId,
          persona: personaName,
          status: gate.status,
          started_at: nowIso(),
          updated_at: nowIso(),
        }, null, 2));

        if (gate.stdout.trim()) {
          appendFileSync(join(logDir, "ticks.log"), `\n--- ${runId} ${personaName} gate ---\n${gate.stdout}\n`);
        }
        if (gate.stderr.trim()) {
          appendFileSync(join(logDir, "ticks.err"), `\n--- ${runId} ${personaName} gate ---\n${gate.stderr}\n`);
        }
      }
    } else {
      const remaining = Math.round((gateInterval * 1000 - elapsed) / 1000);
      agentStatus = `wait due_in=${remaining}s`;
    }
  }

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
    agent_status: agentStatus,
  }, null, 2));

  const summary = `tick complete run_id=${runId} persona=${personaName} fetch=${fetchOk} claims=${claimCount} open_prs=${prCount} dirty=${dirtyCount} agent=${agentStatus}`;
  log(summary);
  writeBroadcast(summary);
}

/** Build the work prompt sent to the agent harness. Persona-agnostic. */
function buildWorkPrompt(persona: string, prCount: string, claimCount: number, dirtyCount: number): string {
  return [
    `You are ${persona}, trajectory manager. This is a ${personaConfig!.gateInterval}s autonomous cycle.`,
    `Read broadcasts: ~/.local/share/zeta-broadcasts/*.md`,
    `State: ${prCount} open PRs, ${claimCount} claims, ${dirtyCount} dirty files.`,
    `Walk assigned trajectories. Own every PR through merge.`,
    `Write status to ~/.local/share/zeta-broadcasts/${persona}.md at cycle end.`,
    `Report: open PRs, active claims, drift, one forward action or exact blocker.`,
  ].join(" ");
}

/**
 * The observe-native gate: instead of spawning a CLI with a prompt string,
 * invoke the observe controller directly when it's available. Falls back to
 * CLI invocation when the observe loop isn't wired (e.g. the harness doesn't
 * support inline observe yet).
 *
 * This is the compression point where three systems become one:
 *   state-machine (where am I?) → observe grammar (what can I do?) → execute (do it)
 *
 * The agent CLI is the v0 executor; the observe controller is the v1 executor.
 * Both are legal — the unified tick doesn't care which path resolves the action.
 */

async function runObserveInline(): Promise<string> {
  try {
    const { choose } = await import("../observe/chooser");
    const { loadWorld } = await import("../observe/load-world");
    const { renderAction } = await import("../observe/observe");
    const { execute } = await import("../observe/execute");
    const { folderSink } = await import("../observe/event-sink-folder");

    // Event dir: prefer inside the repo's actual .git dir (handles worktrees).
    // Falls back to stateDir if .git resolution fails.
    let eventDir: string;
    try {
      const { spawnSync: spawn } = await import("node:child_process");
      const gitDir = spawn("git", ["rev-parse", "--git-dir"], { cwd: worktree, encoding: "utf8" });
      const resolvedGitDir = gitDir.status === 0 ? gitDir.stdout.trim() : null;
      if (resolvedGitDir) {
        const { resolve } = await import("node:path");
        const absGitDir = resolve(worktree, resolvedGitDir);
        eventDir = join(absGitDir, "observe-events", personaName);
      } else {
        eventDir = join(stateDir, "observe-events");
      }
    } catch {
      eventDir = join(stateDir, "observe-events");
    }
    mkdirSync(eventDir, { recursive: true });

    // 1. Load world from event log + backlog
    const world = loadWorld({ eventDir, repoRoot: worktree });

    const { unmeteredDefaultComposer } = await import("../observe/composer");
    // 2. Choose action (tiered cascade). The L2 backend is `unmetered` — five
    // hand-set weights with no falsifier; measured 2026-08-15 to be scored in 156
    // of 504 enumerated worlds and adopted in 0 of them (its confidence tops out
    // at 0.4272 against the 0.7 threshold, so `choose` falls back to the oracle
    // pick). See observe/composer.ts's header and composer-register.test.ts.
    const result = await choose(world, { composer: unmeteredDefaultComposer });
    const label = renderAction(result.action);
    log(`observe-inline: tier=${result.tier} confidence=${result.confidence.toFixed(2)} action=${label}`);

    // 3. Execute the action (append to event log + side effects)
    // No-commit sink: observe events are local per-agent state, not shared substrate (yet).
    const sink = folderSink({ eventDir, by: personaName, commit: () => ({ ok: true as const }) });

    // Wire codegen executor when ZETA_EXECUTOR=codegen and action is do_item.
    let executor: import("../observe/do-item").CommandExecutor | undefined;
    let doItemOpts: import("../observe/do-item").DoItemOptions | undefined;
    if (process.env["ZETA_EXECUTOR"] === "codegen" && result.action.kind === "do_item") {
      const { codegenExecuteItem } = await import("../observe/codegen-executor");
      const item = result.action.item;
      executor = {
        tier: "just-bash" as import("../observe/do-item").ExecutorTier,
        run: async (_spec) => codegenExecuteItem(item, { repoRoot: worktree, agentId: personaName }),
      };
      doItemOpts = { spec: { script: "# codegen-executor", cwd: worktree }, gated: false };
    }

    const execResult = await execute(world, result.action, sink, executor, doItemOpts);

    const status = execResult.ok ? 0 : 1;
    const execNote = execResult.ok
      ? `executed:${result.action.kind}`
      : `failed:${execResult.feedback?.kind ?? "unknown"}`;

    log(`observe-inline execute: ${execNote}`);

    writeFileSync(join(stateDir, "last-agent-run.json"), JSON.stringify({
      run_id: runId,
      persona: personaName,
      status,
      tier: result.tier,
      confidence: result.confidence,
      action_kind: result.action.kind,
      executed: execResult.ok,
      started_at: nowIso(),
      updated_at: nowIso(),
    }, null, 2));

    return `observe-inline:${result.tier}:${execNote}`;
  } catch (err) {
    const errorDetails = err instanceof Error ? (err.stack ?? err.message) : String(err);
    log(`observe-inline failed: ${errorDetails}`);
    try {
      writeFileSync(join(stateDir, "last-agent-run.json"), JSON.stringify({
        run_id: runId,
        persona: personaName,
        status: 1,
        started_at: nowIso(),
        updated_at: nowIso(),
        error: errorDetails,
      }, null, 2));
    } catch (writeErr: any) {
      log(`ERROR: failed to write last-agent-run.json on failure path: ${writeErr.message}`);
    }
    return "observe-inline:error";
  }
}

// --- Main ---
if (!acquireLock()) {
  log(`skip: lock held by another tick run_id=${runId}`);
  process.exit(0);
}

try {
  await tick();
} catch (err) {
  log(`error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  // A failed tick MUST be a failed process — otherwise launchd/cron sees exit 0
  // and failure-backoff/monitoring is blind. (Set after logging; releaseLock still runs.)
  process.exitCode = 1;
} finally {
  releaseLock();
}
