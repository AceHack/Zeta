import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveRepoRelativeDest, verifySha256File } from "./curl-fetch.ts";

describe("setup-realizers/curl-fetch", () => {
  test("resolveRepoRelativeDest handles repo-relative and absolute paths", () => {
    const repo = "/repo";
    expect(resolveRepoRelativeDest(repo, "tools/x.jar")).toBe("/repo/tools/x.jar");
    expect(resolveRepoRelativeDest(repo, "/tmp/x.jar")).toBe("/tmp/x.jar");
  });

  test("verifySha256File accepts matching digest", () => {
    const dir = mkdtempSync(join(tmpdir(), "curl-fetch-"));
    const file = join(dir, "probe.txt");
    writeFileSync(file, "hello");
    verifySha256File(
      file,
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
    expect(true).toBe(true);
  });
});
