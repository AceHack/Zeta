// Pins the pure half of kubevirt-vm-live-test.ts. The live half needs a cluster with KubeVirt
// and CDI installed and runs in the `live-kind-virt` job of k8s-argocd-health-test.yml.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  blankDataVolumeManifest,
  CIRROS_IMAGE,
  cirrosVmiManifest,
  DRY_RUN_TEMPLATE_PATHS,
  REQUIRED_KINDS,
  templateKinds,
  templateNamespaces,
  templateRequiredNamespaces,
  WINDOWS_11_CI_PATH,
  WINDOWS_11_DESKTOP_PATH,
  WINDOWS_11_ISO_PATH,
  WINDOWS_11_NAMESPACE_PATH,
  WINDOWS_RUNNER_TOKEN_PATH,
  WINDOWS_RUNNER_VM_PATH,
  WINDOWS_TEMPLATE_PATH,
} from "./kubevirt-vm-live-test.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

describe("manifests the lane applies", () => {
  test("the cirros VMI boots from a containerDisk and asks for nothing the runner cannot give", () => {
    const vmi = parseYaml(cirrosVmiManifest("ns")) as any;
    expect(vmi.kind).toBe("VirtualMachineInstance");
    expect(vmi.metadata.namespace).toBe("ns");
    expect(vmi.spec.volumes[0].containerDisk.image).toBe(CIRROS_IMAGE);
    // a VM that asks for hundreds of MiB would not schedule beside two operators on a 4-vCPU runner
    expect(vmi.spec.domain.resources.requests.memory).toBe("128Mi");
    // `Running` is only reachable without /dev/kvm if the request is not pinned to hardware
    expect(JSON.stringify(vmi)).not.toContain("devices.kubevirt.io/kvm");
  });

  test("the cirros image tag follows the vendored KubeVirt pin, so the guest and the operator move together", () => {
    const operator = readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/applications/kubevirt/kubevirt-operator.yaml"), "utf8");
    const pin = /virt-operator:(v\d+\.\d+\.\d+)/.exec(operator)?.[1];
    expect(pin).toBeDefined();
    expect(CIRROS_IMAGE.endsWith(`:${pin}`)).toBe(true);
  });

  test("the CDI check uses the storage capability cdi-cr.yaml names for scratch space", () => {
    const cr = readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/applications/cdi/cdi-cr.yaml"), "utf8");
    const scratch = /scratchSpaceStorageClass:\s*(\S+)/.exec(cr)?.[1];
    expect(scratch).toBe("zeta-block-local");
    const dv = parseYaml(blankDataVolumeManifest("ns", scratch!)) as any;
    expect(dv.spec.storage.storageClassName).toBe(scratch);
    expect(dv.spec.source).toEqual({ blank: {} });
  });

  test("the importer check asks for immediate binding, because HonorWaitForFirstConsumer parks the other kind", () => {
    // run 36859944232: a blank DataVolume on a WaitForFirstConsumer class sat in phase
    // WaitForFirstConsumer for 420s -- correct behaviour, so the lane must not wait for Succeeded on it.
    const cr = readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/applications/cdi/cdi-cr.yaml"), "utf8");
    expect(cr).toContain("HonorWaitForFirstConsumer");
    const immediate = parseYaml(blankDataVolumeManifest("ns", "zeta-block-local", "a", true)) as any;
    expect(immediate.metadata.annotations["cdi.kubevirt.io/storage.bind.immediate.requested"]).toBe("true");
    const parked = parseYaml(blankDataVolumeManifest("ns", "zeta-block-local", "b", false)) as any;
    expect(parked.metadata.annotations).toBeUndefined();
  });

  test("the VM consumes a WaitForFirstConsumer DataVolume, so Running proves that path too", () => {
    const vmi = parseYaml(cirrosVmiManifest("ns")) as any;
    expect(vmi.spec.volumes.find((v: any) => v.name === "datadisk").dataVolume.name).toBe("live-wffc");
    expect(vmi.spec.domain.devices.disks.map((d: any) => d.name)).toEqual(["rootdisk", "datadisk"]);
  });
});

