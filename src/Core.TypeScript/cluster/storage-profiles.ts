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

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseAllDocuments, isCollection } from "yaml";
import { stringCompare } from "../collation/collation.ts";
import { quantityToGib } from "./single-node-readiness.ts";

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

function readField(repoRoot: string, claim: ProfileClaim, field: string): ManifestScalar {
  const abs = resolve(repoRoot, claim.path);
  if (!existsSync(abs)) return { found: false, value: null };
  const docs = parseAllDocuments(readFileSync(abs, "utf8"));
  const doc = docs[claim.docIndex];
  if (doc === undefined || !isCollection(doc.contents)) return { found: false, value: null };
  const value: unknown = doc.getIn(parseFieldPath(field), false);
  return value === undefined ? { found: false, value: null } : { found: true, value };
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

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(argv: readonly string[]): void {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.error(
      "usage: bun src/Core.TypeScript/cluster/storage-profiles.ts [--list] [--profile NAME] [--check] [--apply]",
    );
    process.exit(2);
  }
  const catalogue = loadCatalogue();
  const flag = argv.indexOf("--profile");
  const profile = flag >= 0 ? (argv[flag + 1] ?? "") : "";
  if (argv.includes("--list") || profile === "") {
    console.log("storage profiles (declared GiB = size x pods, summed over every longhorn claim):\n");
    for (const name of catalogue.profiles) {
      const total = profileTotalGib(catalogue, name);
      console.log(
        `  ${name.padEnd(10)} ${total.toFixed(0).padStart(5)} GiB declared   ` +
          `${profileBringUpGib(catalogue, name).toFixed(0).padStart(5)} GiB provisions at bring-up   ` +
          `needs ~${(total / 0.75 + 30).toFixed(0)} GiB of disk ` +
          `(Longhorn keeps 25% minimally-available, plus ~30 GiB of OS root)`,
      );
    }
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

if (import.meta.main) {
  main(process.argv.slice(2));
}
