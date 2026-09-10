import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { realizeFromAgdaCubical } from "./setup-realizers/from-agda-cubical.ts";
import { realizeFromElan } from "./setup-realizers/from-elan.ts";
import { realizeFromInstaller } from "./setup-realizers/from-installer.ts";
import { realizeFromOllama } from "./setup-realizers/from-ollama.ts";
import { realizeFromShim } from "./setup-realizers/from-shim.ts";
import { realizeFromUrl, rollingRemedy } from "./setup-realizers/from-url.ts";
import { realizeFromUvVenv } from "./setup-realizers/from-uv-venv.ts";
import { repairCodexServiceTierConfig } from "./setup-realizers/from-bun-global.ts";
import { realizeFromUvTool } from "./setup-realizers/from-uv-tool.ts";
import { createContext, defaultRepoRoot } from "./setup-realizers/shared.ts";
import { getSetupRealizer, listSetupRealizerIds, listSetupRealizerInstallOrder, listPostMiseRealizerIds, listPreMiseRealizerIds } from "./setup-realizers/index.ts";

describe("setup-realizers registry", () => {
  test("install order lists all 19 realizers in graph order", () => {
    expect(listSetupRealizerInstallOrder()).toHaveLength(19);
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
      "from-uv-project",
      "from-uv-tool",
      "from-uv-venv",
      "from-zip",
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

  /**
   * The wedge. Before this, an on-disk file whose digest no longer matched made
   * `from-url` THROW -- and `from-url` is not best-effort, so `install.sh`
   * aborted. Every already-provisioned machine hits that the moment a pin moves,
   * which under a rolling row is roughly weekly, and the error printed no
   * remedy. The stale bytes are not evidence of anything; the pin is.
   *
   * Fail-closed is untouched: the replacement is still verified before it lands.
   */
  function wedgeRepo(): string {
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-url-"));
    const manifestDir = join(repoRoot, "tools/setup/manifests");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      join(manifestDir, "from-url"),
      "tools/probe/jar.jar https://example.com/jar.jar sha256=" + "0".repeat(64) + "\n",
    );
    mkdirSync(join(repoRoot, "tools/probe"), { recursive: true });
    writeFileSync(join(repoRoot, "tools/probe/jar.jar"), "stale bytes from an older pin");
    return repoRoot;
  }

  test("a stale file on disk is discarded and re-fetched, not wedged", async () => {
    const repoRoot = wedgeRepo();
    const ctx = createContext({ repoRoot, dryRun: true });
    const result = await realizeFromUrl(ctx);
    expect(result.skipped).toBe(false);
    // It went on to fetch rather than aborting the whole realizer...
    expect(result.actions.some((a) => a.includes("example.com/jar.jar"))).toBe(true);
    // ...and the bytes that disagreed with the pin are gone.
    expect(existsSync(join(repoRoot, "tools/probe/jar.jar"))).toBe(false);
  });

  test("the discard is LOUD -- it names both digests", async () => {
    const repoRoot = wedgeRepo();
    const warnings: string[] = [];
    const base = createContext({ repoRoot, dryRun: true });
    const ctx = { ...base, warn: (msg: string) => { warnings.push(msg); base.warn(msg); } };
    await realizeFromUrl(ctx);
    expect(warnings.some((w) => w.includes("disagrees with the pin"))).toBe(true);
    expect(warnings.some((w) => w.includes("0".repeat(64)))).toBe(true);
  });

  test("an ABSENT dest is not reported as a stale one", async () => {
    // Vacuity control on the discard branch: if it fired for a missing file it
    // would warn about bytes that were never there, and the warning would stop
    // meaning anything.
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-url-"));
    const manifestDir = join(repoRoot, "tools/setup/manifests");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      join(manifestDir, "from-url"),
      "tools/probe/jar.jar https://example.com/jar.jar sha256=" + "0".repeat(64) + "\n",
    );
    const warnings: string[] = [];
    const base = createContext({ repoRoot, dryRun: true });
    const ctx = { ...base, warn: (msg: string) => { warnings.push(msg); base.warn(msg); } };
    await realizeFromUrl(ctx);
    expect(warnings.some((w) => w.includes("disagrees with the pin"))).toBe(false);
  });

  test("a dest that cannot be read at all is UNKNOWN, not absent", async () => {
    // ENOENT means "not there". Every other errno means the question could not
    // be answered, and answering it anyway would let a directory, a permission
    // failure, or an I/O error read as a clean install.
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-url-"));
    const manifestDir = join(repoRoot, "tools/setup/manifests");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      join(manifestDir, "from-url"),
      "tools/probe/jar.jar https://example.com/jar.jar sha256=" + "0".repeat(64) + "\n",
    );
    mkdirSync(join(repoRoot, "tools/probe/jar.jar"), { recursive: true });
    const ctx = createContext({ repoRoot, dryRun: true });
    expect(realizeFromUrl(ctx)).rejects.toThrow();
  });

  test("a matching file on disk is left alone and NOT re-fetched", async () => {
    // Vacuity control: without this, "discard and re-fetch" could be firing on
    // every run, which would make the digest check decorative.
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-url-"));
    const manifestDir = join(repoRoot, "tools/setup/manifests");
    mkdirSync(manifestDir, { recursive: true });
    const body = "exactly the pinned bytes";
    const digest = createHash("sha256").update(body).digest("hex");
    writeFileSync(join(manifestDir, "from-url"), `tools/probe/jar.jar https://example.com/jar.jar sha256=${digest}\n`);
    mkdirSync(join(repoRoot, "tools/probe"), { recursive: true });
    writeFileSync(join(repoRoot, "tools/probe/jar.jar"), body);
    const ctx = createContext({ repoRoot, dryRun: true });
    const result = await realizeFromUrl(ctx);
    expect(result.actions.some((a) => a.includes("example.com/jar.jar"))).toBe(false);
    expect(existsSync(join(repoRoot, "tools/probe/jar.jar"))).toBe(true);
  });
});

