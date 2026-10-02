// Falsifiers for node-tunables.ts — the TypeScript reader of
// full-ai-cluster/k8s/node-tunables.json, the single source of truth also
// read by full-ai-cluster/nixos/modules/k8s-node-tunables.nix.
//
// WHAT WOULD MAKE THIS VACUOUS, and is guarded against directly: a reader
// that defaults to an empty list on a malformed file would report "0
// sysctl(s), all applied" — a green CI step that set nothing on the runner
// while the workflow log claimed success. Every malformed-input case below
// asserts a throw, never an empty array.

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  NODE_TUNABLES_PATH,
  readNodeTunables,
  sysctlCommand,
  sysctlCommands,
  type SysctlEntry,
} from "./node-tunables.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

describe("the declaration itself", () => {
  test("carries at least the three keys this repo's problem statement named", () => {
    const entries = readNodeTunables(REPO_ROOT);
    const keys = entries.map((e) => e.key);
    expect(keys).toContain("vm.max_map_count");
    expect(keys).toContain("fs.inotify.max_user_instances");
    expect(keys).toContain("fs.inotify.max_user_watches");
  });

  test("every declared value is a positive number", () => {
    for (const entry of readNodeTunables(REPO_ROOT)) {
      expect(typeof entry.value).toBe("number");
      expect(entry.value as number).toBeGreaterThan(0);
    }
  });

  test("vm.max_map_count meets OpenSearch's documented floor of 262144", () => {
    // full-ai-cluster/k8s/applications/opensearch/Application.yaml runs the
    // chart with sysctlInit.enabled at its own default (false), so the host
    // value is the ONLY thing that can satisfy OpenSearch's bootstrap check.
    const entries = readNodeTunables(REPO_ROOT);
    const maxMapCount = entries.find((e) => e.key === "vm.max_map_count");
    expect(maxMapCount).toBeDefined();
    expect(maxMapCount!.value as number).toBeGreaterThanOrEqual(262144);
  });

  test("fs.inotify.max_user_instances covers the whole roster on one node, not just kind's 512", () => {
    // MEASURED on the owner's real node-5b2dfa (NixOS, 2026-10-01 ISO, ~9 min after first
    // boot, 150+ pods): kubevirt virt-handler in CrashLoopBackOff with
    //   "Failed to create an inotify watcher ... reason: too many open files"
    //   (pkg/certificates/bootstrap/cert-manager.go:105)
    // -- the host-wide per-user inotify INSTANCE pool (kernel default 128) exhausted by every
    // pod's watchers. 512 (kind's figure for a kind node) was the declared value and is too
    // low for the full roster; 8192 is the floor. Goes red on 512, 1024, or a dropped key.
    const entry = readNodeTunables(REPO_ROOT).find((e) => e.key === "fs.inotify.max_user_instances");
    expect(entry).toBeDefined();
    expect(entry!.value as number).toBeGreaterThanOrEqual(8192);
  });

  test("fs.inotify.max_user_watches is pinned at the kernel's own ceiling, RAM-independent", () => {
    const entry = readNodeTunables(REPO_ROOT).find((e) => e.key === "fs.inotify.max_user_watches");
    expect(entry).toBeDefined();
    expect(entry!.value as number).toBeGreaterThanOrEqual(1048576);
  });

  test("weaviate's privileged sysctl initContainer is OFF and the host carries the value it asked for", () => {
    // The chart's default `initContainers.sysctlInitContainer.enabled: true` renders a
    // privileged `docker.io/alpine:latest` init container that nothing preloads: on a fresh
    // install the pod sits in Init:0/1 behind an anonymous Docker Hub pull, the StatefulSet
    // reads Progressing, and the Application's conditions stay EMPTY. The fix is two-sided
    // and each half is useless without the other -- disable the container AND make the
    // host provide the value (chart default 524288) -- so the test pins both. Remove
    // either and it goes red: re-enable the container (or delete the key, which means
    // "chart default = enabled") and half 1 fails; revert the host value and half 2 does.
    const app = parseYaml(
      readFileSync(
        join(REPO_ROOT, "full-ai-cluster/k8s/applications/weaviate/Application.yaml"),
        "utf8",
      ),
    ) as { spec: { source: { helm: { valuesObject: Record<string, unknown> } } } };
    const values = app.spec.source.helm.valuesObject as {
      initContainers?: { sysctlInitContainer?: { enabled?: boolean } };
    };
    expect(values.initContainers?.sysctlInitContainer?.enabled).toBe(false);

    const maxMapCount = readNodeTunables(REPO_ROOT).find((e) => e.key === "vm.max_map_count");
    expect(maxMapCount).toBeDefined();
    expect(maxMapCount!.value as number).toBeGreaterThanOrEqual(524288);
  });

  test("resolves relative to the given repo root, not the process cwd", () => {
    // A reader that silently fell back to `process.cwd()` would pass in this
    // test file's own directory (bun test's cwd is the repo root here) and
    // never notice a caller that passed the wrong root.
    expect(() => readNodeTunables("/nonexistent-repo-root-xyz")).toThrow();
  });
});

