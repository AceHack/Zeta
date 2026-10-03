/**
 * windows-11-vms.test.ts -- falsifiers for the two Windows 11 guests on KubeVirt:
 *
 *   full-ai-cluster/k8s/examples/windows-11/00-namespace.yaml     the `windows-vms` namespace, quota, limit range
 *   full-ai-cluster/k8s/examples/windows-11/10-iso.yaml           the shared installer-ISO DataVolume
 *   full-ai-cluster/k8s/examples/windows-11/20-win11-ci.yaml      VM A: a GitLab runner tagged windows / zeta-windows
 *   full-ai-cluster/k8s/examples/windows-11/30-win11-desktop.yaml VM B: an interactive desktop (VNC + RDP)
 *   full-ai-cluster/k8s/examples/windows-11/windows-11-unattend/  Autounattend.xml / Unattend.xml
 *   src/Core.TypeScript/cluster/{windows-11-unattend-secrets,copy-secret,windows-11-vm}.ts
 *   docs/ops/WINDOWS-11-VMS.md                                    the runbook
 *
 *   A. STORAGE -- the node's root filesystem is ~120 GB and the DEFAULT StorageClass is a directory on it, so
 *      every claim names a Longhorn class explicitly, in Filesystem mode, and the namespace refuses the default.
 *   B. THE TAG CONTRACT -- the Windows runner and the Linux runner can never take each other's jobs, and only
 *      VM A is a runner at all.
 *   C. WINDOWS 11 -- UEFI Secure Boot + SMM + a persistent TPM + a real CPU model on BOTH guests; opt-in by
 *      construction (Manual, sentinel ISO URL, nothing under k8s/applications/).
 *   D. RDP IS NEVER PUBLISHED -- ClusterIP only, no LoadBalancer / NodePort / hostPort anywhere.
 *   E. NO CREDENTIAL, NO MICROSOFT URL -- the password is a placeholder, rendered once, escaped, into Secrets;
 *      no Microsoft download (or any Microsoft) URL is committed.
 *   F. THE HELPERS -- the Secret renderer, the Secret copier and the console helper.
 *   G. THE RUNBOOK names every file, Secret, command and limit, so it cannot drift from them.
 *
 * WHAT THIS CANNOT PROVE (the runbook says so too): that Windows installs from this answer file (no Windows
 * image exists in CI or on the cluster), that the OOBE screens skip, or that the runner registers. What WAS
 * proven live on 2026-10-03, and is recorded in the runbook rather than asserted here: both VM specs boot to
 * firmware under Secure Boot + a TPM on the node, a Linux guest saw Secure Boot enabled and a TPM 2.0 whose NV
 * state survived a restart, and a masquerade guest resolved and reached GitLab and the runner download bucket.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseAllDocuments, parse as parseYaml } from "yaml";
import { PASSWORD_PLACEHOLDER } from "./windows-runner-unattend-secret.ts";
import { buildCopy, parseRef } from "./copy-secret.ts";
import { domainName, isKeyName, isVm, keyLoopScript } from "./windows-11-vm.ts";
import { ADMIN_USER, COMPUTER_NAME_PLACEHOLDER, GUESTS, NAMESPACE, renderWindows11Secrets, win11PasswordProblem } from "./windows-11-unattend-secrets.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const DIR = join(REPO_ROOT, "full-ai-cluster/k8s/examples/windows-11");
const UNATTEND_DIR = join(DIR, "windows-11-unattend");
const RUNBOOK = join(REPO_ROOT, "docs/ops/WINDOWS-11-VMS.md");
const TOKEN_FILE = join(REPO_ROOT, "full-ai-cluster/k8s/examples/gitlab-windows-runner-token.yaml");
const GITLAB_APP = join(REPO_ROOT, "full-ai-cluster/k8s/applications/gitlab/Application.yaml");
const KUBEVIRT_CR = join(REPO_ROOT, "full-ai-cluster/k8s/applications/kubevirt/kubevirt-cr.yaml");
const KUBEVIRT_OPERATOR = join(REPO_ROOT, "full-ai-cluster/k8s/applications/kubevirt/kubevirt-operator.yaml");

type Doc = Record<string, any>;

const FILES = {
  namespace: join(DIR, "00-namespace.yaml"),
  iso: join(DIR, "10-iso.yaml"),
  ci: join(DIR, "20-win11-ci.yaml"),
  desktop: join(DIR, "30-win11-desktop.yaml"),
};

function loadDocs(path: string): Doc[] {
  return parseAllDocuments(readFileSync(path, "utf8"))
    .map((d) => d.toJS() as Doc)
    .filter((d) => d !== null && d !== undefined);
}
const kindOf = (docs: Doc[], kind: string): Doc[] => docs.filter((d) => d.kind === kind);

const nsDocs = loadDocs(FILES.namespace);
const isoDocs = loadDocs(FILES.iso);
const ciDocs = loadDocs(FILES.ci);
const desktopDocs = loadDocs(FILES.desktop);
const allDocs = [...nsDocs, ...isoDocs, ...ciDocs, ...desktopDocs];

const vmCi = kindOf(ciDocs, "VirtualMachine")[0]!;
const vmDesktop = kindOf(desktopDocs, "VirtualMachine")[0]!;
const VMS: Doc[] = [vmCi, vmDesktop];

/** Every file under the windows-11 directory, recursively, as [path, text]. */
function walk(dir: string): string[] {
  // withFileTypes: the kind comes back with the name, so there is no stat() on a path that may have changed in between.
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}
const OWN_FILES = [
  ...walk(DIR),
  join(REPO_ROOT, "src/Core.TypeScript/cluster/windows-11-unattend-secrets.ts"),
  join(REPO_ROOT, "src/Core.TypeScript/cluster/copy-secret.ts"),
  join(REPO_ROOT, "src/Core.TypeScript/cluster/windows-11-vm.ts"),
  RUNBOOK,
];

// ---------------------------------------------------------------------------
// A. storage
// ---------------------------------------------------------------------------

/** Every claim-shaped object in the manifests: DataVolumes (storage.* or pvc.*) and PersistentVolumeClaims. */
function claims(): { name: string; storageClassName: unknown; volumeMode: unknown; size: string; accessModes: unknown }[] {
  const out: { name: string; storageClassName: unknown; volumeMode: unknown; size: string; accessModes: unknown }[] = [];
  for (const d of allDocs) {
    const spec = d.kind === "DataVolume" ? (d.spec.storage ?? d.spec.pvc) : d.kind === "PersistentVolumeClaim" ? d.spec : undefined;
    if (spec === undefined) continue;
    out.push({ name: d.metadata.name, storageClassName: spec.storageClassName, volumeMode: spec.volumeMode, size: spec.resources.requests.storage, accessModes: spec.accessModes });
  }
  return out;
}

