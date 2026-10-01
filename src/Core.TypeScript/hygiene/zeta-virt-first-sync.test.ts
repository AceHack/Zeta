// zeta-virt-first-sync.test.ts
//
// EXECUTES `full-ai-cluster/nixos/modules/zeta-virt-first-sync.sh` against a fake
// kubectl -- the same discipline as `k3s-datastore-bootstrap-recovery.test.ts`:
// a file a test can RUN, not Nix source a test can only read.
//
// THE PROPERTY THAT MATTERS MOST: a cluster that already runs the KubeVirt or CDI
// operator (its CRD exists) is NEVER synced by this unit. The two Applications are
// declared manual-sync precisely to protect such a cluster (node-5b2dfa, with live
// Windows guests); the script exists to give FRESH clusters the VM layer, and the
// CRD probe is the whole boundary between the two. Three suites below carry it.
//
// THREE OUTCOMES ARE KEPT APART -- synced / skipped / waiting -- because the
// failure this guards against is reading "the API did not answer" as "the CRD is
// absent" (and therefore syncing) or as "the CRD exists" (and therefore never
// syncing, forever). The `waiting` suite is the falsifier for that conflation.
//
// AND THE FAKE IS CHECKED AGAINST A MUTANT. A test that only passes against the
// real script proves nothing if it would also pass against a script with the
// guard deleted; `mutation: ...` below runs the same scenario against a copy with
// the CRD skip removed and requires the scenario to DETECT it.

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { join as posixJoin } from "node:path/posix";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const MODULES = join(REPO_ROOT, "full-ai-cluster/nixos/modules");
const SCRIPT = join(MODULES, "zeta-virt-first-sync.sh");
const NIX_MODULE = join(MODULES, "zeta-virt-first-sync.nix");
const SERVER_MODULE = join(MODULES, "k3s-server.nix");

const KUBEVIRT_CRD = "kubevirts.kubevirt.io";
const CDI_CRD = "cdis.cdi.kubevirt.io";

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "zeta-virt-first-sync-")).replace(/\\/g, "/");
}

// A fake `k3s kubectl`. Behaviour is driven by FAKE_* environment variables so a
// scenario is data, and every call is appended to a log so a test can assert what
// was NOT called as readily as what was.
const FAKE_KUBECTL = `#!/usr/bin/env bash
echo "$*" >> "$FAKE_LOG"
args="$*"
case "$args" in
  *"get application"*"-o name"*)
    app="$(echo "$args" | sed -E 's/.*get application ([^ ]+).*/\\1/')"
    case " $FAKE_MISSING_APPS " in *" $app "*) exit 1;; esac
    echo "application.argoproj.io/$app"; exit 0;;
  *"get application"*"operationState.phase"*)
    app="$(echo "$args" | sed -E 's/.*get application ([^ ]+).*/\\1/')"
    [ -n "$FAKE_API_DOWN_ON_PHASE" ] && exit 1
    case "$app" in
      kubevirt) printf '%s' "$FAKE_PHASE_KUBEVIRT";;
      cdi) printf '%s' "$FAKE_PHASE_CDI";;
    esac
    exit 0;;
  *"get crd"*)
    [ -n "$FAKE_API_DOWN" ] && exit 1
    crd="$(echo "$args" | sed -E 's/.*get crd ([^ ]+).*/\\1/')"
    case " $FAKE_EXISTING_CRDS " in *" $crd "*) echo "customresourcedefinition.apiextensions.k8s.io/$crd";; esac
    exit 0;;
  *"patch application"*)
    [ -n "$FAKE_PATCH_FAILS" ] && exit 1
    exit 0;;
  *"get kubevirt kubevirt"*)
    [ -n "$FAKE_API_DOWN_ON_CR" ] && exit 1
    [ -z "$FAKE_NO_CR" ] && echo "kubevirt.kubevirt.io/kubevirt"
    exit 0;;
  *"patch kubevirt kubevirt"*)
    [ -n "$FAKE_CR_PATCH_FAILS" ] && exit 1
    exit 0;;
esac
exit 0
`;

