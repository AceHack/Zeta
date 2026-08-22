import { describe, expect, test } from "bun:test";

import { readOptionalText } from "./read-optional-text";

describe("readOptionalText", () => {
  test("returns the observed text from one reader operation", () => {
    let calls = 0;
    const observed = readOptionalText("data/example.json", () => {
      calls++;
      return "observed";
    });

    expect(observed).toBe("observed");
    expect(calls).toBe(1);
  });

  test("treats a disappearance at the read operation as absence without a stale pre-check", () => {
    const gone = Object.assign(new Error("gone after a hypothetical check"), { code: "ENOENT" });
    expect(readOptionalText("data/race.json", () => { throw gone; })).toBeNull();
  });

  test("does not misclassify unreadable files as absence", () => {
    const denied = Object.assign(new Error("permission denied"), { code: "EACCES" });
    expect(() => readOptionalText("data/denied.json", () => { throw denied; })).toThrow("permission denied");
  });
});
