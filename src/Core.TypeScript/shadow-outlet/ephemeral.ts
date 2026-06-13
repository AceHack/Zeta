/**
 * Shadow outlet — Phase 1 library: /tmp ephemeral (B-0212)
 *
 * Importable surface for programmatic callers. The CLI surface lives in
 * outlet.ts; import this module when you need the outlet path without
 * spawning a subprocess.
 *
 * Self-invisibility contract: callers must pass their own agent name as
 * `exclude` when listing entries. The library enforces nothing — enforcement
 * is in outlet.ts for the CLI path and in the calling loop for the import path.
 */

import { existsSync, lstatSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Directory under /tmp (or OS-equivalent) used for all shadow entries. */
export function getEphemeralShadowOutletDir(): string {
  return process.env.ZETA_SHADOW_DIR ?? join(tmpdir(), "zeta-shadow");
}

/**
 * Ensures the outlet directory exists. Creates it (mode 0o700) if absent.
 * Returns the directory path. Safe to call repeatedly — idempotent.
 * Throws if the path exists but is not a directory.
 */
export function ensureEphemeralShadowOutlet(): string {
  const dir = getEphemeralShadowOutletDir();
  if (existsSync(dir)) {
    if (!lstatSync(dir).isDirectory()) {
      throw new Error(`Shadow outlet path exists but is not a directory: ${dir}`);
    }
    return dir;
  }
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}
