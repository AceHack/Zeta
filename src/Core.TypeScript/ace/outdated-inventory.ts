// outdated-inventory.ts -- what this tree PINS, per ecosystem, read from committed text only.
//
// The first half of `ace outdated`. This module answers exactly one question -- "what version of
// each dependency is this tree currently pinned to?" -- and it answers it with no network, no
// package manager, and no resolver. Every parser here takes TEXT and returns rows; the only
// filesystem access is `collectPinned`, which reads the committed manifests through safe-io.
//
// WHY THIS IS NOT `hygiene/unhashed-inventory.ts`
// ----------------------------------------------
// That module already walks every dependency mechanism in the tree, and it is the right module
// for the question it asks: IS THIS DEPENDENCY CONTENT-PINNED? Its rows carry a `coverage`
// (`digest` / `tag-only` / `unpinned` / `undeclared`) and, for whole mechanisms, an aggregate
// subject like `"131 integrity-covered package(s)"`. That is a complete answer about digests and
// deliberately not an answer about VERSIONS -- a row standing for 131 packages has no version to
// compare, and it does not need one.
//
// `ace outdated` needs the other axis: a (name, version) pair per dependency, canonical enough to
// key a registry lookup. So this module is a SECOND READING of some of the same files, not a
// second copy of that one. Nothing here reports digest coverage, and nothing there reports
// versions; where they overlap on a file, they extract disjoint fields.
//
// WHY HAND PARSERS
// ----------------
// Same reasoning `parseDeclaredTools` states for `.mise.toml`: a parser that understands exactly
// the shapes this repo uses FAILS LOUDLY on a shape it does not (the row is simply not produced,
// so the dependency shows up nowhere and its absence is visible in the counts), whereas a general
// parser accepts a shape the comparison cannot handle and reports a confident wrong answer.
//
// The mise parser is not hand-rolled here at all -- it is imported from
// `../ci/toolchain-manifest.ts`, which already parses the same table for the pin-parity check.
//
// Rule 0: TypeScript, no .sh.

import { readFileBounded } from "../io/safe-io.ts";
import { parseDeclaredTools } from "../ci/toolchain-manifest.ts";

/**
 * The ecosystems whose pinned versions this module can actually extract.
 *
 * A CLOSED SET, on purpose. An ecosystem present in the tree and absent from this union is
 * reported as NOT COVERED by the command rather than silently contributing zero rows -- because
 * "zero dependencies found" and "this resolver does not read that ecosystem" are the same output
 * and very different facts.
 */
export type Ecosystem = "nuget" | "npm" | "mise" | "go" | "cargo" | "pypi";

export const ECOSYSTEMS: readonly Ecosystem[] = ["cargo", "go", "mise", "npm", "nuget", "pypi"];

/**
 * How the version was written down.
 *
 * `exact` is a single version. `range` is a constraint (`^1.2.0`, `>=6.0.2`, `1.3`) that names a
 * set, not a point -- which means "how far behind is it" HAS NO ANSWER without running the
 * ecosystem's resolver. A range row is therefore carried into the report and reported `unknown`,
 * never compared as if the constraint text were a version.
 */
export type PinKind = "exact" | "range";

export interface PinnedDependency {
  readonly ecosystem: Ecosystem;
  /** Registry-canonical name, as the ecosystem's own index spells it. */
  readonly name: string;
  /** The version text exactly as the manifest wrote it. Never normalised. */
  readonly current: string;
  readonly pinKind: PinKind;
  /** Repo-relative path this row was read from. The provenance of the CURRENT half. */
  readonly source: string;
}

/** A manifest that was expected and could not be read. Never silently dropped. */
export interface UnreadableSource {
  readonly path: string;
  readonly reason: string;
}

export interface PinnedInventory {
  readonly deps: readonly PinnedDependency[];
  readonly unreadable: readonly UnreadableSource[];
  /** Manifest files actually read, repo-relative. Empty means the scan did not run. */
  readonly sourcesRead: readonly string[];
}

// -- version shape ------------------------------------------------------------------------

/**
 * Is this text a single version rather than a constraint?
 *
 * Deliberately strict: leading `^ ~ > < = !` or whitespace, a comma, or a `*` makes it a range.
 * A bare `1.3` IS a range in every ecosystem here (mise resolves it to the newest 1.3.x, npm
 * treats a bare partial as a prefix), so a two-component version is a range too. Being strict
 * costs some rows an exact comparison; being loose would make up an answer.
 */