interface Scenario {
  readonly existingCrds?: readonly string[];
  readonly missingApps?: readonly string[];
  readonly apiDown?: boolean;
  readonly apiDownOnPhase?: boolean;
  readonly patchFails?: boolean;
  readonly phaseKubevirt?: string;
  readonly phaseCdi?: string;
  readonly sentinelPresent?: boolean;
  /** Does THIS host have /dev/kvm? Default true, so only the emulation suites opt out. */
  readonly kvm?: boolean;
  readonly noCr?: boolean;
  readonly apiDownOnCr?: boolean;
  readonly crPatchFails?: boolean;
}

interface Result {
  readonly status: number;
  readonly out: string;
  readonly calls: readonly string[];
  readonly patchedApps: readonly string[];
  readonly patches: readonly string[];
  /** `patch kubevirt kubevirt ...` calls: the KubeVirt CR, not an Application. */
  readonly crPatches: readonly string[];
  readonly sentinelFile: string;
  readonly emulationSentinelFile: string;
  readonly root: string;
}

function run(scenario: Scenario, script: string = SCRIPT, root: string = tempRoot()): Result {
  const fake = posixJoin(root, "fake-kubectl.sh");
  writeFileSync(fake, FAKE_KUBECTL);
  const log = posixJoin(root, "kubectl.log");
  writeFileSync(log, "");
  const sentinelFile = posixJoin(root, "state", "virt-first-sync.done");
  const emulationSentinelFile = posixJoin(root, "state", "virt-emulation.done");
  if (scenario.sentinelPresent) {
    mkdirSync(posixJoin(root, "state"), { recursive: true });
    writeFileSync(sentinelFile, "2026-01-01T00:00:00Z\n");
    writeFileSync(emulationSentinelFile, "2026-01-01T00:00:00Z\n");
  }
  // A path that exists, or one that cannot: the script only tests `-e`.
  const kvmDevice = posixJoin(root, scenario.kvm === false ? "no-such-kvm" : "kvm-device");
  if (scenario.kvm !== false) writeFileSync(kvmDevice, "");
  const result = spawnSync("bash", [script], {
    env: {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      LC_ALL: "C",
      ZETA_KUBECTL_CMD: `bash ${fake}`,
      ZETA_VIRT_SENTINEL_FILE: sentinelFile,
      ZETA_VIRT_EMULATION_SENTINEL_FILE: emulationSentinelFile,
      ZETA_KVM_DEVICE: kvmDevice,
      FAKE_NO_CR: scenario.noCr ? "1" : "",
      FAKE_API_DOWN_ON_CR: scenario.apiDownOnCr ? "1" : "",
      FAKE_CR_PATCH_FAILS: scenario.crPatchFails ? "1" : "",
      ZETA_VIRT_WAITING_STATE_FILE: posixJoin(root, "waiting-state"),
      ZETA_SERIAL_DEVICE: posixJoin(root, "no-such-serial-device"),
      FAKE_LOG: log,
      FAKE_EXISTING_CRDS: (scenario.existingCrds ?? []).join(" "),
      FAKE_MISSING_APPS: (scenario.missingApps ?? []).join(" "),
      FAKE_API_DOWN: scenario.apiDown ? "1" : "",
      FAKE_API_DOWN_ON_PHASE: scenario.apiDownOnPhase ? "1" : "",
      FAKE_PATCH_FAILS: scenario.patchFails ? "1" : "",
      FAKE_PHASE_KUBEVIRT: scenario.phaseKubevirt ?? "",
      FAKE_PHASE_CDI: scenario.phaseCdi ?? "",
    },
    encoding: "utf8",
    maxBuffer: 64 * 1024,
  });
  const calls = readFileSync(log, "utf8").split("\n").filter((l) => l.length > 0);
  const patches = calls.filter((c) => c.includes("patch application"));
  const patchedApps = patches.map((c) => c.replace(/.*patch application ([^ ]+).*/, "$1"));
  const crPatches = calls.filter((c) => c.includes("patch kubevirt kubevirt"));
  return {
    status: result.status ?? -1,
    out: `${result.stdout}${result.stderr}`,
    calls,
    patchedApps,
    patches,
    crPatches,
    sentinelFile,
    emulationSentinelFile,
    root,
  };
}

