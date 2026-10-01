// Falsifier: every LONG-RUNNING container in the AI / workload / platform family
// requests CPU and memory, so none of them runs BestEffort once its init
// containers have exited.
//
// WHY THIS IS NOT `missing-resource-requests.ts`. That module reasons over the
// per-APP TOTAL in rendered-resource-requests.snapshot.json, and a total hides the
// exact shape that bit forgejo: its three INIT containers each request 100m/128Mi
// while the `forgejo` container requests nothing, so the app total reads a
// respectable 100m/128Mi although, once the init containers have exited, the
// running pod holds no request at all (cpu weight at the kubelet's floor of 2,
// first in line for eviction -- the failure measured for the ArgoCD control plane
// in PR #17666). The total is max(init, sum(regular)); only a per-container read
// can see that the regular half of that max is zero.
//
// Two surfaces, both checked OFFLINE so this gate cannot be unavailable:
//   * git-path Applications -- rendered with the repo's own `renderApplication`
//     (no helm involved: what ArgoCD applies is what is on disk). Every REGULAR
//     container of every Deployment / StatefulSet / DaemonSet must request cpu AND
//     memory. Init containers and Jobs are out of scope on purpose: they run for
//     seconds and exit, so an eviction costs a retry, not a service.
//   * helm Applications -- the chart's `resources` coordinate must carry both
//     requests in the Application's own valuesObject, and the pinned chart must
//     ACCEPT that key (`inert-valuesobject-keys.schema.json` records the accepted
//     keys per pinned chart), so the coordinate is not inert.
//
// SCOPE IS DELIBERATELY THE FAMILY, not the tree: other families' requests are
// priced by their owners' catalogue rows, and a tree-wide gate would make every
// unrelated Application this test's failure.
//
// KNOWN GAPS ARE A RATCHET, NOT AN EXEMPTION. Each entry names a container that
// still requests nothing and why fixing it is not free. The test asserts the set of
// gaps found EQUALS this table, so (a) a new gap fails, and (b) a fixed one fails
// until its entry is deleted -- the table can only shrink. An entry with no reason
// is refused.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { discoverApplications, renderApplication } from "./rendered-storage-claims.ts";

const REPO = join(import.meta.dir, "..", "..", "..");

/** The Applications this family owns. `appId` is `<tree>/<dir>` as discoverApplications reports it. */
const GIT_PATH_APPS = [
  "full-ai-cluster/hat-system",
  "full-ai-cluster/orleans",
  "full-ai-cluster/vllm",
  "full-ai-cluster/game-hosting/gmod",
  "full-ai-cluster/platform",
] as const;
const HELM_APPS = ["full-ai-cluster/forgejo", "full-ai-cluster/oz", "full-ai-cluster/ollama"] as const;

/** label -> why it is still open. The ratchet: this set must equal what the test finds. */
const KNOWN_GAPS: Readonly<Record<string, string>> = {
  "StatefulSet/gmod containers/sftp":
    "opt-in SFTP sidecar that idles in a poll loop until a key ConfigMap exists. Pricing it moves the gmod " +
    "total at the metal rung (10m/16Mi), which ripples into the catalogue row, the rendered snapshot and the " +
    "ladder's pinned totals for a container that does nothing by default. gmod is Burstable through its game " +
    "container, so the POD is not BestEffort; only this sidecar is.",
  "full-ai-cluster/oz":
    "ziti-controller renders `resources: {}`. Pricing it at the dev rung moves the dev lane's pinned memory " +
    "debt (`dev memory 9868>9216`) and every literal that quotes it; tracked as its own change so that ripple " +
    "is reviewable alone.",
};

const WORKLOAD_KINDS = new Set(["Deployment", "StatefulSet", "DaemonSet"]);

type Doc = Record<string, unknown>;
type Container = { name?: string; resources?: { requests?: { cpu?: unknown; memory?: unknown } } };

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function isRequested(value: unknown): boolean {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() !== "" : false;
}