export function classifyPin(text: string): PinKind {
  const t = text.trim();
  if (t.length === 0) return "range";
  if (/[\^~><=!,*\s|]/u.test(t)) return "range";
  // A single version needs at least major.minor.patch to be a point in any of these ecosystems.
  if (!/^v?\d+\.\d+\.\d+/u.test(t)) return "range";
  return "exact";
}

// -- NuGet: Directory.Packages.props ------------------------------------------------------

/**
 * Central Package Management: every NuGet version in this repo is declared exactly once, here.
 *
 * Attribute order is not fixed by MSBuild, so both orders are matched rather than assuming the
 * order this file happens to use today.
 */
/**
 * Remove XML comments repeatedly until the text stops changing.
 *
 * Flagged by CodeQL as `js/incomplete-multi-character-sanitization` on the single-pass form.
 * The HTML-injection framing in that rule's message does not apply here — nothing this
 * function feeds is ever rendered — but the underlying complaint does: one pass is not a
 * fixpoint, and a reader that can be made to see a pin that is commented out, or miss one
 * that is not, is a reader that reports the wrong dependency set.
 */
function stripXmlComments(xml: string): string {
  let live = xml;
  for (;;) {
    const next = live.replace(/<!--[\s\S]*?-->/gu, "");
    if (next === live) return live;
    live = next;
  }
}

export function parseNuGetCentralVersions(xml: string, source: string): PinnedDependency[] {
  const out: PinnedDependency[] = [];
  // Strip XML comments first: several PackageVersion lines in this repo sit inside commented-out
  // blocks explaining why they are not referenced yet, and a commented pin is not a pin.
  //
  // TO A FIXPOINT, not one pass. A single `.replace` is not idempotent on overlapping markers:
  // `<!--<!-- x -->-->` loses the inner comment and leaves a bare `-->` behind, and the reverse
  // shape can leave a live `<!--` that swallows the next real element. XML forbids nested
  // comments, so such input is malformed — but this is a REGEX reader, not a parser, and a
  // malformed props file must not be able to hide or invent a pin. Each pass either shortens
  // the string or changes nothing, so this terminates.
  const live = stripXmlComments(xml);
  const tag = /<PackageVersion\b([^>]*)\/?>/gu;
  for (const m of live.matchAll(tag)) {
    const attrs = m[1] ?? "";
    const include = /\bInclude\s*=\s*"([^"]+)"/u.exec(attrs);
    const version = /\bVersion\s*=\s*"([^"]+)"/u.exec(attrs);
    if (include === null || version === null) continue;
    const name = include[1] ?? "";
    const current = version[1] ?? "";
    if (name.length === 0 || current.length === 0) continue;
    // An MSBuild property reference is not a version this command can resolve.
    if (current.includes("$(")) continue;
    out.push({ ecosystem: "nuget", name, current, pinKind: classifyPin(current), source });
  }
  return out;
}

// -- npm: package.json --------------------------------------------------------------------

/** `dependencies` + `devDependencies`. Workspace/file/git specifiers are skipped, not guessed. */
export function parsePackageJsonDependencies(json: string, source: string): PinnedDependency[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const root = parsed as Record<string, unknown>;
  const out: PinnedDependency[] = [];
  for (const field of ["dependencies", "devDependencies"] as const) {
    const table = root[field];
    if (typeof table !== "object" || table === null) continue;
    for (const [name, raw] of Object.entries(table as Record<string, unknown>)) {
      if (typeof raw !== "string") continue;
      // Not a registry version at all -- a path, a repo, an alias. No registry answers for it.
      if (/^(?:file:|link:|git|github:|https?:|workspace:|npm:)/u.test(raw)) continue;
      out.push({ ecosystem: "npm", name, current: raw, pinKind: classifyPin(raw), source });
    }
  }
  return out;
}

// -- mise: .mise.toml [tools] -------------------------------------------------------------

/**
 * REUSED WHOLE from `../ci/toolchain-manifest.ts` -- the same `[tools]` table the mise pin-parity
 * check already parses, with the same three accepted shapes and the same loud failure on a
 * fourth. Writing a second mise parser here would be the exact duplication this file's header
 * argues against.
 */
