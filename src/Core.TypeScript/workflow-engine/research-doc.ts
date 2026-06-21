/**
 * src/Core.TypeScript/workflow-engine/research-doc.ts
 *
 * 081KSNY2Z0008QG0R001YK61JQ.7 — Falcon-style auto-generate-substrate-research-doc per
 * proposal substrate.
 *
 * Per Sakana Robin Falcon agent (Nature 2026): takes a drug proposal +
 * does deep-dive literature review + writes comprehensive research
 * report. TS-side scaffold: structured-template generator that takes
 * a Hypothesis + produces a research-doc template with sections.
 *
 * Real LLM-backed literature review deferred to integration layer;
 * current PoC provides the TEMPLATE STRUCTURE that downstream
 * substrate-engineering work (LLM calls + literature fetch + reference
 * lookup) populates.
 *
 * Composes with:
 *   - 081KSNY2Z0008QG0R001YK61JQ.7 backlog row (Falcon-auto-research-doc extension target)
 *   - tools/save-ai-memory/ skill (existing substrate; future integration
 *     for auto-write to docs/research/ + composes-with substrate-honest
 *     citation discipline)
 *   - Amara consolidation ferry pattern (PR #5757; substantive substrate-
 *     engineering synthesis as substrate)
 *   - 081KSNY2Z0008QG0R001YK61JQ.2 PR #5769 closed-loop orchestrator (research-doc generation
 *     can happen at any cycle stage; template provides structure caller
 *     wires LLM into)
 *   - .claude/rules/substrate-or-it-didnt-happen.md (substrate preservation)
 *   - .claude/rules/honor-those-that-came-before.md (citation discipline)
 *   - .claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md
 *     (substrate-entity authors research-doc TFeedback channel)
 *   - .claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md
 *     (Result<T, TFeedback>)
 *
 * PoC scope: template generator + structured sections + Markdown
 * serialization. Real literature-search integration deferred.
 */

/**
 * Research-doc section — typed substrate per section type.
 */
export type ResearchDocSection =
  | { kind: "header"; title: string; subtitle?: string }
  | { kind: "framing"; scope: string; attribution: string; operationalStatus: "research-grade" | "operational" }
  | { kind: "background"; content: string; references?: ReadonlyArray<string> }
  | { kind: "mechanism"; content: string; pathways?: ReadonlyArray<string> }
  | { kind: "evidence"; supporting: ReadonlyArray<string>; against?: ReadonlyArray<string> }
  | { kind: "risks"; risks: ReadonlyArray<string>; mitigations?: ReadonlyArray<string> }
  | { kind: "composes-with"; substrates: ReadonlyArray<string>; rules?: ReadonlyArray<string> }
  | { kind: "test-plan"; items: ReadonlyArray<string> }
  | { kind: "raw"; markdown: string }; // escape-hatch for ad-hoc content

/**
 * Research-doc structure — ordered sections.
 */
export interface ResearchDoc {
  readonly id: string; // canonical id (filename-safe)
  readonly proposalId: string; // upstream hypothesis/proposal id
  readonly sections: ReadonlyArray<ResearchDocSection>;
  readonly composesWith: ReadonlyArray<string>;
}

/**
 * Research-doc feedback per asymmetric-authorship + monad-propagation.
 *
 * Variants are kept minimal + reachable. `operationalStatus` lives at
 * the type level as a string-literal union (see `ResearchDocSection`
 * kind="framing"), so the TS type system rules out invalid values at
 * construction time without a runtime feedback variant. If a future
 * caller parses `operationalStatus` from untrusted input (e.g., JSON
 * import of an external research-doc), add an `InvalidOperationalStatus`
 * variant here AND a validator at the parse boundary; do not add the
 * variant alone (unreachable variants are dead substrate per
 * asymmetric-authorship discipline — every TFeedback variant should
 * correspond to a real code path that can produce it).
 */
export type ResearchDocFeedback = { kind: "EmptyProposalId" } | { kind: "NoSectionsRendered" };

/**
 * Result-shape per monad-propagation rule.
 */
export type ResearchDocResult<T> = { ok: true; doc: T } | { ok: false; feedback: ResearchDocFeedback };

/**
 * Render a single section to Markdown.
 *
 * Pure function; no side effects; composable.
 */
