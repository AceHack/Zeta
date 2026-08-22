import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { realizeFromAgdaCubical } from "./setup-realizers/from-agda-cubical.ts";
import { realizeFromElan } from "./setup-realizers/from-elan.ts";
import { realizeFromInstaller } from "./setup-realizers/from-installer.ts";
import { realizeFromOllama } from "./setup-realizers/from-ollama.ts";
import { realizeFromShim } from "./setup-realizers/from-shim.ts";
import { realizeFromUrl } from "./setup-realizers/from-url.ts";
import { realizeFromUvVenv } from "./setup-realizers/from-uv-venv.ts";
import { repairCodexServiceTierConfig } from "./setup-realizers/from-bun-global.ts";
import { realizeFromUvTool } from "./setup-realizers/from-uv-tool.ts";
import { createContext, defaultRepoRoot } from "./setup-realizers/shared.ts";
import { getSetupRealizer, listSetupRealizerIds, listSetupRealizerInstallOrder, listPostMiseRealizerIds, listPreMiseRealizerIds } from "./setup-realizers/index.ts";

describe("setup-realizers registry", () => {
  test("install order lists all 17 realizers in graph order", () => {
    expect(listSetupRealizerInstallOrder()).toHaveLength(17);
    expect(listSetupRealizerInstallOrder()[0]).toBe("from-deb");
    expect(listSetupRealizerInstallOrder().at(-1)).toBe("from-git-hooks");
    expect(listPreMiseRealizerIds()).toEqual(["from-deb", "from-shim", "from-autotools-tarball"]);
    // 081KZKWB1FZ: from-bun-workspace leads the post-mise phase — mise has just
    // provided bun, and downstream realizers may rely on the repo's node_modules.
    expect(listPostMiseRealizerIds()[0]).toBe("from-bun-workspace");
    expect(listPostMiseRealizerIds()[1]).toBe("from-uv-tool");
  });

  test("lists Bun realizer ids in stable order", () => {
    expect(listSetupRealizerIds()).toEqual([
      "from-agda-cubical",
      "from-autotools-tarball",
      "from-bun-global",
      "from-bun-link",
      "from-bun-workspace",
      "from-deb",
      "from-dotnet-global",
      "from-dotnet-workload",
      "from-elan",
      "from-git-hooks",
      "from-installer",
      "from-ollama",
      "from-opam-git",
      "from-shim",
      "from-url",
      "from-uv-tool",
      "from-uv-venv",
    ]);
  });

  test("every registered id resolves", () => {
    for (const id of listSetupRealizerIds()) {
      expect(getSetupRealizer(id)).toBeDefined();
    }
  });

  test("default repo root reaches setup manifests", () => {
    const root = defaultRepoRoot();
    expect(existsSync(join(root, "Zeta.sln"))).toBe(true);
    expect(readFileSync(join(root, "tools/setup/manifests/from-dotnet-global"), "utf8")).toContain("dotnet-stryker");
  });
});

describe("repairCodexServiceTierConfig", () => {
  test("migrates deprecated default tier to flex", () => {
    const dir = mkdtempSync(join(tmpdir(), "codex-config-"));
    const codexDir = join(dir, ".codex");
    mkdirSync(codexDir, { recursive: true });
    writeFileSync(join(codexDir, "config.toml"), 'service_tier = "default"\n');
    expect(repairCodexServiceTierConfig(dir, false)).toBe(true);
    expect(readFileSync(join(codexDir, "config.toml"), "utf8")).toContain('"flex"');
  });
});

describe("realizeFromUvTool dry-run", () => {
  test("skips when manifest missing", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-"));
    const ctx = createContext({ repoRoot, dryRun: true });
    const result = await realizeFromUvTool(ctx);
    expect(result.skipped).toBe(true);
    expect(result.mechanism).toBe("from-uv-tool");
  });

  test("records install actions for manifest entries", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-"));
    const manifestDir = join(repoRoot, "tools/setup/manifests");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(join(manifestDir, "from-uv-tool"), "zeta-setup-realizer-probe-nonexistent\n");
    const ctx = createContext({ repoRoot, dryRun: true });
    const result = await realizeFromUvTool(ctx);
    expect(result.skipped).toBe(false);
    expect(result.actions).toEqual([
      "dry-run: uv tool upgrade --all",
      "dry-run: uv tool install zeta-setup-realizer-probe-nonexistent",
    ]);
  });
});

