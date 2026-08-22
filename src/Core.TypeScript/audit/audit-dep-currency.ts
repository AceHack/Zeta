#!/usr/bin/env bun
// src/Core.TypeScript/audit/audit-dep-currency.ts
//
// 081KSGS9H0008QG0R002BC2ZR7 sub-target 1 — initial implementation. Scans dep pins across
// the repo + reports staleness against upstream-current versions.
//
// Scope (this initial implementation; sub-target 2+ will extend):
//   1. full-ai-cluster/flake.nix → nixpkgs.url + nix-darwin.url
//   2. ArgoCD Application files under full-ai-cluster/k8s/applications/
//      → spec.source.targetRevision + spec.source.helm.chart
//   3. Container image tags referenced in NixOS modules + K8s manifests
//      (line-level grep for `image: <repo>:<tag>` patterns)
//   4. .mise.toml runtime versions (if file exists)
//
// What it DOES NOT do yet (file as sibling B-NNNN rows when ready):
//   - WebSearch / upstream-API calls for "current latest" — initial
//     output is INVENTORY ONLY (lists all pin-sites + values; operator
//     compares against upstream); follow-on row adds the
//     upstream-comparison step
//   - Weekly cadence GitHub Actions wiring — separate row
//   - PR-opening on drift detection — separate row
//
// This row's deliverable is the INVENTORY substrate: a single TS tool
// that enumerates everywhere in the repo where a version pin lives.
// That output IS the load-bearing input every other sub-target consumes.
//
// Usage:
//   bun src/Core.TypeScript/audit/audit-dep-currency.ts          # human-readable table
//   bun src/Core.TypeScript/audit/audit-dep-currency.ts --json   # machine-readable JSON
//
// Exit codes:
//   0 — inventory completed (always; no version comparison done yet)
//   1 — invocation error

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

interface DepPin {
  category: "nix-input" | "argocd-target" | "argocd-helm-chart" | "image-tag" | "mise-runtime";
  file: string;
  line: number;
  name: string;
  currentPin: string;
}

interface Args {
  jsonOutput: boolean;
  repoRoot: string;
}

interface ArgError {
  error: string;
}

function resolveRepoRoot(): string | null {
  // spawnSync with explicit args[] array (NOT a shell-evaluated string)
  // is the execFile-equivalent safe form: no shell injection risk;
  // arguments passed directly to the binary's argv.
  //
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  return r.stdout.trim();
}

function parseArgs(argv: readonly string[]): Args | ArgError {
  let jsonOutput = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--json") jsonOutput = true;
    else if (a === "-h" || a === "--help") {
      return { error: "Usage: bun src/Core.TypeScript/audit/audit-dep-currency.ts [--json]" };
    } else {
      return { error: `unknown argument: ${a}` };
    }
  }
  const repoRoot = resolveRepoRoot();
  if (repoRoot === null) {
    return { error: "could not resolve repo root via 'git rev-parse --show-toplevel'" };
  }
  return { jsonOutput, repoRoot };
}

function walkFiles(dir: string, ext: readonly string[], skip: readonly string[]): string[] {
  const out: string[] = [];
  const queue: string[] = [dir];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    let entries: string[];
    try {
      entries = readdirSync(cur);
    } catch {
      continue;
    }
    for (const e of entries) {
      if (skip.includes(e)) continue;
      const full = join(cur, e);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        queue.push(full);
      } else if (ext.some((x) => full.endsWith(x))) {
        out.push(full);
      }
    }
  }
  return out;
}

// (1) Scan flake.nix for nix inputs (nixpkgs.url, nix-darwin.url, etc.)
function scanFlakeInputs(repoRoot: string): DepPin[] {
  const pins: DepPin[] = [];
  const flakePath = join(repoRoot, "full-ai-cluster", "flake.nix");
  if (!existsSync(flakePath)) return pins;
  const lines = readFileSync(flakePath, "utf8").split("\n");
  // Match `inputName.url = "github:owner/repo/ref";`
  // Limit alternation members to a moderate length (≤64 chars each) to
  // avoid quadratic-blowup risk per the standard regex-safety guidance.
  const urlRe = /^\s*(\w[\w-]{0,63})\.url\s*=\s*"([^"]{1,256})"/;
  for (let i = 0; i < lines.length; i++) {
    const m = urlRe.exec(lines[i]!);
    if (m) {
      pins.push({
        category: "nix-input",
        file: relative(repoRoot, flakePath),
        line: i + 1,
        name: m[1]!,
        currentPin: m[2]!,
      });
    }
  }
  return pins;
}