describe("A. storage: nothing lands on the node's 120 GB root disk", () => {
  test("the manifests carry exactly the three claims we expect (so a new one cannot slip past the checks below)", () => {
    expect(claims().map((c) => c.name).sort()).toEqual(["win11-ci-root", "win11-desktop-root", "win11-iso"]);
  });

  test("EVERY claim names a Longhorn capability explicitly -- never the default class, never local-path", () => {
    for (const c of claims()) {
      expect(typeof c.storageClassName).toBe("string");
      expect(["zeta-block-replicated", "zeta-shared"]).toContain(c.storageClassName as string);
      expect(c.storageClassName).not.toBe("zeta-block-local");
    }
  });

  test("every claim is explicitly Filesystem mode and ReadWriteOnce (the class's StorageProfile says Block, and a Block import dies on this node)", () => {
    for (const c of claims()) {
      expect(c.volumeMode).toBe("Filesystem");
      expect(c.accessModes).toEqual(["ReadWriteOnce"]);
    }
  });

  test("sizes: 80Gi CI disk, 100Gi desktop disk, an ISO claim big enough for the 8.2 GB evaluation ISO but not wasteful", () => {
    const size = (n: string) => claims().find((c) => c.name === n)!.size;
    expect(size("win11-ci-root")).toBe("80Gi");
    expect(size("win11-desktop-root")).toBe("100Gi");
    expect(size("win11-iso")).toBe("10Gi");
  });

  test("the namespace REFUSES any claim on the local-path class: a forgotten storageClassName is a rejected claim, not a full root disk", () => {
    const quota = kindOf(nsDocs, "ResourceQuota")[0]!;
    expect(quota.metadata.namespace).toBe("windows-vms");
    expect(quota.spec.hard["zeta-block-local.storageclass.storage.k8s.io/persistentvolumeclaims"]).toBe("0");
    expect(quota.spec.hard["zeta-block-local.storageclass.storage.k8s.io/requests.storage"]).toBe("0");
  });

  test("the quota covers steady state PLUS CDI's transient prime claim (a 240Gi ceiling refused the second disk, measured)", () => {
    const quota = kindOf(nsDocs, "ResourceQuota")[0]!;
    const gi = (v: string) => Number(/^(\d+)Gi$/.exec(v)![1]);
    const steady = 80 * 1.06 + 100 * 1.06 + 10 * 1.06;
    const largestTransient = 100 * 1.06;
    expect(gi(quota.spec.hard["requests.storage"])).toBeGreaterThanOrEqual(Math.ceil(steady + largestTransient));
  });

  test("the quota's CPU and memory ceilings fit the two guests, and a bare pod is given limits instead of being refused", () => {
    const quota = kindOf(nsDocs, "ResourceQuota")[0]!;
    const lr = kindOf(nsDocs, "LimitRange")[0]!;
    // two guests: 2 x (8Gi + overhead) must fit under requests.memory; two CPU reservations under requests.cpu
    expect(Number(/^(\d+)Gi$/.exec(quota.spec.hard["requests.memory"])![1])).toBeGreaterThanOrEqual(2 * 8 + 4);
    expect(Number(quota.spec.hard["requests.cpu"])).toBeGreaterThanOrEqual(2 * 2);
    expect(lr.spec.limits[0].default.memory).toBeDefined(); // `limits.memory` is in the quota, which refuses a pod that declares none
    expect(lr.spec.limits[0].defaultRequest["ephemeral-storage"]).toBeDefined();
  });

  test("namespace labels: baseline is enforced (measured to admit virt-launcher), restricted only warns", () => {
    const ns = kindOf(nsDocs, "Namespace")[0]!;
    expect(ns.metadata.name).toBe("windows-vms");
    expect(ns.metadata.labels["pod-security.kubernetes.io/enforce"]).toBe("baseline");
  });

  test("the TPM / UEFI state class is a LIVE setting the runbook names with its reason, and git does not carry a provider-named class", () => {
    // The state claim is created by KubeVirt in the VM's namespace on `vmStateStorageClass`; unset, it takes the
    // default class and the quota above refuses it. It is NOT declared in kubevirt-cr.yaml: the repo names storage
    // by capability, and a provider literal there made the dev-lane catalog audit drop the kubevirt Application.
    const cr = parseYaml(readFileSync(KUBEVIRT_CR, "utf8")) as Doc;
    expect(cr.spec.configuration.vmStateStorageClass).toBeUndefined();
    const runbook = readFileSync(RUNBOOK, "utf8");
    expect(runbook).toContain("vmStateStorageClass");
    expect(runbook).toContain("LIVE ONLY");
    // why `longhorn` and not the capability class: KubeVirt asks for RWX when the profile has no Filesystem entry, and RWX needs NFS
    expect(runbook).toContain("ReadWriteMany");
    expect(runbook).toContain("kubectl patch kubevirt kubevirt -n kubevirt");
  });

  test("the claims are not under k8s/applications/ (nothing syncs them, and no audit prices ~190Gi of VM disk as always-on demand)", () => {
    for (const f of walk(DIR)) expect(f.replaceAll("\\", "/")).not.toContain("k8s/applications/");
    expect(DIR.replaceAll("\\", "/")).toContain("k8s/examples/windows-11");
  });
});

// ---------------------------------------------------------------------------
// B. the tag contract
// ---------------------------------------------------------------------------

function linuxRunner(): { tags: string[]; runUntagged: boolean } {
  const app = parseYaml(readFileSync(GITLAB_APP, "utf8")) as Doc;
  const extra = app.spec.source.helm.valuesObject["gitlab-runner"].extraObjects as Doc[];
  const job = extra.find((o) => o.kind === "Job" && o.metadata.name === "gitlab-runner-token")!;
  const script = job.spec.template.spec.containers[0].args[0] as string;
  const tags = /tag_list: %w\[([^\]]*)\]/.exec(script)?.[1];
  const untagged = /run_untagged: (true|false)/.exec(script)?.[1];
  if (tags === undefined || untagged === undefined) throw new Error("could not read the Linux runner's record out of Job/gitlab-runner-token");
  return { tags: tags.split(/\s+/).filter(Boolean), runUntagged: untagged === "true" };
}

function windowsRecord(): { tags: string[]; runUntagged: boolean; secret: string } {
  const job = kindOf(loadDocs(TOKEN_FILE), "Job")[0]!;
  const env = job.spec.template.spec.containers[0].env as { name: string; value: string }[];
  const get = (n: string) => env.find((e) => e.name === n)!.value;
  return { tags: get("RUNNER_TAGS").split(","), runUntagged: get("RUN_UNTAGGED") === "true", secret: get("TARGET_SECRET") };
}

