#!/usr/bin/env bun
// Bring up a kind cluster whose CNI is CILIUM, installed from the value
// surface the metal cluster ships, and assert what that actually proves.
//
// WHAT THIS LANE IS FOR
// ---------------------
// The other kind lanes take kind's default CNI (kindnetd) and kube-proxy, so
// the CNI the real cluster will run -- Cilium, kube-proxy-replacement, cluster
// -pool IPAM, WireGuard -- is exercised by nothing in CI. This lane runs it.
//
// WHAT IT DELIBERATELY DOES NOT DO
// --------------------------------
// It does not install ArgoCD or the app-of-apps. That is the other lanes' job
// and folding it in here would make every Cilium failure arrive wrapped in
// forty unrelated Applications. This lane answers exactly one question -- does
// OUR Cilium configuration come up and serve as the CNI -- and it answers it in
// a log short enough to read.
//
// THE ASSERTIONS, AND WHY EACH ONE CAN FAIL
// -----------------------------------------
//   kindnet ABSENT       the profile's disableDefaultCNI took effect; without
//                        this, Cilium could be "installed" beside a working CNI
//                        and every other check would pass on kindnet's work.
//   kube-proxy ABSENT    `kubeProxyReplacement: true` is really carrying
//                        service routing rather than sitting behind kube-proxy.
//   nodes READY          the CNI is functioning: a node with no working CNI
//                        never leaves NotReady.
//   pod IPs from the    Cilium's cluster-pool IPAM allocated them. kind's
//   DECLARED pod CIDR    own default is 10.244/16, so this distinguishes
//                        "Cilium is installed" from "Cilium is the CNI". The
//                        pool is READ from the values actually installed
//                        (ipam.operator.clusterPoolIPv4PodCIDRList), never
//                        hardcoded -- the pod CIDR is derived from the cluster
//                        name (cluster-cidr.ts), so a hardcoded prefix here is
//                        a fourth surface that silently disagrees the moment
//                        the cluster identity changes.
//   cilium_wg0 EXISTS    the WireGuard kernel path worked. This is the one that
//                        was never exercised anywhere before this lane.
//   Gateway API verdict  compared against the gap recorded in
//                        cilium-kind-lane.ts, in BOTH directions.
//
// AND THE HONEST LIMIT, STATED IN THE OUTPUT TOO: with one node, WireGuard
// encrypts nothing. So does it on metal, for the same reasons -- see
// `encryptionReachability`. This lane proves the configuration INSTALLS AND
// SERVES; it does not and cannot prove that it encrypts.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CILIUM_KIND_PROFILE,
  GATEWAY_API_CRD_BUNDLE,
  GATEWAY_API_CRD_GAP_REASONS,
  ciliumKindValues,
  encryptionReachability,
  kindClusterShape,
  metalClusterShape,
  readCiliumValueSurfaces,
  renderValuesYaml,
} from "../cilium-kind-lane.ts";
import { cidrBounds } from "../cluster-cidr.ts";
import type { ProcessRunner } from "../ports.ts";
import { assertKindCiStackReady, liveDevClusterPorts } from "./deps.ts";
import { assertDnsLabel, REPO_ROOT } from "./lib.ts";

const CILIUM_CHART_VERSION = "1.16.5";
const CILIUM_CHART_REPO = "https://helm.cilium.io";

interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

function capture(runner: ProcessRunner, argv0: string, args: readonly string[]): { ok: boolean; text: string } {
  const result = runner.run(argv0, args);
  return { ok: result.status === 0, text: `${result.stdout}${result.stderr}` };
}

/** A DaemonSet that must NOT exist. `kubectl get` failing is the pass. */
function checkAbsentDaemonSet(runner: ProcessRunner, name: string, why: string): Check {
  const probe = capture(runner, "kubectl", ["-n", "kube-system", "get", "daemonset", name, "--no-headers"]);
  return {
    name: `${name} DaemonSet absent`,
    ok: !probe.ok,
    detail: probe.ok ? `${name} IS running -- ${why}` : `${name} not present, as required (${why})`,
  };
}

function checkNodesReady(runner: ProcessRunner): Check {
  const nodes = capture(runner, "kubectl", [
    "get",
    "nodes",
    "-o",
    "jsonpath={range .items[*]}{.metadata.name}={.status.conditions[?(@.type=='Ready')].status}{'\\n'}{end}",
  ]);
  const lines = nodes.text
    .trim()
    .split("\n")
    .filter((line) => line.length > 0);
  const notReady = lines.filter((line) => !line.endsWith("=True"));
  return {
    name: "every node Ready under Cilium",
    ok: nodes.ok && lines.length > 0 && notReady.length === 0,
    detail: lines.length === 0 ? "no nodes reported" : `${lines.length} node(s): ${lines.join(" ")}`,
  };
}

