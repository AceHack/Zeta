#!/usr/bin/env bun
// lint-overrides-take-effect.ts -- every root `overrides` entry must be honoured
// by EVERY lockfile in the tree, at the exact version declared.
//
// WHY THIS EXISTS. An `overrides` entry is how this repo carries a transitive
// dependency past a CVE its own parent will not release (PR #17124 for
// `fast-uri`; this file's own workitem for `smol-toml`). It is a security
// control written as a version string -- and nothing checked that it worked.
//
// Three measured failure modes, all of which this file refuses:
//
//   1. AN OVERRIDE ONLY ONE INSTALLER HONOURS. PR #17124 recorded it in its own
//      body: a NESTED override (cosmiconfig>js-yaml) makes npm's lockfile show
//      the fix while bun prints "Bun currently does not support nested
//      overrides" and carries on installing the vulnerable version. CI installs
//      with bun; Dependabot reads package-lock.json. That is a fix only the
//      scanner can see, which is not a fix.
//   2. AN OVERRIDE THAT PINS DOWNWARD. The smol-toml override sat at 1.6.1 from
//      2026-04-21 to 2026-09-09 while its only consumer, markdownlint-cli2,
//      declared an exact 1.7.0. The override was silently DOWNGRADING the tool
//      the markdown gate runs on, and 1.6.1 is the version that hangs forever
//      on CVE-2026-85730. Nobody chose that; nothing said so.
//   3. AN OVERRIDE THE LOCKFILES HAVE DRIFTED FROM. `bun install` and
//      `npm install --package-lock-only` are run by different hands at
//      different times. A lockfile that still names the old version is a
//      control that has stopped controlling.
//
// WHAT IT CANNOT CHECK, STATED OUT LOUD. It says nothing about whether the
// pinned version is itself free of advisories -- that is Dependabot's job and
// needs the network. It asserts only that what package.json DECLARES is what
// the lockfiles RESOLVE. A green run here plus a red Dependabot alert is a
// coherent pair, not a contradiction.
//
// UNKNOWN IS NOT A PASS. If a lockfile is missing, the check exits 2 and says
// which one. A probe that could not run carries zero information.
//
// Usage:  bun src/Core.TypeScript/hygiene/lint-overrides-take-effect.ts [repoRoot]
// Exit:   0 = every override is honoured by every lockfile
//         1 = an override is unhonoured, nested, non-exact, or drifted
//         2 = the check could not run (missing package.json or a lockfile)
//
// 081M24D4APR087G0R001QRQ071

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** An exact npm version: no range operators, no tags, no URLs. */
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

export interface Finding {
  readonly kind: "nested-key" | "not-exact" | "lockfile-drift";
  readonly name: string;
  readonly declared: string;
  readonly lockfile?: string;
  readonly found?: readonly string[];
  readonly message: string;
}

/** Parse the root overrides map. Absent is an empty map, not an error. */
export function readOverrides(packageJsonText: string): Record<string, string> {
  const parsed = JSON.parse(packageJsonText) as { overrides?: Record<string, string> };
  return parsed.overrides ?? {};
}

/**
 * Every version of `name` that bun.lock resolves, from any entry -- top-level or
 * a scoped alias such as "table/ajv": ["ajv@8.20.0", ...]. Matching on the
 * RESOLUTION rather than on the key is deliberate: a nested alias is exactly
 * where an unhonoured override hides.
 *
 * bun.lock is JSON with trailing commas, so it is scanned rather than parsed.
 */
export function bunLockResolutions(bunLockText: string, name: string): string[] {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const re = new RegExp('\\["' + escaped + '@([^"@]+)"', "gu");
  const out = new Set<string>();
  for (const m of bunLockText.matchAll(re)) {
    const version = m[1];
    if (version !== undefined) out.add(version);
  }
  return [...out].sort();
}

/**
 * Every version of `name` that package-lock.json resolves. Keys are paths like
 * node_modules/x/node_modules/<name>, so the match is on the final segment.
 */
export function packageLockResolutions(packageLockText: string, name: string): string[] {
  const parsed = JSON.parse(packageLockText) as {
    packages?: Record<string, { version?: string }>;
  };
  const out = new Set<string>();
  for (const [key, value] of Object.entries(parsed.packages ?? {})) {
    if (key.split("/").pop() !== name) continue;
    if (typeof value.version === "string") out.add(value.version);
  }
  return [...out].sort();
}

