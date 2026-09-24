#!/usr/bin/env bun
/**
 * chart-render-determinism.ts — render every Application TWICE and compare.
 *
 * A chart whose render differs from itself is non-deterministic BY
 * CONSTRUCTION. ArgoCD diffs the live state against a fresh render on every
 * sync, sees a difference that is not a drift, re-applies, and under
 * `selfHeal: true` the workload churns forever — on any cluster, including the
 * one that boots off the USB installer. Nothing in this repo could see that
 * class before this file.
 *
 * MEASURED 2026-09-24 over 49 Applications, helm v4.2.0: 45 stable, 4 unstable,
 * 0 unmeasured.
 *
 *   cilium     Secret/cilium-ca, Secret/hubble-relay-client-certs,
 *              Secret/hubble-server-certs           regenerated-secret
 *   seaweedfs  Secret/blob-store-seaweedfs-sftp-secret  regenerated-secret
 *   weaviate   Secret/weaviate-cluster-api-basic-auth   regenerated-secret
 *   gitlab     Pod/gitlab-webservice-test-runner-*      fresh-identity
 *
 * TWO SHAPES, AND THEY MUST NOT BE CONFLATED — they need different remedies:
 *
 *   regenerated-secret  A Secret whose CONTENTS differ between renders: the
 *                       chart mints a password or a certificate at template
 *                       time. Remedy: supply the value (an `existingSecret`,
 *                       a pre-created Secret, an external-secrets reference)
 *                       so the chart stops inventing one.
 *   fresh-identity      A document whose NAME differs between renders, always
 *                       a hook or test Pod with a random suffix. Remedy:
 *                       exclude the hook from the Application's render, or
 *                       accept it via `ignoreDifferences`. Nothing about its
 *                       contents is wrong.
 *   contents-differ     Anything else that differs. No known instance; kept so
 *                       a new shape is REPORTED rather than silently bucketed
 *                       into one of the two above.
 *
 * WHY THE BASELINE NAMES DOCUMENTS AND NOT APPS. "cilium is unstable" sends the
 * next reader nowhere. "Secret/kube-system/cilium-ca differs between two
 * renders" is a fix.
 *
 * AND WHY A `fresh-identity` ROW IS WILDCARDED. Its whole defect is that the
 * name carries a random suffix, so writing `gitlab-webservice-test-runner-iknek`
 * into a checked-in baseline would make the BASELINE non-deterministic — it
 * would go red on the next run for the reason it exists to record. The suffix
 * is replaced by `*`, which is stable across renders and still names the
 * document.
 *
 * THE UNMEASURED SET IS NAMED, NON-EMPTY WHEN IT HAS MEMBERS, AND NEVER
 * COUNTED AS STABLE. An app that cannot be rendered has not been shown to be
 * deterministic; folding it into the stable count would be the vacuity class.
 *
 * It is EMPTY today, and the story of why is worth keeping. The first census
 * reported six unrenderable charts — arc-controller, argo-rollouts, argocd,
 * cloudnativepg, external-secrets, kube-prometheus-stack — all
 * `helm-template-failed` with an EMPTY detail string. Running `helm template`
 * by hand on cloudnativepg exited 0 and produced 1,272,266 bytes. The failure
 * was OURS: `defaultRunHelm` in `rendered-storage-claims.ts` used `spawnSync`
 * with Node's default 1 MiB `maxBuffer`, so the six BIGGEST charts were killed
 * with ENOBUFS — and because spawnSync leaves `stderr` as the empty string
 * rather than undefined on that path, the `??` fallback never reached
 * `error.message` and the reason was lost. Both halves are fixed in the change
 * that added this file. Six charts that "could not be rendered" were six charts
 * nobody had rendered.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { stringCompare } from "../collation/collation.ts";
import { spawnArgv } from "../io/safe-io.ts";
import { discoverApplications, renderApplication, type ApplicationSource } from "./rendered-storage-claims.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
export const DEFAULT_BASELINE_PATH = "src/Core.TypeScript/cluster/chart-render-determinism.baseline.json";

/** How a document differs from itself between two renders. */
export type InstabilityShape = "regenerated-secret" | "fresh-identity" | "contents-differ";

export interface UnstableDocument {
  /** `Kind/namespace/name`, with a random name suffix wildcarded. */
  readonly document: string;
  readonly shape: InstabilityShape;
}

export interface AppCensus {
  readonly appId: string;
  readonly documents: readonly UnstableDocument[];
}

export interface UnmeasuredApp {
  readonly appId: string;
  readonly reason: string;
  /** Never empty — an unmeasured app that cannot say why is the defect this file already hit once. */
  readonly detail: string;
}

