/**
 * windows-vm-golden-image.test.ts -- falsifiers for the golden-image helper, the RDP login check, and the runbooks that
 * name them.
 *
 *   src/Core.TypeScript/cluster/windows-vm-golden-image.ts   capture / restore / guard / selftest (pure parts here)
 *   src/Core.TypeScript/cluster/windows-11-rdp-check.ts      a real RDP login from a helper pod, password never shown
 *   docs/ops/WINDOWS-VM-GOLDEN-IMAGE.md, docs/ops/WINDOWS-11-VMS.md
 *
 *   A. NAMES AND SIZES -- quantities, dates, labels and claim names are pure and refuse what would not be a valid claim.
 *   B. THE CAPACITY GUARD -- on the numbers measured on this node: the legacy clone path fits, the populator's prime
 *      claim does not, a restore next to the golden does not, a third running VM does not.
 *   C. THE MANIFESTS -- Longhorn class, Filesystem mode, the legacy-clone annotation, no size on a disk clone, an
 *      explicit one on a state clone, read-only verification, a restored VM that is halted and carries no installer ISO.
 *   D. THE VERIFICATION -- a mismatch is reported, a match is not assumed.
 *   E. THE RDP CHECK -- the password is never in argv, the pod manifest, or the output.
 *   F. THE RUNBOOKS -- every command the owner types is in them, and the live-measured limits are stated.
 *
 * WHAT THIS CANNOT PROVE: that the cluster clones. That was measured live (2026-10-04) and `selftest` repeats it; the
 * measurements are in the runbook, not asserted here.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseAllDocuments } from "yaml";
import {
  CAPTURABLE_VMS,
  RESERVED_VM_NAMES,
  isCapturableVm,
  STORAGE_CLASS,
  capacityGuard,
  cloneDataVolume,
  compareVerify,
  dateStamp,
  formatGiB,
  goldenName,
  labelProblem,
  longhornSnapshot,
  parseQuantity,
  parseVerify,
  restoredRootName,
  restoredServices,
  restoredStateName,
  restoredVm,
  restoredVmNameProblem,
  schedulableBytes,
  snapshotName,
  stateCloneSize,
  stateName,
  verifyPod,
  vmNeedFromTemplate,
  type DiskFacts,
  type GuardInput,
} from "./windows-vm-golden-image.ts";
import { ADMIN, POD, checkScript, extractAdminPassword, freerdpArgs, helperPodManifest, isSecurityLayer, redact } from "./windows-11-rdp-check.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const DESKTOP_FILE = join(REPO_ROOT, "full-ai-cluster/k8s/examples/windows-11/30-win11-desktop.yaml");
const GOLDEN_RUNBOOK = join(REPO_ROOT, "docs/ops/WINDOWS-VM-GOLDEN-IMAGE.md");
const RUNBOOK = join(REPO_ROOT, "docs/ops/WINDOWS-11-VMS.md");
const GIB = 1024 ** 3;

type Doc = Record<string, any>;

function desktopVm(): Doc {
  const docs = parseAllDocuments(readFileSync(DESKTOP_FILE, "utf8")).map((d) => d.toJS() as Doc);
  return docs.find((d) => d.kind === "VirtualMachine")!;
}

// The numbers MEASURED on this node on 2026-10-04 (kubectl get nodes.longhorn.io / resourcequota / the Longhorn volume).
const DISKS: DiskFacts[] = [
  { name: "disk1", maximum: 796.2 * GIB, available: 749.0 * GIB, scheduled: 393.0 * GIB, reserved: 238 * GIB, allowScheduling: true, ready: true },
  { name: "disk2", maximum: 915.8 * GIB, available: 814.0 * GIB, scheduled: 421.4 * GIB, reserved: 274 * GIB, allowScheduling: true, ready: true },
];
const ROOT_BYTES = 113_816_633_344; // win11-desktop-root, 106 Gi
const ROOT_ACTUAL = 20_877_099_008; // what it really occupied (thin)
const QUOTA_HARD = { "requests.storage": "400Gi", persistentvolumeclaims: "12", "requests.memory": "24Gi", "limits.memory": "28Gi", "requests.cpu": "8", pods: "12" };
const QUOTA_USED = { "requests.storage": "216273833167", persistentvolumeclaims: "5", "requests.memory": "18008941056", "limits.memory": "18136941056", "requests.cpu": "4012m", pods: "2" };

function guardInput(over: Partial<GuardInput> = {}): GuardInput {
  return {
    sourceBytes: ROOT_BYTES,
    sourceActualBytes: ROOT_ACTUAL,
    stateBytes: 12 * 1024 ** 2,
    usePopulator: false,
    quotaHard: QUOTA_HARD,
    quotaUsed: QUOTA_USED,
    disks: DISKS,
    overProvisionPercent: 100,
    minimalAvailablePercent: 25,
    ...over,
  };
}

// ---------------------------------------------------------------------------
describe("A. names and sizes", () => {
  test("quantities parse in binary, decimal and milli units, and refuse junk", () => {
    expect(parseQuantity("400Gi")).toBe(400 * GIB);
    expect(parseQuantity("12Mi")).toBe(12 * 1024 ** 2);
    expect(parseQuantity("216273833167")).toBe(216273833167);
    expect(parseQuantity("4012m")).toBe(4.012);
    expect(parseQuantity("1G")).toBe(1e9);
    for (const bad of ["", "Gi", "12 Gi", "1e3", "-1Gi", "12GB"]) expect(() => parseQuantity(bad)).toThrow("not a Kubernetes quantity");
    expect(formatGiB(ROOT_BYTES)).toBe("106.0 GiB");
  });

  test("the date stamp is yyyymmdd in UTC, whatever the local zone", () => {
    expect(dateStamp(new Date(Date.UTC(2026, 9, 4, 23, 59)))).toBe("20261004");
    expect(dateStamp(new Date(Date.UTC(2027, 0, 1, 0, 0)))).toBe("20270101");
  });

  test("a golden claim is win11-golden-<label>-<date>, and a label that is not a safe claim-name part is refused", () => {
    expect(goldenName("dental-ready", "20261004")).toBe("win11-golden-dental-ready-20261004");
    expect(stateName("win11-golden-dental-ready-20261004")).toBe("win11-golden-dental-ready-20261004-state");
    expect(snapshotName("win11-desktop", "20261004")).toBe("win11-desktop-before-golden-20261004");
    expect(restoredRootName("win11-desktop-restored")).toBe("win11-desktop-restored-root");
    expect(restoredStateName("win11-desktop-restored")).toBe("persistent-state-for-win11-desktop-restored");
    for (const bad of ["", "Dental", "-a", "a-", "a_b", "a b", "a".repeat(25), "a;id"]) expect(labelProblem(bad), bad).not.toBeNull();
    for (const ok of ["a", "dental-ready", "od-21-4", "a".repeat(24)]) expect(labelProblem(ok), ok).toBeNull();
    expect(() => goldenName("Bad", "20261004")).toThrow("refused");
    expect(() => goldenName("ok", "2026-10-04")).toThrow("refused");
    expect(goldenName("a".repeat(24), "20261004").length).toBeLessThanOrEqual(63);
  });

  test("a restore may not take the name of an existing guest, and only the desktop is a capture source", () => {
    expect([...RESERVED_VM_NAMES].sort()).toEqual(["win11-ci", "win11-desktop"]);
    expect([...CAPTURABLE_VMS]).toEqual(["win11-desktop"]);
    // only the desktop, plus selftest's own stand-ins: never the runner, never an arbitrary name
    expect(isCapturableVm("win11-desktop")).toBe(true);
    expect(isCapturableVm("gi-selftest-capvm")).toBe(true);
    for (const bad of ["win11-ci", "win11-desktop-restored", "gi-selftest", "gi-selftest-Bad", "zz-win11-ci-test4"]) expect(isCapturableVm(bad), bad).toBe(false);
    expect(restoredVmNameProblem("win11-desktop")).toContain("never overwrites");
    expect(restoredVmNameProblem("win11-ci")).toContain("must not be");
    expect(restoredVmNameProblem("Win11")).not.toBeNull();
    expect(restoredVmNameProblem("a".repeat(33))).not.toBeNull();
    expect(restoredVmNameProblem("win11-desktop-restored")).toBeNull();
  });

  test("a state claim clones to its capacity plus ~10%, in whole MiB (12Mi -> 14Mi, the size measured to work)", () => {
    expect(stateCloneSize(12 * 1024 ** 2)).toBe("14Mi");
    expect(stateCloneSize(1)).toBe("1Mi");
  });
});

// ---------------------------------------------------------------------------
describe("B. the capacity guard, on the numbers measured on this node", () => {
  test("Longhorn's schedulable rule: (maximum - reserved) x over-provisioning - scheduled, and zero for a disk that cannot take volumes", () => {
    expect(schedulableBytes(DISKS[0]!, 100) / GIB).toBeCloseTo(165.2, 1);
    expect(schedulableBytes(DISKS[1]!, 100) / GIB).toBeCloseTo(220.4, 1);
    expect(schedulableBytes({ ...DISKS[0]!, allowScheduling: false }, 100)).toBe(0);
    expect(schedulableBytes({ ...DISKS[0]!, ready: false }, 100)).toBe(0);
    expect(schedulableBytes({ ...DISKS[0]!, scheduled: 10_000 * GIB }, 100)).toBe(0);
  });

  test("capturing win11-desktop on the legacy clone path (1 claim per clone) FITS the 400Gi quota and Longhorn", () => {
    const r = capacityGuard(guardInput());
    expect(r.refusals).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.peakClaims).toBe(2);
    expect(r.peakStorageBytes).toBe(ROOT_BYTES + 12 * 1024 ** 2);
    expect(r.notes.join("\n")).toContain("usePopulator=false: 1x");
    expect(r.notes.join("\n")).toContain("thin: the source really occupies 19.4 GiB of its 106.0 GiB");
  });

  test("the populator path (a prime claim AND the target at once) does NOT fit: it doubles the peak, and the refusal says by how much and what the owner may do", () => {
    const r = capacityGuard(guardInput({ usePopulator: true }));
    expect(r.ok).toBe(false);
    expect(r.peakClaims).toBe(4);
    const q = r.refusals.find((x) => x.includes("requests.storage"))!;
    expect(q).toContain("above the 400.0 GiB ceiling");
    expect(r.suggestion).toContain("patch resourcequota windows-vms");
    expect(r.suggestion).toContain("the OWNER's call");
    // the suggestion is a number that actually fits: used + peak, rounded up, plus one
    const want = Number(/"requests\.storage":"(\d+)Gi"/.exec(r.suggestion!)![1]);
    expect(want * GIB).toBeGreaterThanOrEqual(216273833167 + r.peakStorageBytes);
  });

  test("a restore needs a second 106 Gi next to the golden, and the 400Gi ceiling refuses it (3 copies of a 106 Gi disk do not fit with the ISO)", () => {
    const withGolden = { ...QUOTA_USED, "requests.storage": String(216273833167 + ROOT_BYTES), persistentvolumeclaims: "7" };
    const r = capacityGuard(guardInput({ quotaUsed: withGolden, stateBytes: 0 }));
    expect(r.ok).toBe(false);
    expect(r.refusals.join("\n")).toContain("requests.storage");
  });

  test("a third RUNNING VM does not fit the memory quota next to win11-ci and win11-desktop: the refusal names the key", () => {
    const need = vmNeedFromTemplate(desktopVm());
    const r = capacityGuard(guardInput({ vm: need, stateBytes: 0 }));
    expect(r.ok).toBe(false);
    expect(r.refusals.join("\n")).toContain("requests.memory");
    expect(r.refusals.join("\n")).toContain("stop win11-ci");
    // with the runner stopped (its ~9 GB of requests gone) the same VM fits
    const stopped = { ...QUOTA_USED, "requests.memory": "9004470528", "limits.memory": "9068470528", "requests.cpu": "2006m", pods: "1" };
    expect(capacityGuard(guardInput({ vm: need, stateBytes: 0, quotaUsed: stopped })).refusals).toEqual([]);
  });

  test("Longhorn is checked for real: no disk with room, or a disk that would fall under the minimal-available percentage, refuses", () => {
    const tight = DISKS.map((d) => ({ ...d, scheduled: d.maximum }));
    const r = capacityGuard(guardInput({ disks: tight }));
    expect(r.ok).toBe(false);
    expect(r.refusals.join("\n")).toContain("Longhorn cannot place");
    const nearlyFull = DISKS.map((d) => ({ ...d, available: d.maximum * 0.26 }));
    expect(capacityGuard(guardInput({ disks: nearlyFull, sourceActualBytes: 40 * GIB })).refusals.join("\n")).toContain("below 25% free");
  });

  test("node DiskPressure refuses before anything else, and a missing quota key is not a refusal", () => {
    expect(capacityGuard(guardInput({ nodeDiskPressure: true })).refusals[0]).toContain("DiskPressure");
    const open = capacityGuard(guardInput({ quotaHard: {}, quotaUsed: {} }));
    expect(open.refusals).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("C. the manifests", () => {
  test("a clone is a DataVolume on the Longhorn capability class, Filesystem mode, from a claim in the same namespace, on the legacy path", () => {
    const dv = cloneDataVolume({ name: "win11-golden-x-20261004", sourcePvc: "win11-desktop-root" });
    expect(dv.kind).toBe("DataVolume");
    expect(dv.metadata.namespace).toBe("windows-vms");
    expect(dv.spec.source.pvc).toEqual({ namespace: "windows-vms", name: "win11-desktop-root" });
    expect(dv.spec.storage.storageClassName).toBe(STORAGE_CLASS);
    expect(STORAGE_CLASS).toBe("zeta-block-replicated");
    expect(dv.spec.storage.volumeMode).toBe("Filesystem");
    expect(dv.spec.storage.accessModes).toEqual(["ReadWriteOnce"]);
    expect(dv.metadata.annotations["cdi.kubevirt.io/storage.usePopulator"]).toBe("false");
    expect(dv.metadata.annotations["cdi.kubevirt.io/storage.bind.immediate.requested"]).toBe("true");
    // a disk clone omits the size: CDI sizes it from the image (an explicit size would add 6% per generation)
    expect(dv.spec.storage.resources).toBeUndefined();
  });

  test("a state clone carries an explicit size and the label KubeVirt adopts; the populator path is opt-in", () => {
    const dv = cloneDataVolume({ name: "persistent-state-for-x", sourcePvc: "s", size: "14Mi", labels: { "persistent-state-for": "x" }, usePopulator: true });
    expect(dv.spec.storage.resources.requests.storage).toBe("14Mi");
    expect(dv.metadata.labels["persistent-state-for"]).toBe("x");
    expect(dv.metadata.annotations["cdi.kubevirt.io/storage.usePopulator"]).toBeUndefined();
  });

  test("no clone, snapshot or pod can name the node's local-path class or leave the windows-vms namespace", () => {
    const docs: Doc[] = [cloneDataVolume({ name: "a", sourcePvc: "b" }), verifyPod("v", "a", "b", 64, false), ...restoredServices("x")];
    for (const d of docs) if (d.metadata.namespace !== undefined) expect(d.metadata.namespace).toBe("windows-vms");
    expect(JSON.stringify(docs).includes("zeta-block-local")).toBe(false);
  });

  test("the Longhorn snapshot sets createSnapshot (without it the object only tracks one that already exists)", () => {
    const s = longhornSnapshot("win11-desktop-before-golden-20261004", "pvc-5c5da6ca");
    expect(s.apiVersion).toBe("longhorn.io/v1beta2");
    expect(s.metadata.namespace).toBe("longhorn-system");
    expect(s.spec).toEqual({ volume: "pvc-5c5da6ca", createSnapshot: true });
  });

  test("the verify pod mounts BOTH claims read-only, as the image's owner (107), drops every capability, and sets limits (the namespace quota demands them)", () => {
    const p = verifyPod("v", "src", "dst", 64, true);
    const c = p.spec.containers[0];
    for (const m of c.volumeMounts) expect(m.readOnly).toBe(true);
    for (const v of p.spec.volumes) expect(v.persistentVolumeClaim.readOnly).toBe(true);
    expect(c.securityContext.runAsUser).toBe(107);
    expect(c.securityContext.runAsNonRoot).toBe(true);
    expect(c.securityContext.capabilities.drop).toEqual(["ALL"]);
    expect(c.resources.limits.memory).toBeDefined();
    expect(c.resources.limits["ephemeral-storage"]).toBeDefined();
    expect(p.spec.automountServiceAccountToken).toBe(false);
    expect(c.command[2]).toContain("head -c 67108864");
    expect(c.command[2]).toContain("sha256sum $f");
    expect(verifyPod("v", "a", "b", 64, false).spec.containers[0].command[2]).toContain("full=skipped");
    expect(() => verifyPod("v", "a", "b", 0, false)).toThrow("refused");
    expect(() => verifyPod("v", "a", "b", 5000, false)).toThrow("refused");
  });

  test("the restored VM: the desktop's spec, a new name and label, its own root claim, NO installer ISO, and HALTED", () => {
    const template = desktopVm();
    const before = JSON.stringify(template);
    const vm = restoredVm({ name: "win11-desktop-restored", template });
    expect(JSON.stringify(template)).toBe(before); // the template is never mutated
    expect(vm.metadata.name).toBe("win11-desktop-restored");
    // the live VM is read as `{ spec }` only, so the restored object must name its own kind (a dry run against the API server caught this)
    expect([vm.apiVersion, vm.kind]).toEqual(["kubevirt.io/v1", "VirtualMachine"]);
    expect(restoredVm({ name: "restored", template: { spec: template.spec } }).kind).toBe("VirtualMachine");
    expect(vm.spec.runStrategy).toBe("Halted");
    expect(vm.spec.template.metadata.labels["kubevirt.io/domain"]).toBe("win11-desktop-restored");
    expect(vm.spec.template.metadata.labels["zeta.io/windows-role"]).toBe("desktop");
    const volumes = vm.spec.template.spec.volumes as Doc[];
    expect(volumes.find((v) => v.name === "root")!.dataVolume.name).toBe("win11-desktop-restored-root");
    expect(volumes.some((v) => v.name === "iso")).toBe(false);
    expect((vm.spec.template.spec.domain.devices.disks as Doc[]).some((d) => d.name === "iso")).toBe(false);
    // everything else the desktop has stays: Secure Boot + persistent TPM, the answer-file CD, the bootstrap CD and the keys CD
    expect(vm.spec.template.spec.domain.firmware.bootloader.efi.secureBoot).toBe(true);
    expect(vm.spec.template.spec.domain.devices.tpm.persistent).toBe(true);
    for (const name of ["sysprep", "bootstrap", "ssh-keys", "virtio-win"]) expect(volumes.some((v) => v.name === name), name).toBe(true);
    // the original's identity does not leak by accident: a restore without --firmware-uuid keeps whatever the template says (none in git)
    expect(vm.spec.template.spec.domain.firmware.uuid).toBeUndefined();
  });

  test("a same-name restore can carry the golden's firmware uuid and serial (what keys the TPM state), and refuses a malformed one", () => {
    const uuid = "78f46d19-6c9d-4db7-b522-54e765201f1d";
    const vm = restoredVm({ name: "restored", template: desktopVm(), firmwareUuid: uuid, firmwareSerial: "f853241d-92a0-4c44-95e2-b6b34580892c" });
    expect(vm.spec.template.spec.domain.firmware.uuid).toBe(uuid);
    expect(vm.spec.template.spec.domain.firmware.serial).toBe("f853241d-92a0-4c44-95e2-b6b34580892c");
    expect(vm.spec.template.spec.domain.firmware.bootloader.efi.persistent).toBe(true);
    expect(() => restoredVm({ name: "restored", template: desktopVm(), firmwareUuid: "nope" })).toThrow("not a UUID");
  });

  test("a restore refuses to take an existing guest's name", () => {
    expect(() => restoredVm({ name: "win11-desktop", template: desktopVm() })).toThrow("never overwrites");
    expect(() => restoredVm({ name: "win11-ci", template: desktopVm() })).toThrow("refused");
  });

  test("the restored VM's Services are ClusterIP only and select its own launcher label", () => {
    const [rdp, ssh] = restoredServices("restored") as [Doc, Doc];
    expect(rdp.metadata.name).toBe("restored-rdp");
    expect(ssh.metadata.name).toBe("restored-ssh");
    for (const s of [rdp, ssh]) {
      expect(s.spec.type).toBe("ClusterIP");
      expect(s.spec.selector).toEqual({ "kubevirt.io/domain": "restored" });
    }
    expect([rdp.spec.ports[0].port, ssh.spec.ports[0].port]).toEqual([3389, 22]);
  });

  test("the VM's quota footprint comes from its template (8Gi memory, 2 CPUs) plus KubeVirt's launcher overhead", () => {
    const need = vmNeedFromTemplate(desktopVm());
    expect(need.requestsCpu).toBe(2);
    expect(need.requestsMemory).toBeGreaterThan(8 * GIB);
    expect(need.requestsMemory).toBeLessThan(10 * GIB);
  });

  test("the network policy selects guests by ROLE, so a restored desktop is fenced the day it is created (an unselected endpoint would be open)", () => {
    const np = parseAllDocuments(readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/examples/windows-11/40-network-policy.yaml"), "utf8"))[0]!.toJS() as Doc;
    const sel = np.spec.endpointSelector.matchExpressions[0];
    expect(sel.key).toBe("zeta.io/windows-role");
    expect([...sel.values].sort()).toEqual(["ci-runner", "desktop"]);
    expect(restoredVm({ name: "restored", template: desktopVm() }).spec.template.metadata.labels["zeta.io/windows-role"]).toBe("desktop");
  });
});

// ---------------------------------------------------------------------------
describe("D. verification reports a mismatch; a match is not assumed", () => {
  const h = (c: string) => c.repeat(64);
  const line = (w: string, apparent: number, blocks: number, head: string, full: string) => `${w}: apparent=${apparent} allocated512=${blocks} head=${head} full=${full}`;

  test("identical claims match, and sparseness is reported separately", () => {
    const log = [line("src", 2028994560, 6144, h("a"), h("b")), line("dst", 2028994560, 6144, h("a"), h("b"))].join("\n");
    const v = parseVerify(log)!;
    expect(compareVerify(v)).toEqual({ ok: true, problems: [], sparsePreserved: true });
    const fatter = parseVerify([line("src", 2028994560, 6144, h("a"), h("b")), line("dst", 2028994560, 4000000, h("a"), h("b"))].join("\n"))!;
    expect(compareVerify(fatter)).toEqual({ ok: true, problems: [], sparsePreserved: false });
  });

  test("a different size, head hash or full hash is a problem, and so is a half-hashed pair", () => {
    const mk = (a: string, b: string) => parseVerify([a, b].join("\n"))!;
    expect(compareVerify(mk(line("src", 10, 1, h("a"), "skipped"), line("dst", 11, 1, h("a"), "skipped"))).problems[0]).toContain("size differs");
    expect(compareVerify(mk(line("src", 10, 1, h("a"), "skipped"), line("dst", 10, 1, h("c"), "skipped"))).problems[0]).toContain("first-N-MiB");
    expect(compareVerify(mk(line("src", 10, 1, h("a"), h("b")), line("dst", 10, 1, h("a"), h("c")))).problems[0]).toContain("full sha256");
    expect(compareVerify(mk(line("src", 10, 1, h("a"), h("b")), line("dst", 10, 1, h("a"), "skipped"))).ok).toBe(false);
  });

  test("a garbled or partial log is NOT parsed into a verdict", () => {
    expect(parseVerify("")).toBeNull();
    expect(parseVerify(line("src", 1, 1, h("a"), "skipped"))).toBeNull();
    expect(parseVerify("src: apparent=x allocated512=1 head=zz full=skipped\ndst: apparent=1 allocated512=1 head=zz full=skipped")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("E. the RDP login check never lets the password out", () => {
  const xml = `<UserAccounts><LocalAccounts><LocalAccount><Name>zetaadmin</Name><Password>\n  <Value>Abc&amp;12&lt;x</Value>\n  <PlainText>true</PlainText></Password></LocalAccount></LocalAccounts></UserAccounts><Value>1</Value>`;

  test("the password is the first <Value> INSIDE <Password> (not the image index), XML-unescaped; absent or empty is null", () => {
    expect(extractAdminPassword(xml)).toBe("Abc&12<x");
    expect(extractAdminPassword("<Value>1</Value>")).toBeNull();
    expect(extractAdminPassword("<Password><Value></Value></Password>")).toBeNull();
  });

  test("redaction removes the secret raw and XML-escaped, and a short or empty secret cannot erase everything", () => {
    const secret = "Abc&12<x";
    const out = redact(`login ${secret} and ${"Abc&amp;12&lt;x"} done`, secret);
    expect(out).toBe("login [REDACTED] and [REDACTED] done");
    expect(out.includes(secret)).toBe(false);
    expect(redact("nothing here", "")).toBe("nothing here");
  });

  test("FreeRDP is given the user and host but the password is only ever on stdin, never argv", () => {
    const args = freerdpArgs("win11-desktop-rdp", "nla");
    expect(args).toContain("/auth-only");
    expect(args).toContain("/from-stdin:force");
    expect(args).toContain(`/u:${ADMIN}`);
    expect(args.some((a) => a.startsWith("/p:"))).toBe(false);
    expect(freerdpArgs("h", "tls")).toContain("/sec:tls");
    expect(() => freerdpArgs("h;id", "nla")).toThrow("refused");
    expect(isSecurityLayer("nla")).toBe(true);
    expect(isSecurityLayer("nope")).toBe(false);
    const script = checkScript("win11-desktop-rdp", "nla");
    expect(script).toContain("Xvfb");
    expect(script.includes("/p:")).toBe(false);
  });

  test("the helper pod sets limits and requests, drops privilege, mounts no service-account token, and is labelled throwaway", () => {
    const p = helperPodManifest() as Doc;
    expect(p.metadata.name).toBe(POD);
    expect(p.metadata.namespace).toBe("windows-vms");
    expect(p.metadata.labels["zeta.io/throwaway"]).toBe("true");
    const c = p.spec.containers[0];
    expect(c.resources.limits.memory).toBeDefined();
    expect(c.resources.requests["ephemeral-storage"]).toBeDefined();
    expect(c.securityContext.allowPrivilegeEscalation).toBe(false);
    expect(c.securityContext.capabilities.drop).toEqual(["ALL"]);
    expect(p.spec.automountServiceAccountToken).toBe(false);
    expect(JSON.stringify(p).includes("Secret")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("F. the runbooks", () => {
  const golden = ((): string => {
    try {
      return readFileSync(GOLDEN_RUNBOOK, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return "";
      throw e;
    }
  })();
  const runbook = readFileSync(RUNBOOK, "utf8");

  test("the golden-image runbook exists, opens with a carved sentence, and every owner command runs through ssh to the node", () => {
    expect(existsSync(GOLDEN_RUNBOOK)).toBe(true);
    expect(golden).toMatch(/^# .*\n\n(Carved sentence:\n\n)?> /m);
    expect(golden).toContain("ssh zeta@ssh.flowdent.net");
    expect(golden).toContain("windows-vm-golden-image.ts");
    for (const word of ["capture", "restore", "guard", "selftest"]) expect(golden, word).toContain(word);
  });

  test("it states what a golden image is NOT (a backup), the BitLocker and sysprep caveats, and the off-node options", () => {
    expect(golden).toMatch(/not a backup/i);
    expect(golden).toContain("BitLocker");
    expect(golden).toContain("manage-bde");
    expect(golden).toContain("sysprep");
    expect(golden).toContain("/generalize");
    expect(golden).toMatch(/off-node/i);
    expect(golden).toContain("SeaweedFS");
    expect(golden).toContain("vmexport");
  });

  test("it records the measured numbers the helper's constants come from", () => {
    for (const fact of ["usePopulator", "2x", "disk.img", "firmware.uuid", "persistent-state-for", "Released", "markRemoved"]) expect(golden, fact).toContain(fact);
  });

  test("WINDOWS-11-VMS.md grows the two sections the owner asked for, and points at the golden-image runbook", () => {
    expect(runbook).toContain("## Using the desktop (RDP/VNC from a Mac or Windows)");
    expect(runbook).toContain("## Capture and reuse the disk (golden image)");
    expect(runbook).toContain("WINDOWS-VM-GOLDEN-IMAGE.md");
    expect(runbook).toContain("windows-11-rdp-check.ts");
    expect(runbook).toContain("13389");
  });

  test("the Mac recipe needs only ssh and an RDP client: no kubectl, no virtctl on the Mac", () => {
    const section = runbook.slice(runbook.indexOf("## Using the desktop (RDP/VNC from a Mac or Windows)"), runbook.indexOf("## Which step failed?"));
    expect(section).toContain("ssh zeta@ssh.flowdent.net");
    expect(section).toContain("Windows App");
    expect(section).toContain("pbcopy");
    expect(section).toContain("localhost:13389");
    // every kubectl in it runs on the node, inside an ssh command
    for (const l of section.split("\n").filter((x) => x.includes("kubectl") && x.trimStart().startsWith("kubectl"))) expect(l.includes("ssh "), l).toBe(true);
  });
});