export function parseMiseTools(toml: string, source: string): PinnedDependency[] {
  return parseDeclaredTools(toml).map((t) => ({
    ecosystem: "mise" as const,
    // The BACKEND-QUALIFIED key, not the short name: `pipx:semgrep` and a hypothetical
    // `github:semgrep` are different dependencies with different upstreams, and collapsing them
    // to `semgrep` would key two rows to one snapshot entry.
    name: t.key,
    current: t.version,
    pinKind: classifyPin(t.version),
    source,
  }));
}

// -- Go: go.mod ---------------------------------------------------------------------------

/** Both `require x v1` and the parenthesised block. `// indirect` rows are real pins and kept. */
export function parseGoMod(text: string, source: string): PinnedDependency[] {
  const out: PinnedDependency[] = [];
  let inBlock = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\/\/.*$/u, "").trim();
    if (line.length === 0) continue;
    if (inBlock) {
      if (line === ")") {
        inBlock = false;
        continue;
      }
      const parts = line.split(/\s+/u);
      const name = parts[0];
      const version = parts[1];
      if (name !== undefined && version !== undefined && version.startsWith("v")) {
        out.push({ ecosystem: "go", name, current: version, pinKind: classifyPin(version), source });
      }
      continue;
    }
    if (line === "require (") {
      inBlock = true;
      continue;
    }
    const single = /^require\s+(\S+)\s+(v\S+)$/u.exec(line);
    if (single !== null) {
      const name = single[1] ?? "";
      const version = single[2] ?? "";
      out.push({ ecosystem: "go", name, current: version, pinKind: classifyPin(version), source });
    }
  }
  return out;
}

// -- Cargo: Cargo.toml --------------------------------------------------------------------

/**
 * Registry dependencies only. A `{ path = ... }` dependency is a sibling crate in this repo --
 * it has no crates.io version and asking crates.io about it would get an answer about a
 * different crate with the same name, which is worse than no answer.
 */
