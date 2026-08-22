import { describe, expect, test } from "bun:test";
import { readKnownSignatures } from "./swarm-known-signatures.ts";

describe("readKnownSignatures", () => {
  test("FALSIFIER: a missing first-run file produces an empty signature history", () => {
    const missing = Object.assign(new Error("not found"), { code: "ENOENT" });
    expect(readKnownSignatures(() => {
      throw missing;
    }, "known-signatures.json")).toEqual([]);
  });

  test("FALSIFIER: a non-ENOENT read failure remains visible instead of becoming empty history", () => {
    const denied = Object.assign(new Error("permission denied"), { code: "EACCES" });
    expect(() => readKnownSignatures(() => {
      throw denied;
    }, "known-signatures.json")).toThrow("permission denied");
  });

  test("FALSIFIER: malformed or non-string persisted content is not silently accepted", () => {
    expect(() => readKnownSignatures(() => "not json", "known-signatures.json")).toThrow();
    expect(() => readKnownSignatures(() => '["valid", 4]', "known-signatures.json")).toThrow(
      "must contain a JSON string array",
    );
  });

  test("reads a persisted string array", () => {
    expect(readKnownSignatures(() => '["orbit-a", "orbit-b"]', "known-signatures.json")).toEqual([
      "orbit-a",
      "orbit-b",
    ]);
  });
});
