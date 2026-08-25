import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const certificate = resolve(import.meta.dir, "../../../tools/Z3Verify/light-time-endpoint-speed-envelope.smt2");
const expectedOutcomes: Array<"sat" | "unsat"> = ["unsat", "unsat", "unsat", "unsat", "unsat", "unsat", "unsat", "unsat", "sat", "sat", "sat"];

describe("light-time endpoint-speed envelope certificate", () => {
  it("matches the declared Z3 proved/sharpness/hypothesis-necessity outcome sequence", () => {
    const output = execFileSync("z3", [certificate], { encoding: "utf8" });
    const outcomes = output
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line): line is "sat" | "unsat" => line === "sat" || line === "unsat");
    expect(outcomes).toEqual(expectedOutcomes);
  });
});
