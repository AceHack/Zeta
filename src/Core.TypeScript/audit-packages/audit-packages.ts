#!/usr/bin/env bun
// audit-packages.ts — checks every Directory.Packages.props entry
// against the NuGet feed via `dotnet package search`.
//
// TypeScript+Bun port of audit-packages.sh, slice 11 of the TS+Bun
// migration. See docs/best-practices/repo-scripting.md.
//
// Network-dependent: shells out to `dotnet package search <id>
// --exact-match` per package; non-deterministic without a NuGet
// snapshot. Equivalence-test via the no-network failure path
// (each `latest` falls back to `?`).
//
// Usage:
//   bun tools/audit-packages.ts
//
// Exit codes:
//   0  all queryable packages on latest
//   1  one or more packages have a bump available

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

type ExitCode = 0 | 1;

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const PACKAGE_RE = /PackageVersion Include="([^"]+)" Version="([^"]+)"/g;

interface PackageEntry {
  readonly id: string;
  readonly pinned: string;
}

function repoRoot(): string {
  // Match bash original: REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)".
  // Bash resolves the script's path, walks up one (tools/.. → repo root),
  // and cds. The TS port mirrors this via import.meta.url so the script
  // works regardless of caller cwd, the same as the bash behavior.
  const scriptPath = fileURLToPath(import.meta.url);
  return resolve(dirname(scriptPath), "..");
}

function parsePackages(content: string): readonly PackageEntry[] {
  const out: PackageEntry[] = [];
  PACKAGE_RE.lastIndex = 0;
  let m: RegExpExecArray | null = PACKAGE_RE.exec(content);
  while (m !== null) {
    out.push({ id: m[1] ?? "", pinned: m[2] ?? "" });
    m = PACKAGE_RE.exec(content);
  }
  return out;
}

function queryLatest(pkgId: string): string {
  const args = ["package", "search", pkgId, "--exact-match"];
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("dotnet", args, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) return "";
  let last = "";
  for (const line of result.stdout.split("\n")) {
    const cols = line.split("|").map((c) => c.trim());
    const col2 = cols[1] ?? "";
    if (col2 !== pkgId) continue;
    last = cols[2] ?? "";
  }
  return last;
}

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

interface Report {
  readonly id: string;
  readonly pinned: string;
  readonly latest: string;
  readonly marker: string;
}

function classify(
  pinned: string,
  latest: string,
): { marker: string; failed: boolean } {
  if (latest === pinned) return { marker: "✓ up-to-date", failed: false };
  if (latest === "?") return { marker: "? couldn't query", failed: false };
  return { marker: "⚠ bump available", failed: true };
}

export function main(): ExitCode {
  const root = repoRoot();
  const propsPath = join(root, "Directory.Packages.props");
  let content: string;
  try {
    content = readFileSync(propsPath, "utf8");
  } catch {
    process.stderr.write(`error: cannot read ${propsPath}\n`);
    return 1;
  }
  const packages = parsePackages(content);

  // If parsing yields zero entries on a non-empty Directory.Packages.props,
  // the regex has likely drifted from the file format — silent success
  // would hide real audit failure (Codex P2). Fail with a clear message.
  if (packages.length === 0) {
    process.stderr.write(
      `error: parsed 0 PackageVersion entries from ${propsPath} — regex may be stale relative to file format\n`,
    );
    return 1;
  }

  process.stdout.write("=== Dbsp package audit ===\n");
  process.stdout.write(
    `${pad("Package", 35)} ${pad("Pinned", 15)} ${pad("Latest", 15)} Status\n`,
  );
  process.stdout.write(
    `${pad("-------", 35)} ${pad("------", 15)} ${pad("------", 15)} ------\n`,
  );

  let failed = false;
  const reports: Report[] = [];
  for (const pkg of packages) {
    const latest = queryLatest(pkg.id);
    const display = latest === "" ? "?" : latest;
    const { marker, failed: thisFailed } = classify(pkg.pinned, display);
    if (thisFailed) failed = true;
    reports.push({ id: pkg.id, pinned: pkg.pinned, latest: display, marker });
  }

  for (const r of reports) {
    process.stdout.write(
      `${pad(r.id, 35)} ${pad(r.pinned, 15)} ${pad(r.latest, 15)} ${r.marker}\n`,
    );
  }

  process.stdout.write("\n");
  if (!failed) {
    process.stdout.write("✓ All queryable packages on latest.\n");
    return 0;
  }
  process.stdout.write(
    "⚠ Bumps available — update Directory.Packages.props and re-run tests.\n",
  );
  return 1;
}

if (import.meta.main) {
  process.exit(main());
}
