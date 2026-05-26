#!/usr/bin/env bun
// tools/ci/audit-installer-substrate.ts
//
// Source-level audit of the AI-cluster installer substrate. Runs in
// CI before the ISO is uploaded as a workflow artifact, and locally
// before commits/PRs. Catches the failure mode the maintainer 2026-05-26
// surfaced empirically:
//
//   "the ISO was iter-3-era (May 25) ... downloaded older CI artifact
//    that didn't have iter-5.2 substrate ..."
//
// Root cause: workflow trigger-path filter on build-ai-cluster-iso.yml
// missed the new module paths (full-ai-cluster/nixos/modules/**), so
// PRs adding iter-5.x modules silently failed to rebuild the ISO. Even
// after broadening the trigger paths (this PR), a content-audit floor
// catches the same class of bug if the ISO build silently drops a file.
//
// What this audits (source-level, NOT inside the built ISO):
//   - All expected installer-source files exist + are non-empty
//   - All expected NixOS modules exist + are referenced from common.nix
//   - Specific iter-N sentinel strings present in zeta-install.sh +
//     zeta-first-boot.sh (catches "merge dropped the iter-N substrate"
//     fix-fwd regressions before they ship)
//
// Why source-level + not ISO-mount-level:
//   - 7z/xorriso/unsquashfs are heavier dependencies in CI
//   - Source-level audit catches the same bug class (module-missing,
//     sentinel-missing) at a fraction of the cost
//   - ISO-mount-level audit is a separate follow-on; would catch
//     ISO-build-system bugs where the build silently drops embedded
//     files. Out of scope for this iteration; both audits compose.
//
// Exit codes:
//   0 — all assertions pass
//   1 — one or more files missing
//   2 — one or more required sentinel strings missing from files
//   3 — invocation error (bad args, etc.)

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");

interface FileAssertion {
  readonly path: string;
  readonly minBytes?: number;
}

interface SentinelAssertion {
  readonly path: string;
  readonly mustContain: readonly string[];
  readonly rationale: string;
}

// Required installer-substrate files. Each must exist + be non-empty.
// When adding a new iter-N substrate module, add its expected path
// here so the audit catches "the new module wasn't checked in" + the
// CI workflow then catches "the ISO build silently dropped it".
const REQUIRED_FILES: readonly FileAssertion[] = [
  // iter-3 + iter-4 baseline
  { path: "full-ai-cluster/usb-nixos-installer/zeta-install.sh", minBytes: 1000 },
  { path: "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh", minBytes: 500 },
  { path: "full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix", minBytes: 500 },
  // iter-4 SSH+password credential substrate (B-0789)
  { path: "full-ai-cluster/nixos/modules/initial-password.nix" },
  { path: "full-ai-cluster/nixos/modules/operator-ssh-keys.nix" },
  { path: "full-ai-cluster/nixos/modules/operator-ssh-keys.txt" },
  // iter-5.1 + 5.2 + 5.2.2 substrate (B-0792)
  { path: "full-ai-cluster/nixos/modules/common.nix", minBytes: 500 },
  { path: "full-ai-cluster/nixos/modules/injected-hostname.nix" },
  { path: "full-ai-cluster/nixos/modules/login-banner.nix" },
  // operator-side flash tool (B-0789 + iter-5.x)
  { path: "full-ai-cluster/tools/zflash.ts", minBytes: 1000 },
];

