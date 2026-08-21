#!/usr/bin/env bun
// lint-nixos-rebuild-needs-impure.ts — a pure-eval rebuild silently UN-provisions a node.
//
// THE INVARIANT
//
//   Every `nixos-rebuild ... --flake ...` command string that this repo prints or
//   documents for a Zeta cluster node must carry `--impure`. Without it the node's
//   entire eval-time injection surface silently evaluates to "absent".
//
// WHAT WAS MEASURED (2026-08-21, Determinate Nix 3.21.0 / Nix 2.34.6, aarch64-darwin).
// Not inferred from the manual — run:
//
//     $ cat flake.nix
//     { outputs = { self }: { p = builtins.pathExists "/etc/hosts"; }; }
//     $ nix eval .#p            # pure eval, the default for a flake ref
//     false                     # <-- /etc/hosts EXISTS. Pure eval says it does not.
//     $ nix eval --impure .#p
//     true
//
// and, unguarded:
//
//     { outputs = { self }: { r = builtins.readFile "/etc/hosts"; }; }
//     $ nix eval .#r            # error: forbidden in pure evaluation mode
//
// So the two builtins fail DIFFERENTLY, and the difference is the whole bug:
// `builtins.readFile` on an absolute path REFUSES loudly, but `builtins.pathExists`
// returns `false` QUIETLY. Every injection module in `full-ai-cluster/nixos/modules/`
// guards its `readFile` behind a `pathExists`, which is correct defensive style and
// which converts the loud refusal into a silent no-op:
//
//   injected-hostname.nix         /etc/zeta/cluster-node-id
//   injected-join-server.nix      /etc/zeta/cluster-join-server-url
//   injected-cluster-address.nix  /etc/zeta/cluster-segment-{address,mac}, control-plane addr
//   operator-authorized-keys.nix  /etc/zeta/operator-authorized-keys
//
// Under a pure-eval rebuild each one takes its "no file -> keep the default" branch,
// which is exactly the branch it was designed to take when the operator did not ask
// for injection. The node therefore reverts, with no error and no warning:
//
//   * `networking.hostName` -> the flake host's hardcoded name (every node becomes
//     `control-plane` again — the very collision injected-hostname.nix exists to fix)
//   * `services.k3s.serverAddr` -> `k3s-agent.nix`'s mkDefault, and the static cluster
//     segment addressing disappears, so a joiner stops being able to reach its founder
//   * `users.users.zeta.openssh.authorizedKeys.keys` -> the empty list, i.e. the
//     operator's captured pubkeys are REMOVED from the installed system
//
// That last one is a lockout on a routine update, produced by the command the
// installer itself prints when it finishes.
//
// WHY A LINT AND NOT A COMMENT. `zeta-install.sh` already passes `--impure` to
// `nixos-install`, and already carries a comment about it — whose stated mechanism
// ("flake pure-mode refuses non-store absolute paths") is the `readFile` half only,
// and is therefore wrong in the direction that hurts: the team believed this failure
// was loud. Meanwhile every `nixos-rebuild` string in the tree omitted the flag. A
// paragraph did not keep them in sync; a check does.
//
// SCOPE. `full-ai-cluster/` only. That is where the eval-time `/etc/zeta` reads live,
// so it is where the flag is load-bearing; a wider net would flag unrelated NixOS
// prose and a lint that cries wolf is one somebody disables.
//
// NO EXEMPTION MARKER, deliberately. An escape hatch here would be used by the first
// person who found the flag inconvenient, which is the same person this guard exists
// for. If a genuinely pure rebuild is ever wanted, this file is where that decision
// gets argued and recorded.
//
// HONEST LIMIT. This checks command STRINGS in the repo. It cannot stop an operator
// typing the command from memory, and it does not prove the injection modules behave
// on real hardware. What it does prove is that the repo never again hands somebody a
// command that silently un-provisions their node.
//
// Usage:  bun src/Core.TypeScript/hygiene/lint-nixos-rebuild-needs-impure.ts
// Exit:   0 = every documented flake rebuild carries --impure; 1 = at least one does not.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export type Violation = { readonly file: string; readonly line: number; readonly text: string };

/** Where the eval-time `/etc/zeta` reads live, and therefore where the flag matters. */
export const SCANNED_SURFACES: readonly string[] = ["full-ai-cluster"];

/** Extensions that can carry a command string an operator will copy. */
export const SCANNED_EXTENSIONS = /\.(sh|nix|md|txt|ya?ml|ps1)$/u;

/**
 * A `nixos-rebuild` invocation naming a flake.
 *
 * `--flake` is required in the match because a bare `nixos-rebuild switch` reads
 * `/etc/nixos/configuration.nix` in impure mode already — the pure-eval trap is
 * specific to the flake path.
 */
export const NIXOS_REBUILD_FLAKE = /nixos-rebuild\b[^\n]*--flake\b/u;

/** The flag whose absence is the bug. */
export const IMPURE_FLAG = /--impure\b/u;

export function scanText(file: string, text: string): readonly Violation[] {
  const out: Violation[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!NIXOS_REBUILD_FLAKE.test(line)) continue;
    if (IMPURE_FLAG.test(line)) continue;
    out.push({ file, line: i + 1, text: line.trim() });
  }
  return out;
}

function walk(p: string, acc: string[] = []): string[] {
  if (!existsSync(p)) return acc;
  if (statSync(p).isFile()) {
    acc.push(p);
    return acc;
  }
  for (const e of readdirSync(p)) {
    if (e === "node_modules" || e.startsWith(".git")) continue;
    walk(join(p, e), acc);
  }
  return acc;
}

export function scanSurfaces(
  surfaces: readonly string[] = SCANNED_SURFACES,
  read: (p: string) => string = (p) => readFileSync(p, "utf-8"),
): readonly Violation[] {
  const out: Violation[] = [];
  for (const s of surfaces) {
    for (const f of walk(s)) {
      if (!SCANNED_EXTENSIONS.test(f)) continue;
      out.push(...scanText(f, read(f)));
    }
  }
  return out;
}

function main(): number {
  const scanned = SCANNED_SURFACES.filter((s) => existsSync(s));
  if (scanned.length === 0) {
    console.error("lint-nixos-rebuild-needs-impure: no surface found — run from the repo root.");
    return 2;
  }
  const found = scanSurfaces();
  if (found.length === 0) {
    console.log(
      "nixos-rebuild --impure: OK — every documented flake rebuild under " +
        `${scanned.join(", ")} carries --impure, so the /etc/zeta injection modules ` +
        "still see their files.",
    );
    return 0;
  }
  console.error(
    `nixos-rebuild --impure: ${String(found.length)} flake rebuild command(s) omit --impure:`,
  );
  for (const v of found) console.error(`  ${v.file}:${String(v.line)}  ${v.text}`);
  console.error(
    "\nA flake ref evaluates PURE by default, and in pure eval `builtins.pathExists`\n" +
      "on an absolute path returns FALSE rather than erroring (measured: Nix 2.34.6).\n" +
      "Every module under full-ai-cluster/nixos/modules/ that reads /etc/zeta guards its\n" +
      "readFile behind that pathExists, so a pure rebuild silently reverts the node's\n" +
      "hostname, its k3s join endpoint and segment address, and DROPS the operator's\n" +
      "authorized SSH keys. Add --impure, or change the module to read at activation\n" +
      "time the way initial-password.nix does.",
  );
  return 1;
}

if (import.meta.main) process.exit(main());
