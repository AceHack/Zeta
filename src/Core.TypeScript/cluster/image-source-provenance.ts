#!/usr/bin/env bun
// src/Core.TypeScript/cluster/image-source-provenance.ts
//
// DOES ANY MANIFEST IN THE PUBLIC ZETA TREE REFERENCE AN IMAGE NOBODY OUTSIDE
// CAN PULL?
//
// -- THE INCIDENT THIS EXISTS FOR -----------------------------------------
// `full-ai-cluster/k8s/applications/platform/blueprints-flowdent.yaml` shipped
// in this public tree for months referencing two images:
//
//   ghcr.io/flowdent/cloudservice:latest    <- Flowdent/fd-core       PRIVATE
//   ghcr.io/flowdent/fd-webclient:latest    <- Flowdent/fd-webclient  INTERNAL
//
// The `Flowdent` org reports `public_repos: 0, owned_private_repos: 9` -- there
// is no public FlowDent source for anything, so nobody who cloned Zeta could
// pull those images or rebuild them. Max's account of how it got there, via
// Aaron: "it was a multi-repo accident -- his AI checked into the wrong repo."
// An agent wrote to the wrong repository in a multi-repo setup and NOTHING
// CAUGHT IT. It surfaced months later, and only sideways: `lane-partition.ts`
// could not MEASURE the images (401) and quarantined the whole `platform`
// Application as unpriceable. The removal landed as #14250.
//
// This module is that accident turned into a red check at PR time.
//
// -- THE RULE -------------------------------------------------------------
// Aaron, 2026-08-23: "zeta should not have any private repo dependencies."
// The invariant that states is ONE-WAY DEPENDENCY -- Flowdent (closed) may
// depend on Zeta (open); Zeta may never depend on Flowdent. This file is the
// mechanical half of that sentence, so it stops being something a reviewer has
// to remember during a multi-repo split.
//
// -- OBTAINABILITY IS THE PREDICATE, NOT OWNERSHIP -------------------------
// The tempting rule is "no foreign images", and it is wrong. This tree pulls
// `docker.io/bitnamilegacy/*`, `quay.io/kubevirt/*`, `ghcr.io/ich777/*` and a
// dozen others that nobody here owns, and every one of them is fine: anyone who
// clones this repository can pull them. The defect is not FOREIGN, it is
// UNOBTAINABLE -- a public tree whose deployment depends on artifacts an
// outsider cannot fetch. That is the same defect class as
// `.claude/rules/clone-at-tag-stays-sufficient.md`: a tree that the person
// holding it cannot build or deploy.
//
// So the operative measurement is an ANONYMOUS registry pull. It is the
// falsifier, and it is the property an outsider actually has:
//
//   200 -> the artifact is obtainable by anyone.                  ALLOWED
//   401/403 -> the door is closed to an outsider.                 REFUSED
//
// `org.opencontainers.image.source` is read too, but for a different job: it
// says WHOSE door it is, which decides WHICH REMEDY the message prints. The two
// remedies are opposite and must never be confused:
//
//   ours, private     -> PUBLISH IT.  The reference stays; the package opens.
//   foreign, private  -> REMOVE IT.   The reference goes; nothing here can open it.
//
// -- UNKNOWN NEVER PASSES -------------------------------------------------
// An image the ledger does not cover FAILS. Not skips. This is the same stance
// `src/Core/DerivationProtocol.fs` takes for licences (`Wall.Whitebox`: an
// unknown or unheld licence BLOCKS; unknown is not permissive), and the reason
// is the failure mode this whole repository is organised against -- an
// unchecked reference must never be indistinguishable, in an exit code, from a
// checked one.
//
// -- WHY THE GATE IS OFFLINE, AND WHAT THE NETWORK HALF IS FOR -------------
// Resolving 30 references against 6 registries on every PR would make this
// repository's gate depend on other people's uptime, redden changes that touch
// nothing near the cluster, and get switched off the week after. So the work is
// split by change rate (DV2.0), exactly as `audit-chart-target-revisions.ts`
// splits it:
//
//   OFFLINE (default, PR-blocking).  Every image reference in the tree is
//   resolved against `full-ai-cluster/k8s/image-source-provenance.json`, a
//   checked-in snapshot of what each registry answered an anonymous client.
//   No sockets. This is what runs in gate.yml's cross-verify floor.
//
//   NETWORK (`--refresh`, scheduled, NEVER PR-blocking).  Re-measures every
//   repository and rewrites the snapshot. Allowed to fail loudly.
//
// The snapshot is dated evidence, not an oracle. It says "as of <resolvedAt>,
// an anonymous client got this answer".
//
// -- WHY THIS IS NOT A FOURTH SCANNER -------------------------------------
// Three modules already walk these manifests, and each answers a different
// question. Checked before writing this one:
//
//   lane-partition.ts        CAN THIS LANE BE PRICED? (capacity). Its
//                            "unmeasurable" set is a superset of ours by
//                            accident -- it lumps 401 (closed), 404 (withdrawn)
//                            and 429 (rate-limited) into one bucket because for
//                            SIZING they are the same answer. For PROVENANCE
//                            they are three different verdicts with three
//                            different remedies. Conflating them is what let a
//                            private-source dependency read as a measurement
//                            problem for months.
//   vendored-upstream-parity.ts  DO THE COMMITTED BYTES STILL MATCH UPSTREAM?
//                            (file-level parity for two vendored operators).
//   audit-chart-target-revisions.ts  DOES THIS CHART PIN RESOLVE? (versions).
//
// Rather than re-parse, this file REUSES `imagesInDocuments` and
// `parseImageReference` from `image-footprint.ts`. There is exactly one image
// walker and one reference parser in this repository and this is not a new one.
//
// -- WHAT THIS DELIBERATELY DOES NOT OWN ----------------------------------
// A 404 is the registry saying "the repository is OPEN and this TAG is not in
// it" -- a broken pin, not a closed door, and `lane-partition.ts`'s quarantine
// owns it. Those are recorded with their status and PRINTED, and they do not
// redden this gate.
//
// Said out loud because it leaves a hole: on a registry that 404s a live
// repository's missing tag, DELETING a private package would move its verdict
// from refused to reported. The hole is narrow -- measured 2026-08-23, both
// ghcr.io and Docker Hub answer 401, never 404, for a repository that does not
// exist (`ghcr.io/lucent-financial-group/hat-system-operator`, which the
// packages API reports absent, and `docker.io/library/agentic-org-worker`,
// which nobody ever pushed) -- and the manifest is broken either way. Naming it
// beats pretending it is not there.
//
// -- THE ACKNOWLEDGEMENT REGISTER, AND WHAT IT MAY NEVER COVER ------------
// Findings that are OURS get a dated, work-item-owned acknowledgement rather
// than a red gate on the day this lands, because they are PRE-EXISTING: a check
// that is red from birth is a check that is learned-to-ignore within a week,
// and this repository has that receipt already. Every acknowledgement is
// drift-checked in BOTH directions -- one whose image left the tree, or whose
// package became obtainable, is itself a finding. That is what separates a
// dated acknowledgement from an allowlist; an allowlist only ever goes quiet.
//
// The register may cover ONLY an `ours-*` class, and `acknowledgeable()` is
// checked on every run rather than trusted. A `foreign-private` image is
// UNCONDITIONALLY red and cannot be acknowledged, because the one-way rule is
// not a scheduling problem: there is no lift condition we control. That refusal
// is what makes this file an encoding of Aaron's sentence rather than a report
// about it.
//
// -- A MEASUREMENT THAT MOVED WHILE THIS WAS BEING WRITTEN -----------------
// Recorded because the register is only honest if its history is. This file was
// drafted with `zeta-portal` and `zeta-platform-controller` acknowledged as
// ours-private: measured 15:52 UTC 2026-08-23, both 401, both reporting
// `visibility: private` from the packages API. Re-measured at 16:14 the same
// afternoon: both 200, both `public`. Aaron performed the two Danger Zone
// clicks in between. The acknowledgements were DELETED rather than kept, which
// is what the staleness check would have forced one run later anyway.
//
// Usage:
//   bun src/Core.TypeScript/cluster/image-source-provenance.ts
//   bun src/Core.TypeScript/cluster/image-source-provenance.ts --json
//   bun src/Core.TypeScript/cluster/image-source-provenance.ts --refresh
//
// Exit codes: 0 clean, 1 findings (under --refresh: the snapshot changed), 2 usage/IO.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { parseAllDocuments } from "yaml";
import { imagesInDocuments, parseImageReference } from "./image-footprint.ts";
import { stringCompare } from "../collation/collation.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

