#!/usr/bin/env bun
/**
 * FSharp.Core's locked bytes must be nuget.org's SIGNED package, never the SDK's copy.
 *
 * WHY THIS EXISTS. The .NET SDK ships FSharp.Core inside `FSharp/library-packs` and adds
 * that folder as a restore source, where it beats nuget.org. The artifacts are genuinely
 * different files, and differ PER PLATFORM. Measured 2026-09-12 for 10.1.400:
 *
 *   nuget.org (signed, carries .signature.p7s)   3,065,316 bytes
 *   macOS SDK 10.0.400 library-packs             3,050,245 bytes
 *   linux SDK 10.0.400 library-packs             3,049,932 bytes
 *
 * A `packages.lock.json` records ONE contentHash. So if the SDK folder is in play, no single
 * set of lock files can satisfy the gate's platform legs, and restore fails NU1403 on
 * whichever platform did not generate them. That is not hypothetical: it is what happened,
 * on every Linux leg, naming FSharp.Core and no other package.
 *
 * `Directory.Build.props` prevents it by pointing the SDK's own `_FSharpCoreLibraryPacksFolder`
 * at a path that does not exist, so the SDK's `Exists()` guard declines to add the source.
 * That is an SDK-INTERNAL (underscore) property. It can be renamed or removed by any SDK
 * update, and if it is, restore silently starts resolving from the SDK again and the next
 * regenerated lock file carries the SDK's hash. Nothing else would notice: the build would
 * be green on the machine that regenerated, and red on every other platform.
 *
 * This audit is what notices. It reads the COMMITTED lock files and refuses any FSharp.Core
 * contentHash that is not nuget.org's.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not hit the network. The expected hash is pinned
 * below as a constant, because a check that fetches the value it is checking against cannot
 * fail when the fetch fails, and `.claude/rules/clone-at-tag-stays-sufficient.md` requires
 * the tree to stay checkable from a clone at a tag with nothing installed.
 */
import { readdirSync, readFileSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join } from "node:path";

/**
 * sha512 contentHash of the SIGNED FSharp.Core 10.1.400 as published on nuget.org.
 * Verified 2026-09-12 by restoring with the SDK folder source disabled and reading the
 * resulting `.nupkg.metadata`, whose `source` field reads `https://api.nuget.org/v3/index.json`
 * and whose extracted package is 3,065,316 bytes and carries `.signature.p7s`.
 */
const NUGET_ORG_HASHES: ReadonlyMap<string, string> = new Map([
  ["10.1.400", "H9wlZ/tWgNp+Q4WQ5aUSi3XOBXrL6z+UkR0PNeyDFyoZR3c3PbtA21B9FqlthrhEwQ6f5AtQV0JLhBBDqjjscw=="],
]);

/** Hashes known to come from an SDK's library-packs, named so the failure can say WHICH. */
const KNOWN_SDK_HASHES: ReadonlyMap<string, string> = new Map([
  ["C8Myl8/HMoTWw0K/xJ+Q6JHlS5fUw2VTI91a3v3eVs0FVkVb5XIevzH7S2AmvIoD7s186uNyeRTGbrpef9gZyQ==", "macOS SDK 10.0.400 library-packs"],
]);

const SKIP: ReadonlySet<string> = new Set(["node_modules", ".git", "bin", "obj", "references"]);

export function findLockFiles(root: string): readonly string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    // `withFileTypes` so the KIND arrives with the listing. Asking readdir for names and then
    // stat'ing each one is the readdir-then-stat race (CWE-367): an entry can vanish or change
    // kind between the two calls, and the listing already knew which it was.
    let entries: readonly Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory is not a finding; it is a directory we cannot see
    }
    for (const e of entries) {
      if (SKIP.has(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "packages.lock.json") out.push(p);
    }
  };
  walk(root);
  out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return out;
}

export interface Finding {
  readonly file: string;
  readonly version: string;
  readonly found: string;
  readonly expected: string | undefined;
  readonly attributedTo: string | undefined;
}

/** Every FSharp.Core entry whose contentHash is not the nuget.org one. */
export function checkLock(file: string, text: string): readonly Finding[] {
  const out: Finding[] = [];
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return out; // a malformed lock file is another check's problem, not this one's
  }
  const deps = (doc as { dependencies?: Record<string, Record<string, { resolved?: string; contentHash?: string }>> })
    .dependencies;
  if (deps === undefined) return out;
  for (const byTfm of Object.values(deps)) {
    for (const [name, entry] of Object.entries(byTfm)) {
      if (name !== "FSharp.Core") continue;
      const version = entry.resolved ?? "";
      const found = entry.contentHash ?? "";
      if (found.length === 0) continue;
      const expected = NUGET_ORG_HASHES.get(version);
      if (expected === undefined) {
        // A version we have never pinned. Report it rather than pass it: the whole point is
        // that an unrecognised hash is exactly what an SDK-sourced restore produces.
        out.push({ file, version, found, expected: undefined, attributedTo: KNOWN_SDK_HASHES.get(found) });
        continue;
      }
      if (found !== expected) {
        out.push({ file, version, found, expected, attributedTo: KNOWN_SDK_HASHES.get(found) });
      }
    }
  }
  return out;
}

function main(): number {
  const files = findLockFiles(process.cwd());
  if (files.length === 0) {
    console.error("fsharp-core-source: no packages.lock.json found — this check inspected NOTHING.");
    console.error("That is an unknown, not a pass. Run it from the repository root.");
    return 2;
  }
  const findings: Finding[] = [];
  let scanned = 0;
  for (const f of files) {
    let text: string;
    try {
      text = readFileSync(f, "utf-8");
    } catch {
      console.error(`fsharp-core-source: could not read ${f} — reported, not skipped.`);
      return 2;
    }
    scanned += 1;
    findings.push(...checkLock(f, text));
  }
  if (findings.length === 0) {
    console.log(`fsharp-core-source: OK — ${String(scanned)} lock file(s), every FSharp.Core pinned to nuget.org's signed package.`);
    return 0;
  }
  console.error(`fsharp-core-source: ${String(findings.length)} FSharp.Core pin(s) are NOT nuget.org's package.\n`);
  for (const f of findings) {
    console.error(`  ${f.file}`);
    console.error(`    version  ${f.version}`);
    console.error(`    found    ${f.found}${f.attributedTo === undefined ? "" : `   <- ${f.attributedTo}`}`);
    console.error(`    expected ${f.expected ?? "(no nuget.org hash pinned for this version)"}`);
  }
  console.error("");
  console.error("The SDK ships its own FSharp.Core and adds FSharp/library-packs as a restore source,");
  console.error("and its copy differs per platform, so a lock generated from it cannot be satisfied on");
  console.error("the other legs. Directory.Build.props disables that source via the SDK's own Exists()");
  console.error("guard on _FSharpCoreLibraryPacksFolder; if the SDK renamed that property, this is what");
  console.error("that looks like. Re-restore with the guard working and commit the regenerated locks.");
  return 1;
}

if (import.meta.main) process.exit(main());
