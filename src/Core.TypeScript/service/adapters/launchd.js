/**
 * service/adapters/launchd.ts — macOS launchd adapter for IServiceManager.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { getPersona } from "../persona-registry";
import { resolveEnv } from "../env-schema";
const TEMPLATE_PATH = join(dirname(new URL(import.meta.url).pathname), "..", "templates", "launchd.plist");
function plistDst(label) {
    return join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
}
function uid() {
    return spawnSync("id", ["-u"], { encoding: "utf8" }).stdout.trim();
}
function bunPath() {
    const result = spawnSync("which", ["bun"], { encoding: "utf8" });
    return result.status === 0 ? result.stdout.trim() : "/opt/homebrew/bin/bun";
}
export class LaunchdAdapter {
    repoRoot;
    constructor(repoRoot) {
        this.repoRoot = repoRoot ?? process.cwd();
    }
    async install(persona, opts) {
        const config = getPersona(persona);
        if (!config)
            return { ok: false, message: `Unknown persona: ${persona}` };
        await this.uninstall(persona);
        const env = resolveEnv(persona);
        const interval = opts?.schedule ?? config.scheduleInterval;
        const root = opts?.repoRoot ?? this.repoRoot;
        if (!existsSync(TEMPLATE_PATH)) {
            return { ok: false, message: `Template not found: ${TEMPLATE_PATH}` };
        }
        let content = readFileSync(TEMPLATE_PATH, "utf8");
        content = content
            .replace(/\{\{LABEL\}\}/g, config.label)
            .replace(/\{\{PERSONA\}\}/g, persona)
            .replace(/\{\{BUN_PATH\}\}/g, bunPath())
            .replace(/\{\{REPO_ROOT\}\}/g, root)
            .replace(/\{\{WORKTREE\}\}/g, env.worktree)
            .replace(/\{\{STATE_DIR\}\}/g, env.stateDir)
            .replace(/\{\{LOG_DIR\}\}/g, env.logDir)
            .replace(/\{\{REF\}\}/g, env.ref)
            .replace(/\{\{INTERVAL\}\}/g, String(interval))
            .replace(/\{\{HOME\}\}/g, homedir());
        mkdirSync(env.logDir, { recursive: true });
        mkdirSync(env.stateDir, { recursive: true });
        mkdirSync(dirname(plistDst(config.label)), { recursive: true });
        const tmpPath = plistDst(config.label) + ".tmp";
        writeFileSync(tmpPath, content);
        const lint = spawnSync("plutil", ["-lint", tmpPath], { encoding: "utf8" });
        if (lint.status !== 0) {
            unlinkSync(tmpPath);
            return { ok: false, message: `plutil lint failed: ${lint.stderr}` };
        }
        writeFileSync(plistDst(config.label), content);
        unlinkSync(tmpPath);
        const load = spawnSync("launchctl", ["bootstrap", `gui/${uid()}`, plistDst(config.label)], { encoding: "utf8" });
        if (load.status !== 0) {
            return { ok: false, message: `launchctl bootstrap failed: ${load.stderr}` };
        }
        return { ok: true, message: `Installed ${persona} as ${config.label}` };
    }
    async uninstall(persona) {
        const config = getPersona(persona);
        if (!config)
            return { ok: false, message: `Unknown persona: ${persona}` };
        spawnSync("launchctl", ["bootout", `gui/${uid()}/${config.label}`], { stdio: "ignore" });
        const path = plistDst(config.label);
        if (existsSync(path))
            unlinkSync(path);
        return { ok: true, message: `Uninstalled ${persona}` };
    }
    async status(persona) {
        const config = getPersona(persona);
        if (!config)
            return { state: "not-installed", label: "", persona };
        const result = spawnSync("launchctl", ["print", `gui/${uid()}/${config.label}`], { encoding: "utf8" });
        if (result.status !== 0) {
            return { state: "not-installed", label: config.label, persona };
        }
        const running = result.stdout.includes("state = running");
        return { state: running ? "installed-running" : "installed-stopped", label: config.label, persona };
    }
}