export const LEDGER_PATH = "full-ai-cluster/k8s/image-source-provenance.json";
export const REFRESH_COMMAND = "bun src/Core.TypeScript/cluster/image-source-provenance.ts --refresh";

/**
 * Namespaces whose remedy is PUBLISH rather than REMOVE.
 *
 * Deliberately a registry-namespace list and not an inference: `ghcr.io/<org>`
 * is the only thing an OFFLINE check can read off a reference, and the whole
 * point of the ours/foreign split is that the two remedies are opposite. The
 * `--refresh` half cross-checks it against the resolved source repository owner
 * and disagreement is a finding, so this constant cannot quietly drift into
 * covering someone else's namespace.
 */
export const OUR_NAMESPACES: readonly string[] = ["ghcr.io/lucent-financial-group"];

/** GitHub owners whose repositories are ours. Matched case-insensitively. */
export const OUR_OWNERS: readonly string[] = ["lucent-financial-group"];

/**
 * Tracked YAML outside these prefixes is scanned. An EXCLUSION list rather than
 * a roster of manifest roots, and the direction matters: a roster goes stale
 * silently the day someone adds `deploy/` (which is exactly how a manifest
 * directory stays invisible), whereas a new tree under an unexcluded path is
 * scanned the moment it lands and fails until its images are resolved.
 */
export const EXCLUDED_PREFIXES: readonly string[] = [
  // Prose, worked examples and archived PR bodies. Never applied to a cluster.
  "docs/",
  // Mirrored third-party source. Not our code, gigabytes, and explicitly not
  // scanned by anything here (CLAUDE.md "references/prior-art/").
  "references/",
  // CI job definitions. Measured 2026-08-23: NO workflow in this tree carries a
  // `image:` container reference -- `build-platform-images.yml` matches on
  // `image:` only inside its own matrix keys and its `--label` arguments. If
  // one ever appears, this exclusion is the thing to revisit.
  ".github/",
  // The check's own fixtures. A fixture exists to be red.
  "src/Core.TypeScript/cluster/testdata/image-provenance/",
];

// ---------------------------------------------------------------------------
// References out of the tree
// ---------------------------------------------------------------------------

export interface ImageUse {
  /** The reference exactly as the manifest writes it, tag and all. */
  readonly image: string;
  /** Repo-relative manifest paths that carry it, ordinal-sorted. */
  readonly manifests: readonly string[];
}

/** `host/repository` -- provenance is a property of the repository, not the tag. */
export function repositoryKey(image: string): string {
  const p = parseImageReference(image);
  return `${p.host}/${p.repository}`;
}

/** Tracked `*.yaml` / `*.yml` outside {@link EXCLUDED_PREFIXES}. */
export function manifestFiles(repoRoot = REPO_ROOT): readonly string[] {
  // Explicit args[] array, never a shell string: no shell, no injection.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const out = execFileSync("git", ["ls-files", "-z", "*.yaml", "*.yml"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split("\0")
    .filter((f) => f !== "" && !EXCLUDED_PREFIXES.some((p) => f.startsWith(p)))
    .sort(stringCompare);
}

/**
 * Every image reference in the scanned manifests, keyed by the reference string.
 *
 * A manifest that will not parse is a FINDING, never a skip -- an unparseable
 * file is precisely where an unreviewed reference would hide.
 */
