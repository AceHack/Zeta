#!/usr/bin/env bun
/**
 * src/Core.TypeScript/cluster/kubevirt-vm-live-test.ts
 *
 * DOES A VM ACTUALLY RUN -- not just the operators?
 *
 * kubevirt-cdi-emulation-test.ts proves the vendored operators install and their CRs
 * reconcile (`KubeVirt` Available, `CDI` Deployed) and says in its own header what it does
 * NOT prove: "this does not boot a VirtualMachineInstance". This script is the other half,
 * run against the cluster that script leaves standing:
 *
 *   1. CDI, end to end:   a blank DataVolume on the `zeta-block-local` capability (the class
 *                         cdi-cr.yaml names for scratch space) reaches Succeeded. That is the
 *                         importer pod, the storage binding and the WaitForFirstConsumer
 *                         handling the CR enables, on one object.
 *   2. The Windows template validates: `kubectl apply --server-side --dry-run=server` of
 *                         full-ai-cluster/k8s/examples/kubevirt-windows-vm.yaml. Server-side,
 *                         so KubeVirt's and CDI's admission webhooks judge it -- a client-side
 *                         dry-run only proves the YAML parses.
 *   3. A VM boots:        a tiny cirros containerDisk VirtualMachineInstance reaches phase
 *                         Running under software emulation (GitHub-hosted runners have no
 *                         usable nested virtualisation).
 *
 * WHAT THIS DOES NOT PROVE, stated because a check that hides what it gave up is worse than
 * none: it does not boot WINDOWS (no licensed installer, and Windows under TCG is not usable,
 * per the template's own header), it proves nothing about hardware-accelerated KVM, and
 * `Running` is the libvirt domain starting, not a guest OS finishing boot.
 *
 * SAFETY: every kubectl call names `--context kind-<cluster>` and the cluster name must
 * start with `zeta-ci-`; a developer's current kube-context is never consulted.
 *
 * Exit codes: 0 all proved, 1 an assertion failed, 2 usage / refusal.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

/** The template's own path, so a rename shows up as a missing file here, not a skipped check. */
export const WINDOWS_TEMPLATE_PATH = "full-ai-cluster/k8s/examples/kubevirt-windows-vm.yaml";

/** Upstream's own tiny demo guest -- the image KubeVirt's docs and e2e use. ~15 MiB. */
export const CIRROS_IMAGE = "quay.io/kubevirt/cirros-container-disk-demo:v1.8.4";

/**
 * A blank DataVolume. `bindImmediately` matters and is the thing run 36859944232 taught: with the
 * `HonorWaitForFirstConsumer` feature gate cdi-cr.yaml enables, a DataVolume on a WaitForFirstConsumer
 * class (zeta-block-local is one) sits in phase WaitForFirstConsumer until a pod wants its PVC --
 * which is the design, not a stall. So the importer is exercised by asking for immediate binding, and
 * the WaitForFirstConsumer path is exercised separately by giving a VM a DataVolume to consume.
 */
export function blankDataVolumeManifest(namespace: string, storageClass: string, name = "live-blank", bindImmediately = true): string {
  return stringifyYaml({
    apiVersion: "cdi.kubevirt.io/v1beta1",
    kind: "DataVolume",
    metadata: {
      name,
      namespace,
      ...(bindImmediately ? { annotations: { "cdi.kubevirt.io/storage.bind.immediate.requested": "true" } } : {}),
    },
    spec: {
      source: { blank: {} },
      storage: { accessModes: ["ReadWriteOnce"], storageClassName: storageClass, resources: { requests: { storage: "1Gi" } } },
    },
  });
}

export function cirrosVmiManifest(namespace: string): string {
  return stringifyYaml({
    apiVersion: "kubevirt.io/v1",
    kind: "VirtualMachineInstance",
    metadata: { name: "live-cirros", namespace, labels: { "kubevirt.io/domain": "live-cirros" } },
    spec: {
      domain: {
        devices: {
          disks: [
            { name: "rootdisk", disk: { bus: "virtio" } },
            { name: "datadisk", disk: { bus: "virtio" } },
          ],
          interfaces: [{ name: "default", masquerade: {} }],
        },
        resources: { requests: { memory: "128Mi" } },
      },
      networks: [{ name: "default", pod: {} }],
      terminationGracePeriodSeconds: 0,
      volumes: [
        { name: "rootdisk", containerDisk: { image: CIRROS_IMAGE } },
        // A DataVolume on a WaitForFirstConsumer class: the VM is its first consumer, so reaching
        // Running proves CDI's WaitForFirstConsumer handling end to end.
        { name: "datadisk", dataVolume: { name: "live-wffc" } },
      ],
    },
  });
}