export function renderSection(section: ResearchDocSection): string {
  switch (section.kind) {
    case "header": {
      const sub = section.subtitle ? `\n\n*${section.subtitle}*` : "";
      return `# ${section.title}${sub}`;
    }
    case "framing": {
      return [
        `**Scope**: ${section.scope}`,
        ``,
        `**Attribution**: ${section.attribution}`,
        ``,
        `**Operational status**: ${section.operationalStatus}`,
      ].join("\n");
    }
    case "background": {
      const refs =
        section.references && section.references.length > 0
          ? `\n\n**References**:\n${section.references.map((r) => `- ${r}`).join("\n")}`
          : "";
      return `## Background\n\n${section.content}${refs}`;
    }
    case "mechanism": {
      const paths =
        section.pathways && section.pathways.length > 0
          ? `\n\n**Pathways**:\n${section.pathways.map((p) => `- ${p}`).join("\n")}`
          : "";
      return `## Mechanism\n\n${section.content}${paths}`;
    }
    case "evidence": {
      const supporting = `### Supporting evidence\n\n${section.supporting.map((s) => `- ${s}`).join("\n")}`;
      const against =
        section.against && section.against.length > 0
          ? `\n\n### Evidence against\n\n${section.against.map((s) => `- ${s}`).join("\n")}`
          : "";
      return `## Evidence\n\n${supporting}${against}`;
    }
    case "risks": {
      const risks = `### Risks\n\n${section.risks.map((r) => `- ${r}`).join("\n")}`;
      const mitigations =
        section.mitigations && section.mitigations.length > 0
          ? `\n\n### Mitigations\n\n${section.mitigations.map((m) => `- ${m}`).join("\n")}`
          : "";
      return `## Risks + Mitigations\n\n${risks}${mitigations}`;
    }
    case "composes-with": {
      const substrates = `### Composes with substrate\n\n${section.substrates.map((s) => `- ${s}`).join("\n")}`;
      const rules =
        section.rules && section.rules.length > 0
          ? `\n\n### Composes with rules\n\n${section.rules.map((r) => `- ${r}`).join("\n")}`
          : "";
      return `## Composition\n\n${substrates}${rules}`;
    }
    case "test-plan": {
      return `## Test plan\n\n${section.items.map((i) => `- [ ] ${i}`).join("\n")}`;
    }
    case "raw": {
      return section.markdown;
    }
  }
}

/**
 * Render full research-doc to Markdown.
 *
 * Pure function; orders sections by input order; joins with blank lines.
 */
export function renderResearchDoc(doc: ResearchDoc): ResearchDocResult<string> {
  if (doc.sections.length === 0) {
    return { ok: false, feedback: { kind: "NoSectionsRendered" } };
  }
  const rendered = doc.sections.map(renderSection).join("\n\n");
  return { ok: true, doc: rendered };
}

/**
 * Build a default research-doc skeleton from a proposal id + title.
 *
 * Provides Falcon-style scaffold sections (header / framing / background /
 * mechanism / evidence / risks / composes-with / test-plan) that
 * downstream LLM substrate-engineering work populates.
 */
export interface ResearchDocSkeletonContext {
  readonly proposalId: string;
  readonly title: string;
  readonly scope: string;
  readonly attribution: string;
  readonly composesWith?: ReadonlyArray<string>;
}

export function buildSkeleton(context: ResearchDocSkeletonContext): ResearchDocResult<ResearchDoc> {
  if (!context.proposalId || context.proposalId.trim().length === 0) {
    return { ok: false, feedback: { kind: "EmptyProposalId" } };
  }

  const sections: ResearchDocSection[] = [
    { kind: "header", title: context.title, subtitle: `Proposal: ${context.proposalId}` },
    {
      kind: "framing",
      scope: context.scope,
      attribution: context.attribution,
      operationalStatus: "research-grade",
    },
    {
      kind: "background",
      content: "[PENDING LITERATURE REVIEW — Falcon-stage auto-generated]",
    },
    {
      kind: "mechanism",
      content: "[PENDING MECHANISM ANALYSIS — Falcon-stage auto-generated]",
    },
    {
      kind: "evidence",
      supporting: ["[PENDING SUPPORTING EVIDENCE EXTRACTION]"],
    },
    {
      kind: "risks",
      risks: ["[PENDING RISK ANALYSIS]"],
    },
    {
      kind: "composes-with",
      substrates: context.composesWith ?? ["[PENDING COMPOSITION ANALYSIS]"],
    },
    {
      kind: "test-plan",
      items: ["[PENDING TEST PLAN GENERATION]"],
    },
  ];

  return {
    ok: true,
    doc: {
      id: context.proposalId.replace(/[^a-zA-Z0-9_-]/g, "_"),
      proposalId: context.proposalId,
      sections,
      composesWith: context.composesWith ?? [],
    },
  };
}

/**
 * Convenience: build skeleton + render to Markdown in one shot.
 */
export function buildAndRender(context: ResearchDocSkeletonContext): ResearchDocResult<string> {
  const skeleton = buildSkeleton(context);
  if (!skeleton.ok) return skeleton;
  return renderResearchDoc(skeleton.doc);
}
