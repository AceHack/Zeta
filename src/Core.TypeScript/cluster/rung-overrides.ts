// src/Core.TypeScript/cluster/rung-overrides.ts
//
// PER-RUNG FIELD OVERRIDES — the second override point, and the reason it exists.
//
// `applyResourceProfile` writes exactly two fields per claim:
// `<requestsField>.cpu` and `<requestsField>.memory`. Until this file, that was
// the ONLY way the dev lane could differ from the committed `metal` tree. So an
// Application whose dev/metal difference is anything other than a cpu or memory
// number had no expressible dev form, and the only remaining move was to
// exclude it from the lane entirely -- which is how twelve Applications ended up
// never reaching a CI cluster at all.
//
// Aaron 2026-09-04, on finding that out:
//
//   "i'd like to include all those others dev included if possible too, this is
//    what i want to know what is CI tested, metal is just for hardware and
//    hopeuflly they just diverge between dev and metal is disk, cpu, memory,
//    etc... request maybe replica counts but i'd love to try to test everyting
//    in CI"
//
// and, on the GPU specifically: "yes on real metal we can add any gpu selectors".
//
// That is the design in his words: **dev and metal differ in SIZING and in what
// the substrate physically has, never in whether the Application exists.** A
// GitHub runner has no GPU; the 16-core box does. That is a substrate fact, and
// it should cost one override rather than a whole Application's CI coverage.
//
// ── IT WRITES THE STAGED TREE, NEVER THE COMMITTED ONE ────────────────────────
// Same contract as the rung: `lane-tree-source` stages a COPY of
// `full-ai-cluster/k8s`, applies the rung to it, serves it from an in-cluster
// git server, and throws the copy away. Nothing here touches what a maintainer
// committed, so the hardware box keeps `metal` unchanged.
//
// ── EVERY OVERRIDE MUST DO SOMETHING, AND THAT IS ENFORCED ────────────────────
// An override that changes nothing is the vacuity class wearing a config file:
// it reads as coverage and buys none. So `applyRungOverrides` REFUSES an
// override that produces zero edits -- a `set` whose value the tree already has,
// or a `delete` of a path that is not there. Both mean the override has drifted
// from the manifest it claims to patch, and both are silent by default.

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml, parseAllDocuments } from "yaml";

import { parseFieldPath } from "./storage-profiles.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
export const DEFAULT_OVERRIDES_PATH = "full-ai-cluster/k8s/rung-overrides.yaml";

/**
 * The roster's own `apiVersion`/`kind`. The file lives under a manifest root
 * kubeconform walks, so it carries a kind (an unknown one is skipped; a missing
 * one is an error) -- and the loader REFUSES any other pair, so a stray
 * Kubernetes manifest at this path cannot be read as an override roster.
 */
export const OVERRIDES_API_VERSION = "cluster.zeta.io/v1";
export const OVERRIDES_KIND = "RungOverrides";

export interface RungOverride {
  readonly id: string;
  readonly path: string;
  readonly docIndex: number;
  /** The rung this override applies to. Any other rung leaves the tree alone. */
  readonly rung: string;
  /** WHY the substrate needs this. Required, and checked for length. */
  readonly reason: string;
  /** The condition under which this override should be deleted. Required. */
  readonly liftsWhen: string;
  /** Dotted field path -> value to set. */
  readonly set: Readonly<Record<string, unknown>>;
  /** Dotted field paths to remove entirely. */
  readonly remove: readonly string[];
}

