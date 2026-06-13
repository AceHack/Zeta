#!/usr/bin/env bun
// audit-cross-platform-parity.ts — detect bash/PowerShell parity
// gaps across the tools/ tree.
//
// TypeScript+Bun port of audit-cross-platform-parity.sh, slice 2
// of the TS+Bun migration. See `docs/best-practices/repo-scripting.md`
// for the per-slice audit checklist + Zeta scripting conventions.
//
// Rule classes (preserved verbatim from the bash original; full
// rationale in the bash file's header block):
//
//   pre-setup (tools/setup/**/*)
//     - Both .sh AND .ps1 required (Q1 dual-authoring rule).
//   post-setup-permanent (thin wrapper / trivial find-xargs /
//                          stay bash forever)
//     - PowerShell twin required.
//   post-setup-transitional (bun+TS migration candidate /
//                             bash scaffolding)
//     - No twin obligation.
//   exempt-deprecated (tools/_deprecated/)
//     - Awaiting deletion; no obligation.
//
// DST-friendliness:
//   The "Run:" timestamp in the report is the only non-deterministic
//   surface. A clock can be injected into renderReport() for tests.
//
// Usage:
//   bun tools/hygiene/audit-cross-platform-parity.ts            # full report
//   bun tools/hygiene/audit-cross-platform-parity.ts --summary  # counts only
//   bun tools/hygiene/audit-cross-platform-parity.ts --enforce  # exit 2 on gaps
//
// Exit codes:
//   0  no gaps (or non-enforce mode)
//   1  usage error
//   2  --enforce mode with gap count > 0

import {
  spawnSync,
  type SpawnSyncReturns,
} from "node:child_process";
import { readFileSync } from "node:fs";

type AuditExitCode = 0 | 1 | 2;
type Mode = "report" | "summary" | "enforce";

type ParseResult =
  | { readonly kind: "mode"; readonly mode: Mode }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

type Classification =
  | "pre-setup"
  | "post-setup-permanent"
  | "post-setup-transitional"
  | "exempt-deprecated";

interface AuditBuckets {
  readonly paired: readonly string[];
  readonly preSetupGapBash: readonly string[];
  readonly preSetupGapPs1: readonly string[];
  readonly postPermGap: readonly string[];
  readonly transitional: readonly string[];
  readonly exempt: readonly string[];
}

interface Clock {
  readonly nowUtcIso: () => string;
}

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024; // 64 MiB

const PERMANENT_LABELS: readonly string[] = [
  "thin wrapper over existing CLI",
  "trivial find-xargs pipeline",
  "stay bash forever",
];

const TRANSITIONAL_LABELS: readonly string[] = [
  "bun+TS migration candidate",
  "bash scaffolding",
];

const LABEL_DECL_RE = /^# (Post-setup stack|Exception label|label):/i;

function classifyGitFailure(
  args: readonly string[],
  result: SpawnSyncReturns<string>,
): string | null {
  if (result.error) {
    return `Failed to start 'git ${args.join(" ")}': ${result.error.message}`;
  }
  if (result.status === null) {
    if (result.signal !== null) {
      return `'git ${args.join(" ")}' terminated by signal ${result.signal}`;
    }
    return `'git ${args.join(" ")}' terminated before reporting an exit code`;
  }
  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    return stderr !== ""
      ? stderr
      : `'git ${args.join(" ")}' exited ${String(result.status)}`;
  }
  return null;
}

function runGit(args: readonly string[]): string {
  // git is repo-pinned via .mise.toml; args are an explicit string array.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  const failure = classifyGitFailure(args, result);
  if (failure !== null) throw new Error(failure);
  return result.stdout;
}

function gitTracksFile(path: string): boolean {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["ls-files", "--error-unmatch", path], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  return result.status === 0;
}

function parseMode(argv: readonly string[]): ParseResult {
  let mode: Mode = "report";
  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") return { kind: "help" };
    if (arg === "--summary") {
      mode = "summary";
      continue;
    }
    if (arg === "--enforce") {
      mode = "enforce";
      continue;
    }
    return { kind: "error", message: `error: unknown arg: ${arg}` };
  }
  return { kind: "mode", mode };
}

function listToolScripts(): readonly string[] {
  const raw = runGit([
    "ls-files",
    "-z",
    "tools/*.sh",
    "tools/*.ps1",
    "tools/**/*.sh",
    "tools/**/*.ps1",
  ]);
  return raw
    .split("\0")
    .filter((s): s is string => s.length > 0)
    .sort((a, b) => a.localeCompare(b));
}

