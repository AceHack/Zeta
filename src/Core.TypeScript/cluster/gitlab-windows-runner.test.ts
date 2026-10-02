/**
 * gitlab-windows-runner.test.ts -- falsifiers for the opt-in Windows GitLab runner path:
 *
 *   full-ai-cluster/k8s/examples/gitlab-windows-runner-token.yaml   (mints the runner record + token Secret)
 *   full-ai-cluster/k8s/examples/kubevirt-windows-gitlab-runner.yaml (the KubeVirt guest that registers it)
 *   docs/ops/WINDOWS-GITLAB-RUNNER.md                                (the runbook)
 *
 *   A. THE TAG CONTRACT -- the Windows runner and the Linux runner (applications/gitlab/Application.yaml)
 *      must never be able to take each other's jobs: disjoint tag sets, exactly one of them takes
 *      untagged jobs, and it is the Linux one. Read from the two sources, not restated here.
 *   B. THE TOKEN JOB, EXECUTED -- its script is pulled out of the manifest and RUN against a stub
 *      `kubectl`, so what it sends to Rails (the runner's tags / run_untagged), what it writes (one
 *      Secret key), what it prints (never the token) and how it fails (loudly, exit 1) are observed.
 *   C. THE GUEST SPEC -- internal consistency of the VM, its volumes and the bootstrap it carries, and
 *      its consistency with the tree (storage capability, KubeVirt release, placement outside
 *      k8s/applications/, opt-in by construction).
 *   D. THE RUNBOOK names every file and Secret the manifests define, so it cannot drift from them.
 *
 * WHAT THIS CANNOT PROVE (recorded in the runbook too): that `Ci::Runners::CreateRunnerService` accepts
 * these params on GitLab 17.7 (the Linux Job proves the instance_type path live; the params differ here
 * only in tags/run_untagged), that KubeVirt accepts the volume shapes (the server-side dry-run in
 * kubevirt-vm-live-test.ts is the authority, run in the `live-kind-virt` job), or that a Windows guest
 * boots, runs bootstrap.ps1 and registers -- no Windows image exists in CI.
 */

import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { parseAllDocuments, parse as parseYaml } from "yaml";
import { STORAGE_CAPABILITIES } from "./storage-capabilities.ts";
import { passwordProblem, PASSWORD_PLACEHOLDER, renderUnattendSecret, SECRET_NAME, SECRET_NAMESPACE, xmlEscape } from "./windows-runner-unattend-secret.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const EXAMPLES = join(REPO_ROOT, "full-ai-cluster/k8s/examples");
const TOKEN_FILE = join(EXAMPLES, "gitlab-windows-runner-token.yaml");
const VM_FILE = join(EXAMPLES, "kubevirt-windows-gitlab-runner.yaml");
const GITLAB_APP = join(REPO_ROOT, "full-ai-cluster/k8s/applications/gitlab/Application.yaml");
const RUNBOOK = join(REPO_ROOT, "docs/ops/WINDOWS-GITLAB-RUNNER.md");
const UNATTEND_DIR = join(EXAMPLES, "windows-runner-unattend");

type Doc = Record<string, any>;

function loadDocs(path: string): Doc[] {
  return parseAllDocuments(readFileSync(path, "utf8"))
    .map((d) => d.toJS() as Doc)
    .filter((d) => d !== null && d !== undefined);
}
const kindOf = (docs: Doc[], kind: string): Doc[] => docs.filter((d) => d.kind === kind);

const tokenDocs = loadDocs(TOKEN_FILE);
const vmDocs = loadDocs(VM_FILE);

// ---------------------------------------------------------------------------
// The two sources of the tag contract
// ---------------------------------------------------------------------------

function windowsJob(): Doc {
  return kindOf(tokenDocs, "Job")[0]!;
}
function windowsEnv(name: string): string {
  const env = windowsJob().spec.template.spec.containers[0].env as { name: string; value: string }[];
  const hit = env.find((e) => e.name === name);
  if (!hit) throw new Error(`token Job has no env ${name}`);
  return hit.value;
}
function windowsScript(): string {
  return windowsJob().spec.template.spec.containers[0].args[0] as string;
}

/** The Linux runner's record, as the in-cluster Job in the GitLab Application creates it. */
function linuxRunner(): { tags: string[]; runUntagged: boolean; description: string; secret: string; image: string } {
  const app = parseYaml(readFileSync(GITLAB_APP, "utf8")) as Doc;
  const extra = app.spec.source.helm.valuesObject["gitlab-runner"].extraObjects as Doc[];
  const job = extra.find((o) => o.kind === "Job" && o.metadata.name === "gitlab-runner-token")!;
  const container = job.spec.template.spec.containers[0];
  const script = container.args[0] as string;
  const tags = /tag_list: %w\[([^\]]*)\]/.exec(script)?.[1];
  const untagged = /run_untagged: (true|false)/.exec(script)?.[1];
  const description = /description: '([^']+)'/.exec(script)?.[1];
  const secret = /SECRET=(\S+)/.exec(script)?.[1];
  if (tags === undefined || untagged === undefined || description === undefined || secret === undefined) {
    throw new Error("could not read the Linux runner's record out of Job/gitlab-runner-token");
  }
  return { tags: tags.split(/\s+/).filter(Boolean), runUntagged: untagged === "true", description, secret, image: String(container.image) };
}