export interface OverrideEdit {
  readonly id: string;
  readonly path: string;
  readonly field: string;
  readonly from: string;
  readonly to: string;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label}: expected a non-empty string`);
  }
  return value;
}

export function loadRungOverrides(
  knownRungs: readonly string[],
  repoRoot = REPO_ROOT,
  path = DEFAULT_OVERRIDES_PATH,
): readonly RungOverride[] {
  // YAML since 2026-09-23 (was JSON): the file is hand-edited and its reasons
  // are long prose. `parse` THROWS on a multi-document file rather than quietly
  // reading the first document, which is the fail-closed direction.
  const raw: unknown = parseYaml(readFileSync(join(repoRoot, path), "utf8"));
  if (typeof raw !== "object" || raw === null) throw new Error(`${path}: expected a mapping`);
  const header = raw as { apiVersion?: unknown; kind?: unknown };
  if (header.apiVersion !== OVERRIDES_API_VERSION || header.kind !== OVERRIDES_KIND) {
    throw new Error(
      `${path}: expected apiVersion ${OVERRIDES_API_VERSION} / kind ${OVERRIDES_KIND}, ` +
        `found ${String(header.apiVersion)} / ${String(header.kind)}`,
    );
  }
  const list = (raw as { overrides?: unknown }).overrides;
  if (!Array.isArray(list)) throw new Error(`${path}: "overrides" must be an array`);

  const seen = new Set<string>();
  return list.map((entry) => {
    const o = entry as Record<string, unknown>;
    const id = requireString(o.id, `${path}: override id`);
    if (seen.has(id)) throw new Error(`${path}: duplicate override id ${id}`);
    seen.add(id);
    const rung = requireString(o.rung, `${path}: ${id}.rung`);
    // An override naming a rung the catalogue does not have is DEAD -- it would
    // never fire and nothing would say so. Refuse it at load.
    if (!knownRungs.includes(rung)) {
      throw new Error(
        `${path}: ${id} names rung "${rung}", which is not one of ${knownRungs.join(", ")} — ` +
          "an override for a rung that does not exist can never fire and would read as coverage",
      );
    }
    const reason = requireString(o.reason, `${path}: ${id}.reason`);
    const liftsWhen = requireString(o.liftsWhen, `${path}: ${id}.liftsWhen`);
    if (reason.trim().length < 40) {
      throw new Error(`${path}: ${id}.reason is too short to name a substrate fact`);
    }
    const set = (o.set ?? {}) as Record<string, unknown>;
    const remove = (o.remove ?? []) as string[];
    if (Object.keys(set).length === 0 && remove.length === 0) {
      throw new Error(`${path}: ${id} sets nothing and removes nothing`);
    }
    return {
      id,
      path: requireString(o.path, `${path}: ${id}.path`),
      docIndex: typeof o.docIndex === "number" ? o.docIndex : 0,
      rung,
      reason,
      liftsWhen,
      set,
      remove,
    };
  });
}

/**
 * Apply every override for `profile` to the tree at `repoRoot`.
 *
 * THROWS when an override produces no edits. See the header: a no-op override
 * is indistinguishable from an applied one by exit code, and that is exactly
 * the failure this repository is built to refuse.
 */
export function applyRungOverrides(
  overrides: readonly RungOverride[],
  profile: string,
  repoRoot = REPO_ROOT,
  write = true,
): readonly OverrideEdit[] {
  const edits: OverrideEdit[] = [];

  for (const override of overrides) {
    if (override.rung !== profile) continue;

    const abs = resolve(repoRoot, override.path);
    const source = readFileSync(abs, "utf8");
    const docs = parseAllDocuments(source);
    const doc = docs[override.docIndex];
    if (doc === undefined) {
      throw new Error(`${override.id}: ${override.path} has no document at index ${String(override.docIndex)}`);
    }

    const before = edits.length;

    for (const [field, want] of Object.entries(override.set)) {
      const fieldPath = parseFieldPath(field);
      const current: unknown = doc.getIn(fieldPath, false);
      if (current === want) continue;
      doc.setIn(fieldPath, want);
      edits.push({
        id: override.id,
        path: override.path,
        field,
        from: current === undefined ? "(absent)" : JSON.stringify(JSON.parse(JSON.stringify(current))),
        to: typeof want === "object" ? JSON.stringify(want) : String(want),
      });
    }

    for (const field of override.remove) {
      const fieldPath = parseFieldPath(field);
      if (!doc.hasIn(fieldPath)) continue;
      const current: unknown = doc.getIn(fieldPath, false);
      doc.deleteIn(fieldPath);
      edits.push({
        id: override.id,
        path: override.path,
        field,
        from: current === undefined ? "(present)" : String(current),
        to: "(removed)",
      });
    }

    if (edits.length === before) {
      throw new Error(
        `${override.id}: produced NO edits against ${override.path} at rung "${profile}". ` +
          "Either the tree already carries every value this override sets, or it removes paths that are " +
          "not there. Both mean the override has drifted from the manifest it claims to patch, and a " +
          "no-op override reads as coverage while buying none. Fix it or delete it.",
      );
    }

    if (write) writeFileSync(abs, docs.map((d) => String(d)).join(""), "utf8");
  }

  return edits;
}
