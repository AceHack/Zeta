#!/usr/bin/env bun
/**
 * windows-vm-golden-image.ts -- capture a Windows 11 guest's disk as a reusable "golden image", restore it into a
 * VM, and prove the mechanism on a throwaway stand-in. Runbook: docs/ops/WINDOWS-VM-GOLDEN-IMAGE.md.
 *
 *   node|bun .../windows-vm-golden-image.ts guard   [--vm win11-desktop | --source-pvc NAME] [--with-state] [--populator] [--restore]
 *   node|bun .../windows-vm-golden-image.ts capture --vm win11-desktop --label dental-ready --yes   [--no-snapshot] [--keep-halted] [--verify-mib 512] [--full-hash]
 *   node|bun .../windows-vm-golden-image.ts restore --golden win11-golden-dental-ready-20261004 --as win11-desktop-restored [--with-state] [--firmware-uuid U] [--apply]
 *   node|bun .../windows-vm-golden-image.ts selftest [--with-vm]       # the whole mechanism on a 2Gi stand-in, then deletes it
 *
 * WHAT A GOLDEN IMAGE IS HERE. A CDI host-assisted PVC clone (the StorageProfile says cloneStrategy `copy`; the cluster has
 * no CSI VolumeSnapshotClass) of the guest's root claim into a NEW claim `win11-golden-<label>-<yyyymmdd>` on the same
 * Longhorn class, in the same namespace; plus, when the guest has one, a clone of its TPM / UEFI-NVRAM state claim as
 * `<golden>-state`. It is a COPY ON THE SAME NODE AND THE SAME DISKS: protection against a bad install or a bad update,
 * NOT a backup (see the runbook's "off-node copy" section).
 *
 * It needs only `kubectl` (it shells out to it; on the node it is already on PATH with KUBECONFIG preset) and runs from a
 * single file under Node or bun. `restore` reads the LIVE `win11-desktop` VM spec as its template.
 *
 * WHAT IT WILL NOT DO: touch any claim other than the one you name and the ones it creates (`win11-golden-*`,
 * `<vm>-root`, `persistent-state-for-<vm>`); stop a running guest without `--yes`; raise a quota or touch a Secret; read or print the
 * guest's password. `restore` renders manifests to stdout and applies them only with `--apply`; it never starts the VM.
 *
 * MEASURED 2026-10-04 on this cluster (CDI v1.65.0, KubeVirt v1.8.4, Longhorn engine v1.12.1) -- every constant below that
 * looks odd is one of these:
 *   * default clone path (VolumeCloneSource populator) holds a "prime" claim AND the target claim at once: 2x the size
 *     against the namespace quota. Annotation `cdi.kubevirt.io/storage.usePopulator: "false"` uses the legacy path: 1x.
 *   * omit `storage` size on a disk.img clone and CDI sizes the target from the image (+6% filesystem overhead); give a
 *     size and the target is that +6%, so clone-of-clone with an explicit size GROWS. A state claim has no disk.img, so
 *     its size-detection pod fails: the state clone must carry an explicit size.
 *   * a clone of a sparse disk.img stays sparse (allocated blocks identical) and the full sha256 matches.
 *   * KubeVirt adopts a claim labelled `persistent-state-for=<vm>` that exists before the VM first starts, on any class.
 *   * the NVRAM file is `nvram/<vm>_VARS.fd` and the TPM directory is `swtpm/<firmware.uuid>`: TPM + NVRAM carry over to a
 *     VM with the SAME name and the SAME `spec.template.spec.domain.firmware.uuid`; a different name starts fresh.
 *
 * Exit codes: 0 ok, 1 a cluster call or a verification failed, 2 refusal / usage.
 */

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// ONE FILE, NODE BUILT-INS ONLY, on purpose: the owner has no bun and no checkout on the cluster node, but the node has `kubectl`
// and Node >= 22.18 (v24 today), which runs a .ts file as it is. So `curl` this one file onto the node and `node` it; it runs
// unchanged under bun too. No `yaml` package (manifests are JSON: kubectl takes it), no import.meta.dir / import.meta.main.
export const NAMESPACE = "windows-vms";
export const STORAGE_CLASS = "zeta-block-replicated";
export const GOLDEN_PREFIX = "win11-golden";
export const LONGHORN_NAMESPACE = "longhorn-system";
/** The VMs this tool may capture or restore over. `win11-ci` is a runner and is never a golden source. */
export const CAPTURABLE_VMS = ["win11-desktop"] as const;
/** The stand-in VMs `selftest` creates; the only other names `capture` accepts, so the stop/restart path is exercised for real. */
export const SELFTEST_VM_PREFIX = "gi-selftest-";

export function isCapturableVm(name: string): boolean {
  return (CAPTURABLE_VMS as readonly string[]).includes(name) || (name.startsWith(SELFTEST_VM_PREFIX) && /^[a-z0-9-]{1,40}$/.test(name));
}
/** The VM names a restore may NOT create: they exist, and a restore must never overwrite a running guest. */
export const RESERVED_VM_NAMES = ["win11-ci", "win11-desktop"] as const;
export const THROWAWAY_LABEL = "zeta.io/throwaway";
const MIB = 1024 ** 2;
const GIB = 1024 ** 3;

type Doc = Record<string, any>;

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in windows-vm-golden-image.test.ts)
// ---------------------------------------------------------------------------

/** A Kubernetes quantity in base units (bytes, or cores for cpu). `m` is milli. Throws on anything else. */
export function parseQuantity(q: string): number {
  const m = /^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|Pi|k|K|M|G|T|P|m)?$/.exec(q.trim());
  if (m === null) throw new Error(`not a Kubernetes quantity: ${q}`);
  const n = Number(m[1]);
  const mult: Record<string, number> = { Ki: 1024, Mi: MIB, Gi: GIB, Ti: 1024 ** 4, Pi: 1024 ** 5, k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15, m: 1e-3 };
  return Math.round(n * (m[2] === undefined ? 1 : (mult[m[2]] as number)) * 1000) / 1000;
}

export function formatGiB(bytes: number): string {
  return `${(bytes / GIB).toFixed(1)} GiB`;
}

/** yyyymmdd in UTC. */
export function dateStamp(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
}

/** Why a golden-image label is refused, or null. A label becomes part of a claim name, so: lower-case DNS label characters, 1 to 24. */
export function labelProblem(label: string): string | null {
  if (!/^[a-z0-9]([a-z0-9-]{0,22}[a-z0-9])?$/.test(label)) return "must be 1 to 24 characters of a-z, 0-9 and '-', starting and ending with a letter or digit";
  return null;
}

export function goldenName(label: string, date: string): string {
  const p = labelProblem(label);
  if (p !== null) throw new Error(`refused: the label ${p}`);
  if (!/^\d{8}$/.test(date)) throw new Error("refused: the date must be yyyymmdd");
  return `${GOLDEN_PREFIX}-${label}-${date}`;
}

export const stateName = (golden: string): string => `${golden}-state`;
export const snapshotName = (vm: string, date: string): string => `${vm}-before-golden-${date}`;
export const restoredRootName = (vm: string): string => `${vm}-root`;
export const restoredStateName = (vm: string): string => `persistent-state-for-${vm}`;

/** Why a restored VM's name is refused, or null: DNS-label, short enough for `virt-launcher-<name>-xxxxx`, and never an existing guest. */
export function restoredVmNameProblem(name: string): string | null {
  if (!/^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/.test(name)) return "must be 1 to 32 characters of a-z, 0-9 and '-'";
  if ((RESERVED_VM_NAMES as readonly string[]).includes(name)) return `must not be ${name}: that guest exists, and a restore never overwrites a guest (stop and delete it by hand first if you mean a replacement)`;
  return null;
}

/** The size to give a STATE claim's clone: its capacity plus ~10%, rounded up to whole MiB. Pure. */
export function stateCloneSize(capacityBytes: number): string {
  return `${Math.ceil((capacityBytes * 1.1) / MIB)}Mi`;
}

export interface DiskFacts {
  readonly name: string;
  readonly maximum: number;
  readonly available: number;
  readonly scheduled: number;
  readonly reserved: number;
  readonly allowScheduling: boolean;
  readonly ready: boolean;
}

/** Longhorn's rule for what a disk may still be promised: (maximum - reserved) x over-provisioning% - already scheduled. */
export function schedulableBytes(d: DiskFacts, overProvisionPercent: number): number {
  if (!d.allowScheduling || !d.ready) return 0;
  return Math.max(0, Math.floor(((d.maximum - d.reserved) * overProvisionPercent) / 100) - d.scheduled);
}

