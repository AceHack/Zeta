import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { checkFile } from "./check-path-forms.ts";

function setupRepo(): {
  root: string;
  cleanup: () => void;
} {
  const root = mkdtempSync(join(tmpdir(), "check-path-forms-"));
  spawnSync("git", ["init", "--quiet"], { cwd: root, stdio: "ignore" });
  spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: root, stdio: "ignore" });
  spawnSync("git", ["config", "user.name", "test"], { cwd: root, stdio: "ignore" });

  mkdirSync(join(root, "tools", "checker"), { recursive: true });
  writeFileSync(join(root, "tools", "checker", "main.ts"), "// main");
  writeFileSync(join(root, "tools", "checker", "utils.ts"), "// utils");
  writeFileSync(join(root, "README.md"), "# Repo");

  spawnSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
  spawnSync("git", ["commit", "-m", "init", "--quiet"], { cwd: root, stdio: "ignore" });

  return {
    root,
    cleanup: () => {
      try { rmSync(root, { recursive: true, force: true }); } catch {}
    },
  };
}

describe("checkFile", () => {
  test("detects path-form drift when same file has two forms", () => {
    const fx = setupRepo();
    try {
      const md = join(fx.root, "tools", "checker", "doc.md");
      writeFileSync(
        md,
        [
          "# Doc",
          "",
          "See `tools/checker/main.ts` for the implementation.",
          "",
          "The `main.ts` file also exports a CLI.",
          "",
        ].join("\n"),
      );
      const result = checkFile(md);
      expect(result.ok).toBe(true);
      expect(result.findings.length).toBe(1);
      expect(result.findings[0]!.forms.length).toBe(2);
      const forms = result.findings[0]!.forms.map((f) => f.path).sort();
      expect(forms).toEqual(["main.ts", "tools/checker/main.ts"]);
    } finally {
      fx.cleanup();
    }
  });

  test("no drift when all references use the same form", () => {
    const fx = setupRepo();
    try {
      const md = join(fx.root, "tools", "checker", "doc.md");
      writeFileSync(
        md,
        [
          "# Doc",
          "",
          "See `tools/checker/main.ts` for the implementation.",
          "",
          "Also see `tools/checker/main.ts` for the CLI.",
          "",
        ].join("\n"),
      );
      const result = checkFile(md);
      expect(result.ok).toBe(true);
      expect(result.findings).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  test("no drift when different files are referenced", () => {
    const fx = setupRepo();
    try {
      const md = join(fx.root, "tools", "checker", "doc.md");
      writeFileSync(
        md,
        [
          "# Doc",
          "",
          "See `tools/checker/main.ts` for the implementation.",
          "",
          "And `tools/checker/utils.ts` for helpers.",
          "",
        ].join("\n"),
      );
      const result = checkFile(md);
      expect(result.ok).toBe(true);
      expect(result.findings).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  test("no findings for paths that don't resolve on disk", () => {
    const fx = setupRepo();
    try {
      const md = join(fx.root, "doc.md");
      writeFileSync(
        md,
        [
          "# Doc",
          "",
          "See `nonexistent/path.ts` for nothing.",
          "",
          "Also `path.ts` doesn't exist.",
          "",
        ].join("\n"),
      );
      const result = checkFile(md);
      expect(result.ok).toBe(true);
      expect(result.findings).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  test("returns ok=false for missing input file", () => {
    const result = checkFile("/no/such/path/check-path-forms-test.md");
    expect(result.ok).toBe(false);
    expect(result.findings).toEqual([]);
  });

  test("returns ok=false for directory input", () => {
    const fx = setupRepo();
    try {
      const result = checkFile(fx.root);
      expect(result.ok).toBe(false);
      expect(result.findings).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  test("detects drift across markdown link and backtick forms", () => {
    const fx = setupRepo();
    try {
      const md = join(fx.root, "tools", "checker", "doc.md");
      writeFileSync(
        md,
        [
          "# Doc",
          "",
          "See [the main file](tools/checker/main.ts) for details.",
          "",
          "The `main.ts` implementation is straightforward.",
          "",
        ].join("\n"),
      );
      const result = checkFile(md);
      expect(result.ok).toBe(true);
      expect(result.findings.length).toBe(1);
    } finally {
      fx.cleanup();
    }
  });

  test("handles multiple drift groups independently", () => {
    const fx = setupRepo();
    try {
      const md = join(fx.root, "tools", "checker", "doc.md");
      writeFileSync(
        md,
        [
          "# Doc",
          "",
          "See `tools/checker/main.ts` and `tools/checker/utils.ts`.",
          "",
          "Short: `main.ts` and `utils.ts`.",
          "",
        ].join("\n"),
      );
      const result = checkFile(md);
      expect(result.ok).toBe(true);
      expect(result.findings.length).toBe(2);
    } finally {
      fx.cleanup();
    }
  });

  test("clean file with no path claims produces no findings", () => {
    const fx = setupRepo();
    try {
      const md = join(fx.root, "doc.md");
      writeFileSync(md, "# Just a heading\n\nNo paths here.\n");
      const result = checkFile(md);
      expect(result.ok).toBe(true);
      expect(result.findings).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });
});
