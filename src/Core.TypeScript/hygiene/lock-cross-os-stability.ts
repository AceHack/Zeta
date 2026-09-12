#!/usr/bin/env bun
// lock-cross-os-stability.ts — does `dotnet restore` resolve the SAME
// `packages.lock.json` on every platform the gate runs on?
//
// -- WHY THIS EXISTS --------------------------------------------------------
// PR #17305 landed 63 `packages.lock.json` files and `--locked-mode` at three call
// sites, and deliberately did NOT widen it to the solution-wide gate job. Its stated
// reason, quoted from `docs/NUGET-LOCK-FILES.md`:
//
//   "the gate runs on ubuntu, windows and macos, and a lock file that legitimately
//    differs per-OS would turn a supply-chain check into a cross-platform flake.
//    Widening locked mode to the full solution wants a measurement of cross-OS lock
//    stability first, on a lane that can fail loudly without blocking `main`."
//
// This is the measurement. It is not a gate and must never become one on the strength
// of its own output — see the header of `.github/workflows/lock-cross-os-stability.yml`.
//
// -- WHAT IT ACTUALLY COMPARES ----------------------------------------------
// Each platform leg re-resolves with `--force-evaluate` (a plain restore is a NO-OP
// against a lock whose project-input hash still matches, so it would measure nothing)
// and captures every `packages.lock.json` verbatim. This module then compares those
// captures against each other AND against the committed files.
//
// The verdict vocabulary is deliberately five-valued, not two. Collapsing it to
// same/different would hide the only distinction that decides the question:
//
//   identical                    every platform, byte-for-byte, and equal to committed.
//   uniform-drift-from-committed every platform agrees with every other and DISAGREES
//                                with what is checked in. Not a cross-OS finding at all
//                                — it is a stale committed lock, and it is the gate's
//                                problem rather than this lane's.
//   differs-formatting-only    parsed JSON is deep-equal; the raw bytes are not. Newlines
//                                (CRLF on the Windows legs), key order, whitespace. Named
//                                rather than normalised away, because silently normalising
//                                is how a real difference hides behind a formatting one --
//                                and because a CRLF-only split still costs a `--locked-mode`
//                                gate a `git diff` if the checkout normalises differently.
//   differs-for-a-declared-reason  the differing entries are ALL runtime/RID-shaped AND
//                                the project actually declares a RuntimeIdentifier or an
//                                OS-suffixed TargetFramework. Both halves required.
//   differs-unexplained          everything else. THIS is the finding. A RID-shaped
//                                difference in a project that never asked for a RID is
//                                unexplained, not declared — nothing in the tree
//                                requested it, so calling it "expected" would be the
//                                rubber stamp this lane exists to avoid.
//
// -- THE HALF THAT IS EASY TO GET WRONG -------------------------------------
// A classifier that can only say "declared" is a check that cannot fail. The declared
// path is therefore conjunctive (shape AND declaration) and the falsifiers in
// `lock-cross-os-stability.test.ts` include a control that perturbs one lock and asserts
// the verdict is `differs-unexplained` — the mutation the rest of the file is judged by.
//
// Run:  bun src/Core.TypeScript/hygiene/lock-cross-os-stability.ts capture --platform <label> --sdk <ver> --out <file>
//       bun src/Core.TypeScript/hygiene/lock-cross-os-stability.ts compare --manifest <file> [--manifest <file> ...] [--json <out>]

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

/** One platform leg's capture: every lock file it produced, verbatim. */
export interface LockManifest {
  /** Runner label, e.g. `ubuntu-24.04`, `windows-11-arm`. */
  readonly platform: string;
  /** `dotnet --version` on that leg. A mismatch here explains a lot, so it is recorded. */
  readonly sdk: string;
  /** Node's view of the CPU, e.g. `x64`, `arm64`. The gate matrix has two ARM legs. */
  readonly arch: string;
  /**
   * Did this leg's restore steps actually complete? FAIL-CLOSED: capture writes `false`
   * unless told otherwise, and `compare` refuses such a manifest as data.
   *
   * This field exists because the lane shipped without it and was immediately bitten.
   * On run 34664278420 the `windows-11-arm` leg crashed in `dotnet --version`
   * (exit -2147483644), skipped both restore steps, and STILL uploaded a full 63-file
   * manifest -- the files as checked out, never re-resolved. The comparison read it as a
   * fifth opinion and its CRLF checkout turned 33 genuinely-identical projects into
   * `differs-formatting-only`. A leg that did no work must not be able to vote.
   */
  readonly restored: boolean;
  /** Repo-relative POSIX path -> raw file text, exactly as restore wrote it. */
  readonly locks: Readonly<Record<string, string>>;
}

