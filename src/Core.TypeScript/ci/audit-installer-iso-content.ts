#!/usr/bin/env bun
// src/Core.TypeScript/ci/audit-installer-iso-content.ts
//
// Inspects the BUILT installer ISO and asserts expected substrate
// is actually present inside it. Complements
// src/Core.TypeScript/ci/audit-installer-substrate.ts (source-level audit) by
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
//   bun src/Core.TypeScript/ci/audit-installer-iso-content.ts --iso <path>
//   bun src/Core.TypeScript/ci/audit-installer-iso-content.ts --iso /tmp/iso/zeta-installer-X.iso
//
// Requires `7z` on PATH (universally available on ubuntu-latest +
// macOS via `brew install p7zip`). The ubuntu-24.04 runner ships
// 7z by default.
//
// Exit codes:
//   0 — all assertions pass
//   1 — ISO file not found / not-a-regular-file / invocation error
//   2 — 7z listing failed (corrupt ISO / not an ISO)
//   3 — required-path assertion(s) failed (missing path OR present-but-empty)

import { existsSync, statSync } from "node:fs";
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
      return { error: "Usage: bun src/Core.TypeScript/ci/audit-installer-iso-content.ts --iso <path>" };
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
//
// IMPORTANT — empirically learned 2026-05-26: NixOS installer ISOs do
// NOT put bootloader configs at the legacy `boot/grub/grub.cfg` path.
// BIOS boot uses isolinux (`isolinux/isolinux.cfg`); UEFI boot uses
// refind (`EFI/BOOT/refind_x64.efi`). Earlier draft asserted
// `boot/grub/grub.cfg` and blocked every ISO build from PR #5119 →
// #5125 because the audit's REQUIRED list didn't match NixOS-actual
// layout. The 3 must-exist paths below ARE sufficient to assert
// "this is a bootable NixOS installer ISO" — without nix-store.squashfs
// + kernel + initrd, nothing boots. Bootloader presence is asserted
// separately via REQUIRED_BOOTLOADER_ANY (one-of family) below.
const REQUIRED_ISO_PATHS: readonly { path: string; rationale: string }[] = [
  {
    path: "nix-store.squashfs",
    rationale: "NixOS installer's read-only nix store; contains zeta-install.sh + flake + modules",
  },
];

// Kernel + initrd path checks moved to any-of-family per 081KSGS9H0008QG0R003SWZF9J (2026-05-26).
// nixpkgs 25.11 places kernel + initrd at variant paths (per-arch / store-hash
// / etc.) instead of the legacy `boot/bzImage` + `boot/initrd` top-level
// locations 24.11 used. Same fix-fwd pattern as 081KSGS9H0008QG0R00033DT02 (isoName) — relax to
// any-of with multiple candidate paths to survive nixpkgs-channel bumps,
// AND dump full entry list on failure for self-debugging future regressions.
// Suffix-pattern matching (per 081KSGS9H0008QG0R003SWZF9J follow-up; empirical 25.11 paths
// confirmed via diagnostic dump on build run 26465084701):
//
//   kernel: boot/nix/store/<hash>-linux-<version>/bzImage
//   initrd: boot/nix/store/<hash>-initrd-linux-<version>/initrd
//
// The store-hash in the path varies per build, so exact-path lookup IS
// impossible by construction. Match by directory-prefix + filename-suffix
// to handle both legacy (24.11 top-level) AND store-hashed (25.11+)
// layouts uniformly. Each entry's suffix-match against ANY entry in the
// ISO satisfies the assertion.
const REQUIRED_KERNEL_ANY: readonly { prefix: string; suffix: string; rationale: string }[] = [
  // boot/...path.../bzImage covers BOTH legacy 24.11 (boot/bzImage — startsWith("boot/")
  // + endsWith("/bzImage") since the path's last 8 chars are "/bzImage") AND
  // 25.11 store-hashed (boot/nix/store/<hash>-linux-<ver>/bzImage). No separate
  // legacy entry needed (fix-fwd Copilot finding on #5263 — earlier draft had
  // {prefix:"", suffix:"boot/bzImage"} which wasn't actually exact-match + was
  // redundant with the entry above).
  { prefix: "boot/", suffix: "/bzImage", rationale: "Linux kernel — any boot/...path.../bzImage (covers 24.11 boot/bzImage + 25.11 boot/nix/store/<hash>-linux-<ver>/bzImage + per-arch paths)" },
  { prefix: "boot/", suffix: "/kernel", rationale: "Linux kernel (generic-named convention)" },
  { prefix: "boot/", suffix: "/vmlinuz", rationale: "Linux kernel (vmlinuz convention)" },
  { prefix: "boot/", suffix: "/vmlinuz-linux", rationale: "Linux kernel (alt vmlinuz convention)" },
];