export interface VmNeed {
  readonly requestsMemory: number;
  readonly limitsMemory: number;
  readonly requestsCpu: number;
}

export interface GuardInput {
  /** The claim being cloned: its provisioned size in bytes. */
  readonly sourceBytes: number;
  /** What it really occupies (Longhorn's actualSize; the disk is thin). */
  readonly sourceActualBytes: number;
  /** The TPM / UEFI state claim to carry along, in bytes, or 0. */
  readonly stateBytes: number;
  /** false (the default here): one claim per clone; true: the populator's prime claim doubles it. */
  readonly usePopulator: boolean;
  readonly quotaHard: Readonly<Record<string, string>>;
  readonly quotaUsed: Readonly<Record<string, string>>;
  readonly disks: readonly DiskFacts[];
  readonly overProvisionPercent: number;
  readonly minimalAvailablePercent: number;
  /** Present when the clone is going to be BOOTED (restore): the new VM's memory and CPU must fit the quota too. */
  readonly vm?: VmNeed;
  /** Set when the node reports DiskPressure: no new volumes then. */
  readonly nodeDiskPressure?: boolean;
}

export interface GuardResult {
  readonly ok: boolean;
  readonly refusals: string[];
  readonly notes: string[];
  readonly peakStorageBytes: number;
  readonly peakClaims: number;
  /** The one-line `kubectl patch` that would make the quota fit, for the OWNER to decide on; null when the quota is not the problem. */
  readonly suggestion: string | null;
}

function quotaNumber(table: Readonly<Record<string, string>>, key: string): number | null {
  const v = table[key];
  return v === undefined ? null : parseQuantity(v);
}

/** The capacity guard: would this clone fit the namespace quota and Longhorn, right now? Pure; refusals say which number failed. */
export function capacityGuard(i: GuardInput): GuardResult {
  const refusals: string[] = [];
  const notes: string[] = [];
  let suggestion: string | null = null;
  const volumes = [i.sourceBytes, ...(i.stateBytes > 0 ? [i.stateBytes] : [])];
  const times = i.usePopulator ? 2 : 1;
  const peakVolumes = volumes.flatMap((v) => Array.from({ length: times }, () => v));
  const peakStorageBytes = peakVolumes.reduce((a, b) => a + b, 0);
  const peakClaims = peakVolumes.length;
  notes.push(`clone path: ${i.usePopulator ? "populator (a prime claim AND the target at once: 2x)" : "legacy (usePopulator=false: 1x)"}; peak ${formatGiB(peakStorageBytes)} in ${peakClaims} claim(s)`);

  if (i.nodeDiskPressure === true) refusals.push("the node reports DiskPressure: do not create volumes now (kubectl describe node)");

  const hardStorage = quotaNumber(i.quotaHard, "requests.storage");
  const usedStorage = quotaNumber(i.quotaUsed, "requests.storage") ?? 0;
  if (hardStorage !== null) {
    const needed = usedStorage + peakStorageBytes;
    if (needed > hardStorage) {
      refusals.push(`namespace quota requests.storage: ${formatGiB(usedStorage)} used + ${formatGiB(peakStorageBytes)} peak = ${formatGiB(needed)}, above the ${formatGiB(hardStorage)} ceiling`);
      const want = Math.ceil(needed / GIB) + 1;
      suggestion = `kubectl -n ${NAMESPACE} patch resourcequota ${NAMESPACE} --type merge -p '{"spec":{"hard":{"requests.storage":"${want}Gi"}}}'   # the OWNER's call; put ${Math.round(hardStorage / GIB)}Gi back afterwards`;
    } else notes.push(`quota requests.storage: ${formatGiB(usedStorage)} + ${formatGiB(peakStorageBytes)} = ${formatGiB(needed)} of ${formatGiB(hardStorage)}`);
  }
  const hardClaims = quotaNumber(i.quotaHard, "persistentvolumeclaims");
  const usedClaims = quotaNumber(i.quotaUsed, "persistentvolumeclaims") ?? 0;
  if (hardClaims !== null && usedClaims + peakClaims > hardClaims) refusals.push(`namespace quota persistentvolumeclaims: ${usedClaims} used + ${peakClaims} = ${usedClaims + peakClaims}, above ${hardClaims}`);

  if (i.vm !== undefined) {
    const checks: [string, number, number][] = [
      ["requests.memory", i.vm.requestsMemory, 1],
      ["limits.memory", i.vm.limitsMemory, 1],
      ["requests.cpu", i.vm.requestsCpu, 1],
    ];
    for (const [key, need] of checks) {
      const hard = quotaNumber(i.quotaHard, key);
      const used = quotaNumber(i.quotaUsed, key) ?? 0;
      if (hard !== null && used + need > hard) {
        const fmt = key.endsWith("cpu") ? (n: number) => `${n.toFixed(2)} cpu` : formatGiB;
        refusals.push(`namespace quota ${key}: ${fmt(used)} used + ${fmt(need)} for the new VM = ${fmt(used + need)}, above ${fmt(hard)} (stop win11-ci, or the owner raises the quota)`);
      }
    }
    const hardPods = quotaNumber(i.quotaHard, "pods");
    const usedPods = quotaNumber(i.quotaUsed, "pods") ?? 0;
    if (hardPods !== null && usedPods + 1 > hardPods) refusals.push(`namespace quota pods: ${usedPods} used + 1 > ${hardPods}`);
  }

  // Longhorn: place the peak volumes largest-first on the disk with the most schedulable room. A replica lives on ONE disk.
  const room = i.disks.map((d) => ({ d, left: schedulableBytes(d, i.overProvisionPercent), available: d.available }));
  const sorted = [...peakVolumes].sort((a, b) => b - a);
  let placementFailed = false;
  for (const size of sorted) {
    const actual = size === i.sourceBytes ? Math.min(i.sourceActualBytes, size) : size;
    const candidates = room
      .filter((r) => r.left >= size && r.available - actual >= (r.d.maximum * i.minimalAvailablePercent) / 100)
      .sort((a, b) => b.left - a.left);
    const pick = candidates[0];
    if (pick === undefined) {
      const best = Math.max(0, ...room.map((r) => r.left));
      refusals.push(`Longhorn cannot place a ${formatGiB(size)} volume: the largest schedulable disk has ${formatGiB(best)} left (or placing it would take a disk below ${i.minimalAvailablePercent}% free)`);
      placementFailed = true;
      break;
    }
    pick.left -= size;
    pick.available -= actual;
  }
  if (!placementFailed) notes.push(`Longhorn can place ${sorted.length} volume(s); schedulable per disk: ${i.disks.map((d) => `${d.name}=${formatGiB(schedulableBytes(d, i.overProvisionPercent))}`).join(", ")}`);
  notes.push(`thin: the source really occupies ${formatGiB(i.sourceActualBytes)} of its ${formatGiB(i.sourceBytes)}; a clone preserves sparseness, so the copy starts that small too`);
  return { ok: refusals.length === 0, refusals, notes, peakStorageBytes, peakClaims, suggestion };
}

// ---- manifests -----------------------------------------------------------

export interface CloneSpec {
  readonly name: string;
  readonly sourcePvc: string;
  /** Omit for a disk.img clone (CDI sizes it from the image); REQUIRED for a state claim. */
  readonly size?: string;
  readonly labels?: Readonly<Record<string, string>>;
  readonly annotations?: Readonly<Record<string, string>>;
  readonly usePopulator?: boolean;
}

/** A DataVolume that clones a claim in this namespace onto the capability class. Pure. */
export function cloneDataVolume(c: CloneSpec): Doc {
  const annotations: Record<string, string> = { "cdi.kubevirt.io/storage.bind.immediate.requested": "true", ...(c.annotations ?? {}) };
  if (c.usePopulator !== true) annotations["cdi.kubevirt.io/storage.usePopulator"] = "false";
  return {
    apiVersion: "cdi.kubevirt.io/v1beta1",
    kind: "DataVolume",
    metadata: { name: c.name, namespace: NAMESPACE, labels: { "app.kubernetes.io/part-of": "zeta-windows", ...(c.labels ?? {}) }, annotations },
    spec: {
      source: { pvc: { namespace: NAMESPACE, name: c.sourcePvc } },
      storage: {
        accessModes: ["ReadWriteOnce"],
        volumeMode: "Filesystem",
        storageClassName: STORAGE_CLASS,
        ...(c.size === undefined ? {} : { resources: { requests: { storage: c.size } } }),
      },
    },
  };
}

