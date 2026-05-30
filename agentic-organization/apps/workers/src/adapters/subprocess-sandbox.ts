/**
 * Subprocess sandbox adapter — a real SandboxToolPort that runs a tool as a
 * bounded, isolated child process:
 *   - executed in a throwaway temp dir (isolated cwd),
 *   - with a stripped environment (only PATH), so the tool cannot read worker
 *     secrets/config,
 *   - killed (SIGKILL) on timeout, with output size capped,
 *   - never inherits the parent stdio.
 *
 * Result-as-DU: failures (non-zero exit, timeout, spawn error) come back as
 * { ok:false, reason } — the agent run treats tool failure as supplementary,
 * never fatal.
 */

import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SandboxToolPort, SandboxToolRequest, SandboxToolResult } from "../../../../packages/application/src/index.ts";

const MAX_OUTPUT_BYTES = 64 * 1024;

/** POSIX "/..." or Windows "C:\..." / "C:/...". */
function isAbsolutePath(command: string): boolean {
  return command.startsWith("/") || /^[A-Za-z]:[\\/]/.test(command);
}

export function createSubprocessSandbox(): SandboxToolPort {
  return {
    run: async (request: SandboxToolRequest): Promise<SandboxToolResult> => {
      // The contract requires an absolute command path. A relative command would
      // be resolved via PATH and could execute an unexpected binary, so reject
      // it as a Result rather than spawning it.
      if (!isAbsolutePath(request.command)) {
        return { ok: false, reason: `sandbox command must be an absolute path, got '${request.command}'` };
      }
      const workdir = mkdtempSync(join(tmpdir(), "agentic-sandbox-"));
      try {
        return await new Promise<SandboxToolResult>((resolve) => {
          execFile(
            request.command,
            [...request.args],
            {
              cwd: workdir,
              timeout: request.timeoutMs,
              killSignal: "SIGKILL",
              maxBuffer: MAX_OUTPUT_BYTES,
              encoding: "utf8",
              // stripped env: only PATH, so the tool cannot read worker secrets
              env: { PATH: process.env["PATH"] ?? "/usr/local/bin:/usr/bin:/bin" },
              windowsHide: true,
            },
            (error, stdout) => {
              if (error !== null) {
                resolve({ ok: false, reason: error.message });
                return;
              }
              resolve({ ok: true, stdout });
            },
          );
        });
      } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : String(error) };
      } finally {
        rmSync(workdir, { recursive: true, force: true });
      }
    },
  };
}