export interface Census {
  readonly appsDiscovered: number;
  readonly stable: number;
  readonly unstable: readonly AppCensus[];
  readonly unmeasured: readonly UnmeasuredApp[];
}

type Doc = Record<string, unknown>;

/** `Kind/namespace/name`. Namespace may be empty — a cluster-scoped object still has an identity. */
export function documentKey(doc: Doc): string {
  const metadata = (doc["metadata"] ?? {}) as Record<string, unknown>;
  const kind = typeof doc["kind"] === "string" ? doc["kind"] : "?";
  const namespace = typeof metadata["namespace"] === "string" ? metadata["namespace"] : "";
  const name = typeof metadata["name"] === "string" ? metadata["name"] : "?";
  return `${kind}/${namespace}/${name}`;
}

/**
 * The shared prefix of two keys that differ only in a trailing run, with the
 * differing tail replaced by `*`. `null` when they are not that shape.
 *
 * DERIVED FROM THE PAIR, never guessed from one name — and that correction is
 * the whole reason this function has the signature it does.
 *
 * The first version pattern-matched a suffix on a SINGLE key:
 * `/-[a-z0-9]{5,}$/` narrowed to require a digit, so that
 * `Service/ns/gitlab-webservice-default` would keep its name. It wildcarded
 * `…-test-runner-9pl2t` and then, on the very next render, failed to match
 * `…-test-runner-jjcvk` — helm's `randAlphaNum` emits five alphanumerics and
 * they are not required to contain a digit. The baseline that function wrote
 * went red against the next run, which is precisely the failure the wildcard
 * exists to prevent.
 *
 * Comparing the two names removes the guess entirely: whatever they share is
 * the name, whatever they do not is the suffix. It cannot wildcard a real name,
 * because a real name has no counterpart to differ from.
 */
export function wildcardPairedSuffix(first: string, second: string): string | null {
  if (first === second) return null;
  let shared = 0;
  while (shared < first.length && shared < second.length && first[shared] === second[shared]) shared += 1;
  const tailA = first.slice(shared);
  const tailB = second.slice(shared);
  // Both tails must be a single trailing run of name-legal characters with no
  // separator in them. A pair differing across a `-` is two different objects,
  // not one object with a random suffix.
  if (!/^[a-z0-9]+$/.test(tailA) || !/^[a-z0-9]+$/.test(tailB)) return null;
  return `${first.slice(0, shared)}*`;
}

function shapeOf(kind: string, kindOfDifference: "contents" | "identity"): InstabilityShape {
  if (kindOfDifference === "identity") return "fresh-identity";
  return kind === "Secret" ? "regenerated-secret" : "contents-differ";
}

/**
 * Compare two renders of the same Application. PURE — no helm, no filesystem.
 *
 * Documents are matched by identity, not by position: a chart is free to emit
 * its documents in a different ORDER without being non-deterministic, and a
 * positional comparison would report that as churn. ArgoCD matches by identity
 * too, so this is the comparison that predicts what it will do.
 */
export function classifyRenderPair(first: readonly Doc[], second: readonly Doc[]): readonly UnstableDocument[] {
  const indexOf = (docs: readonly Doc[]): Map<string, string> =>
    new Map(docs.map((doc) => [documentKey(doc), JSON.stringify(doc)]));
  const a = indexOf(first);
  const b = indexOf(second);
  const out = new Map<string, InstabilityShape>();

  const onlyInA: string[] = [];
  for (const [key, value] of a) {
    const other = b.get(key);
    if (other === undefined) onlyInA.push(key);
    else if (other !== value) out.set(key, shapeOf(key.split("/")[0] ?? "?", "contents"));
  }
  const onlyInB = [...b.keys()].filter((key) => !a.has(key));

  // PAIR the leftovers before naming any of them. A document that vanished
  // from one render and a document that appeared in the other are the SAME
  // object under a fresh random name, and wildcarding them needs both halves.
  const unpairedB = new Set(onlyInB);
  for (const key of onlyInA) {
    const partner = [...unpairedB].find((candidate) => wildcardPairedSuffix(key, candidate) !== null);
    if (partner === undefined) {
      // No counterpart: this document is present in one render and simply
      // absent from the other. Named LITERALLY, because it is not a suffix
      // case and pretending otherwise would hide a different defect.
      out.set(key, shapeOf(key.split("/")[0] ?? "?", "identity"));
      continue;
    }
    unpairedB.delete(partner);
    out.set(wildcardPairedSuffix(key, partner) ?? key, shapeOf(key.split("/")[0] ?? "?", "identity"));
  }
  for (const key of unpairedB) out.set(key, shapeOf(key.split("/")[0] ?? "?", "identity"));

  return [...out.entries()]
    .map(([document, shape]) => ({ document, shape }))
    .sort((x, y) => stringCompare(x.document, y.document));
}

