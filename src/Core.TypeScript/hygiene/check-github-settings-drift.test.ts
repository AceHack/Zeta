import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { parseArgs } from "./check-github-settings-drift";

let priorGhRepo: string | undefined;

beforeEach(() => {
  priorGhRepo = process.env["GH_REPO"];
  delete process.env["GH_REPO"];
});

afterEach(() => {
  if (priorGhRepo === undefined) delete process.env["GH_REPO"];
  else process.env["GH_REPO"] = priorGhRepo;
});

describe("parseArgs", () => {
  test("--repo OWNER/NAME → success and default expected path", async () => {
    const result = await parseArgs(["--repo", "Lucent-Financial-Group/Zeta"]);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.repo).toBe("Lucent-Financial-Group/Zeta");
      expect(result.args.expected).toMatch(/github-settings\.expected\.json$/);
    }
  });

  test("--expected PATH overrides default", async () => {
    const result = await parseArgs([
      "--repo",
      "AceHack/Zeta",
      "--expected",
      "/tmp/custom-snapshot.json",
    ]);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.expected).toBe("/tmp/custom-snapshot.json");
    }
  });

  test("--repo without value returns an error", async () => {
    const result = await parseArgs(["--repo"]);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("--repo requires OWNER/NAME argument");
    }
  });

  test("--expected without value returns an error", async () => {
    const result = await parseArgs(["--repo", "owner/name", "--expected"]);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("--expected requires PATH argument");
    }
  });

  test("unknown flag returns an error", async () => {
    const result = await parseArgs(["--bogus"]);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("unknown arg");
    }
  });

  test("falls back to GH_REPO env var when no argv", async () => {
    process.env["GH_REPO"] = "env/zeta";
    const result = await parseArgs([]);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.repo).toBe("env/zeta");
    }
  });

  test("explicit --repo overrides GH_REPO env var", async () => {
    process.env["GH_REPO"] = "env/zeta";
    const result = await parseArgs(["--repo", "argv/zeta"]);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.repo).toBe("argv/zeta");
    }
  });
});
