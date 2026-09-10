#!/usr/bin/env bun
/**
 * audit-dotnet-runtime-band-unity.ts -- every CONSUMER of .NET agrees with the pin.
 *
 * -- THE DEFECT THIS CLOSES (measured 2026-09-09) ---------------------------
 * `audit-dotnet-pin-parity.ts` holds `.mise.toml` and `global.json` equal, and it
 * is correct about the two files it reads. It says nothing about the places that
 * SPEND that pin -- project `TargetFramework`s and container base images -- so
 * the tree carried, in the same commit:
 *
 *   full-ai-cluster/orleans-silo/Dockerfile   sdk:10.0-noble / runtime:10.0-noble
 *   genesis/_src/auth-backend/Dockerfile      sdk:8.0        / aspnet:8.0
 *   genesis/_src/auth-backend/GenesisAuth.csproj   <TargetFramework>net8.0</>
 *
 * 42 projects on `net10.0` and one on `net8.0`, with nothing able to notice. The
 * holdout is not built by CI and is not in `Zeta.sln` -- it carries a deliberately
 * empty `Directory.Build.props` so it does NOT inherit the monorepo's strict
 * profile -- which is exactly why the drift was silent: the only surface that
 * would have caught it is one nothing compiles.
 *
 * That is the vacuity class in dependency form. A pin nobody checks against the
 * things it pins is a declaration, not a constraint.
 *
 * -- WHAT THIS CHECKS -------------------------------------------------------
 *   1. Every `<TargetFramework>` / `<TargetFrameworks>` in the tree is the
 *      `netX.Y` implied by the canonical `.mise.toml` pin -- unless the file is
 *      in EXEMPT below, with a stated reason.
 *   2. Every `mcr.microsoft.com/dotnet/{sdk,aspnet,runtime}:<tag>` in a Dockerfile
 *      has a tag in the same `X.Y` band.
 *   3. NEITHER CATEGORY IS EMPTY. A scan that finds no projects passes trivially,
 *      and a check that cannot fail is the thing this file exists to remove. This
 *      is the refusal that makes the other two mean something -- a regex that
 *      stops matching after a format change would otherwise report success.
 *
 * -- WHY EXEMPTIONS ARE PATHS AND NOT A PATTERN -----------------------------
 * `netstandard2.0` is not drift: Roslyn source generators and F# type providers
 * are LOADED BY the compiler, and the analyzer contract requires that target
 * regardless of what the SDK is. But "any netstandard is fine" would be a hole
 * wide enough to drive real drift through, so each exempt file is named with its
 * reason and an unexpected exemption is itself a failure (a stale entry is
 * reported, exactly as `auditAppliedButUnasserted` reports a stale reason).
 *
 * Run:   bun src/Core.TypeScript/hygiene/audit-dotnet-runtime-band-unity.ts
 * Exit:  0 -- every consumer agrees with the pin
 *        1 -- a consumer disagrees, an exemption is stale, or a scan found nothing
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { CANONICAL_PIN_FILE, parseMisePin } from "./audit-dotnet-pin-parity.ts";

/**
 * Project files whose `TargetFramework` legitimately differs from the pin, with
 * the reason. A path here that no longer needs the exemption is a FAILURE, not a
 * silent pass -- a stale excuse reads as coverage exactly like a stale reason in
 * an applied-but-unasserted registry.
 */
export const TARGET_FRAMEWORK_EXEMPT = new Map<string, string>([
  [
    "src/Zeta.Generators/Zeta.Generators.csproj",
    "Roslyn source generator: loaded BY the compiler, so the analyzer contract fixes netstandard2.0 independently of the SDK",
  ],
  [
    "src/Core.CSharp.TypeProvider/Zeta.Core.CSharp.TypeProvider.csproj",
    "F# type provider design-time component: same analyzer-contract constraint as a source generator",
  ],
]);

/** Directories a tree walk must not descend into. */
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "bin",
  "obj",
  "target",
  "references",
  "docs",
  ".claude",
]);

/** `10.0.400` -> `10.0`. The band every consumer must sit in. */
export function majorMinor(version: string): string | null {
  const m = /^(\d+)\.(\d+)\./.exec(version);
  if (m === null) return null;
  return String(m[1]) + "." + String(m[2]);
}

/** Every file under `dir` whose name passes `keep`, as repo-relative paths. */
export function walk(root: string, dir: string, keep: (name: string) => boolean): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    // The listing already carries the kind (`withFileTypes`), so nothing asks the
    // filesystem a second time -- no check-then-use window, and `Dirent.isDirectory()`
    // does not follow symlinks, which is what stops the ELOOP on the recursive
    // `tests/cross-verification/experience/fixtures` link this walk found on its first run.
    if (entry.isDirectory()) found.push(...walk(root, full, keep));
    else if (keep(entry.name)) found.push(relative(root, full));
  }
  return found.sort();
}

/** One disagreement, or one stale exemption. */
export interface BandFinding {
  readonly path: string;
  readonly message: string;
}