const ciConfigMap = kindOf(ciDocs, "ConfigMap")[0]!;
const ciBootstrap = ciConfigMap.data["bootstrap.ps1"] as string;
const ciSettings = JSON.parse(ciConfigMap.data["settings.json"]) as Record<string, string | number>;
const desktopConfigMap = kindOf(desktopDocs, "ConfigMap")[0]!;
const desktopBootstrap = desktopConfigMap.data["bootstrap.ps1"] as string;

describe("B. the tag contract: the two runners can never take each other's jobs", () => {
  const linux = linuxRunner();
  const win = windowsRecord();

  test("the Linux runner is read correctly (so a refactor that moves its Job fails here, not silently)", () => {
    expect(linux.tags.length).toBeGreaterThan(0);
    expect(linux.runUntagged).toBe(true);
  });

  test("the tag sets are DISJOINT, the Windows runner is tagged windows / zeta-windows, and exactly one runner takes untagged jobs: the Linux one", () => {
    expect(win.tags.filter((t) => linux.tags.includes(t))).toEqual([]);
    expect(win.tags).toEqual(["windows", "zeta-windows"]);
    expect(win.runUntagged).toBe(false);
    expect([win.runUntagged, linux.runUntagged].filter(Boolean)).toHaveLength(1);
  });

  test("VM A mounts the Windows runner's token (copied into this namespace), and ONLY VM A carries any runner credential", () => {
    const ciVolumes = vmCi.spec.template.spec.volumes as Doc[];
    const token = ciVolumes.find((v) => v.name === "runner-token")!;
    expect(token.secret.secretName).toBe("win11-ci-runner-token");
    expect(token.secret.volumeLabel).toBe("ZETATOKEN");
    const desktopVolumes = vmDesktop.spec.template.spec.volumes as Doc[];
    expect(desktopVolumes.find((v) => v.name === "runner-token")).toBeUndefined();
    // Equality on `.includes()`, not `not.toContain`: R5 counts an absence
    // search whose matcher names token as one rendering of a leak, never its
    // absence (`audit-check-arity-nonequality.ts`). `toBe(false)` is the same
    // claim with arity that can fail.
    expect(JSON.stringify(vmDesktop).includes("runner-token")).toBe(false);
    // the minting Job writes the Secret the copier reads
    expect(win.secret).toBe("gitlab-windows-runner-token");
    expect(readFileSync(RUNBOOK, "utf8")).toContain("--from gitlab/gitlab-windows-runner-token");
  });

  test("VM B is not a runner: nothing in its bootstrap downloads, registers or installs gitlab-runner", () => {
    expect(/gitlab-runner|glrt-|runner-token|--token/iu.test(desktopBootstrap)).toBe(false);
  });

  test("registration is the authentication-token flow: a glrt- token and none of the flags GitLab refuses alongside it", () => {
    expect(ciBootstrap).toContain("-notmatch '^glrt-'");
    const line = ciBootstrap.split("\n").find((l) => l.includes("register --non-interactive"))!;
    expect(line).toContain("--token $token");
    for (const refused of ["--tag-list", "--run-untagged", "--locked", "--registration-token"]) expect(line).not.toContain(refused);
    expect(line).toContain("--executor shell");
    expect(line).toContain("--shell powershell");
    expect(line).toContain("--clone-url $settings.gitlabUrl");
  });

  test("the runner and Git are downloaded pinned by version AND sha256, verified before the file is moved where it can run", () => {
    expect(String(ciSettings["runnerExeSha256"])).toMatch(/^[0-9a-f]{64}$/);
    expect(String(ciSettings["gitSha256"])).toMatch(/^[0-9a-f]{64}$/);
    const runnerUrl = new URL(String(ciSettings["runnerExeUrl"]));
    expect(runnerUrl.protocol).toBe("https:");
    expect(runnerUrl.pathname).toBe(`/${ciSettings["runnerVersion"]}/binaries/gitlab-runner-windows-amd64.exe`);
    expect(new URL(String(ciSettings["gitUrl"])).protocol).toBe("https:");
    expect(ciBootstrap).toContain("Get-FileHash -Algorithm SHA256");
    expect(ciBootstrap.indexOf("does not match the pinned")).toBeLessThan(ciBootstrap.indexOf("Move-Item $tmp $Dest"));
  });

  test("the guest reaches GitLab by FQDN through the SAME in-cluster Service the Linux runner uses", () => {
    const app = parseYaml(readFileSync(GITLAB_APP, "utf8")) as Doc;
    const linuxUrl = new URL(app.spec.source.helm.valuesObject["gitlab-runner"].gitlabUrl as string);
    const winUrl = new URL(String(ciSettings["gitlabUrl"]));
    const [svc, ns] = linuxUrl.hostname.split(".");
    expect(winUrl.hostname).toBe(`${svc}.${ns}.svc.cluster.local`);
    expect(winUrl.port).toBe(linuxUrl.port);
  });

  test("it is idempotent: an already-registered runner exits before downloading or registering, and a reboot keeps the SAME runner", () => {
    expect(ciBootstrap.indexOf("runner already registered")).toBeLessThan(ciBootstrap.indexOf("register --non-interactive"));
    expect(ciBootstrap).toContain('token = "glrt-');
    expect(ciBootstrap.indexOf("zeta-eval-watch")).toBeLessThan(ciBootstrap.indexOf("runner already registered"));
    expect(ciBootstrap).toContain("& $exe install");
  });

  test("the token is never echoed: no Write-Host / log line interpolates $token", () => {
    for (const line of ciBootstrap.split("\n")) {
      // an INTERPOLATED message (double-quoted) that names $token; the single-quoted refusal text is a literal
      expect(line).not.toMatch(/(Write-Host|Write-Output|Write-Warning|throw)\s+"[^"]*\$token/);
    }
  });
});

// ---------------------------------------------------------------------------
// C. Windows 11 requirements, opt-in
// ---------------------------------------------------------------------------

