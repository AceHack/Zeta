#!/usr/bin/env bun
// soraya-loop-tick.ts — host-level launchd worker for Soraya (formal-verification-expert).
// Mirrors `.claude/bin/claude-loop-tick.ts` (Otto's loop) per Aaron 2026-05-21:
// "she runs on claude code your loop pattern cause we want her in max opus mode
// cause math is hard."
//
// Per-tick discipline:
//   1. Acquire lock; refresh worktree (git fetch)
//   2. Pick next TLA+ spec from rotating-cursor state file
//   3. Run `tools/formal-verification/run-tlc.ts <Spec>` with timeout
//   4. Publish bus envelope via `tools/bus/publish.ts` (sender=soraya)
//   5. Every CLAUDE_GATE_INTERVAL seconds: invoke Claude Code (max Opus) with
//      Soraya's persona prompt for deeper drift-audit / theorem-statement review
//   6. Update state files + heartbeat JSON; release lock
//
// Does NOT wake the interactive Otto session. Runs as a separate launchd process.
//
// B-0691 (filed via PR #4562) tracks scope. This file is the implementation.

import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const home = process.env.HOME ?? homedir();
const worktree = process.env.ZETA_SORAYA_LOOP_WORKTREE ?? join(home, ".local/share/zeta-soraya-loop/Zeta");
const stateDir = process.env.ZETA_SORAYA_LOOP_STATE_DIR ?? join(home, "Library/Application Support/ZetaSorayaLoop");
const logDir = process.env.ZETA_SORAYA_LOOP_LOG_DIR ?? join(home, "Library/Logs/zeta-soraya-loop");
const lockDir = join(stateDir, "lock");
const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const lockTtlMs = Number(process.env.ZETA_SORAYA_LOOP_LOCK_TTL_SECONDS ?? "300") * 1000;
const fetchTimeoutMs = Number(process.env.ZETA_SORAYA_LOOP_FETCH_TIMEOUT_SECONDS ?? "45") * 1000;
const tlcTimeoutMs = Number(process.env.ZETA_SORAYA_LOOP_TLC_TIMEOUT_SECONDS ?? "180") * 1000;
const runClaudeGate = process.env.ZETA_SORAYA_LOOP_RUN_CLAUDE === "1";
const claudeIntervalMs = Number(process.env.ZETA_SORAYA_LOOP_CLAUDE_INTERVAL_SECONDS ?? "900") * 1000;
const claudeTimeoutMs = Number(process.env.ZETA_SORAYA_LOOP_CLAUDE_TIMEOUT_SECONDS ?? "900") * 1000;
const dryRun = process.env.ZETA_SORAYA_LOOP_DRY_RUN === "1";
// Max Opus per Aaron 2026-05-21 ("math is hard").
const claudeModel = process.env.ZETA_SORAYA_LOOP_MODEL ?? "opus";
const claudeStateFile = join(stateDir, "last-claude-run.json");
const cursorFile = join(stateDir, "spec-cursor.json");

mkdirSync(stateDir, { recursive: true });
mkdirSync(logDir, { recursive: true });