/** The regular (long-running) containers of a workload document, labelled for a failure message. */
function regularContainers(doc: Doc): { label: string; container: Container }[] {
  const podSpec = asRecord(asRecord(asRecord(doc["spec"])?.["template"])?.["spec"]);
  const list = podSpec?.["containers"];
  if (!Array.isArray(list)) return [];
  const name = String(asRecord(doc["metadata"])?.["name"]);
  return (list as Container[]).map((container) => ({
    label: `${String(doc["kind"])}/${name} containers/${container.name}`,
    container,
  }));
}

function findings(): { found: Set<string>; vacuous: string[] } {
  const sources = discoverApplications(REPO);
  const found = new Set<string>();
  const vacuous: string[] = [];

  for (const appId of GIT_PATH_APPS) {
    const source = sources.find((s) => s.appId === appId && s.kind === "git-path");
    if (source === undefined) {
      vacuous.push(`${appId}: not a discoverable git-path Application`);
      continue;
    }
    const rendered = renderApplication(source, { repoRoot: REPO });
    if (!rendered.ok) {
      vacuous.push(`${appId}: ${rendered.reason}: ${rendered.detail}`);
      continue;
    }
    const workloads = rendered.documents.filter((d) => WORKLOAD_KINDS.has(String(d["kind"])));
    if (workloads.length === 0) vacuous.push(`${appId}: renders no workload`);
    for (const doc of workloads) {
      for (const { label, container } of regularContainers(doc)) {
        const requests = container.resources?.requests;
        if (!isRequested(requests?.["cpu"]) || !isRequested(requests?.["memory"])) found.add(label);
      }
    }
  }

  for (const appId of HELM_APPS) {
    const source = sources.find((s) => s.appId === appId && s.kind !== "git-path");
    if (source === undefined) {
      vacuous.push(`${appId}: not a discoverable helm Application`);
      continue;
    }
    const requests = asRecord(asRecord(asRecord(source.valuesObject)?.["resources"])?.["requests"]);
    if (!isRequested(requests?.["cpu"]) || !isRequested(requests?.["memory"])) found.add(appId);
  }
  return { found, vacuous };
}

describe("long-running containers of the AI / workload / platform family", () => {
  const { found, vacuous } = findings();

  test("every Application was actually read (an unread one would pass vacuously)", () => {
    expect(vacuous).toEqual([]);
  });

  test("the set of containers that request nothing equals the known-gap ratchet", () => {
    expect([...found].sort()).toEqual(Object.keys(KNOWN_GAPS).sort());
  });

  test("every known gap states why it is still open", () => {
    for (const [label, reason] of Object.entries(KNOWN_GAPS)) {
      expect(reason.trim().length, `${label}: a gap with no reason is a silencer`).toBeGreaterThan(40);
    }
  });
});

describe("helm Applications of the family: `resources` is a key the pinned chart accepts", () => {
  const sources = discoverApplications(REPO);
  const schema = JSON.parse(
    readFileSync(join(REPO, "src/Core.TypeScript/cluster/inert-valuesobject-keys.schema.json"), "utf8"),
  ) as { charts: Record<string, unknown> };

  for (const appId of HELM_APPS) {
    test(`${appId}: top-level \`resources\` is accepted, so the coordinate is not inert`, () => {
      const source = sources.find((s) => s.appId === appId && s.kind !== "git-path");
      if (source === undefined) throw new Error(`${appId} not discoverable`);
      const key = `${source.repoURL}|${source.chart}|${source.targetRevision}`;
      const chart = schema.charts[key];
      expect(chart, `no accepted-keys schema recorded for ${key}`).toBeDefined();
      const literal = asRecord(asRecord(chart)?.["literal"]) ?? {};
      expect(Object.keys(literal), `${key} does not accept a top-level \`resources\` key`).toContain("resources");
    });
  }
});
