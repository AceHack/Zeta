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
  test("emits a self-contained relay worker, runtime, and explicit active page", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "zeta-browser-pwa-"));
    roots.push(outDir);
    const result = await buildBrowserPwaAssets({ outDir });

    expect(result).toMatchObject({ ok: true, value: { outDir } });
    expect(existsSync(join(outDir, "sw.js"))).toBe(true);
    expect(existsSync(join(outDir, "darkhall-browser-pwa.js"))).toBe(true);
    expect(existsSync(join(outDir, "darkhall-browser-page.js"))).toBe(true);
    expect(existsSync(join(outDir, "node.html"))).toBe(true);
    expect(existsSync(join(outDir, "manifest.webmanifest"))).toBe(true);
    expect(existsSync(join(outDir, "room.css"))).toBe(true);

    const worker = readFileSync(join(outDir, "sw.js"), "utf8");
    expect(worker).toContain("checkpoint-invalidated");
    expect(worker).toContain("database-invalidated");
    expect(worker).toContain("skipWaiting");
    expect(worker).toContain("clients.claim");
    expect(worker).not.toMatch(/from\s+["']\.\//);

    const runtime = readFileSync(join(outDir, "darkhall-browser-pwa.js"), "utf8");
    expect(runtime).toContain("startNativeDarkHallPwa");
    expect(runtime).toContain("broadcast-channel");
    expect(runtime).toContain("service-worker");
    expect(runtime).not.toMatch(/from\s+["']\.\//);

    const pageEntry = readFileSync(join(outDir, "darkhall-browser-page.js"), "utf8");
    expect(pageEntry).toContain("startNativeDarkHallBrowserPage");
    expect(pageEntry).toContain("__zetaDarkHallPage");
    expect(pageEntry).not.toMatch(/from\s+["']\.\//);

    const page = readFileSync(join(outDir, "node.html"), "utf8");
    expect(page).toContain('<link rel="manifest" href="./manifest.webmanifest">');
    expect(page).toContain('<script type="module" src="./darkhall-browser-page.js"></script>');
    expect(page).toContain('data-pwa-status="starting"');
    expect(page).not.toMatch(/<script(?! type="module" src="\.\/darkhall-browser-page\.js")/u);

    const manifest = JSON.parse(readFileSync(join(outDir, "manifest.webmanifest"), "utf8")) as {
      readonly id: string;
      readonly start_url: string;
      readonly scope: string;
      readonly display: string;
    };
    expect(manifest.id).toBe("./node.html");
    expect(manifest.start_url).toBe("./node.html");
    expect(manifest.scope).toBe("./");
    expect(manifest.display).toBe("standalone");
    expect(readFileSync(join(outDir, "room.css"), "utf8")).toContain(".zeta-room-nav");

    const passivePage = readFileSync(join(import.meta.dir, "..", "..", "..", "hall", "room", "index.html"), "utf8");
    expect(passivePage).toContain('href="./node.html"');
    expect(passivePage).toContain("zero JS");
    expect(passivePage).not.toContain("<script");
  });

  test("rejects an empty output path without touching the filesystem", async () => {
    const result = await buildBrowserPwaAssets({ outDir: "" });
    expect(result).toEqual({
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