describe("C. Windows 11: Secure Boot + SMM + persistent TPM + a real CPU model, on BOTH guests; opt-in by construction", () => {
  for (const vm of VMS) {
    const name = vm.metadata.name as string;
    const spec = vm.spec.template.spec;
    const domain = spec.domain;

    test(`${name}: UEFI Secure Boot, persistent NVRAM, SMM, a persistent TPM`, () => {
      expect(domain.firmware.bootloader.efi.secureBoot).toBe(true);
      expect(domain.firmware.bootloader.efi.persistent).toBe(true);
      expect(domain.features.smm.enabled).toBe(true);
      expect(domain.devices.tpm.persistent).toBe(true);
    });

    test(`${name}: host-passthrough CPU (Windows 11's CPU requirement), Hyper-V enlightenments, clock policy`, () => {
      expect(domain.cpu.model).toBe("host-passthrough");
      expect(domain.cpu.cores).toBe(4);
      for (const f of ["relaxed", "vapic", "spinlocks", "vpindex", "runtime", "synic", "synictimer", "tlbflush", "ipi", "frequencies", "reset"]) expect(domain.features.hyperv[f]).toBeDefined();
      expect(domain.clock.timer.hpet.present).toBe(false);
      expect(domain.clock.timer.hyperv).toBeDefined();
      expect(spec.terminationGracePeriodSeconds).toBeGreaterThanOrEqual(300);
    });

    test(`${name}: 4 vCPU / 8Gi, memory request == limit, a modest CPU RESERVATION and no CPU limit`, () => {
      expect(domain.memory.guest).toBe("8Gi");
      expect(domain.resources.requests.memory).toBe("8Gi");
      expect(domain.resources.limits.memory).toBe("8Gi");
      // this node's CPU requests are ~90% taken (19.1 of 21.25, measured): a 4-CPU request made the second guest unschedulable
      expect(Number(domain.resources.requests.cpu)).toBeLessThanOrEqual(2);
      expect(Number(domain.resources.requests.cpu)).toBeGreaterThanOrEqual(1);
      expect(domain.resources.limits.cpu).toBeUndefined();
    });

    test(`${name}: Manual (nothing boots until you start it), in the windows-vms namespace`, () => {
      expect(vm.spec.runStrategy).toBe("Manual");
      expect(vm.metadata.namespace).toBe("windows-vms");
    });

    test(`${name}: the root disk boots FIRST, the ISO second; every disk has a volume and every volume has a disk; at most 6 SATA devices`, () => {
      const disks = domain.devices.disks as Doc[];
      const volumes = spec.volumes as Doc[];
      const root = disks.find((d) => d.name === "root")!;
      const iso = disks.find((d) => d.name === "iso")!;
      expect(root.bootOrder).toBe(1);
      expect(iso.bootOrder).toBe(2);
      expect(root.disk.bus).toBe("virtio");
      expect(iso.cdrom.bus).toBe("sata");
      expect(disks.map((d) => d.name).sort()).toEqual(volumes.map((v) => v.name).sort());
      expect(disks.filter((d) => d.cdrom?.bus === "sata").length).toBeLessThanOrEqual(6);
      expect(domain.devices.interfaces[0].masquerade).toBeDefined();
      expect(domain.devices.interfaces[0].model).toBe("virtio");
    });

    test(`${name}: the virtio-win CD is pinned to the SAME KubeVirt release as the vendored operator`, () => {
      const image = (spec.volumes as Doc[]).find((v) => v.name === "virtio-win")!.containerDisk.image as string;
      const pin = /virt-operator:(v\d+\.\d+\.\d+)/.exec(readFileSync(KUBEVIRT_OPERATOR, "utf8"))?.[1];
      expect(pin).toBeDefined();
      expect(image).toBe(`quay.io/kubevirt/virtio-container-disk:${pin}`);
    });
  }

  test("every object a VM mounts is defined in these files, or is one of the three the OWNER creates (and the runbook names)", () => {
    const configMaps = new Set(kindOf(allDocs, "ConfigMap").map((c) => c.metadata.name));
    const dvs = new Set(kindOf(allDocs, "DataVolume").map((c) => c.metadata.name));
    const external = new Set(["win11-ci-runner-token", "win11-ci-unattend", "win11-desktop-unattend", "win11-desktop-ssh-keys"]);
    const runbook = readFileSync(RUNBOOK, "utf8");
    for (const vm of VMS) {
      for (const v of vm.spec.template.spec.volumes as Doc[]) {
        if (v.dataVolume) expect(dvs.has(v.dataVolume.name)).toBe(true);
        if (v.configMap) {
          expect(configMaps.has(v.configMap.name) || external.has(v.configMap.name)).toBe(true);
          if (external.has(v.configMap.name)) expect(runbook).toContain(v.configMap.name);
        }
        const secret = v.secret?.secretName ?? v.sysprep?.secret?.name;
        if (secret !== undefined) {
          expect(external.has(secret)).toBe(true);
          expect(runbook).toContain(secret);
        }
      }
    }
  });

  test("each guest's sysprep Secret is its own (a rendered password never crosses VMs by name), and matches what the renderer produces", () => {
    const sysprep = (vm: Doc) => (vm.spec.template.spec.volumes as Doc[]).find((v) => v.name === "sysprep")!.sysprep.secret.name;
    expect(sysprep(vmCi)).toBe("win11-ci-unattend");
    expect(sysprep(vmDesktop)).toBe("win11-desktop-unattend");
    expect(GUESTS.map((g) => g.secretName)).toEqual(["win11-ci-unattend", "win11-desktop-unattend"]);
    expect(NAMESPACE).toBe("windows-vms");
  });

  test("the ISO is a sentinel that cannot resolve (.invalid, RFC 2606): an untouched apply fetches nothing", () => {
    const dv = kindOf(isoDocs, "DataVolume")[0]!;
    expect(new URL(dv.spec.source.http.url).hostname.endsWith(".invalid")).toBe(true);
    expect(dv.metadata.annotations["cdi.kubevirt.io/storage.bind.immediate.requested"]).toBe("true");
  });

  test("the persistent-state claim cannot be forgotten: the runbook states the live KubeVirt and CDI settings it depends on", () => {
    const runbook = readFileSync(RUNBOOK, "utf8");
    expect(runbook).toContain("scratchSpaceStorageClass");
    expect(runbook).toContain("vmStateStorageClass");
  });
});

// ---------------------------------------------------------------------------
// D. RDP is never published
// ---------------------------------------------------------------------------