function readDeclLine(path: string): string | null {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const head = content.split("\n").slice(0, 60);
  for (const line of head) {
    if (LABEL_DECL_RE.test(line)) return line;
  }
  return null;
}

function classify(path: string): Classification {
  if (path.startsWith("tools/setup/")) return "pre-setup";
  if (path.startsWith("tools/_deprecated/")) return "exempt-deprecated";
  const decl = readDeclLine(path);
  if (decl !== null) {
    if (PERMANENT_LABELS.some((l) => decl.includes(l))) {
      return "post-setup-permanent";
    }
    if (TRANSITIONAL_LABELS.some((l) => decl.includes(l))) {
      return "post-setup-transitional";
    }
  }
  return "post-setup-transitional";
}

function classifyShFile(
  file: string,
  buckets: {
    paired: string[];
    preSetupGapBash: string[];
    postPermGap: string[];
    transitional: string[];
    exempt: string[];
  },
): void {
  const stem = file.slice(0, -3);
  const hasTwin = gitTracksFile(`${stem}.ps1`);
  const klass = classify(file);
  if (klass === "pre-setup") {
    if (hasTwin) buckets.paired.push(file);
    else buckets.preSetupGapBash.push(file);
    return;
  }
  if (klass === "post-setup-permanent") {
    if (hasTwin) buckets.paired.push(file);
    else buckets.postPermGap.push(file);
    return;
  }
  if (klass === "post-setup-transitional") {
    buckets.transitional.push(file);
    return;
  }
  buckets.exempt.push(file);
}

function classifyPs1File(
  file: string,
  buckets: { preSetupGapPs1: string[]; transitional: string[]; exempt: string[] },
): void {
  if (file.startsWith("tools/setup/")) {
    const stem = file.slice(0, -4);
    if (!gitTracksFile(`${stem}.sh`)) buckets.preSetupGapPs1.push(file);
    return;
  }
  if (file.startsWith("tools/_deprecated/")) {
    buckets.exempt.push(file);
    return;
  }
  const stem = file.slice(0, -4);
  if (!gitTracksFile(`${stem}.sh`)) buckets.transitional.push(file);
}

export function auditRepo(): AuditBuckets {
  const all = listToolScripts();
  const buckets = {
    paired: [] as string[],
    preSetupGapBash: [] as string[],
    preSetupGapPs1: [] as string[],
    postPermGap: [] as string[],
    transitional: [] as string[],
    exempt: [] as string[],
  };
  for (const file of all) {
    if (file.endsWith(".sh")) classifyShFile(file, buckets);
    else if (file.endsWith(".ps1")) classifyPs1File(file, buckets);
  }
  return {
    paired: buckets.paired,
    preSetupGapBash: buckets.preSetupGapBash,
    preSetupGapPs1: buckets.preSetupGapPs1,
    postPermGap: buckets.postPermGap,
    transitional: buckets.transitional,
    exempt: buckets.exempt,
  };
}

export function gapCount(buckets: AuditBuckets): number {
  return (
    buckets.preSetupGapBash.length +
    buckets.preSetupGapPs1.length +
    buckets.postPermGap.length
  );
}

function renderSummary(buckets: AuditBuckets): string {
  const lines: string[] = [];
  lines.push(`paired:                    ${String(buckets.paired.length)}`);
  lines.push(`transitional (no gap):     ${String(buckets.transitional.length)}`);
  lines.push(`exempt (_deprecated):      ${String(buckets.exempt.length)}`);
  lines.push(
    `gap: pre-setup .sh no twin:  ${String(buckets.preSetupGapBash.length)}`,
  );
  lines.push(
    `gap: pre-setup .ps1 no twin: ${String(buckets.preSetupGapPs1.length)}`,
  );
  lines.push(
    `gap: permanent-bash no .ps1: ${String(buckets.postPermGap.length)}`,
  );
  lines.push(`gap total:                 ${String(gapCount(buckets))}`);
  return lines.join("\n");
}

function renderBulletList(items: readonly string[], suffix: string): string[] {
  if (items.length === 0) return ["- (none)"];
  return items.map((i) => (suffix === "" ? `- ${i}` : `- ${i} ${suffix}`));
}

