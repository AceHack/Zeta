/**
 * service/adapters/task-scheduler.ts — Windows Task Scheduler adapter for IServiceManager.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { getPersona } from "../persona-registry";
import { resolveEnv } from "../env-schema";
const TEMPLATE_PATH = join(dirname(new URL(import.meta.url).pathname), "..", "templates", "task-scheduler.xml");
function taskName(persona) {
    return `ZetaLoop_${persona}`;
}
function bunPath() {
    const result = spawnSync("where", ["bun"], { encoding: "utf8", shell: true });
    if (result.status === 0) {
        const first = result.stdout.trim().split("\n")[0];
        if (first)
            return first;
    }
    const localAppData = process.env["LOCALAPPDATA"] ?? "";
    return join(localAppData, "bun", "bun.exe");
}
export class TaskSchedulerAdapter {
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
            .replace(/\{\{PERSONA\}\}/g, persona)
            .replace(/\{\{BUN_PATH\}\}/g, bunPath())
            .replace(/\{\{REPO_ROOT\}\}/g, root.replace(/\//g, "\\"))
            .replace(/\{\{WORKTREE\}\}/g, env.worktree.replace(/\//g, "\\"))
            .replace(/\{\{INTERVAL\}\}/g, String(interval));
        mkdirSync(env.logDir, { recursive: true });
        mkdirSync(env.stateDir, { recursive: true });
        const tmpXml = join(env.stateDir, `${taskName(persona)}.xml`);
        writeFileSync(tmpXml, content);
        const create = spawnSync("schtasks", ["/Create", "/TN", taskName(persona), "/XML", tmpXml, "/F"], {
            encoding: "utf8", shell: true,
        });
        unlinkSync(tmpXml);
        if (create.status !== 0) {
            return { ok: false, message: `schtasks /Create failed: ${create.stderr}` };
        }
        return { ok: true, message: `Installed ${persona} as task ${taskName(persona)}` };
    }
    async uninstall(persona) {
        const config = getPersona(persona);
        if (!config)
            return { ok: false, message: `Unknown persona: ${persona}` };
        spawnSync("schtasks", ["/Delete", "/TN", taskName(persona), "/F"], { stdio: "ignore", shell: true });
        return { ok: true, message: `Uninstalled ${persona}` };
    }
    async status(persona) {
        const config = getPersona(persona);
        if (!config)
            return { state: "not-installed", label: "", persona };
        const result = spawnSync("schtasks", ["/Query", "/TN", taskName(persona), "/FO", "CSV", "/NH"], {
            encoding: "utf8", shell: true,
        });
        if (result.status !== 0) {
            return { state: "not-installed", label: taskName(persona), persona };
        }
        const running = result.stdout.includes("Running");
        return { state: running ? "installed-running" : "installed-stopped", label: taskName(persona), persona };
    }
}