/**
 * The pod CIDR Cilium was actually installed with.
 *
 * Read from the rendered values rather than hardcoded: `cluster-cidr.ts`
 * DERIVES the pod CIDR from the cluster name, so any constant here is a
 * surface that disagrees the moment the name changes -- which is exactly the
 * disagreement `lint-cluster-cidr-agreement.ts` exists to prevent, on a
 * surface it does not yet cover. Throws rather than defaulting: a guessed pod
 * CIDR would make the assertion below pass against the wrong network.
 */
function podCidrFromValues(values: Readonly<Record<string, unknown>>): string {
  const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  const ipam = values["ipam"];
  const operator = isRecord(ipam) ? ipam["operator"] : undefined;
  const list = isRecord(operator) ? operator["clusterPoolIPv4PodCIDRList"] : undefined;
  const first = Array.isArray(list) ? (list as readonly unknown[])[0] : undefined;
  if (typeof first !== "string") {
    throw new Error(
      "Cilium values carry no ipam.operator.clusterPoolIPv4PodCIDRList[0]; refusing to guess the pod CIDR",
    );
  }
  return first;
}

function checkPodIpamFromClusterPool(runner: ProcessRunner, podCidr: string): Check {
  const pods = capture(runner, "kubectl", [
    "-n",
    "kube-system",
    "get",
    "pods",
    "-l",
    "k8s-app=kube-dns",
    "-o",
    "jsonpath={range .items[*]}{.metadata.name}={.status.podIP}{' '}{.spec.hostNetwork}{'\\n'}{end}",
  ]);
  const rows = pods.text
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .filter((line) => !line.endsWith(" true"));
  // Numeric containment, not a string prefix: `10.143.0.0/17` is not a
  // prefix-comparable boundary (10.143.128.0 is OUTSIDE it while sharing the
  // "10.143." text), so a startsWith test would accept addresses the pool
  // never hands out.
  const pool = cidrBounds(podCidr);
  const inPool = (ip: string): boolean => {
    const addr = cidrBounds(`${ip}/32`).first;
    return addr >= pool.first && addr <= pool.last;
  };
  const fromPool = rows.filter((row) => {
    const ip = row.split("=")[1];
    return ip !== undefined && ip.length > 0 && inPool(ip);
  });
  return {
    name: `CoreDNS pod IPs come from cluster-pool ${podCidr}`,
    ok: pods.ok && rows.length > 0 && fromPool.length === rows.length,
    detail:
      rows.length === 0
        ? "no non-hostNetwork CoreDNS pod found to read an IP from"
        : `${fromPool.length}/${rows.length} from the pool: ${rows.join(" ")}`,
  };
}

function checkWireguardDevice(runner: ProcessRunner): Check {
  const link = capture(runner, "kubectl", [
    "-n",
    "kube-system",
    "exec",
    "daemonset/cilium",
    "-c",
    "cilium-agent",
    "--",
    "ip",
    "-o",
    "link",
    "show",
    "cilium_wg0",
  ]);
  return {
    name: "cilium_wg0 WireGuard device exists in the agent",
    ok: link.ok && link.text.includes("cilium_wg0"),
    detail: link.text.trim().split("\n").slice(0, 3).join(" | ") || "no output",
  };
}

/**
 * The Gateway API verdict, checked in BOTH directions against the registry.
 *
 * Cilium 1.16.5 requires a TLSRoute CRD this repo does not vendor, and on that
 * failure `initGatewayAPIController` logs and returns nil -- the operator stays
 * Ready and the controller never starts. So the EXPECTED state today is: the
 * refusal line is in the operator log, and the `cilium` GatewayClass never gets
 * an Accepted condition. Either half moving is a real change and goes red.
 *
 * Reading BOTH is deliberate. The GatewayClass condition alone would be an
 * absence, and an absence can also mean "not yet"; the log line is POSITIVE
 * evidence that the controller was asked and declined.
 */
