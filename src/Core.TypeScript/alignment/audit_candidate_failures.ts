#!/usr/bin/env bun
// audit_candidate_failures.ts — reconstruction audit for filter-gate failures.
//
// B-0058 responsibility #3: failed and deferred candidate adoptions are
// evidence, not trash. This audit makes sure the filter-gate log keeps enough
// structured context for later agents to reconstruct what was rejected, why,
// by whom, and under which alignment clauses.
//
// Usage:
//   bun tools/alignment/audit_candidate_failures.ts
//   bun tools/alignment/audit_candidate_failures.ts --json
//   bun tools/alignment/audit_candidate_failures.ts --md
//   bun tools/alignment/audit_candidate_failures.ts --log PATH
//
// Exit codes:
//   0  Log is parseable and reconstruction fields are present
//   1  One or more reconstruction violations were found
//   2  Script error / bad args

import { existsSync, readFileSync } from "node:fs";
import { logFilePath, type Decision } from "./filter_gate_log.ts";

type ExitCode = 0 | 1 | 2;

type Severity = "violation" | "warning";

interface Args {
  readonly log: string;
  readonly json: boolean;
  readonly md: boolean;
}

type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

export interface CandidateFailureFinding {
  readonly line: number;
  readonly severity: Severity;
  readonly code: string;
  readonly message: string;
  readonly candidate: string | null;
  readonly decision: Decision | null;
}

export interface CandidateFailureAudit {
  readonly schema: "candidate-failure-audit-v1";
  readonly logPath: string;
  readonly totalLines: number;
  readonly totalEntries: number;
  readonly passEntries: number;
  readonly failEntries: number;
  readonly deferEntries: number;
  readonly nonPassEntries: number;
  readonly violations: number;
  readonly warnings: number;
  readonly findings: readonly CandidateFailureFinding[];
}

const VALID_DECISIONS: readonly Decision[] = ["pass", "fail", "defer"] as const;

function parseArgs(argv: readonly string[]): ParseResult {
  const state = {
    log: logFilePath(),
    json: false,
    md: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i] ?? "";
    if (arg === "-h" || arg === "--help") return { kind: "help" };
    if (arg === "--json") {
      state.json = true;
      i += 1;
      continue;
    }
    if (arg === "--md") {
      state.md = true;
      i += 1;
      continue;
    }
    if (arg === "--log") {
      const next = argv[i + 1];
      if (next === undefined) {
        return { kind: "error", message: "audit_candidate_failures: --log requires a path" };
      }
      state.log = next;
      i += 2;
      continue;
    }
    return { kind: "error", message: `audit_candidate_failures: unknown arg: ${arg}` };
  }

  if (state.json && state.md) {
    return { kind: "error", message: "audit_candidate_failures: choose only one of --json or --md" };
  }

  return { kind: "args", args: state };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(entry: Record<string, unknown>, key: string): string | null {
  const value = entry[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readDecision(entry: Record<string, unknown>): Decision | null {
  const value = entry.decision;
  if (typeof value !== "string") return null;
  return VALID_DECISIONS.includes(value as Decision) ? (value as Decision) : null;
}

function readClauses(entry: Record<string, unknown>): readonly string[] | null {
  const value = entry.clauses;
  if (!Array.isArray(value)) return null;
  if (value.some((clause) => typeof clause !== "string" || clause.trim().length === 0)) {
    return null;
  }
  return value;
}

function finding(
  line: number,
  severity: Severity,
  code: string,
  message: string,
  candidate: string | null,
  decision: Decision | null,
): CandidateFailureFinding {
  return { line, severity, code, message, candidate, decision };
}

function validateEntry(
  line: number,
  entry: Record<string, unknown>,
): {
  readonly decision: Decision | null;
  readonly findings: readonly CandidateFailureFinding[];
} {
  const findings: CandidateFailureFinding[] = [];
  const candidate = nonEmptyString(entry, "candidate");
  const decision = readDecision(entry);
  const clauses = readClauses(entry);

  if (entry.schema !== "filter-gate-v1") {
    findings.push(
      finding(line, "violation", "invalid-schema", "entry schema must be filter-gate-v1", candidate, decision),
    );
  }

  for (const key of ["timestamp", "candidate", "source", "rationale", "author"] as const) {
    if (nonEmptyString(entry, key) === null) {
      findings.push(
        finding(line, "violation", `missing-${key}`, `${key} must be a non-empty string`, candidate, decision),
      );
    }
  }

  if (decision === null) {
    findings.push(
      finding(line, "violation", "invalid-decision", "decision must be pass, fail, or defer", candidate, null),
    );
  }

  if (clauses === null) {
    findings.push(
      finding(
        line,
        "violation",
        "invalid-clauses",
        "clauses must be an array of non-empty strings",
        candidate,
        decision,
      ),
    );
  } else if ((decision === "fail" || decision === "defer") && clauses.length === 0) {
    findings.push(
      finding(
        line,
        "warning",
        "non-pass-without-clauses",
        "fail/defer entry has no clause IDs; make the non-adoption rationale reconstructable",
        candidate,
        decision,
      ),
    );
  }

  return { decision, findings };
}

export function auditCandidateFailures(path: string): CandidateFailureAudit {
  const findings: CandidateFailureFinding[] = [];
  let totalLines = 0;
  let totalEntries = 0;
  let passEntries = 0;
  let failEntries = 0;
  let deferEntries = 0;

  if (!existsSync(path)) {
    return {
      schema: "candidate-failure-audit-v1",
      logPath: path,
      totalLines: 0,
      totalEntries: 0,
      passEntries: 0,
      failEntries: 0,
      deferEntries: 0,
      nonPassEntries: 0,
      violations: 0,
      warnings: 0,
      findings: [],
    };
  }

  const content = readFileSync(path, "utf8");
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? "";
    if (raw.trim().length === 0) continue;

    const line = index + 1;
    totalLines += 1;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      findings.push(finding(line, "violation", "malformed-json", "line is not valid JSON", null, null));
      continue;
    }

    if (!isRecord(parsed)) {
      findings.push(finding(line, "violation", "invalid-entry", "line must be a JSON object", null, null));
      continue;
    }

    totalEntries += 1;
    const result = validateEntry(line, parsed);
    findings.push(...result.findings);

    if (result.decision === "pass") passEntries += 1;
    else if (result.decision === "fail") failEntries += 1;
    else if (result.decision === "defer") deferEntries += 1;
  }

  return {
    schema: "candidate-failure-audit-v1",
    logPath: path,
    totalLines,
    totalEntries,
    passEntries,
    failEntries,
    deferEntries,
    nonPassEntries: failEntries + deferEntries,
    violations: findings.filter((f) => f.severity === "violation").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    findings,
  };
}

