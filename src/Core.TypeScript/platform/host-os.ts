/**
 * host-os.ts — the ONE door through which Zeta learns which OS it is running on.
 *
 * WHY A MODULE FOR ONE READ. `process.platform` is read at 6 sites today purely to
 * answer "which OS am I", and each site invents its own type for the answer. Two of
 * those types are LIES by construction:
 *
 *   observe/workspace-port.ts:125   `return process.platform as Platform;`
 *       — an unchecked cast into `"darwin"|"linux"|"win32"|"zeta"`. On a FreeBSD host
 *         it returns the string "freebsd" typed as one of four things it is not.
 *   ace/setup-realizers/when.ts:58  unknown clause -> warn + `return false`
 *       — an unrecognised platform is silently a NON-MATCH rather than an unknown.
 *
 * Both are the same defect: a closed world asserted over an open one. This module
 * keeps the world open — an OS Zeta has no opinion about is `other`, which is a value
 * you can carry, print, and branch on honestly, instead of a misclassification.
 *
 * Anchors (Beacon). POSIX.1-2024 (IEEE Std 1003.1-2024) §2.1.6 models an option's
 * support as a VALUE, not as documentation. Hoare, "Null References: The Billion Dollar
 * Mistake" (QCon London 2009) — absence belongs in the type, not in a sentinel. Parnas
 * (1972), "On the Criteria To Be Used in Decomposing Systems Into Modules" — the design
 * decision most likely to change (which OS) is the one to hide behind an interface.
 */

/** The operating systems Zeta declares dispositions FOR. `zeta` is the Zeta-native
 *  substrate: named here before it exists so adding it is a column, not a rewrite. */
export type KnownOs = "darwin" | "linux" | "win32" | "zeta";

/** The OSes a capability row must currently cover. `zeta` is deliberately absent —
 *  requiring a disposition for a substrate nobody can build against yet would force
 *  exactly the invented-prose answer this whole design exists to remove. */
export const DECLARED_OSES: readonly KnownOs[] = ["darwin", "linux", "win32"];

/**
 * Which OS the host is. OPEN: an OS outside `KnownOs` is `other`, carrying the raw id.
 * Never narrow this by casting — that is the `workspace-port.ts:125` defect.
 */
export type HostOs = { readonly kind: "known"; readonly os: KnownOs } | { readonly kind: "other"; readonly id: string };

const KNOWN: ReadonlySet<string> = new Set<string>(["darwin", "linux", "win32", "zeta"]);

/** Classify a `process.platform`-shaped string. Total — every input has an answer. */
export function classifyOs(raw: string): HostOs {
  return KNOWN.has(raw) ? { kind: "known", os: raw as KnownOs } : { kind: "other", id: raw };
}

/** Printable id for either arm. Safe in a log line and in a refusal reason. */
export function osId(host: HostOs): string {
  return host.kind === "known" ? host.os : host.id;
}

/**
 * The live host. The ONLY ambient read in this module (§13 noninterference: one
 * declared door), so every caller downstream can be handed a `HostOs` instead of
 * reaching for `process.platform` itself.
 */
export function liveHostOs(read: () => string = () => process.platform): HostOs {
  return classifyOs(read());
}