const REQUIRED_INITRD_ANY: readonly { prefix: string; suffix: string; rationale: string }[] = [
  // Same legacy-via-prefix-suffix coverage as kernel above; no separate legacy
  // entry needed (fix-fwd Copilot finding on #5263).
  { prefix: "boot/", suffix: "/initrd", rationale: "initramfs — any boot/...path.../initrd (covers 24.11 boot/initrd + 25.11 boot/nix/store/<hash>-initrd-linux-<ver>/initrd + per-arch paths)" },
  { prefix: "boot/", suffix: "/initrd.img", rationale: "initramfs (.img convention)" },
];

// At least ONE of these bootloader-config paths must exist for the ISO
// to be bootable. NixOS installer ISOs as of nixos-24.11 use isolinux
// for BIOS + refind for UEFI; future channels may change. The "any-of"
// assertion keeps the audit useful across NixOS-version bootloader
// shifts without re-breaking when the channel bumps.
const REQUIRED_BOOTLOADER_ANY: readonly { path: string; rationale: string }[] = [
  {
    path: "isolinux/isolinux.cfg",
    rationale: "BIOS boot config (isolinux) — present on standard NixOS installer ISOs",
  },
  {
    path: "EFI/BOOT/refind_x64.efi",
    rationale: "UEFI boot loader (refind) — present on standard NixOS installer ISOs",
  },
  {
    path: "EFI/BOOT/BOOTX64.EFI",
    rationale: "UEFI boot loader (generic) — alternative naming",
  },
  {
    path: "boot/grub/grub.cfg",
    rationale: "GRUB config (legacy) — kept for forward-compatibility if NixOS switches",
  },
];

interface IsoEntry {
  readonly path: string;
  readonly size: number;
}

interface LsIsoResult {
  readonly ok: boolean;
  readonly entries: readonly IsoEntry[];
  readonly stderr: string;
}

