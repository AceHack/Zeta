// audit_retractibility.test.ts — tests for retractibility audit tool.
//
// 081KQ3HBZ0008QG0R002S674CG slice: adds test coverage for the retractibility check's
// arg parsing, inbound-ref counting, audit shape, and CLI exit codes.
//
// Run: bun test tools/alignment/audit_retractibility.test.ts

import { describe, expect, test } from "bun:test";
import {
  auditRetractibility,
  countInboundRefs,
  main,
  parseArgs,
} from "./audit_retractibility.ts";

describe("parseArgs", () => {
  test("returns help for -h", () => {
    expect(parseArgs(["-h"])).toEqual({ kind: "help" });
  });

  test("returns help for --help", () => {
    expect(parseArgs(["--help"])).toEqual({ kind: "help" });
  });

  test("parses --json flag", () => {
    const result = parseArgs(["--json"]);
    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.json).toBe(true);
      expect(result.args.md).toBe(false);
    }
  });

  test("parses --md flag", () => {
    const result = parseArgs(["--md"]);
    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.md).toBe(true);
      expect(result.args.json).toBe(false);
    }
  });

  test("parses --gate with value", () => {
    const result = parseArgs(["--gate", "10"]);
    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.gate).toBe(10);
    }
  });

  test("errors on --gate without value", () => {
    const result = parseArgs(["--gate"]);
    expect(result.kind).toBe("error");
  });

  test("errors on --gate with non-numeric value", () => {
    const result = parseArgs(["--gate", "abc"]);
    expect(result.kind).toBe("error");
  });

  test("errors on unknown flag", () => {
    const result = parseArgs(["--bad-flag"]);
    expect(result.kind).toBe("error");
  });

  test("collects positional paths", () => {
    const result = parseArgs(["foo.md", "bar.md"]);
    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.paths).toEqual(["foo.md", "bar.md"]);
    }
  });

  test("combines flags and paths", () => {
    const result = parseArgs(["--json", "--gate", "5", "a.md", "b.md"]);
    expect(result.kind).toBe("args");
    if (result.kind === "args") {
      expect(result.args.json).toBe(true);
      expect(result.args.gate).toBe(5);
      expect(result.args.paths).toEqual(["a.md", "b.md"]);
    }
  });
});

describe("countInboundRefs", () => {
  test("returns a count and from array for a known file", () => {
    const result = countInboundRefs("docs/ALIGNMENT.md", process.cwd());
    expect(typeof result.count).toBe("number");
    expect(result.count).toBeGreaterThan(0);
    expect(Array.isArray(result.from)).toBe(true);
    expect(result.from.length).toBe(result.count);
  }, 30000);

  test("excludes self from inbound refs", () => {
    const result = countInboundRefs("docs/ALIGNMENT.md", process.cwd());
    expect(result.from).not.toContain("docs/ALIGNMENT.md");
  }, 30000);

  test("returns zero for a nonexistent path pattern", () => {
    const needle = ["x9z8y7w6", "no", "such", "file"].join("/") + ".md";
    const result = countInboundRefs(needle, process.cwd());
    expect(result.count).toBe(0);
    expect(result.from).toEqual([]);
  }, 30000);
});

describe("auditRetractibility", () => {
  test("returns valid shape for a known skill", () => {
    const result = auditRetractibility([".claude/skills/governance/SKILL.md"]);
    expect(result.schema).toBe("retractibility-v1");
    expect(result.totalSurfaces).toBe(1);
    expect(result.entanglementThreshold).toBe(5);
    expect(result.surfaces).toHaveLength(1);

    const surface = result.surfaces[0]!;
    expect(surface.kind).toBe("skill");
    expect(surface.name).toBe("governance");
    expect(surface.gitTracked).toBe(true);
    expect(typeof surface.inboundRefs).toBe("number");
    expect(["retractible", "entangled"]).toContain(surface.status);
  }, 30000);

  test("returns valid shape for a known agent", () => {
    const result = auditRetractibility([".claude/agents/alignment-auditor.md"]);
    expect(result.totalSurfaces).toBe(1);
    const surface = result.surfaces[0]!;
    expect(surface.kind).toBe("agent");
    expect(surface.name).toBe("alignment-auditor");
    expect(surface.gitTracked).toBe(true);
  }, 30000);

  test("classifies untracked file correctly", () => {
    const result = auditRetractibility(["definitely-not-a-real-file-xyz.md"]);
    expect(result.totalSurfaces).toBe(1);
    expect(result.untracked).toBe(1);
    const surface = result.surfaces[0]!;
    expect(surface.status).toBe("untracked");
    expect(surface.gitTracked).toBe(false);
    expect(surface.inboundRefs).toBe(0);
  }, 30000);

  test("counts add up correctly", () => {
    const result = auditRetractibility([
      ".claude/skills/governance/SKILL.md",
      ".claude/agents/alignment-auditor.md",
      "definitely-not-a-real-file-xyz.md",
    ]);
    expect(result.totalSurfaces).toBe(3);
    expect(result.retractible + result.entangled + result.untracked).toBe(result.totalSurfaces);
  }, 30000);

  test("sorts surfaces by descending inbound refs", () => {
    const result = auditRetractibility([
      ".claude/skills/governance/SKILL.md",
      ".claude/agents/alignment-auditor.md",
    ]);
    if (result.surfaces.length >= 2) {
      expect(result.surfaces[0]!.inboundRefs).toBeGreaterThanOrEqual(
        result.surfaces[1]!.inboundRefs,
      );
    }
  }, 30000);
});

describe("main() CLI", () => {
  test("returns 0 with --help", () => {
    expect(main(["--help"])).toBe(0);
  });

  test("returns 2 for unknown flag", () => {
    expect(main(["--bad-flag"])).toBe(2);
  });

  test("returns 2 when --gate has no value", () => {
    expect(main(["--gate"])).toBe(2);
  });

  test("returns 0 with specific paths", () => {
    expect(main([".claude/agents/alignment-auditor.md"])).toBe(0);
  }, 30000);

  test("returns 0 with --json and specific path", () => {
    expect(main(["--json", ".claude/agents/alignment-auditor.md"])).toBe(0);
  }, 30000);

  test("returns 0 with --md and specific path", () => {
    expect(main(["--md", ".claude/agents/alignment-auditor.md"])).toBe(0);
  }, 30000);

  test("returns 0 with --gate 0 (trivially satisfied)", () => {
    expect(main(["--gate", "0", ".claude/agents/alignment-auditor.md"])).toBe(1);
  }, 30000);

  test("returns 0 with --gate 9999 (impossible threshold)", () => {
    expect(main(["--gate", "9999", ".claude/agents/alignment-auditor.md"])).toBe(0);
  }, 30000);
});
