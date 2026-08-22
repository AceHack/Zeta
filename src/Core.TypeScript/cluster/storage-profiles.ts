// Storage size profiles — the per-deployment ladder for `longhorn` PVC capacity.
//
// WHY THIS EXISTS
// ---------------
// Aaron 2026-08-20: "until we have some other formatting we should try to take
// up all storage with PVCs, we also need a minimal size. We should not over
// provision. Some of our boxes are NASs some are regular PCs. I think if we can
// get the minimum down to 200-300 gb it should be small enough."
//
// Four constraints that pull against each other:
//   (a) never declare more capacity than the node's real disk       HARD
//   (b) a minimum profile that fits a 200-300 GiB box
//   (c) on a bigger box, use the storage rather than leaving it idle
//   (d) heterogeneous hardware, so the choice is per-deployment
//
// WHAT THIS IS NOT: it is not elasticity, and the shape of the file is the
// admission. Kubernetes can GROW a PVC (with allowVolumeExpansion plus an
// online filesystem grow) but it cannot SHRINK one at all — the only way down
// is destroy and restore from backup. So "size it for the big box and shrink
// later" is a one-way door: a volume provisioned at 200Gi can never be moved
// onto a 300 GiB node. That is why (c) is served by a LADDER chosen once at
// bring-up rather than by a controller that resizes on the fly. Faking
// elasticity here would produce exactly the failure the whole readiness
// auditor exists to prevent: a number that looks like a guarantee and is not.
//
// HOW IT COMPOSES WITH THE CAPACITY GATE
// --------------------------------------
// `single-node-readiness.ts` already refuses when no ClusterNode registration
// carries measurable hardware, and convicts when declared capacity exceeds
// every block device on the smallest measured node. This module supplies the
// DECLARED side of that comparison for the ACTIVE profile, and it does so from
// a catalogue rather than from the auditor's YAML extractor, because the
// extractor is measurably blind in both directions:
//
//   under-count  mimir renders 3 ingester pods and 3 store-gateway pods from
//                chart defaults our YAML never mentions (zone-aware
//                replication over 3 zones). +200 GiB the extractor cannot see.
//   over-count   the nearest-enclosing-replicas heuristic gives redis MASTER
//                the neighbouring `replica.replicaCount: 2`. -10 GiB that
//                does not exist.
//
// So the catalogue is a SECOND ORACLE, not a restatement: it carries the pod
// count with its provenance, the extractor derives one from the YAML, and
// `crossCheckClaims` below makes their disagreement a finding instead of a
// silent choice between two numbers. Neither side can go stale unnoticed —
// a claim with no catalogue row fails, and a catalogue row matching no claim
// fails.
//
// DECLARED vs SCHEDULED-AT-BRING-UP
// ---------------------------------
// Some declared capacity provisions nothing on a fresh sync (a manual-sync
// Application, or a PVC manifest no Application reaches). That is REPORTED,
// never DISCOUNTED. Longhorn's StorageClass is volumeBindingMode: Immediate
// (hardcoded in longhorn-1.7.2/templates/storageclass.yaml), so an applied PVC
// provisions its replica with zero consuming pods; what keeps the capacity off
// the disk is the Application never being applied, and that is one
// `argocd app sync` away from being false. Convicting on the bring-up subset
// would be a gate that passes today and fails the first time someone ran it.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseAllDocuments, isCollection } from "yaml";
import { stringCompare } from "../collation/collation.ts";
import { quantityToGib } from "./single-node-readiness.ts";
import { DEFAULT_ROOT_DEV_CATALOG } from "./ports.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

export const DEFAULT_CATALOGUE_PATH = "full-ai-cluster/k8s/storage-profiles.json";

/** Where a claim's pod count comes from — see the catalogue's $comment_claims. */
export type PodsSource = "manifest" | "chart-default" | "singleton";

export interface ProfileClaim {
  readonly id: string;
  /** Repo-relative manifest path. */
  readonly path: string;
  /** Index of the YAML document inside `path` (multi-doc files are common). */
  readonly docIndex: number;
  /** Dotted path of the storageClass/storageClassName scalar — the extractor's coordinate. */
  readonly storageClassField: string;
  /** Dotted path of the capacity scalar this profile writes. */
  readonly sizeField: string;
  /** Dotted path of the replica scalar, or null when the pod count is not ours to set. */
  readonly podsField: string | null;
  readonly podsSource: PodsSource;
  /** Required (non-empty) unless podsSource is "manifest". */
  readonly podsEvidence: string;
  readonly scheduledAtBringUp: boolean;
  readonly bringUpNote: string;
  readonly consequence: string;
  readonly sizes: Readonly<Record<string, string>>;
  readonly pods: Readonly<Record<string, number>>;
  /**
   * NON-CAPACITY scalars that GOVERN the capacity — dotted field path -> value
   * per profile. Written and verified exactly like `sizes`.
   *
   * A number without its governor is not a size. `prometheus: 100Gi` means
   * nothing without a retention bound beside it: cut the volume, leave the
   * governor where it was, and you have not made the footprint smaller — you
   * have made an eviction loop. Before this field existed the catalogue could
   * only write that requirement in prose; its own prometheus row said the
   * retention cut "is NOT rewritten by --apply" and asked whoever selected the
   * profile to remember. An instruction to remember is the vacuity class: it
   * reads like a guard and constrains nothing. Governors move with the profile
   * or the profile's headline number is not the footprint.
   *
   * Empty for most claims, and empty is a real answer rather than an omission:
   * a volume with no retention mechanism at all (weaviate, cockroachdb, the
   * agent-memory store) refuses writes when it fills and there is no scalar to
   * turn. Those rows say so in `consequence`.
   */
  readonly governors: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Required (non-empty) whenever `governors` is non-empty — where each value comes from. */
  readonly governorEvidence: string;
  /**
   * WHERE THIS ROW'S PVC SHOWS UP IN A RENDER — the coordinate
   * `rendered-storage-claims.ts` needs to ask the chart whether the declared
   * number reaches a PersistentVolumeClaim at all.
   *
   * `renderedApp` is the Application identity (`full-ai-cluster/mimir`) and
   * `renderedPvcPattern` is an anchored regular expression over the rendered
   * claim's name — `<template>/<workload>` for a volumeClaimTemplate, the
   * object name for a standalone PVC. A pattern rather than a literal because
   * one declared claim legitimately renders as SEVERAL PVCs: mimir's ingester
   * is three zone StatefulSets, so `^storage/mimir-ingester-zone-[a-c]$`
   * matches the three objects that one row prices.
   *
   * Both are REQUIRED. A row with no rendered coordinate is a row nothing can
   * check, and an uncheckable row that still contributes GiB to a total is the
   * exact shape this catalogue exists to refuse.
   */
  readonly renderedApp: string;
  readonly renderedPvcPattern: string;
}

export interface ProfileCatalogue {
  /** Smallest first. The order is checked, not decorative — see loadCatalogue. */
  readonly profiles: readonly string[];
  readonly claims: readonly ProfileClaim[];
}

export interface ProfileFinding {
  readonly claimId: string;
  readonly problem: string;
}

// ---------------------------------------------------------------------------
// Dotted-path handling. `spec.volumeClaimTemplates[0].spec.resources.requests.storage`
// -> ["spec","volumeClaimTemplates",0,"spec","resources","requests","storage"]
// ---------------------------------------------------------------------------

export function parseFieldPath(field: string): readonly (string | number)[] {
  const out: (string | number)[] = [];
  for (const segment of field.split(".")) {
    const bracket = segment.indexOf("[");
    if (bracket >= 0) {
      const head = segment.slice(0, bracket);
      if (head.length > 0) out.push(head);
      const rest = segment.slice(bracket);
      // Ordinal digits only; anything else is a malformed path and must throw
      // rather than silently address the wrong node.
      let consumed = 0;
      for (const match of rest.matchAll(/\[(\d+)\]/g)) {
        out.push(Number(match[1]));
        consumed += match[0].length;
      }
      if (consumed !== rest.length) throw new Error(`malformed field path segment: ${segment}`);
      continue;
    }
    if (segment.length === 0) throw new Error(`malformed field path (empty segment): ${field}`);
    out.push(segment);
  }
  if (out.length === 0) throw new Error(`malformed field path (empty): ${field}`);
  return out;
}

// ---------------------------------------------------------------------------
// Loading + validation
// ---------------------------------------------------------------------------

/**
 * A pattern that does not compile addresses NOTHING, and a row whose selector
 * matches nothing reads exactly like a row whose chart renders nothing. Reject
 * it at load rather than let a typo become a finding about the cluster.
 */