function checkGatewayApiVerdict(runner: ProcessRunner): Check {
  const expectGap = GATEWAY_API_CRD_GAP_REASONS.size > 0;
  const logs = capture(runner, "kubectl", ["-n", "kube-system", "logs", "deployment/cilium-operator", "--tail=-1"]);
  const refused = logs.text.includes("Required GatewayAPI resources are not found");
  const accepted = capture(runner, "kubectl", [
    "get",
    "gatewayclass",
    "cilium",
    "-o",
    "jsonpath={.status.conditions[?(@.type=='Accepted')].status}",
  ]);
  const acceptedTrue = accepted.ok && accepted.text.trim() === "True";

  if (expectGap) {
    return {
      name: "Gateway API controller state matches the recorded CRD gap",
      ok: refused && !acceptedTrue,
      detail: refused
        ? acceptedTrue
          ? "operator logged the CRD refusal AND the GatewayClass is Accepted -- contradictory, investigate"
          : "operator logged 'Required GatewayAPI resources are not found' and the GatewayClass is not Accepted, " +
            "which is exactly what GATEWAY_API_CRD_GAP_REASONS records"
        : acceptedTrue
          ? "the Gateway API controller STARTED -- the recorded gap has been fixed; delete the entry from " +
            "GATEWAY_API_CRD_GAP_REASONS in cilium-kind-lane.ts"
          : "neither the refusal line nor an Accepted GatewayClass was readable; the verdict is UNKNOWN, " +
            "and an unknown verdict is not a pass",
    };
  }
  return {
    name: "Gateway API controller started (no CRD gap recorded)",
    ok: acceptedTrue,
    detail: acceptedTrue
      ? "GatewayClass cilium is Accepted"
      : "no gap is recorded, so the controller was expected to start",
  };
}

function usage(): never {
  console.error(
    "usage: bun src/Core.TypeScript/cluster/dev-cluster/cilium-kind-up.ts [--cluster-name NAME] [--timeout-sec N]",
  );
  process.exit(2);
}