/** What a scan saw, so the caller can refuse an empty one. */
export interface BandScan {
  readonly projectsSeen: number;
  readonly imagesSeen: number;
  readonly findings: readonly BandFinding[];
}

/** Every `netX.Y` / `netstandardX.Y` a project file declares. */
export function parseTargetFrameworks(text: string): string[] {
  const out: string[] = [];
  const re = /<TargetFrameworks?>([^<]+)<\/TargetFrameworks?>/g;
  for (const m of text.matchAll(re)) {
    const raw = m[1];
    if (raw === undefined) continue;
    for (const tfm of raw.split(";")) {
      const trimmed = tfm.trim();
      if (trimmed.length > 0) out.push(trimmed);
    }
  }
  return out;
}

/** Every `mcr.microsoft.com/dotnet/<repo>:<tag>` a Dockerfile names. */
export function parseDotnetImages(text: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const re = /mcr\.microsoft\.com\/dotnet\/([a-z-]+):([A-Za-z0-9._-]+)/g;
  for (const m of text.matchAll(re)) {
    if (m[1] === undefined) continue;
    if (m[2] === undefined) continue;
    out.push([m[1], m[2]]);
  }
  return out;
}

/** Walk the tree and judge every consumer against `band` (e.g. `10.0`). */
export function scanTree(root: string, band: string): BandScan {
  const findings: BandFinding[] = [];
  const expected = "net" + band;
  const usedExemptions = new Set<string>();
  const projectFiles = walk(root, root, isProjectFile);
  let projectsSeen = 0;
  for (const path of projectFiles) {
    const tfms = parseTargetFrameworks(readFileSync(join(root, path), "utf8"));
    if (tfms.length === 0) continue;
    projectsSeen += 1;
    const exemption = TARGET_FRAMEWORK_EXEMPT.get(path);
    const wrong = tfms.filter((t) => t !== expected);
    if (exemption !== undefined) {
      usedExemptions.add(path);
      if (wrong.length === 0) {
        const stale =
          "STALE EXEMPTION: now targets " +
          expected +
          " and no longer needs its TARGET_FRAMEWORK_EXEMPT entry; a stale excuse reads as coverage";
        findings.push({ path, message: stale });
      }
      continue;
    }
    for (const tfm of wrong) {
      const msg = "TargetFramework " + tfm + " disagrees with the pin, which implies " + expected;
      findings.push({ path, message: msg });
    }
  }
  for (const path of TARGET_FRAMEWORK_EXEMPT.keys()) {
    if (usedExemptions.has(path)) continue;
    const msg = "exempted path no longer exists or declares no TargetFramework";
    findings.push({ path, message: msg });
  }
  let imagesSeen = 0;
  for (const path of walk(root, root, isDockerfile)) {
    for (const pair of parseDotnetImages(readFileSync(join(root, path), "utf8"))) {
      imagesSeen += 1;
      if (pair[1].startsWith(band)) continue;
      const msg = "base image dotnet/" + pair[0] + ":" + pair[1] + " is outside the pinned band " + band;
      findings.push({ path, message: msg });
    }
  }
  return { projectsSeen, imagesSeen, findings };
}

/** `.csproj` / `.fsproj` / MSBuild props and targets. */
export function isProjectFile(name: string): boolean {
  if (name.endsWith(".csproj")) return true;
  if (name.endsWith(".fsproj")) return true;
  if (name.endsWith(".props")) return true;
  if (name.endsWith(".targets")) return true;
  return false;
}

/** `Dockerfile`, `Dockerfile.something`, `something.Dockerfile`. */
export function isDockerfile(name: string): boolean {
  if (name.startsWith("Dockerfile")) return true;
  if (name.endsWith(".Dockerfile")) return true;
  return false;
}

function main(): void {
  const root = process.cwd();
  const miseText = readFileSync(join(root, CANONICAL_PIN_FILE), "utf8");
  const pin = parseMisePin(miseText)[0];
  const band = pin === undefined ? null : majorMinor(pin);
  if (band === null) {
    console.error("[dotnet-band-unity] no usable dotnet pin in " + CANONICAL_PIN_FILE);
    process.exit(1);
  }
  const scan = scanTree(root, band);
  let failed = false;
  const vacuous = " -- a scan that finds nothing passes trivially";
  if (scan.projectsSeen === 0) {
    console.error("[dotnet-band-unity] ZERO project files" + vacuous);
    failed = true;
  }
  if (scan.imagesSeen === 0) {
    console.error("[dotnet-band-unity] ZERO dotnet base images" + vacuous);
    failed = true;
  }
  for (const f of scan.findings) {
    console.error("[dotnet-band-unity] x " + f.path + ": " + f.message);
    failed = true;
  }
  if (failed) process.exit(1);
  const seen = String(scan.projectsSeen) + " project(s), " + String(scan.imagesSeen) + " base image(s)";
  console.log("[dotnet-band-unity] OK -- band " + band + " across " + seen);
}

if (import.meta.main) main();
