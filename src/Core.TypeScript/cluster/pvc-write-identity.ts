#!/usr/bin/env bun
/**
 * pvc-write-identity.ts — every container that WRITES a PersistentVolumeClaim must do
 * so as an identity the volume will accept, and SteamCMD must never run as root.
 *
 * ── THE DEFECT THIS CLOSES ──────────────────────────────────────────────────────────
 * Fresh bare-metal install, 2026-09-27: `game-hosting/gmod-0`'s `install` init
 * container crash-looped (exit 8, 8+ restarts) with
 *
 *   ERROR! Failed to install app '4020' (Missing file permissions)
 *
 * The pod already carried `fsGroup: 1000`, so the obvious reading — "non-root pod,
 * root-owned Longhorn volume, no fsGroup" — was refuted live: the container ran as
 * **uid 0** (`cm2network/steamcmd:root`, no `runAsUser`). SteamCMD's own tree
 * (`/home/steam/steamcmd`) belongs to the image's `steam` user (uid/gid 1000) and
 * SteamCMD refuses the install when run as root against it — the failure the
 * cm2network image documents for its `:root` tag. The fix is to run SteamCMD as the
 * `steam` identity, which the pod's `fsGroup: 1000` then lets write the PVC.
 *
 * ── WHAT IS CHECKED (two rules, both over committed manifests) ─────────────────────
 *   steamcmd-as-root   a container whose image is SteamCMD-shaped must have an
 *                      explicit, non-zero effective `runAsUser`. Unset counts as a
 *                      finding: the `:root` tag's default user is 0, and an unset
 *                      field is the exact shape that shipped.
 *   non-root-no-fsgroup  a container with an effective non-zero `runAsUser` and a
 *                      writable mount of a PVC-backed volume (volumeClaimTemplate or
 *                      `persistentVolumeClaim`) in a pod with no `fsGroup`. A fresh
 *                      Longhorn/local-path ext4 root is `root:root 0755`, so that
 *                      container cannot write its own volume.
 *   fsgroup-mismatch   the same container, where `fsGroup` is set but differs from the
 *                      effective `runAsGroup` and no supplementalGroups contain it.
 *
 * ── HONEST LIMITS ──────────────────────────────────────────────────────────────────
 *   - Plain YAML under `k8s/applications/` only. Helm-rendered workloads are not
 *     scanned here; the image's USER is not inspected, so a container with no
 *     `runAsUser` is assumed to run as the image default and is not judged by the
 *     second/third rules (it may be root, which can write anything).
 *   - It checks the declared identity, not the live volume's ownership; a PVC whose
 *     contents were chowned by an earlier root run is repaired by kubelet's default
 *     `fsGroupChangePolicy: Always` recursive relabel, which this file does not model.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { parseAllDocuments } from "yaml";

export type FindingKind = "steamcmd-as-root" | "non-root-no-fsgroup" | "fsgroup-mismatch";

export interface Finding {
  readonly kind: FindingKind;
  readonly source: string;
  readonly workload: string;
  readonly container: string;
  readonly detail: string;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

const WORKLOAD_KINDS = new Set(["StatefulSet", "Deployment", "DaemonSet", "ReplicaSet", "Job"]);

/** SteamCMD-shaped: the image name mentions steamcmd. */
export const isSteamCmdImage = (image: string): boolean => /steamcmd/i.test(image);

function podSpecOf(doc: Obj): Obj | undefined {
  const spec = doc["spec"];
  if (!isObj(spec)) return undefined;
  const template = spec["template"];
  if (!isObj(template)) return undefined;
  const podSpec = template["spec"];
  return isObj(podSpec) ? podSpec : undefined;
}

function pvcVolumeNames(doc: Obj, podSpec: Obj): ReadonlySet<string> {
  const names = new Set<string>();
  const spec = doc["spec"];
  if (isObj(spec)) {
    for (const vct of arr(spec["volumeClaimTemplates"])) {
      if (isObj(vct) && isObj(vct["metadata"]) && typeof vct["metadata"]["name"] === "string") {
        names.add(vct["metadata"]["name"]);
      }
    }
  }
  for (const vol of arr(podSpec["volumes"])) {
    if (isObj(vol) && typeof vol["name"] === "string" && isObj(vol["persistentVolumeClaim"])) {
      names.add(vol["name"]);
    }
  }
  return names;
}

