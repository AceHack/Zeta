#!/usr/bin/env bun
// concept_registry.ts — B-0310, B-0361
// Extracts load-bearing concept IDs from source surfaces into
// a single JSON registry. B-0361 adds anchor: field tying each
// concept to its established academic/formal definition where
// one exists, preventing tautology and "reinvention without citation"
// (the Z3 shadow-catch failure mode).
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
const REPO_ROOT = resolve(import.meta.dir, "../../..");
// Static map: concept-id to established academic/formal citation.
// B-0361 origin: 2026-05-09 adversarial review demonstrated that
// SharedTrace/PrivateState/Agenda/Policy/Membrane all have established
// formal definitions (CSP, Dec-POMDPs, Pearl). This map is the
// lightweight substrate version of that discipline.
const KNOWN_ANCHORS = {
    // GOVERNANCE.md §33 Non-fusion disclaimer — Pearl interventional independence
    "non-fusion": {
        citation: "Pearl (2009) interventional independence — d-separation criterion: " +
            "shared patterns ≠ causal fusion. " +
            "'Causality: Models, Reasoning and Inference', Ch. 2.",
        state: "anchored",
    },
    // Glass-halo doctrine concepts
    "glass-halo": {
        citation: "Glass-box / interpretability tradition (Lipton 2018 " +
            "'The Mythos of Model Interpretability'); factory name combines " +
            "radical honesty + total observability.",
        state: "partially-anchored",
    },
    "retraction-native": {
        citation: "CRDT retraction semantics (Shapiro et al. 2011 'Conflict-Free " +
            "Replicated Data Types'); temporal-database retraction (Snodgrass 1999). " +
            "Factory extension: every operator emits a bounded-blast-radius delta.",
        state: "partially-anchored",
    },
    "bidirectional-alignment": {
        citation: "Russell (2019) Cooperative IRL — value-uncertainty alignment as " +
            "two-player cooperative game; Hadfield-Menell et al. (2016) CIRL. " +
            "Factory extension: meta-commitment framing.",
        state: "partially-anchored",
    },
    "no-directives": {
        citation: "Korsgaard (1996) self-constitutive agency — autonomy grounded in " +
            "self-determined ends, not external command. Factory instance: " +
            "framing inputs as corrections preserves accountable autonomy.",
        state: "partially-anchored",
    },
    "radical-honesty": {
        citation: "Blanton (1994) radical honesty — complete truthfulness as ethical " +
            "and relational norm. Factory extension: applied to AI observability.",
        state: "partially-anchored",
    },
    "total-observability": {
        citation: "Observability engineering (Majors et al. 2022 'Observability " +
            "Engineering') — system state inferable from external outputs. " +
            "Factory extension: agent substrate must be fully observable.",
        state: "partially-anchored",
    },
    "substrate-or-it-didnt-happen": {
        citation: "",
        state: "factory-native",
    },
};
function readFile(rel) {
    const abs = join(REPO_ROOT, rel);
    return existsSync(abs) ? readFileSync(abs, "utf8") : "";
}
function lineAt(content, index) {
    const lineIdx = content.lastIndexOf("\n", index);
    const lineEnd = content.indexOf("\n", index);
    return content.slice(lineIdx + 1, lineEnd > 0 ? lineEnd : undefined).trim();
}
function attachAnchor(concept) {
    const known = KNOWN_ANCHORS[concept.id];
    if (!known)
        return concept;
    return {
        ...concept,
        ...(known.state !== "factory-native" ? { anchor: known.citation } : {}),
        anchorState: known.state,
    };
}
function extractByRegex(surface, pattern, conceptClass) {
    const content = readFile(surface);
    const concepts = [];
    const seen = new Set();
    let match;
    while ((match = pattern.exec(content)) !== null) {
        const id = match[1];
        if (seen.has(id))
            continue;
        seen.add(id);
        concepts.push(attachAnchor({
            id,
            conceptClass,
            source: surface,
            label: lineAt(content, match.index).slice(0, 120),
        }));
    }
    return concepts;
}
function extractGlassHaloDoctrines() {
    const concepts = [];
    const doctrines = [
        { id: "radical-honesty", pattern: /radical.honesty/i },
        { id: "total-observability", pattern: /total.observability/i },
        { id: "glass-halo", pattern: /glass.halo/i },
        { id: "retraction-native", pattern: /retraction.native/i },
        { id: "substrate-or-it-didnt-happen", pattern: /substrate.or.it.didn/i },
        { id: "no-directives", pattern: /no.directives/i },
        { id: "bidirectional-alignment", pattern: /bidirectional.alignment/i },
        // B-0361: non-fusion anchor — Pearl interventional independence
        { id: "non-fusion", pattern: /non-fusion\s+disclaimer/i },
    ];
    const surfaces = ["AGENTS.md", "docs/ALIGNMENT.md", "GOVERNANCE.md"];
    for (const { id, pattern } of doctrines) {
        for (const surface of surfaces) {
            const content = readFile(surface);
            const match = content.match(pattern);
            if (match) {
                concepts.push(attachAnchor({
                    id,
                    conceptClass: "glass-halo-doctrine",
                    source: surface,
                    label: lineAt(content, match.index).slice(0, 120),
                }));
                break;
            }
        }
    }
    return concepts;
}
function buildRegistry() {
    const concepts = [
        ...extractByRegex("docs/ALIGNMENT.md", /\b(HC-[1-7]|SD-[1-9]|DIR-[1-5])\b/g, "alignment-clause"),
        ...extractByRegex("docs/AGENT-BEST-PRACTICES.md", /\b(BP-\d+)\b/g, "best-practice"),
        ...extractByRegex("CLAUDE.md", /\b(Otto-\d+)\b/g, "otto-principle"),
        ...extractByRegex("AGENTS.md", /\b(Otto-\d+)\b/g, "otto-principle"),
        ...extractGlassHaloDoctrines(),
    ];
    const deduped = concepts.filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
    const summary = {};
    for (const c of deduped) {
        summary[c.conceptClass] = (summary[c.conceptClass] ?? 0) + 1;
    }
    const anchoredCount = deduped.filter((c) => c.anchorState && c.anchorState !== "factory-native").length;
    return {
        schema: "concept-registry-v1.1",
        generated: new Date().toISOString(),
        concepts: deduped,
        summary,
        anchoredCount,
    };
}
if (import.meta.main) {
    const registry = buildRegistry();
    console.log(JSON.stringify(registry, null, 2));
}
export { buildRegistry, extractByRegex, extractGlassHaloDoctrines };