// (2) Scan ArgoCD Application yamls for targetRevision + helm chart
function scanArgocdApps(repoRoot: string): DepPin[] {
  const pins: DepPin[] = [];
  const appsDir = join(repoRoot, "full-ai-cluster", "k8s", "applications");
  if (!existsSync(appsDir)) return pins;
  const yamlFiles = walkFiles(appsDir, [".yaml", ".yml"], []);
  // Anchored to start-of-line + bounded value length to avoid catastrophic
  // backtracking; YAML values can be long but 256 chars is generous.
  const targetRevRe = /^\s*targetRevision:\s*["']?([^"'\n]{1,256})["']?\s*$/;
  const chartRe = /^\s*chart:\s*["']?([\w./-]{1,128})["']?\s*$/;
  for (const f of yamlFiles) {
    const lines = readFileSync(f, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const trMatch = targetRevRe.exec(lines[i]!);
      if (trMatch) {
        pins.push({
          category: "argocd-target",
          file: relative(repoRoot, f),
          line: i + 1,
          name: "targetRevision",
          currentPin: trMatch[1]!,
        });
      }
      const chMatch = chartRe.exec(lines[i]!);
      if (chMatch) {
        pins.push({
          category: "argocd-helm-chart",
          file: relative(repoRoot, f),
          line: i + 1,
          name: "chart",
          currentPin: chMatch[1]!,
        });
      }
    }
  }
  return pins;
}

// (3) Scan NixOS modules + K8s manifests for `image: <repo>:<tag>`
function scanImageTags(repoRoot: string): DepPin[] {
  const pins: DepPin[] = [];
  // Look across full-ai-cluster/ which is where K8s + NixOS substrate lives.
  const root = join(repoRoot, "full-ai-cluster");
  if (!existsSync(root)) return pins;
  const files = walkFiles(root, [".yaml", ".yml", ".nix"], ["node_modules", ".git"]);
  // image: registry/path:tag — bounded segment lengths to prevent quadratic
  // alternation runs; trailing tag captured separately.
  const imgRe = /^\s*image:\s*["']?([\w./-]{1,128}):([\w.-]{1,64})["']?\s*$/;
  for (const f of files) {
    const lines = readFileSync(f, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = imgRe.exec(lines[i]!);
      if (m && !m[2]!.includes("=")) {
        pins.push({
          category: "image-tag",
          file: relative(repoRoot, f),
          line: i + 1,
          name: m[1]!,
          currentPin: m[2]!,
        });
      }
    }
  }
  return pins;
}

// (4) Scan .mise.toml for runtime pins
function scanMiseRuntimes(repoRoot: string): DepPin[] {
  const pins: DepPin[] = [];
  const misePath = join(repoRoot, ".mise.toml");
  if (!existsSync(misePath)) return pins;
  const lines = readFileSync(misePath, "utf8").split("\n");
  // [tools] section keys: `name = "version"`.
  // Bounded alternation lengths per regex-safety guidance.
  const toolRe = /^\s*([\w-]{1,64})\s*=\s*"([\w.-]{1,64})"/;
  let inToolsSection = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s*\[tools\]/.test(line)) {
      inToolsSection = true;
      continue;
    }
    if (/^\s*\[/.test(line)) {
      inToolsSection = false;
      continue;
    }
    if (!inToolsSection) continue;
    const m = toolRe.exec(line);
    if (m) {
      pins.push({
        category: "mise-runtime",
        file: relative(repoRoot, misePath),
        line: i + 1,
        name: m[1]!,
        currentPin: m[2]!,
      });
    }
  }
  return pins;
}

function renderTable(pins: readonly DepPin[]): string {
  if (pins.length === 0) return "(no dep pins found)\n";
  const out: string[] = [];
  out.push("# audit-dep-currency.ts — dep-pin inventory");
  out.push("");
  out.push(`Total pins: ${pins.length}`);
  out.push("");
  // Group by category for readability.
  const byCat = new Map<string, DepPin[]>();
  for (const p of pins) {
    if (!byCat.has(p.category)) byCat.set(p.category, []);
    byCat.get(p.category)!.push(p);
  }
  for (const [cat, list] of [...byCat.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    out.push(`## ${cat} (${list.length} pin${list.length === 1 ? "" : "s"})`);
    out.push("");
    out.push("| File | Line | Name | Current pin |");
    out.push("|---|---|---|---|");
    for (const p of list) {
      out.push(`| \`${p.file}\` | ${p.line} | \`${p.name}\` | \`${p.currentPin}\` |`);
    }
    out.push("");
  }
  return out.join("\n");
}

function main(): number {
  const parsed = parseArgs(process.argv.slice(2));
  if ("error" in parsed) {
    process.stderr.write(`audit-dep-currency: ${parsed.error}\n`);
    return 1;
  }
  const { jsonOutput, repoRoot } = parsed;
  const pins: DepPin[] = [
    ...scanFlakeInputs(repoRoot),
    ...scanArgocdApps(repoRoot),
    ...scanImageTags(repoRoot),
    ...scanMiseRuntimes(repoRoot),
  ];
  if (jsonOutput) {
    process.stdout.write(JSON.stringify({ count: pins.length, pins }, null, 2) + "\n");
  } else {
    process.stdout.write(renderTable(pins));
  }
  return 0;
}

process.exit(main());