function requireRegex(value: unknown, label: string): string {
  const text = requireString(value, label);
  try {
    void new RegExp(text);
  } catch (error) {
    throw new Error(`${label} is not a valid regular expression: ${String(error)}`);
  }
  return text;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label}: expected a string`);
  return value;
}

/**
 * Read and VALIDATE the catalogue. Every refusal below exists because its
 * absence would let the ladder mean nothing:
 *
 *  - a size that is not a Kubernetes quantity  -> the arithmetic is fiction
 *  - a missing size/pods entry for a profile   -> a profile with holes in it
 *    silently totals less than it costs
 *  - non-monotone sizes along `profiles`       -> "minimal" could be the
 *    largest profile for some app and nobody would notice
 *  - podsSource != manifest with no evidence   -> an unsourced pod count is
 *    the exact vacuity this file was written to remove; the mimir under-count
 *    happened because nothing forced the chart default to be written down
 */
export function loadCatalogue(path = DEFAULT_CATALOGUE_PATH, repoRoot = REPO_ROOT): ProfileCatalogue {
  const abs = resolve(repoRoot, path);
  const parsed = JSON.parse(readFileSync(abs, "utf8")) as { profiles?: unknown; claims?: unknown };
  const profiles = parsed.profiles;
  if (!Array.isArray(profiles) || profiles.length === 0) {
    throw new Error(`${path}: "profiles" must be a non-empty array, smallest first`);
  }
  const names = profiles.map((entry, index) => requireString(entry, `${path}: profiles[${index}]`));
  if (new Set(names).size !== names.length) throw new Error(`${path}: duplicate profile name`);
  const firstProfile = names[0] ?? "";

  const rawClaims = parsed.claims;
  if (!Array.isArray(rawClaims) || rawClaims.length === 0) {
    throw new Error(`${path}: "claims" must be a non-empty array`);
  }
  const claims: ProfileClaim[] = [];
  const seen = new Set<string>();
  for (const raw of rawClaims as readonly Record<string, unknown>[]) {
    const id = requireString(raw.id, `${path}: claim id`);
    if (seen.has(id)) throw new Error(`${path}: duplicate claim id ${id}`);
    seen.add(id);
    const podsSource = requireString(raw.podsSource, `${path}: ${id}.podsSource`);
    if (podsSource !== "manifest" && podsSource !== "chart-default" && podsSource !== "singleton") {
      throw new Error(`${path}: ${id}.podsSource must be manifest | chart-default | singleton`);
    }
    const podsEvidence = typeof raw.podsEvidence === "string" ? raw.podsEvidence : "";
    if (podsSource !== "manifest" && podsEvidence.trim().length === 0) {
      throw new Error(
        `${path}: ${id} declares podsSource=${podsSource} with no podsEvidence — a pod count our own YAML ` +
          `does not carry must cite where it comes from, or it is an assertion wearing a number`,
      );
    }
    const rawPodsField = raw.podsField;
    if (rawPodsField !== null && typeof rawPodsField !== "string") {
      throw new Error(`${path}: ${id}.podsField must be a string or null`);
    }
    const sizes = raw.sizes as Record<string, unknown> | undefined;
    const pods = raw.pods as Record<string, unknown> | undefined;
    if (typeof sizes !== "object" || sizes === null) throw new Error(`${path}: ${id}.sizes missing`);
    if (typeof pods !== "object" || pods === null) throw new Error(`${path}: ${id}.pods missing`);
    const sizeByProfile: Record<string, string> = {};
    const podsByProfile: Record<string, number> = {};
    let previousGib = -Infinity;
    for (const name of names) {
      const size = sizes[name];
      if (typeof size !== "string") throw new Error(`${path}: ${id}.sizes.${name} missing`);
      const gib = quantityToGib(size);
      if (gib === null || gib <= 0)
        throw new Error(`${path}: ${id}.sizes.${name}="${size}" is not a positive quantity`);
      if (gib < previousGib) {
        throw new Error(
          `${path}: ${id}.sizes is not monotonically non-decreasing along profiles ` +
            `(${name}=${size} is smaller than the preceding profile) — the ladder must climb`,
        );
      }
      previousGib = gib;
      const podCount = pods[name];
      if (typeof podCount !== "number" || !Number.isInteger(podCount) || podCount < 1) {
        throw new Error(`${path}: ${id}.pods.${name} must be a positive integer`);
      }
      if (rawPodsField === null && podCount !== pods[firstProfile]) {
        throw new Error(
          `${path}: ${id} varies its pod count across profiles but has no podsField to write it to — ` +
            `the profile would total a pod count the manifests never get`,
        );
      }
      sizeByProfile[name] = size;
      podsByProfile[name] = podCount;
    }
    // Governors. A governor with a HOLE is worse than no governor at all: the
    // manifest would keep whatever the previously-applied profile wrote, so the
    // volume would be sized by one rung and bounded by another and nothing
    // would say so. Every declared governor therefore has to carry a value for
    // every profile, and the whole block has to cite where those values come
    // from — the same refusal `podsEvidence` makes, for the same reason.
    const rawGovernors = raw.governors;
    const governors: Record<string, Record<string, string>> = {};
    if (rawGovernors !== undefined) {
      if (typeof rawGovernors !== "object" || rawGovernors === null || Array.isArray(rawGovernors)) {
        throw new Error(`${path}: ${id}.governors must be an object of field -> { profile: value }`);
      }
      for (const [field, byProfile] of Object.entries(rawGovernors as Record<string, unknown>)) {
        parseFieldPath(field); // throws on a malformed coordinate rather than addressing the wrong node
        if (typeof byProfile !== "object" || byProfile === null || Array.isArray(byProfile)) {
          throw new Error(`${path}: ${id}.governors["${field}"] must be an object of profile -> value`);
        }
        const values: Record<string, string> = {};
        for (const name of names) {
          const value = (byProfile as Record<string, unknown>)[name];
          if (typeof value !== "string" || value.length === 0) {
            throw new Error(
              `${path}: ${id}.governors["${field}"].${name} missing — a governor with a hole leaves the manifest ` +
                `bounded by whichever profile was applied last, which is drift that nothing reports`,
            );
          }
          values[name] = value;
        }
        governors[field] = values;
      }
    }
    const governorEvidence = typeof raw.governorEvidence === "string" ? raw.governorEvidence : "";
    if (Object.keys(governors).length > 0 && governorEvidence.trim().length === 0) {
      throw new Error(
        `${path}: ${id} declares governors with no governorEvidence — a bound with no stated origin is a number ` +
          `somebody picked, and the catalogue cannot tell that from a requirement`,
      );
    }

    claims.push({
      id,
      path: requireString(raw.path, `${path}: ${id}.path`),
      docIndex: typeof raw.docIndex === "number" ? raw.docIndex : 0,
      storageClassField: requireString(raw.storageClassField, `${path}: ${id}.storageClassField`),
      sizeField: requireString(raw.sizeField, `${path}: ${id}.sizeField`),
      podsField: rawPodsField,
      podsSource,
      podsEvidence,
      scheduledAtBringUp: raw.scheduledAtBringUp === true,
      bringUpNote: typeof raw.bringUpNote === "string" ? raw.bringUpNote : "",
      consequence: requireString(raw.consequence, `${path}: ${id}.consequence`),
      sizes: sizeByProfile,
      pods: podsByProfile,
      governors,
      governorEvidence,
      renderedApp: requireString(raw.renderedApp, `${path}: ${id}.renderedApp`),
      renderedPvcPattern: requireRegex(raw.renderedPvcPattern, `${path}: ${id}.renderedPvcPattern`),
    });
  }
  return { profiles: names, claims: [...claims].sort((a, b) => stringCompare(a.id, b.id)) };
}

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

/** GiB a claim costs under `profile`: declared size x pod count. */
export function claimGib(claim: ProfileClaim, profile: string): number {
  const size = claim.sizes[profile];
  const pods = claim.pods[profile];
  if (size === undefined || pods === undefined) throw new Error(`${claim.id}: no entry for profile "${profile}"`);
  const gib = quantityToGib(size);
  if (gib === null) throw new Error(`${claim.id}: unparsable size ${size}`);
  return gib * pods;
}

/** Total DECLARED GiB under `profile` — the number the capacity gate convicts on. */
export function profileTotalGib(catalogue: ProfileCatalogue, profile: string): number {
  return catalogue.claims.reduce((sum, claim) => sum + claimGib(claim, profile), 0);
}

/**
 * Total GiB that actually provisions on a FRESH sync. Strictly a report: see
 * the header on why the gate does not convict on it.
 */
export function profileBringUpGib(catalogue: ProfileCatalogue, profile: string): number {
  return catalogue.claims
    .filter((claim) => claim.scheduledAtBringUp)
    .reduce((sum, claim) => sum + claimGib(claim, profile), 0);
}

// ---------------------------------------------------------------------------
// Manifest verification — the catalogue is only worth anything if the YAML agrees
// ---------------------------------------------------------------------------

interface ManifestScalar {
  readonly found: boolean;
  readonly value: unknown;
}

function readFieldAt(repoRoot: string, path: string, docIndex: number, field: string): ManifestScalar {
  const abs = resolve(repoRoot, path);
  if (!existsSync(abs)) return { found: false, value: null };
  const docs = parseAllDocuments(readFileSync(abs, "utf8"));
  const doc = docs[docIndex];
  if (doc === undefined || !isCollection(doc.contents)) return { found: false, value: null };
  const value: unknown = doc.getIn(parseFieldPath(field), false);
  return value === undefined ? { found: false, value: null } : { found: true, value };
}

function readField(repoRoot: string, claim: ProfileClaim, field: string): ManifestScalar {
  return readFieldAt(repoRoot, claim.path, claim.docIndex, field);
}

/**
 * Does every manifest carry exactly what `profile` says it should?
 *
 * Both halves matter. Checking only the size would let a profile promise a pod
 * count the cluster never gets (the whole reason mimir was 200 GiB out), and
 * checking only the pods would let the ladder's headline number drift from the
 * YAML that produces it.
 */
export function verifyProfileApplied(
  catalogue: ProfileCatalogue,
  profile: string,
  repoRoot = REPO_ROOT,
): readonly ProfileFinding[] {
  const findings: ProfileFinding[] = [];
  for (const claim of catalogue.claims) {
    const wantSize = claim.sizes[profile];
    if (wantSize === undefined) {
      findings.push({ claimId: claim.id, problem: `no size declared for profile "${profile}"` });
      continue;
    }
    const storageClass = readField(repoRoot, claim, claim.storageClassField);
    if (!storageClass.found) {
      findings.push({
        claimId: claim.id,
        problem:
          `${claim.path} doc ${String(claim.docIndex)} has no value at ${claim.storageClassField} — ` +
          `the catalogue row points at a coordinate that no longer exists`,
      });
      continue;
    }
    const size = readField(repoRoot, claim, claim.sizeField);
    if (!size.found) {
      findings.push({
        claimId: claim.id,
        problem: `${claim.path} doc ${String(claim.docIndex)} has no value at ${claim.sizeField}`,
      });
    } else if (size.value !== wantSize) {
      findings.push({
        claimId: claim.id,
        problem:
          `${claim.path} declares ${String(size.value)} at ${claim.sizeField}, ` +
          `but profile "${profile}" says ${wantSize}`,
      });
    }
    for (const [field, byProfile] of [...Object.entries(claim.governors)].sort((a, b) => stringCompare(a[0], b[0]))) {
      const wantGovernor = byProfile[profile];
      if (wantGovernor === undefined) continue;
      const governor = readField(repoRoot, claim, field);
      if (!governor.found) {
        findings.push({
          claimId: claim.id,
          problem:
            `${claim.path} doc ${String(claim.docIndex)} has no value at ${field} — the profile declares a ` +
            `governor for a coordinate the manifest does not carry, so the size it bounds is ungoverned`,
        });
      } else if (governor.value !== wantGovernor) {
        findings.push({
          claimId: claim.id,
          problem:
            `${claim.path} declares ${String(governor.value)} at ${field}, ` +
            `but profile "${profile}" says ${wantGovernor}`,
        });
      }
    }
    if (claim.podsField === null) continue;
    const wantPods = claim.pods[profile];
    const pods = readField(repoRoot, claim, claim.podsField);
    if (!pods.found) {
      findings.push({
        claimId: claim.id,
        problem: `${claim.path} doc ${String(claim.docIndex)} has no value at ${claim.podsField}`,
      });
    } else if (pods.value !== wantPods) {
      findings.push({
        claimId: claim.id,
        problem:
          `${claim.path} declares ${String(pods.value)} pods at ${claim.podsField}, ` +
          `but profile "${profile}" says ${String(wantPods)}`,
      });
    }
  }
  return findings;
}

/** Minimal shape of a `single-node-readiness` StorageClaim, so this module does not depend on its whole surface. */
export interface ExtractedClaim {
  readonly path: string;
  readonly field: string;
  readonly storageClass: string;
  readonly gibibytes: number;
  readonly replicas: number;
}

/**
 * Cross-check the catalogue against the auditor's INDEPENDENT extraction.
 *
 * Three findings, and the third is the point of the whole module:
 *   1. an extracted claim with no catalogue row  -> the ladder does not cover
 *      the tree, so its total understates the disk
 *   2. a catalogue row matching no extracted claim -> the row is stale and its
 *      GiB are being counted against nothing
 *   3. a POD COUNT disagreement on a row whose podsSource is "manifest" -> the
 *      two oracles read our own YAML differently and one of them is wrong
 *
 * Rows with podsSource chart-default / singleton are deliberately NOT
 * cross-checked on pods: the extractor provably cannot see those counts (that
 * is why the field exists), so asserting agreement would be asserting that a
 * blind reader agrees with a sighted one. Their evidence string is the check,
 * and `loadCatalogue` refuses an empty one.
 */
export function crossCheckClaims(
  catalogue: ProfileCatalogue,
  extracted: readonly ExtractedClaim[],
  storageClass: string,
  profile: string,
): readonly ProfileFinding[] {
  const byCoordinate = new Map<string, ProfileClaim>();
  for (const claim of catalogue.claims) byCoordinate.set(`${claim.path} ${claim.storageClassField}`, claim);
  const matched = new Set<string>();
  const findings: ProfileFinding[] = [];
  for (const claim of extracted) {
    if (claim.storageClass !== storageClass) continue;
    const key = `${claim.path} ${claim.field}`;
    const row = byCoordinate.get(key);
    if (row === undefined) {
      findings.push({
        claimId: `${claim.path} (${claim.field})`,
        problem:
          `a "${storageClass}" claim of ${claim.gibibytes.toFixed(0)}Gi is declared in the tree with no row in ` +
          `the storage-profile catalogue — the profile total does not include it, so every profile understates the disk`,
      });
      continue;
    }
    matched.add(row.id);
    if (row.podsSource !== "manifest") continue;
    const declared = row.pods[profile];
    if (declared !== undefined && claim.replicas !== declared) {
      findings.push({
        claimId: row.id,
        problem:
          `pod-count disagreement on a podsSource=manifest row: the readiness extractor derives ` +
          `${String(claim.replicas)} from ${claim.path}, profile "${profile}" declares ${String(declared)}. ` +
          `One of the two is wrong`,
      });
    }
  }
  for (const claim of catalogue.claims) {
    if (matched.has(claim.id)) continue;
    findings.push({
      claimId: claim.id,
      problem:
        `catalogue row matches no "${storageClass}" claim at ${claim.path} (${claim.storageClassField}) — ` +
        `stale row, and its capacity is being counted against a PVC that is not there`,
    });
  }
  return [...findings].sort((a, b) => stringCompare(a.claimId, b.claimId) || stringCompare(a.problem, b.problem));
}

// ---------------------------------------------------------------------------
// Applying a profile to the manifests
// ---------------------------------------------------------------------------

export interface ApplyEdit {
  readonly path: string;
  readonly field: string;
  readonly from: string;
  readonly to: string;
}

/**
 * Write `profile`'s sizes and pod counts into the manifests, in place.
 *
 * Uses the YAML document API rather than a text rewrite so comments, ordering
 * and anchors survive — these files are heavily commented and the comments
 * carry the reasons. Only the two scalars named by the catalogue row are
 * touched; a row whose coordinate is missing is REFUSED rather than created,
 * because inventing a key in someone else's values block is how a silent
 * misconfiguration ships.
 */
export function applyProfile(
  catalogue: ProfileCatalogue,
  profile: string,
  repoRoot = REPO_ROOT,
  write = true,
): readonly ApplyEdit[] {
  const edits: ApplyEdit[] = [];
  const byPath = new Map<string, ProfileClaim[]>();
  for (const claim of catalogue.claims) {
    const bucket = byPath.get(claim.path);
    if (bucket === undefined) byPath.set(claim.path, [claim]);
    else bucket.push(claim);
  }
  for (const [path, claims] of [...byPath.entries()].sort((a, b) => stringCompare(a[0], b[0]))) {
    const abs = resolve(repoRoot, path);
    // READ, then interpret ENOENT -- rather than existsSync() then read, which
    // CodeQL flagged HIGH as a check-then-use race: the manifest can vanish
    // between the check and the read, and the failure would then surface as a
    // raw ENOENT rather than as this catalogue's own refusal. Reading first
    // removes the window entirely instead of narrowing it, and the refusal is
    // unchanged -- deleting a manifest the catalogue claims is still an error,
    // it is simply now detected by the operation that actually depends on it.
    let source: string;
    try {
      source = readFileSync(abs, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`${path}: catalogue references a manifest that does not exist`);
      }
      throw err;
    }
    const docs = parseAllDocuments(source);
    let touched = false;
    for (const claim of claims) {
      const doc = docs[claim.docIndex];
      if (doc === undefined) throw new Error(`${claim.id}: ${path} has no document at index ${String(claim.docIndex)}`);
      const wantSize = claim.sizes[profile];
      if (wantSize === undefined) throw new Error(`${claim.id}: no size for profile "${profile}"`);
      const sizePath = parseFieldPath(claim.sizeField);
      const currentSize: unknown = doc.getIn(sizePath, false);
      if (currentSize === undefined) throw new Error(`${claim.id}: ${path} has no value at ${claim.sizeField}`);
      if (currentSize !== wantSize) {
        doc.setIn(sizePath, wantSize);
        edits.push({ path, field: claim.sizeField, from: String(currentSize), to: wantSize });
        touched = true;
      }
      // Governors are written in the SAME pass as the size they bound, so the
      // two can never land in separate commits. A missing coordinate is
      // REFUSED rather than created, exactly as for the size: inventing
      // `retentionSize` inside somebody else's values block is how a silent
      // misconfiguration ships. The field has to be added to the manifest by a
      // human first; after that the catalogue owns its value.
      for (const [field, byProfile] of [...Object.entries(claim.governors)].sort((a, b) => stringCompare(a[0], b[0]))) {
        const wantGovernor = byProfile[profile];
        if (wantGovernor === undefined) throw new Error(`${claim.id}: no governor value for profile "${profile}"`);
        const governorPath = parseFieldPath(field);
        const currentGovernor: unknown = doc.getIn(governorPath, false);
        if (currentGovernor === undefined) throw new Error(`${claim.id}: ${path} has no value at ${field}`);
        if (currentGovernor !== wantGovernor) {
          doc.setIn(governorPath, wantGovernor);
          edits.push({ path, field, from: String(currentGovernor), to: wantGovernor });
          touched = true;
        }
      }
      if (claim.podsField === null) continue;
      const wantPods = claim.pods[profile];
      if (wantPods === undefined) throw new Error(`${claim.id}: no pod count for profile "${profile}"`);
      const podsPath = parseFieldPath(claim.podsField);
      const currentPods: unknown = doc.getIn(podsPath, false);
      if (currentPods === undefined) throw new Error(`${claim.id}: ${path} has no value at ${claim.podsField}`);
      if (currentPods !== wantPods) {
        doc.setIn(podsPath, wantPods);
        edits.push({ path, field: claim.podsField, from: String(currentPods), to: String(wantPods) });
        touched = true;
      }
    }
    // Joined with "", never with "---\n". A parsed Document's toString()
    // ALREADY emits its own `---` marker when the stream had one, so inserting
    // separators DOUBLES them: measured on platform/portal.yaml, 6 documents
    // round-tripped through `join("---\n")` re-parsed as 11, which shifted every
    // docIndex and left two catalogue rows pointing at nothing. It was caught by
    // switching profiles end-to-end rather than by a unit test, so there is now
    // a multi-document fixture in the test file as well.
    if (touched && write) writeFileSync(abs, docs.map((doc) => String(doc)).join(""), "utf8");
  }
  return edits;
}

// ===========================================================================
// CPU / MEMORY PROFILES — the same ladder, for the resource the DEV RUNNER runs
// out of first.
//
// WHY THIS LIVES IN THE SAME FILE AND THE SAME CATALOGUE
// -----------------------------------------------------
// Aaron 2026-08-20: "sounds like we can set some resource limits for our dev
// runners and different defaults for physical hardware, we should try to make
// things small enough to fit for disk and ram on the runners."
//
// That is the storage ladder's problem with two more axes on it, so it gets the
// storage ladder's mechanism rather than a parallel one: a rung chosen once per
// deployment, every cut priced in the row that makes it, and every number our
// own YAML cannot carry written down with its provenance.
//
// THE TWO RUNGS, AND WHY `metal` IS A NO-OP
// -----------------------------------------
//   dev     sized to fit a GitHub-hosted `ubuntu-24.04` standard runner
//   metal   BYTE-FOR-BYTE what the manifests render today
//
// `metal` is defined as the status quo for exactly the reason `large` was:
// naming what already runs is not the same as endorsing it, and it means
// nothing in this change shrinks the hardware deployment. Aaron asked for the
// split in those words -- different defaults for physical hardware -- so `dev`
// is the only rung that cuts anything.
//
// WHAT A REQUEST IS, AND WHAT IT IS NOT
// -------------------------------------
// A CPU/memory REQUEST is a SCHEDULING RESERVATION. It is what the kube
// scheduler subtracts from a node's allocatable when it decides whether a pod
// fits; it is NOT a cap, and it is NOT a measurement of the process's working
// set. So the arithmetic below answers exactly one question -- "will the
// scheduler admit all of these onto one 4-vCPU / 16-GB node" -- and it answers
// no other. In particular:
//
//   * cutting a request below the app's real working set does NOT make the app
//     smaller. Without a matching limit the pod simply becomes more
//     over-committed, and the failure moves from a Pending pod (loud, obvious,
//     scheduler-attributed) to the kernel OOM killer (quiet, arbitrary,
//     attributed to whichever process happened to be biggest). Every `dev` cut
//     therefore has to say what it costs, and `loadResourceCatalogue` refuses a
//     row that does not.
//   * 28 of the 45 Applications in this tree render pods that request NOTHING
//     AT ALL (`resources: {}` chart defaults). Those pods are BestEffort: the
//     scheduler will admit any number of them and this arithmetic will never
//     see them. The declared total is a FLOOR on the requirement, never the
//     requirement, and the envelope keeps unreserved headroom precisely so
//     those pods have somewhere to live. See `$comment_resources` in the
//     catalogue for the measurement.
// ===========================================================================

/** Where a `metal` value comes from — the same distinction as `PodsSource`. */
export type MetalSource = "manifest" | "chart-default";

/**
 * The machine a `dev` rung has to fit inside, and the slice of it this
 * arithmetic is allowed to spend.
 *
 * The capacity half is a VENDOR-PUBLISHED number, not one we measured, which is
 * why `measureRunner` below exists: it reads the real machine and refuses when
 * the real machine is smaller than this record claims. A published spec that
 * nothing checks is exactly the class of claim this repo is built to reject.
 */
export interface RunnerEnvelope {
  readonly runner: string;
  readonly cpuMillis: number;
  readonly memoryMib: number;
  readonly freeDiskGib: number;
  readonly reservedCpuMillis: number;
  readonly reservedMemoryMib: number;
  readonly reservedDiskGib: number;
  readonly reservationEvidence: string;
}

export interface ResourceBudget {
  readonly cpuMillis: number;
  readonly memoryMib: number;
  readonly diskGib: number;
}

/** What is left for application requests after every reservation is paid. */
export function envelopeBudget(envelope: RunnerEnvelope): ResourceBudget {
  return {
    cpuMillis: envelope.cpuMillis - envelope.reservedCpuMillis,
    memoryMib: envelope.memoryMib - envelope.reservedMemoryMib,
    diskGib: envelope.freeDiskGib - envelope.reservedDiskGib,
  };
}

/** One governed (cpu, memory) request pair — the coordinate a rung writes. */
export interface ResourceClaim {
  readonly id: string;
  /** Directory under `full-ai-cluster/k8s/applications/`. */
  readonly dir: string;
  readonly path: string;
  readonly docIndex: number;
  /** Dotted path of the `requests` MAP; `.cpu` and `.memory` hang off it. */
  readonly requestsField: string;
  /** How many pods this one value is multiplied by. */
  readonly pods: number;
  readonly metalSource: MetalSource;
  /** Required (non-empty) unless metalSource is "manifest" AND pods === 1. */
  readonly evidence: string;
  readonly consequence: string;
  readonly cpuMillis: Readonly<Record<string, number>>;
  readonly memoryMib: Readonly<Record<string, number>>;
}

/**
 * An Application no rung governs, carrying its MEASURED request total.
 *
 * These rows are what stop the budget from being a sum over the subset we
 * happened to shrink. `null` means the chart could not be fetched at its pinned
 * version, so the number is UNKNOWN — and unknown is refused rather than
 * treated as zero, unless it is acknowledged with its pin.
 */
export interface UngovernedApp {
  readonly dir: string;
  readonly cpuMillis: number | null;
  readonly memoryMib: number | null;
  readonly evidence: string;
}

/**
 * One dev-lane budget shortfall carried as debt, pinned to its arithmetic.
 *
 * NOT the same thing as the ledger's `acknowledgedRungBudgetGap`. That one
 * carries a disagreement between the rung CI budgets and the rung the tree
 * carries; this one carries a rung not fitting the runner AT ALL. Before
 * 2026-08-22 only the first could happen, because `dev` fit with 594m to spare.
 */
export interface LaneBudgetAcknowledgement {
  /** `<rung> <resource> <total>><budget>` — one millicore of movement retires it. */
  readonly key: string;
  readonly reason: string;
  /** The condition that retires it, phrased so a gate can decide it. */
  readonly liftsWhen: string;
}

export interface ResourceCatalogue {
  /** Smallest first; the order is checked, not decorative. */
  readonly profiles: readonly string[];
  readonly envelope: RunnerEnvelope;
  readonly claims: readonly ResourceClaim[];
  readonly ungoverned: readonly UngovernedApp[];
  /** `<dir>@<pinned chart version>` entries whose UNMEASURED total is carried as debt. */
  readonly acknowledgedUnmeasured: readonly string[];
  readonly acknowledgedLaneBudgetShortfall: readonly LaneBudgetAcknowledgement[];
}

const APPLICATIONS_DIR = "full-ai-cluster/k8s/applications";

function requireInt(value: unknown, label: string, min: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    throw new Error(`${label}: expected an integer >= ${String(min)}`);
  }
  return value;
}

/**
 * Read and VALIDATE the resource ladder. Every refusal is here because its
 * absence would let a number mean nothing:
 *
 *  - non-monotone along `profiles`        -> "dev" could be the BIGGER rung for
 *    some app and the ladder would stop being a ladder
 *  - a missing per-profile entry          -> a rung with a hole in it totals
 *    less than it costs
 *  - a multiplied pod count with no       -> the mimir mistake again: 6 pods
 *    evidence                                rendered from one values key that
 *                                            no reader of our YAML can find
 *  - a cut with no stated consequence     -> a request cut below the working
 *    set is an OOMKill with a nicer name; it has to be priced in the row
 *  - an unmeasured app that is not        -> "we could not measure it" reading
 *    acknowledged                            as "it costs nothing"
 */
export function loadResourceCatalogue(path = DEFAULT_CATALOGUE_PATH, repoRoot = REPO_ROOT): ResourceCatalogue {
  const abs = resolve(repoRoot, path);
  const parsed = JSON.parse(readFileSync(abs, "utf8")) as Record<string, unknown>;

  const rawProfiles = parsed.resourceProfiles;
  if (!Array.isArray(rawProfiles) || rawProfiles.length === 0) {
    throw new Error(`${path}: "resourceProfiles" must be a non-empty array, smallest first`);
  }
  const profiles = rawProfiles.map((entry, index) =>
    requireString(entry, `${path}: resourceProfiles[${String(index)}]`),
  );
  if (new Set(profiles).size !== profiles.length) throw new Error(`${path}: duplicate resource profile name`);

  const rawEnvelope = parsed.runnerEnvelope;
  if (typeof rawEnvelope !== "object" || rawEnvelope === null) {
    throw new Error(
      `${path}: "runnerEnvelope" missing — a budget with no machine behind it is arithmetic about nothing`,
    );
  }
  const env = rawEnvelope as Record<string, unknown>;
  const envelope: RunnerEnvelope = {
    runner: requireString(env.runner, `${path}: runnerEnvelope.runner`),
    cpuMillis: requireInt(env.cpuMillis, `${path}: runnerEnvelope.cpuMillis`, 1),
    memoryMib: requireInt(env.memoryMib, `${path}: runnerEnvelope.memoryMib`, 1),
    freeDiskGib: requireInt(env.freeDiskGib, `${path}: runnerEnvelope.freeDiskGib`, 1),
    reservedCpuMillis: requireInt(env.reservedCpuMillis, `${path}: runnerEnvelope.reservedCpuMillis`, 0),
    reservedMemoryMib: requireInt(env.reservedMemoryMib, `${path}: runnerEnvelope.reservedMemoryMib`, 0),
    reservedDiskGib: requireInt(env.reservedDiskGib, `${path}: runnerEnvelope.reservedDiskGib`, 0),
    reservationEvidence: requireString(env.reservationEvidence, `${path}: runnerEnvelope.reservationEvidence`),
  };
  const budget = envelopeBudget(envelope);
  if (budget.cpuMillis <= 0 || budget.memoryMib <= 0 || budget.diskGib <= 0) {
    throw new Error(
      `${path}: runnerEnvelope reserves everything it declares — nothing is left for application requests`,
    );
  }

  const rawClaims = parsed.resourceClaims;
  if (!Array.isArray(rawClaims) || rawClaims.length === 0) {
    throw new Error(`${path}: "resourceClaims" must be a non-empty array`);
  }
  const claims: ResourceClaim[] = [];
  const seenIds = new Set<string>();
  for (const raw of rawClaims as readonly Record<string, unknown>[]) {
    const id = requireString(raw.id, `${path}: resource claim id`);
    if (seenIds.has(id)) throw new Error(`${path}: duplicate resource claim id ${id}`);
    seenIds.add(id);
    const metalSource = requireString(raw.metalSource, `${path}: ${id}.metalSource`);
    if (metalSource !== "manifest" && metalSource !== "chart-default") {
      throw new Error(`${path}: ${id}.metalSource must be manifest | chart-default`);
    }
    const pods = requireInt(raw.pods, `${path}: ${id}.pods`, 1);
    const evidence = typeof raw.evidence === "string" ? raw.evidence : "";
    if ((metalSource !== "manifest" || pods > 1) && evidence.trim().length === 0) {
      throw new Error(
        `${path}: ${id} takes its metal value or its pod count from somewhere our YAML does not carry ` +
          `(metalSource=${metalSource}, pods=${String(pods)}) with no evidence — that is an assertion wearing a number`,
      );
    }
    const consequence = requireString(raw.consequence, `${path}: ${id}.consequence`);
    const rawCpu = raw.cpuMillis as Record<string, unknown> | undefined;
    const rawMem = raw.memoryMib as Record<string, unknown> | undefined;
    if (typeof rawCpu !== "object" || rawCpu === null) throw new Error(`${path}: ${id}.cpuMillis missing`);
    if (typeof rawMem !== "object" || rawMem === null) throw new Error(`${path}: ${id}.memoryMib missing`);
    const cpuByProfile: Record<string, number> = {};
    const memByProfile: Record<string, number> = {};
    let previousCpu = -Infinity;
    let previousMem = -Infinity;
    let cuts = false;
    for (const name of profiles) {
      // Zero is a REAL value here and is not the same as a missing one: it
      // means the container declares no reservation for that resource, which
      // is what most chart defaults do. `verifyResourceProfileApplied` and
      // `applyResourceProfile` both read 0 as "this key must be ABSENT",
      // because an absent request IS a zero reservation in Kubernetes and
      // writing `cpu: 0` would be a different, stranger thing to ship.
      const cpu = requireInt(rawCpu[name], `${path}: ${id}.cpuMillis.${name}`, 0);
      const mem = requireInt(rawMem[name], `${path}: ${id}.memoryMib.${name}`, 0);
      if (cpu < previousCpu || mem < previousMem) {
        throw new Error(
          `${path}: ${id} is not monotonically non-decreasing along resourceProfiles ` +
            `(${name} is smaller than the preceding rung) — the ladder must climb`,
        );
      }
      if (previousCpu !== -Infinity && (cpu > previousCpu || mem > previousMem)) cuts = true;
      previousCpu = cpu;
      previousMem = mem;
      cpuByProfile[name] = cpu;
      memByProfile[name] = mem;
    }
    // A row that actually shrinks something has to say what the shrink costs.
    // A row that shrinks nothing is just recording the status quo and needs no
    // price, so the bar is only applied where a price is owed.
    if (cuts && consequence.trim().length < 40) {
      throw new Error(
        `${path}: ${id} cuts a request between rungs but states no consequence — a request cut below the ` +
          `working set does not make the app smaller, it turns a Pending pod into an OOMKill`,
      );
    }
    claims.push({
      id,
      dir: requireString(raw.dir, `${path}: ${id}.dir`),
      path: requireString(raw.path, `${path}: ${id}.path`),
      docIndex: typeof raw.docIndex === "number" ? raw.docIndex : 0,
      requestsField: requireString(raw.requestsField, `${path}: ${id}.requestsField`),
      pods,
      metalSource,
      evidence,
      consequence,
      cpuMillis: cpuByProfile,
      memoryMib: memByProfile,
    });
  }

  const rawUngoverned = parsed.ungovernedRequests;
  if (!Array.isArray(rawUngoverned)) throw new Error(`${path}: "ungovernedRequests" must be an array`);
  const ungoverned: UngovernedApp[] = [];
  const seenDirs = new Set<string>();
  for (const raw of rawUngoverned as readonly Record<string, unknown>[]) {
    const dir = requireString(raw.dir, `${path}: ungovernedRequests dir`);
    if (seenDirs.has(dir)) throw new Error(`${path}: duplicate ungovernedRequests dir ${dir}`);
    seenDirs.add(dir);
    const cpu = raw.cpuMillis;
    const mem = raw.memoryMib;
    const measured = cpu !== null && mem !== null;
    if (measured) {
      requireInt(cpu, `${path}: ungovernedRequests.${dir}.cpuMillis`, 0);
      requireInt(mem, `${path}: ungovernedRequests.${dir}.memoryMib`, 0);
    } else if (cpu !== null || mem !== null) {
      throw new Error(
        `${path}: ungovernedRequests.${dir} is half-measured — either both numbers are known or neither is`,
      );
    }
    ungoverned.push({
      dir,
      cpuMillis: measured ? (cpu as number) : null,
      memoryMib: measured ? (mem as number) : null,
      evidence: requireString(raw.evidence, `${path}: ungovernedRequests.${dir}.evidence`),
    });
  }
  for (const claim of claims) {
    if (seenDirs.has(claim.dir)) {
      throw new Error(
        `${path}: ${claim.dir} appears both as a governed resourceClaim and in ungovernedRequests — ` +
          `it would be counted twice`,
      );
    }
  }

  const rawAck = parsed.acknowledgedUnmeasuredRequests;
  if (!Array.isArray(rawAck)) throw new Error(`${path}: "acknowledgedUnmeasuredRequests" must be an array`);
  const acknowledgedUnmeasured = rawAck.map((entry, index) =>
    requireString(entry, `${path}: acknowledgedUnmeasuredRequests[${String(index)}]`),
  );

  const rawLaneAck = parsed.acknowledgedLaneBudgetShortfall;
  if (rawLaneAck !== undefined && !Array.isArray(rawLaneAck)) {
    throw new Error(`${path}: "acknowledgedLaneBudgetShortfall" must be an array`);
  }
  const acknowledgedLaneBudgetShortfall = ((rawLaneAck ?? []) as readonly Record<string, unknown>[]).map(
    (raw, index) => {
      const key = requireString(raw.key, `${path}: acknowledgedLaneBudgetShortfall[${String(index)}].key`);
      const reason = raw.reason;
      const liftsWhen = raw.liftsWhen;
      if (typeof reason !== "string" || reason.trim().length < 40) {
        throw new Error(
          `${path}: ${key} is acknowledged with no reason — a shortfall carried as debt with nothing written ` +
            `beside it is a shortfall that was hidden`,
        );
      }
      if (typeof liftsWhen !== "string" || !liftsWhen.startsWith("LIFTS WHEN:")) {
        throw new Error(
          `${path}: ${key}.liftsWhen must start with "LIFTS WHEN:" — an acknowledgement with no lift condition ` +
            `never leaves, and outliving its defect is how a baseline becomes a lie`,
        );
      }
      return { key, reason, liftsWhen };
    },
  );

  return {
    profiles,
    envelope,
    claims: [...claims].sort((a, b) => stringCompare(a.id, b.id)),
    ungoverned: [...ungoverned].sort((a, b) => stringCompare(a.dir, b.dir)),
    acknowledgedUnmeasured,
    acknowledgedLaneBudgetShortfall,
  };
}

// ---------------------------------------------------------------------------
// Which Applications the dev/CI cluster actually applies
// ---------------------------------------------------------------------------

/**
 * Directories with an `Application.yaml`, at DEPTH 1 **AND DEPTH 2**.
 *
 * This used to be depth-1 "on purpose", with the stated reason that depth-1 is
 * what the root App-of-Apps `include` glob matches. That reason was wrong, and
 * the file that disproves it is already in this repo:
 * `app-of-apps-discovery.ts` establishes — against a LIVE cluster, not by
 * reading the spec — that ArgoCD compiles `directory.include` with
 * `gobwas/glob` and no separator argument, so `*` binds across `/` and
 * `{*\/Application.yaml,Application.yaml}` DOES match
 * `game-hosting/gmod/Application.yaml`. The `--scope included` lane's own
 * diagnostics list a `gmod` Application in the cluster.
 *
 * The cost of the old assumption was 1000m. `game-hosting/gmod` is an in-repo
 * StatefulSet whose manifest carries a literal `requests: { cpu: "1", memory:
 * "2Gi" }`, it is applied by the dev root (no exclude covers it), and every
 * rung total in this file was computed without it. The catalogue's own
 * `$comment_resources` said in writing that it "contributes 0m / 0Mi today (in-repo
 * manifests, no requests)" — a sentence measurably false when written, and
 * unfalsifiable from inside this module because the enumerator could not see
 * the file that refutes it.
 *
 * Depth 2 and not deeper because depth 2 is what exists; `app-of-apps-discovery.ts`
 * is the check that refuses a third level, so a deeper Application forces a
 * human to look before it can hide from this sum.
 */
export function applicationDirs(repoRoot = REPO_ROOT): readonly string[] {
  const base = resolve(repoRoot, APPLICATIONS_DIR);
  if (!existsSync(base)) return [];
  const dirs: string[] = [];
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (existsSync(resolve(base, entry.name, "Application.yaml"))) {
      dirs.push(entry.name);
      continue;
    }
    for (const nested of readdirSync(resolve(base, entry.name), { withFileTypes: true })) {
      if (!nested.isDirectory()) continue;
      if (existsSync(resolve(base, entry.name, nested.name, "Application.yaml"))) {
        dirs.push(`${entry.name}/${nested.name}`);
      }
    }
  }
  return dirs.sort((a, b) => stringCompare(a, b));
}

/**
 * The dev/CI cluster's applied set: every Application the root reaches, minus
 * the ones its exclude glob drops.
 *
 * Derived FROM `DEFAULT_ROOT_DEV_CATALOG.excludeGlob` rather than restated,
 * because that constant is the single source of truth for what reaches a CI
 * cluster. Restating it here would create a second list that could drift, which
 * is the exact defect `auditAppliedButUnasserted` was written to close.
 */
export function devLaneAppliedDirs(
  repoRoot = REPO_ROOT,
  excludeGlob = DEFAULT_ROOT_DEV_CATALOG.excludeGlob,
): readonly string[] {
  const excluded = [
    ...new Set(
      excludeGlob
        .replace(/^\{/, "")
        .replace(/\}$/, "")
        .split(",")
        .map((entry) => entry.trim().replace(/\/\*\*$/, ""))
        .filter((entry) => entry.length > 0),
    ),
  ];
  // PREFIX, not equality. `cilium/**` excludes `cilium` and everything under
  // it; with depth-2 directories now in `applicationDirs`, an equality test
  // would leave `<excluded>/<nested>` in the applied set while ArgoCD's own
  // exclude glob drops it — a cohort wider than the cluster's, which makes the
  // budget pessimistic in a way nobody could account for.
  return applicationDirs(repoRoot).filter(
    (dir) => !excluded.some((entry) => dir === entry || dir.startsWith(`${entry}/`)),
  );
}

/** One level of a parsed YAML mapping, or `undefined`. Total on any input. */
function field(node: unknown, key: string): unknown {
  return typeof node === "object" && node !== null ? (node as Record<string, unknown>)[key] : undefined;
}

