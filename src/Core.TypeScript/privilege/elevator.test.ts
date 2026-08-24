// Falsifiers for the elevator resolver. Every case here fails if the P1 in docs/BUGS.md
// (2026-08-24) is reintroduced: a privilege elevator resolved by name is forgeable by any
// writable directory earlier on `PATH`, and planting one leaves no git diff.
import { expect, test, describe } from "bun:test";
import {
  ELEVATOR_ALLOWLIST,
  DARWIN_ELEVATOR_ALLOWLIST,
  elevatorCandidates,
  rejectReason,
  resolveElevator,
  resolveElevatorPathOrThrow,
  type ElevatorEffects,
  type ElevatorFileFacts,
} from "./elevator.ts";

const GOOD: ElevatorFileFacts = { isFile: true, uid: 0, mode: 0o104111 }; // -r-s--x--x root
const SHIM: ElevatorFileFacts = { isFile: true, uid: 501, mode: 0o100755 }; // the attacker's file

function host(files: Record<string, ElevatorFileFacts>, plat = "darwin"): ElevatorEffects {
  return { platform: () => plat, stat: (p) => files[p] ?? null };
}

describe("the allowlist itself", () => {
  test("every candidate on every platform is ABSOLUTE — a relative entry would be PATH again", () => {
    for (const list of [ELEVATOR_ALLOWLIST, DARWIN_ELEVATOR_ALLOWLIST]) {
      for (const paths of Object.values(list)) {
        for (const p of paths) expect(p.startsWith("/")).toBe(true);
      }
    }
  });

  test("darwin narrows `sudo` to exactly /usr/bin/sudo — the only SIP-restricted location", () => {
    // Measured 2026-08-24 on macOS 26.5.2: `ls -lO /usr/bin/sudo` reports `restricted` and
    // `csrutil status` reports SIP enabled, so that file cannot be replaced by the operator
    // or by root. No other macOS location has that property, so accepting one would
    // reintroduce the hole in a smaller form. Homebrew ships no `sudo` formula
    // (`brew info sudo` -> "No available formula"), so nothing is lost by the narrowing.
    expect(elevatorCandidates("sudo", "darwin")).toEqual(["/usr/bin/sudo"]);
    expect(elevatorCandidates("doas", "darwin")).toEqual([]);
    expect(elevatorCandidates("pkexec", "darwin")).toEqual([]);
  });

  test("linux keeps /run/wrappers/bin first — on NixOS /usr/bin/sudo does not exist", () => {
    expect(elevatorCandidates("sudo", "linux")[0]).toBe("/run/wrappers/bin/sudo");
  });
});

describe("rejectReason — the structural check, not just the string", () => {
  test("accepts a root-owned setuid non-world-writable file", () => {
    expect(rejectReason(GOOD)).toBeNull();
  });
  test("refuses an absent candidate", () => {
    expect(rejectReason(null)).toBe("absent or unreadable");
  });
  test("refuses a non-file", () => {
    expect(rejectReason({ ...GOOD, isFile: false })).toBe("not a regular file");
  });
  test("refuses a file owned by the attacker — THE shim case", () => {
    expect(rejectReason(SHIM)).toContain("not root-owned");
  });
  test("refuses a root-owned file that is not setuid — it cannot be the real elevator", () => {
    expect(rejectReason({ isFile: true, uid: 0, mode: 0o100755 })).toContain("not setuid");
  });
  test("refuses a setuid root file that is group- or other-writable", () => {
    expect(rejectReason({ isFile: true, uid: 0, mode: 0o104777 })).toContain("writable");
    expect(rejectReason({ isFile: true, uid: 0, mode: 0o104131 })).toContain("writable");
  });
});

describe("resolveElevator", () => {
  test("resolves to the first conforming absolute candidate", () => {
    const r = resolveElevator("sudo", host({ "/usr/bin/sudo": GOOD }));
    expect(r.ok).toBe(true);
    expect(r.ok && r.path).toBe("/usr/bin/sudo");
  });

  test("REFUSES the shim even when it sits at an allowlisted absolute path", () => {
    const r = resolveElevator("sudo", host({ "/usr/bin/sudo": SHIM }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toContain("not root-owned");
  });

  test("a refusal names every candidate it rejected and why — a silent refusal is a check nobody can audit", () => {
    const r = resolveElevator("sudo", host({}, "linux"));
    expect(r.ok).toBe(false);
    expect(r.rejected.map((x) => x.path)).toEqual([...ELEVATOR_ALLOWLIST.sudo]);
    for (const x of r.rejected) expect(x.why.length).toBeGreaterThan(0);
  });

  test("NEVER falls back to PATH — an unknown platform with no conforming file refuses", () => {
    const r = resolveElevator("sudo", host({}, "sunos"));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toContain("PATH is deliberately NOT consulted");
  });

  test("skips a non-conforming earlier candidate and takes a conforming later one", () => {
    const fx = host({ "/run/wrappers/bin/sudo": SHIM, "/usr/bin/sudo": GOOD }, "linux");
    const r = resolveElevator("sudo", fx);
    expect(r.ok && r.path).toBe("/usr/bin/sudo");
    expect(r.rejected[0]?.path).toBe("/run/wrappers/bin/sudo");
  });

  test("resolveElevatorPathOrThrow throws rather than returning a bare name", () => {
    expect(() => resolveElevatorPathOrThrow("sudo", host({}, "linux"))).toThrow(/no usable 'sudo'/);
    expect(resolveElevatorPathOrThrow("sudo", host({ "/usr/bin/sudo": GOOD }))).toBe("/usr/bin/sudo");
  });

  test("the mutation guard: dropping the uid check would let the shim through", () => {
    // If a future edit relaxes `rejectReason` to existence-only, this is the assertion that
    // goes red. It is stated separately from the case above because the case above would
    // still pass if the reason string merely changed.
    const r = resolveElevator("sudo", host({ "/usr/bin/sudo": SHIM }));
    expect(r.ok).toBe(false);
  });
});
