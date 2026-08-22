// The cluster's default StorageClass — ONE reading, shared by both oracles.
//
// WHY THIS IS ITS OWN MODULE
// --------------------------
// Two independent checks resolve a blank `storageClassName`:
// `rendered-storage-claims.ts` (which reads what a chart RENDERS) and
// `single-node-readiness.ts` (which reads what our own YAML DECLARES). They
// disagreed about the disk budget by 90 GiB for a week, and one of the reasons
// was that only the render side knew what a blank class resolves to; the
// readiness extractor DROPPED such a claim entirely, so a claim on the default
// class simply did not exist for it.
//
// Two oracles are worth having only while they can be compared. If each one
// carried its own copy of "the default is zeta-local-path", a change to the
// nixos module would move one and not the other, and the disagreement would
// stop being informative — it would just be stale. So the reading lives here
// once and both import it, which makes their agreement on this term structural
// rather than a coincidence that has to be re-checked.
//
// The reading is deliberately NOT a constant: it comes from the annotation in
// the nixos module that actually creates the StorageClass, so renaming the
// class there moves both checks with it.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

export const DEFAULT_STORAGE_CLASS_SOURCE = "full-ai-cluster/nixos/modules/local-storage.nix";

function readIfPresent(abs: string): string | null {
  try {
    return readFileSync(abs, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/**
 * The name annotated `storageclass.kubernetes.io/is-default-class: "true"`, or
 * `null` when the tree does not declare one.
 *
 * AN ABSENT `storageClassName` IS NOT "NO DISK" AND IS NOT "longhorn". It is
 * whatever class the cluster marks default, and on this cluster that is
 * `zeta-local-path` — `rancher.io/local-path`, a hostPath directory with
 * `reclaimPolicy: Delete`, declared in the nixos module above. Longhorn ships
 * `defaultClass: false` in `full-ai-cluster`, so nothing falls back to the
 * replicated class by accident.
 *
 * That distinction is the whole reason storageClass is compared and not just
 * size: a claim that declares `longhorn` and renders blank does not merely
 * land on a different disk, it lands on a class whose reclaim policy DELETES
 * the data. Returning `null` rather than guessing keeps an unknown unknown —
 * a comparison against an unknown default is refused, not resolved favourably.
 */
export function clusterDefaultStorageClass(repoRoot = REPO_ROOT): string | null {
  const text = readIfPresent(resolve(repoRoot, DEFAULT_STORAGE_CLASS_SOURCE));
  if (text === null) return null;
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (!/storageclass\.kubernetes\.io\/is-default-class:\s*"true"/.test(lines[index] ?? "")) continue;
    for (let back = index; back >= 0 && index - back < 12; back -= 1) {
      const match = /^\s*name:\s*(\S+)\s*$/.exec(lines[back] ?? "");
      if (match?.[1] !== undefined) return match[1];
    }
  }
  return null;
}

/** `""` -> the cluster default, or `null` when there is no default to fall back to. */
export function effectiveStorageClass(declared: string, clusterDefault: string | null): string | null {
  return declared === "" ? clusterDefault : declared;
}
