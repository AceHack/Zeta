import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
  MAX_CHARS,
  PREFERRED_CHARS,
  parseFrontmatterDescription,
  auditDescription,
  auditSkillsDir,
} from "./audit-skill-description-length";

const fm = (desc: string) => `---\nname: x\ndescription: ${desc}\n---\n\n# body\n`;

describe("parseFrontmatterDescription", () => {
  test("extracts a single-line description", () => {
    const f = parseFrontmatterDescription(fm("Elasticsearch — shards, ILM, kNN."));
    expect(f).not.toBeNull();
    expect(f!.value).toBe("Elasticsearch — shards, ILM, kNN.");
    expect(f!.multiline).toBe(false);
  });

  test("collapses a folded multi-line YAML value and flags it multiline", () => {
    const text = "---\nname: x\ndescription: Big\n  multi\n  line.\n---\n";
    const f = parseFrontmatterDescription(text);
    expect(f!.value).toBe("Big multi line.");
    expect(f!.multiline).toBe(true);
  });

  test("strips surrounding quotes", () => {
    expect(parseFrontmatterDescription(fm('"quoted desc"'))!.value).toBe("quoted desc");
  });

  test("does not bleed into the following frontmatter key", () => {
    const text = "---\nname: x\ndescription: short.\nowners: [a]\n---\n";
    expect(parseFrontmatterDescription(text)!.value).toBe("short.");
  });

  test("returns null when there is no description field", () => {
    expect(parseFrontmatterDescription("---\nname: x\n---\n")).toBeNull();
  });
});

describe("auditDescription", () => {
  test("clean carved sentence produces no violations", () => {
    expect(auditDescription("ok", { value: "Domain — a, b, c.", multiline: false })).toEqual([]);
  });

  test("over the hard cap is an error", () => {
    const v = auditDescription("big", { value: "x".repeat(MAX_CHARS + 1), multiline: false });
    expect(v.some((e) => e.severity === "error" && /cap/.test(e.message))).toBe(true);
  });

  test("between preferred and cap is a warning, not an error", () => {
    const v = auditDescription("mid", { value: "x".repeat(PREFERRED_CHARS + 5), multiline: false });
    expect(v).toHaveLength(1);
    expect(v[0]!.severity).toBe("warn");
  });

  test("multiline is an error", () => {
    const v = auditDescription("ml", { value: "short.", multiline: true });
    expect(v.some((e) => e.severity === "error" && /multiple lines/.test(e.message))).toBe(true);
  });

  test("boilerplate is an error", () => {
    const cases = [
      'Capability skill ("hat") — Elasticsearch.',
      "Owns the storage layer.",
      "Covers the parser.",
      "Use it. Wear this when reviewing.",
      "Z3 SMT. Defers to formal-verification.",
    ];
    for (const c of cases) {
      const v = auditDescription("b", { value: c, multiline: false });
      expect(v.some((e) => e.severity === "error" && /boilerplate|preamble|note/.test(e.message))).toBe(true);
    }
  });

  test("missing field is an error", () => {
    const v = auditDescription("none", null);
    expect(v).toHaveLength(1);
    expect(v[0]!.severity).toBe("error");
  });
});

describe("auditSkillsDir — live invariant (081KR50HA0008QG0R002ZNFQBZ acceptance #1/#2)", () => {
  test("every shipped skill description is within the routing budget", () => {
    const root = process.cwd().replace(/\/tools\/hygiene$/, "");
    const { checked, violations } = auditSkillsDir(join(root, ".claude/skills"));
    const errors = violations.filter((v) => v.severity === "error");
    expect(checked).toBeGreaterThanOrEqual(20); // 21 blueprint-pack SKILL.md (router-facing); per-capability detail lives in <pack>/blueprints/*.md
    expect(errors).toEqual([]);
  });
});