function main(argv: readonly string[]): void {
  let clusterName = "zeta-ci-cilium";
  let timeoutSec = 600;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--cluster-name") {
      const value = argv[i + 1];
      if (value === undefined) usage();
      clusterName = value;
      i++;
      continue;
    }
    if (arg === "--timeout-sec") {
      const value = argv[i + 1];
      if (value === undefined || !/^[1-9]\d*$/.test(value)) usage();
      timeoutSec = Number(value);
      i++;
      continue;
    }
    usage();
  }
  assertDnsLabel(clusterName, "cluster name");

  const profilePath = join(REPO_ROOT, CILIUM_KIND_PROFILE);
  const crdBundlePath = join(REPO_ROOT, GATEWAY_API_CRD_BUNDLE);
  for (const [label, path] of [
    ["kind profile", profilePath],
    ["Gateway API CRD bundle", crdBundlePath],
  ] as const) {
    if (!existsSync(path)) {
      console.error(`ERROR: ${label} not found: ${path}`);
      process.exit(1);
    }
  }

  const surfaces = readCiliumValueSurfaces(REPO_ROOT);
  const shipped = surfaces.find((surface) => surface.path.includes("applications/cilium/"))?.values;
  if (shipped === undefined) {
    console.error("ERROR: the ArgoCD Cilium value surface was not found in the roster; refusing to invent values.");
    process.exit(1);
  }
  const { values, deltas } = ciliumKindValues(shipped, clusterName);

  console.log(`Installing Cilium ${CILIUM_CHART_VERSION} from ${surfaces.map((s) => s.path).join(", ")}`);
  console.log(`Value deltas for the kind substrate (${deltas.length}):`);
  for (const delta of deltas) console.log(`  ${delta.path}: ${delta.shipped} -> ${delta.kind} (${delta.reason})`);

  const kindShape = kindClusterShape(readFileSync(profilePath, "utf8"));
  const reach = encryptionReachability(values, kindShape);
  const metalReach = encryptionReachability(shipped, metalClusterShape(REPO_ROOT));
  console.log(
    `\nWireGuard reachability here: ${reach.verdict.toUpperCase()} (metal: ${metalReach.verdict.toUpperCase()})`,
  );
  for (const reason of reach.reasons) console.log(`  ${reason}`);

  const ports = liveDevClusterPorts({ clusterShape: "kind-in-docker" });
  assertKindCiStackReady(ports);
  const { localCluster, controlPlane, packages, process: runner } = ports;
  const context = localCluster.contextName(clusterName);

  if (localCluster.list().includes(clusterName)) {
    console.log(`\nCluster ${clusterName} already exists; reusing it.`);
  } else {
    // waitForReady is FALSE on purpose: with disableDefaultCNI there is no CNI
    // yet, so nodes cannot reach Ready until Cilium is installed. Waiting here
    // would time out every time and blame the wrong thing.
    console.log(`\nCreating kind cluster ${clusterName} (no default CNI, no kube-proxy) ...`);
    localCluster.create({ name: clusterName, configPath: profilePath, waitForReady: false });
  }

  controlPlane.selectContext(context);
  controlPlane.waitForApiReady(60, 3000);

  console.log("Applying the VENDORED Gateway API CRD bundle (the same file first boot applies on metal) ...");
  controlPlane.applyFileManifest(crdBundlePath);

  const valuesPath = join(process.env["RUNNER_TEMP"] ?? "/tmp", `cilium-kind-values-${clusterName}.json`);
  // writeFileSync, not Bun.write: helm reads this file in the very next
  // statement and Bun.write is async, so an unawaited call is a race that would
  // hand helm an empty values file -- i.e. the CHART DEFAULTS, silently.
  writeFileSync(valuesPath, renderValuesYaml(values));
  console.log(`Rendered Cilium values to ${valuesPath}`);

  if (!packages.releaseInstalled("kube-system", "cilium")) {
    packages.install({
      release: "cilium",
      chart: "cilium/cilium",
      version: CILIUM_CHART_VERSION,
      namespace: "kube-system",
      repoAlias: "cilium",
      repoUrl: CILIUM_CHART_REPO,
      setValues: [],
      valuesFiles: [valuesPath],
    });
  }

  // CoreDNS is in this list because one of the checks below reads its pod IP to
  // prove Cilium's IPAM is the one allocating. Node-Ready arrives the moment the
  // CNI config lands; CoreDNS gets its sandbox a beat later, so reading the IP
  // without this wait is a race, and a racing assertion in a blocking job is a
  // flake that teaches people to ignore the job.
  console.log("\nWaiting for the Cilium agent + operator + CoreDNS to roll out ...");
  for (const target of ["daemonset/cilium", "deployment/cilium-operator", "deployment/coredns"]) {
    const rollout = runner.run(
      "kubectl",
      ["-n", "kube-system", "rollout", "status", target, `--timeout=${timeoutSec}s`],
      {
        stdio: "inherit",
      },
    );
    if (rollout.status !== 0) {
      console.error(`ERROR: ${target} did not become available within ${timeoutSec}s.`);
      process.exit(1);
    }
  }
  controlPlane.waitForAllNodesReady(timeoutSec);

  // Best-effort diagnostics, never asserted: `cilium-dbg status` names the
  // encryption mode and the WireGuard pubkey, which is the first thing anyone
  // reading a failure wants and the last thing worth failing a job over.
  const status = capture(runner, "kubectl", [
    "-n",
    "kube-system",
    "exec",
    "daemonset/cilium",
    "-c",
    "cilium-agent",
    "--",
    "cilium-dbg",
    "status",
  ]);
  if (status.ok) {
    console.log("\ncilium-dbg status (diagnostic, not asserted):");
    for (const line of status.text
      .split("\n")
      .filter((line) => /Encryption|KubeProxyReplacement|IPAM|Cilium:/.test(line))) {
      console.log(`  ${line.trim()}`);
    }
  }

  const checks: readonly Check[] = [
    checkAbsentDaemonSet(
      runner,
      "kindnet",
      "the profile sets networking.disableDefaultCNI, so kind's own CNI must not be running",
    ),
    checkAbsentDaemonSet(
      runner,
      "kube-proxy",
      "the profile sets networking.kubeProxyMode: none, so Cilium's kubeProxyReplacement carries service routing",
    ),
    checkNodesReady(runner),
    checkPodIpamFromClusterPool(runner, podCidrFromValues(values)),
    checkWireguardDevice(runner),
    checkGatewayApiVerdict(runner),
  ];

  console.log("\nChecks:");
  for (const check of checks) console.log(`  ${check.ok ? "ok  " : "FAIL"}  ${check.name} -- ${check.detail}`);

  const failed = checks.filter((check) => !check.ok);
  console.log(
    JSON.stringify(
      {
        ok: failed.length === 0,
        cluster: clusterName,
        ciliumChartVersion: CILIUM_CHART_VERSION,
        valueDeltas: deltas.map((delta) => delta.path),
        encryption: { here: reach.verdict, metal: metalReach.verdict, reasons: reach.reasons },
        checks,
      },
      null,
      2,
    ),
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

if (import.meta.main) {
  main(process.argv.slice(2));
}