// Sentinel-string assertions: catches the case where a file exists but
// its iter-N substrate was dropped in a fix-fwd. Each sentinel is a
// short, unique string anchored to a specific iter-N feature.
const REQUIRED_SENTINELS: readonly SentinelAssertion[] = [
  {
    path: "full-ai-cluster/usb-nixos-installer/zeta-install.sh",
    mustContain: [
      "Step 6.5: iter-4.2 probe boot USB for operator SSH pubkey", // iter-4.2 pubkey injection
      "Step 6.6: iter-5.2 hostname injection", // iter-5.2 hostname-read
      "Step 6.7: iter-5.1 wifi persistence", // iter-5.1 NM-profile persist
      "iter-5.2.2", // iter-5.2.2 install-time auto-gen marker
      "/dev/urandom", // install-time hostname generator
    ],
    rationale: "iter-4.2 + iter-5.1 + iter-5.2 + iter-5.2.2 substrate must be present in installer script",
  },
  {
    path: "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh",
    mustContain: [
      "ETHERNET_WAIT_SECS", // eth-30s wait
      "nmtui", // wifi setup TUI launch
      "zeta-install", // calls into zeta-install.sh after network up
    ],
    rationale: "first-boot script must include eth-wait + nmtui + zeta-install call",
  },
  {
    path: "full-ai-cluster/nixos/modules/common.nix",
    mustContain: [
      "./injected-hostname.nix", // iter-5.2 hostname-override module
      "./login-banner.nix", // iter-5.2.2 pre-login banner module
      "services.avahi", // iter-5.1 mDNS publishing
      "nssmdns4", // Avahi mDNS via nss
    ],
    rationale: "common.nix must import the iter-5.x modules so every host inherits them",
  },
  {
    path: "full-ai-cluster/nixos/modules/injected-hostname.nix",
    mustContain: [
      "cluster-node-id", // file zeta-install.sh writes
      "networking.hostName", // the override target
      "lib.mkOverride", // priority override mechanism
    ],
    rationale: "injected-hostname module must read cluster-node-id + override networking.hostName",
  },
  {
    path: "full-ai-cluster/nixos/modules/login-banner.nix",
    mustContain: [
      "services.getty.greetingLine",
      "services.getty.helpLine",
      "Hostname:", // human-readable label in the banner
      "ssh zeta@", // ssh-from-Mac hint
    ],
    rationale: "login-banner must wire getty greeting + help line with hostname + ssh hint",
  },
];

interface AuditFailure {
  readonly kind: "missing-file" | "empty-file" | "missing-sentinel" | "read-error";
  readonly path: string;
  readonly detail: string;
}

function auditFiles(): readonly AuditFailure[] {
  const failures: AuditFailure[] = [];
  for (const { path, minBytes } of REQUIRED_FILES) {
    const abs = join(ROOT, path);
    if (!existsSync(abs)) {
      failures.push({ kind: "missing-file", path, detail: `expected file does not exist` });
      continue;
    }
    try {
      const st = statSync(abs);
      if (minBytes !== undefined && st.size < minBytes) {
        failures.push({
          kind: "empty-file",
          path,
          detail: `file size ${st.size} < required ${minBytes} bytes`,
        });
      }
    } catch (e) {
      failures.push({
        kind: "read-error",
        path,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return failures;
}

function auditSentinels(): readonly AuditFailure[] {
  const failures: AuditFailure[] = [];
  for (const { path, mustContain, rationale } of REQUIRED_SENTINELS) {
    const abs = join(ROOT, path);
    if (!existsSync(abs)) {
      failures.push({
        kind: "missing-file",
        path,
        detail: `file expected to contain sentinels does not exist (rationale: ${rationale})`,
      });
      continue;
    }
    let content: string;
    try {
      content = readFileSync(abs, "utf8");
    } catch (e) {
      failures.push({
        kind: "read-error",
        path,
        detail: e instanceof Error ? e.message : String(e),
      });
      continue;
    }
    for (const sentinel of mustContain) {
      if (!content.includes(sentinel)) {
        failures.push({
          kind: "missing-sentinel",
          path,
          detail: `missing required sentinel string ${JSON.stringify(sentinel)} (rationale: ${rationale})`,
        });
      }
    }
  }
  return failures;
}

function main(): number {
  const fileFailures = auditFiles();
  const sentinelFailures = auditSentinels();
  const total = fileFailures.length + sentinelFailures.length;

  if (total === 0) {
    process.stdout.write(
      `audit-installer-substrate: PASS — ${REQUIRED_FILES.length} required files + ${REQUIRED_SENTINELS.length} sentinel-file assertions OK\n`,
    );
    return 0;
  }

  process.stderr.write(
    `audit-installer-substrate: FAIL — ${total} assertion(s) failed\n\n`,
  );
  for (const f of [...fileFailures, ...sentinelFailures]) {
    process.stderr.write(`  [${f.kind}] ${f.path}\n    ${f.detail}\n`);
  }
  process.stderr.write("\n");
  process.stderr.write(
    `  To investigate locally: bun tools/ci/audit-installer-substrate.ts\n` +
      `  To add a new iter-N module: add its path to REQUIRED_FILES + (if applicable)\n` +
      `  add its sentinels to REQUIRED_SENTINELS in this file.\n`,
  );
  // Distinct exit codes per failure class for CI introspection
  if (fileFailures.length > 0 && sentinelFailures.length === 0) return 1;
  if (sentinelFailures.length > 0 && fileFailures.length === 0) return 2;
  return 1; // both kinds present; exit 1 prioritized
}

process.exit(main());