export const METAL_ROOT_APPLICATION_PATH = "full-ai-cluster/k8s/bootstrap/root-application.yaml";

/**
 * The METAL cluster's applied set — every Application the checked-in bootstrap
 * root reaches, minus whatever its own exclude glob drops.
 *
 * READ OFF THE ROOT, NOT ASSUMED TO BE "ALL OF THEM". The bootstrap root
 * carries no `directory.exclude` today, so this returns the same 46 directories
 * `applicationDirs` does — and hardcoding 46 would have been correct today and
 * silently wrong the first time somebody narrowed the metal root. The metal
 * cohort is the one number every hardware-facing total is computed over; it has
 * to come from the artifact that decides it.
 *
 * `null` when the root Application cannot be read or does not point at the
 * applications path. That is REFUSED by the caller, never defaulted to the full
 * set: guessing wide would understate nothing but guessing at all is how a
 * comparator stops having provenance.
 */
export function metalAppliedDirs(repoRoot = REPO_ROOT): readonly string[] | null {
  const abs = resolve(repoRoot, METAL_ROOT_APPLICATION_PATH);
  if (!existsSync(abs)) return null;
  const docs = parseAllDocuments(readFileSync(abs, "utf8"));
  for (const doc of docs) {
    const root: unknown = doc.toJS();
    if (field(root, "kind") !== "Application") continue;
    const source = field(field(root, "spec"), "source");
    if (field(source, "path") !== APPLICATIONS_DIR) continue;
    const rawExclude = field(field(source, "directory"), "exclude");
    const excludeGlob = typeof rawExclude === "string" ? rawExclude : "";
    if (excludeGlob === "") return applicationDirs(repoRoot);
    const excluded = new Set(
      excludeGlob
        .replace(/^\{/, "")
        .replace(/\}$/, "")
        .split(",")
        .map((entry) => entry.trim().replace(/\/\*\*$/, ""))
        .filter((entry) => entry.length > 0),
    );
    return applicationDirs(repoRoot).filter((dir) => !excluded.has(dir));
  }
  return null;
}

