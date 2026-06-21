/**
 * src/Core.TypeScript/workflow-engine/research-doc.test.ts
 *
 * 081KSNY2Z0008QG0R001YK61JQ.7 — invariant tests for Falcon-auto-research-doc substrate.
 */

import { describe, expect, it } from "bun:test";
import {
  buildAndRender,
  buildSkeleton,
  renderResearchDoc,
  renderSection,
  type ResearchDoc,
  type ResearchDocSection,
} from "./research-doc";

describe("081KSNY2Z0008QG0R001YK61JQ.7 Falcon-auto-research-doc substrate", () => {
  it("buildSkeleton: empty proposalId → EmptyProposalId", () => {
    const result = buildSkeleton({ proposalId: "", title: "x", scope: "y", attribution: "z" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.feedback.kind).toBe("EmptyProposalId");
  });

  it("buildSkeleton: produces 8-section Falcon scaffold", () => {
    const result = buildSkeleton({
      proposalId: "H-001",
      title: "Test hypothesis",
      scope: "test scope",
      attribution: "test attribution",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.sections.length).toBe(8);
    // Verify section kinds
    const kinds = result.doc.sections.map((s) => s.kind);
    expect(kinds).toEqual([
      "header",
      "framing",
      "background",
      "mechanism",
      "evidence",
      "risks",
      "composes-with",
      "test-plan",
    ]);
  });

  it("buildSkeleton: sanitizes proposalId to filename-safe id", () => {
    const result = buildSkeleton({
      proposalId: "H/001 with spaces!",
      title: "x",
      scope: "y",
      attribution: "z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.id).toBe("H_001_with_spaces_");
  });

  it("buildSkeleton: passes composesWith through", () => {
    const result = buildSkeleton({
      proposalId: "H-001",
      title: "x",
      scope: "y",
      attribution: "z",
      composesWith: ["081KSKBP80008QG0R000B3Y19A", "081KSNY2Z0008QG0R001YK61JQ"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.composesWith).toEqual(["081KSKBP80008QG0R000B3Y19A", "081KSNY2Z0008QG0R001YK61JQ"]);
    // composesWith also appears in the composes-with section
    const composesSection = result.doc.sections.find((s) => s.kind === "composes-with");
    expect(composesSection).toBeDefined();
    if (composesSection?.kind === "composes-with") {
      expect(composesSection.substrates).toEqual(["081KSKBP80008QG0R000B3Y19A", "081KSNY2Z0008QG0R001YK61JQ"]);
    }
  });

  it("renderSection: header with subtitle", () => {
    const md = renderSection({ kind: "header", title: "Big Idea", subtitle: "Proposal: H-001" });
    expect(md).toContain("# Big Idea");
    expect(md).toContain("*Proposal: H-001*");
  });

  it("renderSection: header without subtitle", () => {
    const md = renderSection({ kind: "header", title: "Big Idea" });
    expect(md).toBe("# Big Idea");
  });

  it("renderSection: framing has 3 labeled lines", () => {
    const md = renderSection({
      kind: "framing",
      scope: "test scope",
      attribution: "test attr",
      operationalStatus: "research-grade",
    });
    expect(md).toContain("**Scope**: test scope");
    expect(md).toContain("**Attribution**: test attr");
    expect(md).toContain("**Operational status**: research-grade");
  });

  it("renderSection: background with references", () => {
    const md = renderSection({
      kind: "background",
      content: "Some background",
      references: ["paper1", "paper2"],
    });
    expect(md).toContain("## Background");
    expect(md).toContain("Some background");
    expect(md).toContain("- paper1");
    expect(md).toContain("- paper2");
  });

  it("renderSection: mechanism with pathways", () => {
    const md = renderSection({
      kind: "mechanism",
      content: "Mechanism description",
      pathways: ["path1", "path2"],
    });
    expect(md).toContain("## Mechanism");
    expect(md).toContain("- path1");
  });

  it("renderSection: evidence has supporting + against subsections", () => {
    const md = renderSection({
      kind: "evidence",
      supporting: ["s1", "s2"],
      against: ["a1"],
    });
    expect(md).toContain("### Supporting evidence");
    expect(md).toContain("- s1");
    expect(md).toContain("### Evidence against");
    expect(md).toContain("- a1");
  });

  it("renderSection: risks with mitigations", () => {
    const md = renderSection({
      kind: "risks",
      risks: ["r1"],
      mitigations: ["m1"],
    });
    expect(md).toContain("### Risks");
    expect(md).toContain("- r1");
    expect(md).toContain("### Mitigations");
    expect(md).toContain("- m1");
  });

  it("renderSection: composes-with substrates + rules", () => {
    const md = renderSection({
      kind: "composes-with",
      substrates: ["B-001"],
      rules: ["rule-1"],
    });
    expect(md).toContain("### Composes with substrate");
    expect(md).toContain("- B-001");
    expect(md).toContain("### Composes with rules");
    expect(md).toContain("- rule-1");
  });

  it("renderSection: test-plan items as Markdown checkboxes", () => {
    const md = renderSection({
      kind: "test-plan",
      items: ["test1", "test2"],
    });
    expect(md).toContain("## Test plan");
    expect(md).toContain("- [ ] test1");
    expect(md).toContain("- [ ] test2");
  });

  it("renderSection: raw passes through markdown", () => {
    const md = renderSection({ kind: "raw", markdown: "**bold** text" });
    expect(md).toBe("**bold** text");
  });

  it("renderResearchDoc: empty sections → NoSectionsRendered", () => {
    const doc: ResearchDoc = {
      id: "test",
      proposalId: "H-001",
      sections: [],
      composesWith: [],
    };
    const result = renderResearchDoc(doc);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.feedback.kind).toBe("NoSectionsRendered");
  });

  it("renderResearchDoc: joins sections with blank lines", () => {
    const doc: ResearchDoc = {
      id: "test",
      proposalId: "H-001",
      sections: [
        { kind: "header", title: "Test" },
        { kind: "raw", markdown: "Content here" },
      ],
      composesWith: [],
    };
    const result = renderResearchDoc(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc).toContain("# Test");
    expect(result.doc).toContain("Content here");
    expect(result.doc).toMatch(/# Test\n\nContent here/);
  });

  it("buildAndRender: end-to-end skeleton + render", () => {
    const result = buildAndRender({
      proposalId: "H-001",
      title: "Test Hypothesis",
      scope: "scope text",
      attribution: "attribution text",
      composesWith: ["081KSKBP80008QG0R000B3Y19A"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // All 8 sections rendered
    expect(result.doc).toContain("# Test Hypothesis");
    expect(result.doc).toContain("**Scope**: scope text");
    expect(result.doc).toContain("## Background");
    expect(result.doc).toContain("## Mechanism");
    expect(result.doc).toContain("## Evidence");
    expect(result.doc).toContain("## Risks + Mitigations");
    expect(result.doc).toContain("## Composition");
    expect(result.doc).toContain("## Test plan");
    expect(result.doc).toContain("- 081KSKBP80008QG0R000B3Y19A");
  });

  it("Falcon-stage pending markers preserved (substrate-honest about what's not yet generated)", () => {
    const result = buildAndRender({
      proposalId: "H-001",
      title: "x",
      scope: "y",
      attribution: "z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc).toContain("[PENDING LITERATURE REVIEW");
    expect(result.doc).toContain("[PENDING MECHANISM ANALYSIS");
    expect(result.doc).toContain("[PENDING SUPPORTING EVIDENCE");
    expect(result.doc).toContain("[PENDING RISK ANALYSIS");
    expect(result.doc).toContain("[PENDING TEST PLAN");
  });

  it("ResearchDocSection union exhaustive (compile-time check)", () => {
    const acknowledge = (s: ResearchDocSection): string => {
      switch (s.kind) {
        case "header":
        case "framing":
        case "background":
        case "mechanism":
        case "evidence":
        case "risks":
        case "composes-with":
        case "test-plan":
        case "raw":
          return s.kind;
      }
    };
    expect(acknowledge({ kind: "header", title: "x" })).toBe("header");
    expect(acknowledge({ kind: "raw", markdown: "x" })).toBe("raw");
  });
});
