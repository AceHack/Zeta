#!/usr/bin/env bun
// capture-package-surface.ts — the I/O half of the Tier 0 export-surface check.
//
// THIS FILE IS THE ONLY PART THAT TOUCHES THE NETWORK, and it is separate from
// `toy-surface.ts` for one reason: the decision function must be replayable from
// a fixture, and a function that fetches cannot be. Everything that decides
// anything lives in `toy-surface.ts` and is pure; this file only turns
// (package, version) into the text that module reads.
//
// It is NOT wired into CI and nothing calls it on a schedule. It is run by hand
// to capture a fixture, or by an operator investigating one proposal. A
// half-wired auto-updater that starts approving things is the worst outcome
// available here, so the wiring is deliberately absent rather than merely
// unfinished.
//
// Usage:
//   bun src/Core.TypeScript/dep-update/capture-package-surface.ts react-resizable-panels 3.0.6
//   bun src/Core.TypeScript/dep-update/capture-package-surface.ts <pkg> <from> <to>   # prints the diff
//
// With three arguments it prints the neutral `SurfaceFact` rows for the pair.
// It prints them. It does not decide anything, and it does not merge anything.

import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve as resolvePath } from "node:path";
import {
  extractDeclaredSurface,
  diffSurface,
  compareOrdinal,
  type DeclaredSurface,
  type EntryPointSurface,
  type PackageSurface,
} from "./toy-surface.ts";

const REGISTRY = "https://registry.npmjs.org";

interface PackumentVersion {
  readonly dist?: { readonly tarball?: string; readonly integrity?: string };
  readonly types?: string;
  readonly typings?: string;
  readonly main?: string;
  readonly exports?: unknown;
}

/// Build the packument URL for one exact (package, version).
///
/// Exported and pure so it has a falsifier. It got one because CodeQL found a
/// real bug here: the first version was `pkg.replace("/", "%2f")`, and
/// `String.replace` with a STRING pattern replaces only the FIRST occurrence.
/// It happened to be correct — an npm name carries at most one `/`, separating
/// scope from name — but the code said "escape the slashes" and escaped one, so
/// it was right by accident rather than by construction. That is the class this
/// repo refuses everywhere else, and a linter finding it before a human did is
/// the apparatus working.
///
/// `%2f` rather than `encodeURIComponent` for the whole name: the registry wants
/// the scope separator percent-encoded and the leading `@` left alone.
export function packumentUrl(registry: string, pkg: string, version: string): string {
  return `${registry}/${pkg.replaceAll("/", "%2f")}/${encodeURIComponent(version)}`;
}

/// Resolve one exact version's metadata. Exact versions only — resolving a RANGE
/// would make the captured fixture depend on when it was captured, which is the
/// ambient-input failure this whole directory is built to avoid.
async function fetchVersionMetadata(pkg: string, version: string): Promise<PackumentVersion> {
  const url = packumentUrl(REGISTRY, pkg, version);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`registry ${String(res.status)} for ${pkg}@${version} (${url})`);
  return (await res.json()) as PackumentVersion;
}

/// Every PUBLISHED ENTRY POINT, as (subpath -> candidate declaration files).
///
/// Reading the manifest rather than globbing the tarball is the difference
/// between "the surface this package PUBLISHES" and "every declaration file that
/// happens to be shipped" — the second includes internals that were never part
/// of the contract.
///
/// The `.js -> .d.ts` mapping is why this is not a one-liner. Most modern
/// packages point `exports` at RUNTIME files and ship the declarations beside
/// them under the same basename, relying on TypeScript's sibling lookup. A
/// filter for paths ending in `.d.ts` therefore finds nothing on exactly the
/// packages whose surface lives under subpaths — which is how the first version
/// of this file read `@noble/post-quantum` as having no exports at all.
function declaredEntryPoints(meta: PackumentVersion): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, string[]>();

  const candidatesFor = (v: string): readonly string[] => {
    const clean = v.replace(/^\.\//, "");
    if (clean.endsWith(".d.ts")) return [clean];
    if (/\.(js|mjs|cjs)$/.test(clean)) {
      const base = clean.replace(/\.(js|mjs|cjs)$/, "");
      return [`${base}.d.ts`, `${base}.d.mts`, `${base}.d.cts`];
    }
    return [];
  };

  const record = (subpath: string, v: unknown): void => {
    if (typeof v !== "string") return;
    const cands = candidatesFor(v);
    if (cands.length === 0) return;
    const existing = out.get(subpath) ?? [];
    out.set(subpath, [...new Set([...existing, ...cands])]);
  };

  // Legacy top-level fields describe the root entry point.
  record(".", meta.types);
  record(".", meta.typings);
  record(".", meta.main);

  // `exports` maps subpath -> (string | conditional map). Walk each subpath's
  // subtree separately so the subpath stays attached to what it resolves to.
  const exportsNode = meta.exports;
  if (typeof exportsNode === "string") {
    record(".", exportsNode);
  } else if (exportsNode !== null && typeof exportsNode === "object" && !Array.isArray(exportsNode)) {
    for (const [key, value] of Object.entries(exportsNode as Record<string, unknown>)) {
      // A key that does not start with "." is a CONDITION on the root entry
      // (e.g. `{ "import": "./x.js" }`), not a subpath.
      const subpath = key.startsWith(".") ? key : ".";
      const walk = (node: unknown): void => {
        if (typeof node === "string") {
          record(subpath, node);
        } else if (Array.isArray(node)) {
          node.forEach(walk);
        } else if (node !== null && typeof node === "object") {
          Object.values(node).forEach(walk);
        }
      };
      walk(value);
    }
  }

  return out;
}