describe("realizeFromUrl dry-run", () => {
  test("skips when manifest missing", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-url-"));
    const ctx = createContext({ repoRoot, dryRun: true });
    const result = await realizeFromUrl(ctx);
    expect(result.skipped).toBe(true);
  });

  test("records download for missing dest", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-url-"));
    const manifestDir = join(repoRoot, "tools/setup/manifests");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      join(manifestDir, "from-url"),
      "tools/probe/jar.jar https://example.com/jar.jar sha256=0000000000000000000000000000000000000000000000000000000000000000\n",
    );
    const ctx = createContext({ repoRoot, dryRun: true });
    const result = await realizeFromUrl(ctx);
    expect(result.skipped).toBe(false);
    expect(result.actions.some((a) => a.includes("example.com/jar.jar"))).toBe(true);
  });

  // The defect this closes: from-url was the one fetcher that never verified.
  test("refuses a row with no sha256 pin", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-url-"));
    const manifestDir = join(repoRoot, "tools/setup/manifests");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      join(manifestDir, "from-url"),
      "tools/probe/jar.jar https://example.com/jar.jar\n",
    );
    const ctx = createContext({ repoRoot, dryRun: true });
    expect(realizeFromUrl(ctx)).rejects.toThrow("sha256= pin required");
  });
});

describe("realizeFromElan dry-run", () => {
  test("skips when manifest missing", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-elan-"));
    const ctx = createContext({ repoRoot, dryRun: true });
    const result = await realizeFromElan(ctx);
    expect(result.skipped).toBe(true);
  });

  test("runs dry-run path when manifest present", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-elan-"));
    const manifestDir = join(repoRoot, "tools/setup/manifests");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      join(manifestDir, "from-elan"),
      "elan https://example.com/elan-init.sh sha256=abc\n",
    );
    const ctx = createContext({ repoRoot, dryRun: true });
    const result = await realizeFromElan(ctx);
    expect(result.skipped).toBe(false);
    expect(result.actions.length).toBeGreaterThan(0);
  });
});

describe("realizeFromShim dry-run", () => {
  test("skips when manifest missing", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-shim-"));
    const ctx = createContext({ repoRoot, dryRun: true });
    const result = await realizeFromShim(ctx);
    expect(result.skipped).toBe(true);
  });
});

describe("realizeFromUvVenv dry-run", () => {
  test("skips without quantum opt-in", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-venv-"));
    const manifestDir = join(repoRoot, "tools/setup/manifests");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(join(manifestDir, "from-uv-venv"), "qsharp\n");
    const prev = process.env.ZETA_INSTALL_QUANTUM;
    delete process.env.ZETA_INSTALL_QUANTUM;
    delete process.env.ZETA_INSTALL_FULL;
    const ctx = createContext({ repoRoot, dryRun: true });
    const result = await realizeFromUvVenv(ctx);
    if (prev !== undefined) process.env.ZETA_INSTALL_QUANTUM = prev;
    expect(result.skipped).toBe(true);
  });
});

describe("realizeFromInstaller dry-run", () => {
  test("skips non-interactive without ZETA_INSTALL_FULL", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-installer-"));
    const manifestDir = join(repoRoot, "tools/setup/manifests");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(join(manifestDir, "from-installer"), "probe https://example.com/install.sh\n");
    const ctx = createContext({ repoRoot, dryRun: true });
    const stdinTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    const result = await realizeFromInstaller(ctx);
    Object.defineProperty(process.stdin, "isTTY", { value: stdinTTY, configurable: true });
    expect(result.skipped).toBe(true);
  });
});

describe("realizeFromAgdaCubical dry-run", () => {
  test("skips when manifest missing", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-agda-"));
    const ctx = createContext({ repoRoot, dryRun: true });
    const result = await realizeFromAgdaCubical(ctx);
    expect(result.skipped).toBe(true);
    expect(result.mechanism).toBe("from-agda-cubical");
  });

  test("with manifest present, either skips (no agda on host) or records the script action", async () => {
    // The realizer is a thin adapter over tools/setup/common/agda-cubical.sh and
    // gates on the HOST's agda; both branches are legitimate depending on the
    // machine running this test (slim hosts have no agda by design).
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-agda-"));
    const manifestDir = join(repoRoot, "tools/setup/manifests");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      join(manifestDir, "from-agda-cubical"),
      "cubical https://github.com/agda/cubical.git v0.9 agda=2.8 commit=abc\n",
    );
    const ctx = createContext({ repoRoot, dryRun: true });
    const result = await realizeFromAgdaCubical(ctx);
    if (result.skipped) {
      expect(result.actions).toEqual([]);
    } else {
      expect(result.actions.some((a) => a.includes("agda-cubical.sh"))).toBe(true);
    }
  });
});

describe("realizeFromOllama dry-run", () => {
  test("skips when manifest missing", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-ollama-"));
    const ctx = createContext({ repoRoot, dryRun: true });
    const result = await realizeFromOllama(ctx);
    expect(result.skipped).toBe(true);
  });
});