export type Verdict =
  | "identical"
  | "uniform-drift-from-committed"
  | "differs-formatting-only"
  | "differs-for-a-declared-reason"
  | "differs-unexplained"
  | "missing-on-some-platforms";

/** What one project's lock did across the matrix. */
export interface ProjectFinding {
  readonly path: string;
  readonly verdict: Verdict;
  /** Platforms grouped by the canonical (parsed, key-sorted) form of their lock. */
  readonly groups: readonly (readonly string[])[];
  /** Dependency entry keys that are not the same everywhere. Empty unless it differs. */
  readonly differingEntries: readonly string[];
  /** Platforms that produced no lock at this path at all. */
  readonly absentOn: readonly string[];
  readonly detail: string;
}

export interface Report {
  readonly platforms: readonly string[];
  /**
   * Expected legs that reported NO manifest at all. A leg whose restore died uploads
   * nothing, and a comparison that simply compared the legs that did report would call
   * that agreement — a check that did not run, looking exactly like one that passed. So
   * the expected roster is an input and its shortfall is a failure.
   */
  readonly missingPlatforms: readonly string[];
  /**
   * Legs that uploaded a manifest whose restore did not complete. Reported separately
   * from `missingPlatforms` because "it ran and did nothing" and "it never reported" are
   * different operational faults, and collapsing them would hide which one happened.
   */
  readonly unrestoredPlatforms: readonly string[];
  readonly findings: readonly ProjectFinding[];
  readonly counts: Readonly<Record<Verdict, number>>;
  /** True only when every expected leg reported AND nothing is unexplained or missing. */
  readonly stable: boolean;
}

// ---------------------------------------------------------------------------
// Static declaration scan — what the TREE says should differ per platform
// ---------------------------------------------------------------------------

const OS_SUFFIXED_TFM = /net\d+(?:\.\d+)?-(?:windows|android|ios|macos|maccatalyst|tizen)/i;

/** Signals that a project legitimately resolves differently per platform. */
export interface PerOsSignals {
  readonly runtimeIdentifiers: readonly string[];
  readonly osSuffixedTfms: readonly string[];
}

/**
 * Scan MSBuild text (a project file plus every `Directory.Build.props` above it) for the
 * two things that make a per-platform lock legitimate. Returns what it FOUND, never a
 * verdict — the caller decides what the presence or absence of a signal licenses.
 */
export function declaredPerOsSignals(texts: readonly string[]): PerOsSignals {
  const rids: string[] = [];
  const tfms: string[] = [];
  for (const text of texts) {
    // Comments are stripped first: a `<!-- RuntimeIdentifier ... -->` explaining why the
    // repo does NOT set one would otherwise read as setting one.
    const code = text.replace(/<!--[\s\S]*?-->/g, "");
    for (const m of code.matchAll(/<RuntimeIdentifiers?\s*[^>]*>([^<]*)<\/RuntimeIdentifiers?>/gi)) {
      for (const rid of (m[1] ?? "").split(";")) if (rid.trim() !== "") rids.push(rid.trim());
    }
    for (const m of code.matchAll(/<TargetFrameworks?\s*[^>]*>([^<]*)<\/TargetFrameworks?>/gi)) {
      for (const tfm of (m[1] ?? "").split(";")) {
        if (OS_SUFFIXED_TFM.test(tfm.trim())) tfms.push(tfm.trim());
      }
    }
  }
  return { runtimeIdentifiers: rids, osSuffixedTfms: tfms };
}

/**
 * Read a project's MSBuild text chain: the project file itself plus every
 * `Directory.Build.props` from its directory up to the repo root.
 */