describe("the Windows template the dry-run is judged against", () => {
  test("declares a VirtualMachine and a DataVolume, so the dry-run exercises both webhooks", () => {
    const kinds = templateKinds(readFileSync(join(REPO_ROOT, WINDOWS_TEMPLATE_PATH), "utf8"));
    expect(kinds).toContain("VirtualMachine");
    expect(kinds).toContain("DataVolume");
    expect(kinds.length).toBeGreaterThanOrEqual(3);
  });

  test("its Hyper-V enlightenments are only fields KubeVirt's FeatureHyperv declares", () => {
    // Run 36862639220 (KubeVirt v1.8.4): the server rejected `.spec.template.spec.domain.features.hyperv.stimer:
    // field not declared in schema`. The field is `synictimer`. The list below is FeatureHyperv's json tags in
    // staging/src/kubevirt.io/api/core/v1/schema.go at v1.8.4; this keeps the template honest offline, and the
    // live dry-run remains the authority.
    const declared = new Set(["relaxed", "vapic", "spinlocks", "vpindex", "runtime", "synic", "synictimer", "reset", "vendorid", "frequencies", "reenlightenment", "tlbflush", "ipi", "evmcs"]);
    const docs = readFileSync(join(REPO_ROOT, WINDOWS_TEMPLATE_PATH), "utf8").split(/^---\s*$/m).map((d) => parseYaml(d) as any);
    const vm = docs.find((d) => d?.kind === "VirtualMachine");
    const hyperv = vm.spec.template.spec.domain.features.hyperv as Record<string, unknown>;
    expect(Object.keys(hyperv).filter((k) => !declared.has(k))).toEqual([]);
    // synictimer needs synic
    if ("synictimer" in hyperv) expect(hyperv.synic).toBeDefined();
  });

  test("the template's Namespace is found, so the lane can create it before a server-side dry-run", () => {
    expect(templateNamespaces(readFileSync(join(REPO_ROOT, WINDOWS_TEMPLATE_PATH), "utf8"))).toContain("windows-example");
    expect(templateNamespaces("kind: ConfigMap\nmetadata: { name: x }\n")).toEqual([]);
  });

  test("the Windows GitLab-runner examples are dry-run too, and each still declares what makes its dry-run mean something", () => {
    expect(DRY_RUN_TEMPLATE_PATHS).toEqual([
      WINDOWS_TEMPLATE_PATH,
      WINDOWS_RUNNER_VM_PATH,
      WINDOWS_RUNNER_TOKEN_PATH,
      WINDOWS_11_NAMESPACE_PATH,
      WINDOWS_11_ISO_PATH,
      WINDOWS_11_CI_PATH,
      WINDOWS_11_DESKTOP_PATH,
    ]);
    for (const path of DRY_RUN_TEMPLATE_PATHS) {
      const kinds = templateKinds(readFileSync(join(REPO_ROOT, path), "utf8"));
      for (const need of REQUIRED_KINDS[path] ?? []) expect(kinds).toContain(need);
      expect((REQUIRED_KINDS[path] ?? []).length).toBeGreaterThan(0);
    }
  });

  test("the runner examples declare no Namespace but live in `gitlab`, so the lane must create it itself", () => {
    // Without this the server-side dry-run is refused with `namespaces "gitlab" not found`, which would
    // read as a spec defect rather than a missing bootstrap step.
    for (const path of [WINDOWS_RUNNER_VM_PATH, WINDOWS_RUNNER_TOKEN_PATH]) {
      const text = readFileSync(join(REPO_ROOT, path), "utf8");
      expect(templateNamespaces(text)).toEqual([]);
      expect(templateRequiredNamespaces(text)).toEqual(["gitlab"]);
    }
    expect(templateRequiredNamespaces(readFileSync(join(REPO_ROOT, WINDOWS_TEMPLATE_PATH), "utf8"))).toEqual(["windows-example"]);
  });

  test("an empty or kindless document yields no kinds rather than a crash", () => {
    expect(templateKinds("")).toEqual([]);
    expect(templateKinds("a: 1\n---\nkind: Foo\n")).toEqual(["Foo"]);
  });
});
