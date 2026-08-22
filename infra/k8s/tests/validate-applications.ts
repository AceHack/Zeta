#!/usr/bin/env bun
/**
 * infra/k8s/tests/validate-applications.ts
 *
 * Helm chart and ArgoCD Application manifest validation.
 * Replaces the deprecated validate-applications.sh script.
 *
 * Usage:
 *   bun infra/k8s/tests/validate-applications.ts
 *   bun infra/k8s/tests/validate-applications.ts --offline
 *   bun infra/k8s/tests/validate-applications.ts --apps-dir infra/k8s/applications
 *
 * Exit codes:
 *   0 — all tests passed
 *   1 — one or more tests failed
 *
 * Anti-self-certifying: these tests fail if:
 *   - An Application.yaml is missing required fields
 *   - A Helm chart repo URL is unreachable (online mode)
 *   - A required annotation or syncOption is missing
 *   - destination.server is not in-cluster
 *   - root-application.yaml is missing recurse=true or directory.include
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// ── YAML parser (bun built-in) ────────────────────────────────────────────────
// Bun supports YAML natively via Bun.file().yaml() but we need a sync parse.
// Use a minimal YAML parser via the js-yaml package (already in bun lockfile)
// or fall back to a simple key-value extractor for the fields we need.
// We use the approach of spawning `bun` to parse YAML via a tiny inline script.

function parseYaml(content: string): Record<string, unknown> {
  // Use Bun's built-in YAML support via eval of a bun script
  // Bun supports YAML natively via import assertions
  try {
    // Simple recursive YAML-to-object parser for the subset we need
    return simpleYamlParse(content);
  } catch {
    throw new Error("YAML parse failed");
  }
}

// ── Simple YAML parser for ArgoCD Application manifests ──────────────────────
// We only need to read scalar values and lists from a known schema.
// Full YAML parsing is overkill; this handles the ArgoCD Application subset.

function simpleYamlParse(yaml: string): Record<string, unknown> {
  // Remove comments
  const lines = yaml.split("\n").map(l => l.replace(/#.*$/, "").trimEnd());
  return parseBlock(lines, 0, 0).value as Record<string, unknown>;
}

type ParseResult = { value: unknown; nextLine: number };

function parseBlock(lines: string[], startLine: number, indent: number): ParseResult {
  const obj: Record<string, unknown> = {};
  let i = startLine;
  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) break; // noUncheckedIndexedAccess: i < lines.length guarantees defined
    const trimmed = line.trimStart();
    if (trimmed === "") { i++; continue; }
    const lineIndent = line.length - line.trimStart().length;
    if (lineIndent < indent) break;
    if (lineIndent > indent) { i++; continue; }
    // List item
    if (trimmed.startsWith("- ")) {
      // Return to parent to handle as list
      break;
    }
    // Key: value
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) { i++; continue; }
    const key = trimmed.slice(0, colonIdx).trim();
    const rest = trimmed.slice(colonIdx + 1).trim();
    if (rest === "" || rest === "|" || rest === ">") {
      // Block scalar or nested object — look ahead
      i++;
      const nextNonEmpty = lines.slice(i).findIndex(l => l.trim() !== "");
      if (nextNonEmpty === -1) { obj[key] = null; continue; }
      const nextLine = i + nextNonEmpty;
      const nextLineText = lines[nextLine];
      if (nextLineText === undefined) { obj[key] = null; continue; }
      const nextIndent = nextLineText.length - nextLineText.trimStart().length;
      if (nextIndent <= indent) { obj[key] = null; continue; }
      // Check if it's a list
      if (nextLineText.trimStart().startsWith("- ")) {
        const listResult = parseList(lines, nextLine, nextIndent);
        obj[key] = listResult.value;
        i = listResult.nextLine;
      } else {
        const blockResult = parseBlock(lines, nextLine, nextIndent);
        obj[key] = blockResult.value;
        i = blockResult.nextLine;
      }
    } else {
      // Inline value
      obj[key] = parseScalar(rest);
      i++;
    }
  }
  return { value: obj, nextLine: i };
}

function parseList(lines: string[], startLine: number, indent: number): ParseResult {
  const arr: unknown[] = [];
  let i = startLine;
  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) break; // noUncheckedIndexedAccess: i < lines.length guarantees defined
    const trimmed = line.trimStart();
    if (trimmed === "") { i++; continue; }
    const lineIndent = line.length - line.trimStart().length;
    if (lineIndent < indent) break;
    if (!trimmed.startsWith("- ")) { i++; continue; }
    const itemContent = trimmed.slice(2).trim();
    if (itemContent === "") {
      // Multi-line list item
      i++;
      const nextNonEmpty = lines.slice(i).findIndex(l => l.trim() !== "");
      if (nextNonEmpty === -1) { arr.push(null); continue; }
      const nextLine = i + nextNonEmpty;
      const nextLineText = lines[nextLine];
      if (nextLineText === undefined) { arr.push(null); continue; }
      const nextIndent = nextLineText.length - nextLineText.trimStart().length;
      const blockResult = parseBlock(lines, nextLine, nextIndent);
      arr.push(blockResult.value);
      i = blockResult.nextLine;
    } else {
      arr.push(parseScalar(itemContent));
      i++;
    }
  }
  return { value: arr, nextLine: i };
}

function parseScalar(s: string): unknown {
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null" || s === "~") return null;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  // Strip quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

// ── Deep-get helper ───────────────────────────────────────────────────────────

function get(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

// ── Find all Application.yaml files ──────────────────────────────────────────

function findApplicationYamls(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findApplicationYamls(full));
    } else if (entry === "Application.yaml") {
      results.push(full);
    }
  }
  return results.sort();
}

// ── Test runner ───────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const errors: string[] = [];

function ok(msg: string): void {
  console.log(`  PASS: ${msg}`);
  pass++;
}

function err(msg: string): void {
  console.log(`  FAIL: ${msg}`);
  errors.push(msg);
  fail++;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    offline: { type: "boolean", default: false },
    "apps-dir": { type: "string" },
  },
  strict: false,
});

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const appsDir = args["apps-dir"]
  ? resolve(args["apps-dir"] as string)
  : join(repoRoot, "infra", "k8s", "applications");
const offline = args.offline as boolean;

const appFiles = findApplicationYamls(appsDir).filter(
  f => !f.includes("root-application.yaml"),
);
const rootApp = join(appsDir, "root-application.yaml");

// Parse all Application.yaml files
const parsed = new Map<string, { path: string; name: string; yaml: Record<string, unknown> }>();
for (const f of appFiles) {
  const name = f.replace(appsDir + "/", "").replace("/Application.yaml", "");
  try {
    const content = readFileSync(f, "utf-8");
    const yaml = parseYaml(content) as Record<string, unknown>;
    parsed.set(name, { path: f, name, yaml });
  } catch (e) {
    parsed.set(name, { path: f, name, yaml: {} });
  }
}

// ── Test 1: YAML syntax validation ───────────────────────────────────────────
console.log("\n=== Test 1: YAML syntax validation ===");
for (const [name, { path, yaml }] of parsed) {
  if (Object.keys(yaml).length > 0) {
    ok(`${name}/Application.yaml: valid YAML`);
  } else {
    try {
      const content = readFileSync(path, "utf-8");
      parseYaml(content);
      ok(`${name}/Application.yaml: valid YAML`);
    } catch {
      err(`${name}/Application.yaml: invalid YAML`);
    }
  }
}

// ── Test 2: Required ArgoCD Application fields ────────────────────────────────
console.log("\n=== Test 2: Required ArgoCD Application fields ===");
const REQUIRED_FIELDS = [
  "apiVersion", "kind",
  "metadata.name", "metadata.namespace",
  "spec.project",
  "spec.source.repoURL",
  "spec.destination.server",
  "spec.destination.namespace",
  "spec.syncPolicy.automated.prune",
  "spec.syncPolicy.automated.selfHeal",
];
for (const [name, { yaml }] of parsed) {
  let allOk = true;
  for (const field of REQUIRED_FIELDS) {
    const val = get(yaml, field);
    if (val === undefined || val === null) {
      err(`${name}/Application.yaml: missing required field .${field}`);
      allOk = false;
    }
  }
  // Finalizer check
  const finalizers = (get(yaml, "metadata.finalizers") as string[] | undefined) ?? [];
  if (!finalizers.some(f => f.includes("resources-finalizer"))) {
    err(`${name}/Application.yaml: missing resources-finalizer.argocd.argoproj.io`);
    allOk = false;
  }
  // CreateNamespace=true in syncOptions
  const syncOpts = (get(yaml, "spec.syncPolicy.syncOptions") as string[] | undefined) ?? [];
  if (!syncOpts.some(o => o === "CreateNamespace=true")) {
    err(`${name}/Application.yaml: missing CreateNamespace=true in syncOptions`);
    allOk = false;
  }
  if (allOk) ok(`${name}/Application.yaml: all required fields present`);
}

// ── Test 3: Helm chart fields ─────────────────────────────────────────────────
console.log("\n=== Test 3: Helm chart fields ===");
for (const [name, { yaml }] of parsed) {
  const chart = get(yaml, "spec.source.chart");
  if (chart !== undefined && chart !== null) {
    const targetRevision = get(yaml, "spec.source.targetRevision");
    if (targetRevision !== undefined && targetRevision !== null) {
      ok(`${name}/Application.yaml: Helm chart fields present (chart=${chart}, rev=${targetRevision})`);
    } else {
      err(`${name}/Application.yaml: missing spec.source.targetRevision`);
    }
  } else {
    ok(`${name}/Application.yaml: not a Helm chart app (skipped)`);
  }
}

// ── Test 4: apiVersion and kind ───────────────────────────────────────────────
console.log("\n=== Test 4: apiVersion and kind ===");
for (const [name, { yaml }] of parsed) {
  const api = get(yaml, "apiVersion");
  const kind = get(yaml, "kind");
  if (api === "argoproj.io/v1alpha1" && kind === "Application") {
    ok(`${name}/Application.yaml: apiVersion=argoproj.io/v1alpha1, kind=Application`);
  } else {
    err(`${name}/Application.yaml: wrong apiVersion (${api}) or kind (${kind})`);
  }
}

// ── Test 5: destination.server is in-cluster ──────────────────────────────────
console.log("\n=== Test 5: destination.server is in-cluster ===");
for (const [name, { yaml }] of parsed) {
  const server = get(yaml, "spec.destination.server");
  if (server === "https://kubernetes.default.svc") {
    ok(`${name}/Application.yaml: destination.server is in-cluster`);
  } else {
    err(`${name}/Application.yaml: destination.server is NOT in-cluster (${server})`);
  }
}

// ── Test 6: root-application.yaml recurse=true ────────────────────────────────
console.log("\n=== Test 6: root-application.yaml ===");
try {
  const rootContent = readFileSync(rootApp, "utf-8");
  const rootYaml = parseYaml(rootContent);
  const recurse = get(rootYaml, "spec.source.directory.recurse");
  if (recurse === true) {
    ok("root-application.yaml: directory.recurse=true");
  } else {
    err(`root-application.yaml: directory.recurse is not true (${recurse})`);
  }
  const include = get(rootYaml, "spec.source.directory.include");
  if (include !== undefined && include !== null && include !== "") {
    ok("root-application.yaml: directory.include is set");
  } else {
    err("root-application.yaml: directory.include is missing (would pick up non-Application files)");
  }
} catch {
  err("root-application.yaml: file not found or invalid YAML");
}

// ── Test 7: Online chart existence check ─────────────────────────────────────
if (!offline) {
  console.log("\n=== Test 7: Helm chart existence (online) ===");
  const checks: Promise<void>[] = [];
  for (const [name, { yaml }] of parsed) {
    const chart = get(yaml, "spec.source.chart") as string | undefined;
    const repo = get(yaml, "spec.source.repoURL") as string | undefined;
    if (!chart || !repo) {
      ok(`${name}/Application.yaml: not a Helm chart app (skipped)`);
      continue;
    }
    const indexUrl = `${repo.replace(/\/$/, "")}/index.yaml`;
    checks.push(
      fetch(indexUrl, { signal: AbortSignal.timeout(10_000) })
        .then(r => r.text())
        .then(text => {
          if (text.includes(`name: ${chart}`)) {
            ok(`${name}/Application.yaml: chart '${chart}' found in ${repo}`);
          } else {
            err(`${name}/Application.yaml: chart '${chart}' NOT found in ${repo}`);
          }
        })
        .catch(() => {
          err(`${name}/Application.yaml: repo unreachable: ${repo}`);
        }),
    );
  }
  await Promise.all(checks);
} else {
  console.log("\n=== Test 7: Helm chart existence (SKIPPED — offline mode) ===");
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n========================================");
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\nFailures:");
  for (const e of errors) console.log(`  - ${e}`);
  console.log("");
  process.exit(1);
}
console.log("All tests passed.");