export const HEALTH_WORKFLOW_PATH = ".github/workflows/k8s-argocd-health-test.yml";

const WORKFLOW_BUDGET_STEP = /storage-profiles\.ts\s+--resource-profile\s+([A-Za-z0-9._-]+)\s+--budget/g;

/**
 * Which rung CI actually budgets, read off the workflow's own `run:` line.
 *
 * DERIVED, NOT RESTATED. A constant here saying "CI budgets dev" would be a
 * second source of truth that can disagree with the workflow, and a coverage
 * check whose inputs can drift apart is checking its own copy of the world.
 * The regex reads the command CI runs.
 *
 * Returns `null` when no step budgets a rung and refuses (also `null`) when
 * more than one distinct rung is budgeted — two answers is not an answer, and
 * the caller must treat it as an absent comparator rather than pick one.
 */
export function ciBudgetedProfile(repoRoot = REPO_ROOT, workflowPath = HEALTH_WORKFLOW_PATH): string | null {
  const abs = resolve(repoRoot, workflowPath);
  if (!existsSync(abs)) return null;
  const text = readFileSync(abs, "utf8");
  const found = new Set<string>();
  WORKFLOW_BUDGET_STEP.lastIndex = 0;
  for (let match = WORKFLOW_BUDGET_STEP.exec(text); match !== null; match = WORKFLOW_BUDGET_STEP.exec(text)) {
    const name = match[1];
    if (name !== undefined) found.add(name);
  }
  return found.size === 1 ? ([...found][0] ?? null) : null;
}

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