export function msbuildTextChain(root: string, lockPath: string): string[] {
  const texts: string[] = [];
  const projDir = join(root, dirname(lockPath));
  let entries: string[] = [];
  try {
    entries = readdirSync(projDir);
  } catch {
    return texts;
  }
  for (const entry of entries) {
    if (entry.endsWith(".csproj") || entry.endsWith(".fsproj")) {
      try {
        texts.push(readFileSync(join(projDir, entry), "utf8"));
      } catch {
        /* unreadable project file contributes no signal; absence is handled by the caller */
      }
    }
  }
  let dir = projDir;
  for (;;) {
    try {
      const props = join(dir, "Directory.Build.props");
      if (statSync(props).isFile()) texts.push(readFileSync(props, "utf8"));
    } catch {
      /* no props at this level */
    }
    if (dir === root || !dir.startsWith(root)) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return texts;
}

// ---------------------------------------------------------------------------
// Lock comparison
// ---------------------------------------------------------------------------

/**
 * Package keys whose resolution is genuinely platform-dependent. Matching this is
 * NECESSARY for a `declared` verdict and never sufficient — see `classifyProject`.
 */
const RID_SHAPED = [
  /^runtime\./i,
  /^Microsoft\.NETCore\.App\.(?:Runtime|Host|Crossgen2|ILCompiler)\b/i,
  /^Microsoft\.AspNetCore\.App\.(?:Runtime|Ref)\b/i,
  /^Microsoft\.DotNet\.ILCompiler\b/i,
  /\.(?:win|linux|osx|freebsd|illumos|browser|android|ios|maccatalyst)(?:-(?:x64|x86|arm64|arm|musl))*\b/i,
];

export function isRidShapedPackage(name: string): boolean {
  return RID_SHAPED.some((re) => re.test(name));
}

/** Deterministic key-sorted JSON so two semantically equal locks serialise identically. */
export function canonicalise(text: string): string {
  const sortValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortValue);
    if (value !== null && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        out[key] = sortValue((value as Record<string, unknown>)[key]);
      }
      return out;
    }
    return value;
  };
  return JSON.stringify(sortValue(JSON.parse(text) as unknown));
}

/** Every `<targetFramework>/<package>` key in a lock, for naming what differs. */
function entryKeys(text: string): Map<string, string> {
  const parsed = JSON.parse(text) as { dependencies?: Record<string, Record<string, unknown>> };
  const out = new Map<string, string>();
  for (const [tfm, packages] of Object.entries(parsed.dependencies ?? {})) {
    for (const [name, body] of Object.entries(packages)) {
      out.set(`${tfm}/${name}`, JSON.stringify(body));
    }
  }
  return out;
}

/** Entry keys present-but-different or present-on-one-side-only across two locks. */
export function differingEntryKeys(a: string, b: string): string[] {
  const ea = entryKeys(a);
  const eb = entryKeys(b);
  const keys = new Set([...ea.keys(), ...eb.keys()]);
  const out: string[] = [];
  for (const key of keys) {
    if (ea.get(key) !== eb.get(key)) out.push(key);
  }
  return out.sort();
}

/**
 * The verdict for one project path across every platform that reported.
 *
 * `committed` is the file as checked in; `byPlatform` is what each leg resolved. A
 * platform absent from `byPlatform` produced no lock there and is reported as such
 * rather than skipped — a lane that silently ignored a missing file would report
 * "stable" for a project nothing restored.
 */
export function classifyProject(
  path: string,
  byPlatform: ReadonlyMap<string, string>,
  committed: string | undefined,
  allPlatforms: readonly string[],
  signals: PerOsSignals,
): ProjectFinding {
  const absentOn = allPlatforms.filter((p) => !byPlatform.has(p));
  const present = [...byPlatform.entries()];

  const grouped = new Map<string, string[]>();
  for (const [platform, text] of present) {
    let key: string;
    try {
      key = canonicalise(text);
    } catch {
      // Unparseable JSON is its own group keyed by raw text, so a corrupt lock shows up
      // as a difference instead of throwing the whole comparison away.
      key = `unparseable:${text}`;
    }
    const bucket = grouped.get(key);
    if (bucket === undefined) grouped.set(key, [platform]);
    else bucket.push(platform);
  }
  const groups = [...grouped.values()].map((g) => [...g].sort());

  if (absentOn.length > 0) {
    return {
      path,
      verdict: "missing-on-some-platforms",
      groups,
      differingEntries: [],
      absentOn,
      detail: `no packages.lock.json produced on: ${absentOn.join(", ")}`,
    };
  }

  if (groups.length > 1) {
    // Name the entries that differ, using the two most distant groups as representatives.
    const reps = groups.map((g) => byPlatform.get(g[0] ?? "") ?? "");
    const differing = new Set<string>();
    for (let i = 1; i < reps.length; i++) {
      try {
        for (const k of differingEntryKeys(reps[0] ?? "", reps[i] ?? "")) differing.add(k);
      } catch {
        differing.add("<unparseable lock>");
      }
    }
    const differingEntries = [...differing].sort();

    const declaresPerOs = signals.runtimeIdentifiers.length > 0 || signals.osSuffixedTfms.length > 0;
    const allRidShaped =
      differingEntries.length > 0 &&
      differingEntries.every((k) => isRidShapedPackage(k.slice(k.indexOf("/") + 1)));

    if (declaresPerOs && allRidShaped) {
      return {
        path,
        verdict: "differs-for-a-declared-reason",
        groups,
        differingEntries,
        absentOn,
        detail:
          `runtime-shaped entries only, and the project declares ` +
          `RuntimeIdentifier(s)=[${signals.runtimeIdentifiers.join(", ")}] ` +
          `os-suffixed TFM(s)=[${signals.osSuffixedTfms.join(", ")}]`,
      };
    }

    const why = !declaresPerOs
      ? "the project declares no RuntimeIdentifier and no OS-suffixed TargetFramework, so nothing in the tree asked for a per-platform graph"
      : "at least one differing entry is not runtime/RID-shaped";
    return {
      path,
      verdict: "differs-unexplained",
      groups,
      differingEntries,
      absentOn,
      detail: why,
    };
  }

  // One semantic group. Raw bytes may still differ (newlines).
  const rawSet = new Set(present.map(([, t]) => t));
  if (rawSet.size > 1) {
    return {
      path,
      verdict: "differs-formatting-only",
      groups,
      differingEntries: [],
      absentOn,
      detail: "parsed JSON is deep-equal across platforms; raw bytes are not (newlines, key order or whitespace)",
    };
  }

  const only = present[0]?.[1] ?? "";
  if (committed === undefined) {
    return {
      path,
      verdict: "uniform-drift-from-committed",
      groups,
      differingEntries: [],
      absentOn,
      detail: "every platform agrees; no committed lock exists at this path",
    };
  }
  let same: boolean;
  try {
    same = canonicalise(only) === canonicalise(committed);
  } catch {
    same = only === committed;
  }
  if (!same) {
    return {
      path,
      verdict: "uniform-drift-from-committed",
      groups,
      differingEntries: (() => {
        try {
          return differingEntryKeys(only, committed);
        } catch {
          return [];
        }
      })(),
      absentOn,
      detail: "every platform agrees with every other and disagrees with the committed file",
    };
  }
  return {
    path,
    verdict: "identical",
    groups,
    differingEntries: [],
    absentOn,
    detail: "byte-identical on every platform and equal to the committed lock",
  };
}