export interface LockfileView {
  readonly path: string;
  readonly resolve: (name: string) => string[];
}

/** The whole judgement, as data, so a test can drive it without a filesystem. */
export function evaluate(overrides: Record<string, string>, lockfiles: readonly LockfileView[]): Finding[] {
  const findings: Finding[] = [];
  for (const [name, declared] of Object.entries(overrides)) {
    if (name.includes(">")) {
      findings.push({
        kind: "nested-key",
        name,
        declared,
        message:
          'nested override key "' +
          name +
          '" -- bun IGNORES nested overrides (measured, PR #17124), so npm ' +
          "would show a fix bun never installs. Use a flat key, which both honour.",
      });
      continue;
    }
    if (!EXACT_VERSION.test(declared)) {
      findings.push({
        kind: "not-exact",
        name,
        declared,
        message:
          'override "' +
          name +
          '": "' +
          declared +
          '" is not an exact version. A range does not pin; a resolver is free ' +
          "to pick the low end, which is where the advisory lives.",
      });
      continue;
    }
    for (const lock of lockfiles) {
      const found = lock.resolve(name);
      const wrong = found.filter((v) => v !== declared);
      if (found.length === 0 || wrong.length > 0) {
        findings.push({
          kind: "lockfile-drift",
          name,
          declared,
          lockfile: lock.path,
          found,
          message:
            found.length === 0
              ? lock.path +
                ' resolves NO version of "' +
                name +
                '" -- the override names a package this lockfile does not carry.'
              : lock.path +
                ' resolves "' +
                name +
                '" to ' +
                found.map((v) => '"' + v + '"').join(", ") +
                ', not "' +
                declared +
                '".',
        });
      }
    }
  }
  return findings;
}

/**
 * DO, THEN INTERPRET -- never `existsSync` and then read. The check answers a
 * question about a path that can change before the read runs, so it reads as
 * defensive and prevents nothing. `lint-check-then-use-file-races.ts` refuses
 * that shape, and it refused an EARLIER DRAFT OF THIS FILE, which is the whole
 * argument for the rule: the author of a TOCTOU guard wrote a TOCTOU.
 *
 * `null` means the file is not there, which every caller below reports as
 * UNKNOWN. Any other errno is rethrown -- a permission error is not an absence,
 * and collapsing the two would be the same conflation one layer down.
 */
function readOrNull(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/** The one UNKNOWN sentence, written once so the two call sites cannot drift. */
function unknownLockfile(path: string): string {
  return "UNKNOWN: " + path + " is missing, so no override can be checked against it. Not a pass.";
}

export function main(repoRoot: string): number {
  const pkgPath = join(repoRoot, "package.json");
  const pkgText = readOrNull(pkgPath);
  if (pkgText === null) {
    console.error("UNKNOWN: no package.json at " + pkgPath + ". Not a pass.");
    return 2;
  }
  const overrides = readOverrides(pkgText);
  if (Object.keys(overrides).length === 0) {
    console.log("no root overrides declared; nothing to enforce");
    return 0;
  }

  const bunLockPath = join(repoRoot, "bun.lock");
  const npmLockPath = join(repoRoot, "package-lock.json");
  const bunLockText = readOrNull(bunLockPath);
  const npmLockText = readOrNull(npmLockPath);
  // Named one at a time rather than looped: a loop over a tuple does not narrow
  // `string | null` to `string` for the reads below, and silencing that with a
  // cast would be asserting the very thing the branch exists to establish.
  if (bunLockText === null) {
    console.error(unknownLockfile(bunLockPath));
    return 2;
  }
  if (npmLockText === null) {
    console.error(unknownLockfile(npmLockPath));
    return 2;
  }

  const findings = evaluate(overrides, [
    { path: "bun.lock", resolve: (n) => bunLockResolutions(bunLockText, n) },
    { path: "package-lock.json", resolve: (n) => packageLockResolutions(npmLockText, n) },
  ]);

  if (findings.length === 0) {
    const names = Object.entries(overrides)
      .map(([n, v]) => n + "@" + v)
      .join(", ");
    console.log("OK: both lockfiles honour every root override (" + names + ")");
    return 0;
  }
  for (const f of findings) console.error("REFUSED [" + f.kind + "] " + f.message);
  return 1;
}

if (import.meta.main) {
  process.exit(main(process.argv[2] ?? process.cwd()));
}
