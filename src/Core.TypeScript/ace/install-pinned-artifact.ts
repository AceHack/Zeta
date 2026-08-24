#!/usr/bin/env bun
// install-pinned-artifact.ts — the CLI the CI lanes call instead of `curl … | sh`.
//
//   bun src/Core.TypeScript/ace/install-pinned-artifact.ts --pin .github/ollama-pin.json
//
// Exit codes:
//   0  the pinned artifact is installed and the binary on PATH is the pinned build
//   1  refused — the reason is printed as a ::error:: annotation; NOTHING was installed
//
// There is no fallback flag and there will not be one. A bypass on a digest check is the
// thing that makes it stop being a check.
//
// The decision logic lives in pinned-artifact.ts and is unit-tested with injected effects;
// this file is only the real doors — network, filesystem, process.

import { spawnSync } from "node:child_process";
import { accessSync, constants, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { installPinnedArtifact, type InstallEffects } from "./pinned-artifact.ts";
import { resolveElevatorPathOrThrow } from "../privilege/elevator.ts";

interface Args {
  readonly pin: string;
  readonly help: boolean;
  readonly error?: string;
}

export function parseArgs(argv: readonly string[]): Args {
  let pin = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") return { pin: "", help: true };
    if (a === "--pin") {
      const v = argv[++i];
      if (v === undefined) return { pin: "", help: false, error: "--pin needs a path" };
      pin = v;
      continue;
    }
    return { pin: "", help: false, error: `unknown arg: ${a}` };
  }
  if (pin === "") return { pin: "", help: false, error: "--pin <file> is required" };
  return { pin, help: false };
}

/** `::error::` so a refusal renders in the run UI, not only in scrollback. */
function annotate(message: string): void {
  console.error(`::error title=pinned artifact::${message}`);
}

function realEffects(): InstallEffects {
  return {
    hostPlatform: () => `${process.platform}/${process.arch === "x64" ? "x86_64" : process.arch}`,

    fetchBytes: async (url) => {
      // Three attempts: a 1.4GB asset meets transient 5xx and resets. Retrying weakens
      // nothing — every attempt lands in the same digest comparison.
      let lastErr = "";
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch(url, { redirect: "follow" });
          if (!res.ok) {
            lastErr = `HTTP ${res.status}`;
          } else {
            return new Uint8Array(await res.arrayBuffer());
          }
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
        }
        if (attempt < 3) await new Promise((r) => setTimeout(r, 5000 * attempt));
      }
      throw new Error(lastErr);
    },

    writeTemp: async (fileName, bytes) => {
      const dir = mkdtempSync(join(tmpdir(), "zeta-pin-"));
      const path = join(dir, fileName);
      writeFileSync(path, bytes);
      return path;
    },

    extract: async (archivePath, destDir) => {
      // `tar --zstd` (GNU tar >= 1.31) — one process, no shell, no pipeline. sudo only when
      // we are not already root; the CI runner is not.
      const needsSudo = typeof process.getuid === "function" && process.getuid() !== 0;
      // Resolved ABSOLUTE, root-owned, setuid — never through PATH. A privilege elevator
      // resolved by name is substitutable by any writable directory earlier on `PATH`, and
      // this one unpacks an archive as root (docs/BUGS.md P1, 2026-08-24). `tar` itself is
      // left on PATH deliberately: it runs unprivileged on the root branch, and the
      // elevated branch passes it as an ARGUMENT to sudo, whose secure_path applies.
      const cmd = needsSudo ? resolveElevatorPathOrThrow("sudo") : "tar";
      const args = needsSudo
        ? ["tar", "--zstd", "-xf", archivePath, "-C", destDir]
        : ["--zstd", "-xf", archivePath, "-C", destDir];
      const r = spawnSync(cmd, args, { encoding: "utf8" });

      // DROP THE ARCHIVE IMMEDIATELY, on both paths. `curl | zstd -d | tar -x` never stored
      // the 1.4GB asset; verifying a digest requires having the whole thing, so this now costs
      // 1.4GB of peak disk the old pipeline did not. The heartbeat also pulls ~5.5GB of models
      // onto the same runner, and the verification lane only pulls the 400MB one — so that
      // headroom was NOT exercised by the check that proved this works. Freeing it here means
      // the difference never has to be argued about.
      try {
        rmSync(dirname(archivePath), { recursive: true, force: true });
      } catch {
        // Best-effort: a runner is ephemeral, and failing to tidy is not a reason to fail an
        // install that otherwise succeeded.
      }

      if (r.status === 0) return { ok: true, message: "" };
      return {
        ok: false,
        message: `extracting ${archivePath} into ${destDir} failed (status ${String(r.status)}): ${(r.stderr ?? "").trim()}`,
      };
    },

    // PATH scanned directly rather than via `command -v` with `shell: true`. Handing a
    // security tool a shell to interpolate a name into is the wrong default even when the
    // name comes from a repo-controlled file — and this form has no shell at all.
    which: async (binary) => {
      for (const dir of (process.env["PATH"] ?? "").split(":")) {
        if (dir.length === 0) continue;
        const candidate = join(dir, binary);
        try {
          accessSync(candidate, constants.X_OK);
          return candidate;
        } catch {
          // not here; keep looking
        }
      }
      return null;
    },

    run: async (binary, args) => {
      const r = spawnSync(binary, [...args], { encoding: "utf8" });
      return { ok: r.status === 0, output: `${r.stdout ?? ""}\n${r.stderr ?? ""}` };
    },

    log: (line) => console.log(line),
  };
}

async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);
  if (args.help) {
    console.log("usage: install-pinned-artifact.ts --pin <pin.json>");
    return 0;
  }
  if (args.error !== undefined) {
    annotate(args.error);
    return 1;
  }

  let raw: unknown;
  try {
    raw = await Bun.file(args.pin).json();
  } catch (e) {
    annotate(`cannot read pin ${args.pin}: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }

  const outcome = await installPinnedArtifact(raw, realEffects());
  if (outcome.ok) {
    console.log(`[pin] ${outcome.name}@${outcome.version} installed into ${outcome.installedInto}`);
    return 0;
  }
  annotate(`${outcome.reason}: ${outcome.message}`);
  return 1;
}

// Guarded with `if`, never `||`: a module-level short-circuit would call process.exit on
// IMPORT, which is how a runner elsewhere in this repo silently reported "0 tests, exit 0".
if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