describe("from-url rolling diagnosis", () => {
  // A rolling rebuild is not corruption, and a message that reads like
  // corruption sends the reader hunting for a compromise that did not happen.
  test("the remedy names the event, both digests, and the re-pin command", () => {
    const message = rollingRemedy("src/Core.TLA/tla2tools.jar", "a".repeat(64), "b".repeat(64), "some-tag");
    expect(message).toContain("REBUILT this asset in place");
    expect(message).toContain("rolling=some-tag");
    expect(message).toContain("a".repeat(64));
    expect(message).toContain("b".repeat(64));
    expect(message).toContain("bun tools/setup/repin-rolling.ts src/Core.TLA/tla2tools.jar");
  });

  // The whole point of the regime, and the sentence a reader in a hurry needs.
  test("the remedy says a hand-bumped digest is the failure mode", () => {
    const message = rollingRemedy("x.jar", "a".repeat(64), "b".repeat(64), "t");
    expect(message).toContain("Do NOT hand-edit");
    expect(message).toContain("without a re-measure");
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
      `elan https://example.com/elan-init.sh sha256=${"a".repeat(64)}\n`,
    );
    const ctx = createContext({ repoRoot, dryRun: true });
    const result = await realizeFromElan(ctx);
    expect(result.skipped).toBe(false);
    expect(result.actions.length).toBeGreaterThan(0);
  });

  // THE PIN WAS NEVER VALIDATED HERE. This row said `sha256=abc` until 2026-09-10 and this
  // mechanism accepted it: the old check was `sha256 === undefined`, so any non-empty string
  // passed and a three-character "digest" reached `verifySha256File`, where it could only ever
  // fail at install time on a real machine. Routing the row through the shared `resolvePin`
  // (081M25Z29W4087G0R002Y0Q1MG) refuses it at parse time instead, and says what to write.
  test("a malformed digest is refused rather than carried to install time", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-elan-"));
    const manifestDir = join(repoRoot, "tools/setup/manifests");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(join(manifestDir, "from-elan"), "elan https://example.com/elan-init.sh sha256=abc\n");
    const ctx = createContext({ repoRoot, dryRun: true });
    await expect(realizeFromElan(ctx)).rejects.toThrow(/64 hex chars/u);
  });

  test("a row with no pin at all is still refused, and the refusal names the declarations", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "setup-realize-elan-"));
    const manifestDir = join(repoRoot, "tools/setup/manifests");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(join(manifestDir, "from-elan"), "elan https://example.com/elan-init.sh\n");
    const ctx = createContext({ repoRoot, dryRun: true });
    await expect(realizeFromElan(ctx)).rejects.toThrow(/sha256= pin required/u);
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
