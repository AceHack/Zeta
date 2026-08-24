#!/usr/bin/env bun
// audit-mise-toolchain-couplings.ts — the pins in `.mise.toml` that OTHER files depend on.
//
// WHY THIS IS A CHECK AND NOT A DEPENDABOT `ignore:`
//
// Two semver-invisible couplings were handed to me as things to guard with `ignore:`
// entries in `.github/dependabot.yml`. They cannot be guarded there. An `ignore:`
// suppresses an update Dependabot would otherwise PROPOSE, and both pins live in
// `.mise.toml` — a manifest of no supported ecosystem. Dependabot proposes nothing for
// either, so the `ignore:` would suppress nothing while looking, to a reader, exactly like
// protection. A guard that cannot fire is the vacuity class.
//
// So the guard lives here, on the `cross-verify` floor, where it can go red.
//
// COUPLING 1 — rust <-> every file that RESTATES the rust version
//
// `.mise.toml` already says a bump "must also move the `1.87.0-*` rustup-toolchain cache
// globs in `.github/workflows/gate.yml` + `installer-unit-tests.yml`; a stale glob silently
// degrades the offline path to a CDN fetch." Correct, and incomplete — measured 2026-08-23,
// the pin is restated in FOUR kinds of place, not two:
//
//   * `.mise.full.toml`      — an INDEPENDENT `rust = { version = … }` pin. A bump that
//                              moves `.mise.toml` alone leaves full-tier hosts (dev laptops,
//                              cluster nodes, the k8s CI lanes) on a DIFFERENT compiler from
//                              slim/standard hosts. Nothing in the tree said this.
//   * 15 cache globs         — `~/.rustup/toolchains/<v>-*` across gate.yml and
//                              installer-unit-tests.yml. Stale ⇒ silent cache miss.
//   * `install-rust-wasm32.sh` — `RUST_VERSION="${RUST_VERSION:-<v>}"`, the default a caller
//                              gets when the env var is absent.
//
// "Silently degrades" is the operative word and the reason prose was never enough: every
// one of these fails by being SLOWER or by provisioning the wrong thing, never by erroring.
// That is the `tlaps-proof` shape — a lane that went dark for seven weeks because nothing
// it did was loud.
//
// The site list is DISCOVERED, not hand-maintained: the checker globs the operative
// surfaces and reads whatever restatements it finds. A new workflow with a stale glob is
// caught the day it is added, and this file holds no expected version — the canonical value
// is read from `.mise.toml` every run. (A second hand-written list would be the defect
// wearing a fix's clothes; the same reasoning as `mise-pin-parity.ts`.)
//
// COUPLING 2 — zig <-> the committed byte-lock artifact
//
// `src/wasm-dla/bytelock/dla-canonical-zig.wasm` is 1,314 bytes produced by zig 0.13.0 and
// COMMITTED. It is one of the six modules the `no-binary-in-proof-lineage.md` exception
// admits, and condition 3 of that exception is "reproducible from committed source".
//
// The failure mode is specific and quiet: move the zig pin and the committed `.wasm` DOES
// NOT CHANGE. The byte-lock still passes, because the byte-lock compares the artifact
// against its golden vectors and both are unchanged. What has broken is the claim that the
// artifact is reproducible from the pinned toolchain — the proof lineage is stale and every
// check still says green. Nothing in the repo could see it.
//
// So the pairing (zig version, artifact sha256) is recorded in
// `audit-mise-toolchain-couplings.provenance.json` and checked in BOTH directions:
// the compiler may not move without the artifact, and the artifact may not move without the
// record. Either way a human must state which one is now true.
//
// Run:   bun src/Core.TypeScript/hygiene/audit-mise-toolchain-couplings.ts
// Exit:  0 — every restatement agrees with `.mise.toml`, byte-lock provenance intact
//        1 — a restatement disagrees, or the zig provenance is stale

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/** The one file every other value is compared against. Holds no expected version itself. */
export const CANONICAL = ".mise.toml";
export const PROVENANCE = "src/Core.TypeScript/hygiene/audit-mise-toolchain-couplings.provenance.json";

/**
 * Directories whose contents are OPERATIVE — a version in them changes what a machine does.
 *
 * `docs/`, `memory/` and `workitems/` are deliberately OUT of scope. A research note saying
 * "rust 1.87.0 is eleven releases behind" is a true historical statement, and a checker that
 * reddened on it would either be silenced or would force people to falsify their own
 * records. The rule this encodes: check what EXECUTES, never what merely narrates.
 */
export const OPERATIVE_ROOTS: readonly string[] = [".github/workflows", "tools/setup"];
/** Operative files at the repo root, matched exactly. */
export const OPERATIVE_ROOT_FILES: readonly string[] = [".mise.toml", ".mise.full.toml"];

export interface Restatement {
  readonly file: string;
  readonly line: number;
  readonly kind: string;
  readonly version: string;
}

