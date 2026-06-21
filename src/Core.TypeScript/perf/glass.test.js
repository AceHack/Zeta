import { test, expect } from "bun:test";
import { durationOf, parseLaneFlags } from "./glass";
import { traceArgsOf } from "./pro";
import { countersArgsOf } from "./counters";
import { gcdumpArgsOf } from "./gcdump";
// the pure halves are the tested halves — no process is spawned here (the spawn is the one
// side-effecting door, exercised by the live smoke in the PR, not the test suite).
test("durationOf renders dd:hh:mm:ss and refuses non-positive", () => {
    expect(durationOf(4)).toBe("00:00:00:04");
    expect(durationOf(3661)).toBe("00:01:01:01");
    expect(() => durationOf(0)).toThrow();
    expect(() => durationOf(1.5)).toThrow();
});
test("parseLaneFlags: pid mode, spawn mode, and the refusals", () => {
    expect(parseLaneFlags(["--pid", "42", "--seconds", "9"])).toMatchObject({ pid: 42, seconds: 9 });
    expect(parseLaneFlags(["--out", "x.nettrace", "--", "dotnet", "fsi", "s.fsx"])).toMatchObject({ out: "x.nettrace", command: ["dotnet", "fsi", "s.fsx"] });
    expect(() => parseLaneFlags(["--pid", "zero"])).toThrow();
    expect(() => parseLaneFlags(["--seconds"])).toThrow();
});
test("traceArgsOf: default out is keyed to the pid; duration only when asked", () => {
    expect(traceArgsOf(7, {})).toEqual(["collect", "-p", "7", "-o", "pro-7.nettrace"]);
    expect(traceArgsOf(7, { seconds: 4, out: "t.nettrace" })).toEqual(["collect", "-p", "7", "-o", "t.nettrace", "--duration", "00:00:00:04"]);
});
test("countersArgsOf: monitor without out, collect-to-csv with out", () => {
    expect(countersArgsOf(7, {})).toEqual(["monitor", "-p", "7"]);
    expect(countersArgsOf(7, { out: "c.csv", seconds: 9 })).toEqual(["collect", "-p", "7", "-o", "c.csv", "--format", "csv", "--duration", "00:00:00:09"]);
});
test("gcdumpArgsOf: one snapshot, optional out", () => {
    expect(gcdumpArgsOf(7, {})).toEqual(["collect", "-p", "7"]);
    expect(gcdumpArgsOf(7, { out: "h.gcdump" })).toEqual(["collect", "-p", "7", "-o", "h.gcdump"]);
});