async function extractTarball(tarballUrl: string, into: string): Promise<void> {
  const res = await fetch(tarballUrl);
  if (!res.ok) throw new Error(`tarball ${String(res.status)} for ${tarballUrl}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const archive = join(into, "package.tgz");
  await Bun.write(archive, bytes);
  const proc = Bun.spawnSync(["tar", "-xzf", archive, "-C", into]);
  if (proc.exitCode !== 0) {
    throw new Error(`tar exit ${String(proc.exitCode)}: ${new TextDecoder().decode(proc.stderr)}`);
  }
}

/// Follow a declaration file's own relative re-exports so a barrel `index.d.ts`
/// does not read as an empty surface. Depth-bounded and cycle-guarded; anything
/// it still cannot reach stays in `unresolvedStarReexports`, which the diff turns
/// into `SurfaceUnreadable`.
async function readSurfaceFollowingLocalReexports(
  root: string,
  entry: string,
  seen = new Set<string>(),
): Promise<DeclaredSurface> {
  const abs = resolvePath(root, entry);
  if (seen.has(abs)) return { names: [], unresolvedStarReexports: [] };
  seen.add(abs);

  let source: string;
  try {
    source = await readFile(abs, "utf8");
  } catch {
    return { names: [], unresolvedStarReexports: [entry] };
  }

  const here = extractDeclaredSurface(source);
  const names = new Set(here.names);
  const stillUnresolved: string[] = [];

  for (const specifier of here.unresolvedStarReexports) {
    if (!specifier.startsWith(".")) {
      // A bare specifier re-exports another PACKAGE. Not resolvable from this
      // tarball, and saying so is the honest answer.
      stillUnresolved.push(specifier);
      continue;
    }
    const base = resolvePath(dirname(abs), specifier).replace(/\.js$/, "");
    const candidates = [`${base}.d.ts`, join(base, "index.d.ts")];
    let followed = false;
    for (const candidate of candidates) {
      try {
        await stat(candidate);
      } catch {
        continue;
      }
      const nested = await readSurfaceFollowingLocalReexports(root, candidate, seen);
      nested.names.forEach((n) => names.add(n));
      stillUnresolved.push(...nested.unresolvedStarReexports);
      followed = true;
      break;
    }
    if (!followed) stillUnresolved.push(specifier);
  }

  return {
    names: [...names].toSorted(compareOrdinal),
    unresolvedStarReexports: [...new Set(stillUnresolved)].toSorted(compareOrdinal),
  };
}

export async function capture(pkg: string, version: string): Promise<PackageSurface> {
  const meta = await fetchVersionMetadata(pkg, version);
  const tarball = meta.dist?.tarball;
  if (tarball === undefined) throw new Error(`no dist.tarball for ${pkg}@${version}`);

  const work = await mkdtemp(join(tmpdir(), "zeta-surface-"));
  try {
    await extractTarball(tarball, work);
    const root = join(work, "package");
    const declared = new Map(declaredEntryPoints(meta));

    if (declared.size === 0) {
      // Nothing in the packument named a resolvable entry point. Fall back to
      // the conventional root path — and if that is absent too, emit an entry
      // point with `declarationFile: null`, so the diff reports
      // `SurfaceUnreadable` rather than a clean read of an empty surface.
      const listing = await readdir(root).catch(() => [] as string[]);
      declared.set(".", listing.includes("index.d.ts") ? ["index.d.ts"] : []);
    }

    const entryPoints: EntryPointSurface[] = [];
    for (const [subpath, candidates] of [...declared].toSorted(([a], [b]) => compareOrdinal(a, b))) {
      let resolved: string | null = null;
      for (const candidate of candidates) {
        try {
          await stat(resolvePath(root, candidate));
          resolved = candidate;
          break;
        } catch {
          // try the next candidate extension
        }
      }

      if (resolved === null) {
        entryPoints.push({ subpath, declarationFile: null, names: [], unresolvedStarReexports: [] });
        continue;
      }

      const surface = await readSurfaceFollowingLocalReexports(root, resolved);
      entryPoints.push({
        subpath,
        declarationFile: resolved,
        names: surface.names,
        unresolvedStarReexports: surface.unresolvedStarReexports,
      });
    }

    return {
      package: pkg,
      version,
      tarballIntegrity: meta.dist?.integrity ?? null,
      entryPoints,
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const [pkg, from, to] = argv;
  if (pkg === undefined || from === undefined) {
    console.error("usage: capture-package-surface.ts <package> <version> [<toVersion>]");
    return 2;
  }

  const before = await capture(pkg, from);
  if (to === undefined) {
    console.log(JSON.stringify(before, null, 2));
    return 0;
  }

  const after = await capture(pkg, to);
  console.log(JSON.stringify({ before, after }, null, 2));
  console.log("\n--- SurfaceFact rows ---");
  for (const f of diffSurface(before, after)) console.log(JSON.stringify(f));
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
