import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { isInsufficientTokenScope403, parseArgs, parseJsonSafe } from "./snapshot-github-settings";

const NULL_RESOLVER = async (): Promise<string> => "";

let priorGhRepo: string | undefined;

beforeEach(() => {
  priorGhRepo = process.env["GH_REPO"];
  delete process.env["GH_REPO"];
});

afterEach(() => {
  if (priorGhRepo === undefined) delete process.env["GH_REPO"];
  else process.env["GH_REPO"] = priorGhRepo;
});

describe("parseJsonSafe", () => {
  test("parses a valid JSON object", () => {
    expect(parseJsonSafe('{"a":1}')).toEqual({ a: 1 });
  });

  test("parses a valid JSON array", () => {
    expect(parseJsonSafe("[1,2,3]")).toEqual([1, 2, 3]);
  });

  test("returns fallback (null by default) for null input", () => {
    expect(parseJsonSafe(null)).toBeNull();
  });

  test("returns fallback (null by default) for empty string input", () => {
    expect(parseJsonSafe("")).toBeNull();
  });

  test("honours an explicit fallback", () => {
    expect(parseJsonSafe(null, [])).toEqual([]);
    expect(parseJsonSafe("", { skipped: true })).toEqual({ skipped: true });
  });

  test("returns fallback for invalid JSON instead of throwing", () => {
    expect(parseJsonSafe("not-json", [])).toEqual([]);
    expect(parseJsonSafe("{unterminated", null)).toBeNull();
  });
});

describe("isInsufficientTokenScope403", () => {
  test("matches GitHub Actions token-scope 403s", () => {
    expect(isInsufficientTokenScope403("gh: Resource not accessible by integration (HTTP 403)")).toBe(true);
  });

  test("matches fine-grained PAT token-scope 403s", () => {
    expect(isInsufficientTokenScope403("gh: Resource not accessible by personal access token (HTTP 403)")).toBe(true);
  });

  test("matches admin-permission 403s", () => {
    expect(isInsufficientTokenScope403("gh: Must have admin rights to Repository. (HTTP 403)")).toBe(true);
  });

  test("does not match secondary rate limits", () => {
    expect(isInsufficientTokenScope403("gh: You have exceeded a secondary rate limit. (HTTP 403)")).toBe(false);
  });

  test("does not match generic 403s without a token-scope signature", () => {
    expect(isInsufficientTokenScope403("gh: Forbidden (HTTP 403)")).toBe(false);
  });

  test("does not match non-403 errors", () => {
    expect(isInsufficientTokenScope403("gh: Not Found (HTTP 404)")).toBe(false);
  });
});

describe("parseArgs", () => {
  test("--repo OWNER/NAME → success", async () => {
    const result = await parseArgs(["--repo", "Lucent-Financial-Group/Zeta"], NULL_RESOLVER);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.repo).toBe("Lucent-Financial-Group/Zeta");
    }
  });

  test("positional arg is accepted as repo", async () => {
    const result = await parseArgs(["AceHack/Zeta"], NULL_RESOLVER);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.repo).toBe("AceHack/Zeta");
    }
  });

  test("--repo without value returns an error", async () => {
    const result = await parseArgs(["--repo"], NULL_RESOLVER);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("--repo requires OWNER/NAME argument");
    }
  });

  test("falls back to GH_REPO env var when no argv", async () => {
    process.env["GH_REPO"] = "env/zeta";
    const result = await parseArgs([], NULL_RESOLVER);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.repo).toBe("env/zeta");
    }
  });

  test("explicit --repo overrides GH_REPO env var", async () => {
    process.env["GH_REPO"] = "env/zeta";
    const result = await parseArgs(["--repo", "argv/zeta"], NULL_RESOLVER);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.repo).toBe("argv/zeta");
    }
  });

  test("falls back to the resolveDefault function when argv and env are empty", async () => {
    const resolver = async (): Promise<string> => "resolver/zeta";
    const result = await parseArgs([], resolver);

    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.repo).toBe("resolver/zeta");
    }
  });

  test("returns error when argv, env, and resolver all yield empty", async () => {
    const result = await parseArgs([], NULL_RESOLVER);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("cannot determine repo");
    }
  });

  test("argv > env > resolver precedence ordering", async () => {
    // argv wins
    process.env["GH_REPO"] = "env/zeta";
    const resolver = async (): Promise<string> => "resolver/zeta";
    const r1 = await parseArgs(["argv/zeta"], resolver);
    expect(r1.kind === "args" && r1.args.repo).toBe("argv/zeta");

    // env wins over resolver
    const r2 = await parseArgs([], resolver);
    expect(r2.kind === "args" && r2.args.repo).toBe("env/zeta");

    // resolver wins when env unset
    delete process.env["GH_REPO"];
    const r3 = await parseArgs([], resolver);
    expect(r3.kind === "args" && r3.args.repo).toBe("resolver/zeta");
  });
});
