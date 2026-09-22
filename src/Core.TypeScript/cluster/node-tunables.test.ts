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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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

  test("resolves relative to the given repo root, not the process cwd", () => {
    // A reader that silently fell back to `process.cwd()` would pass in this
    // test file's own directory (bun test's cwd is the repo root here) and
    // never notice a caller that passed the wrong root.
    expect(() => readNodeTunables("/nonexistent-repo-root-xyz")).toThrow();
  });
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
