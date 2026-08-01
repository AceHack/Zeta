#!/usr/bin/env bun
// audit-codeanalysis-sdk-match.ts — the CS9057 guard.
//
// A source generator / analyzer built against a NEWER Roslyn than the SDK's own
// compiler cannot be LOADED — the SDK refuses it with:
//
//   CSC : error CS9057: Analyzer assembly '…' cannot be used because it references
//   version 'A.B.0.0' of the compiler, which is newer than the currently running
//   version 'X.Y.0.0'.
//
// This exact break reached `main` on 2026-07-31: Dependabot (#9774) blindly bumped
// `Microsoft.CodeAnalysis.CSharp` 5.3.0 → 5.6.0, undoing #9684's deliberate
// "matches SDK" pin, while the pinned SDK (global.json) still shipped Roslyn 5.3 —
// so `dotnet build Zeta.sln` FAILED on every OS leg. See workitem
// 081KYX9D2C408QG0R003ADEY16.
//
// This guard is the cheap, fast backstop: it reads the SDK's ACTUAL Roslyn version
// (ground truth — runs the SDK's own `csc -version`, no version-band heuristic) and
// fails if any pinned `Microsoft.CodeAnalysis.*` package exceeds it. It drifts for
// free when the SDK is bumped: raise the SDK's Roslyn and the ceiling rises with it.
//
// Usage:   bun src/Core.TypeScript/hygiene/audit-codeanalysis-sdk-match.ts
// Exit:    0 — every CodeAnalysis pin ≤ the SDK's Roslyn (loadable)
//          1 — a pin exceeds the SDK's Roslyn (CS9057 waiting to happen)
//          2 — could not determine the SDK Roslyn version (environment problem)

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

/** A dotted version reduced to the (major, minor, patch) that CS9057 compares on. */
export type V = { major: number; minor: number; patch: number };

export function parseVersion(s: string): V | null {
  // tolerate pre-release suffixes: "5.3.0-2.26219.105" → 5.3.0
  const m = s.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

/** Lexicographic (major, minor, patch) compare. > 0 ⇒ a is newer than b. */
export function cmp(a: V, b: V): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

export const show = (v: V) => `${v.major}.${v.minor}.${v.patch}`;

/** Parse every Microsoft.CodeAnalysis.* pin out of a Directory.Packages.props body. */
export function parseCodeAnalysisPins(text: string): { name: string; version: V; raw: string }[] {
  const re = /Include="(Microsoft\.CodeAnalysis[^"]*)"\s+Version="([^"]+)"/g;
  const pins: { name: string; version: V; raw: string }[] = [];
  for (const m of text.matchAll(re)) {
    const v = parseVersion(m[2]);
    if (v) pins.push({ name: m[1], version: v, raw: m[2] });
  }
  return pins;
}

/** Given the SDK Roslyn version and the pins, the offenders that exceed it (would CS9057). */
export function offenders(roslyn: V, pins: { name: string; version: V; raw: string }[]) {
  return pins.filter((p) => cmp(p.version, roslyn) > 0);
}

/** The SDK's own Roslyn compiler version — the "currently running version" CS9057 checks. */
function sdkRoslynVersion(): V {
  const sdkVer = execFileSync("dotnet", ["--version"], { encoding: "utf8" }).trim();
  // `dotnet --list-sdks` → "10.0.203 [/path/to/sdk]"; grab the base dir for our version.
  const listing = execFileSync("dotnet", ["--list-sdks"], { encoding: "utf8" });
  const row = listing.split("\n").find((l) => l.startsWith(sdkVer + " "));
  const base = row?.match(/\[(.*)\]/)?.[1];
  if (!base) {
    console.error(`[codeanalysis-sdk-match] FATAL: could not locate SDK ${sdkVer} in --list-sdks`);
    process.exit(2);
  }
  const csc = join(base, sdkVer, "Roslyn", "bincore", "csc.dll");
  const out = execFileSync("dotnet", ["exec", csc, "-version"], { encoding: "utf8" });
  const v = parseVersion(out);
  if (!v) {
    console.error(`[codeanalysis-sdk-match] FATAL: csc -version returned unparseable "${out.trim()}"`);
    process.exit(2);
  }
  return v;
}

function main() {
  const propsPath = join(process.cwd(), "Directory.Packages.props");
  const roslyn = sdkRoslynVersion();
  const pins = parseCodeAnalysisPins(readFileSync(propsPath, "utf8"));

  if (pins.length === 0) {
    console.log("[codeanalysis-sdk-match] no Microsoft.CodeAnalysis.* pins found — nothing to check.");
    return;
  }

  const bad = offenders(roslyn, pins);
  if (bad.length > 0) {
    console.error(`[codeanalysis-sdk-match] ✗ CS9057 hazard: the SDK's Roslyn is ${show(roslyn)}, but:`);
    for (const o of bad) {
      console.error(`    ${o.name} is pinned to ${o.raw} — a generator built against it CANNOT be loaded.`);
    }
    console.error(
      "  Fix: pin Microsoft.CodeAnalysis.* to the SDK's Roslyn line (currently " +
        `${show(roslyn)}), OR raise the SDK in global.json so its Roslyn ≥ the pin. See #9684, workitem 081KYX9D2C408QG0R003ADEY16.`,
    );
    process.exit(1);
  }

  console.log(
    `[codeanalysis-sdk-match] ✓ SDK Roslyn ${show(roslyn)} ≥ all ${pins.length} CodeAnalysis pin(s): ` +
      pins.map((p) => `${p.name.replace("Microsoft.CodeAnalysis.", "")}=${p.raw}`).join(", "),
  );
}

// Only run the (side-effectful, dotnet-invoking) main when executed directly, so the
// pure helpers above stay importable/testable.
if (import.meta.main) main();
