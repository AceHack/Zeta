#!/usr/bin/env bun
// audit-bun-pin-parity.ts — the bun version is declared ONCE, and every workflow restates it.
//
// THE DEFECT THIS CLOSES (measured 2026-09-13). `mise.lock` resolves bun to an exact
// version. The 55 `bun-version:` keys across `.github/` did not agree with it, or with each
// other, in FOUR different spellings:
//
//     32  bun-version: latest      no pin at all
//     12  bun-version: "1.3.13"    one patch BEHIND the lock
//      9  bun-version: 1.3         a range, resolved per-run by setup-bun
//      1  bun-version: 1.3.13      the same value, unquoted
//      1  bun-version: 1.3.14      the ONLY site agreeing with mise.lock
//
// So CI ran at least three different bun versions depending on which workflow you landed
// in, and the single site that matched the declared lock was outnumbered 54 to 1. Nothing
// checked it, because the existing `audit-dotnet-pin-parity.ts` covers dotnet only.
//
// `bun-version: latest` is the sharp one, and it is not merely "unpinned". It is an
// UNDECLARED ENTROPY CHANNEL (manifesto §13): the toolchain changes under the tree with no
// commit, so a run cannot be replayed and a green result cannot be attributed to the source
// it claims to test. `gate.yml` itself carried one.
//
// THE RESOLUTION, stated so it is not re-litigated per bump, and it is the same shape
// `audit-dotnet-pin-parity.ts` settled for .NET:
//
//     `mise.lock`'s resolved `bun` version is the SINGLE DECLARED SOURCE.
//     Every `bun-version:` under `.github/` is a checked RESTATEMENT of it.
//
// Why the LOCK and not `.mise.toml`: `.mise.toml` says `bun = "1.3"`, a RANGE. The dotnet
// audit refuses a range for the exact reason that applies here — mise would resolve it
// per-machine, and a restatement cannot be checked against something that has no single
// value. `mise.lock` is where that range acquires one, so the lock is the only honest
// referent. `.mise.toml`'s range is not demoted: this check requires the lock's version to
// SATISFY it, so the two cannot drift apart silently either.
//
// WHAT THIS CHECKS
//   1. `mise.lock` declares exactly one bun version, and it is an exact 3-part release.
//   2. `.mise.toml`'s `bun` pin is satisfied by it (same major.minor when a range).
//   3. Every `bun-version:` under `.github/` is byte-equal to the lock's version, ignoring
//      surrounding quotes. `latest` and ranges are refused by name, with the reason.
//
// It never invokes bun and never reaches the network: a text check, offline, correct on a
// machine with no bun installed.
//
// Run:   bun src/Core.TypeScript/hygiene/audit-bun-pin-parity.ts

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const LOCK_FILE = "mise.lock";
export const RANGE_FILE = ".mise.toml";
export const RESTATEMENT_ROOTS = [".github/workflows", ".github/actions"] as const;

export interface Finding {
  readonly level: "fail" | "unknown";
  readonly where: string;
  readonly message: string;
}

/** The resolved bun version in mise.lock, or null when absent/ambiguous. */
export function parseLockBun(text: string): { version: string | null; count: number } {
  // [[tools.bun]] blocks; take the `version = "..."` that follows each.
  const re = /\[\[tools\.bun\]\]\s*\n(?:[^[\n]*\n)*?\s*version\s*=\s*"([^"]+)"/gu;
  const found: string[] = [];
  for (const m of text.matchAll(re)) if (m[1] !== undefined) found.push(m[1]);
  const uniq = [...new Set(found)];
  return { version: uniq.length === 1 ? (uniq[0] ?? null) : null, count: uniq.length };
}

/** The `bun = "..."` pin in .mise.toml, or null. */
export function parseMiseBunRange(text: string): string | null {
  return /^\s*bun\s*=\s*"([^"]+)"\s*$/mu.exec(text)?.[1] ?? null;
}

export function isExactRelease(v: string): boolean {
  return /^\d+\.\d+\.\d+$/u.test(v);
}

/** Does an exact version satisfy a `.mise.toml` pin that may be a range like "1.3"? */
export function satisfies(pin: string, exact: string): boolean {
  if (pin === exact) return true;
  const p = pin.split("."), e = exact.split(".");
  if (p.length >= e.length) return false; // not a prefix range
  return p.every((seg, i) => seg === e[i]);
}

function walk(dir: string, out: string[]): void {
  let entries: readonly import("node:fs").Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".yml") || e.name.endsWith(".yaml")) out.push(p);
  }
}