export function parseCargoDependencies(toml: string, source: string): PinnedDependency[] {
  const out: PinnedDependency[] = [];
  let inDeps = false;
  for (const raw of toml.split("\n")) {
    const line = raw.replace(/#.*$/u, "").trim();
    if (line.length === 0) continue;
    if (line.startsWith("[")) {
      // `[dependencies]`, `[dev-dependencies]`, `[build-dependencies]`, and their
      // `[target.'cfg(...)'.dependencies]` forms.
      inDeps = /^\[(?:[^\]]*\.)?(?:dependencies|dev-dependencies|build-dependencies)\]$/u.test(line);
      continue;
    }
    if (!inDeps) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const name = line.slice(0, eq).trim().replace(/^["']|["']$/gu, "");
    const rhs = line.slice(eq + 1).trim();
    if (name.length === 0) continue;
    const scalar = /^["']([^"']+)["']$/u.exec(rhs);
    if (scalar !== null) {
      const current = scalar[1] ?? "";
      out.push({ ecosystem: "cargo", name, current, pinKind: classifyPin(current), source });
      continue;
    }
    if (rhs.startsWith("{")) {
      if (/\bpath\s*=/u.test(rhs) || /\bgit\s*=/u.test(rhs)) continue;
      const inline = /\bversion\s*=\s*["']([^"']+)["']/u.exec(rhs);
      if (inline === null) continue;
      const current = inline[1] ?? "";
      out.push({ ecosystem: "cargo", name, current, pinKind: classifyPin(current), source });
    }
  }
  return out;
}

// -- Python: uv.lock ----------------------------------------------------------------------

/**
 * The RESOLVED versions, from the lock, not the `>=` floors from `pyproject.toml`.
 *
 * A `pyproject` row says `pyyaml>=6.0.2`, which is a floor and not a pin -- comparing it against
 * PyPI's latest would say "behind" about a constraint that is perfectly satisfied. The lock
 * carries the version actually installed, which is the thing that can be out of date.
 *
 * Only `registry` packages: a lock also contains the local project itself (`source = { editable
 * = "." }` / `virtual`), which has no upstream.
 */
export function parseUvLock(toml: string, source: string): PinnedDependency[] {
  const out: PinnedDependency[] = [];
  let name: string | null = null;
  let version: string | null = null;
  let fromRegistry = false;
  const flush = (): void => {
    if (name !== null && version !== null && fromRegistry) {
      out.push({ ecosystem: "pypi", name, current: version, pinKind: classifyPin(version), source });
    }
    name = null;
    version = null;
    fromRegistry = false;
  };
  for (const raw of toml.split("\n")) {
    const line = raw.trim();
    if (line === "[[package]]") {
      flush();
      continue;
    }
    // Any other table header ends the package's own key/value region.
    if (line.startsWith("[") && line !== "[[package]]") {
      continue;
    }
    const kv = /^(name|version|source)\s*=\s*(.+)$/u.exec(line);
    if (kv === null) continue;
    const key = kv[1];
    const value = (kv[2] ?? "").trim();
    if (key === "name") name = value.replace(/^["']|["']$/gu, "");
    else if (key === "version") version = value.replace(/^["']|["']$/gu, "");
    else if (key === "source") fromRegistry = /\bregistry\s*=/u.test(value);
  }
  flush();
  return out;
}

// -- collection ---------------------------------------------------------------------------

/** Where each ecosystem's pins live, relative to the repo root. */
export interface ManifestLocation {
  readonly ecosystem: Ecosystem;
  readonly path: string;
  readonly parse: (text: string, source: string) => PinnedDependency[];
  /**
   * Absent is normal for this manifest (a per-crate `Cargo.toml` that declares no registry
   * dependency still exists; a lane may not be checked out). Absence of a REQUIRED manifest is
   * an unreadable source instead.
   */
  readonly optional: boolean;
}

/**
 * The manifest roster.
 *
 * The four single-file manifests are named literally and are NOT optional: if
 * `Directory.Packages.props` stops being readable, that is an unreadable source the command
 * reports, rather than a silent zero-row NuGet result.
 *
 * The Cargo and uv entries are PASSED IN rather than globbed here, so this function stays pure
 * and testable; `discoverMultiProjectManifests` in `outdated.ts` does the directory walk. They
 * are optional because most of this repo's ~30 Rust crates declare no registry dependency at all
 * -- a crate with an empty `[dependencies]` table contributes no rows, and that is correct.
 */
export function manifestRoster(cargoManifests: readonly string[], uvLocks: readonly string[]): readonly ManifestLocation[] {
  const out: ManifestLocation[] = [
    { ecosystem: "nuget", path: "Directory.Packages.props", parse: parseNuGetCentralVersions, optional: false },
    { ecosystem: "npm", path: "package.json", parse: parsePackageJsonDependencies, optional: false },
    { ecosystem: "mise", path: ".mise.toml", parse: parseMiseTools, optional: false },
    { ecosystem: "go", path: "src/Core.Go/go.mod", parse: parseGoMod, optional: false },
  ];
  for (const p of cargoManifests) out.push({ ecosystem: "cargo", path: p, parse: parseCargoDependencies, optional: true });
  for (const p of uvLocks) out.push({ ecosystem: "pypi", path: p, parse: parseUvLock, optional: true });
  return out;
}

function joinRepoPath(root: string, rel: string): string {
  return root.endsWith("/") ? `${root}${rel}` : `${root}/${rel}`;
}

/**
 * Read every manifest in the roster and return the union of their rows.
 *
 * READ-THEN-INTERPRET-ENOENT throughout (`readFileBounded` returns a Result; there is no
 * `existsSync` gate), so a file deleted between a check and a read cannot produce a different
 * answer than a file that was never there.
 */
export function collectPinned(root: string, roster: readonly ManifestLocation[]): PinnedInventory {
  const deps: PinnedDependency[] = [];
  const unreadable: UnreadableSource[] = [];
  const sourcesRead: string[] = [];
  for (const loc of roster) {
    const r = readFileBounded(joinRepoPath(root, loc.path));
    if (!r.ok) {
      if (r.error.kind === "not-found" && loc.optional) continue;
      unreadable.push({ path: loc.path, reason: `${r.error.kind}: ${r.error.message}` });
      continue;
    }
    sourcesRead.push(loc.path);
    for (const d of loc.parse(r.value.text, loc.path)) deps.push(d);
  }
  deps.sort(
    (a, b) =>
      (a.ecosystem < b.ecosystem ? -1 : a.ecosystem > b.ecosystem ? 1 : 0) ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
      (a.source < b.source ? -1 : a.source > b.source ? 1 : 0),
  );
  return { deps, unreadable, sourcesRead };
}
