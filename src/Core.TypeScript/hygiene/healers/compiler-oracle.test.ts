import { describe, test, expect } from "bun:test";
import { certify, tree, type Fixture, type Healer } from "../healer-harness";
import { oracleHealer, type DeclineRecord } from "./compiler-oracle";
import { unusedImportHealer, unusedImportDetector } from "./unused-import";

describe("compiler-oracle — the acceptance gate", () => {
  test("accepts a good fix (findings decrease, no new ones)", () => {
    const input = tree({
      "src/main.ts": `import { unused } from "./lib";\n\nconsole.log("hello");\n`,
    });

    const oracle = oracleHealer({
      proposer: unusedImportHealer,
      detector: unusedImportDetector,
      driftClass: "unused-import",
    });

    const healed = oracle.heal(input);
    expect(healed.get("src/main.ts")).not.toContain("unused");
  });

  test("declines when the proposer introduces new findings", () => {
    // A bad proposer that "fixes" by adding MORE problems
    const badProposer: Healer = {
      name: "bad-proposer",
      heal: (t) => {
        const result = new Map(t);
        result.set("src/main.ts", `import { extraUnused } from "./new";\n\nconsole.log("hello");\n`);
        return result;
      },
    };

    const input = tree({
      "src/main.ts": `import { unused } from "./lib";\n\nconsole.log("hello");\n`,
    });

    const declines: DeclineRecord[] = [];
    const oracle = oracleHealer({
      proposer: badProposer,
      detector: unusedImportDetector,
      driftClass: "unused-import",
      onDecline: (d) => declines.push(d),
    });

    const result = oracle.heal(input);
    // Should return ORIGINAL (declined)
    expect(result.get("src/main.ts")).toBe(input.get("src/main.ts"));
    expect(declines).toHaveLength(1);
    // The "bad fix" traded one finding for another — gate catches the NEW finding
    expect(declines[0]!.reason.kind).toBe("new-findings-introduced");
  });

  test("declines when the proposer throws (totality)", () => {
    const throwingProposer: Healer = {
      name: "thrower",
      heal: () => { throw new Error("boom"); },
    };

    const input = tree({
      "src/main.ts": `import { unused } from "./lib";\n\nconsole.log("hello");\n`,
    });

    const declines: DeclineRecord[] = [];
    const oracle = oracleHealer({
      proposer: throwingProposer,
      detector: unusedImportDetector,
      driftClass: "unused-import",
      onDecline: (d) => declines.push(d),
    });

    const result = oracle.heal(input);
    // Should return original (never throws)
    expect(result.get("src/main.ts")).toBe(input.get("src/main.ts"));
    expect(declines[0]!.reason.kind).toBe("healer-threw");
  });

  test("returns unchanged on clean files (nothing to fix)", () => {
    const input = tree({
      "src/clean.ts": `import { foo } from "./lib";\n\nexport const x = foo();\n`,
    });

    const oracle = oracleHealer({
      proposer: unusedImportHealer,
      detector: unusedImportDetector,
      driftClass: "unused-import",
    });

    const result = oracle.heal(input);
    expect(result.get("src/clean.ts")).toBe(input.get("src/clean.ts"));
  });

  test("passes harness certification (all three laws)", () => {
    const oracle = oracleHealer({
      proposer: unusedImportHealer,
      detector: unusedImportDetector,
      driftClass: "unused-import",
    });

    const fixtures: Fixture[] = [
      { name: "one unused", tree: tree({ "src/a.ts": `import { x } from "./b";\nconsole.log("hi");\n` }) },
      { name: "clean", tree: tree({ "src/b.ts": `import { y } from "./c";\nexport const z = y;\n` }) },
      { name: "empty", tree: tree({}) },
    ];

    const verdict = certify(oracle, [unusedImportDetector], fixtures);
    expect(verdict.pass).toBe(true);
  });

  test("decline records carry the class id (the join key for escalation)", () => {
    const noopProposer: Healer = { name: "noop", heal: (t) => t };
    const declines: DeclineRecord[] = [];

    const oracle = oracleHealer({
      proposer: noopProposer,
      detector: unusedImportDetector,
      driftClass: "unused-import-ts6133",
      tier: "tier-1",
      onDecline: (d) => declines.push(d),
    });

    const input = tree({ "src/x.ts": `import { unused } from "./y";\n\n` });
    oracle.heal(input);

    expect(declines).toHaveLength(1);
    expect(declines[0]!.class).toBe("unused-import-ts6133");
    expect(declines[0]!.tierAttempted).toBe("tier-1");
  });
});