/** A Longhorn snapshot of one volume (the cluster has no CSI VolumeSnapshotClass). `createSnapshot: true` is what makes it take one. Pure. */
export function longhornSnapshot(name: string, pv: string): Doc {
  return { apiVersion: "longhorn.io/v1beta2", kind: "Snapshot", metadata: { name, namespace: LONGHORN_NAMESPACE }, spec: { volume: pv, createSnapshot: true } };
}

const RESTRICTED_CONTEXT = { allowPrivilegeEscalation: false, runAsNonRoot: true, runAsUser: 107, runAsGroup: 107, seccompProfile: { type: "RuntimeDefault" }, capabilities: { drop: ["ALL"] } };
const SMALL = { requests: { cpu: "50m", memory: "64Mi", "ephemeral-storage": "64Mi" }, limits: { memory: "256Mi", "ephemeral-storage": "256Mi" } };

/** A pod that mounts a source claim and a copy READ-ONLY and prints one comparable line per claim. Runs as uid 107 (the owner of disk.img). Pure. */
export function verifyPod(name: string, srcPvc: string, dstPvc: string, headMib: number, fullHash: boolean): Doc {
  if (!Number.isInteger(headMib) || headMib < 1 || headMib > 4096) throw new Error("refused: --verify-mib must be an integer from 1 to 4096");
  const script = [
    "for d in src dst; do",
    `  f=/$d/disk.img; echo "$d: apparent=$(stat -c %s $f) allocated512=$(stat -c %b $f) head=$(head -c ${headMib * MIB} $f | sha256sum | cut -d' ' -f1) full=${fullHash ? "$(sha256sum $f | cut -d' ' -f1)" : "skipped"}"`,
    "done",
  ].join("\n");
  return {
    apiVersion: "v1",
    kind: "Pod",
    metadata: { name, namespace: NAMESPACE, labels: { "app.kubernetes.io/name": name, "app.kubernetes.io/part-of": "zeta-windows" } },
    spec: {
      restartPolicy: "Never",
      automountServiceAccountToken: false,
      containers: [
        {
          name: "verify",
          image: "docker.io/library/alpine:3.21",
          command: ["sh", "-c", script],
          securityContext: RESTRICTED_CONTEXT,
          resources: SMALL,
          volumeMounts: [
            { name: "src", mountPath: "/src", readOnly: true },
            { name: "dst", mountPath: "/dst", readOnly: true },
          ],
        },
      ],
      volumes: [
        { name: "src", persistentVolumeClaim: { claimName: srcPvc, readOnly: true } },
        { name: "dst", persistentVolumeClaim: { claimName: dstPvc, readOnly: true } },
      ],
    },
  };
}

export interface VerifyLine {
  readonly apparent: number;
  readonly allocated512: number;
  readonly head: string;
  readonly full: string;
}

/** Parse the verify pod's log. Pure; null when a line is missing or malformed. */
export function parseVerify(log: string): { src: VerifyLine; dst: VerifyLine } | null {
  const grab = (which: string): VerifyLine | null => {
    const m = new RegExp(`^${which}: apparent=(\\d+) allocated512=(\\d+) head=([0-9a-f]{64}) full=([0-9a-f]{64}|skipped)$`, "m").exec(log);
    return m === null ? null : { apparent: Number(m[1]), allocated512: Number(m[2]), head: m[3] as string, full: m[4] as string };
  };
  const src = grab("src");
  const dst = grab("dst");
  return src === null || dst === null ? null : { src, dst };
}

/** Do the two claims hold the same disk? Apparent size and the head hash must match; the full hash too when it was taken; sparseness is reported. Pure. */
export function compareVerify(v: { src: VerifyLine; dst: VerifyLine }): { ok: boolean; problems: string[]; sparsePreserved: boolean } {
  const problems: string[] = [];
  if (v.src.apparent !== v.dst.apparent) problems.push(`disk.img size differs: ${v.src.apparent} vs ${v.dst.apparent}`);
  if (v.src.head !== v.dst.head) problems.push("the first-N-MiB hash differs");
  if (v.src.full !== "skipped" && v.dst.full !== "skipped" && v.src.full !== v.dst.full) problems.push("the full sha256 differs");
  if (v.src.full === "skipped" !== (v.dst.full === "skipped")) problems.push("one side was hashed in full and the other was not");
  return { ok: problems.length === 0, problems, sparsePreserved: v.src.allocated512 === v.dst.allocated512 };
}

/** The Services a restored VM needs, ClusterIP only, selecting its own launcher label (the sibling of 30-win11-desktop.yaml's). Pure. */
export function restoredServices(name: string): Doc[] {
  const svc = (suffix: string, port: number): Doc => ({
    apiVersion: "v1",
    kind: "Service",
    metadata: { name: `${name}-${suffix}`, namespace: NAMESPACE },
    spec: { type: "ClusterIP", selector: { "kubevirt.io/domain": name }, ports: [{ name: suffix, port, targetPort: port, protocol: "TCP" }] },
  });
  return [svc("rdp", 3389), svc("ssh", 22)];
}

export interface RestoreVmOpts {
  readonly name: string;
  /** The `win11-desktop` VirtualMachine document from 30-win11-desktop.yaml. */
  readonly template: Doc;
  readonly firmwareUuid?: string;
  readonly firmwareSerial?: string;
}

/** The restored VM: the desktop's spec with its own name, label and root claim, without the installer ISO, HALTED. Pure; never mutates the template. */
export function restoredVm(o: RestoreVmOpts): Doc {
  const problem = restoredVmNameProblem(o.name);
  if (problem !== null) throw new Error(`refused: the VM name ${problem}`);
  if (o.firmwareUuid !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(o.firmwareUuid)) throw new Error("refused: --firmware-uuid is not a UUID");
  const vm = JSON.parse(JSON.stringify(o.template)) as Doc;
  vm.apiVersion = "kubevirt.io/v1";
  vm.kind = "VirtualMachine";
  delete vm.status;
  vm.metadata = { name: o.name, namespace: NAMESPACE, labels: { "app.kubernetes.io/part-of": "zeta-windows", "zeta.io/windows-role": "desktop", "zeta.io/restored-from-golden": "true" } };
  vm.spec.runStrategy = "Halted";
  const tpl = vm.spec.template;
  tpl.metadata.labels = { "kubevirt.io/domain": o.name, "zeta.io/windows-role": "desktop" };
  const domain = tpl.spec.domain;
  // the live VM's firmware.uuid / serial are ITS identity (they key the TPM state): a restore starts without them unless asked
  if (domain.firmware !== undefined) {
    delete domain.firmware.uuid;
    delete domain.firmware.serial;
  }
  domain.devices.disks = (domain.devices.disks as Doc[]).filter((d) => d.name !== "iso");
  tpl.spec.volumes = (tpl.spec.volumes as Doc[]).filter((v) => v.name !== "iso");
  for (const v of tpl.spec.volumes as Doc[]) if (v.name === "root") v.dataVolume = { name: restoredRootName(o.name) };
  if (o.firmwareUuid !== undefined || o.firmwareSerial !== undefined) {
    domain.firmware = { ...domain.firmware, ...(o.firmwareUuid === undefined ? {} : { uuid: o.firmwareUuid }), ...(o.firmwareSerial === undefined ? {} : { serial: o.firmwareSerial }) };
  }
  return vm;
}

/** The VM's quota footprint: memory (request, limit) and CPU request from its template. Pure. */
export function vmNeedFromTemplate(vm: Doc): VmNeed {
  const r = vm.spec.template.spec.domain.resources;
  // KubeVirt adds ~9% (measured: two 8Gi guests hold 18.0 GB of requests.memory between them) for the launcher's overhead.
  const overhead = 1.1;
  return { requestsMemory: Math.ceil(parseQuantity(r.requests.memory) * overhead), limitsMemory: Math.ceil(parseQuantity(r.limits.memory) * overhead), requestsCpu: parseQuantity(r.requests.cpu) };
}

// ---------------------------------------------------------------------------
// The cluster side
// ---------------------------------------------------------------------------