export function renderReport(
  buckets: AuditBuckets,
  mode: Mode,
  clock: Clock,
): string {
  const lines: string[] = [];
  lines.push("# Cross-platform parity audit");
  lines.push("");
  lines.push(`Run: ${clock.nowUtcIso()}`);
  lines.push(
    "Authoritative rules: docs/POST-SETUP-SCRIPT-STACK.md Q1 (pre-setup)",
  );
  lines.push(
    "  + memory/feedback_stay_bash_forever_implies_powershell_twin_obligation.md",
  );
  lines.push("  (post-setup permanent-bash).");
  lines.push(`Mode: ${mode} (enforcement deferred; exit 2 requires --enforce).`);
  lines.push("");
  lines.push(`## Paired (${String(buckets.paired.length)})`);
  lines.push("");
  lines.push("Scripts with a complete cross-platform twin.");
  lines.push("");
  for (const l of renderBulletList(buckets.paired, "")) lines.push(l);
  lines.push("");
  lines.push(
    `## Gaps — pre-setup bash without PowerShell twin (${String(buckets.preSetupGapBash.length)})`,
  );
  lines.push("");
  lines.push(
    "Q1 violation per docs/POST-SETUP-SCRIPT-STACK.md — pre-setup scripts",
  );
  lines.push(
    "MUST be dual-authored as bash + PowerShell because they run before",
  );
  lines.push("canonical tooling is installed, on OS-default shells.");
  lines.push("");
  for (const l of renderBulletList(
    buckets.preSetupGapBash,
    buckets.preSetupGapBash.length > 0 ? "(missing .ps1)" : "",
  )) {
    lines.push(l === "- (none)" ? "- (none — clean)" : l);
  }
  lines.push("");
  lines.push(
    `## Gaps — pre-setup PowerShell without bash twin (${String(buckets.preSetupGapPs1.length)})`,
  );
  lines.push("");
  for (const l of renderBulletList(
    buckets.preSetupGapPs1,
    buckets.preSetupGapPs1.length > 0 ? "(missing .sh)" : "",
  )) {
    lines.push(l === "- (none)" ? "- (none — clean)" : l);
  }
  lines.push("");
  lines.push(
    `## Gaps — permanent-bash without PowerShell twin (${String(buckets.postPermGap.length)})`,
  );
  lines.push("");
  lines.push(
    "Post-setup permanent-bash exceptions (thin wrapper / find-xargs /",
  );
  lines.push(
    "stay bash forever) owe a .ps1 twin per the 2026-04-22 Windows-twin",
  );
  lines.push("obligation. Missing twin is a quiet break for Windows devs.");
  lines.push("");
  for (const l of renderBulletList(
    buckets.postPermGap,
    buckets.postPermGap.length > 0 ? "(missing .ps1)" : "",
  )) {
    lines.push(l === "- (none)" ? "- (none — clean)" : l);
  }
  lines.push("");
  lines.push(
    `## Transitional / exempt (${String(buckets.transitional.length)} + ${String(buckets.exempt.length)})`,
  );
  lines.push("");
  lines.push(
    "Transitional (bun+TS migration candidate / bash scaffolding): no twin obligation.",
  );
  lines.push("Exempt (tools/_deprecated/): awaiting deletion.");
  lines.push("");
  lines.push("Transitional:");
  for (const l of renderBulletList(buckets.transitional, "")) lines.push(l);
  lines.push("");
  lines.push("Exempt:");
  for (const l of renderBulletList(buckets.exempt, "")) lines.push(l);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- paired:                    ${String(buckets.paired.length)}`);
  lines.push(
    `- transitional (no gap):     ${String(buckets.transitional.length)}`,
  );
  lines.push(`- exempt (_deprecated):      ${String(buckets.exempt.length)}`);
  lines.push(
    `- gap: pre-setup .sh no twin:  ${String(buckets.preSetupGapBash.length)}`,
  );
  lines.push(
    `- gap: pre-setup .ps1 no twin: ${String(buckets.preSetupGapPs1.length)}`,
  );
  lines.push(
    `- gap: permanent-bash no .ps1: ${String(buckets.postPermGap.length)}`,
  );
  lines.push(`- gap total:                 ${String(gapCount(buckets))}`);
  return lines.join("\n");
}

function realClock(): Clock {
  return {
    nowUtcIso: () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
}

export function main(argv: readonly string[]): AuditExitCode {
  const parsed = parseMode(argv);
  if (parsed.kind === "help") {
    process.stdout.write(
      "Usage: audit-cross-platform-parity.ts [--summary | --enforce]\n",
    );
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    return 1;
  }
  const { mode } = parsed;
  const buckets = auditRepo();
  const gaps = gapCount(buckets);

  if (mode === "summary") {
    process.stdout.write(`${renderSummary(buckets)}\n`);
  } else {
    process.stdout.write(`${renderReport(buckets, mode, realClock())}\n`);
  }

  if (mode === "enforce" && gaps > 0) {
    process.stderr.write(
      `\nFAIL: ${String(gaps)} cross-platform parity gap(s). See rules above.\n`,
    );
    return 2;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
