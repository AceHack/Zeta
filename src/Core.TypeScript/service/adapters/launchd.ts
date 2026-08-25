/**
 * service/adapters/launchd.ts — macOS launchd adapter for IServiceManager.
 *
 * launchd control goes through `ServiceControlPort` (../service-control-port), NEVER a
 * PATH-resolved `launchctl`. See that file for the port/adapter split, and
 * `privilege/system-tool.ts` for what absolute-path admission does and does not prove.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { IServiceManager, ServiceManagerResult, ServiceManagerStatus, InstallOpts } from "../service-manager";
import { getPersona } from "../persona-registry";
import { resolveEnv } from "../env-schema";
import { createLaunchctlControl, type ServiceControlPort } from "../service-control-port";

const TEMPLATE_PATH = join(dirname(new URL(import.meta.url).pathname), "..", "templates", "launchd.plist");

function plistDst(label: string): string {
  return join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
}

function uid(): string {
  return spawnSync("id", ["-u"], { encoding: "utf8" }).stdout.trim();
}

function bunPath(): string {
  const result = spawnSync("which", ["bun"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "/opt/homebrew/bin/bun";
}

/** Build the launchd control port once, or surface the refusal verbatim. FAIL-CLOSED:
 *  there is no PATH fallback, so an unadmitted launchctl means the operation does not
 *  happen and says why. */
function control(): { ok: true; port: ServiceControlPort } | { ok: false; message: string } {
  const r = createLaunchctlControl();
  return r.ok ? { ok: true, port: r.port } : { ok: false, message: `launchctl unavailable: ${r.reason}` };
}

export class LaunchdAdapter implements IServiceManager {
  private readonly repoRoot: string;

  constructor(repoRoot?: string) {
    this.repoRoot = repoRoot ?? process.cwd();
  }

  async install(persona: string, opts?: InstallOpts): Promise<ServiceManagerResult> {
    const config = getPersona(persona);
    if (!config) return { ok: false, message: `Unknown persona: ${persona}` };

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

    const c = control();
    if (!c.ok) return { ok: false, message: c.message };
    const load = c.port.bootstrap(`gui/${uid()}`, plistDst(config.label));
    if (!load.ok) return { ok: false, message: load.reason };

    return { ok: true, message: `Installed ${persona} as ${config.label}` };
  }

  async uninstall(persona: string): Promise<ServiceManagerResult> {
    const config = getPersona(persona);
    if (!config) return { ok: false, message: `Unknown persona: ${persona}` };

    const c = control();
    // An unusable launchctl must not read as a completed uninstall.
    if (!c.ok) return { ok: false, message: c.message };
    c.port.bootout(`gui/${uid()}`, config.label);
    const path = plistDst(config.label);
    if (existsSync(path)) unlinkSync(path);

    return { ok: true, message: `Uninstalled ${persona}` };
  }

  async status(persona: string): Promise<ServiceManagerStatus> {
    const config = getPersona(persona);
    if (!config) return { state: "not-installed", label: "", persona };

    const c = control();
    if (!c.ok) return { state: "not-installed", label: config.label, persona };
    const d = c.port.describe(`gui/${uid()}`, config.label);
    if (d.found !== true) {
      return { state: "not-installed", label: config.label, persona };
    }
    return { state: d.running ? "installed-running" : "installed-stopped", label: config.label, persona };
  }
}
