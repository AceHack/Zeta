import { describe, expect, test } from "bun:test";
import { resolveEnv, defaultPaths } from "./env-schema";

describe("env-schema", () => {
  test("resolveEnv returns persona name", () => {
    const env = resolveEnv("kiro");
    expect(env.persona).toBe("kiro");
  });

  test("resolveEnv uses env vars when set", () => {
    process.env.ZETA_LOOP_WORKTREE = "/custom/path";
    process.env.ZETA_LOOP_TOOL_PATH_PREFIX = "/custom/bin";
    const env = resolveEnv("kiro");
    expect(env.worktree).toBe("/custom/path");
    expect(env.toolPathPrefix).toBe("/custom/bin");
    delete process.env.ZETA_LOOP_WORKTREE;
    delete process.env.ZETA_LOOP_TOOL_PATH_PREFIX;
  });

  test("resolveEnv derives defaults when env vars unset", () => {
    delete process.env.ZETA_LOOP_WORKTREE;
    delete process.env.ZETA_LOOP_STATE_DIR;
    delete process.env.ZETA_LOOP_LOG_DIR;
    delete process.env.ZETA_LOOP_TOOL_PATH_PREFIX;
    const env = resolveEnv("otto");
    expect(env.worktree).toContain("otto");
    expect(env.ref).toBe("main");
    expect(env.toolPathPrefix).toBeUndefined();
  });

  test("resolveEnv does not turn a blank tool prefix into a current-directory PATH entry", () => {
    process.env.ZETA_LOOP_TOOL_PATH_PREFIX = "   ";
    const env = resolveEnv("kiro");
    expect(env.toolPathPrefix).toBeUndefined();
    delete process.env.ZETA_LOOP_TOOL_PATH_PREFIX;
  });

  test("defaultPaths includes persona name in paths", () => {
    const paths = defaultPaths("riven");
    expect(paths.worktree).toContain("riven");
    expect(paths.stateDir.toLowerCase()).toContain("riven");
    expect(paths.logDir).toContain("riven");
  });
});
