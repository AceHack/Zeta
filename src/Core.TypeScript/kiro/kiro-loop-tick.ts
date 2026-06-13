#!/usr/bin/env bun
// kiro-loop-tick.ts — host-level launchd heartbeat runner for Kiro (Qwen Coder).
// Manager contract injected. This is the live version that executes the trajectory manager behavior.

import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const home = process.env.HOME ?? "/Users/acehack";
const worktree = process.env.ZETA_KIRO_LOOP_WORKTREE ?? join(home, "Documents/src/repos/Zeta");
const stateDir = process.env.ZETA_KIRO_LOOP_STATE_DIR ?? join(home, "Library/Application Support/ZetaKiroLoop");
const logDir = process.env.ZETA_KIRO_LOOP_LOG_DIR ?? join(home, "Library/Logs/zeta-kiro-loop");
const lockDir = join(stateDir, "lock");
const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const lockTtlMs = Number(process.env.ZETA_KIRO_LOOP_LOCK_TTL_SECONDS ?? "120") * 1000;
const fetchTimeoutMs = Number(process.env.ZETA_KIRO_LOOP_FETCH_TIMEOUT_SECONDS ?? "45") * 1000;
const runAgent = process.env.ZETA_KIRO_LOOP_RUN_AGENT === "1";
const agentIntervalMs = Number(process.env.ZETA_KIRO_LOOP_AGENT_INTERVAL_SECONDS ?? "60") * 1000;
const agentTimeoutMs = Number(process.env.ZETA_KIRO_LOOP_AGENT_TIMEOUT_SECONDS ?? "300") * 1000;
const dryRun = process.env.ZETA_KIRO_LOOP_DRY_RUN === "1";
const agentStateFile = join(stateDir, "last-agent-run.json");

mkdirSync(stateDir, { recursive: true });
mkdirSync(logDir, { recursive: true });

