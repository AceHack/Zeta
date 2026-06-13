#!/usr/bin/env bun
// setup-dual-background-agents.ts — registers two parallel background
// loop agents (Opus + Sonnet) as launchd services on macOS.
//
// Each agent gets its own worktree, state dir, log dir, and lock dir
// so they don't conflict. Both write to the same model-ratings.jsonl
// via append (atomic on POSIX for lines under PIPE_BUF = 4096 bytes).
//
// Usage: bun tools/ops/setup-dual-background-agents.ts [--dry-run]

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const home = process.env.HOME ?? "/Users/acehack";
const dryRun = process.argv.includes("--dry-run");
const bunPath = spawnSync("which", ["bun"], { encoding: "utf8" }).stdout.trim();

interface AgentConfig {
    label: string;
    model: string;
    worktree: string;
    stateDir: string;
    logDir: string;
}

const agents: AgentConfig[] = [
    {
        label: "com.zeta.claude-loop-opus",
        model: "opus",
        worktree: join(home, ".local/share/zeta-claude-loop-opus/Zeta"),
        stateDir: join(home, "Library/Application Support/ZetaClaudeLoopOpus"),
        logDir: join(home, "Library/Logs/zeta-claude-loop-opus"),
    },
    {
        label: "com.zeta.claude-loop-sonnet",
        model: "sonnet",
        worktree: join(home, ".local/share/zeta-claude-loop-sonnet/Zeta"),
        stateDir: join(home, "Library/Application Support/ZetaClaudeLoopSonnet"),
        logDir: join(home, "Library/Logs/zeta-claude-loop-sonnet"),
    },
];

function plist(cfg: AgentConfig): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>${cfg.label}</string>
    <key>ProgramArguments</key><array>
        <string>${bunPath}</string>
        <string>${cfg.worktree}/.claude/bin/claude-loop-tick.ts</string>
    </array>
    <key>StartInterval</key><integer>60</integer>
    <key>RunAtLoad</key><true/>
    <key>StandardOutPath</key>
      <string>${cfg.logDir}/stdout.log</string>
    <key>StandardErrorPath</key>
      <string>${cfg.logDir}/stderr.log</string>
    <key>EnvironmentVariables</key><dict>
        <key>HOME</key><string>${home}</string>
        <key>ZETA_CLAUDE_LOOP_RUN_CLAUDE</key><string>1</string>
        <key>ZETA_CLAUDE_LOOP_MODEL</key><string>${cfg.model}</string>
        <key>ZETA_CLAUDE_LOOP_WORKTREE</key><string>${cfg.worktree}</string>
        <key>ZETA_CLAUDE_LOOP_STATE_DIR</key><string>${cfg.stateDir}</string>
        <key>ZETA_CLAUDE_LOOP_LOG_DIR</key><string>${cfg.logDir}</string>
    </dict>
</dict>
</plist>`;
}

const uid = spawnSync("id", ["-u"], { encoding: "utf8" }).stdout.trim();

for (const cfg of agents) {
    console.log(`\n=== ${cfg.label} (${cfg.model}) ===`);

    // Create directories
    for (const dir of [cfg.stateDir, cfg.logDir]) {
        console.log(`  mkdir -p ${dir}`);
        if (!dryRun) mkdirSync(dir, { recursive: true });
    }

    // Clone or update worktree
    if (existsSync(join(cfg.worktree, ".git"))) {
        console.log(`  worktree exists, fetching + resetting`);
        if (!dryRun) {
            spawnSync("git", ["fetch", "origin"], { cwd: cfg.worktree });
            spawnSync("git", ["reset", "--hard", "origin/main"], { cwd: cfg.worktree });
        }
    } else {
        console.log(`  cloning to ${cfg.worktree}`);
        if (!dryRun) {
            mkdirSync(join(cfg.worktree, ".."), { recursive: true });
            spawnSync("git", [
                "clone", "https://github.com/Lucent-Financial-Group/Zeta.git",
                cfg.worktree,
            ]);
        }
    }

    // Write plist
    const plistPath = join(home, "Library/LaunchAgents", `${cfg.label}.plist`);
    console.log(`  writing ${plistPath}`);
    if (!dryRun) writeFileSync(plistPath, plist(cfg));

    // Unload old if exists, then bootstrap
    console.log(`  bootstrapping launchd service`);
    if (!dryRun) {
        spawnSync("launchctl", ["bootout", `gui/${uid}/${cfg.label}`]);
        spawnSync("launchctl", [
            "bootstrap", `gui/${uid}`, plistPath,
        ]);
    }
}

// Unload old single-agent plist if it exists
const oldPlist = join(home, "Library/LaunchAgents/com.zeta.claude-loop.plist");
if (existsSync(oldPlist)) {
    console.log(`\n=== Unloading old single-agent service ===`);
    console.log(`  bootout com.zeta.claude-loop`);
    if (!dryRun) {
        spawnSync("launchctl", ["bootout", `gui/${uid}/com.zeta.claude-loop`]);
    }
    console.log(`  Old plist kept at ${oldPlist} (delete manually if desired)`);
}

console.log(`\n=== Done ===`);
console.log(`Two background agents registered:`);
console.log(`  Opus:   ${agents[0]!.label} → ${agents[0]!.worktree}`);
console.log(`  Sonnet: ${agents[1]!.label} → ${agents[1]!.worktree}`);
console.log(`\nBoth write ratings to their respective state dirs.`);
console.log(`Report: bun tools/ops/model-rating-report.ts --reviews`);
if (dryRun) console.log(`\n(DRY RUN — no changes made)`);