export function collectImageUses(
  repoRoot = REPO_ROOT,
  files: readonly string[] = manifestFiles(repoRoot),
): {
  readonly uses: readonly ImageUse[];
  readonly unparseable: readonly string[];
  readonly manifestCount: number;
} {
  const byImage = new Map<string, string[]>();
  const unparseable: string[] = [];
  for (const rel of files) {
    const text = readFileSync(resolve(repoRoot, rel), "utf8");
    // PREFILTER. `imagesInDocuments` only ever matches a mapping key spelled
    // `image`, and YAML anchors do not cross files, so a document whose bytes
    // never contain the substring `image` cannot declare one. Skipping those
    // takes the scan from 209 files to 49 and from ~4.5s to well under a second
    // -- which matters because this runs on the cross-verify floor of every PR.
    //
    // The cost is stated rather than hidden: a malformed YAML file with no
    // `image` text is no longer reported here. That is the correct scope (it
    // cannot carry an image reference) and it is NOT a general YAML lint; one
    // such file exists on main today and is filed separately.
    if (!text.includes("image")) continue;
    let documents: unknown[];
    try {
      // `parseAllDocuments` COLLECTS errors rather than throwing, so a
      // try/catch alone reads a malformed file as an empty one -- a check that
      // did not run, wearing a pass. `doc.errors` is the real signal.
      const parsed = parseAllDocuments(text);
      if (parsed.some((d) => d.errors.length > 0)) {
        unparseable.push(rel);
        continue;
      }
      documents = parsed.map((d): unknown => d.toJS() as unknown);
    } catch {
      unparseable.push(rel);
      continue;
    }
    for (const image of imagesInDocuments(documents)) {
      const list = byImage.get(image);
      if (list === undefined) byImage.set(image, [rel]);
      else if (!list.includes(rel)) list.push(rel);
    }
  }
  const uses = [...byImage.entries()]
    .map(([image, manifests]) => ({ image, manifests: [...manifests].sort(stringCompare) }))
    .sort((a, b) => stringCompare(a.image, b.image));
  return { uses, unparseable, manifestCount: files.length };
}

// ---------------------------------------------------------------------------
// The ledger
// ---------------------------------------------------------------------------

/**
 * What an ANONYMOUS client got when it asked the registry for a repository.
 *
 * The 401-vs-404 split is the load-bearing distinction and it is not what a
 * reader expects, so it is written down rather than left to be inferred:
 *
 *   401/403  the REPOSITORY is closed to an outsider -- OR does not exist at
 *            all. Both ghcr.io and Docker Hub answer 401 for a repository that
 *            was never created (measured 2026-08-23:
 *            `ghcr.io/lucent-financial-group/hat-system-operator`, which the
 *            packages API reports as "Package not found", and
 *            `docker.io/library/agentic-org-worker`, which nobody ever pushed).
 *            A registry deliberately refuses to distinguish the two, because
 *            saying "that one is private" leaks the private thing's existence.
 *            For THIS rule the conflation is harmless in the direction that
 *            matters: an outsider cannot pull either one.
 *
 *   404      the repository is OPEN and this TAG is not in it. That is a broken
 *            pin, not a closed door, and it is `lane-partition.ts`'s quarantine
 *            that owns it.
 */
export type ArtifactAccess = "public" | "denied" | "tag-absent" | "unreachable";

/** How {@link LedgerEntry.sourceRepo} was learned. `none` means it was not. */
export type SourceEvidence = "oci-label" | "ghcr-package" | "none";

/** Whether the SOURCE repository behind an image is open, closed, or unsaid. */
export type Visibility = "public" | "private" | "unknown";

/** Whether the GHCR packages API could see a package at all. */
export type PackagePresence = "found" | "absent" | "unreadable" | "not-ghcr";

export interface LedgerEntry {
  /** `host/repository`, the key. Provenance is a property of the repository. */
  readonly repository: string;
  /**
   * Every tag this tree references, with the HTTP status an anonymous manifest
   * request returned for it.
   *
   * Per-TAG rather than one sample, because one sample lies in a way that is
   * silent. The case that forced it, measured 2026-08-23:
   * `ghcr.io/ich777/steamcmd` was referenced at three tags, of which
   * `armareforger` 404d and the other two were 200 — whichever the refresh had
   * happened to pick would have set the repository's whole verdict. (Main
   * replaced that tag with `ghcr.io/acemod/arma-reforger` hours later, which is
   * the point: the shape recurs, the instance does not last.)
   */
  readonly tags: Readonly<Record<string, number>>;
  readonly artifact: ArtifactAccess;
  /** `owner/name` on GitHub, or null when nothing said. */
  readonly sourceRepo: string | null;
  readonly sourceEvidence: SourceEvidence;
  readonly sourceVisibility: Visibility;
  readonly packagePresence: PackagePresence;
  /** ISO date the measurement above was taken. */
  readonly resolvedAt: string;
  /** Free text. Present only where a reader would otherwise have to guess. */
  readonly note?: string;
}

export interface Ledger {
  readonly $comment: string;
  readonly entries: readonly LedgerEntry[];
}

export function loadLedger(repoRoot = REPO_ROOT): Ledger {
  const parsed: unknown = JSON.parse(readFileSync(resolve(repoRoot, LEDGER_PATH), "utf8"));
  return parsed as Ledger;
}

/**
 * Fold per-tag statuses into one repository-level access answer.
 *
 * `public` wins over everything: if ANY referenced tag is anonymously pullable,
 * the repository's door is open and a 404 elsewhere is a tag problem.
 */
export function foldAccess(tags: Readonly<Record<string, number>>): ArtifactAccess {
  const statuses = Object.values(tags);
  if (statuses.length === 0) return "unreachable";
  if (statuses.some((s) => s >= 200 && s < 300)) return "public";
  if (statuses.every((s) => s === 401 || s === 403)) return "denied";
  if (statuses.some((s) => s === 404)) return "tag-absent";
  return "unreachable";
}

// ---------------------------------------------------------------------------
// Built in this tree, never pushed
// ---------------------------------------------------------------------------

/**
 * Images this repository BUILDS and side-loads, which therefore have no
 * registry coordinate at all.
 *
 * `agentic-organization/deploy/k8s/30-worker.yaml` names
 * `agentic-org-worker:keepalive` with `imagePullPolicy: IfNotPresent`: the
 * image is built from `agentic-organization/Dockerfile` and loaded into the
 * local kind/k3d node. Nobody can pull it, and nobody needs to -- everyone who
 * clones this tree can BUILD it, which is exactly the property
 * `clone-at-tag-stays-sufficient` asks for.
 *
 * THE EXEMPTION IS CHECKED, NOT ASSERTED. The build recipe below must exist as
 * a committed file, verified offline on every run. Delete the Dockerfile and
 * the exemption evaporates and the image is refused -- which is the same
 * condition `no-binary-in-proof-lineage` puts on its one exception
 * ("reproducible from committed source"). An exemption with no falsifier is a
 * licence, and this repository has enough of those on file to know better.
 *
 * It is NOT syntactically detectable, and that is worth saying because the
 * obvious implementation is wrong: `agentic-org-worker:keepalive` and
 * `postgres:16-alpine` are the same SHAPE -- a bare name and a tag. Only the
 * registry's answer separates them, so the exemption has to be named.
 */
export const BUILT_IN_TREE: ReadonlyMap<string, string> = new Map([
  ["registry-1.docker.io/library/agentic-org-worker", "agentic-organization/Dockerfile"],
]);

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

