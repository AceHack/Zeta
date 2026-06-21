/**
 * service/adapters/systemd.ts — Linux systemd user adapter for IServiceManager.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { getPersona } from "../persona-registry";
import { resolveEnv } from "../env-schema";
const SERVICE_TEMPLATE = join(dirname(new URL(import.meta.url).pathname), "..", "templates", "systemd.service");
const TIMER_TEMPLATE = join(dirname(new URL(import.meta.url).pathname), "..", "templates", "systemd.timer");
function unitDir() {
    return join(homedir(), ".config", "systemd", "user");
}
function unitName(persona) {
    return `zeta-loop-${persona}`;
}
function bunPath() {
    const result = spawnSync("which", ["bun"], { encoding: "utf8" });
    return result.status === 0 ? result.stdout.trim() : join(homedir(), ".bun", "bin", "bun");
}
function systemctl(...args) {
    return spawnSync("systemctl", ["--user", ...args], { encoding: "utf8" });
}
export class SystemdAdapter {
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
        const name = unitName(persona);
        if (!existsSync(SERVICE_TEMPLATE) || !existsSync(TIMER_TEMPLATE)) {
            return { ok: false, message: "Systemd templates not found" };
        }
        const replacements = (content) => content
            .replace(/\{\{PERSONA\}\}/g, persona)
            .replace(/\{\{BUN_PATH\}\}/g, bunPath())
            .replace(/\{\{REPO_ROOT\}\}/g, root)
            .replace(/\{\{WORKTREE\}\}/g, env.worktree)
            .replace(/\{\{STATE_DIR\}\}/g, env.stateDir)
            .replace(/\{\{LOG_DIR\}\}/g, env.logDir)
            .replace(/\{\{REF\}\}/g, env.ref)
            .replace(/\{\{INTERVAL\}\}/g, String(interval));
        const serviceContent = replacements(readFileSync(SERVICE_TEMPLATE, "utf8"));
        const timerContent = replacements(readFileSync(TIMER_TEMPLATE, "utf8"));
        mkdirSync(env.logDir, { recursive: true });
        mkdirSync(env.stateDir, { recursive: true });
        mkdirSync(unitDir(), { recursive: true });
        writeFileSync(join(unitDir(), `${name}.service`), serviceContent);
        writeFileSync(join(unitDir(), `${name}.timer`), timerContent);
        systemctl("daemon-reload");
        const enable = systemctl("enable", "--now", `${name}.timer`);
        if (enable.status !== 0) {
            return { ok: false, message: `systemctl enable failed: ${enable.stderr}` };
        }
        return { ok: true, message: `Installed ${persona} as ${name}.timer` };
    }
    async uninstall(persona) {
        const config = getPersona(persona);
        if (!config)
            return { ok: false, message: `Unknown persona: ${persona}` };
        const name = unitName(persona);
        systemctl("disable", "--now", `${name}.timer`);
        systemctl("daemon-reload");
        const servicePath = join(unitDir(), `${name}.service`);
        const timerPath = join(unitDir(), `${name}.timer`);
        if (existsSync(servicePath))
            unlinkSync(servicePath);
        if (existsSync(timerPath))
            unlinkSync(timerPath);
        return { ok: true, message: `Uninstalled ${persona}` };
    }
    async status(persona) {
        const config = getPersona(persona);
        if (!config)
            return { state: "not-installed", label: "", persona };
        const name = unitName(persona);
        const result = systemctl("is-active", `${name}.timer`);
        if (result.stdout.trim() === "active") {
            return { state: "installed-running", label: `${name}.timer`, persona };
        }
        const exists = existsSync(join(unitDir(), `${name}.timer`));
        return { state: exists ? "installed-stopped" : "not-installed", label: `${name}.timer`, persona };
    }
}
