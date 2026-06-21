import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { repairCodexServiceTierConfig } from "./setup-realizers/from-bun-global.ts";
import { realizeFromUvTool } from "./setup-realizers/from-uv-tool.ts";
import { createContext } from "./setup-realizers/shared.ts";
import { getSetupRealizer, listSetupRealizerIds } from "./setup-realizers/index.ts";

describe("setup-realizers registry", () => {
  test("lists Bun realizer ids in stable order", () => {
    expect(listSetupRealizerIds()).toEqual(["from-bun-global", "from-uv-tool"]);
  });

  test("every registered id resolves", () => {
    for (const id of listSetupRealizerIds()) {
      expect(getSetupRealizer(id)).toBeDefined();
    }
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
    expect(result.actions.some((a) => a.includes("uv tool install zeta-setup-realizer-probe-nonexistent"))).toBe(true);
  });
});