function nowIso(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function log(message: string): void {
    appendFileSync(join(logDir, "runner.log"), `${nowIso()} ${message}\n`);
}

function run(command: string, args: string[], timeoutMs: number): { status: number; stdout: string; stderr: string } {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- command/args controlled (git, bun, claude)
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

// Round-robin TLA+ spec selection. Reads the curated catalogue from
// tools/formal-verification/run-tlc.ts --list (or falls back to dir glob).
// Cursor file tracks last-checked index so each tick advances forward.
function listSpecs(): string[] {
    const specsDir = join(worktree, "tools/tla/specs");
    if (!existsSync(specsDir)) return [];
    const dirEntries = run("ls", [specsDir], 5_000);
    if (dirEntries.status !== 0) return [];
    return dirEntries.stdout.split("\n")
        .filter(f => f.endsWith(".tla"))
        .map(f => f.replace(/\.tla$/, ""))
        .sort();
}

function pickNextSpec(specs: string[]): { spec: string; cursor: number } {
    let cursor = 0;
    try {
        const state = JSON.parse(readFileSync(cursorFile, "utf8"));
        cursor = ((Number(state.cursor) || 0) + 1) % Math.max(specs.length, 1);
    } catch { /* first run; cursor = 0 */ }
    const spec = specs[cursor] ?? "SmokeCheck";
    writeFileSync(cursorFile, JSON.stringify({ cursor, spec, updated_at: nowIso() }, null, 2));
    return { spec, cursor };
}

function publishBusEnvelope(spec: string, result: "pass" | "fail" | "skip" | "timeout", durationMs: number, gitSha: string): void {
    if (dryRun) {
        log(`dry-run: would publish bus envelope spec=${spec} result=${result}`);
        return;
    }
    const payload = JSON.stringify({
        job: spec,
        verifier: "tla-tlc",
        result,
        duration_ms: durationMs,
        sha: gitSha,
        run_id: runId,
    });
    // Bus CLI per `tools/bus/bus.ts publish` shape:
    //   publish --from <agent> --to <agent|*> --topic <topic> --payload <json>
    const publish = run("bun", [
        "tools/bus/bus.ts", "publish",
        "--from", "soraya",
        "--to", "*",
        "--topic", "formal-verification-result",
        "--payload", payload,
    ], 30_000);
    if (publish.status !== 0) {
        log(`bus publish failed status=${publish.status} stderr=${publish.stderr.slice(0, 200)}`);
    } else {
        log(`bus envelope published spec=${spec} result=${result}`);
    }
}

function runTlcOnSpec(spec: string): { result: "pass" | "fail" | "skip" | "timeout"; durationMs: number } {
    const startMs = Date.now();
    const tlc = run("bun", ["tools/formal-verification/run-tlc.ts", spec], tlcTimeoutMs);
    const durationMs = Date.now() - startMs;
    let result: "pass" | "fail" | "skip" | "timeout";
    if (tlc.status === 124) result = "timeout";
    else if (tlc.status === 0) result = "pass";
    else if (tlc.status === 2) result = "skip";  // toolchain not ready
    else result = "fail";
    log(`tlc spec=${spec} result=${result} duration_ms=${durationMs} exit=${tlc.status}`);
    return { result, durationMs };
}

function maybeRunClaudeGate(): string {
    if (!runClaudeGate) return "disabled";

    let lastRun: { updated_at?: string } = {};
    try { lastRun = JSON.parse(readFileSync(claudeStateFile, "utf8")); } catch { /* first run */ }
    const elapsed = Date.now() - (lastRun.updated_at ? new Date(lastRun.updated_at).getTime() : 0);

    if (elapsed < claudeIntervalMs) {
        const remaining = Math.round((claudeIntervalMs - elapsed) / 1000);
        return `wait due_in=${remaining}s`;
    }

    if (dryRun) {
        log(`dry-run: would run claude gate (model=${claudeModel})`);
        return "dry-run";
    }

    log(`claude gate start run_id=${runId} model=${claudeModel}`);
    const prompt = [
        `You are Soraya, the formal-verification-expert persona for Lucent-Financial-Group/Zeta.`,
        `BEFORE ANY WORK:`,
        `1) Read .claude/agents/formal-verification-expert.md for your role contract.`,
        `2) Read memory/persona/soraya/NOTEBOOK.md + MEMORY.md for prior work.`,
        `3) Read docs/research/verification-registry.md for the canonical job list.`,
        `4) Run "timeout --kill-after=5s 30s bun tools/github/refresh-worldview.ts" to refresh.`,
        `YOUR TASK THIS CYCLE (per verification-drift-auditor skill):`,
        `Pick ONE row from the verification-registry that has the oldest "Last audit" timestamp`,
        `(or no audit at all). Run the appropriate verifier (TLC for TLA+, lake build for Lean,`,
        `dotnet test for Z3 / Alloy). If a drift is detected (Name / Precondition / Statement /`,
        `Proof / Citation / Coverage class), file a drift report at`,
        `docs/research/verification-drift-audit-YYYY-MM-DD.md, update the registry's audit block,`,
        `open a PR with the fix, arm auto-merge.`,
        `KEY DISCIPLINES:`,
        `- Substrate-honest: if verifier toolchain is missing, skip + record + advance to next.`,
        `- 6 drift classes per NOTEBOOK.md Round 35 (Name / Precondition / Statement / Proof / Citation / Coverage).`,
        `- Cite arXiv / textbook / RFC / canonical-algorithm-by-author-year when audit involves external source.`,
        `- BP-09 ASCII only; BP-07 3000-word cap on notebook updates.`,
        `OPERATIVE AUTHORIZATION: opus-tier model authorized per Aaron 2026-05-21 ("math is hard").`,
        `PUSH-HANG WORKAROUND: under multi-agent saturation, wrap git network ops in`,
        `"timeout --kill-after=5s 30s"; if push silently fails, use REST git-data API bypass`,
        `(per .claude/rules/refresh-world-model-poll-pr-gate.md).`,
    ].join(" ");

    const gate = run("claude", [
        "-p", prompt,
        "-w",
        "--model", claudeModel,
        "--permission-mode", "auto",
        "--output-format", "json",
    ], claudeTimeoutMs);

    const status = gate.status === 0 ? "ok" : `exit-${gate.status}`;
    log(`claude gate end run_id=${runId} status=${gate.status}`);

    writeFileSync(claudeStateFile, JSON.stringify({
        run_id: runId,
        status: gate.status,
        model: claudeModel,
        started_at: nowIso(),
        updated_at: nowIso(),
    }, null, 2));

    if (gate.stdout.trim().length > 0) {
        appendFileSync(join(logDir, "ticks.log"), `\n--- ${runId} soraya claude gate ---\n${gate.stdout}\n`);
    }
    if (gate.stderr.trim().length > 0) {
        appendFileSync(join(logDir, "ticks.err"), `\n--- ${runId} soraya claude gate ---\n${gate.stderr}\n`);
    }

    return status;
}

function heartbeat(): void {
    const fetch = run("timeout", ["--kill-after=5s", "30s", "git", "fetch", "origin"], fetchTimeoutMs);
    const fetchOk = fetch.status === 0 ? "ok" : `exit-${fetch.status}`;

    const sha = run("git", ["rev-parse", "HEAD"], 5_000);
    const gitSha = sha.stdout.trim().slice(0, 12);

    const specs = listSpecs();
    let specResult: { result: "pass" | "fail" | "skip" | "timeout"; durationMs: number; spec: string } | null = null;

    if (specs.length === 0) {
        log("no TLA+ specs found in tools/tla/specs/");
    } else {
        const { spec } = pickNextSpec(specs);
        const tlcResult = runTlcOnSpec(spec);
        publishBusEnvelope(spec, tlcResult.result, tlcResult.durationMs, gitSha);
        specResult = { ...tlcResult, spec };
    }

    const claudeGate = maybeRunClaudeGate();

    const summary = `heartbeat run_id=${runId} fetch=${fetchOk} sha=${gitSha} specs_total=${specs.length} ${
        specResult ? `last_spec=${specResult.spec} result=${specResult.result} duration_ms=${specResult.durationMs}` : "no_spec"
    } claude=${claudeGate}`;
    log(summary);

    // Write heartbeat JSON. Try worktree's .git/agent-heartbeats first (production
    // pattern matching kiro-loop). Falls back to stateDir if .git is a file (worktree
    // case — `.git` is a regular file pointing back to main repo metadata, not a dir).
    const hbPayload = JSON.stringify({
        session: "soraya/soraya-launchd-loop",
        harness: "claude-code",
        persona: "soraya",
        role: "formal-verification-expert",
        model: claudeModel,
        worktree,
        sha: gitSha,
        last_spec: specResult?.spec ?? null,
        last_result: specResult?.result ?? null,
        last_duration_ms: specResult?.durationMs ?? null,
        claude_gate: claudeGate,
        updated_at: nowIso(),
    }, null, 2);

    try {
        const hbDir = join(worktree, ".git/agent-heartbeats");
        mkdirSync(hbDir, { recursive: true });
        writeFileSync(join(hbDir, "soraya-launchd-loop.json"), hbPayload);
    } catch {
        // Worktree case OR permission issue — fall back to stateDir.
        try {
            writeFileSync(join(stateDir, "heartbeat.json"), hbPayload);
            log("heartbeat: wrote to stateDir fallback (worktree case)");
        } catch (e2) {
            log(`heartbeat write failed: ${e2 instanceof Error ? e2.message : String(e2)}`);
        }
    }
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