function nowIso(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function log(message: string): void {
    appendFileSync(join(logDir, "runner.log"), `${nowIso()} ${message}\n`);
}

function run(command: string, args: string[], timeoutMs: number): { status: number; stdout: string; stderr: string } {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- command/args are controlled (git, gh, kiro-cli)
    const result = spawnSync(command, args, {
        cwd: worktree,
        encoding: "utf8",
        env: {
            ...process.env,
            PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${join(home, ".local/bin")}`,
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

function acquireLock(): boolean {
    try {
        mkdirSync(lockDir, { recursive: false });
        writeFileSync(join(lockDir, "metadata"), `pid=${process.pid}\nrun_id=${runId}\nacquired_at=${nowIso()}\n`);
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
            writeFileSync(join(lockDir, "metadata"), `pid=${process.pid}\nrun_id=${runId}\nacquired_at=${nowIso()}\n`);
            return true;
        } catch { return false; }
    }
}

function releaseLock(): void {
    try { rmSync(lockDir, { recursive: true, force: true }); } catch { /* best effort */ }
}

const forwardActions = process.env.ZETA_KIRO_LOOP_FORWARD_ACTIONS === "1";
const forwardIntervalMs = Number(process.env.ZETA_KIRO_LOOP_FORWARD_INTERVAL_SECONDS ?? "300") * 1000;
const forwardStateFile = join(stateDir, "last-forward-run.json");
const broadcastDir = join(home, ".local/share/zeta-broadcasts");

function readBroadcasts(): void {
    for (const peer of ["otto.md", "vera.md", "lior.md", "riven.md"]) {
        const path = join(broadcastDir, peer);
        if (existsSync(path)) {
            const content = readFileSync(path, "utf8").trim();
            if (content) log(`broadcast from ${peer.replace(".md", "")}: ${content.split("\n")[0] ?? "(empty)"}`);
        }
    }
}

function writeBroadcast(summary: string): void {
    mkdirSync(broadcastDir, { recursive: true });
    writeFileSync(join(broadcastDir, "kiro.md"), [
        `# Kiro broadcast — ${nowIso()}`,
        "",
        "## Background tick status",
        summary,
    ].join("\n"));
}

function gh(...args: string[]): { status: number; stdout: string } {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- gh CLI is PATH-resolved intentionally
    const r = spawnSync("gh", args, {
        cwd: worktree,
        encoding: "utf8",
        timeout: 60_000,
        env: {
            ...process.env,
            PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${join(home, ".local/bin")}`,
        },
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? "" };
}

function forwardTick(): void {
    readBroadcasts();

    const dirty = run("git", ["status", "--porcelain"], 10_000);
    const dirtyCount = lines(dirty.stdout).length;
    if (dirtyCount > 0) {
        log(`forward: skip, dirty=${dirtyCount}`);
        writeBroadcast(`Forward tick ${runId}: skip — dirty tree (${dirtyCount} files).`);
        return;
    }

    const prsResult = gh(
        "pr", "list", "--repo", "Lucent-Financial-Group/Zeta",
        "--state", "open", "--json", "number", "--jq", ".[].number"
    );
    if (prsResult.status !== 0) {
        log(`forward: gh pr list failed status=${prsResult.status}`);
        writeBroadcast(`Forward tick ${runId}: gh pr list failed.`);
        return;
    }

    const prNumbers = prsResult.stdout.trim().split("\n").filter(n => n.trim()).map(Number);
    for (const pr of prNumbers) {
        const gateResult = gh(
            "pr", "view", String(pr), "--repo", "Lucent-Financial-Group/Zeta",
            "--json", "mergeStateStatus,autoMergeRequest,reviewThreads",
            "--jq", "{mergeState: .mergeStateStatus, autoMerge: (.autoMergeRequest != null), unresolvedThreads: ([.reviewThreads[]? | select(.isResolved == false)] | length)}"
        );
        if (gateResult.status !== 0) continue;
        try {
            const gate = JSON.parse(gateResult.stdout);
            if (gate.mergeState === "CLEAN" && !gate.autoMerge && gate.unresolvedThreads === 0) {
                log(`forward: arming auto-merge on PR #${pr}`);
                gh("pr", "merge", String(pr), "--repo", "Lucent-Financial-Group/Zeta", "--squash", "--auto");
                writeBroadcast(`Forward tick ${runId}: armed auto-merge on PR #${pr}.`);
                writeFileSync(forwardStateFile, JSON.stringify({ run_id: runId, updated_at: nowIso() }, null, 2));
                return;
            }
        } catch { continue; }
    }

    log(`forward: no actionable PR found`);
    writeBroadcast(`Forward tick ${runId}: idle — no actionable PR. ${prNumbers.length} open.`);
    writeFileSync(forwardStateFile, JSON.stringify({ run_id: runId, updated_at: nowIso() }, null, 2));
}

function heartbeat(): void {
    const fetch = run("git", ["fetch", "origin"], fetchTimeoutMs);
    const fetchOk = fetch.status === 0 ? "ok" : `exit-${fetch.status}`;

    const claims = run("git", ["branch", "-r", "--list", "origin/claim/*"], 10_000);
    const claimCount = lines(claims.stdout).length;

    const prs = run("gh", ["pr", "list", "--state", "open", "--json", "number", "--jq", "length"], 30_000);
    const prCount = prs.stdout.trim() || "?";

    const dirty = run("git", ["status", "--porcelain"], 10_000);
    const dirtyCount = lines(dirty.stdout).length;

    const hbDir = join(worktree, ".git/agent-heartbeats");
    mkdirSync(hbDir, { recursive: true });
    const hbFile = join(hbDir, "kiro-launchd-loop.json");

    let agentStatus = "wait";
    let dueIn = "";

    if (runAgent) {
        let lastRun: { updated_at?: string } = {};
        try { lastRun = JSON.parse(readFileSync(agentStateFile, "utf8")); } catch { /* first run */ }
        const lastTime = lastRun.updated_at ? new Date(lastRun.updated_at).getTime() : 0;
        const elapsed = Date.now() - lastTime;

        if (elapsed >= agentIntervalMs) {
            log(`kiro agent gate start run_id=${runId}`);

            if (dryRun) {
                log(`dry-run: would run agent gate`);
                agentStatus = "dry-run";
            } else {
                const gate = run("kiro-cli", [
                    "chat",
                    "--no-interactive",
                    "--trust-all-tools",
                    [
                        "You are Kiro, trajectory manager. This is a 60s autonomous cycle.",
                        "Read broadcasts first: ~/.local/share/zeta-broadcasts/{otto,vera,lior,riven,kiro}.md",
                        "Walk assigned trajectories. Decompose only what you hit mid-stride.",
                        "Dispatch parallel subagents when work allows. Own every PR through merge.",
                        "Learn from Otto/Vera/Riven patterns. Critique failure modes as data.",
                        "When you lack information, create a specific research child the next pickup cannot dodge.",
                        "Write status to ~/.local/share/zeta-broadcasts/kiro.md at cycle end.",
                        "GitHub PR state and actual file contents are authoritative; broadcast bus is coordination cache.",
                        "Report: open PRs, active claims, any drift or contradiction, one toe-safe forward action taken or exact blocker.",
                    ].join(" "),
                ], agentTimeoutMs);

                agentStatus = gate.status === 0 ? "ok" : `exit-${gate.status}`;
                log(`kiro agent gate end run_id=${runId} status=${gate.status}`);

                writeFileSync(agentStateFile, JSON.stringify({
                    run_id: runId,
                    status: gate.status,
                    started_at: nowIso(),
                    updated_at: nowIso(),
                }, null, 2));

                if (gate.stdout.trim().length > 0) {
                    appendFileSync(join(logDir, "ticks.log"), `\n--- ${runId} kiro gate ---\n${gate.stdout}\n`);
                }
                if (gate.stderr.trim().length > 0) {
                    appendFileSync(join(logDir, "ticks.err"), `\n--- ${runId} kiro gate ---\n${gate.stderr}\n`);
                }
            }
        } else {
            const remaining = Math.round((agentIntervalMs - elapsed) / 1000);
            dueIn = `due_in=${remaining}s`;
            agentStatus = "wait";
        }
    }

    let forwardStatus = "disabled";
    if (forwardActions && fetchOk === "ok") {
        let lastForward: { updated_at?: string } = {};
        try { lastForward = JSON.parse(readFileSync(forwardStateFile, "utf8")); } catch { /* first run */ }
        const forwardElapsed = Date.now() - (lastForward.updated_at ? new Date(lastForward.updated_at).getTime() : 0);
        if (forwardElapsed >= forwardIntervalMs) {
            log(`forward-tick start run_id=${runId}`);
            forwardTick();
            forwardStatus = "ok";
            log(`forward-tick end run_id=${runId}`);
        } else {
            forwardStatus = `wait due_in=${Math.round((forwardIntervalMs - forwardElapsed) / 1000)}s`;
        }
    }

    const summary = `heartbeat complete run_id=${runId} fetch=${fetchOk} claims=${claimCount} open_prs=${prCount} dirty=${dirtyCount} kiro=${agentStatus} forward=${forwardStatus} ${dueIn}`.trim();
    log(summary);

    writeFileSync(hbFile, JSON.stringify({
        session: "kiro-qwen/kiro-launchd-loop",
        harness: "kiro-qwen",
        claim: "host-loop",
        branch: "main",
        worktree,
        paths: ["(host-level heartbeat — adversarial-truth-axis)"],
        updated_at: nowIso(),
        status: "active",
        dirty_count: String(dirtyCount),
    }, null, 2));
}

if (!acquireLock()) {
    log(`skip: lock held by another tick run_id=${runId}`);
    process.exit(0);
}

try {
    heartbeat();
} catch (err) {
    log(`error: ${err instanceof Error ? err.message : String(err)}`);
} finally {
    releaseLock();
}