/** Render every Application twice. Needs helm and the network the renderer already uses. */
export function runCensus(
  repoRoot = REPO_ROOT,
  apps: readonly ApplicationSource[] = discoverApplications(repoRoot),
): Census {
  const unstable: AppCensus[] = [];
  const unmeasured: UnmeasuredApp[] = [];
  let stable = 0;

  for (const app of apps) {
    const first = renderApplication(app, { repoRoot });
    const second = renderApplication(app, { repoRoot });
    const failed = !first.ok ? first : !second.ok ? second : null;
    if (failed !== null && !failed.ok) {
      unmeasured.push({
        appId: app.appId,
        reason: failed.reason,
        // NEVER empty. A `(no detail)` here is itself the finding: it is what
        // hid the 1 MiB buffer cap for as long as nobody ran helm by hand.
        detail: failed.detail.trim() === "" ? "(renderer reported no detail — see the header)" : failed.detail,
      });
      continue;
    }
    if (!first.ok || !second.ok) continue;
    const documents = classifyRenderPair(first.documents, second.documents);
    if (documents.length === 0) stable += 1;
    else unstable.push({ appId: app.appId, documents });
  }

  return {
    appsDiscovered: apps.length,
    stable,
    unstable: unstable.sort((x, y) => stringCompare(x.appId, y.appId)),
    unmeasured: unmeasured.sort((x, y) => stringCompare(x.appId, y.appId)),
  };
}

export interface Baseline {
  readonly measuredOn: string;
  readonly helmVersion: string;
  readonly appsDiscovered: number;
  readonly stable: number;
  readonly unstable: readonly AppCensus[];
  readonly unmeasured: readonly UnmeasuredApp[];
}

export function loadBaseline(repoRoot = REPO_ROOT, path = DEFAULT_BASELINE_PATH): Baseline {
  const parsed = JSON.parse(readFileSync(resolve(repoRoot, path), "utf8")) as Partial<Baseline>;
  if (!Array.isArray(parsed.unstable) || !Array.isArray(parsed.unmeasured)) {
    throw new Error(`${path}: 'unstable' and 'unmeasured' are required arrays`);
  }
  return {
    measuredOn: parsed.measuredOn ?? "",
    helmVersion: parsed.helmVersion ?? "",
    appsDiscovered: parsed.appsDiscovered ?? 0,
    stable: parsed.stable ?? 0,
    unstable: parsed.unstable,
    unmeasured: parsed.unmeasured,
  };
}

export interface Finding {
  readonly severity: "blocker";
  readonly message: string;
  readonly detail: readonly string[];
}

const rowsOf = (apps: readonly AppCensus[]): ReadonlySet<string> =>
  new Set(apps.flatMap((app) => app.documents.map((doc) => `${app.appId} ${doc.document} ${doc.shape}`)));

/**
 * Compare a census against the baseline. BOTH directions are findings.
 *
 * A NEW unstable document is the obvious one. A document that has become
 * stable is reported too, and it is not pedantry: a baseline that still carries
 * a fixed row is a check that has stopped constraining that row, so the next
 * regression there passes. Tightening the baseline is the fix.
 */