describe("A. the tag contract: the two runners can never take each other's jobs", () => {
  const linux = linuxRunner();
  const winTags = windowsEnv("RUNNER_TAGS").split(",");

  test("the Linux runner is read correctly (so a refactor that moves its Job fails here, not silently)", () => {
    expect(linux.tags.length).toBeGreaterThan(0);
    expect(linux.runUntagged).toBe(true);
    expect(linux.description).toBe("zeta-cluster");
  });

  test("the tag sets are DISJOINT", () => {
    expect(winTags.filter((t) => linux.tags.includes(t))).toEqual([]);
  });

  test("the Windows runner is tagged `windows` and does NOT take untagged jobs; the Linux one does", () => {
    expect(winTags).toContain("windows");
    expect(windowsEnv("RUN_UNTAGGED")).toBe("false");
    expect(linux.runUntagged).toBe(true);
    // exactly one untagged taker: two would split tag-less pipelines across operating systems.
    expect([windowsEnv("RUN_UNTAGGED") === "true", linux.runUntagged].filter(Boolean)).toHaveLength(1);
  });

  test("the Windows script has no literal that could override the env knobs back to untagged", () => {
    const script = windowsScript();
    expect(script).not.toContain("run_untagged: true");
    expect(script).toContain("run_untagged: @UNTAGGED@");
  });

  test("distinct record description and distinct Secret: a re-run cannot adopt or overwrite the Linux runner's token", () => {
    expect(windowsEnv("RUNNER_DESCRIPTION")).not.toBe(linux.description);
    expect(windowsEnv("TARGET_SECRET")).not.toBe(linux.secret);
    expect(windowsEnv("TARGET_SECRET")).toBe("gitlab-windows-runner-token");
  });

  test("the Job image is the chart's own kubectl image at the SAME release as the GitLab images, and is in the resolvability roster", () => {
    // The Linux Job resolves it through the chart helper (a template expression); here it is a literal, so
    // a GitLab bump must move it by hand -- this is what makes forgetting a red test.
    expect(linux.image).toContain("gitlab.kubectl.image");
    const image = String(windowsJob().spec.template.spec.containers[0].image);
    const refs = readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/image-resolvability.json"), "utf8");
    expect(refs).toContain(`"${image}"`);
    const toolbox = /registry\.gitlab\.com\/gitlab-org\/build\/cng\/gitlab-toolbox-ce:(v[0-9.]+)/.exec(refs)?.[1];
    expect(toolbox).toBeDefined();
    expect(image.endsWith(`:${toolbox}`)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// B. The token Job, executed against a stub kubectl
// ---------------------------------------------------------------------------

const probe = (cmd: string[]): boolean => {
  try {
    return Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
  } catch {
    return false;
  }
};
const BASH = probe(["bash", "-c", "exit 0"]);
if (!BASH) console.warn("gitlab-windows-runner.test: bash not on PATH -- section B is SKIPPED, not passed");

const TOKEN = "glrt-t3_WinTok-123_xyz";

const KUBECTL_STUB = `#!/usr/bin/env bash
state="$STUB_DIR"
echo "$*" >> "$state/calls.log"
case " $* " in
  *" get secret "*) printf '%s' "$(cat "$state/existing" 2>/dev/null)"; exit 0 ;;
  *" exec "*)
    n=$(cat "$state/exec-count" 2>/dev/null || echo 0); n=$((n + 1)); echo "$n" > "$state/exec-count"
    for a in "$@"; do last="$a"; done
    printf '%s' "$last" > "$state/ruby.rb"
    fails=$(cat "$state/exec-failures" 2>/dev/null || echo 0)
    if [ "$fails" = "inf" ] || [ "$n" -le "$fails" ]; then echo "error: toolbox not answering (attempt $n)" >&2; exit 1; fi
    printf 'DEPRECATION WARNING: noise before the token\\n\\n%s' "$STUB_TOKEN"
    exit 0 ;;
  *" patch "*)
    prev=""
    for a in "$@"; do if [ "$prev" = "--patch-file" ]; then cp "$a" "$state/patch.json"; fi; prev="$a"; done
    exit 0 ;;
esac
echo "stub kubectl: unexpected invocation: $*" >&2
exit 99
`;

const readIfPresent = (path: string): string | null => {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
};

interface Scenario {
  existing?: string;
  execFailures?: number;
  env?: Record<string, string>;
}
interface Outcome {
  exitCode: number;
  output: string;
  execCalls: number;
  ruby: string | null;
  patch: Record<string, any> | null;
}

function runScript(script: string, scenario: Scenario): Outcome {
  const dir = mkdtempSync(join(tmpdir(), "win-mint-stub-"));
  try {
    const bin = join(dir, "bin");
    mkdirSync(bin, { recursive: true });
    for (const [name, body] of [["kubectl", KUBECTL_STUB], ["sleep", "#!/usr/bin/env bash\nexit 0\n"]] as const) {
      writeFileSync(join(bin, name), body, "utf8");
      chmodSync(join(bin, name), 0o755);
    }
    writeFileSync(join(dir, "existing"), scenario.existing ?? "", "utf8");
    writeFileSync(join(dir, "exec-failures"), scenario.execFailures === Infinity ? "inf" : String(scenario.execFailures ?? 0), "utf8");
    writeFileSync(join(dir, "script.sh"), script, "utf8");
    const toPosix = (p: string): string => p.replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_m, d: string) => `/${d.toLowerCase()}`);
    const onWindows = process.platform === "win32";
    const env: Record<string, string | undefined> = { ...process.env };
    const inheritedPath = process.env["PATH"] ?? process.env["Path"] ?? "";
    for (const k of Object.keys(env)) if (k.toLowerCase() === "path") delete env[k];
    // The Job's own env block, then the scenario's overrides: the script sees what a pod would.
    const jobEnv: Record<string, string> = {};
    for (const e of windowsJob().spec.template.spec.containers[0].env as { name: string; value: string }[]) {
      if (e.name !== "HOME") jobEnv[e.name] = e.value;
    }
    const run = Bun.spawnSync(["bash", onWindows ? toPosix(join(dir, "script.sh")) : join(dir, "script.sh")], {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...env,
        ...jobEnv,
        PATH: `${bin}${delimiter}${inheritedPath}`,
        STUB_DIR: onWindows ? toPosix(dir) : dir,
        STUB_TOKEN: TOKEN,
        MINT_MAX_ATTEMPTS: "5",
        ...(scenario.env ?? {}),
      },
    });
    const patchText = readIfPresent(join(dir, "patch.json"));
    return {
      exitCode: run.exitCode ?? -1,
      output: run.stdout.toString() + run.stderr.toString(),
      execCalls: Number(readIfPresent(join(dir, "exec-count"))?.trim() ?? "0"),
      ruby: readIfPresent(join(dir, "ruby.rb")),
      patch: patchText === null ? null : (JSON.parse(patchText) as Record<string, any>),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(!BASH)("B. the token Job's script, executed", () => {
  test("it sends Rails an instance runner tagged windows that does NOT run untagged, and writes only runner-token", () => {
    const out = runScript(windowsScript(), {});
    expect(out.exitCode).toBe(0);
    expect(out.execCalls).toBe(1);
    expect(out.ruby).toContain("tag_list: %w[windows zeta-windows]");
    expect(out.ruby).toContain("run_untagged: false");
    expect(out.ruby).not.toContain("run_untagged: true");
    expect(out.ruby).toContain("runner_type: 'instance_type'");
    expect(out.ruby).toContain("description: 'zeta-windows'");
    expect(out.ruby).not.toContain("@"); // every placeholder was substituted
    const data = out.patch?.["data"] ?? {};
    expect(Object.keys(data)).toEqual(["runner-token"]);
    expect(Buffer.from(data["runner-token"], "base64").toString("utf8")).toBe(TOKEN);
  });

  test("the token is never printed: the Job's whole output is one known line", () => {
    const out = runScript(windowsScript(), {});
    expect(out.output).toBe("minted a glrt- runner token into gitlab-windows-runner-token\n");
  });

  test("a token already in the Secret is left alone: no Rails call, no patch (idempotent re-apply)", () => {
    const out = runScript(windowsScript(), { existing: "Z2xydC1zb21ldGhpbmc=" });
    expect(out.exitCode).toBe(0);
    expect(out.execCalls).toBe(0);
    expect(out.patch).toBeNull();
    expect(out.output).toContain("already present");
  });

  test("a Rails call that fails twice and then succeeds still writes the token", () => {
    const out = runScript(windowsScript(), { execFailures: 2 });
    expect(out.exitCode).toBe(0);
    expect(out.execCalls).toBe(3);
    expect(out.patch).not.toBeNull();
  });

  test("a Rails call that never succeeds FAILS LOUD (exit 1, operator step printed), unlike the Linux sync-hook Job", () => {
    const out = runScript(windowsScript(), { execFailures: Infinity });
    expect(out.exitCode).toBe(1);
    expect(out.execCalls).toBe(5);
    expect(out.patch).toBeNull();
    expect(out.output).toContain("Operator step");
    expect(out.output).toContain("windows,zeta-windows");
  });

  test("the env knobs are the whole interface: another runner is a values change, and untagged is passed through", () => {
    const out = runScript(windowsScript(), {
      env: { RUNNER_DESCRIPTION: "zeta-big-linux", RUNNER_TAGS: "linux-big,privileged", RUN_UNTAGGED: "true", TARGET_SECRET: "gitlab-big-linux-runner-token" },
    });
    expect(out.exitCode).toBe(0);
    expect(out.ruby).toContain("description: 'zeta-big-linux'");
    expect(out.ruby).toContain("tag_list: %w[linux-big privileged]");
    expect(out.ruby).toContain("run_untagged: true");
    expect(out.output).toContain("gitlab-big-linux-runner-token");
  });

  for (const [name, env] of [
    ["a quote in the description", { RUNNER_DESCRIPTION: "x'; system('id'); '" }],
    ["a space or bracket in the tags", { RUNNER_TAGS: "a] + system('id') + %w[b" }],
    ["a non-boolean run-untagged", { RUN_UNTAGGED: "false) ; system('id'" }],
  ] as const) {
    test(`Ruby injection is refused before any Rails call: ${name}`, () => {
      const out = runScript(windowsScript(), { env });
      expect(out.exitCode).toBe(1);
      expect(out.execCalls).toBe(0);
      expect(out.patch).toBeNull();
    });
  }
});

describe("B2. the token Job's authority", () => {
  const role = kindOf(tokenDocs, "Role")[0]!;

  test("it can patch ONE named Secret and cannot create Secrets (the Secret is pre-created empty)", () => {
    const secretRules = (role.rules as Doc[]).filter((r) => (r.resources as string[]).includes("secrets"));
    expect(secretRules).toHaveLength(1);
    expect(secretRules[0]?.["resourceNames"]).toEqual(["gitlab-windows-runner-token"]);
    expect((secretRules[0]?.["verbs"] as string[]).slice().sort()).toEqual(["get", "patch"]);
    const secret = kindOf(tokenDocs, "Secret")[0]!;
    expect(secret.metadata.name).toBe("gitlab-windows-runner-token");
    expect(secret.metadata.namespace).toBe("gitlab");
  });

  test("the pre-created Secret carries NO data key, so re-applying this file cannot blank a live token", () => {
    const secret = kindOf(tokenDocs, "Secret")[0]!;
    expect(secret.data).toBeUndefined();
    expect(secret.stringData).toBeUndefined();
  });

  test("everything is in the gitlab namespace and the RoleBinding binds the Job's ServiceAccount to the Role", () => {
    for (const d of tokenDocs) expect(d.metadata.namespace).toBe("gitlab");
    const rb = kindOf(tokenDocs, "RoleBinding")[0]!;
    expect(rb.roleRef.name).toBe(role.metadata.name);
    expect(rb.subjects[0].name).toBe(windowsJob().spec.template.spec.serviceAccountName);
  });

  test("the container runs unprivileged: non-root, read-only rootfs, no capabilities", () => {
    const spec = windowsJob().spec.template.spec;
    expect(spec.securityContext.runAsNonRoot).toBe(true);
    const c = spec.containers[0];
    expect(c.securityContext.allowPrivilegeEscalation).toBe(false);
    expect(c.securityContext.readOnlyRootFilesystem).toBe(true);
    expect(c.securityContext.capabilities.drop).toEqual(["ALL"]);
  });
});

// ---------------------------------------------------------------------------
// C. The guest spec
// ---------------------------------------------------------------------------

describe("C. the Windows runner guest", () => {
  const vm = kindOf(vmDocs, "VirtualMachine")[0]!;
  const spec = vm.spec.template.spec;
  const volumes = spec.volumes as Doc[];
  const disks = spec.domain.devices.disks as Doc[];
  const configMaps = kindOf(vmDocs, "ConfigMap");
  const bootstrapCm = configMaps.find((c) => c.metadata.name === "windows-runner-bootstrap")!;
  const script = bootstrapCm.data["bootstrap.ps1"] as string;
  const isoDv = (): Doc => kindOf(vmDocs, "DataVolume").find((d) => d.metadata.name === "windows-runner-iso")!;
  const rootDv = (): Doc => kindOf(vmDocs, "DataVolume").find((d) => d.metadata.name === "windows-runner-root")!;

  test("OPT-IN by construction: Halted, an unresolvable image sentinel, outside the applications tree", () => {
    expect(vm.spec.runStrategy).toBe("Halted");
    const dv = isoDv();
    expect(new URL(dv.spec.source.http.url).hostname.endsWith(".invalid")).toBe(true);
    for (const path of [VM_FILE, TOKEN_FILE]) expect(path.startsWith(join(REPO_ROOT, "full-ai-cluster/k8s/applications"))).toBe(false);
    // ArgoCD's root reads only applications/*/Application.yaml: nothing in that tree may name these.
    const appText = readFileSync(GITLAB_APP, "utf8");
    expect(appText).not.toContain("windows-runner");
    expect(appText).not.toContain("kubevirt-windows-gitlab-runner");
  });

  test("it does not ship or fetch Windows: no Windows image URL, only a sentinel the operator must replace", () => {
    const text = readFileSync(VM_FILE, "utf8");
    // (the XML namespace `schemas.microsoft.com` in Unattend.xml is not a download; only `url:` fields count)
    expect(text).not.toMatch(/url:\s*\S*(microsoft\.com|windowsupdate|software-download)/i);
    expect(Object.keys(isoDv().spec.source)).toEqual(["http"]);
    // the guest's own disk starts blank: the unattended install partitions it, nothing is pre-baked in git
    expect(Object.keys(rootDv().spec.source)).toEqual(["blank"]);
    expect(text).toContain("EDIT");
  });

  test("every object lives in the namespace the GitLab Application owns, and the VM sits beside the token Secret it mounts", () => {
    for (const d of vmDocs) expect(d.metadata.namespace).toBe("gitlab");
    const secretVolume = volumes.find((v) => v.secret)!;
    expect(secretVolume.secret.secretName).toBe(kindOf(tokenDocs, "Secret")[0]!.metadata.name);
  });

  test("a Windows guest, not a Linux one with a Windows name: EFI, Hyper-V enlightenments, clock policy, slow-shutdown grace", () => {
    const domain = spec.domain;
    for (const key of ["relaxed", "vapic", "spinlocks", "vpindex", "runtime", "synic", "synictimer"]) expect(domain.features.hyperv).toHaveProperty(key);
    expect(domain.clock.timer.hpet.present).toBe(false);
    expect(domain.firmware.bootloader.efi).toBeDefined();
    expect(spec.terminationGracePeriodSeconds).toBeGreaterThanOrEqual(120);
    // only fields KubeVirt's FeatureHyperv declares (same list and reason as kubevirt-vm-live-test.test.ts)
    const declared = new Set(["relaxed", "vapic", "spinlocks", "vpindex", "runtime", "synic", "synictimer", "reset", "vendorid", "frequencies", "reenlightenment", "tlbflush", "ipi", "evmcs"]);
    expect(Object.keys(domain.features.hyperv).filter((k) => !declared.has(k))).toEqual([]);
  });

  test("memory request == limit and NO CPU limit (same sizing contract as kubevirt-windows-vm.yaml)", () => {
    const { requests, limits } = spec.domain.resources;
    expect(limits.memory).toBe(requests.memory);
    expect(spec.domain.memory.guest).toBe(requests.memory);
    expect(limits.cpu).toBeUndefined();
    expect(requests.cpu).toBeDefined();
  });

  test("every disk has a volume and every volume has a disk, and every volume source names an object this file or the token file defines", () => {
    expect(new Set(disks.map((d) => d.name))).toEqual(new Set(volumes.map((v) => v.name)));
    const have = new Set([...vmDocs, ...tokenDocs].map((d) => `${d.kind}/${d.metadata.name}`));
    for (const v of volumes) {
      if (v.dataVolume) expect(have.has(`DataVolume/${v.dataVolume.name}`)).toBe(true);
      if (v.configMap) expect(have.has(`ConfigMap/${v.configMap.name}`)).toBe(true);
      if (v.secret) expect(have.has(`Secret/${v.secret.secretName}`)).toBe(true);
    }
    // The unattend Secret is the ONE object not defined in a file: it carries a password, so the render
    // script creates it. The name the VM mounts must be the name the script renders.
    const sysprep = volumes.find((v) => v.sysprep)!;
    expect(sysprep.sysprep.secret.name).toBe(SECRET_NAME);
    expect(SECRET_NAMESPACE).toBe("gitlab");
  });

  test("the installer ISO boots first, the blank virtio root disk second; the rest are CD-ROMs a Windows guest can read", () => {
    const iso = disks.find((d) => d.name === "iso")!;
    const root = disks.find((d) => d.name === "root")!;
    expect(iso.bootOrder).toBe(1);
    expect(root.bootOrder).toBe(2);
    expect(root.disk.bus).toBe("virtio");
    for (const d of disks.filter((x) => x.name !== "root")) expect(d.cdrom).toBeDefined();
  });

  test("the volume labels the guest looks for are the labels the volumes carry (ZETABOOT, ZETATOKEN) in EVERY place that names them", () => {
    const labelOf = (volName: string): string | undefined => {
      const v = volumes.find((x) => x.name === volName)!;
      return v.configMap?.volumeLabel ?? v.secret?.volumeLabel;
    };
    expect(labelOf("bootstrap")).toBe("ZETABOOT");
    expect(labelOf("runner-token")).toBe("ZETATOKEN");
    const userData = volumes.find((v) => v.cloudInitConfigDrive)!.cloudInitConfigDrive.userData as string;
    expect(script).toContain("Find-Volume 'ZETABOOT'");
    expect(script).toContain("Find-Volume 'ZETATOKEN'");
    expect(userData).toContain("'ZETABOOT'");
    // both answer files copy bootstrap.ps1 off the ZETABOOT volume
    for (const f of ["Autounattend.xml", "Unattend.xml"]) expect(readFileSync(join(UNATTEND_DIR, f), "utf8")).toContain("'ZETABOOT'");
    // ISO 9660 volume labels: <= 32 chars, upper-case letters / digits / underscore
    for (const l of ["ZETABOOT", "ZETATOKEN"]) expect(l).toMatch(/^[A-Z0-9_]{1,32}$/);
    // the file the script reads is the key the token Job writes
    expect(script).toContain("'runner-token'");
  });

  test("storage: a CAPABILITY name (never a provider class), RWO, a sized claim; counted by the runbook, not priced as always-on demand", () => {
    for (const dv of kindOf(vmDocs, "DataVolume")) {
      expect(STORAGE_CAPABILITIES as readonly string[]).toContain(dv.spec.storage.storageClassName);
      expect(dv.spec.storage.accessModes).toEqual(["ReadWriteOnce"]);
      expect(dv.spec.storage.resources.requests.storage).toMatch(/^\d+(Gi|Ti)$/);
    }
    expect(rootDv().spec.storage.resources.requests.storage).toBe("64Gi");
    // the ISO is read once and its importer cleaned up, as in kubevirt-windows-vm.yaml
    expect(isoDv().metadata.annotations["cdi.kubevirt.io/storage.deleteAfterCompletion"]).toBe("true");
    // zeta-block-local is WaitForFirstConsumer and the VM is Halted until the ISO exists: without an immediate
    // bind the import (or upload) would wait for a pod that can only be the VM (the lesson of CI run 36859944232).
    expect(isoDv().metadata.annotations["cdi.kubevirt.io/storage.bind.immediate.requested"]).toBe("true");
  });

  test("the virtio driver CD is pinned to the SAME KubeVirt release as the vendored operator", () => {
    const operator = readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/applications/kubevirt/kubevirt-operator.yaml"), "utf8");
    const version = /name: KUBEVIRT_VERSION\s+value: (v[0-9.]+)/.exec(operator)?.[1];
    expect(version).toBeDefined();
    expect(volumes.find((v) => v.name === "virtio-win")!.containerDisk.image).toBe(`quay.io/kubevirt/virtio-container-disk:${version}`);
  });

  test("RDP Service selects the label KubeVirt stamps on the launcher, is ClusterIP", () => {
    const svc = kindOf(vmDocs, "Service")[0]!;
    expect(svc.spec.selector["kubevirt.io/domain"]).toBe(vm.spec.template.metadata.labels["kubevirt.io/domain"]);
    expect(svc.spec.type).toBe("ClusterIP");
    expect(svc.spec.ports[0].port).toBe(3389);
  });
});

describe("C2. what the guest installs and where it connects", () => {
  const bootstrapCm = kindOf(vmDocs, "ConfigMap").find((c) => c.metadata.name === "windows-runner-bootstrap")!;
  const settings = JSON.parse(bootstrapCm.data["settings.json"]) as Record<string, any>;
  const script = bootstrapCm.data["bootstrap.ps1"] as string;

  test("it reaches GitLab through the SAME in-cluster Service the Linux runner uses, by FQDN (a Windows resolver does not walk a search list)", () => {
    const app = parseYaml(readFileSync(GITLAB_APP, "utf8")) as Doc;
    const linuxUrl = new URL(app.spec.source.helm.valuesObject["gitlab-runner"].gitlabUrl as string);
    const winUrl = new URL(settings["gitlabUrl"]);
    expect(winUrl.port).toBe(linuxUrl.port);
    const [svc, ns] = linuxUrl.hostname.split(".");
    expect(winUrl.hostname).toBe(`${svc}.${ns}.svc.cluster.local`);
    expect(winUrl.protocol).toBe("http:");
  });

  test("gitlab-runner.exe is downloaded from the vendor's release bucket, pinned by version AND sha256, and verified before it runs", () => {
    expect(settings["runnerExeSha256"]).toMatch(/^[0-9a-f]{64}$/);
    const url = new URL(settings["runnerExeUrl"]);
    expect(url.protocol).toBe("https:");
    expect(url.pathname).toMatch(/^\/v\d+\.\d+\.\d+\/binaries\/gitlab-runner-windows-amd64\.exe$/);
    expect(script).toContain("Get-FileHash -Algorithm SHA256");
    // the hash is compared and a mismatch throws BEFORE Move-Item puts the file where the service runs it
    expect(script.indexOf("does not match the pinned")).toBeLessThan(script.indexOf("Move-Item $tmp $exe"));
  });

  test("the runner version matches the GitLab release (the Job image tag), never newer than the server", () => {
    const version = /\/(v\d+\.\d+\.\d+)\//.exec(settings["runnerExeUrl"])?.[1];
    const imageTag = /:(v\d+\.\d+\.\d+)$/.exec(String(windowsJob().spec.template.spec.containers[0].image))?.[1];
    expect(version).toBe(imageTag);
  });

  test("registration is the authentication-token flow: a glrt- token, none of the flags GitLab refuses alongside it", () => {
    expect(script).toContain("-notmatch '^glrt-'");
    const registerLine = script.split("\n").find((l) => l.includes("register --non-interactive"))!;
    expect(registerLine).toContain("--token $token");
    for (const refused of ["--tag-list", "--run-untagged", "--locked", "--registration-token"]) expect(registerLine).not.toContain(refused);
    expect(registerLine).toContain("--executor shell");
    expect(registerLine).toContain("--shell powershell");
    // clone_url keeps checkouts in-cluster, as for the Linux runner
    expect(registerLine).toContain("--clone-url $settings.gitlabUrl");
  });

  test("everything the script can write to its log is an exact, known set of lines (none of which is the token)", () => {
    // An EXACT pin on the whole set of output statements, so a new one -- which could be a leak -- is a diff
    // here rather than a negative assertion that witnesses one rendering of a leak.
    const outputs = script
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /Write-(Host|Output|Warning|Verbose|Error)|Out-File|Add-Content|Set-Content|echo /i.test(l) && !l.startsWith("(Get-Content"));
    expect(outputs).toEqual([
      "Write-Host 'runner already registered; nothing to do'",
      'catch { Write-Host "download attempt $i failed: $($_.Exception.Message)"; Start-Sleep -Seconds 20 }',
      "Write-Host 'gitlab-runner registered and started'",
    ]);
  });

  test("it is idempotent: an already-registered runner exits before downloading or registering anything", () => {
    expect(script.indexOf("runner already registered")).toBeLessThan(script.indexOf("Invoke-WebRequest"));
    expect(script.indexOf("runner already registered")).toBeLessThan(script.indexOf("register --non-interactive"));
  });
});

// ---------------------------------------------------------------------------
// D. The runbook
// ---------------------------------------------------------------------------

describe("D. the runbook", () => {
  // One read, no existence probe first: a missing runbook is a thrown ENOENT, which is the failure we want.
  const doc = readFileSync(RUNBOOK, "utf8");

  test("exists", () => {
    expect(doc.length).toBeGreaterThan(2000);
  });

  test("names every manifest, Secret, label and tag the files define, so it cannot drift from them", () => {
    for (const needle of [
      "examples/gitlab-windows-runner-token.yaml",
      "examples/kubevirt-windows-gitlab-runner.yaml",
      "gitlab-windows-runner-token",
      "windows-runner-bootstrap",
      "ZETABOOT",
      "ZETATOKEN",
      "windows,zeta-windows",
      "cloudbase-init",
      "Unattend.xml",
      "virtio",
    ]) {
      expect(doc).toContain(needle);
    }
  });

  test("has an HONEST section: what is proven, what is not, and how the operator verifies", () => {
    expect(doc).toMatch(/^## .*[Uu]nproven/m);
    expect(doc).toMatch(/^## .*[Pp]roven/m);
    expect(doc).toContain("Admin > CI/CD > Runners");
    expect(doc).toMatch(/tags:\s*\[windows\]/);
    expect(doc).toMatch(/no Windows image/i);
  });

  test("documents adding ANY extra runner without a reflash", () => {
    expect(doc).toMatch(/^## .*extra runner/im);
    for (const needle of ["RUNNER_TAGS", "RUN_UNTAGGED", "privileged", "group", "/api/v4/user/runners"]) expect(doc).toContain(needle);
  });

  test("makes the FREE evaluation path the default, and says what a human must do and where the ISO goes", () => {
    for (const needle of [
      "Windows Server 2022",
      "Evaluation",
      "Evaluation Center",
      "180 days",
      "Windows 11 Enterprise Evaluation",
      "90 days",
      "windows-runner-unattend",
      "windows-runner-unattend-secret.ts",
      "Autounattend.xml",
      "virtctl image-upload",
      "--no-create",
      "cdi-uploadproxy",
      "WINDOWS_ADMIN_PASSWORD",
    ]) {
      expect(doc).toContain(needle);
    }
    expect(doc).toMatch(/^## .*[Ff]ree/m);
    expect(doc).toMatch(/human step/i);
  });

  test("states the evaluation limits plainly: expiry, hourly shutdown, rearm, evaluation-only terms, and that an OEM licence does not move into a VM", () => {
    for (const needle of ["expir", "shut", "slmgr", "/rearm", "rearm count", "production", "OEM", "licence you hold", "keeps the same", "glrt-"]) {
      expect(doc.toLowerCase()).toContain(needle.toLowerCase());
    }
    expect(doc).toMatch(/^## .*[Ll]imits/m);
  });

  test("links Microsoft only at the Evaluation Center landing page: no download URL it cannot vouch for", () => {
    const urls = [...doc.matchAll(/https?:\/\/[^\s)>`'"]+/g)].map((m) => m[0]);
    const microsoft = urls.filter((u) => /microsoft\.com|windowsupdate|software-download/i.test(u));
    expect([...new Set(microsoft)]).toEqual(["https://www.microsoft.com/en-us/evalcenter"]);
    expect(urls.filter((u) => /\.iso(\b|$)/i.test(u))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// E. Evaluation media: the unattended install, its Secret, and the expiry watchdog
// ---------------------------------------------------------------------------

/** The answer file with its comments removed: prose inside a comment must not satisfy (or trip) a structural check. */
function stripXmlComments(xml: string): string {
  // A scan, not a regex replace: a single replace pass can leave a `<!--` behind when comments nest or are
  // malformed (CodeQL js/incomplete-multi-character-sanitization), and this strips for a CHECK, so it must be exact.
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
  // (the `<?xml ...?>` declaration is not matched by the element pattern, so it needs no stripping)
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

describe("E. evaluation media (the free default)", () => {
  const auto = readFileSync(join(UNATTEND_DIR, "Autounattend.xml"), "utf8");
  const generalized = readFileSync(join(UNATTEND_DIR, "Unattend.xml"), "utf8");
  const bootstrapCm = kindOf(vmDocs, "ConfigMap").find((c) => c.metadata.name === "windows-runner-bootstrap")!;
  const bootstrap = bootstrapCm.data["bootstrap.ps1"] as string;
  const watch = bootstrapCm.data["eval-watch.ps1"] as string;
  const body = stripXmlComments(auto);

  test("both answer files are well-formed XML", () => {
    expect(xmlProblems(auto)).toEqual([]);
    expect(xmlProblems(generalized)).toEqual([]);
  });

  test("it is an EVALUATION install: NO product key, EULA acceptance, an edition index, GPT/UEFI on the virtio disk", () => {
    expect(body.match(/<ProductKey>/g) ?? []).toEqual([]);
    expect(body.match(/<Key>[^<]*<\/Key>/g)).toEqual(["<Key>/IMAGE/INDEX</Key>"]);
    expect(body).toContain("<AcceptEula>true</AcceptEula>");
    expect(body).toMatch(/<Value>\d+<\/Value>/);
    for (const t of ["<Type>EFI</Type>", "<Type>MSR</Type>", "<Type>Primary</Type>", "<WillWipeDisk>true</WillWipeDisk>"]) expect(body).toContain(t);
    // the answer file says, in prose, that the EULA is the OPERATOR's to accept and that the index must be verified
    expect(auto).toMatch(/YOUR acceptance/);
    expect(auto).toMatch(/VERIFY on your ISO/);
  });

  test("it loads the virtio DISK and NETWORK drivers in WinPE, from every drive letter the virtio-win CD could take", () => {
    const paths = [...body.matchAll(/<Path>([A-Z]):\\(viostor|NetKVM)\\2k22\\amd64<\/Path>/g)].map((m) => `${m[2]}:${m[1]}`);
    for (const driver of ["viostor", "NetKVM"]) expect(paths.filter((p) => p.startsWith(`${driver}:`)).length).toBeGreaterThanOrEqual(4);
  });

  test("the Administrator password is a placeholder in git, exactly once, and no literal password is committed", () => {
    expect(auto.split(PASSWORD_PLACEHOLDER).length - 1).toBe(1);
    expect(generalized.match(/Password/g) ?? []).toEqual([]); // the generalized path carries no account or password at all
    expect(body).toMatch(/<Value>@ADMIN_PASSWORD@<\/Value>\s*<PlainText>true<\/PlainText>/);
  });

  test("it hands off to the same bootstrap as the generalized path: copy off ZETABOOT, schedule at startup", () => {
    for (const xml of [body, stripXmlComments(generalized)]) {
      expect(xml).toContain("schtasks /create /f /ru SYSTEM /sc onstart /tn zeta-runner-bootstrap");
      expect(xml).toContain("bootstrap.ps1");
    }
  });

  test("render: the password is filled once, XML-escaped, never re-interpreted, and lands only in the Secret's Autounattend.xml", () => {
    const out = renderUnattendSecret({ password: "Str0ng&Pa$&ss<>word!", autounattend: auto, unattend: generalized });
    const secret = parseYaml(out) as Doc;
    expect(secret.kind).toBe("Secret");
    expect(secret.metadata).toEqual({ name: SECRET_NAME, namespace: SECRET_NAMESPACE });
    expect(Object.keys(secret.stringData).sort()).toEqual(["Autounattend.xml", "Unattend.xml"]);
    expect(secret.stringData["Autounattend.xml"]).toContain("<Value>Str0ng&amp;Pa$&amp;ss&lt;&gt;word!</Value>");
    expect(secret.stringData["Autounattend.xml"].split(PASSWORD_PLACEHOLDER)).toHaveLength(1);
    expect(secret.stringData["Unattend.xml"]).toBe(generalized);
    expect(xmlEscape("a&b<c>d")).toBe("a&amp;b&lt;c&gt;d");
  });

  for (const [why, password] of [
    ["too short", "Ab1!"],
    ["one character class", "alllowercaselettersonly"],
    ["two character classes", "alllowercase12345678"],
    ["the account name", "Administrator-Pass-123!"],
    ["a newline", "Str0ng-Passw0rd!\nx"],
  ] as const) {
    test(`render refuses a weak password: ${why}`, () => {
      expect(passwordProblem(password)).not.toBeNull();
      expect(() => renderUnattendSecret({ password, autounattend: auto, unattend: generalized })).toThrow(/refused/);
    });
  }

  test("render refuses a template without exactly one placeholder (a silently-unfilled password)", () => {
    const strong = "Str0ng-Passw0rd!x";
    expect(passwordProblem(strong)).toBeNull();
    expect(() => renderUnattendSecret({ password: strong, autounattend: auto.replace(PASSWORD_PLACEHOLDER, "x"), unattend: generalized })).toThrow(/exactly once/);
    expect(() => renderUnattendSecret({ password: strong, autounattend: auto + PASSWORD_PLACEHOLDER, unattend: generalized })).toThrow(/exactly once/);
    expect(() => renderUnattendSecret({ password: strong, autounattend: auto, unattend: PASSWORD_PLACEHOLDER })).toThrow(/must not carry/);
  });

  test("the CLI takes the password from the environment only, and refuses without printing a Secret", () => {
    const script = join(REPO_ROOT, "src/Core.TypeScript/cluster/windows-runner-unattend-secret.ts");
    const run = (args: string[], password?: string) => {
      const env: Record<string, string | undefined> = { ...process.env };
      delete env["WINDOWS_ADMIN_PASSWORD"];
      if (password !== undefined) env["WINDOWS_ADMIN_PASSWORD"] = password;
      const r = Bun.spawnSync([process.execPath, script, ...args], { env, stdout: "pipe", stderr: "pipe" });
      return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
    };
    expect(run([]).code).toBe(2); // no password at all
    const argv = run(["Str0ng-Passw0rd!x"], "Str0ng-Passw0rd!x"); // a password on argv is refused even when the env is fine
    expect(argv.code).toBe(2);
    expect(argv.out).toBe("");
    const weak = run([], "weak");
    expect(weak.code).toBe(2);
    expect(weak.out).toBe("");
    const ok = run([], "Str0ng-Passw0rd!x");
    expect(ok.code).toBe(0);
    expect((parseYaml(ok.out) as Doc).metadata.name).toBe(SECRET_NAME);
    // the refusals never echo the password
    expect(weak.err.includes("weak")).toBe(false);
  }, 60_000); // five bun processes: the default 5s is not enough on a loaded CI runner

  test("the bootstrap installs the virtio guest tools only when the guest has NO network adapter, from the virtio-win CD", () => {
    expect(bootstrap).toContain("Get-NetAdapter");
    expect(bootstrap).toContain("virtio-win*");
    expect(bootstrap).toContain("virtio-win-gt-x64.msi");
    // before the download it enables
    expect(bootstrap.indexOf("virtio-win-gt-x64.msi")).toBeLessThan(bootstrap.indexOf("Invoke-WebRequest"));
  });

  test("the evaluation watchdog REPORTS and never acts: no rearm, no licensing method call, no shutdown", () => {
    // Every call-shaped licensing / power action the script could contain, as an EXACT list: empty.
    expect(watch.match(/Invoke-CimMethod|slmgr(\.vbs)?|\/rearm|ReArmWindows|Stop-Computer|Restart-Computer|shutdown(\.exe)?/gi) ?? []).toEqual([]);
    // what it does do: log, and one Warning event inside 14 days of expiry
    expect(watch).toContain("eval-watch.log");
    expect(watch).toContain("-EntryType Warning");
    expect(watch).toContain("$days -lt 14");
    expect(watch).toContain("RemainingWindowsReArmCount");
  });

  test("the watchdog is installed by the bootstrap, daily, as SYSTEM, BEFORE the already-registered early exit (so it exists on a registered guest)", () => {
    expect(bootstrap).toContain("zeta-eval-watch");
    expect(bootstrap).toContain("-Daily");
    expect(bootstrap.indexOf("zeta-eval-watch")).toBeLessThan(bootstrap.indexOf("runner already registered"));
  });

  test("a reboot, rearm or expiry shutdown keeps the SAME runner: registration is skipped when config.toml already holds a glrt- token, and the service starts automatically", () => {
    expect(bootstrap).toContain("token = \"glrt-");
    expect(bootstrap.indexOf("token = \"glrt-")).toBeLessThan(bootstrap.indexOf("register --non-interactive"));
    // the token comes from the Secret CD-ROM, not from a freshly minted record: a rebuilt disk registers a manager under the SAME record
    expect(bootstrap).toContain("Find-Volume 'ZETATOKEN'");
    expect(bootstrap).toContain("& $exe install");
  });
});