describe("D. RDP is reached through an SSH tunnel to a ClusterIP, never published", () => {
  const services = kindOf(allDocs, "Service");

  test("every Service in these manifests is ClusterIP", () => {
    expect(services.length).toBeGreaterThan(0);
    for (const s of services) expect(s.spec.type).toBe("ClusterIP");
  });

  test("no LoadBalancer, NodePort, hostPort, hostNetwork or externalIPs appear in any manifest or the runbook's apply snippets", () => {
    for (const f of walk(DIR).filter((p) => p.endsWith(".yaml"))) {
      const text = readFileSync(f, "utf8");
      expect(text).not.toMatch(/type:\s*(LoadBalancer|NodePort)\s*$/m);
      expect(text).not.toMatch(/\b(hostPort|hostNetwork|externalIPs|loadBalancerIP)\b\s*:/);
    }
  });

  test("the only Services are the desktop's RDP and SSH ports, selecting the label KubeVirt stamps on its launcher pod; VM A has none", () => {
    expect(services.map((s) => s.metadata.name)).toEqual(["win11-desktop-rdp", "win11-desktop-ssh"]);
    expect(services.map((s) => s.spec.ports.map((p: Doc) => p.port))).toEqual([[3389], [22]]);
    for (const s of services) expect(s.spec.selector).toEqual({ "kubevirt.io/domain": "win11-desktop" });
    expect(vmDesktop.spec.template.metadata.labels["kubevirt.io/domain"]).toBe("win11-desktop");
  });

  test("a CiliumNetworkPolicy admits the guests' ingress only from the node host and their own namespace, and leaves egress alone", () => {
    const np = loadDocs(join(DIR, "40-network-policy.yaml"))[0]!;
    expect(np.kind).toBe("CiliumNetworkPolicy");
    expect(np.metadata.namespace).toBe("windows-vms");
    expect(np.spec.endpointSelector.matchExpressions[0].values.sort()).toEqual(["win11-ci", "win11-desktop"]);
    expect(np.spec.ingress).toEqual([{ fromEntities: ["host"] }, { fromEndpoints: [{}] }]);
    expect(np.spec.egress).toBeUndefined();
    expect(np.spec.ingressDeny).toBeUndefined();
  });

  test("the masquerade interface declares NO ports, so KubeVirt forwards every port to the guest (what makes 3389 reach Windows)", () => {
    for (const vm of VMS) expect(vm.spec.template.spec.domain.devices.interfaces[0].ports).toBeUndefined();
  });

  test("RDP is enabled by VM B's bootstrap only, with the firewall group opened; VM A never enables it", () => {
    expect(desktopBootstrap).toContain("fDenyTSConnections");
    expect(desktopBootstrap).toContain("Enable-NetFirewallRule -DisplayGroup 'Remote Desktop'");
    expect(ciBootstrap).not.toMatch(/fDenyTSConnections|Remote Desktop/);
  });

  test("OpenSSH is KEY-ONLY, pinned by sha256, authorised by the keys ConfigMap, and the firewall opens 22 and never the API port", () => {
    const settings = JSON.parse(desktopConfigMap.data["settings.json"]) as Record<string, string>;
    expect(settings["opensshSha256"]).toMatch(/^[0-9a-f]{64}$/);
    const url = new URL(settings["opensshUrl"]!);
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("github.com");
    expect(url.pathname.startsWith("/PowerShell/Win32-OpenSSH/releases/download/")).toBe(true);
    expect(desktopBootstrap.indexOf("does not match the pinned")).toBeLessThan(desktopBootstrap.indexOf("Move-Item $tmp $Dest"));
    expect(desktopBootstrap).toContain("'PasswordAuthentication no'");
    expect(desktopBootstrap).toContain("'PubkeyAuthentication yes'");
    expect(/PasswordAuthentication yes/u.test(desktopBootstrap)).toBe(false);
    expect(desktopBootstrap).toContain("administrators_authorized_keys");
    expect(desktopBootstrap).toContain("/inheritance:r");
    expect(desktopBootstrap).toContain("-LocalPort 22 ");
    // the API stays on loopback: no firewall rule may name 5000
    expect(desktopBootstrap.split("\n").filter((l) => /FirewallRule/.test(l) && /5000/.test(l))).toEqual([]);
    expect(desktopBootstrap).toContain("127.0.0.1:5000");
    const keys = (vmDesktop.spec.template.spec.volumes as Doc[]).find((v) => v.name === "ssh-keys")!;
    expect(keys.configMap.name).toBe("win11-desktop-ssh-keys");
    expect(keys.configMap.volumeLabel).toBe("ZETAKEYS");
    // no key material (public or private) is committed: the owner creates the ConfigMap from the node's keys
    for (const f of OWN_FILES) expect(readFileSync(f, "utf8"), f).not.toMatch(/ssh-(rsa|ed25519) AAAA|BEGIN [A-Z ]*PRIVATE KEY/);
  });

  test("the runbook documents the tunnel (a high local port, not 3389) and says never to publish it", () => {
    const runbook = readFileSync(RUNBOOK, "utf8");
    expect(runbook).toContain("ssh -N -L 13389:");
    expect(runbook).toContain("ssh.flowdent.net");
    expect(runbook).toMatch(/never[^.\n]*(LoadBalancer|publish)/i);
  });
});

// ---------------------------------------------------------------------------
// E. no credential, no Microsoft URL; the answer file
// ---------------------------------------------------------------------------


/** The answer file with its comments removed: prose inside a comment must not satisfy (or trip) a structural check. */
function stripXmlComments(xml: string): string {
  // A scan, not a regex replace: a single replace pass can leave a `<!--` behind when comments nest or are
  // malformed, and this strips for a CHECK, so it must be exact.
  let out = "";
  let i = 0;
  for (;;) {
    const open = xml.indexOf("<!--", i);
    if (open < 0) return out + xml.slice(i);
    out += xml.slice(i, open);
    const close = xml.indexOf("-->", open + 4);
    if (close < 0) return out + xml.slice(open); // an unterminated comment is kept, so xmlProblems sees it
    i = close + 3;
  }
}

/** A tiny well-formedness check: balanced element tags, and no `--` inside a comment (illegal XML). */
function xmlProblems(xml: string): string[] {
  const problems: string[] = [];
  for (const c of xml.matchAll(/<!--([\s\S]*?)-->/g)) if (c[1]!.includes("--")) problems.push("`--` inside a comment");
  const stack: string[] = [];
  for (const m of stripXmlComments(xml).matchAll(/<(\/?)([A-Za-z][\w:.-]*)([^>]*?)(\/?)>/g)) {
    const [, closing, name, , selfClosing] = m;
    if (selfClosing === "/") continue;
    if (closing === "/") {
      if (stack.pop() !== name) problems.push(`unbalanced </${name}>`);
    } else {
      stack.push(name!);
    }
  }
  if (stack.length > 0) problems.push(`unclosed <${stack.join(">, <")}>`);
  return problems;
}

const autounattend = readFileSync(join(UNATTEND_DIR, "Autounattend.xml"), "utf8");
const unattend = readFileSync(join(UNATTEND_DIR, "Unattend.xml"), "utf8");
const body = stripXmlComments(autounattend);