describe("a fresh cluster (neither operator present) -- the case the unit exists for", () => {
  const r = run({});

  test("syncs BOTH applications, in roster order, and exits 0", () => {
    expect(r.status).toBe(0);
    expect(r.patchedApps).toEqual(["kubevirt", "cdi"]);
  });

  test("the sync is an ordinary Application `operation.sync` with ServerSideApply, not a direct apply", () => {
    for (const p of r.patches) {
      expect(p).toContain("--type merge");
      expect(p).toContain('"operation"');
      expect(p).toContain('"sync"');
      // The KubeVirt CRD is at 91% of the client-side annotation ceiling.
      expect(p).toContain("ServerSideApply=true");
    }
    // Nothing is applied from the host: no `apply`, no `create`.
    expect(r.calls.some((c) => /\b(apply|create)\b/.test(c))).toBe(false);
  });

  test("writes the sentinel and names each outcome", () => {
    expect(existsSync(r.sentinelFile)).toBe(true);
    expect(r.out).toContain("VERDICT synced: initiated the one-time sync of Application 'kubevirt'");
    expect(r.out).toContain("VERDICT synced: initiated the one-time sync of Application 'cdi'");
  });

  test("is write-once: a second run after success touches nothing", () => {
    // Same root, so the sentinel from the first run is on disk; the fake kubectl
    // log is reset by run(), so any call at all would show.
    const again = run({}, SCRIPT, r.root);
    expect(again.status).toBe(0);
    expect(again.calls).toEqual([]);
    expect(again.patchedApps).toEqual([]);
  });
});

describe("an existing operator is NEVER synced -- the property this unit exists to guarantee", () => {
  test("kubevirt CRD present: kubevirt is not patched, cdi still is", () => {
    const r = run({ existingCrds: [KUBEVIRT_CRD] });
    expect(r.status).toBe(0);
    expect(r.patchedApps).toEqual(["cdi"]);
    expect(r.out).toContain("VERDICT skipped: kubevirt's CRD already exists");
  });

  test("cdi CRD present: cdi is not patched, kubevirt still is", () => {
    const r = run({ existingCrds: [CDI_CRD] });
    expect(r.patchedApps).toEqual(["kubevirt"]);
  });

  test("both CRDs present (node-5b2dfa's shape): nothing is patched at all, and the sentinel is still written", () => {
    const r = run({ existingCrds: [KUBEVIRT_CRD, CDI_CRD] });
    expect(r.status).toBe(0);
    expect(r.patchedApps).toEqual([]);
    expect(r.patches).toEqual([]);
    expect(existsSync(r.sentinelFile)).toBe(true);
  });

  test("an Application that has already run a sync operation is not given a second", () => {
    const r = run({ phaseKubevirt: "Succeeded" });
    expect(r.patchedApps).toEqual(["cdi"]);
    expect(r.out).toContain("Application 'kubevirt' has already run a sync operation");
  });

  test("mutation: with the CRD skip deleted, the existing-operator scenario DETECTS it", () => {
    // Without this, the suite above would pass against a script that syncs
    // everything -- the fake would be agreeing with itself.
    const source = readFileSync(SCRIPT, "utf8");
    const mutated = source.replace('PLAN="$PLAN $app=skip"', 'PLAN="$PLAN $app=sync"');
    expect(mutated).not.toBe(source); // the mutation matched; else this proves nothing
    const root = tempRoot();
    const mutantPath = posixJoin(root, "mutant.sh");
    writeFileSync(mutantPath, mutated);
    const r = run({ existingCrds: [KUBEVIRT_CRD, CDI_CRD] }, mutantPath, root);
    expect(r.patchedApps).toEqual(["kubevirt", "cdi"]); // the mutant syncs an existing operator
    // ...which is exactly what the real script must not do:
    expect(run({ existingCrds: [KUBEVIRT_CRD, CDI_CRD] }).patchedApps).toEqual([]);
  });
});