/** `rust = "1.87.0"` or `rust = { version = "1.87.0", … }` — the mise pin, either spelling. */
export function parseRustPin(text: string): string | null {
  const inline = /^[ \t]*rust[ \t]*=[ \t]*\{[^}]*?version[ \t]*=[ \t]*"([^"]+)"/m.exec(text);
  if (inline?.[1]) return inline[1];
  const plain = /^[ \t]*rust[ \t]*=[ \t]*"([^"]+)"/m.exec(text);
  return plain?.[1] ?? null;
}

/** `zig = "0.13.0"`. */
export function parseZigPin(text: string): string | null {
  return /^[ \t]*zig[ \t]*=[ \t]*"([^"]+)"/m.exec(text)?.[1] ?? null;
}

/**
 * Every restatement of a rust version in one operative file.
 *
 * Three patterns, each anchored to the syntax that makes it OPERATIVE rather than
 * descriptive — a bare `1.87.0` inside a `#` comment is not a restatement, and matching one
 * would make this checker fire on its own explanatory prose.
 */
const RUSTUP_CACHE_GLOB = /~\/\.rustup\/toolchains\/(\d+\.\d+\.\d+)-\*/;
const RUST_VERSION_SHELL_DEFAULT = /RUST_VERSION[ \t]*=[ \t]*"?\$\{RUST_VERSION:-(\d+\.\d+\.\d+)\}/;
const MISE_RUST_TABLE = /^[ \t]*rust[ \t]*=[ \t]*\{[^}]*?version[ \t]*=[ \t]*"(\d+\.\d+\.\d+)"/;
const MISE_RUST_PLAIN = /^[ \t]*rust[ \t]*=[ \t]*"(\d+\.\d+\.\d+)"/;
const MISE_ZIG_PIN = /^[ \t]*zig[ \t]*=[ \t]*"(\d+\.\d+\.\d+)"/;

export function findRustRestatements(file: string, text: string): Restatement[] {
  const out: Restatement[] = [];
  text.split("\n").forEach((line, i) => {
    const glob = RUSTUP_CACHE_GLOB.exec(line);
    if (glob?.[1]) out.push({ file, line: i + 1, kind: "rustup cache glob", version: glob[1] });

    const envDefault = RUST_VERSION_SHELL_DEFAULT.exec(line);
    if (envDefault?.[1])
      out.push({ file, line: i + 1, kind: "RUST_VERSION shell default", version: envDefault[1] });

    // A mise `rust = …` pin in a SECOND mise config (.mise.full.toml). Two simple patterns
    // rather than one alternation: the combined form tripped sonarjs/regex-complexity, and
    // an unreadable regex in a checker nobody can audit is its own kind of vacuity.
    const misePin = MISE_RUST_TABLE.exec(line) ?? MISE_RUST_PLAIN.exec(line);
    if (misePin?.[1]) out.push({ file, line: i + 1, kind: "mise rust pin", version: misePin[1] });
  });
  return out;
}

/** Same, for zig — currently only the second mise config can restate it. */
export function findZigRestatements(file: string, text: string): Restatement[] {
  const out: Restatement[] = [];
  text.split("\n").forEach((line, i) => {
    const m = MISE_ZIG_PIN.exec(line);
    if (m?.[1]) out.push({ file, line: i + 1, kind: "mise zig pin", version: m[1] });
  });
  return out;
}

/**
 * Recursively list files under a root, skipping the usual noise.
 *
 * One syscall per question, deliberately. An `existsSync(root)` gate before the
 * listing would answer about a root that can be created, deleted or replaced
 * before `readdirSync` runs, so the guard reads as defensive and prevents
 * nothing -- ENOENT is interpreted from the listing itself instead. Likewise the
 * kind of each entry arrives WITH the listing via `withFileTypes`, so there is
 * no second `statSync` to race against. Both are the check-then-use class that
 * `lint-check-then-use-file-races.ts` refuses, and it caught this function.
 */
function walk(root: string, acc: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return acc;
    throw e;
  }
  for (const entry of entries) {
    const name = entry.name;
    if (name === "node_modules" || name === ".git" || name === "target") continue;
    const p = join(root, name);
    if (entry.isDirectory()) walk(p, acc);
    else if (/\.(ya?ml|sh|toml|ps1|bash)$/.test(name)) acc.push(p);
  }
  return acc;
}

