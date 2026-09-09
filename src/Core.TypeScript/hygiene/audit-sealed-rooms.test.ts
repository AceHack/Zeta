// audit-sealed-rooms.test.ts — the falsifiers the sealed-room gate never had.
//
// `audit-sealed-rooms.ts` runs in `gate.yml` and enforces the noninterference
// clause (081KTSZN10008QG0R002J0GE0Z): a file declaring SEALED-ROOM must contain
// zero ambient-channel tokens. Until 2026-09-09 nothing tested it. The audit even
// skipped a file named `audit-sealed-rooms.test.ts` by name — a slot reserved for
// a test that was never written, which is the vacuity class with a parking space.
//
// What the absence hid: every dotted token in the table matched a LITERAL dot, and
// C#, F# and TypeScript all accept whitespace around it. `System . IO`,
// `File . ReadAllText`, `DateTime . UtcNow` and `Task . Run` walked straight
// through a gate whose whole job is refusing them.

import { describe, test, expect } from "bun:test";
import { BANNED, bannedReason } from "./audit-sealed-rooms";

describe("audit-sealed-rooms — the doors it must refuse", () => {
  const doors: readonly (readonly [string, string])[] = [
    ["let x = System.IO.Path.GetFullPath(p);", "filesystem namespace"],
    ["let t = File.ReadAllText(p)", "filesystem"],
    ["Directory.CreateDirectory(d)", "filesystem"],
    ["let p = Path.GetTempFileName()", "filesystem (temp)"],
    ["Process.Start(psi)", "process spawn"],
    ["Environment.GetEnvironmentVariable(k)", "ambient environment"],
    ["use c = new HttpClient()", "network"],
    ["let s = new Socket(af, st, pt)", "network"],
    ["Dns.GetHostName()", "network"],
    ["let now = DateTime.UtcNow", "wall clock"],
    ["let sw = Stopwatch.StartNew()", "wall clock"],
    ["let id = Guid.NewGuid()", "ambient entropy"],
    ["let r = new Random()", "ambient entropy"],
    ["RandomNumberGenerator.Fill(buf)", "ambient entropy"],
    ["Task.Run(fun () -> work())", "un-knobbed thread spawn"],
  ];

  test("every declared door is refused with its own reason", () => {
    for (const [line, why] of doors) {
      expect({ line, why: bannedReason(line) }).toEqual({ line, why });
    }
  });

  test("EVERY entry in the table is exercised — no unfalsified row", () => {
    // A table row nothing tests is a door nobody checked. Pin the coverage.
    const covered = new Set(doors.map(([, why]) => why));
    const declared = new Set(BANNED.map(([, why]) => why));
    expect([...declared].sort().filter(w => !covered.has(w))).toEqual([]);
    expect(BANNED.length).toBe(15);
  });
});

describe("audit-sealed-rooms — whitespace around the dot does not open the door", () => {
  // THE REGRESSION. Each of these is legal C# / F# / TypeScript and each walked
  // through the gate before 2026-09-09, because the table matched a literal dot.
  const evasions: readonly (readonly [string, string])[] = [
    ["let x = System . IO.Path.GetFullPath(p);", "filesystem namespace"],
    ["let t = File . ReadAllText(p)", "filesystem"],
    ["Directory . CreateDirectory(d)", "filesystem"],
    ["let p = Path . GetTempFileName()", "filesystem (temp)"],
    ["Environment . GetEnvironmentVariable(k)", "ambient environment"],
    ["let now = DateTime . UtcNow", "wall clock"],
    ["let now = DateTime  .  Now", "wall clock"],
    ["let id = Guid . NewGuid()", "ambient entropy"],
    ["Task . Run(fun () -> work())", "un-knobbed thread spawn"],
  ];

  test("spaced member access is refused exactly as the unspaced form is", () => {
    for (const [line, why] of evasions) {
      expect({ line, why: bannedReason(line) }).toEqual({ line, why });
    }
  });

  test("tabs count as whitespace too", () => {
    expect(bannedReason("let t = File\t.\tReadAllText(p)")).toBe("filesystem");
  });
});

describe("audit-sealed-rooms — what it must NOT refuse", () => {
  test("ordinary lines are clean", () => {
    expect(bannedReason("let sum = a + b")).toBeNull();
    expect(bannedReason("    member this.Fold (s: State) = s")).toBeNull();
    expect(bannedReason("// a comment about nothing in particular")).toBeNull();
  });

  test("the SEALED-ROOM declaration line may name the doors it forbids", () => {
    expect(bannedReason("// SEALED-ROOM: no File. / DateTime.Now / Task.Run")).toBeNull();
  });

  test("an explicit visible waiver is honoured", () => {
    expect(bannedReason("let t = File.ReadAllText(p) // SEAL-WAIVER: fixture loader")).toBeNull();
  });

  test("the waiver is the ONLY escape — a plain comment does not excuse a door", () => {
    // If a bare comment sufficed, the waiver would be decoration.
    expect(bannedReason("let t = File.ReadAllText(p) // this is fine, honest")).toBe("filesystem");
  });
});
