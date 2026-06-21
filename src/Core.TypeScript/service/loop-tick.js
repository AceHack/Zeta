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
const personaName = process.argv[personaIdx + 1];
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
mkdirSync(stateDir, { recursive: true });
mkdirSync(logDir, { recursive: true });
// --- Utilities ---
function nowIso() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
function log(message) {
    appendFileSync(join(logDir, "runner.log"), `${nowIso()} [${personaName}] ${message}\n`);
}
function exec(command, args, timeoutMs) {
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
function lines(text) {
    return text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
}
// --- Lock ---
function acquireLock() {
    try {
        mkdirSync(lockDir, { recursive: false });
        writeFileSync(join(lockDir, "metadata"), `pid=${process.pid}\nrun_id=${runId}\npersona=${personaName}\nacquired_at=${nowIso()}\n`);
        return true;
    }
    catch {
        try {
            const meta = readFileSync(join(lockDir, "metadata"), "utf8");
            const pidMatch = meta.match(/^pid=(\d+)$/m);
            if (pidMatch) {
                const pid = Number(pidMatch[1]);
                try {
                    process.kill(pid, 0);
                    return false;
                }
                catch { /* stale */ }
            }
            const acquiredMatch = meta.match(/^acquired_at=(.+)$/m);
            if (acquiredMatch?.[1]) {
                const age = Date.now() - new Date(acquiredMatch[1]).getTime();
                if (age < lockTtlMs)
                    return false;
            }
            rmSync(lockDir, { recursive: true, force: true });
            mkdirSync(lockDir, { recursive: false });
            writeFileSync(join(lockDir, "metadata"), `pid=${process.pid}\nrun_id=${runId}\npersona=${personaName}\nacquired_at=${nowIso()}\n`);
            return true;
        }
        catch {
            return false;
        }
    }
}
function releaseLock() {
    try {
        rmSync(lockDir, { recursive: true, force: true });
    }
    catch { /* best effort */ }
}
// --- Broadcast ---
const broadcastDir = join(home, ".local/share/zeta-broadcasts");
function readBroadcasts() {
    const peers = listPersonas().filter(p => p.name !== personaName);
    for (const peer of peers) {
        const path = join(broadcastDir, `${peer.name}.md`);
        if (existsSync(path)) {
            const content = readFileSync(path, "utf8").trim();
            if (content)
                log(`broadcast from ${peer.name}: ${content.split("\n")[0] ?? "(empty)"}`);
        }
    }
}
function writeBroadcast(summary) {
    mkdirSync(broadcastDir, { recursive: true });
    writeFileSync(join(broadcastDir, `${personaName}.md`), [
        `# ${personaName} broadcast — ${nowIso()}`,
        "",
        "## Background tick status",
        summary,
    ].join("\n"));
}
// --- Heartbeat tick ---
async function tick() {
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
    const { gateInterval, gateTimeout, harness } = personaConfig;
    const dryRun = process.env["ZETA_LOOP_DRY_RUN"] === "1";
    const agentStateFile = join(stateDir, "last-agent-run.json");
    if (gateInterval > 0 && !harness.ideNative) {
        let lastRun = {};
        try {
            lastRun = JSON.parse(readFileSync(agentStateFile, "utf8"));
        }
        catch { /* first run */ }
        const lastTime = lastRun.updated_at ? new Date(lastRun.updated_at).getTime() : 0;
        const elapsed = Date.now() - lastTime;
        if (elapsed >= gateInterval * 1000) {
            log(`agent-gate start persona=${personaName} run_id=${runId}`);
            if (dryRun) {
                agentStatus = "dry-run";
                log(`dry-run: would invoke ${harness.command}`);
            }
            else if (useObserveInline) {
                // v1: observe-inline — load world, pick action, execute directly
                agentStatus = await runObserveInline();
            }
            else {
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
        }
        else {
            const remaining = Math.round((gateInterval * 1000 - elapsed) / 1000);
            agentStatus = `wait due_in=${remaining}s`;
        }
    }
    // Write heartbeat
    const hbDir = join(stateDir, "heartbeats");
    mkdirSync(hbDir, { recursive: true });
    const hbFile = join(hbDir, `${personaName}-tick.json`);
    writeFileSync(hbFile, JSON.stringify({
        session: `${personaName}/${personaConfig.label}`,
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
function buildWorkPrompt(persona, prCount, claimCount, dirtyCount) {
    return [
        `You are ${persona}, trajectory manager. This is a ${personaConfig.gateInterval}s autonomous cycle.`,
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
async function runObserveInline() {
    try {
        const { choose } = await import("../observe/chooser");
        const { loadWorld } = await import("../observe/load-world");
        const { renderAction } = await import("../observe/observe");
        const { execute } = await import("../observe/execute");
        const { folderSink } = await import("../observe/event-sink-folder");
        // Event dir: prefer inside the repo's actual .git dir (handles worktrees).
        // Falls back to stateDir if .git resolution fails.
        let eventDir;
        try {
            const { spawnSync: spawn } = await import("node:child_process");
            const gitDir = spawn("git", ["rev-parse", "--git-dir"], { cwd: worktree, encoding: "utf8" });
            const resolvedGitDir = gitDir.status === 0 ? gitDir.stdout.trim() : null;
            if (resolvedGitDir) {
                const { resolve } = await import("node:path");
                const absGitDir = resolve(worktree, resolvedGitDir);
                eventDir = join(absGitDir, "observe-events", personaName);
            }
            else {
                eventDir = join(stateDir, "observe-events");
            }
        }
        catch {
            eventDir = join(stateDir, "observe-events");
        }
        mkdirSync(eventDir, { recursive: true });
        // 1. Load world from event log + backlog
        const world = loadWorld({ eventDir, repoRoot: worktree });
        const { defaultComposer } = await import("../observe/composer");
        // 2. Choose action (tiered cascade)
        const result = await choose(world, { composer: defaultComposer });
        const label = renderAction(result.action);
        log(`observe-inline: tier=${result.tier} confidence=${result.confidence.toFixed(2)} action=${label}`);
        // 3. Execute the action (append to event log + side effects)
        // No-commit sink: observe events are local per-agent state, not shared substrate (yet).
        const sink = folderSink({ eventDir, by: personaName, commit: () => ({ ok: true }) });
        const execResult = await execute(world, result.action, sink);
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
    }
    catch (err) {
        log(`observe-inline failed: ${err instanceof Error ? err.message : String(err)}`);
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
}
catch (err) {
    log(`error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    // A failed tick MUST be a failed process — otherwise launchd/cron sees exit 0
    // and failure-backoff/monitoring is blind. (Set after logging; releaseLock still runs.)
    process.exitCode = 1;
}
finally {
    releaseLock();
}