function lsIso(isoPath: string): LsIsoResult {
  // `7z l -slt <iso>` lists the contents in "single-line technical"
  // format, one attribute per line per entry, separated by blank lines.
  // Example:
  //   Path = nix-store.squashfs
  //   Size = 1875193856
  //   ...
  //   (blank line)
  //   Path = boot/bzImage
  //   Size = 12345678
  //
  // Parse into entries with {path, size} so we can assert non-empty
  // (fix-fwd P? on #5119 — header comment claimed "non-empty" but
  // implementation only checked presence; now both).
  //
  // sonarjs/no-os-command-from-path suppression rationale: this tool
  // intentionally spawns the `7z` binary that comes from the
  // ubuntu-24.04 runner's default PATH; the CI workflow doesn't have
  // a stable absolute path for it across runner-image versions, and
  // the input (isoPath) is already validated as an existing local
  // file before spawn (no shell metachar concerns).
  //
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync("7z", ["l", "-slt", isoPath], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) {
    // r.status is null when spawn itself failed (e.g., 7z not on PATH).
    // Include r.error.message + r.signal in returned stderr so local
    // runs clearly see WHY (fix-fwd P? on #5119).
    return {
      ok: false,
      entries: [],
      stderr: `spawn-error: ${r.error.message}${r.signal ? ` (signal: ${r.signal})` : ""}`,
    };
  }
  if (r.status !== 0) {
    return { ok: false, entries: [], stderr: r.stderr ?? "" };
  }
  // Parse Path=...+Size=... blocks. Walk the lines, tracking the
  // current entry; emit when we hit a blank line or a new Path=.
  const entries: IsoEntry[] = [];
  let curPath: string | null = null;
  let curSize: number | null = null;
  const flush = (): void => {
    if (curPath !== null) {
      entries.push({ path: curPath, size: curSize ?? 0 });
    }
    curPath = null;
    curSize = null;
  };
  for (const line of (r.stdout ?? "").split("\n")) {
    if (line.startsWith("Path = ")) {
      flush();
      curPath = line.slice("Path = ".length).trim();
    } else if (line.startsWith("Size = ") && curPath !== null) {
      const n = Number.parseInt(line.slice("Size = ".length).trim(), 10);
      if (Number.isFinite(n)) curSize = n;
    } else if (line.trim() === "" && curPath !== null) {
      flush();
    }
  }
  flush();
  return { ok: true, entries, stderr: "" };
}

interface AuditFailure {
  readonly kind: "missing-path" | "empty-required-path";
  readonly path: string;
  readonly rationale: string;
  readonly detail?: string;
}

interface AuditError {
  readonly kind: "missing-file" | "list-failed";
  readonly detail: string;
}

function isAuditError(r: readonly AuditFailure[] | AuditError): r is AuditError {
  return !Array.isArray(r);
}

