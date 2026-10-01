// Falsifiers for full-ai-cluster/k8s/examples/kubevirt-windows-vm.yaml
// -- the Windows-guest TEMPLATE, which is documentation that must stay runnable.
//
// A template nothing parses rots silently: the install path it documents (virtio
// drivers, a DataVolume ISO, a storage class that exists) is exactly the part that
// drifts when a class is renamed or KubeVirt is bumped, and nobody finds out until
// someone tries to build a Windows VM from it. These tests pin the invariants a
// Windows guest needs, and the ones this tree's own rules require, so a drift is
// a red check rather than a failed VM.
//
// WHAT THIS CANNOT PROVE, and says so: nothing here boots a guest. It proves the
// template is internally consistent and consistent with the tree it sits in. That
// a Windows ISO installs and RDP answers needs /dev/kvm and a licensed ISO.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAllDocuments, parse as parseYaml } from "yaml";
import { STORAGE_CAPABILITIES } from "./storage-capabilities.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const KUBEVIRT_DIR = join(REPO_ROOT, "full-ai-cluster/k8s/applications/kubevirt");

type Doc = Record<string, any>;

function loadDocs(path: string): Doc[] {
  return parseAllDocuments(readFileSync(path, "utf8")).map((d) => d.toJS() as Doc);
}

const EXAMPLE = join(REPO_ROOT, "full-ai-cluster/k8s/examples/kubevirt-windows-vm.yaml");
const docs = loadDocs(EXAMPLE);
const byKind = (kind: string): Doc[] => docs.filter((d) => d?.kind === kind);

describe("shape", () => {
  test("is exactly a Namespace, two DataVolumes, one VirtualMachine and one Service", () => {
    expect(docs.map((d) => d.kind).sort()).toEqual(
      ["DataVolume", "DataVolume", "Namespace", "Service", "VirtualMachine"].sort(),
    );
  });

  test("is NOT applied and NOT priced: it sits outside the applications tree", () => {
    // Two reasons, both load-bearing. ArgoCD's root reads only
    // k8s/applications/*/Application.yaml, so nothing syncs it (applying it would pull
    // an ISO and reserve 8 GiB on every install). AND every audit that prices the
    // cluster walks that tree for volume claims: a 64Gi replicated DataVolume inside it
    // is counted as Longhorn-pool demand no sync ever provisions. (Measured: dropping
    // it under k8s/applications/kubevirt/examples/ moved the pool-demand ledger and
    // failed three ledger tests in single-node-readiness / storage-profiles.)
    const applications = join(REPO_ROOT, "full-ai-cluster/k8s/applications");
    expect(EXAMPLE.startsWith(applications)).toBe(false);
    const app = parseYaml(readFileSync(join(KUBEVIRT_DIR, "Application.yaml"), "utf8")) as Doc;
    expect(app.spec.source.directory.include).toBe("{kubevirt-operator,kubevirt-cr}.yaml");
  });
});