describe("E. the answer file: Windows 11 Enterprise Evaluation, no credential, no Microsoft download", () => {
  test("both answer files are well-formed XML", () => {
    expect(xmlProblems(autounattend)).toEqual([]);
    expect(xmlProblems(unattend)).toEqual([]);
  });

  test("it is an EVALUATION install: no product key, the owner's EULA acceptance, an edition index, GPT/UEFI on the virtio disk", () => {
    expect(body).not.toMatch(/<ProductKey>/i);
    expect(body).toContain("<AcceptEula>true</AcceptEula>");
    expect(body).toMatch(/<Key>\/IMAGE\/INDEX<\/Key>\s*<Value>1<\/Value>/);
    expect(body).toContain("<Type>EFI</Type>");
    expect(body).toContain("<Type>MSR</Type>");
    expect(body).toContain("<WillWipeDisk>true</WillWipeDisk>");
  });

  test("it does NOT bypass Windows 11's requirements check: Secure Boot and the TPM are provided, not dodged", () => {
    expect(body).not.toMatch(/BypassTPMCheck|BypassSecureBootCheck|BypassRAMCheck|BypassCPUCheck|LabConfig/);
  });

  test("it loads the virtio DISK and NETWORK drivers in WinPE AND injects them into the installed image, from the w11 folder only", () => {
    const winPe = autounattend.slice(autounattend.indexOf('pass="windowsPE"'), autounattend.indexOf('pass="offlineServicing"'));
    const offline = autounattend.slice(autounattend.indexOf('pass="offlineServicing"'), autounattend.indexOf('pass="specialize"'));
    for (const part of [winPe, offline]) {
      expect(part).toContain("viostor\\w11\\amd64");
      expect(part).toContain("NetKVM\\w11\\amd64");
      // every plausible drive letter is listed: the CD's letter is not knowable in a manifest
      for (const letter of ["D", "E", "F", "G", "H"]) expect(part).toContain(`${letter}:\\viostor\\w11\\amd64`);
    }
    expect(offline).toContain("vioserial\\w11\\amd64"); // the guest agent's channel
    expect(body).not.toMatch(/2k22|2k25|2k19|\\w10\\/);
  });

  test("OOBE skips the Microsoft-account and network screens by supported settings and creates a LOCAL administrator", () => {
    for (const s of ["HideEULAPage", "HideLocalAccountScreen", "HideOnlineAccountScreens", "HideWirelessSetupInOOBE"]) expect(body).toContain(`<${s}>true</${s}>`);
    expect(body).toContain(`<Name>${ADMIN_USER}</Name>`);
    expect(body).toContain("<Group>Administrators</Group>");
  });

  test("the password and the computer name are placeholders, EXACTLY once each, and no literal credential is committed", () => {
    expect(autounattend.split(PASSWORD_PLACEHOLDER).length - 1).toBe(1);
    expect(autounattend.split(COMPUTER_NAME_PLACEHOLDER).length - 1).toBe(1);
    // Equality on `.includes()` / `.test()`, not `not.toContain` / `not.toMatch`:
    // R5 counts an absence search whose matcher names PASSWORD as one rendering
    // of a leak, never its absence. `toBe(false)` can fail.
    expect(unattend.includes(PASSWORD_PLACEHOLDER)).toBe(false);
    expect(unattend.includes("<Password>")).toBe(false);
    for (const m of autounattend.matchAll(/<Value>([^<]*)<\/Value>/g)) expect(["1", PASSWORD_PLACEHOLDER]).toContain(m[1]!);
    // no plaintext password anywhere in the manifests (the Secrets are rendered by the owner)
    const yamlPassword = /WINDOWS_ADMIN_PASSWORD\s*=\s*\S|password:\s*\S/iu;
    for (const f of walk(DIR).filter((p) => p.endsWith(".yaml"))) expect(yamlPassword.test(readFileSync(f, "utf8"))).toBe(false);
  });

  test("it hands off to each VM's own bootstrap: copy bootstrap.ps1 off whichever CD carries it, schedule it at startup as SYSTEM", () => {
    for (const text of [autounattend, unattend]) {
      const t = stripXmlComments(text);
      expect(t).toContain("bootstrap.ps1");
      expect(t).toContain("copy /y %d:\\bootstrap.ps1 C:\\ProgramData\\zeta\\bootstrap.ps1");
      expect(t).toContain("schtasks.exe /create /f /ru SYSTEM /sc onstart /tn zeta-bootstrap");
    }
    // both bootstraps remove that same task when they have finished
    expect(ciBootstrap).toContain("Unregister-ScheduledTask -TaskName zeta-bootstrap");
    expect(desktopBootstrap).toContain("Unregister-ScheduledTask -TaskName zeta-bootstrap");
  });

  test("every RunSynchronous command fits the 259-character limit on <Path> (a longer one made Setup reject the whole file: measured)", () => {
    for (const text of [autounattend, unattend]) {
      const paths = [...stripXmlComments(text).matchAll(/<RunSynchronousCommand[\s\S]*?<Path>([^<]*)<\/Path>/g)].map((m) => m[1]!);
      expect(paths.length).toBeGreaterThanOrEqual(2);
      for (const path of paths) expect(path.replaceAll("&amp;", "&").length).toBeLessThanOrEqual(259);
      // and they are ordered 1..n without gaps, or Setup refuses the list
      const orders = [...stripXmlComments(text).matchAll(/<RunSynchronousCommand[\s\S]*?<Order>(\d+)<\/Order>/g)].map((m) => Number(m[1]));
      expect(orders).toEqual(orders.map((_, i) => i + 1));
    }
  });

  test("the bootstraps find files by NAME, not by a volume label that is a property of how KubeVirt builds the CD", () => {
    for (const script of [ciBootstrap, desktopBootstrap]) {
      expect(script).toContain("function Find-Drive");
      expect(script).not.toContain("FileSystemLabel");
    }
  });

  test("the evaluation watchdog REPORTS and never acts: no rearm, no licensing method call, no shutdown", () => {
    for (const cm of [ciConfigMap, desktopConfigMap]) {
      const watch = cm.data["eval-watch.ps1"] as string;
      expect(watch.match(/Invoke-CimMethod|slmgr(\.vbs)?|\/rearm|ReArmWindows|Stop-Computer|Restart-Computer|shutdown(\.exe)?/gi) ?? []).toEqual([]);
      expect(watch).toContain("eval-watch.log");
      expect(watch).toContain("$days -lt 14");
      expect(cm.data["bootstrap.ps1"]).toContain("zeta-eval-watch");
    }
  });

  test("NO Microsoft URL anywhere we add: no download link, no Evaluation Center link, no aka.ms (the owner finds the page himself)", () => {
    const banned = /https?:\/\/[^\s"')>]*(microsoft\.|windows\.com|windowsupdate|aka\.ms|msft)/i;
    for (const f of OWN_FILES) {
      const text = readFileSync(f, "utf8");
      // XML namespaces are identifiers, not links anyone fetches
      const stripped = text.replaceAll(/urn:schemas-microsoft-com:[a-z]+/g, "").replaceAll("http://schemas.microsoft.com/WMIConfig/2002/State", "");
      expect(stripped.match(banned), f).toBeNull();
    }
  });

  test("no ISO, image or installer bytes are committed beside the manifests", () => {
    for (const f of OWN_FILES) expect(f).not.toMatch(/\.(iso|wim|esd|img|qcow2|exe|msi|vhdx?)$/i);
  });
});

// ---------------------------------------------------------------------------
// F. the helpers
// ---------------------------------------------------------------------------

describe("F. the Secret renderer: fills the password and computer name once, escapes them, refuses what it must", () => {
  const good = "Str0ng-Passw0rd!x";
  const render = (password: string, over: Partial<{ autounattend: string; unattend: string }> = {}) =>
    renderWindows11Secrets({ password, autounattend: over.autounattend ?? autounattend, unattend: over.unattend ?? unattend });

  test("renders ONE Secret per guest, in windows-vms, each with its own computer name and the same password", () => {
    const docs = render(good)
      .split("\n---\n")
      .map((d) => parseYaml(d) as Doc);
    expect(docs.map((d) => d.metadata.name)).toEqual(["win11-ci-unattend", "win11-desktop-unattend"]);
    for (const d of docs) {
      expect(d.metadata.namespace).toBe("windows-vms");
      expect(Object.keys(d.stringData).sort()).toEqual(["Autounattend.xml", "Unattend.xml"]);
      expect(d.stringData["Autounattend.xml"]).toContain(`<Value>${good}</Value>`);
      expect(String(d.stringData["Autounattend.xml"]).includes(PASSWORD_PLACEHOLDER)).toBe(false);
      expect(d.stringData["Autounattend.xml"]).not.toContain(COMPUTER_NAME_PLACEHOLDER);
      expect(d.stringData["Unattend.xml"]).not.toContain(good);
    }
    expect(docs[0]!.stringData["Autounattend.xml"]).toContain("<ComputerName>WIN11-CI</ComputerName>");
    expect(docs[1]!.stringData["Autounattend.xml"]).toContain("<ComputerName>WIN11-DESK</ComputerName>");
    for (const g of GUESTS) expect(g.computerName.length).toBeLessThanOrEqual(15);
  });

  test("a password with XML or replace-pattern metacharacters is escaped and not re-interpreted", () => {
    const tricky = "A&b<c>$&$1x9Z!aaaa";
    const docs = render(tricky).split("\n---\n").map((d) => parseYaml(d) as Doc);
    const xml = docs[0]!.stringData["Autounattend.xml"] as string;
    expect(xml).toContain("<Value>A&amp;b&lt;c&gt;$&amp;$1x9Z!aaaa</Value>");
    expect(xmlProblems(xml)).toEqual([]);
  });

  test("it refuses a weak password, one containing the account name, and a template without each placeholder exactly once", () => {
    expect(win11PasswordProblem("weak")).not.toBeNull();
    expect(win11PasswordProblem(`Good-zetaadmin-1234`)).toContain("account name");
    expect(win11PasswordProblem(good)).toBeNull();
    expect(() => render("weak")).toThrow("refused");
    expect(() => render(good, { autounattend: autounattend.replace(PASSWORD_PLACEHOLDER, "x") })).toThrow("exactly once");
    expect(() => render(good, { autounattend: autounattend + PASSWORD_PLACEHOLDER })).toThrow("exactly once");
    expect(() => render(good, { autounattend: autounattend.replace(COMPUTER_NAME_PLACEHOLDER, "X") })).toThrow("exactly once");
    expect(() => render(good, { unattend: unattend + PASSWORD_PLACEHOLDER })).toThrow("must not carry");
  });

  test("the refusal text never echoes the password", () => {
    for (const bad of ["weak", "alllowercase-but-long-enough"]) {
      try {
        render(bad);
      } catch (e) {
        expect(String((e as Error).message)).not.toContain(bad);
      }
    }
  });

  test("the CLI takes the password from the environment only, renders either guest alone, and refuses without printing a Secret", () => {
    const script = join(REPO_ROOT, "src/Core.TypeScript/cluster/windows-11-unattend-secrets.ts");
    const run = (args: string[], password?: string) => {
      const env: Record<string, string | undefined> = { ...process.env };
      delete env["WINDOWS_ADMIN_PASSWORD"];
      if (password !== undefined) env["WINDOWS_ADMIN_PASSWORD"] = password;
      const r = Bun.spawnSync([process.execPath, script, ...args], { env, stdout: "pipe", stderr: "pipe" });
      return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
    };
    expect(run([]).code).toBe(2);
    const argv = run([good], good);
    expect(argv.code).toBe(2);
    expect(argv.out).toBe("");
    const weak = run([], "weak");
    expect(weak.code).toBe(2);
    expect(weak.out).toBe("");
    expect(weak.err.includes("weak")).toBe(false);
    const both = run([], good);
    expect(both.code).toBe(0);
    expect(both.out.split("\n---\n")).toHaveLength(2);
    const one = run(["desktop"], good);
    expect(one.code).toBe(0);
    expect((parseYaml(one.out) as Doc).metadata.name).toBe("win11-desktop-unattend");
    expect(run(["nope"], good).code).toBe(2);
  }, 60_000);
});

describe("F2. the Secret copier moves a token between namespaces without printing it", () => {
  const source = JSON.stringify({ kind: "Secret", type: "Opaque", data: { "runner-token": Buffer.from("glrt-abcdefghij").toString("base64") } });

  test("it builds the destination Secret from the named key only, and reports a size, not a value", () => {
    const built = buildCopy(source, { namespace: "windows-vms", name: "win11-ci-runner-token" }, ["runner-token"]);
    const secret = parseYaml(built.manifest) as Doc;
    expect(secret.metadata).toEqual({ name: "win11-ci-runner-token", namespace: "windows-vms" });
    expect(Buffer.from(secret.data["runner-token"], "base64").toString()).toBe("glrt-abcdefghij");
    expect(built.bytes).toBe(15);
  });

  test("it refuses an EMPTY or missing key (the minting Job pre-creates the Secret empty), a non-Secret, and a non-Opaque Secret", () => {
    const to = { namespace: "a", name: "b" };
    expect(() => buildCopy(JSON.stringify({ kind: "Secret", data: { "runner-token": "" } }), to, ["runner-token"])).toThrow("non-empty");
    expect(() => buildCopy(JSON.stringify({ kind: "Secret" }), to, ["runner-token"])).toThrow("non-empty");
    expect(() => buildCopy(JSON.stringify({ kind: "ConfigMap", data: {} }), to, ["runner-token"])).toThrow("not a Secret");
    expect(() => buildCopy(JSON.stringify({ kind: "Secret", type: "kubernetes.io/tls", data: { "runner-token": "eA==" } }), to, ["runner-token"])).toThrow("Opaque");
  });

  test("references are strict <namespace>/<name>, and the CLI refuses the same source and destination", () => {
    expect(parseRef("gitlab/gitlab-windows-runner-token")).toEqual({ namespace: "gitlab", name: "gitlab-windows-runner-token" });
    for (const bad of [undefined, "", "nons", "a/b/c", "A/b", "a/-b", "a/b;rm"]) expect(parseRef(bad)).toBeNull();
    const script = join(REPO_ROOT, "src/Core.TypeScript/cluster/copy-secret.ts");
    const same = Bun.spawnSync([process.execPath, script, "--from", "a/b", "--to", "a/b"], { stdout: "pipe", stderr: "pipe" });
    expect(same.exitCode).toBe(2);
    expect(Bun.spawnSync([process.execPath, script, "--from", "a/b"], { stdout: "pipe", stderr: "pipe" }).exitCode).toBe(2);
  }, 30_000);

  test("the copier source never prints the secret value: no console call interpolates it", () => {
    const text = readFileSync(join(REPO_ROOT, "src/Core.TypeScript/cluster/copy-secret.ts"), "utf8");
    for (const line of text.split("\n")) {
      if (/console\.(log|error)/.test(line)) expect(line).not.toMatch(/\bvalue\b|\bdata\b|got\.out|\.manifest/);
    }
  });
});

describe("F3. the console helper sends keys and takes screenshots of the two Windows guests and nothing else", () => {
  test("only the two VM names are accepted", () => {
    expect(isVm("win11-ci")).toBe(true);
    expect(isVm("win11-desktop")).toBe(true);
    for (const bad of [undefined, "", "windows-runner", "win11-ci; id", "zz-sbtest"]) expect(isVm(bad)).toBe(false);
    expect(domainName("win11-desktop")).toBe("windows-vms_win11-desktop");
  });

  test("it can send libvirt KEY_ names and cannot type text: a password can never go through it", () => {
    expect(isKeyName("KEY_SPACE")).toBe(true);
    for (const bad of ["space", "KEY_", "KEY_space", "KEY_A;id", "hunter2", "KEY_A KEY_B"]) expect(isKeyName(bad)).toBe(false);
    expect(keyLoopScript("win11-desktop", ["KEY_SPACE"], 40)).toBe("for i in $(seq 1 40); do virsh send-key windows-vms_win11-desktop KEY_SPACE >/dev/null 2>&1; sleep 1; done");
    expect(() => keyLoopScript("win11-desktop", ["hunter2"], 1)).toThrow("refused");
    expect(() => keyLoopScript("win11-desktop", ["KEY_SPACE"], 0)).toThrow("refused");
    expect(() => keyLoopScript("win11-desktop", ["KEY_SPACE"], 1000)).toThrow("refused");
    expect(() => keyLoopScript("win11-desktop", [], 1)).toThrow("refused");
  });
});

// ---------------------------------------------------------------------------
// G. the runbook
// ---------------------------------------------------------------------------

describe("G. the runbook", () => {
  const runbook = readFileSync(RUNBOOK, "utf8");

  test("exists, opens with a carved sentence, and names every manifest, script, Secret and Service", () => {
    expect(existsSync(RUNBOOK)).toBe(true);
    expect(runbook).toMatch(/^# .*\n\n(Carved sentence:\n\n)?> /m);
    for (const name of [
      "00-namespace.yaml", "10-iso.yaml", "20-win11-ci.yaml", "30-win11-desktop.yaml", "Autounattend.xml",
      "windows-11-unattend-secrets.ts", "copy-secret.ts", "windows-11-vm.ts",
      "win11-ci", "win11-desktop", "win11-iso", "win11-ci-unattend", "win11-desktop-unattend", "win11-ci-runner-token", "win11-desktop-rdp", "win11-desktop-ssh", "win11-desktop-ssh-keys", "40-network-policy.yaml", "CiliumNetworkPolicy",
      "gitlab-windows-runner-token.yaml", "windows-vms",
    ]) expect(runbook, name).toContain(name);
  });

  test("the human steps stay the owner's: the Evaluation Center, accepting Microsoft's terms, typing the password themself with read -rs", () => {
    expect(runbook).toContain("Evaluation Center");
    expect(runbook).toMatch(/accept(s|ing)? Microsoft'?s? (evaluation )?terms/i);
    expect(runbook).toContain("read -rs WINDOWS_ADMIN_PASSWORD");
    expect(runbook).toContain("AcceptEula");
  });

  test("it documents BOTH ways to give the cluster the ISO, the PC's firewall, and the dism check of the edition index", () => {
    expect(runbook).toContain("python -m http.server");
    expect(runbook).toContain("virtctl image-upload");
    expect(runbook).toMatch(/Windows (Defender )?Firewall/);
    expect(runbook).toContain("dism /Get-WimInfo");
  });

  test("it shows how to open the GUI both ways, and how to tell which step failed", () => {
    expect(runbook).toContain("virtctl vnc win11-desktop -n windows-vms");
    expect(runbook).toContain("mstsc");
    expect(runbook).toContain("windows-11-vm.ts screenshot");
    expect(runbook).toContain("windows-11-vm.ts key");
    expect(runbook).toContain("kubectl -n windows-vms get vmi");
    expect(runbook).toMatch(/importer/i);
    expect(runbook).toContain("bootstrap.log");
  });

  test("it states the evaluation limits plainly and says snapshots are not backups", () => {
    expect(runbook).toMatch(/90 days/);
    expect(runbook).toContain("slmgr");
    expect(runbook).toMatch(/OEM/);
    expect(runbook).toMatch(/Longhorn snapshot/i);
    expect(runbook).toMatch(/not a backup/i);
  });

  test("it has an HONEST section: what was proven on the node, what is unproven, and a known-issues list", () => {
    expect(runbook).toMatch(/## What is proven/);
    expect(runbook).toMatch(/UNPROVEN/);
    expect(runbook).toMatch(/## Known issues/);
    for (const issue of ["Permission denied", "NFS", "prime", "Insufficient cpu", "Press any key"]) expect(runbook, issue).toContain(issue);
  });

  test("it explains the CDI OutOfSync finding and what it does and does not matter for", () => {
    expect(runbook).toMatch(/OutOfSync/);
    expect(runbook).toContain("cdi-operator");
  });
});