/**
 * Derived from the entry on every run, never stored.
 *
 * A stored verdict is a hand-written allowlist wearing a measurement's clothes:
 * someone edits `"verdict": "allowed"` and the evidence beside it stops
 * mattering. The measurement is committed; the judgement is computed.
 */
export type ImageClass =
  | "obtainable"
  | "built-in-tree"
  | "tag-absent"
  | "ours-private"
  | "ours-unpublished"
  | "foreign-private"
  | "unreachable";

export function classify(entry: LedgerEntry, builtInTree: ReadonlySet<string>): ImageClass {
  if (builtInTree.has(entry.repository)) return "built-in-tree";
  if (entry.artifact === "public") return "obtainable";
  if (entry.artifact === "tag-absent") return "tag-absent";
  if (entry.artifact === "unreachable") return "unreachable";
  const ours =
    OUR_NAMESPACES.some((ns) => entry.repository.toLowerCase().startsWith(`${ns}/`)) ||
    (entry.sourceRepo !== null && OUR_OWNERS.includes((entry.sourceRepo.split("/")[0] ?? "").toLowerCase()));
  if (!ours) return "foreign-private";
  return entry.packagePresence === "absent" ? "ours-unpublished" : "ours-private";
}

/**
 * Classes that REFUSE.
 *
 * `tag-absent` and `unreachable` are REPORTED, not refused, and the boundary is
 * deliberate: a 404 tag is a broken pin that `lane-partition.ts` already
 * quarantines, and a transient network answer must never decide a gate. Said
 * out loud because it leaves a hole: DELETING a private package moves its
 * verdict from `denied` to `tag-absent` on registries that 404 a live
 * repository's missing tag. It is narrow -- the manifest is broken either way,
 * and both ghcr.io and Docker Hub answer 401 (not 404) for a repository that
 * does not exist -- and pretending it is not there would be worse.
 */
export function refuses(cls: ImageClass): boolean {
  return cls === "ours-private" || cls === "ours-unpublished" || cls === "foreign-private";
}

/** Classes the acknowledgement register is permitted to absorb. */
export function acknowledgeable(cls: ImageClass): boolean {
  return cls === "ours-private" || cls === "ours-unpublished";
}