export interface ResourceTotal {
  readonly cpuMillis: number;
  readonly memoryMib: number;
  /** Directories in the cohort whose request total is not known. */
  readonly unmeasured: readonly string[];
}

/**
 * Total CPU/memory REQUESTS for `dirs` under `profile` — governed rows at their
 * rung value times their pod count, ungoverned rows at their measured total.
 *
 * A directory in `dirs` that the catalogue does not cover at all is reported in
 * `unmeasured`, not skipped: a cohort member with no row is a hole in the sum,
 * and a sum with a hole in it is what "it fits" would be claimed from.
 */
export function resourceTotal(catalogue: ResourceCatalogue, profile: string, dirs: readonly string[]): ResourceTotal {
  const wanted = new Set(dirs);
  const covered = new Set<string>();
  let cpuMillis = 0;
  let memoryMib = 0;
  const unmeasured: string[] = [];
  for (const claim of catalogue.claims) {
    if (!wanted.has(claim.dir)) continue;
    covered.add(claim.dir);
    const cpu = claim.cpuMillis[profile];
    const mem = claim.memoryMib[profile];
    if (cpu === undefined || mem === undefined) throw new Error(`${claim.id}: no entry for profile "${profile}"`);
    cpuMillis += cpu * claim.pods;
    memoryMib += mem * claim.pods;
  }
  for (const app of catalogue.ungoverned) {
    if (!wanted.has(app.dir)) continue;
    covered.add(app.dir);
    if (app.cpuMillis === null || app.memoryMib === null) {
      unmeasured.push(app.dir);
      continue;
    }
    cpuMillis += app.cpuMillis;
    memoryMib += app.memoryMib;
  }
  for (const dir of [...wanted].sort((a, b) => stringCompare(a, b))) {
    if (!covered.has(dir)) unmeasured.push(dir);
  }
  return { cpuMillis, memoryMib, unmeasured: [...new Set(unmeasured)].sort((a, b) => stringCompare(a, b)) };
}