/** Audit one parsed manifest document. Non-workloads yield nothing. */
export function auditDocument(doc: unknown, source: string): readonly Finding[] {
  if (!isObj(doc) || typeof doc["kind"] !== "string" || !WORKLOAD_KINDS.has(doc["kind"])) return [];
  const podSpec = podSpecOf(doc);
  if (podSpec === undefined) return [];
  const name = isObj(doc["metadata"]) ? String(doc["metadata"]["name"] ?? "?") : "?";
  const workload = `${doc["kind"]}/${name}`;
  const podSc = isObj(podSpec["securityContext"]) ? podSpec["securityContext"] : {};
  const fsGroup = num(podSc["fsGroup"]);
  const supplemental = arr(podSc["supplementalGroups"]).map(num);
  const pvcs = pvcVolumeNames(doc, podSpec);

  const findings: Finding[] = [];
  const containers = [...arr(podSpec["initContainers"]), ...arr(podSpec["containers"])];
  for (const c of containers) {
    if (!isObj(c)) continue;
    const cName = String(c["name"] ?? "?");
    const image = String(c["image"] ?? "");
    const cSc = isObj(c["securityContext"]) ? c["securityContext"] : {};
    const runAsUser = num(cSc["runAsUser"]) ?? num(podSc["runAsUser"]);
    const runAsGroup = num(cSc["runAsGroup"]) ?? num(podSc["runAsGroup"]) ?? runAsUser;

    if (isSteamCmdImage(image) && (runAsUser === undefined || runAsUser === 0)) {
      findings.push({
        kind: "steamcmd-as-root",
        source,
        workload,
        container: cName,
        detail: `image ${image} runs with runAsUser=${runAsUser ?? "unset (image default)"}; SteamCMD fails 'Missing file permissions' as root`,
      });
    }

    if (runAsUser === undefined || runAsUser === 0) continue;
    const writesPvc = arr(c["volumeMounts"]).some(
      (m) => isObj(m) && typeof m["name"] === "string" && pvcs.has(m["name"]) && m["readOnly"] !== true,
    );
    if (!writesPvc) continue;
    if (fsGroup === undefined) {
      findings.push({
        kind: "non-root-no-fsgroup",
        source,
        workload,
        container: cName,
        detail: `runs as uid ${runAsUser} and writes a PVC, but the pod sets no fsGroup (fresh volume root is root:root 0755)`,
      });
    } else if (fsGroup !== runAsGroup && !supplemental.includes(fsGroup)) {
      findings.push({
        kind: "fsgroup-mismatch",
        source,
        workload,
        container: cName,
        detail: `runs as gid ${runAsGroup}, pod fsGroup is ${fsGroup}, and supplementalGroups do not contain it`,
      });
    }
  }
  return findings;
}

export function auditYaml(text: string, source: string): readonly Finding[] {
  return parseAllDocuments(text).flatMap((d) => auditDocument(d.toJS(), source));
}

function* yamlFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* yamlFiles(p);
    else if (entry.isFile() && /\.ya?ml$/.test(entry.name)) yield p;
  }
}

/** Audit every plain YAML manifest under `dir`. Unparseable files (Helm templates) are skipped. */
export function auditTree(dir: string, root: string = dir): readonly Finding[] {
  const out: Finding[] = [];
  for (const file of yamlFiles(dir)) {
    let findings: readonly Finding[];
    try {
      findings = auditYaml(readFileSync(file, "utf8"), relative(root, file).replaceAll("\\", "/"));
    } catch {
      continue;
    }
    out.push(...findings);
  }
  return out;
}

if (import.meta.main) {
  const dir = process.argv[2] ?? "full-ai-cluster/k8s/applications";
  const findings = auditTree(dir);
  for (const f of findings) console.log(`${f.kind}\t${f.source}\t${f.workload}\t${f.container}\t${f.detail}`);
  console.log(`${findings.length} finding(s)`);
  process.exit(findings.length === 0 ? 0 : 1);
}