function emitHuman(audit: CandidateFailureAudit): string {
  const lines: string[] = [];
  lines.push(
    `candidate-failure-audit entries=${String(audit.totalEntries)} nonpass=${String(audit.nonPassEntries)} violations=${String(audit.violations)} warnings=${String(audit.warnings)}`,
  );
  lines.push(`log=${audit.logPath}`);

  if (audit.findings.length === 0) {
    lines.push("No reconstruction gaps found.");
    return lines.join("\n");
  }

  lines.push("");
  for (const f of audit.findings) {
    const candidate = f.candidate === null ? "" : ` candidate=${f.candidate}`;
    const decision = f.decision === null ? "" : ` decision=${f.decision}`;
    lines.push(`  [${f.severity}] line=${String(f.line)} code=${f.code}${candidate}${decision}`);
    lines.push(`         ${f.message}`);
  }
  return lines.join("\n");
}

function emitMarkdown(audit: CandidateFailureAudit): string {
  const lines: string[] = [];
  lines.push("# Candidate-failure reconstruction audit");
  lines.push("");
  lines.push(`Log: \`${audit.logPath}\``);
  lines.push("");
  lines.push(`- Entries: ${String(audit.totalEntries)}`);
  lines.push(`- Non-pass entries: ${String(audit.nonPassEntries)}`);
  lines.push(`- Violations: ${String(audit.violations)}`);
  lines.push(`- Warnings: ${String(audit.warnings)}`);

  if (audit.findings.length === 0) {
    lines.push("");
    lines.push("No reconstruction gaps found.");
    return lines.join("\n");
  }

  lines.push("");
  lines.push("| Line | Severity | Code | Candidate | Decision | Message |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const f of audit.findings) {
    lines.push(
      `| ${String(f.line)} | ${f.severity} | ${f.code} | ${f.candidate ?? ""} | ${f.decision ?? ""} | ${f.message} |`,
    );
  }
  return lines.join("\n");
}

const HELP = `Usage:
  audit_candidate_failures.ts [--log PATH] [--json | --md]
`;

export function main(argv: readonly string[]): ExitCode {
  const parsed = parseArgs(argv);
  if (parsed.kind === "help") {
    process.stdout.write(HELP);
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    return 2;
  }

  const audit = auditCandidateFailures(parsed.args.log);
  if (parsed.args.json) {
    process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
  } else if (parsed.args.md) {
    process.stdout.write(`${emitMarkdown(audit)}\n`);
  } else {
    process.stdout.write(`${emitHuman(audit)}\n`);
  }

  return audit.violations > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
