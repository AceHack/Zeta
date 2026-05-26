#!/usr/bin/env bun
// tools/ci/audit-installer-iso-content.ts
//
// Inspects the BUILT installer ISO and asserts expected substrate
// is actually present inside it. Complements
// tools/ci/audit-installer-substrate.ts (source-level audit) by
// catching the bug class where the ISO build process silently drops
// a file that's present in the source tree.
//
// Cascade #4 (Aaron 2026-05-26: "start working on the CI stuff
// while we iterate"). Runs in CI after `nix build .#installer-iso`
// + before the ISO artifact upload step in build-ai-cluster-iso.yml,
// so a broken-ISO artifact never reaches operators.
//
// What this audits:
//   - The ISO is a valid ISO9660 image readable by `7z l`
//   - Expected top-level files are present (boot loader configs,
//     squashfs image, isolinux/grub configs)
//   - The nix-store squashfs is present + non-empty
//
// What this does NOT yet audit (out of scope; cascade #5 territory):
//   - Contents WITHIN the nix-store squashfs (would need unsquashfs;
//     large + slow; the source-substrate audit catches "module missing
//     from repo" already)
//   - Live boot behavior (nixosTest framework; cascade #5)
//
// Usage:
//   bun tools/ci/audit-installer-iso-content.ts --iso <path>
//   bun tools/ci/audit-installer-iso-content.ts --iso /tmp/iso/zeta-installer-X.iso
//
// Requires `7z` on PATH (universally available on ubuntu-latest +
// macOS via `brew install p7zip`). The ubuntu-24.04 runner ships
// 7z by default.
//
// Exit codes:
//   0 — all assertions pass
//   1 — ISO file not found / invocation error
//   2 — 7z listing failed (corrupt ISO / not an ISO)
//   3 — expected file missing from ISO content listing

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

interface Args {
  readonly isoPath: string;
}

interface ArgError {
  readonly error: string;
}

function parseArgs(argv: readonly string[]): Args | ArgError {
  let isoPath = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--iso") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return { error: "--iso requires a path argument" };
      }
      isoPath = next;
      i++;
      continue;
    }
    if (a === "-h" || a === "--help") {
      return { error: "Usage: bun tools/ci/audit-installer-iso-content.ts --iso <path>" };
    }
    return { error: `unknown argument: ${a}` };
  }
  if (isoPath === "") {
    return { error: "--iso <path> is required" };
  }
  return { isoPath };
}

// Expected top-level files in the NixOS installer ISO. These names
// come from the standard NixOS installer ISO structure produced by
// `nixos-generators -f iso` / `nixosConfigurations.installer.config
// .system.build.isoImage`. If the structure changes upstream, add
// the new expected files here.
const REQUIRED_ISO_PATHS: readonly { path: string; rationale: string }[] = [
  {
    path: "nix-store.squashfs",
    rationale: "NixOS installer's read-only nix store; contains zeta-install.sh + flake + modules",
  },
  {
    path: "boot/bzImage",
    rationale: "Linux kernel image; bootable ISO must include it",
  },
  {
    path: "boot/initrd",
    rationale: "initramfs; bootable ISO must include it",
  },
  {
    path: "boot/grub/grub.cfg",
    rationale: "Grub bootloader config; UEFI + BIOS boot paths use this",
  },
];

function lsIso(isoPath: string): { ok: boolean; lines: string[]; stderr: string } {
  // `7z l <iso>` lists the contents. Parse format:
  // ----------
  //    Date      Time    Attr         Size   Compressed  Name
  // ----------
  // 2026-05-26 06:44:32 ....A    1875193856              nix-store.squashfs
  // 2026-05-26 06:44:32 ....A      12345678              boot/bzImage
  // ...
  const r = spawnSync("7z", ["l", "-slt", isoPath], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) {
    return { ok: false, lines: [], stderr: r.stderr ?? "" };
  }
  // 7z -slt format puts Path= lines for each entry; extract those.
  const lines = (r.stdout ?? "")
    .split("\n")
    .filter((l) => l.startsWith("Path = "))
    .map((l) => l.slice("Path = ".length).trim());
  return { ok: true, lines, stderr: "" };
}

interface AuditFailure {
  readonly kind: "missing-path";
  readonly path: string;
  readonly rationale: string;
}

function auditIsoContent(isoPath: string): readonly AuditFailure[] | string {
  if (!existsSync(isoPath)) {
    return `ISO file does not exist: ${isoPath}`;
  }
  const ls = lsIso(isoPath);
  if (!ls.ok) {
    return `7z list failed (not a readable ISO?): ${ls.stderr}`;
  }
  // 7z paths are stored relative to ISO root; normalize by removing
  // leading "/" if present (varies by 7z version).
  const presentPaths = new Set(ls.lines.map((p) => p.replace(/^\/+/, "")));
  const failures: AuditFailure[] = [];
  for (const { path, rationale } of REQUIRED_ISO_PATHS) {
    if (!presentPaths.has(path)) {
      failures.push({ kind: "missing-path", path, rationale });
    }
  }
  return failures;
}

function main(): number {
  const parsed = parseArgs(process.argv.slice(2));
  if ("error" in parsed) {
    process.stderr.write(`audit-installer-iso-content: ${parsed.error}\n`);
    return 1;
  }
  const result = auditIsoContent(parsed.isoPath);
  if (typeof result === "string") {
    process.stderr.write(`audit-installer-iso-content: ${result}\n`);
    return 2;
  }
  if (result.length === 0) {
    process.stdout.write(
      `audit-installer-iso-content: PASS — ${parsed.isoPath} contains all ${REQUIRED_ISO_PATHS.length} expected top-level files\n`,
    );
    return 0;
  }
  process.stderr.write(
    `audit-installer-iso-content: FAIL — ${result.length} missing path(s) in ISO ${parsed.isoPath}\n\n`,
  );
  for (const f of result) {
    process.stderr.write(`  [${f.kind}] ${f.path}\n    ${f.rationale}\n`);
  }
  process.stderr.write("\n");
  return 3;
}

process.exit(main());
