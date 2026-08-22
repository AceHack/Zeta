/**
 * ACE CLI — the package manager of package managers.
 * Backlog: 081KR2E4K0008QG0R002YE3MMD (CLI), 081KSGS9H0008QG0R0031PBNGA (meta-PM)
 *
 * Every package operation is a Z-set delta:
 *   install <pkg>  = +1 delta on the dependency graph
 *   remove <pkg>   = -1 delta on the dependency graph
 *   verify <pkg>   = read-only Merkle root check (no delta)
 *   list           = enumerate the current dependency graph
 *   graph-root     = return the Merkle root of the graph
 *
 * STUB: download, distributed registry, negotiation protocol,
 * diamond-resolution, and cross-PM wrapping are not yet implemented.
 */

export interface PackageEntry {
  name: string;
  version: string;
  contentAddress: string;
  weight: number;
  packageManager: "ace" | "helm" | "npm" | "cargo" | "nix";
  lastUpdated: string;
}

export interface PackageDelta {
  name: string;
  version: string;
  contentAddress: string;
  deltaWeight: number;
  packageManager: PackageEntry["packageManager"];
}

export type DependencyGraph = Map<string, PackageEntry>;

export interface AceResult {
  success: boolean;
  message: string;
  graph?: DependencyGraph;
  entry?: PackageEntry;
  entries?: PackageEntry[];
}

/** Apply a Z-set delta to the dependency graph. Returns a new graph. */
export function applyDelta(graph: DependencyGraph, delta: PackageDelta): DependencyGraph {
  const newGraph = new Map(graph);
  const currentWeight = newGraph.get(delta.name)?.weight ?? 0;
  const newWeight = currentWeight + delta.deltaWeight;
  if (newWeight === 0) {
    newGraph.delete(delta.name);
  } else {
    newGraph.set(delta.name, {
      name: delta.name,
      version: delta.version,
      contentAddress: delta.contentAddress,
      weight: newWeight,
      packageManager: delta.packageManager,
      lastUpdated: new Date().toISOString(),
    });
  }
  return newGraph;
}

/**
 * Compute the Merkle root of the dependency graph.
 *
 * NOT AN INTEGRITY PRIMITIVE — read this before trusting the return value.
 * The name says "Merkle root" and the `zeta:` prefix reads like a content
 * address, but the body is `h = h * 31 + charCode | 0` — Java's
 * `String.hashCode` (Bloch, *Effective Java*): non-cryptographic, **32 bits**
 * wide, and not a Merkle construction at all. There is no tree, so it proves no
 * inclusion and supports no partial verification, and collisions are
 * constructible rather than merely birthday-bounded. It is adequate ONLY as a
 * local change-detection checksum, which is what it is used for today.
 *
 * The real thing is `src/Core.CSharp/ZSetMerkle.cs`. Replacing this is a
 * separate, deliberate decision — it changes every emitted root — and is filed
 * rather than folded into the collation sweep that touched the line below.
 *
 * What the collation sweep DID fix: the entries feeding the hash were ordered by
 * `localeCompare`, so the "root" depended on the running machine's locale. The
 * package names in the registry today are lowercase-alphanumeric, a domain on
 * which locale order and code-point order agree (measured: 0 mismatches over
 * the observed name set), so no currently-emitted root changes — but the
 * divergence was latent and would have activated on the first mixed-case name.
 */
