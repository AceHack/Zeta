import { describe, expect, test } from "bun:test";
import { resolveEnv, defaultPaths } from "./env-schema";

describe("env-schema", () => {
  test("resolveEnv returns persona name", () => {
    const env = resolveEnv("kiro");
    expect(env.persona).toBe("kiro");
  });

  test("resolveEnv uses env vars when set", () => {
    process.env.ZETA_LOOP_WORKTREE = "/custom/path";
    const env = resolveEnv("kiro");
    expect(env.worktree).toBe("/custom/path");
    delete process.env.ZETA_LOOP_WORKTREE;
  });

  test("resolveEnv derives defaults when env vars unset", () => {
    delete process.env.ZETA_LOOP_WORKTREE;
    delete process.env.ZETA_LOOP_STATE_DIR;
    delete process.env.ZETA_LOOP_LOG_DIR;
    const env = resolveEnv("otto");
    expect(env.worktree).toContain("otto");
    expect(env.ref).toBe("main");
  });

  test("defaultPaths includes persona name in paths", () => {
    const paths = defaultPaths("riven");
    expect(paths.worktree).toContain("riven");
    expect(paths.stateDir.toLowerCase()).toContain("riven");
    expect(paths.logDir).toContain("riven");
  });
});