describe("unanswerable is `waiting`, never `skipped` and never `synced`", () => {
  test("API down on the CRD probe: exit 1, nothing patched, no sentinel, verdict is waiting", () => {
    const r = run({ apiDown: true });
    expect(r.status).toBe(1);
    expect(r.patchedApps).toEqual([]);
    expect(existsSync(r.sentinelFile)).toBe(false);
    expect(r.out).toContain("VERDICT waiting: could not ask the API whether CRD");
    // The conflation this guards: an error read as "CRD absent" would have synced,
    // an error read as "CRD present" would have written a sentinel and given up.
    expect(r.out).not.toContain("VERDICT skipped");
    expect(r.out).not.toContain("VERDICT synced");
  });

  test("API down on the operation-state probe: same", () => {
    const r = run({ apiDownOnPhase: true });
    expect(r.status).toBe(1);
    expect(r.patchedApps).toEqual([]);
    expect(existsSync(r.sentinelFile)).toBe(false);
  });

  test("an Application zeta-root has not created yet: exit 1, and NEITHER app is patched", () => {
    // kubevirt exists, cdi does not. Pass 1 examines everything before pass 2
    // acts, so the app that IS ready is not synced alone.
    const r = run({ missingApps: ["cdi"] });
    expect(r.status).toBe(1);
    expect(r.patchedApps).toEqual([]);
    expect(existsSync(r.sentinelFile)).toBe(false);
    expect(r.out).toContain("ArgoCD Application 'cdi' does not exist yet");
  });

  test("a failed patch: exit 1, no sentinel (so it retries), verdict names the app", () => {
    const r = run({ patchFails: true });
    expect(r.status).toBe(1);
    expect(existsSync(r.sentinelFile)).toBe(false);
    expect(r.out).toContain("patching Application 'kubevirt'");
  });

  test("the waiting verdict prints ONCE per boot, not once per retry", () => {
    const first = run({ apiDown: true });
    const second = run({ apiDown: true }, SCRIPT, first.root);
    expect(first.out).toContain("VERDICT waiting");
    expect(second.out).not.toContain("VERDICT waiting");
    expect(second.status).toBe(1); // still not done
  });
});