export function graphMerkleRoot(graph: DependencyGraph): string {
  const entries = Array.from(graph.entries())
    .sort(([a], [b]) => stringCompare(a, b))
    .map(([name, e]) => `${name}@${e.version}:${e.contentAddress}:${e.weight}`);
  let hash = 0;
  for (const entry of entries) {
    for (let i = 0; i < entry.length; i++) {
      hash = ((hash << 5) - hash + entry.charCodeAt(i)) | 0;
    }
  }
  return `zeta:${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

/** STUB registry — real: distributed DAG-FS tree backed by ZetaDB. */
export const STUB_REGISTRY: Map<string, PackageEntry> = new Map([
  [
    "zeta-core",
    {
      name: "zeta-core",
      version: "1.0.0",
      contentAddress: "sha256:abc123",
      weight: 0,
      packageManager: "ace",
      lastUpdated: "2026-08-09T00:00:00Z",
    },
  ],
  [
    "zeta-db",
    {
      name: "zeta-db",
      version: "0.1.0",
      contentAddress: "sha256:def456",
      weight: 0,
      packageManager: "ace",
      lastUpdated: "2026-08-09T00:00:00Z",
    },
  ],
  [
    "longhorn",
    {
      name: "longhorn",
      version: "1.7.2",
      contentAddress: "sha256:ghi789",
      weight: 0,
      packageManager: "helm",
      lastUpdated: "2026-08-09T00:00:00Z",
    },
  ],
  [
    "cockroachdb",
    {
      name: "cockroachdb",
      version: "24.3.4",
      contentAddress: "sha256:jkl012",
      weight: 0,
      packageManager: "helm",
      lastUpdated: "2026-08-09T00:00:00Z",
    },
  ],
]);

export function registryLookup(name: string, _version?: string): PackageEntry | undefined {
  return STUB_REGISTRY.get(name);
}

/** ace install <name> [version] — +1 Z-set delta. Idempotent. */
export function install(graph: DependencyGraph, name: string, version?: string): AceResult {
  const entry = registryLookup(name, version);
  if (!entry) return { success: false, message: `Package '${name}' not found in registry.` };
  const resolvedVersion = version ?? entry.version;
  const existing = graph.get(name);
  if (existing && existing.version === resolvedVersion && existing.weight > 0) {
    return {
      success: true,
      message: `Package '${name}@${resolvedVersion}' already installed (idempotent).`,
      graph,
      entry: existing,
    };
  }
  const newGraph = applyDelta(graph, {
    name,
    version: resolvedVersion,
    contentAddress: entry.contentAddress,
    deltaWeight: +1,
    packageManager: entry.packageManager,
  });
  return {
    success: true,
    message: `Installed '${name}@${resolvedVersion}' (${entry.packageManager}). Root: ${graphMerkleRoot(newGraph)}`,
    graph: newGraph,
    entry: newGraph.get(name)!,
  };
}

/** ace remove <name> — -1 Z-set delta. No-op if not installed. */
export function remove(graph: DependencyGraph, name: string): AceResult {
  const existing = graph.get(name);
  if (!existing || existing.weight <= 0)
    return { success: true, message: `Package '${name}' not installed (no-op).`, graph };
  const newGraph = applyDelta(graph, {
    name,
    version: existing.version,
    contentAddress: existing.contentAddress,
    deltaWeight: -1,
    packageManager: existing.packageManager,
  });
  return {
    success: true,
    message: `Removed '${name}@${existing.version}'. Root: ${graphMerkleRoot(newGraph)}`,
    graph: newGraph,
  };
}

/** ace verify <name> — Merkle root check. Can actually fail. */
export function verify(graph: DependencyGraph, name: string): AceResult {
  const installed = graph.get(name);
  if (!installed || installed.weight <= 0) return { success: false, message: `Package '${name}' not installed.` };
  const registry = registryLookup(name, installed.version);
  if (!registry)
    return {
      success: false,
      message: `Package '${name}@${installed.version}' not in registry (orphaned).`,
      entry: installed,
    };
  if (installed.contentAddress !== registry.contentAddress) {
    return {
      success: false,
      message: `VERIFICATION FAILED: '${name}@${installed.version}' content address mismatch. Installed: ${installed.contentAddress}, Registry: ${registry.contentAddress}`,
      entry: installed,
    };
  }
  return {
    success: true,
    message: `Verified '${name}@${installed.version}' (content address matches registry).`,
    entry: installed,
  };
}

/** ace list [pm] — enumerate installed packages. */
export function list(graph: DependencyGraph, filterPm?: PackageEntry["packageManager"]): AceResult {
  const entries = Array.from(graph.values())
    .filter((e) => e.weight > 0)
    .filter((e) => !filterPm || e.packageManager === filterPm)
    .sort((a, b) => stringCompare(a.name, b.name));
  if (entries.length === 0)
    return { success: true, message: `No packages installed${filterPm ? ` (${filterPm})` : ""}.`, entries: [] };
  const lines = entries.map((e) => `  ${e.name}@${e.version} [${e.packageManager}] ${e.contentAddress}`);
  return {
    success: true,
    message: `Installed (${entries.length}):\n${lines.join("\n")}\nRoot: ${graphMerkleRoot(graph)}`,
    entries,
  };
}

/** ace graph-root — return the Merkle root of the current graph. */
export function graphRoot(graph: DependencyGraph): AceResult {
  const count = Array.from(graph.values()).filter((e) => e.weight > 0).length;
  return { success: true, message: `Root: ${graphMerkleRoot(graph)} (${count} packages)` };
}

/** An empty dependency graph — the starting point for a new environment. */
export const emptyGraph: DependencyGraph = new Map();

// ── Error-BNN bridge (R4) ──────────────────────────────────────────────────────
// Each ACE CLI failure is a teaching error absorbed by the per-CLI DimensionalBnn.
// The BNN learns which error dimensions (schema, toolchain, constraint, etc.)
// are most common — and the robustness weight automatically downweights repeated
// failures from the same source (hostile/misconfigured registry).
//
// Usage:
//   const result = install(graph, "my-pkg");
//   if (!result.success) absorbAceError(result, "install", "my-pkg", emittedAt);
//   // aceBnn.states.get("toolchain")?.posterior.mu now reflects install failure rate

import { createDimensionalBnn, absorbError, type DimensionalBnn } from "../planning/error-bnn-bridge";
import { teachingError, type ErrorMirror } from "../protocol/error-envelope";
import { stringCompare } from "../collation/collation";

/** The per-CLI DimensionalBnn — one StudentTState per error dimension. */
export const aceBnn: DimensionalBnn = createDimensionalBnn();

/** Correlation id counter — monotonically increasing per process. */
let _corrSeq = 0;

/**
 * Absorb an ACE CLI failure as a teaching error into the per-CLI BNN.
 *
 * @param result - The failed AceResult.
 * @param command - The CLI command that failed ("install" | "verify" | "remove").
 * @param packageName - The package name that caused the failure.
 * @param emittedAt - The caller-provided event timestamp.
 * @param retractableBeliefId - Optional: the belief to retract (retraction path).
 */
export function absorbAceError(
  result: AceResult,
  command: string,
  packageName: string,
  emittedAt: string,
  retractableBeliefId?: string,
): void {
  if (result.success) return; // no-op for successes

  const corrId = `ace-${command}-${packageName}-${++_corrSeq}`;

  // Classify the error dimension from the failure message
  const msg = result.message;
  let dimension: ErrorMirror["dimension"] = "toolchain";
  if (msg.includes("not installed")) dimension = "constraint";
  else if (msg.includes("VERIFICATION FAILED") || msg.includes("content address mismatch")) dimension = "constraint";
  else if (msg.includes("not in registry") || msg.includes("orphaned")) dimension = "schema";
  else if (msg.includes("version")) dimension = "type";

  const mirror: ErrorMirror = {
    what: `ace ${command} ${packageName}`,
    why: msg,
    howToFix:
      command === "install"
        ? `Check registry: ace list | grep ${packageName}`
        : `Re-install: ace install ${packageName}`,
    dimension,
    severity: command === "verify" ? "error" : "warn",
    ...(retractableBeliefId ? { retractableBeliefId } : {}),
  };

  const envelope = teachingError(corrId, mirror, emittedAt);
  absorbError(aceBnn, envelope);
}

/**
 * ace bnn-status — print the current posterior (μ, σ) per error dimension.
 *
 * Shows which error dimensions the CLI has learned are most error-prone.
 * A high μ means many errors of that type have been absorbed.
 * A low robustness weight means the teacher was hostile or badly calibrated.
 *
 * Example output:
 *   ACE BNN Status (9 dimensions):
 *     schema      μ=0.0000 σ=1.0000 (prior — no errors observed)
 *     constraint  μ=0.3500 σ=0.8000 w=0.8500
 *     toolchain   μ=0.1200 σ=0.9500 w=0.9200
 */
export function bnnStatus(): AceResult {
  const dimensions = [
    "schema", "type", "range", "constraint",
    "auth", "transport", "toolchain", "calibration", "unknown",
  ] as const;
  const lines: string[] = [`ACE BNN Status (${dimensions.length} dimensions):`];
  for (const dim of dimensions) {
    const state = aceBnn.states.get(dim);
    const w = aceBnn.robustnessWeights.get(dim) ?? 1;
    if (!state) {
      lines.push(`  ${dim.padEnd(12)} (not initialised)`);
      continue;
    }
    const mu = state.posterior.mu;
    const sigma = Math.sqrt(state.posterior.sigma2);
    const isAtPrior = Math.abs(mu) < 1e-9 && Math.abs(sigma - 1) < 1e-9;
    const note = isAtPrior
      ? "(prior — no errors observed)"
      : `w=${w.toFixed(4)}`;
    lines.push(`  ${dim.padEnd(12)} μ=${mu.toFixed(4)} σ=${sigma.toFixed(4)} ${note}`);
  }
  return { success: true, message: lines.join("\n") };
}