/** Fold every project path across every manifest into one report. */
export function compareManifests(
  manifests: readonly LockManifest[],
  committed: Readonly<Record<string, string>>,
  signalsFor: (path: string) => PerOsSignals,
  expectedPlatforms: readonly string[] = [],
): Report {
  // A manifest whose restore did not complete is NOT data. It is dropped before any
  // comparison, and its platform is reported as unrestored.
  const unrestoredPlatforms = manifests
    .filter((m) => m.restored === false)
    .map((m) => m.platform)
    .sort();
  const usable = manifests.filter((m) => m.restored !== false);

  const platforms = usable.map((m) => m.platform).sort();
  const missingPlatforms = expectedPlatforms
    .filter((p) => !platforms.includes(p) && !unrestoredPlatforms.includes(p))
    .sort();
  const paths = new Set<string>(Object.keys(committed));
  for (const m of usable) for (const p of Object.keys(m.locks)) paths.add(p);

  const findings: ProjectFinding[] = [];
  for (const path of [...paths].sort()) {
    const byPlatform = new Map<string, string>();
    for (const m of usable) {
      const text = m.locks[path];
      if (text !== undefined) byPlatform.set(m.platform, text);
    }
    findings.push(classifyProject(path, byPlatform, committed[path], platforms, signalsFor(path)));
  }

  const counts: Record<Verdict, number> = {
    identical: 0,
    "uniform-drift-from-committed": 0,
    "differs-formatting-only": 0,
    "differs-for-a-declared-reason": 0,
    "differs-unexplained": 0,
    "missing-on-some-platforms": 0,
  };
  for (const f of findings) counts[f.verdict] += 1;

  return {
    platforms,
    missingPlatforms,
    findings,
    counts,
    unrestoredPlatforms,
    stable:
      missingPlatforms.length === 0 &&
      unrestoredPlatforms.length === 0 &&
      counts["differs-unexplained"] === 0 &&
      counts["missing-on-some-platforms"] === 0,
  };
}

// ---------------------------------------------------------------------------
// Filesystem walk + CLI
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([".git", "node_modules", "bin", "obj", "references", ".venv", "dist"]);

/** Every `packages.lock.json` under `root`, as repo-relative POSIX paths -> text. */
export function collectLocks(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(full);
      else if (entry === "packages.lock.json") {
        out[relative(root, full).split(sep).join("/")] = readFileSync(full, "utf8");
      }
    }
  };
  walk(root);
  return out;
}

function flag(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

function flagAll(argv: readonly string[], name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === `--${name}`) {
      const v = argv[i + 1];
      if (v !== undefined) out.push(v);
    }
  }
  return out;
}