export interface Provenance {
  readonly zig: { readonly version: string; readonly artifact: string; readonly sha256: string; readonly note?: string };
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Every operative file the restatement scan reads. Discovered, never hand-listed. */
export function operativeFiles(root: string): string[] {
  return [
    ...OPERATIVE_ROOT_FILES.map((f) => join(root, f)).filter(existsSync),
    ...OPERATIVE_ROOTS.flatMap((r) => walk(join(root, r))),
  ];
}

const SILENT_NOTE =
  "This fails SILENTLY (a stale cache glob degrades to a CDN fetch; a stale second mise " +
  "config gives full-tier hosts a different compiler), so it must fail here instead.";

/** One file's rust restatements, as problems. Split out so the scan loop stays shallow. */
function rustProblemsFor(rel: string, text: string, rust: string | null): { problems: string[]; sites: number } {
  const found = findRustRestatements(rel, text).filter((r) => !(rel === CANONICAL && r.kind === "mise rust pin"));
  const problems = found
    .filter((r) => rust !== null && r.version !== rust)
    .map(
      (r) =>
        `${r.file}:${String(r.line)} — ${r.kind} says ${r.version}, but ${CANONICAL} pins rust ${rust ?? "?"}. ${SILENT_NOTE}`,
    );
  return { problems, sites: found.length };
}

/** Same for zig. The canonical file's own pin is the value, not a restatement of it. */
function zigProblemsFor(rel: string, text: string, zig: string | null): { problems: string[]; sites: number } {
  const found = rel === CANONICAL ? [] : findZigRestatements(rel, text);
  const problems = found
    .filter((z) => zig !== null && z.version !== zig)
    .map((z) => `${z.file}:${String(z.line)} — ${z.kind} says ${z.version}, but ${CANONICAL} pins zig ${zig ?? "?"}.`);
  return { problems, sites: found.length };
}

/** Restatements that disagree with the canonical pins, as human-readable problems. */
export function checkRestatements(
  root: string,
  rust: string | null,
  zig: string | null,
): { problems: string[]; rustSites: number; zigSites: number } {
  const problems: string[] = [];
  let rustSites = 0;
  let zigSites = 0;

  for (const abs of operativeFiles(root)) {
    const rel = relative(root, abs);
    const text = readFileSync(abs, "utf8");
    const r = rustProblemsFor(rel, text, rust);
    const z = zigProblemsFor(rel, text, zig);
    problems.push(...r.problems, ...z.problems);
    rustSites += r.sites;
    zigSites += z.sites;
  }
  return { problems, rustSites, zigSites };
}

/**
 * The zig <-> byte-lock pairing, checked in BOTH directions.
 *
 * One direction alone would be half a guard: "compiler moved, artifact did not" is the
 * silent-staleness case, and "artifact moved, record did not" is the case where someone
 * regenerates and forgets to say under what.
 */
export function checkByteLockProvenance(root: string, zig: string | null, prov: Provenance): string[] {
  const problems: string[] = [];
  const artifact = join(root, prov.zig.artifact);

  if (!existsSync(artifact)) {
    problems.push(`${PROVENANCE}: names \`${prov.zig.artifact}\`, which does not exist.`);
    return problems;
  }

  if (zig !== null && prov.zig.version !== zig)
    problems.push(
      `BYTE-LOCK PROVENANCE STALE: ${CANONICAL} pins zig ${zig}, but ${prov.zig.artifact} was built by ` +
        `zig ${prov.zig.version} and is COMMITTED, so it did not move when the pin did. The byte-lock still ` +
        `passes and the artifact is no longer reproducible from the pinned toolchain — condition 3 of the ` +
        `no-binary-in-proof-lineage exception. Regenerate it ` +
        `(\`node src/wasm-dla/bytelock/build-substrates.mjs\`), confirm the golden vectors, and record the ` +
        `new (version, sha256) pair in ${PROVENANCE}.`,
    );

  const actual = sha256File(artifact);
  if (actual !== prov.zig.sha256)
    problems.push(
      `BYTE-LOCK ARTIFACT MOVED: ${prov.zig.artifact} hashes ${actual}, ${PROVENANCE} records ` +
        `${prov.zig.sha256}. Whichever is now true must be stated, not inferred.`,
    );

  return problems;
}

function main(): void {
  const root = process.cwd();
  const canonicalText = readFileSync(join(root, CANONICAL), "utf8");
  const rust = parseRustPin(canonicalText);
  const zig = parseZigPin(canonicalText);
  const prov = JSON.parse(readFileSync(join(root, PROVENANCE), "utf8")) as Provenance;

  const missing: string[] = [];
  if (rust === null) missing.push(`${CANONICAL}: no \`rust\` pin found — the canonical value is missing.`);
  if (zig === null) missing.push(`${CANONICAL}: no \`zig\` pin found — the canonical value is missing.`);

  const { problems: restatement, rustSites, zigSites } = checkRestatements(root, rust, zig);
  const problems = [...missing, ...restatement, ...checkByteLockProvenance(root, zig, prov)];

  if (problems.length > 0) {
    console.error("[mise-toolchain-couplings] ✗");
    for (const p of problems) console.error(`    ${p}`);
    process.exit(1);
  }

  console.log(
    `[mise-toolchain-couplings] ✓ rust ${rust ?? "?"} agrees across ${String(rustSites)} operative ` +
      `restatement(s); zig ${zig ?? "?"} agrees across ${String(zigSites)}; byte-lock ${prov.zig.artifact} ` +
      `sha256 ${prov.zig.sha256.slice(0, 12)}… matches its recorded zig ${prov.zig.version} provenance.`,
  );
}

if (import.meta.main) main();
