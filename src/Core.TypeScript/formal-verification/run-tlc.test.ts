import { describe, expect, test } from "bun:test";
import { tlcJvmArguments } from "./run-tlc";

describe("TLC JVM process policy", () => {
  test("bounds heap and collector on every platform", () => {
    expect(tlcJvmArguments("linux", "x64")).toEqual([
      "-Xms64m",
      "-Xmx1g",
      "-XX:+UseSerialGC",
    ]);
  });

  test("disables the crashing C2 type-speculation path only on macOS arm64", () => {
    expect(tlcJvmArguments("darwin", "arm64")).toEqual([
      "-Xms64m",
      "-Xmx1g",
      "-XX:+UseSerialGC",
      "-XX:-UseTypeSpeculation",
    ]);
    expect(tlcJvmArguments("darwin", "x64")).not.toContain("-XX:-UseTypeSpeculation");
    expect(tlcJvmArguments("linux", "arm64")).not.toContain("-XX:-UseTypeSpeculation");
  });
});