/** Every `bun-version:` occurrence, with its file, line number and raw value. */
export function collectRestatements(
  files: readonly string[],
  read: (p: string) => string,
): { readonly sites: readonly { file: string; line: number; value: string }[]; readonly unreadable: readonly string[] } {
  const sites: { file: string; line: number; value: string }[] = [];
  const unreadable: string[] = [];
  for (const f of files) {
    let text: string;
    try {
      text = read(f);
    } catch {
      unreadable.push(f);
      continue;
    }
    text.split("\n").forEach((raw, i) => {
      const m = /^\s*bun-version\s*:\s*(.+?)\s*$/u.exec(raw);
      if (m?.[1] === undefined) return;
      sites.push({ file: f, line: i + 1, value: m[1].replace(/^["']|["']$/gu, "") });
    });
  }
  return { sites, unreadable };
}

export function checkPins(
  lockText: string | null,
  miseText: string | null,
  sites: readonly { file: string; line: number; value: string }[],
  unreadable: readonly string[],
): readonly Finding[] {
  const out: Finding[] = [];
  if (lockText === null) {
    return [{ level: "fail", where: LOCK_FILE, message: `${LOCK_FILE} is unreadable — the declared source is missing, and missing is not satisfied` }];
  }
  const { version, count } = parseLockBun(lockText);
  if (version === null) {
    return [{ level: "fail", where: LOCK_FILE, message: count === 0 ? `${LOCK_FILE} declares no bun version` : `${LOCK_FILE} declares ${String(count)} different bun versions; the declared source must have exactly one` }];
  }
  if (!isExactRelease(version)) {
    out.push({ level: "fail", where: LOCK_FILE, message: `the locked bun version "${version}" is not an exact 3-part release; a restatement cannot be checked against a range` });
  }
  if (miseText === null) {
    out.push({ level: "unknown", where: RANGE_FILE, message: `${RANGE_FILE} is unreadable — cannot confirm the lock satisfies the declared pin` });
  } else {
    const pin = parseMiseBunRange(miseText);
    if (pin === null) out.push({ level: "unknown", where: RANGE_FILE, message: `no \`bun = "..."\` pin found` });
    else if (!satisfies(pin, version)) out.push({ level: "fail", where: RANGE_FILE, message: `pin "${pin}" is not satisfied by the locked ${version} — the two declarations have diverged` });
  }
  for (const f of unreadable) {
    out.push({ level: "unknown", where: f, message: `unreadable — a partial scan cannot clear the tree` });
  }
  for (const s of sites) {
    if (s.value === version) continue;
    const why =
      s.value === "latest"
        ? `\`latest\` is not a pin: the toolchain changes with no commit, so the run cannot be replayed (manifesto §13, undeclared entropy channel). Use ${version}.`
        : isExactRelease(s.value)
          ? `restates bun ${s.value}, but ${LOCK_FILE} declares ${version}.`
          : `"${s.value}" is a range, resolved per-run by setup-bun. Use the exact ${version}.`;
    out.push({ level: "fail", where: `${s.file}:${String(s.line)}`, message: why });
  }
  return out;
}

function readOrNull(p: string, read: (p: string) => string): string | null {
  try {
    return read(p);
  } catch {
    return null;
  }
}

function main(): number {
  const read = (p: string): string => readFileSync(p, "utf-8");
  const files: string[] = [];
  for (const r of RESTATEMENT_ROOTS) walk(r, files);
  if (files.length === 0) {
    console.error("audit-bun-pin-parity: scanned zero workflow files — run from the repo root.");
    return 2;
  }
  const { sites, unreadable } = collectRestatements(files, read);
  const findings = checkPins(readOrNull(LOCK_FILE, read), readOrNull(RANGE_FILE, read), sites, unreadable);

  const fails = findings.filter((f) => f.level === "fail");
  const unknowns = findings.filter((f) => f.level === "unknown");
  for (const u of unknowns) console.log(`  UNKNOWN ${u.where} — ${u.message}`);
  for (const f of fails) console.error(`  FAIL    ${f.where} — ${f.message}`);

  if (fails.length > 0) {
    console.error(`\n${String(fails.length)} bun pin(s) disagree with ${LOCK_FILE}. The version is declared once and restated everywhere else.`);
    return 1;
  }
  console.log(`bun pin parity holds across ${String(sites.length)} restatement(s) in ${String(files.length)} workflow file(s)` + (unknowns.length > 0 ? ` — with ${String(unknowns.length)} UNKNOWN (above; unknown is not a pass).` : "."));
  return 0;
}

if (import.meta.main) process.exit(main());