describe("CI lanes that boot the real roster run under the host's tunables", () => {
  // The first-boot replica runs the real manifest roster in a k3s container ON the runner,
  // so it shares the runner's kernel sysctls -- a stock Ubuntu image, not the NixOS host.
  // Without the apply step it can never reproduce the inotify-exhaustion crash-loop class
  // (virt-handler 'too many open files') that only appeared on real hardware. Every job
  // that runs `first-boot-replica.ts --run` must therefore apply node-tunables.json in a
  // step BEFORE the one that boots the cluster.
  interface Step { readonly uses?: string; readonly run?: string }
  interface Job { readonly steps?: readonly Step[] }
  const workflow = parseYaml(
    readFileSync(join(REPO_ROOT, ".github/workflows/first-boot-replica.yml"), "utf8"),
  ) as { jobs: Record<string, Job> };

  const bootingJobs = Object.entries(workflow.jobs).filter(([, job]) =>
    (job.steps ?? []).some((s) => /first-boot-replica\.ts[\s\S]*--run\b/.test(s.run ?? "")),
  );

  test("the workflow has at least one job that boots the roster (so the loop below cannot be vacuous)", () => {
    expect(bootingJobs.length).toBeGreaterThanOrEqual(2);
  });

  for (const [name, job] of bootingJobs) {
    test(`job ${name} applies node-tunables before booting the roster`, () => {
      const steps = job.steps ?? [];
      const applyAt = steps.findIndex((s) => s.uses === "./.github/actions/apply-node-tunables");
      const bootAt = steps.findIndex((s) => /first-boot-replica\.ts[\s\S]*--run\b/.test(s.run ?? ""));
      expect(applyAt).toBeGreaterThanOrEqual(0);
      expect(applyAt).toBeLessThan(bootAt);
    });
  }
});

describe("malformed declarations are refused, never silently emptied", () => {
  function withTempRepo(json: string): string {
    const dir = mkdtempSync(join(tmpdir(), "node-tunables-test-"));
    const target = join(dir, NODE_TUNABLES_PATH);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, json, "utf8");
    return dir;
  }

  test("missing \"sysctls\" key throws", () => {
    const dir = withTempRepo(JSON.stringify({}));
    try {
      expect(() => readNodeTunables(dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("empty \"sysctls\" array throws rather than returning []", () => {
    const dir = withTempRepo(JSON.stringify({ sysctls: [] }));
    try {
      expect(() => readNodeTunables(dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an entry with no key throws", () => {
    const dir = withTempRepo(JSON.stringify({ sysctls: [{ value: 1 }] }));
    try {
      expect(() => readNodeTunables(dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an entry with no value throws", () => {
    const dir = withTempRepo(JSON.stringify({ sysctls: [{ key: "vm.max_map_count" }] }));
    try {
      expect(() => readNodeTunables(dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("rendering sysctl commands", () => {
  const sample: SysctlEntry = { key: "vm.max_map_count", value: 262144 };

  test("renders the exact command CI runs", () => {
    expect(sysctlCommand(sample)).toBe("sudo sysctl -w vm.max_map_count=262144");
  });

  test("renders one line per declared entry, in file order", () => {
    const entries: SysctlEntry[] = [
      { key: "a.b", value: 1 },
      { key: "c.d", value: 2 },
    ];
    expect(sysctlCommands(entries)).toEqual([
      "sudo sysctl -w a.b=1",
      "sudo sysctl -w c.d=2",
    ]);
  });

  test("every real declared entry round-trips through the renderer", () => {
    const entries = readNodeTunables(REPO_ROOT);
    const lines = sysctlCommands(entries);
    expect(lines.length).toBe(entries.length);
    for (const [i, entry] of entries.entries()) {
      expect(lines[i]).toBe(`sudo sysctl -w ${entry.key}=${entry.value}`);
    }
  });
});
