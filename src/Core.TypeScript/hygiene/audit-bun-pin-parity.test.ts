import { describe, expect, test } from "bun:test";
import {
  checkPins,
  collectRestatements,
  isExactRelease,
  parseLockBun,
  parseMiseBunRange,
  satisfies,
} from "./audit-bun-pin-parity.ts";

const LOCK = `
[[tools.dotnet]]
version = "10.0.401"

[[tools.bun]]
version = "1.3.14"
backend = "core:bun"
`;

const site = (file: string, line: number, value: string) => ({ file, line, value });

describe("lock parsing", () => {
  test("reads the bun version, not a neighbouring tool's", () => {
    expect(parseLockBun(LOCK)).toEqual({ version: "1.3.14", count: 1 });
  });

  // Forcing case: dotnet's version line comes FIRST in the file. A regex that finds
  // `version = "..."` without anchoring to the [[tools.bun]] block returns 10.0.401.
  test("does not return the dotnet version", () => {
    expect(parseLockBun(LOCK).version).not.toBe("10.0.401");
  });

  test("two differing bun blocks is ambiguous, not a pick", () => {
    const two = `${LOCK}\n[[tools.bun]]\nversion = "1.3.15"\n`;
    expect(parseLockBun(two).version).toBeNull();
    expect(parseLockBun(two).count).toBe(2);
  });

  test("no bun block yields null", () => {
    expect(parseLockBun('[[tools.node]]\nversion = "22.0.0"\n').version).toBeNull();
  });
});

describe(".mise.toml range parsing", () => {
  // The code-quality review found `parseMiseBunRange` imported and never called. The
  // defect that hides behind an unused import is an UNTESTED EXPORT in a security check
  // -- deleting the import would have silenced the reviewer and kept the gap. These are
  // the tests it was missing.
  test("reads the bun pin", () => {
    expect(parseMiseBunRange('node = "22"\nbun = "1.3"\n')).toBe("1.3");
  });

  // Forcing case: an unanchored match would return the FIRST quoted value on any line
  // mentioning bun, including a commented-out or differently-named pin.
  test("does not read a commented-out pin", () => {
    expect(parseMiseBunRange('# bun = "9.9.9"\nbun = "1.3"\n')).toBe("1.3");
  });

  test("does not match a different tool whose name ends in bun", () => {
    expect(parseMiseBunRange('sunbun = "0.1"\n')).toBeNull();
  });

  test("absent pin is null, not an empty string", () => {
    expect(parseMiseBunRange('node = "22"\n')).toBeNull();
  });
});

describe("range satisfaction", () => {
  test('"1.3" is satisfied by 1.3.14', () => expect(satisfies("1.3", "1.3.14")).toBe(true));
  test('"1.4" is NOT satisfied by 1.3.14', () => expect(satisfies("1.4", "1.3.14")).toBe(false));
  test("an exact equal pin is satisfied", () => expect(satisfies("1.3.14", "1.3.14")).toBe(true));
  // This one is caught by the LENGTH guard before the segment compare runs, so it does
  // not test the comparison it looks like it tests. Kept because the behaviour is still
  // required; the real forcing case for the comparison is the next test.
  test('"1.3.1" is NOT satisfied by 1.3.14', () => {
    expect(satisfies("1.3.1", "1.3.14")).toBe(false);
  });

  // THE forcing case for segment-vs-character matching, found by mutation. Here the
  // length guard passes (2 < 3), so the comparison itself decides — and a string
  // `exact.startsWith(pin)` says TRUE for a pin that must not match: minor 35 is not
  // minor 3. Without this, replacing the segment compare with startsWith survives.
  test('"1.3" is NOT satisfied by 1.35.0 — segments, not characters', () => {
    expect(satisfies("1.3", "1.35.0")).toBe(false);
    expect("1.35.0".startsWith("1.3")).toBe(true); // what the wrong implementation sees
  });
  test("exactness", () => {
    expect(isExactRelease("1.3.14")).toBe(true);
    expect(isExactRelease("1.3")).toBe(false);
    expect(isExactRelease("latest")).toBe(false);
  });
});

describe("restatement collection", () => {
  const files = {
    "a.yml": '        with:\n          bun-version: "1.3.14"\n',
    "b.yml": "          bun-version: latest\n",
    "c.yml": "# bun-version: 1.3.0 in a comment is still a key match on this line\n          bun-version: 1.3\n",
  };
  const read = (p: string): string => {
    const v = files[p as keyof typeof files];
    if (v === undefined) throw new Error("nope");
    return v;
  };

  test("finds every site with file and line, stripping quotes", () => {
    const { sites } = collectRestatements(Object.keys(files), read);
    expect(sites).toContainEqual(site("a.yml", 2, "1.3.14"));
    expect(sites).toContainEqual(site("b.yml", 1, "latest"));
    expect(sites).toContainEqual(site("c.yml", 2, "1.3"));
  });

  test("an unreadable file is reported, not skipped silently", () => {
    const { unreadable } = collectRestatements(["gone.yml"], read);
    expect(unreadable).toEqual(["gone.yml"]);
  });
});

describe("the parity check", () => {
  const mise = 'bun = "1.3"\n';

  test("all sites equal to the lock passes", () => {
    const r = checkPins(LOCK, mise, [site("a.yml", 1, "1.3.14")], []);
    expect(r.filter((f) => f.level === "fail")).toEqual([]);
  });

  // The three defects this audit was written for, each must go red.
  test("`latest` FAILS and the reason names the entropy channel", () => {
    const r = checkPins(LOCK, mise, [site("a.yml", 1, "latest")], []);
    const fails = r.filter((f) => f.level === "fail");
    expect(fails.length).toBe(1);
    expect(fails[0]?.message).toContain("not a pin");
  });

  test("a stale exact pin FAILS and names both versions", () => {
    const fails = checkPins(LOCK, mise, [site("a.yml", 1, "1.3.13")], []).filter((f) => f.level === "fail");
    expect(fails.length).toBe(1);
    expect(fails[0]?.message).toContain("1.3.13");
    expect(fails[0]?.message).toContain("1.3.14");
  });

  test("a range in a workflow FAILS even though it would resolve correctly today", () => {
    const fails = checkPins(LOCK, mise, [site("a.yml", 1, "1.3")], []).filter((f) => f.level === "fail");
    expect(fails.length).toBe(1);
    expect(fails[0]?.message).toContain("range");
  });

  test("an unreadable lock FAILS rather than passing vacuously", () => {
    const fails = checkPins(null, mise, [], []).filter((f) => f.level === "fail");
    expect(fails.length).toBe(1);
  });

  test("a .mise.toml pin the lock does not satisfy FAILS", () => {
    const fails = checkPins(LOCK, 'bun = "1.4"\n', [], []).filter((f) => f.level === "fail");
    expect(fails.length).toBe(1);
    expect(fails[0]?.message).toContain("diverged");
  });

  test("an unreadable workflow is UNKNOWN, and unknown is not a pass", () => {
    const r = checkPins(LOCK, mise, [], ["x.yml"]);
    expect(r.filter((f) => f.level === "unknown").length).toBe(1);
    expect(r.filter((f) => f.level === "fail")).toEqual([]);
  });

  test("every offending site is reported, not just the first", () => {
    const fails = checkPins(LOCK, mise, [site("a.yml", 1, "latest"), site("b.yml", 9, "1.3.13")], [])
      .filter((f) => f.level === "fail");
    expect(fails.length).toBe(2);
    expect(fails.map((f) => f.where)).toEqual(["a.yml:1", "b.yml:9"]);
  });
});
