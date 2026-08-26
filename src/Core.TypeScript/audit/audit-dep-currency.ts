#!/usr/bin/env bun
// src/Core.TypeScript/audit/audit-dep-currency.ts
//
// 081KSGS9H0008QG0R002BC2ZR7 sub-target 1 — initial implementation. Scans dep pins across
// the repo + reports staleness against upstream-current versions.
//
// Scope (this initial implementation; sub-target 2+ will extend):
//   1. EVERY tracked flake.nix in the repo → its `inputs` block
//      (both the `name.url = "..."` form and the attrset form
//      `name = { url = "..."; ... };`). Flakes are DISCOVERED via
//      `git ls-files -- '*flake.nix'`, never hardcoded — see
//      `trackedFlakeFiles` below for why.
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

export interface DepPin {
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

// (1) Scan every tracked flake.nix for nix inputs.
//
// DISCOVERY, NOT A PATH LIST. This function used to read exactly one
// hardcoded path — `full-ai-cluster/flake.nix` — which made the repo's
// OTHER flake, the 239-line root `flake.nix` and its four inputs,
// invisible to the whole dep-currency apparatus. A second hardcoded
// entry would be the same defect with a longer list: it diverges again
// the next time somebody adds a flake. So the roster is derived from
// `git ls-files`, exactly as `hygiene/mise-pin-parity.ts` already does
// for the same class of question — a newly added flake is covered the
// moment it is tracked.

/**
 * Tracked `flake.nix` paths, repo-relative, ordinal-sorted.
 *
 * Same discovery mechanism as `hygiene/mise-pin-parity.ts:trackedFlakes`.
 * Throws rather than returning `[]` when git fails: a scan that silently
 * finds zero flake inputs is indistinguishable from a clean pass, which
 * is the vacuity class this audit exists to avoid.
 */
export function trackedFlakeFiles(repoRoot: string): string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["ls-files", "-z", "--", "*flake.nix"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`git ls-files failed (exit ${String(result.status)}): ${result.stderr ?? ""}`);
  }
  return result.stdout
    .split("\0")
    .filter((p) => p.length > 0 && p.split("/").at(-1) === "flake.nix")
    .sort();
}

// `inputs = {` opens the block we care about; anything outside it (the
// `outputs` function, `let` bindings, module attrsets) is not an input
// declaration and must not be reported as one.
const INPUTS_OPEN_RE = /^\s*inputs\s*=\s*\{/;
// Direct form: `nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";`
// Bounded lengths per the repo's regex-safety guidance (no unbounded
// alternation, so no quadratic-backtracking risk).
const DIRECT_URL_RE = /^\s*(\w[\w-]{0,63})\.url\s*=\s*"([^"]{1,256})"/;
// Attrset form, line 1: `nix-darwin = {`
const ATTRSET_OPEN_RE = /^\s*(\w[\w-]{0,63})\s*=\s*\{\s*$/;
// Attrset form, line 2: `  url = "github:nix-darwin/nix-darwin/...";`
const BARE_URL_RE = /^\s*url\s*=\s*"([^"]{1,256})"/;

/**
 * Parse the `inputs` block of one flake's text into pins.
 *
 * Exported so the falsifier can drive it from fixtures without a repo.
 * Handles BOTH declaration forms — the attrset form is not cosmetic:
 * the root flake declares `nix-darwin` that way, and so do
 * `full-ai-cluster`'s `nix-darwin` and `disko`, all four of which the
 * previous `name.url` -only regex silently dropped.
 */
export function parseFlakeInputs(text: string, file: string): DepPin[] {
  const pins: DepPin[] = [];
  const lines = text.split("\n");
  let depth = 0; // brace depth inside the `inputs` block; 0 = outside
  let pendingInput: string | null = null; // attrset-form input being read
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (depth === 0) {
      if (INPUTS_OPEN_RE.test(line)) depth = 1;
      continue;
    }
    const direct = DIRECT_URL_RE.exec(line);
    if (direct) {
      pins.push({
        category: "nix-input",
        file,
        line: i + 1,
        name: direct[1]!,
        currentPin: direct[2]!,
      });
    } else {
      const open = ATTRSET_OPEN_RE.exec(line);
      if (open) {
        pendingInput = open[1]!;
      } else if (pendingInput !== null) {
        const bare = BARE_URL_RE.exec(line);
        if (bare) {
          pins.push({
            category: "nix-input",
            file,
            line: i + 1,
            name: pendingInput,
            currentPin: bare[1]!,
          });
          pendingInput = null;
        }
      }
    }
    // Track braces AFTER matching, so the `name = {` line counts once.
    for (const ch of line) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    if (depth <= 0) {
      depth = 0;
      pendingInput = null;
    }
  }
  return pins;
}

function scanFlakeInputs(repoRoot: string): DepPin[] {
  const pins: DepPin[] = [];
  for (const rel of trackedFlakeFiles(repoRoot)) {
    let text: string;
    try {
      text = readFileSync(join(repoRoot, rel), "utf8");
    } catch {
      // Tracked but unreadable (sparse checkout, permissions). Skipping is
      // the honest move; a fabricated pin would be worse than a missing one.
      continue;
    }
    pins.push(...parseFlakeInputs(text, rel));
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

/** Every pin the audit knows about, for one repo. Exported for the falsifier. */
export function collectPins(repoRoot: string): DepPin[] {
  return [
    ...scanFlakeInputs(repoRoot),
    ...scanArgocdApps(repoRoot),
    ...scanImageTags(repoRoot),
    ...scanMiseRuntimes(repoRoot),
  ];
}

function main(): number {
  const parsed = parseArgs(process.argv.slice(2));
  if ("error" in parsed) {
    process.stderr.write(`audit-dep-currency: ${parsed.error}\n`);
    return 1;
  }
  const { jsonOutput, repoRoot } = parsed;
  const pins: DepPin[] = collectPins(repoRoot);
  if (jsonOutput) {
    process.stdout.write(JSON.stringify({ count: pins.length, pins }, null, 2) + "\n");
  } else {
    process.stdout.write(renderTable(pins));
  }
  return 0;
}

// Guarded so the falsifier can import `parseFlakeInputs` / `collectPins`
// without the module body running the audit and calling `process.exit`.
if (import.meta.main) {
  process.exit(main());
}