/**
 * Both directions of coverage between the catalogue and the tree.
 *
 * Same shape as `crossCheckClaims`, same reason: an Application with no row
 * makes every total understate the runner, and a row for a directory that no
 * longer exists is capacity being counted against nothing.
 */
export function crossCheckResourceCoverage(
  catalogue: ResourceCatalogue,
  repoRoot = REPO_ROOT,
): readonly ProfileFinding[] {
  const onDisk = new Set(applicationDirs(repoRoot));
  const covered = new Map<string, string>();
  for (const claim of catalogue.claims) covered.set(claim.dir, claim.id);
  for (const app of catalogue.ungoverned) covered.set(app.dir, `ungovernedRequests.${app.dir}`);
  const findings: ProfileFinding[] = [];
  for (const dir of [...onDisk].sort((a, b) => stringCompare(a, b))) {
    if (covered.has(dir)) continue;
    findings.push({
      claimId: dir,
      problem:
        `${APPLICATIONS_DIR}/${dir}/Application.yaml exists and the resource catalogue does not cover it — ` +
        `every rung's total therefore understates the runner by whatever this app requests`,
    });
  }
  for (const [dir, id] of [...covered.entries()].sort((a, b) => stringCompare(a[0], b[0]))) {
    if (onDisk.has(dir)) continue;
    findings.push({
      claimId: id,
      problem: `names directory "${dir}", which has no ${APPLICATIONS_DIR}/${dir}/Application.yaml — stale row`,
    });
  }
  return findings;
}

/**
 * Does `profile` fit the runner, for the Applications the dev lane applies?
 *
 * Returns the findings; empty is the green state. UNMEASURED apps convict
 * unless acknowledged as `<dir>@<pinned version>` — the pin is in the key on
 * purpose, exactly as `acknowledgedCapacityShortfall` pins its arithmetic, so a
 * chart bump invalidates the acknowledgement instead of silently inheriting it.
 */
export function auditRunnerBudget(
  catalogue: ResourceCatalogue,
  profile: string,
  repoRoot = REPO_ROOT,
): readonly ProfileFinding[] {
  if (!catalogue.profiles.includes(profile)) {
    return [
      {
        claimId: "runner-budget",
        problem:
          `"${profile}" is not a rung of this catalogue (known: ${catalogue.profiles.join(", ")}). ` +
          `Nothing can be checked against a rung that does not exist, and "cannot check" must never read as "checked"`,
      },
    ];
  }
  const findings: ProfileFinding[] = [...crossCheckResourceCoverage(catalogue, repoRoot)];
  const dirs = devLaneAppliedDirs(repoRoot);
  const total = resourceTotal(catalogue, profile, dirs);
  const budget = envelopeBudget(catalogue.envelope);
  const acknowledged = new Set(catalogue.acknowledgedUnmeasured);
  for (const dir of total.unmeasured) {
    const pin = pinnedChartVersion(dir, repoRoot);
    const key = `${dir}@${pin}`;
    if (acknowledged.has(key)) continue;
    findings.push({
      claimId: dir,
      problem:
        `applied by the dev lane with an UNKNOWN request total, and not acknowledged as "${key}". ` +
        `An app nobody could measure is not an app that costs nothing`,
    });
  }
  for (const key of [...acknowledged].sort((a, b) => stringCompare(a, b))) {
    const dir = key.split("@", 1)[0] ?? "";
    if (total.unmeasured.includes(dir)) continue;
    findings.push({
      claimId: key,
      problem:
        `acknowledged as unmeasured, but the dev lane's total no longer reports it that way — ` +
        `stale acknowledgement, delete it`,
    });
  }
  // A SHORTFALL MAY BE CARRIED AS DEBT, pinned to its arithmetic.
  //
  // Added 2026-08-22 because `dev` stopped fitting: the lane went from 1906m to
  // 2906m when `applicationDirs` started counting the depth-2 Application
  // ArgoCD had always applied. Widening the envelope would have made the gate
  // agree with the machine that does not exist; refusing outright would have
  // blocked every unrelated PR on a decision only the maintainer can make. The
  // acknowledgement is the third answer, and it is only honest because the key
  // carries BOTH numbers -- one millicore of movement in either and it stops
  // matching, which is reported as STALE below rather than ignored.
  const laneAcknowledged = new Set(catalogue.acknowledgedLaneBudgetShortfall.map((entry) => entry.key));
  const live = new Set<string>();
  for (const [resource, label, got, cap, unit, machine] of [
    [
      "cpu",
      "CPU",
      total.cpuMillis,
      budget.cpuMillis,
      "m",
      `${String(catalogue.envelope.cpuMillis)}m on ${catalogue.envelope.runner} less ${String(catalogue.envelope.reservedCpuMillis)}m reserved`,
    ],
    [
      "memory",
      "memory",
      total.memoryMib,
      budget.memoryMib,
      "Mi",
      `${String(catalogue.envelope.memoryMib)}Mi on ${catalogue.envelope.runner} less ${String(catalogue.envelope.reservedMemoryMib)}Mi reserved`,
    ],
  ] as const) {
    if (got <= cap) continue;
    const key = laneShortfallKey(profile, resource, got, cap);
    live.add(key);
    if (laneAcknowledged.has(key)) continue;
    findings.push({
      claimId: "runner-budget",
      problem:
        `profile "${profile}" requests ${String(got)}${unit} of ${label} across the ${String(dirs.length)} ` +
        `Applications the dev lane applies; the budget is ${String(cap)}${unit} (${machine}). ` +
        (resource === "cpu" ? "Pods above the line go Pending, forever. " : "") +
        `Resolve it or carry it as stated debt: acknowledge with "${key}"`,
    });
  }
  for (const entry of catalogue.acknowledgedLaneBudgetShortfall) {
    if (live.has(entry.key)) continue;
    if (!entry.key.startsWith(`${profile} `)) continue;
    findings.push({
      claimId: "runner-budget",
      problem:
        `"${entry.key}" is acknowledged and nothing reports it any more — the arithmetic moved and the ` +
        `acknowledgement outlived the shortfall it was written about. Delete the entry`,
    });
  }
  return findings;
}