function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function k(args: string[], input?: string): { code: number; out: string; err: string } {
  const r = spawnSync("kubectl", args, { encoding: "utf8", input, maxBuffer: 256 * 1024 * 1024 });
  return { code: r.status ?? 1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

function kjson(args: string[]): Doc | null {
  const r = k([...args, "-o", "json"]);
  if (r.code !== 0) return null;
  try {
    return JSON.parse(r.out) as Doc;
  } catch {
    return null;
  }
}

function apply(doc: Doc | Doc[]): void {
  const docs = Array.isArray(doc) ? doc : [doc];
  const r = k(["apply", "-f", "-"], JSON.stringify(docs.length === 1 ? docs[0] : { apiVersion: "v1", kind: "List", items: docs }));
  if (r.code !== 0) throw new Error(`kubectl apply failed: ${r.err.trim()}`);
}

function waitUntil(label: string, timeoutMs: number, intervalMs: number, probe: () => string | null): void {
  const t0 = Date.now();
  let last = "";
  while (Date.now() - t0 < timeoutMs) {
    const out = probe();
    if (out === null) return;
    if (out !== last) {
      console.log(`  ${label}: ${out}`);
      last = out;
    }
    sleepMs(intervalMs);
  }
  throw new Error(`timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${label}${last === "" ? "" : ` (last: ${last})`}`);
}

function waitDataVolume(name: string, timeoutMs: number): void {
  waitUntil(`DataVolume ${name}`, timeoutMs, 4000, () => {
    const dv = kjson(["-n", NAMESPACE, "get", "dv", name]);
    const phase = dv?.status?.phase as string | undefined;
    if (phase === "Succeeded") return null;
    if (phase === "Failed") throw new Error(`DataVolume ${name} Failed: ${JSON.stringify(dv?.status?.conditions ?? [])}`);
    return `${phase ?? "pending"} ${dv?.status?.progress ?? ""}`.trim();
  });
}

interface Facts {
  readonly input: GuardInput;
  readonly sourcePvc: string;
  readonly sourcePv: string;
}

function readQuota(): { hard: Record<string, string>; used: Record<string, string> } {
  const q = kjson(["-n", NAMESPACE, "get", "resourcequota", NAMESPACE]);
  return { hard: (q?.status?.hard ?? {}) as Record<string, string>, used: (q?.status?.used ?? {}) as Record<string, string> };
}

function readDisks(): { disks: DiskFacts[]; over: number; minimal: number } {
  const nodes = kjson(["-n", LONGHORN_NAMESPACE, "get", "nodes.longhorn.io"]);
  const disks: DiskFacts[] = [];
  for (const n of (nodes?.items ?? []) as Doc[]) {
    for (const [key, s] of Object.entries((n.status?.diskStatus ?? {}) as Record<string, Doc>)) {
      const spec = (n.spec?.disks?.[key] ?? {}) as Doc;
      const conds = (s.conditions ?? []) as Doc[];
      disks.push({
        name: key,
        maximum: Number(s.storageMaximum ?? 0),
        available: Number(s.storageAvailable ?? 0),
        scheduled: Number(s.storageScheduled ?? 0),
        reserved: Number(spec.storageReserved ?? 0),
        allowScheduling: spec.allowScheduling === true,
        ready: conds.some((c) => c.type === "Schedulable" && c.status === "True"),
      });
    }
  }
  const setting = (n: string, dflt: number): number => {
    const s = kjson(["-n", LONGHORN_NAMESPACE, "get", "settings.longhorn.io", n]);
    return s?.value === undefined ? dflt : Number(s.value);
  };
  return { disks, over: setting("storage-over-provisioning-percentage", 100), minimal: setting("storage-minimal-available-percentage", 25) };
}

function nodeDiskPressure(): boolean {
  const nodes = kjson(["get", "nodes"]);
  return ((nodes?.items ?? []) as Doc[]).some((n) => ((n.status?.conditions ?? []) as Doc[]).some((c) => c.type === "DiskPressure" && c.status === "True"));
}

function stateClaimOf(vm: string): Doc | null {
  const l = kjson(["-n", NAMESPACE, "get", "pvc", "-l", `persistent-state-for=${vm}`]);
  const items = (l?.items ?? []) as Doc[];
  return items[0] ?? null;
}

function gatherFacts(sourcePvc: string, vm: string | null, withState: boolean, usePopulator: boolean, forRestore: Doc | null): Facts {
  const pvc = kjson(["-n", NAMESPACE, "get", "pvc", sourcePvc]);
  if (pvc === null) throw new Error(`refused: no claim ${sourcePvc} in ${NAMESPACE}`);
  const pv = String(pvc.spec?.volumeName ?? "");
  const lh = pv === "" ? null : kjson(["-n", LONGHORN_NAMESPACE, "get", "volumes.longhorn.io", pv]);
  const sourceBytes = parseQuantity(String(pvc.status?.capacity?.storage ?? pvc.spec?.resources?.requests?.storage));
  const actual = Number(lh?.status?.actualSize ?? sourceBytes);
  const state = withState && vm !== null ? stateClaimOf(vm) : null;
  const stateBytes = state === null ? 0 : parseQuantity(String(state.status?.capacity?.storage ?? "12Mi"));
  const { hard, used } = readQuota();
  const d = readDisks();
  return {
    sourcePvc,
    sourcePv: pv,
    input: {
      sourceBytes,
      sourceActualBytes: actual,
      stateBytes,
      usePopulator,
      quotaHard: hard,
      quotaUsed: used,
      disks: d.disks,
      overProvisionPercent: d.over,
      minimalAvailablePercent: d.minimal,
      nodeDiskPressure: nodeDiskPressure(),
      ...(forRestore === null ? {} : { vm: vmNeedFromTemplate(forRestore) }),
    },
  };
}

function printGuard(r: GuardResult): void {
  for (const n of r.notes) console.log(`  . ${n}`);
  for (const x of r.refusals) console.log(`  REFUSED: ${x}`);
  if (r.suggestion !== null) console.log(`  ${r.suggestion}`);
  console.log(r.ok ? "capacity guard: OK" : "capacity guard: REFUSED (nothing was created)");
}

function parseFlags(argv: string[], valueFlags: string[], boolFlags: string[]): { values: Record<string, string>; bools: Set<string>; rest: string[] } | string {
  const values: Record<string, string> = {};
  const bools = new Set<string>();
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (valueFlags.includes(a)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) return `${a} needs a value`;
      values[a] = v;
      i++;
    } else if (boolFlags.includes(a)) bools.add(a);
    else rest.push(a);
  }
  return { values, bools, rest };
}

/** The template for a restored VM: the LIVE win11-desktop (so a change the owner made to it is carried), reduced to what `restoredVm` reads. */
function loadDesktopTemplate(): Doc {
  const vm = kjson(["-n", NAMESPACE, "get", "vm", "win11-desktop"]);
  if (vm === null) throw new Error("refused: no VirtualMachine win11-desktop to use as the template");
  return { spec: vm.spec };
}

// ---- guard ----------------------------------------------------------------

function cmdGuard(argv: string[]): number {
  const f = parseFlags(argv, ["--vm", "--source-pvc"], ["--with-state", "--populator", "--restore"]);
  if (typeof f === "string") return usage(f);
  const vm = f.values["--vm"] ?? null;
  if (vm !== null && !isCapturableVm(vm)) return usage(`--vm must be one of ${CAPTURABLE_VMS.join(", ")}`);
  const src = f.values["--source-pvc"] ?? (vm === null ? null : `${vm}-root`);
  if (src === null) return usage("give --vm or --source-pvc");
  try {
    const facts = gatherFacts(src, vm, f.bools.has("--with-state"), f.bools.has("--populator"), f.bools.has("--restore") ? loadDesktopTemplate() : null);
    console.log(`source claim ${src} (${facts.sourcePv})`);
    const r = capacityGuard(facts.input);
    printGuard(r);
    return r.ok ? 0 : 2;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return String(e instanceof Error ? e.message : e).startsWith("refused") ? 2 : 1;
  }
}

// ---- capture ----------------------------------------------------------------

function runVerify(podName: string, src: string, dst: string, headMib: number, full: boolean): { ok: boolean; sparse: boolean; detail: string } {
  k(["-n", NAMESPACE, "delete", "pod", podName, "--ignore-not-found", "--wait=true"]);
  apply(verifyPod(podName, src, dst, headMib, full));
  try {
    waitUntil(`verify pod ${podName}`, full ? 3 * 3600_000 : 600_000, 5000, () => {
      const p = kjson(["-n", NAMESPACE, "get", "pod", podName]);
      const phase = p?.status?.phase as string | undefined;
      if (phase === "Succeeded") return null;
      if (phase === "Failed") throw new Error(`the verify pod failed: ${k(["-n", NAMESPACE, "logs", podName]).out.trim()}`);
      return phase ?? "pending";
    });
    const log = k(["-n", NAMESPACE, "logs", podName]).out;
    const parsed = parseVerify(log);
    if (parsed === null) return { ok: false, sparse: false, detail: `could not parse the verify log: ${log.trim()}` };
    const cmp = compareVerify(parsed);
    return { ok: cmp.ok, sparse: cmp.sparsePreserved, detail: cmp.ok ? `${parsed.src.apparent} bytes; head ${parsed.src.head.slice(0, 16)}...; full ${parsed.src.full === "skipped" ? "skipped" : "matched"}; allocated ${parsed.src.allocated512 * 512} vs ${parsed.dst.allocated512 * 512} bytes` : cmp.problems.join("; ") };
  } finally {
    k(["-n", NAMESPACE, "delete", "pod", podName, "--ignore-not-found", "--wait=false"]);
  }
}

