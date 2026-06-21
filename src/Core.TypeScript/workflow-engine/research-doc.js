/**
 * src/Core.TypeScript/workflow-engine/research-doc.ts
 *
 * 081KDX1YWP008QG0R003XNT2Z1 — Falcon-style auto-generate-substrate-research-doc per
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
 *   - 081KDX1YWP008QG0R003XNT2Z1 backlog row (Falcon-auto-research-doc extension target)
 *   - tools/save-ai-memory/ skill (existing substrate; future integration
 *     for auto-write to docs/research/ + composes-with substrate-honest
 *     citation discipline)
 *   - Amara consolidation ferry pattern (PR #5757; substantive substrate-
 *     engineering synthesis as substrate)
 *   - 081KDX1YWP008QG0R002221Y19 PR #5769 closed-loop orchestrator (research-doc generation
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
 * Render a single section to Markdown.
 *
 * Pure function; no side effects; composable.
 */
export function renderSection(section) {
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
            const refs = section.references && section.references.length > 0
                ? `\n\n**References**:\n${section.references.map((r) => `- ${r}`).join("\n")}`
                : "";
            return `## Background\n\n${section.content}${refs}`;
        }
        case "mechanism": {
            const paths = section.pathways && section.pathways.length > 0
                ? `\n\n**Pathways**:\n${section.pathways.map((p) => `- ${p}`).join("\n")}`
                : "";
            return `## Mechanism\n\n${section.content}${paths}`;
        }
        case "evidence": {
            const supporting = `### Supporting evidence\n\n${section.supporting.map((s) => `- ${s}`).join("\n")}`;
            const against = section.against && section.against.length > 0
                ? `\n\n### Evidence against\n\n${section.against.map((s) => `- ${s}`).join("\n")}`
                : "";
            return `## Evidence\n\n${supporting}${against}`;
        }
        case "risks": {
            const risks = `### Risks\n\n${section.risks.map((r) => `- ${r}`).join("\n")}`;
            const mitigations = section.mitigations && section.mitigations.length > 0
                ? `\n\n### Mitigations\n\n${section.mitigations.map((m) => `- ${m}`).join("\n")}`
                : "";
            return `## Risks + Mitigations\n\n${risks}${mitigations}`;
        }
        case "composes-with": {
            const substrates = `### Composes with substrate\n\n${section.substrates.map((s) => `- ${s}`).join("\n")}`;
            const rules = section.rules && section.rules.length > 0
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
export function renderResearchDoc(doc) {
    if (doc.sections.length === 0) {
        return { ok: false, feedback: { kind: "NoSectionsRendered" } };
    }
    const rendered = doc.sections.map(renderSection).join("\n\n");
    return { ok: true, doc: rendered };
}
export function buildSkeleton(context) {
    if (!context.proposalId || context.proposalId.trim().length === 0) {
        return { ok: false, feedback: { kind: "EmptyProposalId" } };
    }
    const sections = [
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
export function buildAndRender(context) {
    const skeleton = buildSkeleton(context);
    if (!skeleton.ok)
        return skeleton;
    return renderResearchDoc(skeleton.doc);
}