describe("phase 2 -- software emulation, only where this unit synced KubeVirt AND the host has no /dev/kvm", () => {
  test("no /dev/kvm on a fresh cluster: the KubeVirt CR gets useEmulation, with a named verdict", () => {
    const r = run({ kvm: false });
    expect(r.status).toBe(0);
    expect(r.crPatches).toHaveLength(1);
    expect(r.crPatches[0]).toContain("--type merge");
    expect(r.crPatches[0]).toContain('"useEmulation":true');
    expect(r.crPatches[0]).toContain('"developerConfiguration"');
    expect(existsSync(r.emulationSentinelFile)).toBe(true);
    expect(r.out).toContain("VERDICT software-emulation");
    expect(r.out).toContain("Windows guests will not be usable");
  });

  test("/dev/kvm present (real hardware): the CR is NEVER touched", () => {
    const r = run({ kvm: true });
    expect(r.status).toBe(0);
    expect(r.crPatches).toEqual([]);
    expect(r.out).toContain("VERDICT hardware-virtualisation");
    expect(existsSync(r.emulationSentinelFile)).toBe(true);
  });

  test("an EXISTING KubeVirt is never put into emulation, even on a host with no /dev/kvm", () => {
    // The production cluster's configuration is not this unit's to change on ANY
    // host. Its CRD exists, so phase 1 records skip and phase 2 must read that.
    const r = run({ kvm: false, existingCrds: [KUBEVIRT_CRD, CDI_CRD] });
    expect(r.status).toBe(0);
    expect(r.crPatches).toEqual([]);
    expect(r.calls.some((c) => c.includes("kubevirt kubevirt"))).toBe(false);
    expect(readFileSync(r.emulationSentinelFile, "utf8")).toContain("not-applicable");
  });

  test("the CR not existing yet is `waiting` -- and phase 1 is NOT repeated on the retry", () => {
    const first = run({ kvm: false, noCr: true });
    expect(first.status).toBe(1);
    expect(first.patchedApps).toEqual(["kubevirt", "cdi"]); // phase 1 ran
    expect(existsSync(first.sentinelFile)).toBe(true); // ...and is recorded
    expect(existsSync(first.emulationSentinelFile)).toBe(false); // phase 2 is not
    expect(first.out).toContain("VERDICT waiting: the KubeVirt CR does not exist yet");
    expect(first.crPatches).toEqual([]);

    // The CR appears; the retry finishes phase 2 and starts no second sync.
    const retry = run({ kvm: false }, SCRIPT, first.root);
    expect(retry.status).toBe(0);
    expect(retry.patchedApps).toEqual([]);
    expect(retry.crPatches).toHaveLength(1);
    expect(existsSync(retry.emulationSentinelFile)).toBe(true);
  });

  test("an unanswerable CR lookup is `waiting`, not `no CR` and not `done`", () => {
    const r = run({ kvm: false, apiDownOnCr: true });
    expect(r.status).toBe(1);
    expect(r.crPatches).toEqual([]);
    expect(existsSync(r.emulationSentinelFile)).toBe(false);
    expect(r.out).toContain("could not ask the API whether the KubeVirt CR exists");
  });

  test("a failed CR patch: exit 1, no sentinel, so it retries", () => {
    const r = run({ kvm: false, crPatchFails: true });
    expect(r.status).toBe(1);
    expect(existsSync(r.emulationSentinelFile)).toBe(false);
    expect(r.out).toContain("patching the KubeVirt CR with useEmulation failed");
  });

  test("is write-once: after emulation is set, a re-run touches nothing", () => {
    const first = run({ kvm: false });
    const again = run({ kvm: false }, SCRIPT, first.root);
    expect(again.status).toBe(0);
    expect(again.calls).toEqual([]);
  });

  test("mutation: with the `kubevirt=sync` guard deleted, the existing-operator scenario DETECTS it", () => {
    const source = readFileSync(SCRIPT, "utf8");
    const mutated = source.replace("if ! grep -qx 'kubevirt=sync' \"$SENTINEL_FILE\" 2>/dev/null; then", "if false; then");
    expect(mutated).not.toBe(source);
    const root = tempRoot();
    const mutantPath = posixJoin(root, "mutant.sh");
    writeFileSync(mutantPath, mutated);
    const scenario = { kvm: false, existingCrds: [KUBEVIRT_CRD, CDI_CRD] };
    expect(run(scenario, mutantPath, root).crPatches).toHaveLength(1); // the mutant reconfigures an existing KubeVirt
    expect(run(scenario).crPatches).toEqual([]); // the real script does not
  });
});

describe("a sentinel ends it", () => {
  test("sentinel present: exit 0 and kubectl is never called", () => {
    const r = run({ sentinelPresent: true });
    expect(r.status).toBe(0);
    expect(r.calls).toEqual([]);
  });
});

describe("wiring", () => {
  const nix = readFileSync(NIX_MODULE, "utf8");

  test("the unit runs THIS script, after k3s, retrying only on failure", () => {
    expect(nix).toContain("./zeta-virt-first-sync.sh");
    expect(nix).toContain('after = [ "k3s.service" ]');
    expect(nix).toContain('Restart = "on-failure"');
    // Not required by anything: a miss here must never take the API down.
    const code = nix
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");
    expect(code).not.toMatch(/requiredBy|bindsTo|requires\s*=/);
  });

  test("it is imported by the server role, so a worker never runs it", () => {
    expect(readFileSync(SERVER_MODULE, "utf8")).toContain("./zeta-virt-first-sync.nix");
  });

  test("the Applications stay manual-sync: this unit REPLACES nothing in their declaration", () => {
    for (const app of ["kubevirt", "cdi"]) {
      const text = readFileSync(join(REPO_ROOT, `full-ai-cluster/k8s/applications/${app}/Application.yaml`), "utf8");
      expect(text).toContain("zeta.io/sync-policy: manual");
      expect(text).not.toMatch(/^\s+automated:/m);
    }
  });
});