/**
 * Every Namespace the template declares. A server-side dry-run does not CREATE a namespace, so the
 * objects inside it are refused with `namespaces "x" not found` unless it exists -- which is what an
 * ArgoCD sync with CreateNamespace does first. The lane makes the same one-step bootstrap.
 */
export function templateNamespaces(templateText: string): readonly string[] {
  return templateText
    .split(/^---\s*$/m)
    .map((d) => parseYaml(d) as { kind?: string; metadata?: { name?: string } } | null)
    .filter((o): o is { kind: string; metadata: { name: string } } => o?.kind === "Namespace" && typeof o.metadata?.name === "string")
    .map((o) => o.metadata.name);
}

/** The template must declare every kind the dry-run is meant to exercise. */
export function templateKinds(templateText: string): readonly string[] {
  return templateText
    .split(/^---\s*$/m)
    .map((d) => (parseYaml(d) as { kind?: string } | null)?.kind)
    .filter((k): k is string => typeof k === "string");
}

interface Run {
  code: number;
  out: string;
}

class Kube {
  readonly context: string;
  constructor(clusterName: string) {
    this.context = `kind-${clusterName}`;
  }
  run(args: readonly string[], input?: string, timeoutMs = 600_000): Run {
    const r = spawnSync("kubectl", ["--context", this.context, ...args], { input, encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
    return { code: r.status ?? 124, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
  }
  json(args: readonly string[]): Record<string, any> | null {
    const r = this.run([...args, "-o", "json"]);
    if (r.code !== 0) return null;
    try {
      return JSON.parse(r.out) as Record<string, any>;
    } catch {
      return null;
    }
  }
}

async function waitFor(what: string, timeoutSec: number, probe: () => string | null): Promise<string> {
  const deadline = Date.now() + timeoutSec * 1000;
  let n = 0;
  while (Date.now() < deadline) {
    const got = probe();
    if (got !== null && got.startsWith("DONE:")) return got.slice(5);
    if (n++ % 3 === 0) console.log(`  ... ${what}: ${got ?? "no observation yet"}`);
    await Bun.sleep(10_000);
  }
  throw new Error(`timed out after ${timeoutSec}s waiting for ${what}`);
}

function diagnostics(kube: Kube, ns: string): void {
  for (const [title, args] of [
    ["vmi", ["-n", ns, "get", "vmi", "-o", "yaml"]],
    ["datavolume", ["-n", ns, "get", "datavolume,pvc,pods", "-o", "wide"]],
    ["datavolume yaml", ["-n", ns, "get", "datavolume", "-o", "yaml"]],
    ["events", ["-n", ns, "get", "events", "--sort-by=.lastTimestamp"]],
    ["kubevirt pods", ["-n", "kubevirt", "get", "pods", "-o", "wide"]],
    ["cdi pods", ["-n", "cdi", "get", "pods", "-o", "wide"]],
    ["virt-handler logs", ["-n", "kubevirt", "logs", "-l", "kubevirt.io=virt-handler", "--tail=80"]],
    ["virt-launcher logs", ["-n", ns, "logs", "-l", "kubevirt.io=virt-launcher", "--all-containers=true", "--tail=80"]],
    ["importer logs", ["-n", ns, "logs", "-l", "app=containerized-data-importer", "--tail=60"]],
  ] as const) {
    console.log(`\n===== ${title} =====`);
    console.log(kube.run(args).out.slice(-8000));
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let clusterName = "zeta-ci-virt";
  let run = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--run") run = true;
    else if (argv[i] === "--cluster-name") clusterName = argv[++i] ?? "";
    else run = false;
  }
  if (!run || !clusterName.startsWith("zeta-ci-")) {
    console.error('usage: bun kubevirt-vm-live-test.ts --run [--cluster-name zeta-ci-<x>]   (the name must start with "zeta-ci-")');
    process.exit(2);
  }
  const kube = new Kube(clusterName);
  const ns = "zeta-live-virt";
  const proved: string[] = [];
  const prove = (s: string): void => {
    proved.push(s);
    console.log(`PROVED ${s}`);
  };

  try {
    // The dev binding of the capability cdi-cr.yaml and the template name.
    const sc = kube.run(["apply", "-f", join(REPO_ROOT, "full-ai-cluster/dev-cluster/manifests/zeta-block-local.yaml")]);
    if (sc.code !== 0) throw new Error(`could not create StorageClass zeta-block-local: ${sc.out}`);
    kube.run(["annotate", "storageclass", "standard", "storageclass.kubernetes.io/is-default-class-", "--overwrite"]);
    const nsr = kube.run(["create", "namespace", ns]);
    if (nsr.code !== 0 && !nsr.out.includes("AlreadyExists")) throw new Error(`namespace: ${nsr.out}`);

    // 1. CDI end to end.
    const dv = kube.run(["apply", "-f", "-"], blankDataVolumeManifest(ns, "zeta-block-local", "live-blank", true));
    if (dv.code !== 0) throw new Error(`blank DataVolume was rejected: ${dv.out}`);
    await waitFor("DataVolume live-blank Succeeded", 420, () => {
      const o = kube.json(["-n", ns, "get", "datavolume", "live-blank"]);
      const phase = String(o?.status?.phase ?? "");
      return phase === "Succeeded" ? "DONE:ok" : `phase=${phase || "?"} ${JSON.stringify(o?.status?.conditions ?? []).slice(0, 300)}`;
    });
    prove("CDI imported a blank DataVolume to Succeeded on zeta-block-local (importer pod + storage binding)");

    // 2. The Windows template against the live admission webhooks.
    const template = join(REPO_ROOT, WINDOWS_TEMPLATE_PATH);
    for (const name of templateNamespaces(readFileSync(template, "utf8"))) {
      const made = kube.run(["create", "namespace", name]);
      if (made.code !== 0 && !made.out.includes("AlreadyExists")) throw new Error(`could not create the template's namespace ${name}: ${made.out}`);
    }
    const dry = kube.run(["apply", "--server-side", "--dry-run=server", "-f", template]);
    if (dry.code !== 0) throw new Error(`the Windows VM template failed server-side dry-run:\n${dry.out}`);
    const kinds = templateKinds(readFileSync(template, "utf8"));
    for (const need of ["VirtualMachine", "DataVolume"]) {
      if (!kinds.includes(need)) throw new Error(`the template no longer declares a ${need}; the dry-run would prove nothing about it`);
    }
    prove(`the Windows VM template passes server-side dry-run against KubeVirt+CDI admission (${kinds.join(", ")})`);

    // 3. A VM boots.
    const kvm = kube.run(["get", "kubevirt", "kubevirt", "-n", "kubevirt", "-o", "jsonpath={.spec.configuration.developerConfiguration.useEmulation}"]).out;
    console.log(`KubeVirt useEmulation=${kvm || "unset"}`);
    const wffc = kube.run(["apply", "-f", "-"], blankDataVolumeManifest(ns, "zeta-block-local", "live-wffc", false));
    if (wffc.code !== 0) throw new Error(`WaitForFirstConsumer DataVolume was rejected: ${wffc.out}`);
    const vmi = kube.run(["apply", "-f", "-"], cirrosVmiManifest(ns));
    if (vmi.code !== 0) throw new Error(`cirros VMI was rejected: ${vmi.out}`);
    const node = await waitFor("VMI live-cirros Running", 900, () => {
      const o = kube.json(["-n", ns, "get", "vmi", "live-cirros"]);
      const phase = String(o?.status?.phase ?? "");
      if (phase === "Failed") throw new Error(`VMI failed: ${JSON.stringify(o?.status?.conditions ?? [])}`);
      return phase === "Running" ? `DONE:${String(o?.status?.nodeName ?? "?")}` : `phase=${phase || "?"}`;
    });
    const wffcPhase = String(kube.json(["-n", ns, "get", "datavolume", "live-wffc"])?.status?.phase ?? "?");
    prove(`a cirros containerDisk VM reached phase Running on node ${node} (useEmulation=${kvm || "unset"}), consuming a WaitForFirstConsumer DataVolume now in phase ${wffcPhase}`);
    console.log(`\nALL PROVED (${proved.length}):\n  - ${proved.join("\n  - ")}`);
  } catch (e) {
    console.log(`\nFAILED: ${e instanceof Error ? e.message : String(e)}`);
    diagnostics(kube, ns);
    console.log(`\nPROVED BEFORE FAILURE (${proved.length}):\n  - ${proved.join("\n  - ")}`);
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await main();
}