function auditIsoContent(isoPath: string): readonly AuditFailure[] | AuditError {
  if (!existsSync(isoPath)) {
    // Distinct error class so main() can map to a distinct exit code
    // (fix-fwd P? on #5119 — was returning bare string + main treated
    // as "7z list failed" exit 2; now uses kind to map to correct
    // exit 1 "ISO file not found / invocation error" per the contract
    // in the header comment).
    return { kind: "missing-file", detail: `ISO file does not exist: ${isoPath}` };
  }
  // Path exists but may be a directory, symlink-to-nothing-readable, or
  // device file. Treat any non-regular-file under the same exit-1
  // "invocation error" class as the missing-file case (Copilot P1 on
  // #5120 — without this, a directory or unreadable path falls through
  // to the 7z spawn path and produces exit 2 "list-failed" which the
  // header contract reserves for corrupt-ISO / not-an-ISO cases).
  try {
    const st = statSync(isoPath);
    if (!st.isFile()) {
      return {
        kind: "missing-file",
        detail: `ISO path exists but is not a regular file: ${isoPath} (mode=${st.mode.toString(8)})`,
      };
    }
  } catch (e) {
    return {
      kind: "missing-file",
      detail: `cannot stat ISO path ${isoPath}: ${(e as Error).message}`,
    };
  }
  const ls = lsIso(isoPath);
  if (!ls.ok) {
    return { kind: "list-failed", detail: `7z list failed (not a readable ISO?): ${ls.stderr}` };
  }
  // 7z paths are stored relative to ISO root; normalize by removing
  // leading "/" if present (varies by 7z version).
  const entryByPath = new Map<string, IsoEntry>();
  for (const e of ls.entries) {
    entryByPath.set(e.path.replace(/^\/+/, ""), e);
  }
  const failures: AuditFailure[] = [];
  for (const { path, rationale } of REQUIRED_ISO_PATHS) {
    const entry = entryByPath.get(path);
    if (entry === undefined) {
      failures.push({ kind: "missing-path", path, rationale });
      continue;
    }
    // Non-empty assertion for nix-store.squashfs specifically
    // (header comment promises this; fix-fwd P? on #5119).
    if (path === "nix-store.squashfs" && entry.size <= 0) {
      failures.push({
        kind: "empty-required-path",
        path,
        rationale,
        detail: `entry present but size=${entry.size} (header comment promises non-empty)`,
      });
    }
  }
  // Bootloader any-of check: at least one of the known bootloader paths
  // must exist. NixOS installer ISOs vary in which bootloader they ship
  // by channel (isolinux/refind today; could change in future channels);
  // any-of keeps the audit forward-compatible. Use `.some()` (boolean)
  // rather than `.find()` (Copilot P0 on #5125: under noUnusedLocals
  // the unused `bootloaderHit` const would fail tsc; .some avoids the
  // unused-variable shape entirely).
  if (!REQUIRED_BOOTLOADER_ANY.some((b) => entryByPath.has(b.path))) {
    failures.push({
      kind: "missing-path",
      path: REQUIRED_BOOTLOADER_ANY.map((b) => b.path).join(" | "),
      rationale: `none of the known bootloader configs found; ISO is unlikely to boot. Candidates checked: ${REQUIRED_BOOTLOADER_ANY.map((b) => `${b.path} (${b.rationale})`).join("; ")}`,
    });
  }
  // Suffix-pattern match helper (081KSGS9H0008QG0R003SWZF9J follow-up): an entry satisfies a
  // candidate when its key starts with the candidate's prefix AND ends with
  // the candidate's suffix. Either field empty means "no constraint at that
  // end". This handles 25.11's store-hashed paths like
  // boot/nix/store/<hash>-linux-<ver>/bzImage where the hash varies per build.
  const allEntryPaths = Array.from(entryByPath.keys());
  const matchesAny = (
    candidates: readonly { prefix: string; suffix: string }[],
  ): boolean => candidates.some((c) =>
    allEntryPaths.some((p) => p.startsWith(c.prefix) && p.endsWith(c.suffix)),
  );
  // Kernel any-of check (081KSGS9H0008QG0R003SWZF9J + 25.11 store-hashed-path follow-up):
  // nixpkgs 25.11 places kernel at boot/nix/store/<hash>-linux-<ver>/bzImage
  // — exact-path lookup impossible by construction (hash varies per build).
  // Suffix-match handles both legacy (24.11 boot/bzImage) AND new (25.11
  // store-hashed) layouts uniformly.
  if (!matchesAny(REQUIRED_KERNEL_ANY)) {
    failures.push({
      kind: "missing-path",
      path: REQUIRED_KERNEL_ANY.map((k) => `${k.prefix}*${k.suffix}`).join(" | "),
      rationale: `none of the known kernel suffix-patterns found; ISO is unlikely to boot. Candidates checked: ${REQUIRED_KERNEL_ANY.map((k) => `${k.prefix}*${k.suffix} (${k.rationale})`).join("; ")}`,
    });
  }
  // Initrd any-of check (081KSGS9H0008QG0R003SWZF9J + 25.11 store-hashed-path follow-up):
  // same shape as kernel-any-of above.
  if (!matchesAny(REQUIRED_INITRD_ANY)) {
    failures.push({
      kind: "missing-path",
      path: REQUIRED_INITRD_ANY.map((i) => `${i.prefix}*${i.suffix}`).join(" | "),
      rationale: `none of the known initrd suffix-patterns found; ISO is unlikely to boot. Candidates checked: ${REQUIRED_INITRD_ANY.map((i) => `${i.prefix}*${i.suffix} (${i.rationale})`).join("; ")}`,
    });
  }
  return failures;
}