function cmdCapture(argv: string[]): number {
  const f = parseFlags(argv, ["--vm", "--label", "--verify-mib", "--source-pvc"], ["--yes", "--no-snapshot", "--keep-halted", "--full-hash", "--no-state", "--populator"]);
  if (typeof f === "string") return usage(f);
  const vm = f.values["--vm"] ?? null;
  const label = f.values["--label"];
  if (label === undefined) return usage("capture needs --label NAME");
  const lp = labelProblem(label);
  if (lp !== null) return usage(`--label ${lp}`);
  if (vm !== null && !isCapturableVm(vm)) return usage(`--vm must be one of ${CAPTURABLE_VMS.join(", ")}`);
  const srcPvc = f.values["--source-pvc"] ?? (vm === null ? null : `${vm}-root`);
  if (srcPvc === null) return usage("give --vm (or, for a stand-in, --source-pvc)");
  const headMib = Number(f.values["--verify-mib"] ?? "512");
  const date = dateStamp(new Date());
  const golden = goldenName(label, date);
  const withState = vm !== null && !f.bools.has("--no-state");
  console.log(`capture ${srcPvc} -> ${golden}${withState ? ` (+ ${stateName(golden)})` : ""}`);

  let facts: Facts;
  try {
    facts = gatherFacts(srcPvc, vm, withState, f.bools.has("--populator"), null);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 2;
  }
  const guard = capacityGuard(facts.input);
  printGuard(guard);
  if (!guard.ok) return 2;
  if (kjson(["-n", NAMESPACE, "get", "dv", golden]) !== null || kjson(["-n", NAMESPACE, "get", "pvc", golden]) !== null) {
    console.error(`refused: ${golden} already exists (the date is the day's only disambiguator: pick another --label)`);
    return 2;
  }

  // The guest must be OFF for a clean copy, and `runStrategy: Always` restarts a plain shutdown, so set Halted first.
  let originalStrategy: string | null = null;
  let firmware: Doc = {};
  if (vm !== null) {
    const vmDoc = kjson(["-n", NAMESPACE, "get", "vm", vm]);
    if (vmDoc === null) {
      console.error(`refused: no VirtualMachine ${vm}`);
      return 2;
    }
    originalStrategy = String(vmDoc.spec?.runStrategy ?? "");
    firmware = (vmDoc.spec?.template?.spec?.domain?.firmware ?? {}) as Doc;
    const running = kjson(["-n", NAMESPACE, "get", "vmi", vm]) !== null;
    if (running && !f.bools.has("--yes")) {
      console.error(`refused: ${vm} is running, and a clean copy needs it shut down. Re-run with --yes to shut it down (Windows is asked to shut down gracefully, up to its 300 s grace period), then restart it when the copy is verified.`);
      return 2;
    }
  }

  let stopped = false;
  try {
    if (vm !== null && originalStrategy !== "Halted") {
      console.log(`stopping ${vm} (runStrategy ${originalStrategy} -> Halted)`);
      const p = k(["-n", NAMESPACE, "patch", "vm", vm, "--type", "merge", "-p", '{"spec":{"runStrategy":"Halted"}}']);
      if (p.code !== 0) throw new Error(`could not set Halted: ${p.err.trim()}`);
      stopped = true;
      waitUntil(`VMI ${vm} to disappear`, 420_000, 5000, () => (kjson(["-n", NAMESPACE, "get", "vmi", vm]) === null ? null : "shutting down"));
    }

    if (!f.bools.has("--no-snapshot") && facts.sourcePv !== "") {
      const snap = snapshotName(vm ?? srcPvc, date);
      console.log(`rollback point: Longhorn snapshot ${snap} (same disk: protects against a bad change, NOT a backup)`);
      apply(longhornSnapshot(snap, facts.sourcePv));
      waitUntil(`snapshot ${snap}`, 180_000, 3000, () => (kjson(["-n", LONGHORN_NAMESPACE, "get", "snapshots.longhorn.io", snap])?.status?.readyToUse === true ? null : "not ready"));
    }

    const annotations: Record<string, string> = {
      "zeta.io/golden-source-claim": srcPvc,
      "zeta.io/golden-captured-at": new Date().toISOString(),
      ...(vm === null ? {} : { "zeta.io/golden-source-vm": vm }),
      ...(typeof firmware.uuid === "string" ? { "zeta.io/golden-firmware-uuid": firmware.uuid } : {}),
      ...(typeof firmware.serial === "string" ? { "zeta.io/golden-firmware-serial": firmware.serial } : {}),
    };
    console.log(`cloning ${srcPvc} -> ${golden} (this copies the disk image; minutes for a 100 GiB thin disk)`);
    apply(cloneDataVolume({ name: golden, sourcePvc: srcPvc, annotations, usePopulator: f.bools.has("--populator") }));
    waitDataVolume(golden, 3 * 3600_000);

    const state = withState && vm !== null ? stateClaimOf(vm) : null;
    if (state !== null) {
      const bytes = parseQuantity(String(state.status?.capacity?.storage ?? "12Mi"));
      console.log(`cloning the TPM/UEFI state claim ${state.metadata.name} -> ${stateName(golden)}`);
      apply(cloneDataVolume({ name: stateName(golden), sourcePvc: String(state.metadata.name), size: stateCloneSize(bytes), usePopulator: f.bools.has("--populator") }));
      waitDataVolume(stateName(golden), 900_000);
    } else if (withState) console.log("no TPM/UEFI state claim found for the VM: the golden image is the disk only");

    console.log(`verifying ${golden} against ${srcPvc} (${f.bools.has("--full-hash") ? "full sha256" : `first ${headMib} MiB`} + size)`);
    const v = runVerify(`${golden}-verify`.slice(0, 63), srcPvc, golden, headMib, f.bools.has("--full-hash"));
    console.log(`  ${v.ok ? "MATCH" : "MISMATCH"}: ${v.detail}${v.ok ? (v.sparse ? "; sparseness preserved" : "; NOTE: allocated blocks differ (the copy is not sparse-identical)") : ""}`);
    if (!v.ok) {
      console.error(`verification FAILED: do not use ${golden}; the source was not modified`);
      return 1;
    }
    console.log(`\nDONE. Golden image: ${golden}${state === null ? "" : `, state ${stateName(golden)}`}.`);
    console.log(`Restore it into a NEW VM:  bun src/Core.TypeScript/cluster/windows-vm-golden-image.ts restore --golden ${golden} --as <new-vm-name>${state === null ? "" : " --with-state"}`);
    return 0;
  } catch (e) {
    console.error(`capture failed: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  } finally {
    if (stopped && vm !== null && originalStrategy !== null && !f.bools.has("--keep-halted")) {
      console.log(`restarting ${vm} (runStrategy -> ${originalStrategy})`);
      const r = k(["-n", NAMESPACE, "patch", "vm", vm, "--type", "merge", "-p", JSON.stringify({ spec: { runStrategy: originalStrategy } })]);
      if (r.code !== 0) console.error(`COULD NOT RESTART ${vm}: ${r.err.trim()} -- set runStrategy back to ${originalStrategy} by hand`);
    } else if (stopped) console.log(`${vm} is left HALTED (--keep-halted). Start it: kubectl -n ${NAMESPACE} patch vm ${vm} --type merge -p '{"spec":{"runStrategy":"Always"}}'`);
  }
}

// ---- restore ----------------------------------------------------------------

function cmdRestore(argv: string[]): number {
  const f = parseFlags(argv, ["--golden", "--as", "--firmware-uuid", "--firmware-serial"], ["--with-state", "--apply", "--populator"]);
  if (typeof f === "string") return usage(f);
  const golden = f.values["--golden"];
  const name = f.values["--as"];
  if (golden === undefined || name === undefined) return usage("restore needs --golden NAME and --as VMNAME");
  if (!golden.startsWith(`${GOLDEN_PREFIX}-`)) return usage(`--golden must be a ${GOLDEN_PREFIX}-* claim`);
  const np = restoredVmNameProblem(name);
  if (np !== null) return usage(`--as ${np}`);
  if (kjson(["-n", NAMESPACE, "get", "vm", name]) !== null) {
    console.error(`refused: VirtualMachine ${name} already exists`);
    return 2;
  }
  const goldenDv = kjson(["-n", NAMESPACE, "get", "dv", golden]);
  if (goldenDv === null) {
    console.error(`refused: no DataVolume ${golden}`);
    return 2;
  }
  const template = loadDesktopTemplate();
  const withState = f.bools.has("--with-state");
  const stateDv = withState ? kjson(["-n", NAMESPACE, "get", "pvc", stateName(golden)]) : null;
  if (withState && stateDv === null) {
    console.error(`refused: --with-state but ${stateName(golden)} does not exist (it is created by capture when the guest has a state claim)`);
    return 2;
  }
  const ann = (goldenDv.metadata?.annotations ?? {}) as Record<string, string>;
  const uuid = f.values["--firmware-uuid"] ?? (withState ? ann["zeta.io/golden-firmware-uuid"] : undefined);
  const serial = f.values["--firmware-serial"] ?? (withState ? ann["zeta.io/golden-firmware-serial"] : undefined);

  let facts: Facts;
  try {
    facts = gatherFacts(golden, null, false, f.bools.has("--populator"), template);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 2;
  }
  const stateBytes = stateDv === null ? 0 : parseQuantity(String(stateDv.status?.capacity?.storage ?? "14Mi"));
  const guard = capacityGuard({ ...facts.input, stateBytes });
  printGuard(guard);
  if (!guard.ok) return 2;

  const docs: Doc[] = [cloneDataVolume({ name: restoredRootName(name), sourcePvc: golden, usePopulator: f.bools.has("--populator"), annotations: { "zeta.io/restored-from": golden } })];
  if (stateDv !== null) {
    docs.push(cloneDataVolume({ name: restoredStateName(name), sourcePvc: stateName(golden), size: stateCloneSize(stateBytes), labels: { "persistent-state-for": name }, usePopulator: f.bools.has("--populator") }));
    console.error(`note: the carried TPM/NVRAM state belongs to the guest named in the golden image. NVRAM is keyed by the VM NAME and the TPM by firmware.uuid: this restore sets firmware.uuid=${uuid ?? "(unset)"}; a VM with a different name still starts with fresh NVRAM (the disk's ESP carries a fallback boot path), TPM carried.`);
  }
  docs.push(restoredVm({ name, template, ...(uuid === undefined ? {} : { firmwareUuid: uuid }), ...(serial === undefined ? {} : { firmwareSerial: serial }) }), ...restoredServices(name));
  if (!f.bools.has("--apply")) {
    // a v1 List: `... | kubectl apply -f -` takes it as it is, and `kubectl apply --dry-run=server -f -` validates it without creating anything
    process.stdout.write(`${JSON.stringify({ apiVersion: "v1", kind: "List", items: docs }, null, 2)}\n`);
    console.error(`\n(rendered only; add --apply to create them. The VM is created HALTED; start it with: kubectl -n ${NAMESPACE} patch vm ${name} --type merge -p '{"spec":{"runStrategy":"Always"}}')`);
    return 0;
  }
  try {
    apply(docs);
    waitDataVolume(restoredRootName(name), 3 * 3600_000);
    if (stateDv !== null) waitDataVolume(restoredStateName(name), 900_000);
    console.log(`restored: VM ${name} exists, HALTED. Start it: kubectl -n ${NAMESPACE} patch vm ${name} --type merge -p '{"spec":{"runStrategy":"Always"}}'`);
    return 0;
  } catch (e) {
    console.error(`restore failed: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

// ---- selftest ---------------------------------------------------------------

const ST = "gi-selftest";
const ST_LABEL = "gi-selftest";

function stPod(name: string, script: string, mounts: { claim: string; path: string; ro: boolean }[], asRoot = false): Doc {
  return {
    apiVersion: "v1",
    kind: "Pod",
    metadata: { name, namespace: NAMESPACE, labels: { [THROWAWAY_LABEL]: ST_LABEL } },
    spec: {
      restartPolicy: "Never",
      automountServiceAccountToken: false,
      containers: [
        {
          name: "t",
          image: "docker.io/library/alpine:3.21",
          command: ["sh", "-c", script],
          // root + DAC_OVERRIDE only to READ a state claim whose files belong to other uids; baseline admits it, restricted warns
          securityContext: asRoot ? { allowPrivilegeEscalation: false, runAsUser: 0, capabilities: { drop: ["ALL"], add: ["DAC_OVERRIDE"] } } : RESTRICTED_CONTEXT,
          resources: SMALL,
          volumeMounts: mounts.map((m, i) => ({ name: `v${i}`, mountPath: m.path, readOnly: m.ro })),
        },
      ],
      volumes: mounts.map((m, i) => ({ name: `v${i}`, persistentVolumeClaim: { claimName: m.claim, readOnly: m.ro } })),
    },
  };
}

function runPod(name: string, script: string, mounts: { claim: string; path: string; ro: boolean }[], asRoot = false): string {
  apply(stPod(name, script, mounts, asRoot));
  waitUntil(`pod ${name}`, 300_000, 3000, () => {
    const phase = kjson(["-n", NAMESPACE, "get", "pod", name])?.status?.phase as string | undefined;
    if (phase === "Succeeded") return null;
    if (phase === "Failed") throw new Error(`pod ${name} failed: ${k(["-n", NAMESPACE, "logs", name]).out.trim()}`);
    return phase ?? "pending";
  });
  const log = k(["-n", NAMESPACE, "logs", name]).out;
  k(["-n", NAMESPACE, "delete", "pod", name, "--wait=false", "--ignore-not-found"]);
  return log;
}

const WRITER = [
  "set -e",
  "cd /d",
  "SZ=$(stat -c %s disk.img); MB=$((SZ/1048576))",
  'pat() { yes "ZETA-GOLDEN-STANDIN $1 0123456789abcdef" | head -c 1048576; }',
  "pat A | dd of=disk.img bs=1M seek=0 conv=notrunc 2>/dev/null",
  "pat B | dd of=disk.img bs=1M seek=700 conv=notrunc 2>/dev/null",
  "pat C | dd of=disk.img bs=1M seek=$((MB-1)) conv=notrunc 2>/dev/null",
  "sync",
].join("\n");

const READBACK = [
  "set -e",
  "cd /d",
  "echo \"marker700=$(dd if=disk.img bs=1M skip=700 count=1 2>/dev/null | head -c 38)\"",
].join("\n");

/** One DataVolume clone step, timed, with the peak quota use seen while it ran. */
function timedClone(spec: CloneSpec): { seconds: number; peakStorage: number } {
  const t0 = Date.now();
  apply(cloneDataVolume({ ...spec, labels: { ...(spec.labels ?? {}), [THROWAWAY_LABEL]: ST_LABEL } }));
  let peak = 0;
  waitUntil(`clone ${spec.name}`, 600_000, 2000, () => {
    peak = Math.max(peak, parseQuantity(readQuota().used["requests.storage"] ?? "0"));
    const dv = kjson(["-n", NAMESPACE, "get", "dv", spec.name]);
    const phase = dv?.status?.phase as string | undefined;
    if (phase === "Succeeded") return null;
    if (phase === "Failed") throw new Error(`clone ${spec.name} Failed`);
    return phase ?? "pending";
  });
  return { seconds: Math.round((Date.now() - t0) / 1000), peakStorage: peak };
}

function standInVm(name: string, rootClaim: string, uuid?: string): Doc {
  return {
    apiVersion: "kubevirt.io/v1",
    kind: "VirtualMachine",
    metadata: { name, namespace: NAMESPACE, labels: { [THROWAWAY_LABEL]: ST_LABEL } },
    spec: {
      runStrategy: "Halted",
      template: {
        metadata: { labels: { "kubevirt.io/domain": name, [THROWAWAY_LABEL]: ST_LABEL } },
        spec: {
          terminationGracePeriodSeconds: 5,
          domain: {
            cpu: { cores: 1 },
            memory: { guest: "512Mi" },
            resources: { requests: { cpu: "100m", memory: "512Mi" }, limits: { memory: "512Mi" } },
            firmware: { ...(uuid === undefined ? {} : { uuid }), bootloader: { efi: { secureBoot: false, persistent: true } } },
            devices: { tpm: { persistent: true }, disks: [{ name: "root", disk: { bus: "virtio" } }] },
          },
          volumes: [{ name: "root", persistentVolumeClaim: { claimName: rootClaim } }],
        },
      },
    },
  };
}

function vmStart(name: string): void {
  const r = k(["replace", "--raw", `/apis/subresources.kubevirt.io/v1/namespaces/${NAMESPACE}/virtualmachines/${name}/start`, "-f", "-"], "{}");
  if (r.code !== 0) throw new Error(`start ${name}: ${r.err.trim()}`);
  waitUntil(`VMI ${name} Running`, 300_000, 4000, () => ((kjson(["-n", NAMESPACE, "get", "vmi", name])?.status?.phase as string | undefined) === "Running" ? null : "starting"));
  sleepMs(15_000);
}

function vmStop(name: string): void {
  k(["replace", "--raw", `/apis/subresources.kubevirt.io/v1/namespaces/${NAMESPACE}/virtualmachines/${name}/stop`, "-f", "-"], '{"gracePeriod":0}');
  waitUntil(`VMI ${name} gone`, 120_000, 3000, () => (kjson(["-n", NAMESPACE, "get", "vmi", name]) === null ? null : "stopping"));
}

const STATE_LISTING = "cd /d && find . -type f | sort | while read f; do echo \"$(sha256sum \"$f\" | cut -c1-16) $f\"; done";

function cleanupSelftest(): string[] {
  const left: string[] = [];
  k(["-n", NAMESPACE, "delete", "vm", "-l", `${THROWAWAY_LABEL}=${ST_LABEL}`, "--wait=true", "--ignore-not-found"]);
  k(["-n", NAMESPACE, "delete", "pod", "-l", `${THROWAWAY_LABEL}=${ST_LABEL}`, "--grace-period=0", "--wait=true", "--ignore-not-found"]);
  const pods = kjson(["-n", NAMESPACE, "get", "pod"]);
  for (const pd of (pods?.items ?? []) as Doc[]) {
    const n = String(pd.metadata?.name ?? "");
    if (n.startsWith(`${GOLDEN_PREFIX}-${ST}-`)) k(["-n", NAMESPACE, "delete", "pod", n, "--grace-period=0", "--wait=true", "--ignore-not-found"]);
  }
  const snaps = kjson(["-n", LONGHORN_NAMESPACE, "get", "snapshots.longhorn.io"]);
  for (const s of (snaps?.items ?? []) as Doc[]) {
    const n = String(s.metadata?.name ?? "");
    if (!n.startsWith(`${ST}-`)) continue;
    k(["-n", LONGHORN_NAMESPACE, "delete", "snapshots.longhorn.io", n, "--wait=false"]);
    sleepMs(3000);
    if (kjson(["-n", LONGHORN_NAMESPACE, "get", "snapshots.longhorn.io", n]) !== null) k(["-n", LONGHORN_NAMESPACE, "patch", "snapshots.longhorn.io", n, "--type", "merge", "-p", '{"metadata":{"finalizers":null}}']);
  }
  k(["-n", NAMESPACE, "delete", "dv", "-l", `${THROWAWAY_LABEL}=${ST_LABEL}`, "--wait=true", "--ignore-not-found"]);
  // `capture` (not selftest's own clone helper) creates its goldens without the throwaway label: they are ours by NAME
  const dvs = kjson(["-n", NAMESPACE, "get", "dv"]);
  for (const d of (dvs?.items ?? []) as Doc[]) {
    const n = String(d.metadata?.name ?? "");
    if (n.startsWith(`${GOLDEN_PREFIX}-${ST}-`)) k(["-n", NAMESPACE, "delete", "dv", n, "--wait=true", "--ignore-not-found"]);
  }
  k(["-n", NAMESPACE, "delete", "pvc", "-l", `${THROWAWAY_LABEL}=${ST_LABEL}`, "--wait=true", "--ignore-not-found"]);
  sleepMs(8000);
  // The class `longhorn` RETAINS: the stand-in VM's own state claim leaves a Released PV (and a Longhorn volume). Remove ONLY ours, by name.
  const pvs = kjson(["get", "pv"]);
  for (const pv of (pvs?.items ?? []) as Doc[]) {
    const claim = String(pv.spec?.claimRef?.name ?? "");
    const ns = String(pv.spec?.claimRef?.namespace ?? "");
    if (ns !== NAMESPACE || !claim.startsWith(`persistent-state-for-${ST}-`)) continue;
    const name = String(pv.metadata.name);
    k(["delete", "pv", name, "--wait=false"]);
    k(["-n", LONGHORN_NAMESPACE, "delete", "volumes.longhorn.io", name, "--wait=true", "--timeout=60s", "--ignore-not-found"]);
  }
  const rest = kjson(["-n", NAMESPACE, "get", "dv,pvc,pod,vm", "-l", `${THROWAWAY_LABEL}=${ST_LABEL}`]);
  for (const o of (rest?.items ?? []) as Doc[]) left.push(`${o.kind}/${o.metadata.name}`);
  for (const pv of ((kjson(["get", "pv"])?.items ?? []) as Doc[])) {
    const claim = String(pv.spec?.claimRef?.name ?? "");
    if (claim.startsWith(ST) || claim.startsWith(`persistent-state-for-${ST}-`) || claim.startsWith(`${GOLDEN_PREFIX}-${ST}`)) left.push(`PV/${pv.metadata.name} (${claim}, ${pv.status?.phase})`);
  }
  return left;
}

function cmdSelftest(argv: string[]): number {
  const f = parseFlags(argv, [], ["--with-vm"]);
  if (typeof f === "string") return usage(f);
  const withVm = f.bools.has("--with-vm");
  const date = dateStamp(new Date());
  const blank = `${ST}-blank`;
  const golden = goldenName(ST_LABEL, date);
  const root2 = `${ST}-restored-root`;
  const report: string[] = [];
  const note = (s: string) => {
    report.push(s);
    console.log(`>> ${s}`);
  };
  const baseline = readQuota().used["requests.storage"] ?? "0";
  note(`quota requests.storage before: ${formatGiB(parseQuantity(baseline))}`);
  let failed: string | null = null;
  try {
    const pre = cleanupSelftest();
    if (pre.length > 0) throw new Error(`leftovers from an earlier run: ${pre.join(", ")}`);
    // 0. the stand-in source: a 2Gi blank DataVolume, then a recognisable pattern in a sparse disk.img
    apply({
      apiVersion: "cdi.kubevirt.io/v1beta1",
      kind: "DataVolume",
      metadata: { name: blank, namespace: NAMESPACE, labels: { [THROWAWAY_LABEL]: ST_LABEL }, annotations: { "cdi.kubevirt.io/storage.bind.immediate.requested": "true" } },
      spec: { source: { blank: {} }, storage: { accessModes: ["ReadWriteOnce"], volumeMode: "Filesystem", storageClassName: STORAGE_CLASS, resources: { requests: { storage: "2Gi" } } } },
    });
    waitDataVolume(blank, 300_000);
    runPod(`${ST}-writer`, WRITER, [{ claim: blank, path: "/d", ro: false }]);
    note("stand-in source written: 1 MiB patterns at 0, 700 MiB and the last MiB of a sparse ~1.9 GiB disk.img");

    // 1. the guard, on the stand-in's real numbers
    const facts = gatherFacts(blank, null, false, false, null);
    const g = capacityGuard(facts.input);
    note(`capacity guard on the stand-in: ${g.ok ? "OK" : `REFUSED ${g.refusals.join("; ")}`}`);
    if (!g.ok) throw new Error("the guard refused a 2Gi stand-in");

    // 2. rollback snapshot
    const snap = `${ST}-snap`;
    apply(longhornSnapshot(snap, facts.sourcePv));
    const t0 = Date.now();
    waitUntil(`snapshot ${snap}`, 180_000, 3000, () => (kjson(["-n", LONGHORN_NAMESPACE, "get", "snapshots.longhorn.io", snap])?.status?.readyToUse === true ? null : "not ready"));
    note(`Longhorn snapshot ready in ${Math.round((Date.now() - t0) / 1000)} s`);

    // 3. the exact capture clone, legacy path
    const c1 = timedClone({ name: golden, sourcePvc: blank });
    const extra = c1.peakStorage - parseQuantity(baseline);
    note(`clone (usePopulator=false) done in ${c1.seconds} s; peak quota use above baseline ${formatGiB(extra)} (the stand-in source ${formatGiB(facts.input.sourceBytes)} + ONE copy: no prime claim)`);

    // 4. verify: full sha256 + sparseness
    const v = runVerify(`${ST}-verify`, blank, golden, 64, true);
    note(`verify: ${v.ok ? "MATCH" : "MISMATCH"}; ${v.detail}; sparse ${v.sparse ? "preserved" : "NOT preserved"}`);
    if (!v.ok) throw new Error("the golden copy does not match the source");

    // 5. restore: a clone OF the golden (what a new VM boots from), then read the pattern back through a pod
    const c2 = timedClone({ name: root2, sourcePvc: golden });
    const back = runPod(`${ST}-readback`, READBACK, [{ claim: root2, path: "/d", ro: true }]);
    const ok = back.includes("marker700=ZETA-GOLDEN-STANDIN B 0123456789abcdef");
    note(`restore clone (omitted size) done in ${c2.seconds} s; the 700 MiB marker read back through a pod: ${ok ? "OK" : `WRONG (${back.trim()})`}`);
    if (!ok) throw new Error("the restored claim does not carry the pattern");

    // 6. (optional) a stand-in VM: TPM + NVRAM state carried by a same-name restore
    if (withVm) {
      const vmName = `${ST}-vm`;
      apply(standInVm(vmName, blank));
      vmStart(vmName);
      vmStop(vmName);
      const st = stateClaimOf(vmName);
      if (st === null) throw new Error("the stand-in VM created no state claim");
      const uuid = String(kjson(["-n", NAMESPACE, "get", "vm", vmName])?.spec?.template?.spec?.domain?.firmware?.uuid ?? "");
      const stGolden = stateName(golden);
      timedClone({ name: stGolden, sourcePvc: String(st.metadata.name), size: stateCloneSize(parseQuantity(String(st.status.capacity.storage))) });
      const before = runPod(`${ST}-state-a`, STATE_LISTING, [{ claim: stGolden, path: "/d", ro: true }], true);
      k(["-n", NAMESPACE, "delete", "vm", vmName, "--wait=true"]);
      timedClone({ name: restoredStateName(vmName), sourcePvc: stGolden, size: stateCloneSize(parseQuantity(String(st.status.capacity.storage))), labels: { "persistent-state-for": vmName } });
      apply(standInVm(vmName, root2, uuid));
      vmStart(vmName);
      vmStop(vmName);
      const adopted = (kjson(["-n", NAMESPACE, "get", "pvc", "-l", `persistent-state-for=${vmName}`])?.items ?? []) as Doc[];
      const after = runPod(`${ST}-state-b`, STATE_LISTING, [{ claim: restoredStateName(vmName), path: "/d", ro: true }], true);
      const tpmDirs = (listing: string) => new Set([...listing.matchAll(/swtpm\/([0-9a-f-]{36})\//g)].map((m) => m[1]));
      note(`stand-in VM state: before ${tpmDirs(before).size} TPM dir(s) [${[...tpmDirs(before)].join(",")}], after restore+boot ${tpmDirs(after).size} [${[...tpmDirs(after)].join(",")}]; claims labelled persistent-state-for=${vmName}: ${adopted.length}; NVRAM file kept: ${after.includes(`nvram/${vmName}_VARS.fd`)}`);
      if (tpmDirs(after).size !== 1 || !after.includes(`nvram/${vmName}_VARS.fd`) || adopted.length !== 1) throw new Error("TPM/NVRAM state was not carried over by a same-name, same-uuid restore");
    }

    // 6b. (optional) `capture` against a RUNNING stand-in VM with runStrategy Always: the stop, snapshot, clone, state clone, verify and restart path
    if (withVm) {
      // the namespace allows 12 claims in all and the steps above hold several: free the ones already proven, so this step can run
      k(["-n", NAMESPACE, "delete", "vm", `${ST}-vm`, "--wait=true", "--ignore-not-found"]);
      k(["-n", NAMESPACE, "delete", "dv", root2, stateName(golden), restoredStateName(`${ST}-vm`), "--wait=true", "--ignore-not-found"]);
      const capVm = `${ST}-capvm`;
      const capRoot = `${capVm}-root`;
      apply({
        apiVersion: "cdi.kubevirt.io/v1beta1",
        kind: "DataVolume",
        metadata: { name: capRoot, namespace: NAMESPACE, labels: { [THROWAWAY_LABEL]: ST_LABEL }, annotations: { "cdi.kubevirt.io/storage.bind.immediate.requested": "true" } },
        spec: { source: { blank: {} }, storage: { accessModes: ["ReadWriteOnce"], volumeMode: "Filesystem", storageClassName: STORAGE_CLASS, resources: { requests: { storage: "1Gi" } } } },
      });
      waitDataVolume(capRoot, 300_000);
      const vmDoc = standInVm(capVm, capRoot);
      vmDoc.spec.runStrategy = "Always";
      apply(vmDoc);
      waitUntil(`VMI ${capVm} Running`, 300_000, 4000, () => ((kjson(["-n", NAMESPACE, "get", "vmi", capVm])?.status?.phase as string | undefined) === "Running" ? null : "starting"));
      sleepMs(10_000);
      const code = cmdCapture(["--vm", capVm, "--label", "gi-selftest-cap", "--yes", "--verify-mib", "8"]);
      const strategy = String(kjson(["-n", NAMESPACE, "get", "vm", capVm])?.spec?.runStrategy ?? "");
      waitUntil(`VMI ${capVm} back`, 180_000, 4000, () => (kjson(["-n", NAMESPACE, "get", "vmi", capVm]) === null ? "not yet" : null));
      const capGolden = goldenName("gi-selftest-cap", date);
      const dv = kjson(["-n", NAMESPACE, "get", "dv", capGolden]);
      const ann = (dv?.metadata?.annotations ?? {}) as Record<string, string>;
      const hasState = kjson(["-n", NAMESPACE, "get", "dv", stateName(capGolden)]) !== null;
      note(`capture on a RUNNING stand-in VM: exit ${code}; runStrategy afterwards ${strategy}; VMI restarted; golden source-vm=${ann["zeta.io/golden-source-vm"] ?? "(none)"} firmware-uuid recorded=${ann["zeta.io/golden-firmware-uuid"] !== undefined}; state clone ${hasState ? "present" : "MISSING"}`);
      if (code !== 0 || strategy !== "Always" || ann["zeta.io/golden-source-vm"] !== capVm || !hasState) throw new Error("capture against a running VM did not behave");
    }

    // 7. deleting the snapshot: observe, do not assume
    k(["-n", LONGHORN_NAMESPACE, "delete", "snapshots.longhorn.io", snap, "--wait=false"]);
    const d0 = Date.now();
    let gone = false;
    while (Date.now() - d0 < 45_000) {
      if (kjson(["-n", LONGHORN_NAMESPACE, "get", "snapshots.longhorn.io", snap]) === null) {
        gone = true;
        break;
      }
      sleepMs(3000);
    }
    note(`snapshot delete: ${gone ? `finished in ${Math.round((Date.now() - d0) / 1000)} s` : "STILL PRESENT after 45 s (runbook: Longhorn leaves it markRemoved with a stale 'engine is upgrading' error; the finalizer is removed during cleanup)"}`);
  } catch (e) {
    failed = e instanceof Error ? e.message : String(e);
    console.error(`SELFTEST FAILED: ${failed}`);
  }
  const left = cleanupSelftest();
  const after = readQuota().used["requests.storage"] ?? "0";
  note(`cleanup: leftovers ${left.length === 0 ? "none" : left.join(", ")}; quota requests.storage after: ${formatGiB(parseQuantity(after))}`);
  if (failed === null && left.length === 0 && after === baseline) console.log("\nSELFTEST PASSED");
  return failed === null && left.length === 0 ? 0 : 1;
}

// ---- main -----------------------------------------------------------------

function usage(why?: string): number {
  if (why !== undefined) console.error(`refused: ${why}`);
  console.error("usage: windows-vm-golden-image.ts guard|capture|restore|selftest ... (see the header of this file and docs/ops/WINDOWS-VM-GOLDEN-IMAGE.md)");
  return 2;
}

function main(argv: string[]): number {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "guard":
      return cmdGuard(rest);
    case "capture":
      return cmdCapture(rest);
    case "restore":
      return cmdRestore(rest);
    case "selftest":
      return cmdSelftest(rest);
    default:
      return usage();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