export function compareToBaseline(census: Census, baseline: Baseline): readonly Finding[] {
  const findings: Finding[] = [];
  const now = rowsOf(census.unstable);
  const known = rowsOf(baseline.unstable);

  const appeared = [...now].filter((row) => !known.has(row)).sort((a, b) => stringCompare(a, b));
  if (appeared.length > 0) {
    findings.push({
      severity: "blocker",
      message:
        `${String(appeared.length)} chart document(s) render differently from themselves and are NOT in the ` +
        `baseline. ArgoCD diffs a fresh render against live state on every sync, so a document that differs ` +
        `from itself makes its workload churn forever under selfHeal.`,
      detail: [
        ...appeared,
        "regenerated-secret: the chart mints a password or certificate at template time — supply the value instead",
        "fresh-identity: a hook/test Pod with a random name — exclude the hook or accept it via ignoreDifferences",
        `if this is knowingly accepted, re-measure: bun ${DEFAULT_BASELINE_PATH.replace(".baseline.json", ".ts")} --measure`,
      ],
    });
  }

  const fixed = [...known].filter((row) => !now.has(row)).sort((a, b) => stringCompare(a, b));
  if (fixed.length > 0) {
    findings.push({
      severity: "blocker",
      message:
        `${String(fixed.length)} baseline row(s) are no longer unstable. A baseline that still carries a FIXED ` +
        `row has stopped constraining it, so the next regression there would pass. Tighten it.`,
      detail: [...fixed, `re-measure: bun ${DEFAULT_BASELINE_PATH.replace(".baseline.json", ".ts")} --measure`],
    });
  }

  const unmeasuredNow = new Set(census.unmeasured.map((app) => app.appId));
  const unmeasuredKnown = new Set(baseline.unmeasured.map((app) => app.appId));
  const newlyUnmeasured = [...unmeasuredNow].filter((appId) => !unmeasuredKnown.has(appId)).sort((a, b) => stringCompare(a, b));
  if (newlyUnmeasured.length > 0) {
    findings.push({
      severity: "blocker",
      message:
        `${String(newlyUnmeasured.length)} Application(s) could not be rendered at all, and are not in the ` +
        `baseline's unmeasured set. An app that cannot be rendered has NOT been shown to be deterministic — it ` +
        `is never counted as stable.`,
      detail: [
        ...census.unmeasured
          .filter((app) => newlyUnmeasured.includes(app.appId))
          .map((app) => `${app.appId}: ${app.reason} — ${app.detail}`),
        "an EMPTY detail here is itself the finding: it is what hid a 1 MiB spawn buffer cap for six charts",
      ],
    });
  }

  return findings;
}

/**
 * The helm that produced a census, RECORDED rather than asserted.
 *
 * A census is only meaningful against the renderer that produced it — helm's
 * templating changes between majors, and a baseline measured under one and
 * checked under another is comparing two different programs. Recorded so a
 * later disagreement has somewhere to look; deliberately NOT pinned, because a
 * version gate here would fail for a reason that has nothing to do with chart
 * determinism.
 */
function helmVersion(): string {
  const ran = spawnArgv("helm", ["version", "--short"]);
  return ran.ok && ran.value.status === 0 ? ran.value.stdout.trim() : "unrecorded";
}

function main(argv: readonly string[]): void {
  const measure = argv.includes("--measure");
  const census = runCensus();

  console.log(
    `chart render determinism: ${String(census.appsDiscovered)} Applications — ` +
      `${String(census.stable)} stable, ${String(census.unstable.length)} unstable, ` +
      `${String(census.unmeasured.length)} unmeasured`,
  );
  for (const app of census.unstable) {
    console.log(`  ${app.appId}`);
    for (const doc of app.documents) console.log(`    ${doc.shape.padEnd(19)} ${doc.document}`);
  }
  for (const app of census.unmeasured) console.log(`  UNMEASURED ${app.appId}: ${app.reason} — ${app.detail}`);

  if (measure) {
    // CARRY THE PROSE FORWARD, and this is not a nicety.
    //
    // The `$comment` block is the only thing in the baseline a reader can ACT
    // on — it says what each shape means and what its remedy is. The first
    // version of this regenerator dropped it, and the very next `--measure`
    // deleted the explanation silently. That is the same defect
    // `image-footprint.measured.json` records about its own regenerator
    // ("that the regenerator silently drops this key is a defect in the
    // regenerator"), caught here before it reached main rather than after.
    let preserved: unknown;
    try {
      const existing = JSON.parse(readFileSync(resolve(REPO_ROOT, DEFAULT_BASELINE_PATH), "utf8")) as Record<
        string,
        unknown
      >;
      preserved = existing["$comment"];
    } catch {
      preserved = undefined;
    }
    const baseline: Baseline & { readonly $comment?: unknown } = {
      ...(preserved === undefined ? {} : { $comment: preserved }),
      measuredOn: new Date().toISOString().slice(0, 10),
      helmVersion: helmVersion(),
      appsDiscovered: census.appsDiscovered,
      stable: census.stable,
      unstable: census.unstable,
      unmeasured: census.unmeasured,
    };
    writeFileSync(resolve(REPO_ROOT, DEFAULT_BASELINE_PATH), `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
    console.log(`\nwrote ${DEFAULT_BASELINE_PATH}`);
    return;
  }

  const findings = compareToBaseline(census, loadBaseline());
  for (const finding of findings) {
    console.log(`\n[${finding.severity}] ${finding.message}`);
    for (const line of finding.detail) console.log(`    ${line}`);
  }
  if (findings.length === 0) console.log("\nno new non-determinism.");
  process.exit(findings.length === 0 ? 0 : 1);
}

if (import.meta.main) main(process.argv.slice(2));