function main(): void {
  const argv = process.argv.slice(2);
  const sub = argv[0];
  const root = process.cwd();

  if (sub === "capture") {
    const platform = flag(argv, "platform");
    const out = flag(argv, "out");
    if (platform === undefined || out === undefined) {
      console.error("[lock-cross-os] capture needs --platform <label> --out <file>");
      process.exit(2);
    }
    const manifest: LockManifest = {
      platform,
      sdk: flag(argv, "sdk") ?? "unknown",
      arch: process.arch,
      // FAIL-CLOSED: anything but a literal `true` means the restore is not vouched for.
      restored: flag(argv, "restored") === "true",
      locks: collectLocks(root),
    };
    writeFileSync(out, JSON.stringify(manifest, null, 2));
    console.log(
      `[lock-cross-os] captured ${String(Object.keys(manifest.locks).length)} lock file(s) on ` +
        `${platform} (arch=${manifest.arch}, sdk=${manifest.sdk}, restored=${String(manifest.restored)}) -> ${out}`,
    );
    return;
  }

  if (sub === "compare") {
    const files = flagAll(argv, "manifest");
    if (files.length === 0) {
      console.error("[lock-cross-os] compare needs at least one --manifest <file>");
      process.exit(2);
    }
    const manifests = files.map((f) => JSON.parse(readFileSync(f, "utf8")) as LockManifest);

    // The committed baseline is whatever a clean checkout has on disk. `compare` runs in a
    // job that does NOT restore, so these files are the committed ones by construction.
    const committedRoot = flag(argv, "committed-root") ?? root;
    const committed = collectLocks(committedRoot);

    const signalCache = new Map<string, PerOsSignals>();
    const signalsFor = (path: string): PerOsSignals => {
      const hit = signalCache.get(path);
      if (hit !== undefined) return hit;
      const computed = declaredPerOsSignals(msbuildTextChain(committedRoot, path));
      signalCache.set(path, computed);
      return computed;
    };

    const expected = (flag(argv, "expect-platforms") ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p !== "");
    const report = compareManifests(manifests, committed, signalsFor, expected);

    console.log(`[lock-cross-os] platforms: ${report.platforms.join(", ")}`);
    if (expected.length > 0) console.log(`[lock-cross-os] expected:  ${expected.join(", ")}`);
    for (const p of report.missingPlatforms) {
      console.error(`[lock-cross-os] \u2717 expected leg reported NOTHING: ${p} (its restore or upload did not complete)`);
    }
    for (const m of manifests) {
      const note = m.restored === false ? "  <-- RESTORE DID NOT COMPLETE; NOT COUNTED AS DATA" : "";
      console.log(
        `[lock-cross-os]   ${m.platform}: arch=${m.arch} sdk=${m.sdk} ` +
          `locks=${String(Object.keys(m.locks).length)} restored=${String(m.restored)}${note}`,
      );
    }
    for (const p of report.unrestoredPlatforms) {
      console.error(`[lock-cross-os] \u2717 leg did NOT restore, so its manifest is not data: ${p}`);
    }
    console.log(`[lock-cross-os] projects compared: ${String(report.findings.length)}`);
    for (const [verdict, n] of Object.entries(report.counts)) {
      console.log(`[lock-cross-os]   ${verdict}: ${String(n)}`);
    }
    for (const f of report.findings) {
      if (f.verdict === "identical") continue;
      const marker = f.verdict === "differs-unexplained" || f.verdict === "missing-on-some-platforms" ? "✗" : "•";
      console.log(`[lock-cross-os] ${marker} ${f.path} — ${f.verdict}: ${f.detail}`);
      if (f.groups.length > 1) {
        for (const g of f.groups) console.log(`[lock-cross-os]     group: ${g.join(", ")}`);
      }
      for (const k of f.differingEntries.slice(0, 20)) console.log(`[lock-cross-os]     entry: ${k}`);
      if (f.differingEntries.length > 20) {
        console.log(`[lock-cross-os]     ... and ${String(f.differingEntries.length - 20)} more`);
      }
    }

    const jsonOut = flag(argv, "json");
    if (jsonOut !== undefined) writeFileSync(jsonOut, JSON.stringify(report, null, 2));

    if (!report.stable) {
      console.error(
        "[lock-cross-os] ✗ NOT stable — widening --locked-mode to the solution gate is NOT supported by this measurement",
      );
      process.exit(1);
    }
    console.log(
      "[lock-cross-os] ✓ every lock is identical across every platform leg and equal to the committed file",
    );
    return;
  }

  console.error("[lock-cross-os] usage: capture | compare");
  process.exit(2);
}

if (import.meta.main) main();
