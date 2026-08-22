/**
 * service/env-schema.ts — unified ZETA_LOOP_* environment schema.
 *
 * All personas share one env var set. No more ZETA_KIRO_* vs ZETA_CLAUDE_*.
 */

import { homedir, platform } from "node:os";
import { join } from "node:path";
import { getPersona } from "./persona-registry";

export interface LoopEnv {
  readonly persona: string;
  readonly worktree: string;
  readonly stateDir: string;
  readonly logDir: string;
  readonly ref: string;
  readonly toolPathPrefix: string | undefined;
}

/** Derive default paths from persona name, cross-platform. */
export function defaultPaths(persona: string): { worktree: string; stateDir: string; logDir: string } {
  const home = homedir();
  const os = platform();

  if (os === "darwin") {
    return {
      worktree: join(home, ".zeta", "agents", persona, "workspace"),
      stateDir: join(home, "Library", "Application Support", `Zeta${capitalize(persona)}Loop`),
      logDir: join(home, "Library", "Logs", `zeta-${persona}-loop`),
    };
  }
  if (os === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? join(home, "AppData", "Local");
    const base = join(localAppData, `zeta-${persona}-loop`);
    return {
      worktree: join(base, "Zeta"),
      stateDir: join(base, "state"),
      logDir: base,
    };
  }
  // Linux / other
  return {
    worktree: join(home, ".zeta", "agents", persona, "workspace"),
    stateDir: join(home, ".local", "state", `zeta-${persona}-loop`),
    logDir: join(home, ".local", "state", `zeta-${persona}-loop`, "logs"),
  };
}

/** Resolve the full LoopEnv from env vars + persona defaults. */
export function resolveEnv(persona: string): LoopEnv {
  const config = getPersona(persona);
  const paths = defaultPaths(persona);
  const toolPathPrefix = process.env.ZETA_LOOP_TOOL_PATH_PREFIX?.trim();

  return {
    persona,
    worktree: process.env.ZETA_LOOP_WORKTREE ?? paths.worktree,
    stateDir: process.env.ZETA_LOOP_STATE_DIR ?? paths.stateDir,
    logDir: process.env.ZETA_LOOP_LOG_DIR ?? paths.logDir,
    ref: process.env.ZETA_LOOP_REF ?? config?.defaultRef ?? "main",
    toolPathPrefix: toolPathPrefix === "" ? undefined : toolPathPrefix,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