describe("the VirtualMachine is a Windows guest, not a Linux one with a Windows name", () => {
  const vm = byKind("VirtualMachine")[0]!;
  const domain = vm.spec.template.spec.domain;

  test("does not start itself before the ISO has imported", () => {
    // A VM that boots before the DataVolume finishes sits at "no bootable device".
    expect(vm.spec.runStrategy).toBe("Halted");
  });

  test("carries the Hyper-V enlightenments, the clock policy and EFI Windows needs", () => {
    // Without relaxed/vapic/spinlocks Windows spends its time in timer interrupts.
    for (const key of ["relaxed", "vapic", "spinlocks", "vpindex", "runtime", "synic", "stimer"]) {
      expect(domain.features.hyperv).toHaveProperty(key);
    }
    expect(domain.features.hyperv.spinlocks.spinlocks).toBe(8191);
    expect(domain.clock.timer.hpet.present).toBe(false);
    expect(domain.clock.timer.hyperv).toBeDefined();
    expect(domain.firmware.bootloader.efi).toBeDefined();
    // Windows shutdown is slow; the 30s default kills it mid-update.
    expect(vm.spec.template.spec.terminationGracePeriodSeconds).toBeGreaterThanOrEqual(120);
  });

  test("memory request == limit (Guaranteed on the incompressible axis) and there is NO CPU limit", () => {
    const { requests, limits } = domain.resources;
    expect(requests.memory).toBeDefined();
    expect(limits.memory).toBe(requests.memory);
    expect(domain.memory.guest).toBe(requests.memory);
    // A CPU limit is a CFS quota: it throttles vCPU threads and the guest sees steal time as a hang.
    expect(limits.cpu).toBeUndefined();
    expect(requests.cpu).toBeDefined();
  });

  test("the virtio driver disk rides along as a CD-ROM, pinned to the SAME release as the vendored operator", () => {
    const volume = vm.spec.template.spec.volumes.find((v: Doc) => v.name === "virtio-win");
    expect(volume?.containerDisk?.image).toBeDefined();
    const cdrom = domain.devices.disks.find((d: Doc) => d.name === "virtio-win");
    expect(cdrom?.cdrom).toBeDefined();

    // KubeVirt publishes virtio-container-disk at its own release tag. Deriving the
    // expected tag from the vendored operator (rather than restating it here) is what
    // makes a KubeVirt bump that forgets this template a red test.
    const operator = readFileSync(join(KUBEVIRT_DIR, "kubevirt-operator.yaml"), "utf8");
    const version = /name: KUBEVIRT_VERSION\s+value: (v[0-9.]+)/.exec(operator)?.[1];
    expect(version).toBeDefined();
    expect(volume.containerDisk.image).toBe(`quay.io/kubevirt/virtio-container-disk:${version}`);
    expect(volume.containerDisk.image).not.toContain(":latest");
  });

  test("the boot disk and the ISO are both attached, ISO first for the install", () => {
    const disks = domain.devices.disks as Doc[];
    const iso = disks.find((d) => d.name === "iso")!;
    const root = disks.find((d) => d.name === "root")!;
    expect(iso.cdrom).toBeDefined();
    expect(root.disk.bus).toBe("virtio");
    expect(iso.bootOrder).toBeLessThan(root.bootOrder);
  });

  test("every volume names a DataVolume or containerDisk that exists in this file", () => {
    const dvNames = new Set(byKind("DataVolume").map((d) => d.metadata.name));
    for (const volume of vm.spec.template.spec.volumes as Doc[]) {
      if (volume.dataVolume) expect(dvNames.has(volume.dataVolume.name)).toBe(true);
      else expect(volume.containerDisk).toBeDefined();
    }
    // And every attached disk has a volume behind it.
    const volumeNames = new Set((vm.spec.template.spec.volumes as Doc[]).map((v) => v.name));
    for (const disk of domain.devices.disks as Doc[]) expect(volumeNames.has(disk.name)).toBe(true);
  });
});

describe("storage follows the tree's own rules", () => {
  const dvs = byKind("DataVolume");

  test("every DataVolume names a storage CAPABILITY, never a provider class, and states its access mode", () => {
    expect(dvs).toHaveLength(2);
    for (const dv of dvs) {
      expect(STORAGE_CAPABILITIES as readonly string[]).toContain(dv.spec.storage.storageClassName);
      expect(dv.spec.storage.accessModes).toEqual(["ReadWriteOnce"]);
      expect(dv.spec.storage.resources.requests.storage).toMatch(/^\d+(Gi|Mi|Ti)$/);
    }
  });

  test("the guest disk is on the REPLICATED class (a VM disk IS a replicated volume); the ISO is on the local one", () => {
    const root = dvs.find((d) => d.metadata.name.endsWith("-root"))!;
    const iso = dvs.find((d) => d.metadata.name.endsWith("-iso"))!;
    expect(root.spec.storage.storageClassName).toBe("zeta-block-replicated");
    expect(iso.spec.storage.storageClassName).toBe("zeta-block-local");
  });

  test("the ISO import is cleaned up after it succeeds, and the root disk starts blank", () => {
    const iso = dvs.find((d) => d.metadata.name.endsWith("-iso"))!;
    const root = dvs.find((d) => d.metadata.name.endsWith("-root"))!;
    expect(iso.metadata.annotations["cdi.kubevirt.io/storage.deleteAfterCompletion"]).toBe("true");
    expect(iso.spec.source.http.url).toBeDefined();
    expect(root.spec.source.blank).toBeDefined();
  });
});

describe("RDP", () => {
  const vm = byKind("VirtualMachine")[0]!;
  const service = byKind("Service")[0]!;

  test("the Service selects the label KubeVirt stamps on the launcher pod from the VM template", () => {
    const label = "kubevirt.io/domain";
    expect(vm.spec.template.metadata.labels[label]).toBeDefined();
    expect(service.spec.selector[label]).toBe(vm.spec.template.metadata.labels[label]);
  });

  test("publishes 3389, and is ClusterIP by default (an internet-facing RDP port is the most-scanned there is)", () => {
    expect(service.spec.ports[0].port).toBe(3389);
    expect(service.spec.type).toBe("ClusterIP");
  });

  test("everything lives in the namespace the file creates", () => {
    const ns = byKind("Namespace")[0]!.metadata.name;
    for (const doc of docs.filter((d) => d.kind !== "Namespace")) expect(doc.metadata.namespace).toBe(ns);
  });
});