/** `<rung> <resource> <total>><budget>` — the acknowledgement key, pinned to both numbers. */
export function laneShortfallKey(profile: string, resource: "cpu" | "memory", total: number, budget: number): string {
  return `${profile} ${resource} ${String(total)}>${String(budget)}`;
}

/**
 * The `targetRevision` this Application pins its `chart:` at, or "" when it sources git.
 *
 * PARSED, NOT SCANNED — corrected 2026-08-21, and the bug it had is the reason
 * the docstring says so. This used to find the line matching `chart:` and probe
 * the SIX lines nearest it for `targetRevision:`. That works right up until
 * somebody writes a comment between the two keys, at which point the function
 * returns "" — and "" is not an error here, it is a WRONG ANSWER that keeps
 * going: `auditRunnerBudget` builds the acknowledgement key `${dir}@${pin}`, so
 * an app pinned at 3.1.1 silently starts being looked up as `oz@`, every
 * acknowledgement for it misses, and the finding it produces names a version
 * nobody wrote. Caught by adding a 35-line comment to oz/Application.yaml
 * explaining why its pin had changed — i.e. the check was broken by documenting
 * the thing the check exists to watch.
 *
 * Reading the parsed document costs nothing here (these files are already
 * parsed elsewhere in this module) and makes the answer independent of layout,
 * comments, key order and indentation. `chart:` is still required, so a git-path
 * source still returns "" exactly as before.
 */
