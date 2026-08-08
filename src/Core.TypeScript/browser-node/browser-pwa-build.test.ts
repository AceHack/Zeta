import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBrowserPwaAssets } from "./browser-pwa-build";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("browser PWA production build", () => {
  test("emits a self-contained relay worker and importable Dark Hall runtime", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "zeta-browser-pwa-"));
    roots.push(outDir);
    const result = await buildBrowserPwaAssets({ outDir });

    expect(result).toMatchObject({ ok: true, value: { outDir } });
    expect(existsSync(join(outDir, "sw.js"))).toBe(true);
    expect(existsSync(join(outDir, "darkhall-browser-pwa.js"))).toBe(true);

    const worker = readFileSync(join(outDir, "sw.js"), "utf8");
    expect(worker).toContain("checkpoint-invalidated");
    expect(worker).toContain("skipWaiting");
    expect(worker).toContain("clients.claim");
    expect(worker).not.toMatch(/from\s+["']\.\//);

    const runtime = readFileSync(join(outDir, "darkhall-browser-pwa.js"), "utf8");
    expect(runtime).toContain("startNativeDarkHallPwa");
    expect(runtime).toContain("broadcast-channel");
    expect(runtime).toContain("service-worker");
    expect(runtime).not.toMatch(/from\s+["']\.\//);
  });

  test("rejects an empty output path without touching the filesystem", async () => {
    await expect(buildBrowserPwaAssets({ outDir: "" })).resolves.toEqual({
      ok: false,
      error: "out-dir must be a non-empty path",
    });
  });

  test("returns a typed refusal when the output path cannot be created", async () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-browser-pwa-refusal-"));
    roots.push(root);
    const filePath = join(root, "not-a-directory");
    writeFileSync(filePath, "occupied", "utf8");

    const result = await buildBrowserPwaAssets({ outDir: filePath });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });
});
