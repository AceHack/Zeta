#!/usr/bin/env bun
// src/Core.TypeScript/cluster/rung-override-audit.ts
//
// TWO OFFLINE CHECKS ON WHAT THE DEV LANE ACTUALLY SERVES (2026-09-23).
//
// ── 1. AN OVERRIDE PATH THE CHART DOES NOT READ IS A NO-OP THAT LOOKS APPLIED ──
// `applyRungOverrides` refuses an override that makes zero EDITS. It cannot
// refuse one that edits a key the chart never reads: `setIn` happily creates
// `valuesObject.persistance.size`, the staged tree changes, the edit is counted,
// and the chart renders exactly what it rendered before. That is the inert-key
// defect `inert-valuesobject-keys.ts` already hunts in committed manifests --
// four measured instances -- moved into the override file, where nothing looked.
// So every `set`/`remove` path under `spec.source.helm.valuesObject.` is
// classified against the pinned chart's schema snapshot, the same way.
//
// ── 2. THE DEV LANE'S DECLARED DISK MUST FIT BESIDE ITS IMAGES ────────────────
// The maintainer, 2026-09-23: make dev capacity actually fit. Measured before
// this check existed: the dev lane (40 applied Applications) declared ~582 GiB
// of PVC on a runner with 70 GiB free, ~34 GiB of which its images take.
// local-path is THIN -- a directory, no quota -- so none of that was bytes on
// the runner, and ollama's own manifest says so. But a declared capacity the
// substrate cannot honour is a claim the lane does not keep. This prices every
// rendered claim of every applied Application AT THE SIZE THE DEV LANE SERVES:
//   - a claim the storage ladder governs -> its row at the dev storage profile
//     (`storageProfileForResourceRung`), size x pods, counted once per row;
//   - a claim a dev rung override declares it `resizes` -> that size x count;
//   - anything else -> its committed (metal) size, so an unpriced claim COSTS,
//     it is never free.
// and compares the total with free disk - reserved - the applied cohort's
// images (image-footprint.ts, the same estimate the disk envelope uses).
//
// A `resizes` entry naming a claim the render does not carry is STALE and
// refused -- the resize would be excusing disk that is not there.
//
// Honest limit: it reads the committed render SNAPSHOT, not a render of the
// staged tree (that needs helm and the network). Check 1 is what makes the
// substitution sound: an override that resizes through a path the chart reads
// renders at the size it declares.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cohortTotal, loadMeasurement } from "./image-footprint.ts";
import { classifyPath, loadSchemaSnapshot, schemaOfEntry, type Verdict } from "./inert-valuesobject-keys.ts";
import { loadRungOverrides, type RungOverride } from "./rung-overrides.ts";
import { quantityToGib } from "./single-node-readiness.ts";
import {
  claimGib,
  devLaneAppliedDirs,
  loadCatalogue,
  loadResourceCatalogue,
  storageProfileForResourceRung,
} from "./storage-profiles.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const VALUES_PREFIX = "spec.source.helm.valuesObject.";
const RENDER_SNAPSHOT = "src/Core.TypeScript/cluster/rendered-storage-claims.snapshot.json";
const GIB = 1024 ** 3;

export interface OverridePathFinding {
  readonly id: string;
  readonly path: string;
  readonly verdict: Verdict | "chart-unavailable";
  readonly detail: string;
}

/** `full-ai-cluster/k8s/applications/<dir>/Application.yaml` -> `full-ai-cluster/<dir>`. */
function appIdOf(manifestPath: string): string | null {
  const match = /^full-ai-cluster\/k8s\/applications\/(.+)\/[^/]+\.ya?ml$/.exec(manifestPath);
  return match === null ? null : `full-ai-cluster/${match[1] ?? ""}`;
}

/**
 * Every override path under `valuesObject` that the pinned chart does not read.
 * Paths outside `valuesObject` (a raw manifest, `spec.syncPolicy`) have no chart
 * schema to be checked against and are not this check's business.
 */
export function auditOverrideValuePaths(
  overrides: readonly RungOverride[],
  repoRoot = REPO_ROOT,
): readonly OverridePathFinding[] {
  const snapshot = loadSchemaSnapshot(undefined, repoRoot);
  const findings: OverridePathFinding[] = [];
  for (const override of overrides) {
    const fields = [...Object.keys(override.set), ...override.remove].filter((field) => field.startsWith(VALUES_PREFIX));
    if (fields.length === 0) continue;
    const appId = appIdOf(override.path);
    const entry = snapshot?.entries.find((candidate) => candidate.appId === appId);
    const schema = snapshot === null || entry === undefined ? null : schemaOfEntry(snapshot, entry);
    for (const field of fields) {
      const valuesPath = field.slice(VALUES_PREFIX.length);
      if (schema === null || !("literal" in schema)) {
        findings.push({
          id: override.id,
          path: valuesPath,
          verdict: "chart-unavailable",
          detail: `no chart schema for ${appId ?? override.path} in the snapshot -- the path cannot be checked, and unchecked is not passed`,
        });
        continue;
      }
      const verdict = classifyPath(valuesPath, schema);
      if (verdict === "accepted") continue;
      findings.push({
        id: override.id,
        path: valuesPath,
        verdict,
        detail:
          verdict === "inert"
            ? "the pinned chart reads no such key -- the override edits the staged tree and changes nothing the chart renders"
            : "the chart reads this subtree dynamically, so whether the key takes effect cannot be decided offline",
      });
    }
  }
  return findings;
}