export function pinnedChartVersion(dir: string, repoRoot = REPO_ROOT): string {
  const abs = resolve(repoRoot, APPLICATIONS_DIR, dir, "Application.yaml");
  if (!existsSync(abs)) return "";
  for (const doc of parseAllDocuments(readFileSync(abs, "utf8"))) {
    const source = (doc.toJS() as { spec?: { source?: { chart?: unknown; targetRevision?: unknown } } } | null)?.spec
      ?.source;
    if (source === undefined || source === null) continue;
    if (typeof source.chart !== "string" || source.chart === "") continue;
    if (typeof source.targetRevision !== "string") continue;
    return source.targetRevision;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Verifying and applying a resource rung
// ---------------------------------------------------------------------------

/**
 * Does the tree carry `profile`'s numbers?
 *
 * The rule that makes `metal` a genuine no-op: an ABSENT coordinate is correct
 * for a `chart-default` row on the rung whose value equals the chart default,
 * because "not set" is exactly how the chart default reaches the cluster.
 * Anywhere else, absent is drift — otherwise a rung nobody applied would report
 * as applied, which is the whole vacuity class.
 */
export function verifyResourceProfileApplied(
  catalogue: ResourceCatalogue,
  profile: string,
  repoRoot = REPO_ROOT,
): readonly ProfileFinding[] {
  const findings: ProfileFinding[] = [];
  const metal = catalogue.profiles[catalogue.profiles.length - 1] ?? "";
  for (const claim of catalogue.claims) {
    const wantCpu = claim.cpuMillis[profile];
    const wantMem = claim.memoryMib[profile];
    if (wantCpu === undefined || wantMem === undefined) {
      findings.push({ claimId: claim.id, problem: `no entry for resource profile "${profile}"` });
      continue;
    }
    const absentIsCorrect =
      claim.metalSource === "chart-default" && wantCpu === claim.cpuMillis[metal] && wantMem === claim.memoryMib[metal];
    for (const [suffix, want, millis] of [
      ["cpu", formatCpu(wantCpu), wantCpu],
      ["memory", `${String(wantMem)}Mi`, wantMem],
    ] as const) {
      const field = `${claim.requestsField}.${suffix}`;
      const found = readFieldAt(repoRoot, claim.path, claim.docIndex, field);
      if (millis === 0) {
        if (found.found) {
          findings.push({
            claimId: claim.id,
            problem:
              `${claim.path} declares ${String(found.value)} at ${field}, but profile "${profile}" declares no ` +
              `reservation at all — a zero request is an ABSENT key, not \`${suffix}: 0\``,
          });
        }
        continue;
      }
      if (!found.found) {
        if (absentIsCorrect) continue;
        findings.push({
          claimId: claim.id,
          problem:
            `${claim.path} has no value at ${field}, so the cluster gets the ${claim.metalSource} value, ` +
            `not profile "${profile}"'s ${want}`,
        });
        continue;
      }
      if (String(found.value) !== want) {
        findings.push({
          claimId: claim.id,
          problem: `${claim.path} declares ${String(found.value)} at ${field}, but profile "${profile}" says ${want}`,
        });
      }
    }
  }
  return findings;
}

/** `1000` -> `"1"`, `250` -> `"250m"` — Kubernetes accepts both; whole cores read better. */
export function formatCpu(millis: number): string {
  return millis % 1000 === 0 ? String(millis / 1000) : `${String(millis)}m`;
}

/**
 * Write `profile`'s requests into the manifests, in place.
 *
 * DIFFERENT FROM `applyProfile` IN ONE WAY, DELIBERATELY: this one CREATES a
 * missing coordinate instead of refusing it. The storage applier refuses
 * because a storage coordinate always exists — we always declare a size, so an
 * absent one means the row is pointing at the wrong place. Here the opposite is
 * true: the whole point of a `chart-default` row is that our tree does NOT
 * carry the key, so refusing to create it would make the ladder inapplicable to
 * every row that matters.
 *
 * What keeps that from being "invent a key in someone else's values block" is
 * the validator: a `chart-default` row cannot load without `evidence` naming
 * the chart, version and values path the default comes from, so the key being
 * created is one that was measured, not guessed.
 */
export function applyResourceProfile(
  catalogue: ResourceCatalogue,
  profile: string,
  repoRoot = REPO_ROOT,
  write = true,
): readonly ApplyEdit[] {
  const edits: ApplyEdit[] = [];
  const byPath = new Map<string, ResourceClaim[]>();
  for (const claim of catalogue.claims) {
    const bucket = byPath.get(claim.path);
    if (bucket === undefined) byPath.set(claim.path, [claim]);
    else bucket.push(claim);
  }
  for (const [path, claims] of [...byPath.entries()].sort((a, b) => stringCompare(a[0], b[0]))) {
    const abs = resolve(repoRoot, path);
    let source: string;
    try {
      source = readFileSync(abs, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`${path}: resource catalogue references a manifest that does not exist`);
      }
      throw err;
    }
    const docs = parseAllDocuments(source);
    let touched = false;
    for (const claim of claims) {
      const doc = docs[claim.docIndex];
      if (doc === undefined) throw new Error(`${claim.id}: ${path} has no document at index ${String(claim.docIndex)}`);
      const wantCpu = claim.cpuMillis[profile];
      const wantMem = claim.memoryMib[profile];
      if (wantCpu === undefined || wantMem === undefined) {
        throw new Error(`${claim.id}: no entry for resource profile "${profile}"`);
      }
      for (const [suffix, want, millis] of [
        ["cpu", formatCpu(wantCpu), wantCpu],
        ["memory", `${String(wantMem)}Mi`, wantMem],
      ] as const) {
        // A zero reservation is expressed by the key being absent, so there is
        // nothing to write. Deleting an existing key is deliberately NOT done
        // here: removing someone else's value is a bigger act than setting one,
        // and `verifyResourceProfileApplied` reports the leftover as drift
        // rather than this silently reaching in and dropping it.
        if (millis === 0) continue;
        const field = `${claim.requestsField}.${suffix}`;
        const fieldPath = parseFieldPath(field);
        const current: unknown = doc.getIn(fieldPath, false);
        if (current === want) continue;
        doc.setIn(fieldPath, want);
        edits.push({ path, field, from: current === undefined ? "(absent)" : String(current), to: want });
        touched = true;
      }
    }
    // Joined with "", never "---\n" — same reason as applyProfile: a parsed
    // Document already emits its own marker and joining with one doubles them.
    if (touched && write) writeFileSync(abs, docs.map((doc) => String(doc)).join(""), "utf8");
  }
  return edits;
}

// ---------------------------------------------------------------------------
// The envelope's own falsifier — read the real machine
// ---------------------------------------------------------------------------

export interface MeasuredRunner {
  readonly cpuMillis: number;
  readonly memoryMib: number;
}

/**
 * Read the CPU count and total RAM off the machine this is running on.
 *
 * Linux-only, and it REFUSES (returns null) elsewhere rather than guessing.
 * That matters: the point of this function is to turn a vendor-published
 * runner spec into a checked anchor, and a fallback that quietly produced a
 * number on a developer's laptop would make the check pass where it did not
 * run — the failure mode the whole lane exists to remove.
 */
export function measureRunner(procRoot = "/proc"): MeasuredRunner | null {
  const memInfo = resolve(procRoot, "meminfo");
  const cpuInfo = resolve(procRoot, "cpuinfo");
  if (!existsSync(memInfo) || !existsSync(cpuInfo)) return null;
  const memTotal = /^MemTotal:\s+(\d+) kB$/m.exec(readFileSync(memInfo, "utf8"));
  if (memTotal?.[1] === undefined) return null;
  const processors = readFileSync(cpuInfo, "utf8")
    .split("\n")
    .filter((line) => /^processor\s*:/.test(line)).length;
  if (processors === 0) return null;
  return { cpuMillis: processors * 1000, memoryMib: Math.floor(Number(memTotal[1]) / 1024) };
}

/**
 * Convict when the machine is SMALLER than the envelope claims.
 *
 * One-directional on purpose: a bigger runner than declared is a budget with
 * slack in it, which is not a defect. A smaller one means every "it fits"
 * this module has ever printed was computed against a machine that does not
 * exist.
 */
export function auditEnvelopeAgainstMachine(
  envelope: RunnerEnvelope,
  measured: MeasuredRunner | null,
): readonly ProfileFinding[] {
  if (measured === null) {
    return [
      {
        claimId: "runner-envelope",
        problem:
          `cannot read /proc on this platform, so the declared ${envelope.runner} envelope is UNVERIFIED here. ` +
          `Run this on the runner itself; an unread comparator is an absent check, not a passing one`,
      },
    ];
  }
  const findings: ProfileFinding[] = [];
  if (measured.cpuMillis < envelope.cpuMillis) {
    findings.push({
      claimId: "runner-envelope",
      problem:
        `the catalogue declares ${String(envelope.cpuMillis)}m of CPU for ${envelope.runner}; this machine has ` +
        `${String(measured.cpuMillis)}m. Every budget computed from the declared number is too generous`,
    });
  }
  if (measured.memoryMib < envelope.memoryMib) {
    findings.push({
      claimId: "runner-envelope",
      problem:
        `the catalogue declares ${String(envelope.memoryMib)}Mi of memory for ${envelope.runner}; this machine has ` +
        `${String(measured.memoryMib)}Mi. Every budget computed from the declared number is too generous`,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE =
  "usage: bun src/Core.TypeScript/cluster/storage-profiles.ts\n" +
  "  storage: [--list] [--profile NAME] [--check] [--apply]\n" +
  "  cpu/mem: [--resource-list] [--resource-profile NAME] [--check|--apply|--budget] [--measure-runner]";

function storageMain(argv: readonly string[]): void {
  const catalogue = loadCatalogue();
  const flag = argv.indexOf("--profile");
  const profile = flag >= 0 ? (argv[flag + 1] ?? "") : "";
  if (argv.includes("--list") || profile === "") {
    console.log("storage profiles (declared GiB = size x pods, summed over every longhorn claim):\n");
    // TWO disk requirements per rung, because one of them was misleading on its
    // own. A single "needs ~N GiB" derived from the DECLARED total prices in
    // capacity that no fresh sync provisions, so a rung whose cluster comes up
    // comfortably could be printed as needing a box nobody owns. Both are shown
    // and labelled: the bring-up figure is what the cluster needs to STAND UP,
    // the declared figure is what it would need if every Application in the
    // catalogue were synced. Neither is a discount on the other.
    for (const name of catalogue.profiles) {
      const total = profileTotalGib(catalogue, name);
      const bringUp = profileBringUpGib(catalogue, name);
      const diskFor = (gib: number): string => (gib / 0.75 + 30).toFixed(0);
      console.log(
        `  ${name.padEnd(10)} ${total.toFixed(0).padStart(5)} GiB declared   ` +
          `${bringUp.toFixed(0).padStart(5)} GiB provisions at bring-up   ` +
          `needs ~${diskFor(bringUp).padStart(4)} GiB of disk to stand up, ` +
          `~${diskFor(total).padStart(4)} GiB if everything is synced`,
      );
    }
    console.log(
      "\n  (Longhorn keeps 25% of a disk minimally-available at longhorn-1.7.2's chart default, plus ~30 GiB\n" +
        "   of OS root, so a declared total T needs roughly T/0.75 + 30 GiB of device before replicas place.)",
    );
    process.exit(0);
  }
  if (!catalogue.profiles.includes(profile)) {
    console.error(`unknown profile "${profile}"; known: ${catalogue.profiles.join(", ")}`);
    process.exit(2);
  }
  if (argv.includes("--apply")) {
    const edits = applyProfile(catalogue, profile);
    console.log(`applied profile "${profile}": ${String(edits.length)} edit(s)`);
    for (const edit of edits) console.log(`  ${edit.path}  ${edit.field}: ${edit.from} -> ${edit.to}`);
    console.log(
      `\nremember: the active profile also has to be recorded in the ledger ` +
        `(activeStorageProfile in full-ai-cluster/k8s/single-node-budget.json), or the readiness auditor ` +
        `will compare the manifests against the OTHER profile and go red.`,
    );
    process.exit(0);
  }
  const findings = verifyProfileApplied(catalogue, profile);
  for (const finding of findings) console.log(`[drift] ${finding.claimId}: ${finding.problem}`);
  console.log(
    findings.length === 0
      ? `manifests match profile "${profile}" (${profileTotalGib(catalogue, profile).toFixed(0)} GiB declared).`
      : `\n${String(findings.length)} drift(s) from profile "${profile}".`,
  );
  process.exit(findings.length === 0 ? 0 : 1);
}

function printResourceLadder(catalogue: ResourceCatalogue): void {
  const budget = envelopeBudget(catalogue.envelope);
  const dev = devLaneAppliedDirs();
  const all = applicationDirs();
  console.log(
    `runner envelope: ${catalogue.envelope.runner} — ` +
      `${String(catalogue.envelope.cpuMillis)}m CPU / ${String(catalogue.envelope.memoryMib)}Mi RAM / ` +
      `${String(catalogue.envelope.freeDiskGib)}Gi free disk\n` +
      `reserved:        ${String(catalogue.envelope.reservedCpuMillis)}m / ` +
      `${String(catalogue.envelope.reservedMemoryMib)}Mi / ${String(catalogue.envelope.reservedDiskGib)}Gi\n` +
      `budget:          ${String(budget.cpuMillis)}m / ${String(budget.memoryMib)}Mi for application REQUESTS\n`,
  );
  for (const name of catalogue.profiles) {
    const laneTotal = resourceTotal(catalogue, name, dev);
    const allTotal = resourceTotal(catalogue, name, all);
    const fits =
      laneTotal.cpuMillis <= budget.cpuMillis && laneTotal.memoryMib <= budget.memoryMib ? "FITS" : "DOES NOT FIT";
    console.log(
      `  ${name.padEnd(6)} dev lane (${String(dev.length)} apps): ` +
        `${String(laneTotal.cpuMillis).padStart(5)}m / ${String(laneTotal.memoryMib).padStart(6)}Mi  ${fits}`,
    );
    console.log(
      `  ${" ".repeat(6)} all      (${String(all.length)} apps): ` +
        `${String(allTotal.cpuMillis).padStart(5)}m / ${String(allTotal.memoryMib).padStart(6)}Mi` +
        (allTotal.unmeasured.length > 0 ? `   unmeasured: ${allTotal.unmeasured.join(", ")}` : ""),
    );
  }
  console.log(
    `\nREQUESTS ARE RESERVATIONS, NOT MEASUREMENTS. ${String(
      catalogue.ungoverned.filter((app) => app.cpuMillis === 0 && app.memoryMib === 0).length,
    )} of the ${String(all.length)} Applications render pods that request nothing at all, so they are BestEffort ` +
      `and never appear in these sums. The reserved headroom above is what they actually run in.`,
  );
}

function resourceMain(argv: readonly string[]): void {
  const catalogue = loadResourceCatalogue();
  const flag = argv.indexOf("--resource-profile");
  const profile = flag >= 0 ? (argv[flag + 1] ?? "") : "";

  if (argv.includes("--measure-runner")) {
    const findings = auditEnvelopeAgainstMachine(catalogue.envelope, measureRunner());
    for (const finding of findings) console.log(`[envelope] ${finding.claimId}: ${finding.problem}`);
    console.log(findings.length === 0 ? "runner is at least as big as the declared envelope." : "");
    process.exit(findings.length === 0 ? 0 : 1);
  }
  if (argv.includes("--resource-list") || profile === "") {
    printResourceLadder(catalogue);
    process.exit(0);
  }
  if (!catalogue.profiles.includes(profile)) {
    console.error(`unknown resource profile "${profile}"; known: ${catalogue.profiles.join(", ")}`);
    process.exit(2);
  }
  if (argv.includes("--apply")) {
    const edits = applyResourceProfile(catalogue, profile);
    console.log(`applied resource profile "${profile}": ${String(edits.length)} edit(s)`);
    for (const edit of edits) console.log(`  ${edit.path}  ${edit.field}: ${edit.from} -> ${edit.to}`);
    process.exit(0);
  }
  if (argv.includes("--budget")) {
    const findings = auditRunnerBudget(catalogue, profile);
    for (const finding of findings) console.log(`[budget] ${finding.claimId}: ${finding.problem}`);
    console.log("");
    printResourceLadder(catalogue);
    process.exit(findings.length === 0 ? 0 : 1);
  }
  const drift = verifyResourceProfileApplied(catalogue, profile);
  for (const finding of drift) console.log(`[drift] ${finding.claimId}: ${finding.problem}`);
  console.log(
    drift.length === 0
      ? `manifests match resource profile "${profile}".`
      : `\n${String(drift.length)} drift(s) from resource profile "${profile}".`,
  );
  process.exit(drift.length === 0 ? 0 : 1);
}

function main(argv: readonly string[]): void {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.error(USAGE);
    process.exit(2);
  }
  const resourceMode =
    argv.includes("--resource-list") || argv.includes("--resource-profile") || argv.includes("--measure-runner");
  if (resourceMode) {
    resourceMain(argv);
    return;
  }
  storageMain(argv);
}

if (import.meta.main) {
  main(process.argv.slice(2));
}
