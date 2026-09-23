// src/Core.TypeScript/cluster/storage-capabilities.test.ts
//
// Falsifiers for "no chart names a storage provider". The load-bearing ones:
// the allowlist refuses a provider name nobody thought to list, the render is
// checked as well as the checked-in YAML, and each cluster's bindings are held
// to one default + WaitForFirstConsumer + the capabilities it promises.

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  auditBindings,
  auditStorageCapabilities,
  DEFAULT_STORAGE_CAPABILITY,
  devStorageBindings,
  findProviderNamedClasses,
  metalPoolCapabilities,
  metalStorageBindings,
  STORAGE_CAPABILITIES,
  storageClassValues,
  type StorageClassBinding,
} from "./storage-capabilities.ts";

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-storage-cap-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const APP = "full-ai-cluster/k8s/applications/demo/Application.yaml";

describe("storageClassValues — what the scanner reads", () => {
  test("reads every key shape a class hides under, and skips what is not a name", () => {
    const text = [
      "spec:",
      "  storageClassName: zeta-block-replicated",
      "  persistence:",
      '    storageClass: "zeta-block-local"   # quoted, commented',
      "  - storageClass: 'zeta-shared'",
      "  schema:",
      "    storageClassName: { type: string }",
      "  blank:",
      "    storageClass: \"\"",
      "  unset:",
      "    storageClassName:",
    ].join("\n");
    expect(storageClassValues(text).map((entry) => entry.value)).toEqual([
      "zeta-block-replicated",
      "zeta-block-local",
      "zeta-shared",
    ]);
  });
});

describe("findProviderNamedClasses — the ALLOWLIST", () => {
  test("a provider name is refused, and the refusal names it as a PROVIDER", () => {
    const root = tree({ [APP]: "spec:\n  storageClassName: longhorn\n" });
    const found = findProviderNamedClasses(root);
    expect(found).toHaveLength(1);
    expect(found[0]?.where).toBe(`${APP}:2`);
    expect(found[0]?.why).toContain('"longhorn" is a PROVIDER name');
  });

  test("a name on NO list is refused too -- a denylist would have passed it", () => {
    const root = tree({ [APP]: "spec:\n  storageClassName: acme-fast-nvme\n" });
    const found = findProviderNamedClasses(root);
    expect(found.map((v) => v.value)).toEqual(["acme-fast-nvme"]);
    expect(found[0]?.why).toContain("is not a storage capability");
  });

  test("the three capability names and the blank default pass", () => {
    const body = STORAGE_CAPABILITIES.map((name) => `  - storageClassName: ${name}`).join("\n");
    const root = tree({ [APP]: `spec:\n${body}\n  - storageClassName: ""\n` });
    expect(findProviderNamedClasses(root)).toEqual([]);
  });

  test("bootstrap manifests are scanned too, not only applications/", () => {
    const root = tree({ "full-ai-cluster/k8s/bootstrap/x.yaml": "storageClass: zeta-local-path\n" });
    expect(findProviderNamedClasses(root).map((v) => v.value)).toEqual(["zeta-local-path"]);
  });

  test("the RENDER is checked: a chart default that emits a provider name is refused", () => {
    const snapshot = JSON.stringify({
      rendered: [
        { appId: "full-ai-cluster/a", name: "ok", storageClassName: "zeta-block-local" },
        { appId: "full-ai-cluster/b", name: "blank", storageClassName: "" },
        { appId: "full-ai-cluster/c", name: "bad", storageClassName: "local-path" },
      ],
    });
    const root = tree({ "src/Core.TypeScript/cluster/rendered-storage-claims.snapshot.json": snapshot });
    const found = findProviderNamedClasses(root);
    expect(found.map((v) => v.where)).toEqual([
      "src/Core.TypeScript/cluster/rendered-storage-claims.snapshot.json full-ai-cluster/c bad",
    ]);
  });
});

describe("auditBindings — each cluster binds what it promises", () => {
  const sc = (name: string, provisioner: string, isDefault = false, bindingMode = "WaitForFirstConsumer"): StorageClassBinding => ({
    name,
    provisioner,
    isDefault,
    bindingMode,
  });
  const METAL_OK = [
    sc("zeta-block-local", "rancher.io/local-path", true),
    sc("zeta-block-replicated", "driver.longhorn.io"),
    sc("zeta-shared", "driver.longhorn.io"),
  ];
  const DEV_OK = [sc("zeta-block-local", "rancher.io/local-path", true), sc("zeta-block-replicated", "rancher.io/local-path")];

  test("the intended shapes pass", () => {
    expect(auditBindings("metal", METAL_OK)).toEqual([]);
    expect(auditBindings("dev", DEV_OK)).toEqual([]);
  });

  test("metal must bind all three; dev must NOT bind zeta-shared (RWX it cannot serve)", () => {
    expect(auditBindings("metal", METAL_OK.slice(0, 2)).map((f) => f.problem)).toEqual(['does not bind "zeta-shared"']);
    const devWithShared = [...DEV_OK, sc("zeta-shared", "rancher.io/local-path")];
    expect(auditBindings("dev", devWithShared).map((f) => f.problem).join()).toContain("RWX");
  });

  test("exactly one default, and it is the declared default capability", () => {
    const twoDefaults = [...DEV_OK.slice(0, 1), sc("zeta-block-replicated", "rancher.io/local-path", true)];
    expect(auditBindings("dev", twoDefaults).map((f) => f.problem).join()).toContain("exactly one is required");
    const wrongDefault = [sc("zeta-block-local", "rancher.io/local-path"), sc("zeta-block-replicated", "rancher.io/local-path", true)];
    expect(auditBindings("dev", wrongDefault).map((f) => f.problem).join()).toContain(`"${DEFAULT_STORAGE_CAPABILITY}"`);
  });

  test("Immediate binding is refused on every capability class", () => {
    const immediate = [DEV_OK[0] as StorageClassBinding, sc("zeta-block-replicated", "rancher.io/local-path", false, "Immediate")];
    expect(auditBindings("dev", immediate).map((f) => f.problem).join()).toContain("binds Immediate");
  });

  test("a binding file that declares a provider-named class is refused", () => {
    expect(auditBindings("dev", [...DEV_OK, sc("longhorn", "rancher.io/local-path")]).map((f) => f.problem).join()).toContain(
      'provider-named class "longhorn"',
    );
  });
});

describe("the SHIPPED tree", () => {
  test("no manifest names a provider, and both clusters bind what they promise", () => {
    expect(auditStorageCapabilities()).toEqual({ providerNamed: [], bindings: [] });
  });

  test("metal binds from the nix module and dev from the manifests dir -- read, not restated", () => {
    expect(metalStorageBindings().map((b) => `${b.name}=${b.provisioner}`).sort()).toEqual([
      "zeta-block-local=rancher.io/local-path",
      "zeta-block-replicated=driver.longhorn.io",
      "zeta-shared=driver.longhorn.io",
    ]);
    expect(devStorageBindings().map((b) => `${b.name}=${b.provisioner}`).sort()).toEqual([
      "zeta-block-local=rancher.io/local-path",
      "zeta-block-replicated=rancher.io/local-path",
    ]);
  });

  test("the ladder's pool is DERIVED from the metal provisioner, and fails closed when unreadable", () => {
    expect(metalPoolCapabilities()).toEqual(["zeta-block-replicated", "zeta-shared"]);
    expect(metalPoolCapabilities(mkdtempSync(join(tmpdir(), "zeta-empty-")))).toEqual(["zeta-block-replicated"]);
  });
});