interface RenderedClaim {
  readonly appId: string;
  readonly name: string;
  readonly gibibytes: number;
  readonly count: number;
}

export interface PricedClaim {
  readonly claim: string;
  readonly gib: number;
  readonly pricedBy: string;
}

export interface DevLaneStorage {
  readonly storageProfile: string | null;
  readonly priced: readonly PricedClaim[];
  readonly declaredGib: number;
  readonly imageGib: number;
  readonly freeDiskGib: number;
  readonly reservedDiskGib: number;
  readonly budgetGib: number;
  readonly fits: boolean;
  /** `resizes` entries naming a claim the render does not carry. */
  readonly staleResizes: readonly string[];
}

export function auditDevLaneStorage(
  repoRoot = REPO_ROOT,
  overrides: readonly RungOverride[] = loadRungOverrides(loadResourceCatalogue(undefined, repoRoot).profiles, repoRoot),
): DevLaneStorage {
  const applied = new Set(devLaneAppliedDirs(repoRoot));
  const isApplied = (appId: string): boolean => applied.has(appId.replace(/^full-ai-cluster\//, ""));
  const render = JSON.parse(readFileSync(resolve(repoRoot, RENDER_SNAPSHOT), "utf8")) as { rendered: RenderedClaim[] };
  const claims = render.rendered.filter((claim) => isApplied(claim.appId));
  const storageProfile = storageProfileForResourceRung("dev", undefined, repoRoot);
  const catalogue = loadCatalogue(undefined, repoRoot);

  const resizes = new Map<string, { size: string; id: string }>();
  for (const override of overrides) {
    if (override.rung !== "dev") continue;
    for (const resize of override.resizes) resizes.set(resize.claim, { size: resize.size, id: override.id });
  }
  const renderedKeys = new Set(render.rendered.map((claim) => `${claim.appId} ${claim.name}`));
  const staleResizes = [...resizes.keys()].filter((key) => !renderedKeys.has(key)).sort();

  const priced: PricedClaim[] = [];
  const countedRows = new Set<string>();
  for (const claim of claims) {
    const key = `${claim.appId} ${claim.name}`;
    const row = catalogue.claims.find(
      (candidate) => candidate.renderedApp === claim.appId && new RegExp(candidate.renderedPvcPattern).test(claim.name),
    );
    if (row !== undefined && storageProfile !== null) {
      if (countedRows.has(row.id)) continue;
      countedRows.add(row.id);
      priced.push({ claim: key, gib: claimGib(row, storageProfile), pricedBy: `ladder ${row.id} @ ${storageProfile}` });
      continue;
    }
    const resize = resizes.get(key);
    if (resize !== undefined) {
      const gib = quantityToGib(resize.size);
      if (gib === null) throw new Error(`${resize.id}: unparsable resize ${resize.size}`);
      priced.push({ claim: key, gib: gib * claim.count, pricedBy: `override ${resize.id}` });
      continue;
    }
    priced.push({ claim: key, gib: claim.gibibytes * claim.count, pricedBy: "committed size (unpriced for dev)" });
  }

  const measurement = loadMeasurement(undefined, repoRoot);
  const images = cohortTotal(measurement, "applied", applied);
  const imageGib = (images.compressedBytes * measurement.uncompressedRatio) / GIB;
  const envelope = loadResourceCatalogue(undefined, repoRoot).envelope;
  const declaredGib = priced.reduce((sum, entry) => sum + entry.gib, 0);
  const budgetGib = envelope.freeDiskGib - envelope.reservedDiskGib - imageGib;
  return {
    storageProfile,
    priced: priced.sort((a, b) => b.gib - a.gib || (a.claim < b.claim ? -1 : a.claim > b.claim ? 1 : 0)),
    declaredGib,
    imageGib,
    freeDiskGib: envelope.freeDiskGib,
    reservedDiskGib: envelope.reservedDiskGib,
    budgetGib,
    fits: declaredGib <= budgetGib,
    staleResizes,
  };
}

if (import.meta.main) {
  const overrides = loadRungOverrides(loadResourceCatalogue().profiles);
  const paths = auditOverrideValuePaths(overrides);
  const storage = auditDevLaneStorage(REPO_ROOT, overrides);
  console.log(`override value paths: ${String(paths.length)} finding(s)`);
  for (const finding of paths) console.log(`  REFUSED ${finding.id}: ${finding.path} [${finding.verdict}] ${finding.detail}`);
  console.log(
    `dev lane storage @ profile ${storage.storageProfile ?? "(none)"}: declared ${storage.declaredGib.toFixed(1)} GiB ` +
      `vs budget ${storage.budgetGib.toFixed(1)} GiB (free ${String(storage.freeDiskGib)} - reserved ` +
      `${String(storage.reservedDiskGib)} - images ${storage.imageGib.toFixed(1)}) -> ${storage.fits ? "FITS" : "OVER"}`,
  );
  for (const entry of storage.priced) console.log(`  ${entry.gib.toFixed(2).padStart(7)} GiB  ${entry.claim}  (${entry.pricedBy})`);
  for (const stale of storage.staleResizes) console.log(`  REFUSED stale resize: ${stale} is not in the render`);
  const bad = paths.length > 0 || !storage.fits || storage.staleResizes.length > 0;
  process.exit(bad ? 1 : 0);
}