// Defensive substrate addition (081KSGS9H0008QG0R003SWZF9J): when the audit fails, dump
// a sample of the actual ISO entries so future regressions self-debug.
// Without this, the failure log shows only "[missing-path] X" with no
// indication of what IS present. Dump first 80 entries (sorted by
// path) — enough to spot kernel/initrd at variant locations + see
// the actual directory layout. Sized small enough to fit in CI log
// scroll-back without overwhelming.
function dumpIsoEntriesForDiagnostic(isoPath: string, limit: number = 80): string {
  // Reuses lsIso() (fix-fwd Copilot P0 on #5235): single source of truth
  // for the 7z invocation + already carries the sonarjs/no-os-command-from-path
  // suppression + maxBuffer (64 MiB) + r.error handling that the diagnostic
  // dump needs to be safe on large ISOs. 7z is PATH-resolved (the suppression
  // in lsIso explicitly accepts this); diagnostic dump inherits that resolution.
  // Earlier draft open-coded a separate spawnSync that would fail the CI lint pass.
  const ls = lsIso(isoPath);
  if (!ls.ok) {
    return `  (could not dump entries: ${ls.stderr})`;
  }
  // entries are parsed by lsIso to {path, size}; we just want paths here.
  // Normalize leading slashes (fix-fwd Copilot finding on #5251): auditIsoContent
  // strips leading "/" via .replace(/^\/+/, "") at line ~274 so failure messages
  // report "boot/..." paths; this dump must use the same normalization or
  // operators see "/boot/..." in the dump vs "boot/..." in the failure list,
  // making cross-reference harder. Same regex used here for consistency.
  const paths = ls.entries
    .map((e) => e.path.replace(/^\/+/, ""))
    .filter((p) => p !== "" && p !== isoPath)
    .sort();
  if (paths.length === 0) return "  (no entries found)";
  const sample = paths.slice(0, limit);
  const tail = paths.length > limit ? `\n  ... and ${paths.length - limit} more entries` : "";
  return sample.map((p) => `  ${p}`).join("\n") + tail;
}

function main(): number {
  const parsed = parseArgs(process.argv.slice(2));
  if ("error" in parsed) {
    process.stderr.write(`audit-installer-iso-content: ${parsed.error}\n`);
    return 1;
  }
  const result = auditIsoContent(parsed.isoPath);
  // Distinct error kinds map to distinct exit codes per the header
  // contract. The `isAuditError` typeguard narrows the union without
  // requiring `as` casts (Copilot P2 on #5120 — earlier draft used
  // a redundant `"kind" in result` check + cast; the typeguard
  // pattern is the canonical TS form for this shape, and works
  // around TS's `Array.isArray` not narrowing `readonly T[]` unions
  // directly via the lib.es5 signature).
  if (isAuditError(result)) {
    process.stderr.write(`audit-installer-iso-content: ${result.detail}\n`);
    return result.kind === "missing-file" ? 1 : 2;
  }
  const failures = result;
  if (failures.length === 0) {
    process.stdout.write(
      `audit-installer-iso-content: PASS — ${parsed.isoPath} contains all ${REQUIRED_ISO_PATHS.length} expected top-level files\n`,
    );
    return 0;
  }
  process.stderr.write(
    `audit-installer-iso-content: FAIL — ${failures.length} assertion(s) failed for ISO ${parsed.isoPath}\n\n`,
  );
  for (const f of failures) {
    process.stderr.write(`  [${f.kind}] ${f.path}\n    ${f.rationale}\n`);
    if (f.detail) {
      process.stderr.write(`    detail: ${f.detail}\n`);
    }
  }
  process.stderr.write("\n");
  // Diagnostic dump (081KSGS9H0008QG0R003SWZF9J) — show what's actually in the ISO so the
  // candidate any-of paths can be extended next time nixpkgs shifts.
  // Derive the limit from a single constant so the header text + the
  // function call never drift apart (fix-fwd Copilot finding on #5235).
  const DIAG_DUMP_LIMIT = 80;
  process.stderr.write(`ISO entries (first ${DIAG_DUMP_LIMIT} sorted) for diagnostic:\n`);
  process.stderr.write(dumpIsoEntriesForDiagnostic(parsed.isoPath, DIAG_DUMP_LIMIT));
  process.stderr.write("\n\n");
  return 3;
}

process.exit(main());
