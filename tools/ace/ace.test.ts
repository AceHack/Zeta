import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync, closeSync, openSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs, main } from "./ace.ts";
import { listInstalled } from "./store.ts";

describe("parseArgs", () => {
  test("no args returns help", () => {
    const result = parseArgs([]);
    expect(result).toEqual({ command: "help" });
  });

  test("--help returns help", () => {
    expect(parseArgs(["--help"])).toEqual({ command: "help" });
  });

  test("list with defaults", () => {
    const result = parseArgs(["list"]);
    expect("error" in result).toBe(false);
    if (!("error" in result) && result.command === "list") {
      expect(result.json).toBe(false);
    }
  });

  test("list --json", () => {
    const result = parseArgs(["list", "--json"]);
    expect("error" in result).toBe(false);
    if (!("error" in result) && result.command === "list") {
      expect(result.json).toBe(true);
    }
  });

  test("list --store custom-path", () => {
    const result = parseArgs(["list", "--store", "/tmp/ace-store"]);
    expect("error" in result).toBe(false);
    if (!("error" in result) && result.command === "list") {
      expect(result.storePath).toBe("/tmp/ace-store");
    }
  });

  test("--store without path is an error", () => {
    const result = parseArgs(["list", "--store"]);
    expect("error" in result).toBe(true);
  });

  test("install requires a url/path argument", () => {
    const result = parseArgs(["install"]);
    expect("error" in result).toBe(true);
  });

  test("install <url> parses", () => {
    const result = parseArgs(["install", "https://example.com/p.json"]);
    expect("error" in result).toBe(false);
    if (!("error" in result) && result.command === "install") {
      expect(result.source).toBe("https://example.com/p.json");
    }
  });

  test("verify requires a hash argument", () => {
    const result = parseArgs(["verify"]);
    expect("error" in result).toBe(true);
  });

  test("remove + inspect are still unimplemented", () => {
    for (const cmd of ["remove", "inspect"]) {
      expect("error" in parseArgs([cmd])).toBe(true);
    }
  });

  test("unknown command returns error", () => {
    const result = parseArgs(["bogus"]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("Unknown command");
    }
  });
});

describe("listInstalled", () => {
  test("returns empty array for nonexistent store", () => {
    const result = listInstalled("/tmp/ace-nonexistent-" + Date.now());
    expect(result).toEqual([]);
  });

  test("returns empty array when store path is a file", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    const filePath = join(dir, "not-a-directory");
    closeSync(openSync(filePath, "w"));
    const result = listInstalled(filePath);
    expect(result).toEqual([]);
  });

  test("returns empty array when store directory is unreadable", () => {
    // Skip when running as root (chmod has no effect)
    if (process.getuid && process.getuid() === 0) return;
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    chmodSync(dir, 0o000);
    try {
      const result = listInstalled(dir);
      expect(result).toEqual([]);
    } finally {
      chmodSync(dir, 0o755);
    }
  });

  test("returns empty array for empty store", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    const result = listInstalled(dir);
    expect(result).toEqual([]);
  });

  test("skips directories without manifest.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    mkdirSync(join(dir, "sha256-abc123"));
    const result = listInstalled(dir);
    expect(result).toEqual([]);
  });

  test("reads valid manifests", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    const hash = "sha256-aabbccdd";
    const pkgDir = join(dir, hash);
    mkdirSync(pkgDir);
    const manifest = {
      format_version: 1,
      name: "test-package",
      version: "1.0.0",
      content_hash: "sha256:aabbccdd",
      description: "A test DLC",
    };
    writeFileSync(join(pkgDir, "manifest.json"), JSON.stringify(manifest));

    const result = listInstalled(dir);
    expect(result.length).toBe(1);
    const first = result[0]!;
    expect(first.hash).toBe(hash);
    expect(first.manifest.name).toBe("test-package");
    expect(first.manifest.description).toBe("A test DLC");
  });

  test("skips malformed manifests", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    const pkgDir = join(dir, "bad-pkg");
    mkdirSync(pkgDir);
    writeFileSync(join(pkgDir, "manifest.json"), "not json");

    const result = listInstalled(dir);
    expect(result).toEqual([]);
  });

  test("skips manifests missing required fields", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    const pkgDir = join(dir, "incomplete");
    mkdirSync(pkgDir);
    writeFileSync(join(pkgDir, "manifest.json"), JSON.stringify({ name: "x" }));

    const result = listInstalled(dir);
    expect(result).toEqual([]);
  });

  test("skips manifests missing version field", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    const pkgDir = join(dir, "no-version");
    mkdirSync(pkgDir);
    writeFileSync(
      join(pkgDir, "manifest.json"),
      JSON.stringify({ format_version: 1, name: "x", content_hash: "sha256:abc" }),
    );

    const result = listInstalled(dir);
    expect(result).toEqual([]);
  });

  test("sorts by name", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    for (const pair of [["h2", "zebra"], ["h1", "alpha"]]) {
      const pkgDir = join(dir, pair[0]!);
      mkdirSync(pkgDir);
      writeFileSync(
        join(pkgDir, "manifest.json"),
        JSON.stringify({
          format_version: 1,
          name: pair[1],
          version: "1.0.0",
          content_hash: `sha256:${pair[0]}`,
        }),
      );
    }

    const result = listInstalled(dir);
    expect(result.length).toBe(2);
    expect(result[0]!.manifest.name).toBe("alpha");
    expect(result[1]!.manifest.name).toBe("zebra");
  });
});

describe("main", () => {
  test("help returns 0", async () => {
    expect(await main(["help"])).toBe(0);
  });

  test("list on empty store returns 0", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    expect(await main(["list", "--store", dir])).toBe(0);
  });

  test("list --json on empty store returns 0", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    expect(await main(["list", "--store", dir, "--json"])).toBe(0);
  });

  test("unknown command returns 64", async () => {
    expect(await main(["bogus"])).toBe(64);
  });

  test("list with populated store returns 0", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    const pkgDir = join(dir, "sha256-test");
    mkdirSync(pkgDir);
    writeFileSync(
      join(pkgDir, "manifest.json"),
      JSON.stringify({
        format_version: 1,
        name: "demo-dlc",
        version: "0.1.0",
        content_hash: "sha256:test",
        description: "Demo package",
      }),
    );
    expect(await main(["list", "--store", dir])).toBe(0);
  });
});