export function remedy(cls: ImageClass, entry: LedgerEntry): string {
  const pkg = entry.repository.split("/").pop() ?? entry.repository;
  switch (cls) {
    case "ours-private":
      return (
        "OURS, PRIVATE -> PUBLISH IT. The reference stays; the package opens. GitHub exposes " +
        "container-package visibility ONLY in the UI (there is no API for it): " +
        `https://github.com/orgs/Lucent-Financial-Group/packages/container/${pkg}/settings` +
        " -> Danger Zone -> Change visibility -> Public. Then re-run " +
        REFRESH_COMMAND +
        "."
      );
    case "ours-unpublished":
      return (
        "OURS, NEVER PUBLISHED -> BUILD AND PUSH IT (the packages API reports no package under " +
        `this name, so there is nothing to make public yet). A manifest naming ghcr.io/.../${pkg} ` +
        "that no workflow builds is a reference nobody -- including us -- can pull. Either add a " +
        "build+push workflow (see .github/workflows/build-platform-images.yml for the shape, " +
        "including the `org.opencontainers.image.source` label) or remove the manifest."
      );
    case "foreign-private":
      return (
        "FOREIGN, CLOSED -> REMOVE IT. Zeta is public and may not depend on a repository outsiders " +
        "cannot reach. The one-way rule: a closed repo may depend on Zeta; Zeta may NEVER depend on " +
        "a closed repo. Move the manifest into the repository that owns the image. If you believe " +
        "the image IS public, publish `org.opencontainers.image.source` on it and re-run " +
        REFRESH_COMMAND +
        " so the provenance is measured rather than argued."
      );
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// The acknowledgement register
// ---------------------------------------------------------------------------

export interface Acknowledgement {
  /** The work-item that owns the fix. Mandatory. */
  readonly workitem: string;
  /** ISO date recorded. Mandatory. */
  readonly recordedOn: string;
  /** Why it is not simply fixed here, and what LIFTS it. Mandatory. */
  readonly reason: string;
}

/**
 * ONLY an `ours-*` class may appear here, and `acknowledgeable()` is checked on
 * every run rather than trusted -- a register whose scope is merely documented
 * is the shape that lets the next Flowdent through.
 *
 * A `foreign-private` image is UNCONDITIONALLY red and cannot be acknowledged,
 * because the one-way rule is not a scheduling problem: there is no lift
 * condition we control. That refusal is what makes this file an encoding of
 * Aaron's sentence rather than a report about it.
 *
 * WHAT IS NOT HERE, and why that is the interesting part. This register was
 * drafted 2026-08-23 with two entries -- `zeta-portal` and
 * `zeta-platform-controller`, both measured `401` at 15:52 UTC. Re-measured at
 * 16:14 the same afternoon, both answered `200`: Aaron performed the two Danger
 * Zone clicks while this file was being written. The entries were deleted
 * rather than kept "for safety", which is what the staleness check would have
 * forced anyway one run later.
 */
export const ACKNOWLEDGED_PRIVATE: ReadonlyMap<string, Acknowledgement> = new Map([
  [
    "ghcr.io/lucent-financial-group/zeta-orleans-silo",
    {
      workitem: "081M0QNFBZ0087G0R000N3RXGF",
      recordedOn: "2026-08-23",
      reason:
        "OURS, NEVER BUILT. The packages API reports no `zeta-orleans-silo` package under " +
        "Lucent-Financial-Group and no workflow in this tree builds one; three manifests name it " +
        "anyway (the finding prints them, so this reason does not repeat paths that will move). " +
        "PRE-EXISTING, not introduced by the change that added this check -- `orleans` is already " +
        "in lane-partition.ts's unpriced quarantine for exactly this reason, and " +
        "docs/research/2026-08-21-what-each-deferred-argocd-application-needs-to-boot.md records it. " +
        "LIFTS WHEN: a build+push workflow publishes the package, --refresh records artifact: public, " +
        "and this entry then goes STALE and fails.",
    },
  ],
  [
    "ghcr.io/lucent-financial-group/hat-system-operator",
    {
      workitem: "081M0QNFBZ0087G0R000N3RXGF",
      recordedOn: "2026-08-23",
      reason:
        "OURS, NEVER BUILT, and the manifest says so in the reference itself: the tag is literally " +
        "`:placeholder`. Same case as zeta-orleans-silo -- no package, no build workflow, and " +
        "`hat-system` is already in lane-partition.ts's unpriced quarantine. " +
        "LIFTS WHEN: --refresh records artifact: public.",
    },
  ],
]);

// ---------------------------------------------------------------------------
// The audit
// ---------------------------------------------------------------------------

export type FindingRule =
  | "manifest-unparseable"
  | "ledger-entry-missing"
  | "ledger-entry-orphaned"
  | "ledger-tag-missing"
  | "ledger-access-disagrees"
  | "private-source-dependency"
  | "build-recipe-missing"
  | "exemption-orphaned"
  | "acknowledgement-stale"
  | "acknowledgement-out-of-scope"
  | "no-images-found";

export interface Finding {
  readonly rule: FindingRule;
  readonly subject: string;
  readonly detail: string;
  /** True when an acknowledgement absorbed it: printed loudly, exit code clean. */
  readonly acknowledged: boolean;
}

export interface AuditResult {
  readonly findings: readonly Finding[];
  readonly byClass: ReadonlyMap<ImageClass, readonly string[]>;
  readonly imageCount: number;
  readonly manifestCount: number;
}

/** Live exemptions plus the findings that killed the dead ones. */
function resolveExemptions(
  repoRoot: string,
  builtInTree: ReadonlyMap<string, string>,
  referenced: ReadonlySet<string>,
  findings: Finding[],
): Set<string> {
  const live = new Set<string>();
  for (const [key, recipe] of builtInTree) {
    if (!referenced.has(key)) {
      findings.push({
        rule: "exemption-orphaned",
        subject: key,
        detail:
          "exempt as built-in-tree, but no manifest in the tree references it. A standing exemption for " +
          "an image nobody uses is dead config that will quietly cover the next image to take the name.",
        acknowledged: false,
      });
      continue;
    }
    if (existsSync(resolve(repoRoot, recipe))) {
      live.add(key);
      continue;
    }
    findings.push({
      rule: "build-recipe-missing",
      subject: key,
      detail:
        `exempt as built-in-tree on the strength of \`${recipe}\`, which does not exist. The exemption ` +
        "is CHECKED, not asserted: with no committed build recipe there is nothing anyone who clones " +
        "this tree could build, and the image is refused like any other unobtainable reference.",
      acknowledged: false,
    });
  }
  return live;
}

/**
 * The ledger row for one use, or the finding that says why there is none.
 *
 * Every return path lands the reference in exactly one bucket. There is no
 * silent skip, because a skipped reference is indistinguishable in an exit code
 * from a checked one — which is the whole defect this module exists for.
 */
function ledgerRowFor(
  use: ImageUse,
  byKey: ReadonlyMap<string, LedgerEntry>,
): { entry: LedgerEntry; tag: string } | Finding {
  const key = repositoryKey(use.image);
  const tag = parseImageReference(use.image).reference;
  const entry = byKey.get(key);
  if (entry === undefined) {
    return {
      rule: "ledger-entry-missing",
      subject: use.image,
      detail:
        `no provenance recorded for ${key} (referenced by ${use.manifests.join(", ")}). ` +
        "UNKNOWN PROVENANCE DOES NOT PASS -- an unchecked reference must never be " +
        "indistinguishable, in an exit code, from a checked one. Run `" +
        REFRESH_COMMAND +
        "` to measure it; if it is ours, make sure the build publishes " +
        "`org.opencontainers.image.source` so provenance is readable off the image itself.",
      acknowledged: false,
    };
  }
  if (!Object.hasOwn(entry.tags, tag)) {
    const measured = Object.keys(entry.tags).join(", ");
    return {
      rule: "ledger-tag-missing",
      subject: use.image,
      detail:
        `${key} is in the ledger but tag \`${tag}\` was never measured (measured: ` +
        `${measured === "" ? "<none>" : measured}). A tag bump is a new artifact and gets a new ` +
        "measurement. Run `" +
        REFRESH_COMMAND +
        "`.",
      acknowledged: false,
    };
  }
  if (foldAccess(entry.tags) !== entry.artifact) {
    return {
      rule: "ledger-access-disagrees",
      subject: key,
      detail:
        `the stored verdict \`${entry.artifact}\` does not fold from the stored per-tag statuses ` +
        `(${JSON.stringify(entry.tags)} folds to \`${foldAccess(entry.tags)}\`). The ledger has been ` +
        "hand-edited or written by a stale tool; regenerate it with `" +
        REFRESH_COMMAND +
        "`.",
      acknowledged: false,
    };
  }
  return { entry, tag };
}

function refusalFinding(
  use: ImageUse,
  entry: LedgerEntry,
  tag: string,
  cls: ImageClass,
  ack: Acknowledgement | undefined,
): Finding {
  const status = entry.tags[tag];
  const base =
    `${use.image} (referenced by ${use.manifests.join(", ")}): anonymous pull returned ` +
    `${String(status)} as of ${entry.resolvedAt}. source=${entry.sourceRepo ?? "<unknown>"} ` +
    `(${entry.sourceEvidence}), source repo visibility=${entry.sourceVisibility}, ` +
    `package=${entry.packagePresence}. ` +
    remedy(cls, entry);
  if (ack === undefined) {
    return { rule: "private-source-dependency", subject: use.image, detail: base, acknowledged: false };
  }
  return {
    rule: "private-source-dependency",
    subject: use.image,
    detail: `${base}\n      ACKNOWLEDGED ${ack.recordedOn} (${ack.workitem}): ${ack.reason}`,
    acknowledged: true,
  };
}

/** Acknowledgements pointing at a class the register may not cover. */
function outOfScopeFindings(
  acknowledgements: ReadonlyMap<string, Acknowledgement>,
  byKey: ReadonlyMap<string, LedgerEntry>,
  liveExemptions: ReadonlySet<string>,
): readonly Finding[] {
  const out: Finding[] = [];
  for (const [key, ack] of acknowledgements) {
    const entry = byKey.get(key);
    if (entry === undefined) continue;
    const cls = classify(entry, liveExemptions);
    // Only a class that REFUSES can be out of scope. One that stopped refusing
    // is a STALE acknowledgement, reported with the message that says so --
    // getting these two the wrong way round tells a reader to delete a
    // reference when the truth is that someone already published it.
    if (!refuses(cls) || acknowledgeable(cls)) continue;
    out.push({
      rule: "acknowledgement-out-of-scope",
      subject: key,
      detail:
        `acknowledged (${ack.workitem}) but classifies as ${cls}. The register covers ` +
        "ours-private / ours-unpublished ONLY: a foreign closed dependency has no lift condition we " +
        "control, so it is unconditionally red. Remove the reference, not the finding.",
      acknowledged: false,
    });
  }
  return out;
}

/**
 * Drift in BOTH directions -- a ledger row nothing references, and an
 * acknowledgement that stopped applying.
 *
 * Both halves matter: stale evidence reads exactly like live evidence, and a
 * register that only ever grows quiet is an allowlist.
 */
function driftFindings(
  byKey: ReadonlyMap<string, LedgerEntry>,
  referenced: ReadonlySet<string>,
  acknowledgements: ReadonlyMap<string, Acknowledgement>,
  used: ReadonlySet<string>,
  outOfScopeKeys: ReadonlySet<string>,
): readonly Finding[] {
  const out: Finding[] = [];
  for (const entry of byKey.values()) {
    if (referenced.has(entry.repository)) continue;
    out.push({
      rule: "ledger-entry-orphaned",
      subject: entry.repository,
      detail:
        "recorded in the ledger but no manifest in the tree references it. Stale evidence reads " +
        "exactly like live evidence; regenerate with `" +
        REFRESH_COMMAND +
        "`.",
      acknowledged: false,
    });
  }
  for (const [key, ack] of acknowledgements) {
    if (used.has(key) || outOfScopeKeys.has(key)) continue;
    out.push({
      rule: "acknowledgement-stale",
      subject: key,
      detail:
        `acknowledged ${ack.recordedOn} (${ack.workitem}) but it no longer produces a finding -- either ` +
        "the image left the tree or the package became obtainable. Delete the acknowledgement. A " +
        "register that only ever grows quiet is an allowlist.",
      acknowledged: false,
    });
  }
  return out;
}

export function audit(
  repoRoot = REPO_ROOT,
  acknowledgements: ReadonlyMap<string, Acknowledgement> = ACKNOWLEDGED_PRIVATE,
  builtInTree: ReadonlyMap<string, string> = BUILT_IN_TREE,
): AuditResult {
  const findings: Finding[] = [];
  const { uses, unparseable, manifestCount } = collectImageUses(repoRoot);

  for (const f of unparseable) {
    findings.push({
      rule: "manifest-unparseable",
      subject: f,
      detail:
        "YAML would not parse, so its image references could not be read. An unreadable manifest is " +
        "exactly where an unreviewed reference hides, so this is a finding and never a skip.",
      acknowledged: false,
    });
  }

  const referenced = new Set(uses.map((u) => repositoryKey(u.image)));
  const liveExemptions = resolveExemptions(repoRoot, builtInTree, referenced, findings);
  const byKey = new Map(loadLedger(repoRoot).entries.map((e) => [e.repository, e]));

  const outOfScope = outOfScopeFindings(acknowledgements, byKey, liveExemptions);
  findings.push(...outOfScope);
  const outOfScopeKeys = new Set(outOfScope.map((f) => f.subject));

  const byClass = new Map<ImageClass, string[]>();
  const usedAcknowledgements = new Set<string>();

  for (const use of uses) {
    const row = ledgerRowFor(use, byKey);
    if ("rule" in row) {
      findings.push(row);
      continue;
    }
    const cls = classify(row.entry, liveExemptions);
    const list = byClass.get(cls);
    if (list === undefined) byClass.set(cls, [use.image]);
    else if (!list.includes(use.image)) list.push(use.image);
    if (!refuses(cls)) continue;
    const key = repositoryKey(use.image);
    const ack = acknowledgeable(cls) ? acknowledgements.get(key) : undefined;
    if (ack !== undefined) usedAcknowledgements.add(key);
    findings.push(refusalFinding(use, row.entry, row.tag, cls, ack));
  }

  findings.push(...driftFindings(byKey, referenced, acknowledgements, usedAcknowledgements, outOfScopeKeys));

  if (uses.length === 0) {
    findings.push({
      rule: "no-images-found",
      subject: "(tree)",
      detail:
        `${String(manifestCount)} manifest(s) scanned and NOT ONE image reference found. A scanner that ` +
        "finds nothing reports green having checked nothing -- the vacuity class in its purest form. Refusing.",
      acknowledged: false,
    });
  }

  return { findings, byClass, imageCount: uses.length, manifestCount };
}

// ---------------------------------------------------------------------------
// The network half (`--refresh`)
// ---------------------------------------------------------------------------

const MANIFEST_ACCEPT = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");

/** An ANONYMOUS pull token. Deliberately unauthenticated: that IS the measurement. */
async function anonymousToken(host: string, repository: string): Promise<string | null> {
  const service = host === "registry-1.docker.io" ? "registry.docker.io" : host;
  const realm = host === "registry-1.docker.io" ? "https://auth.docker.io/token" : `https://${host}/token`;
  try {
    const scope = encodeURIComponent(`repository:${repository}:pull`);
    const r = await fetch(`${realm}?service=${encodeURIComponent(service)}&scope=${scope}`);
    if (!r.ok) return null;
    const body = (await r.json()) as { token?: string; access_token?: string };
    return body.token ?? body.access_token ?? null;
  } catch {
    return null;
  }
}

/** Only the fields this module reads. A registry sends far more. */
interface RegistryManifest {
  readonly manifests?: readonly { readonly digest: string; readonly platform?: { os?: string; architecture?: string } }[];
  readonly config?: { readonly digest?: string };
}

export interface ResolveResult {
  readonly status: number;
  readonly sourceRepo: string | null;
  readonly sourceEvidence: SourceEvidence;
}

/** Measure one reference exactly as an anonymous outsider would experience it. */
export async function resolveProvenance(image: string): Promise<ResolveResult> {
  const p = parseImageReference(image);
  const token = await anonymousToken(p.host, p.repository);
  const headers: Record<string, string> = { Accept: MANIFEST_ACCEPT };
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetch(`https://${p.host}/v2/${p.repository}/manifests/${p.reference}`, { headers });
  } catch {
    return { status: 0, sourceRepo: null, sourceEvidence: "none" };
  }
  const status = response.status;
  if (!response.ok) return { status, sourceRepo: null, sourceEvidence: "none" };

  const first: unknown = await response.json();
  let manifest = first as RegistryManifest;
  const children = manifest.manifests ?? [];
  const [head] = children;
  if (head !== undefined) {
    const linuxAmd64 = children.find((m) => m.platform?.os === "linux" && m.platform.architecture === "amd64");
    const pick = linuxAmd64 ?? head;
    const nested = await fetch(`https://${p.host}/v2/${p.repository}/manifests/${pick.digest}`, { headers });
    if (!nested.ok) return { status, sourceRepo: null, sourceEvidence: "none" };
    const body: unknown = await nested.json();
    manifest = body as RegistryManifest;
  }
  const configDigest = manifest.config?.digest;
  if (configDigest === undefined) return { status, sourceRepo: null, sourceEvidence: "none" };
  const blob = await fetch(`https://${p.host}/v2/${p.repository}/blobs/${configDigest}`, { headers });
  if (!blob.ok) return { status, sourceRepo: null, sourceEvidence: "none" };
  const configBody: unknown = await blob.json();
  const config = configBody as { config?: { Labels?: Record<string, string> } };
  const label = config.config?.Labels?.["org.opencontainers.image.source"];
  if (label === undefined || label === "") return { status, sourceRepo: null, sourceEvidence: "none" };
  const m = /github\.com\/([^/]+)\/([^/#?]+)/.exec(label);
  const owner = m?.[1];
  const name = m?.[2];
  if (owner === undefined || name === undefined) return { status, sourceRepo: label, sourceEvidence: "oci-label" };
  const bare = name.replace(/\.git$/, "");
  return { status, sourceRepo: `${owner}/${bare}`, sourceEvidence: "oci-label" };
}

/**
 * The GHCR packages API, which answers where the OCI label cannot.
 *
 * A DENIED artifact has no readable config blob, so the label route is closed
 * exactly when provenance matters most. The package's own `repository` link is
 * the remaining route -- and it is what the original Flowdent investigation
 * used, so this is the same evidence path, mechanised.
 */
function ghcrPackage(owner: string, name: string): {
  presence: PackagePresence;
  repository: string | null;
  repositoryPrivate: boolean | null;
} {
  for (const kind of ["orgs", "users"] as const) {
    try {
      // Explicit args[] array, never a shell string.
      // eslint-disable-next-line sonarjs/no-os-command-from-path
      const out = execFileSync("gh", ["api", `/${kind}/${owner}/packages/container/${encodeURIComponent(name)}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const parsed: unknown = JSON.parse(out);
      const j = parsed as { repository?: { full_name?: string; private?: boolean } };
      return {
        presence: "found",
        repository: j.repository?.full_name ?? null,
        repositoryPrivate: j.repository?.private ?? null,
      };
    } catch {
      continue;
    }
  }
  // `gh` absent, unauthenticated, or the package genuinely not there. The two
  // are not distinguishable from an exit code, so the caller is told `absent`
  // ONLY when `gh` itself is usable -- see refresh().
  return { presence: "absent", repository: null, repositoryPrivate: null };
}

/**
 * Is `gh` present AND carrying a token this API will answer?
 *
 * `gh api user` was the first probe and it is WRONG IN CI, measured on run
 * 32654405529: `${{ github.token }}` is an installation token with no user
 * behind it, so `/user` fails and the whole packages half reported itself
 * unavailable on a runner where it was merely asking the wrong endpoint.
 * `rate_limit` answers for any valid token, user or installation, which is the
 * question actually being asked.
 */
function ghUsable(): boolean {
  try {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    execFileSync("gh", ["api", "rate_limit", "--jq", ".rate.limit"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

function parseLedger(text: string): Ledger {
  const parsed: unknown = JSON.parse(text);
  return parsed as Ledger;
}

/** ghcr rows start `absent` (the API will confirm); everything else is out of the API's reach. */
function ghcrDefaultPresence(key: string, ghAvailable: boolean): PackagePresence {
  if (!key.startsWith("ghcr.io/")) return "not-ghcr";
  return ghAvailable ? "absent" : "unreadable";
}

/** One repository's accumulated per-tag measurements. */
interface RepoAccumulator {
  tags: Record<string, number>;
  sourceRepo: string | null;
  sourceEvidence: SourceEvidence;
}

/** Measure every referenced tag, grouped by repository. */
async function measureAllTags(uses: readonly ImageUse[]): Promise<Map<string, RepoAccumulator>> {
  const byRepo = new Map<string, RepoAccumulator>();
  for (const use of uses) {
    const key = repositoryKey(use.image);
    const tag = parseImageReference(use.image).reference;
    const r = await resolveProvenance(use.image);
    const acc = byRepo.get(key) ?? { tags: {}, sourceRepo: null, sourceEvidence: "none" };
    acc.tags[tag] = r.status;
    if (acc.sourceRepo === null && r.sourceRepo !== null) {
      acc.sourceRepo = r.sourceRepo;
      acc.sourceEvidence = r.sourceEvidence;
    }
    byRepo.set(key, acc);
  }
  return byRepo;
}

function repoVisibility(isPrivate: boolean | null): Visibility {
  if (isPrivate === null) return "unknown";
  return isPrivate ? "private" : "public";
}

/** The GHCR packages-API half of a ledger row, or the null answer for a non-ghcr key. */
function ghcrHalf(
  key: string,
  ghAvailable: boolean,
): { presence: PackagePresence; repository: string | null; visibility: Visibility } {
  const fallback = { presence: ghcrDefaultPresence(key, ghAvailable), repository: null, visibility: "unknown" as const };
  if (!key.startsWith("ghcr.io/") || !ghAvailable) return fallback;
  const [, owner, ...rest] = key.split("/");
  const name = rest.join("/");
  if (owner === undefined || name === "") return fallback;
  const pkg = ghcrPackage(owner, name);
  return {
    presence: pkg.presence,
    repository: pkg.repository,
    visibility: repoVisibility(pkg.repositoryPrivate),
  };
}

/** Fold one accumulator plus (for ghcr) the packages API into a ledger row. */
export function toLedgerEntry(
  key: string,
  acc: RepoAccumulator,
  ghAvailable: boolean,
  today: string,
  prior: LedgerEntry | undefined,
): LedgerEntry {
  const pkg = ghcrHalf(key, ghAvailable);
  // AN UNAUTHENTICATED RUN MAY NOT UN-KNOW WHAT AN AUTHENTICATED ONE MEASURED.
  // Without this, a scheduled run without packages access rewrites every ghcr
  // row from `found`/`absent` to `unreadable`, the snapshot "changes", and the
  // lane reports a provenance move that did not happen — a signal manufactured
  // by the measurer. Measured on run 32654405529, which rewrote all 28 rows for
  // exactly this reason. The freshly-measured half (`artifact`, from the
  // anonymous pull) is never preserved this way, and it is the half that decides
  // refusal; `packagePresence` only chooses between two remedy texts.
  const presence = pkg.presence === "unreadable" && prior !== undefined ? prior.packagePresence : pkg.presence;
  const sourceRepo = acc.sourceRepo ?? pkg.repository ?? (pkg.presence === "unreadable" ? (prior?.sourceRepo ?? null) : null);
  let sourceEvidence: SourceEvidence = acc.sourceEvidence;
  if (acc.sourceRepo === null && pkg.repository !== null) sourceEvidence = "ghcr-package";
  else if (acc.sourceRepo === null && pkg.presence === "unreadable" && prior?.sourceRepo != null) {
    sourceEvidence = prior.sourceEvidence;
  }
  const sourceVisibility =
    pkg.visibility === "unknown" && pkg.presence === "unreadable" ? (prior?.sourceVisibility ?? "unknown") : pkg.visibility;
  const packagePresence = presence;
  const tags = Object.fromEntries(Object.entries(acc.tags).sort(([a], [b]) => stringCompare(a, b)));
  return {
    repository: key,
    tags,
    artifact: foldAccess(tags),
    sourceRepo,
    sourceEvidence,
    sourceVisibility,
    packagePresence,
    resolvedAt: today,
    ...(prior?.note === undefined ? {} : { note: prior.note }),
  };
}

async function refresh(repoRoot: string): Promise<number> {
  const { uses } = collectImageUses(repoRoot);
  const previousPath = resolve(repoRoot, LEDGER_PATH);
  const previous = readFileSync(previousPath, "utf8");
  const previousLedger = parseLedger(previous);
  const existing = new Map(previousLedger.entries.map((e) => [e.repository, e]));
  const today = new Date().toISOString().slice(0, 10);
  const gh = ghUsable();
  if (!gh) {
    process.stderr.write(
      "WARNING: `gh api rate_limit` failed, so the packages API half is unavailable. New ghcr rows will " +
        "record `packagePresence: unreadable`, never `absent` — an unauthenticated run must not be able to " +
        "invent the difference between a private package and a missing one — and EXISTING rows keep the " +
        "value an authenticated run already measured rather than being downgraded.\n",
    );
  }

  const byRepo = await measureAllTags(uses);
  const entries = [...byRepo.entries()]
    .map(([key, acc]) => toLedgerEntry(key, acc, gh, today, existing.get(key)))
    .sort((a, b) => stringCompare(a.repository, b.repository));
  const next: Ledger = { $comment: previousLedger.$comment, entries };
  const rendered = JSON.stringify(next, null, 2) + "\n";
  // A signal that is always on carries no information: `resolvedAt` moving is
  // not news, so it is not a change. Same reasoning as chart-version-refresh.
  const stripDates = (s: string): string => s.replace(/"resolvedAt": "[^"]*"/g, "");
  if (stripDates(previous) === stripDates(rendered)) {
    process.stdout.write(`ledger unchanged (${String(entries.length)} repositories)\n`);
    return 0;
  }
  writeFileSync(previousPath, rendered);
  process.stdout.write(`ledger REWRITTEN (${String(entries.length)} repositories) — commit ${LEDGER_PATH}\n`);
  return 1;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const CLASS_HEADINGS: ReadonlyMap<ImageClass, string> = new Map([
  ["obtainable", "OBTAINABLE — an anonymous client can pull these"],
  ["built-in-tree", "BUILT IN THIS TREE — no registry coordinate; the committed recipe is the proof"],
  ["tag-absent", "TAG ABSENT (404) — the repository is open, the pin is broken. lane-partition.ts owns it; reported here, not refused"],
  ["ours-private", "OURS, PRIVATE — publish the package (the reference stays)"],
  ["ours-unpublished", "OURS, NEVER PUBLISHED — build and push it, or remove the manifest"],
  ["foreign-private", "FOREIGN, CLOSED — remove the reference; nothing here can open it"],
  ["unreachable", "UNREACHABLE at measurement time — reported, not refused"],
]);

export function formatReport(result: AuditResult): string {
  const lines: string[] = [];
  lines.push(
    `image source provenance — ${String(result.imageCount)} distinct image reference(s) across ` +
      `${String(result.manifestCount)} scanned manifest(s)`,
  );
  lines.push("");
  for (const [cls, heading] of CLASS_HEADINGS) {
    const images = result.byClass.get(cls) ?? [];
    if (images.length === 0) continue;
    lines.push(`  ${heading} — ${String(images.length)}`);
    for (const image of images) lines.push(`    ${image}`);
    lines.push("");
  }
  const acked = result.findings.filter((f) => f.acknowledged);
  const hard = result.findings.filter((f) => !f.acknowledged);
  if (acked.length > 0) {
    lines.push(
      `  ${String(acked.length)} ACKNOWLEDGED finding(s) — dated, work-item-owned, drift-checked in both ` +
        "directions; they do not fail this run:",
    );
    for (const f of acked) lines.push(`    [${f.rule}] ${f.detail}`);
    lines.push("");
  }
  if (hard.length === 0) {
    lines.push("  no unacknowledged findings.");
    return lines.join("\n") + "\n";
  }
  lines.push(`  ${String(hard.length)} FINDING(S):`);
  for (const f of hard) lines.push(`    [${f.rule}] ${f.detail}`);
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function main(argv: readonly string[], repoRoot = REPO_ROOT): Promise<number> {
  for (const a of argv) {
    if (a !== "--json" && a !== "--refresh") {
      process.stderr.write(
        `unknown argument: ${a}\nUsage: bun src/Core.TypeScript/cluster/image-source-provenance.ts [--json] [--refresh]\n`,
      );
      return 2;
    }
  }
  if (argv.includes("--refresh")) return refresh(repoRoot);
  const result = audit(repoRoot);
  if (argv.includes("--json")) {
    process.stdout.write(
      JSON.stringify(
        {
          imageCount: result.imageCount,
          manifestCount: result.manifestCount,
          byClass: Object.fromEntries([...result.byClass]),
          findings: result.findings,
        },
        null,
        2,
      ) + "\n",
    );
  } else {
    process.stdout.write(formatReport(result));
  }
  return result.findings.some((f) => !f.acknowledged) ? 1 : 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
