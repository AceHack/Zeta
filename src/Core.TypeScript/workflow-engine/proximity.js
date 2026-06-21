/**
 * src/Core.TypeScript/workflow-engine/proximity.ts
 *
 * 081KDX1YWP008QG0R000B091D7 — proximity agent substrate for substrate-engineering
 * substrate de-duplication.
 *
 * Per Google co-scientist proximity agent (Nature 2026): maps ideas
 * into high-dimensional space + groups similar variants to detect
 * when generation produces near-duplicate hypotheses. Prevents wasting
 * compute on substantively-identical proposals.
 *
 * This substrate ships TWO de-duplication mechanisms:
 *   - canonical-form normalization (deterministic; no embedding model)
 *   - similarity-by-shared-tokens (lightweight; no external dependency)
 *
 * Real semantic embeddings (TF-IDF / sentence-BERT / etc.) deferred to
 * substrate-engineering work after operator-substrate-direction; current
 * PoC handles the structural dedup case (substrate-engineering work
 * often produces variants that differ only in serialization order, key
 * casing, attribute ordering).
 *
 * Composes with:
 *   - 081KSNY2Z0008QG0R001YK61JQ subtask .6 (parent row `081KSNY2Z0008QG0R001YK61JQ-co-scientist-plus-robin-...`
 *     §"### 081KDX1YWP008QG0R000B091D7 — Proximity-agent for substrate-engineering substrate
 *     de-duplication"; the seven .N subtasks are sections within the
 *     parent row, NOT separate 081KSNY2Z0008QG0R001YK61JQ.N row files)
 *   - 081KSNY2Z0008QG0R001YK61JQ subtask .5 (PR #5767 evolution substrate — Survivor de-dup
 *     before mash)
 *   - 081KSNY2Z0008QG0R001YK61JQ subtask .2 (PR #5769 closed-loop — de-dup pre-CI-dispatch
 *     saves cycles)
 *   - .claude/rules/verify-existing-substrate-before-authoring (proximity
 *     IS substrate-inventory at runtime scope)
 *   - .claude/rules/grep-substrate-anchors-before-razor-as-metaphysical
 *     (verify substrate anchors before razor-flagging; proximity-dedup
 *     IS the substrate-anchor check at run-time scope)
 *   - .claude/rules/additive-not-zero-sum (substrate compounds; don't
 *     mint parallel substrate-engineering substrate)
 *   - .claude/rules/monad-propagation-pattern (Result<T, TFeedback>)
 *   - .claude/rules/asymmetric-authorship (substrate-entity authors
 *     proximity verdict via TFeedback)
 */
/**
 * Cluster items by canonical-form normalization.
 *
 * Items with the same canonical form go into the same cluster.
 * The first item in each cluster (by input order) is the representative.
 * Caller can override representative selection by pre-sorting input
 * (e.g., by TrueSkill conservativeSkill descending → top-ranked
 * representative).
 *
 * Pure function; no side effects; composable via Result.bind.
 */
export function clusterByCanonical(corpus, canonicalFn) {
    if (corpus.length === 0) {
        return { ok: false, feedback: { kind: "EmptyCorpus" } };
    }
    const byCanonical = new Map();
    const repByCanonical = new Map();
    for (const item of corpus) {
        const canonical = canonicalFn(item);
        const existing = byCanonical.get(canonical);
        if (existing) {
            existing.push(item);
        }
        else {
            byCanonical.set(canonical, [item]);
            repByCanonical.set(canonical, item); // first-seen is representative
        }
    }
    const clusters = [];
    for (const [canonical, members] of byCanonical.entries()) {
        clusters.push({
            representative: repByCanonical.get(canonical),
            members,
            canonicalForm: canonical,
        });
    }
    return {
        ok: true,
        clusters,
        uniqueCount: clusters.length,
    };
}
/**
 * Token-based similarity: Jaccard coefficient on shared tokens.
 *
 * Returns value in [0, 1]:
 *   1.0 = identical token sets
 *   0.0 = no shared tokens
 *
 * Useful for comparing two substrate items where canonical-form
 * normalization is too strict (need fuzzy matching).
 */
export function jaccardSimilarity(tokensA, tokensB) {
    if (tokensA.size === 0 && tokensB.size === 0)
        return 1.0;
    if (tokensA.size === 0 || tokensB.size === 0)
        return 0.0;
    const intersection = new Set();
    for (const t of tokensA) {
        if (tokensB.has(t))
            intersection.add(t);
    }
    const unionSize = tokensA.size + tokensB.size - intersection.size;
    return intersection.size / unionSize;
}
/**
 * Token extraction: simple word-splitting + lowercase + filter stop words.
 *
 * Caller can supply custom tokenizer for domain-specific tokenization
 * (medical terminology, code identifiers, etc.).
 */
export function defaultTokenize(text) {
    const stopWords = new Set([
        "a",
        "an",
        "the",
        "is",
        "are",
        "of",
        "in",
        "on",
        "at",
        "to",
        "for",
        "with",
        "by",
        "as",
        "and",
        "or",
        "but",
        "if",
        "then",
        "this",
        "that",
        "these",
        "those",
        "it",
        "its",
        "be",
        "been",
        "was",
        "were",
    ]);
    const tokens = new Set();
    const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    for (const w of words) {
        if (!stopWords.has(w) && w.length >= 2) {
            tokens.add(w);
        }
    }
    return tokens;
}
export function clusterBySimilarity(context) {
    if (context.corpus.length === 0) {
        return { ok: false, feedback: { kind: "EmptyCorpus" } };
    }
    if (context.threshold <= 0 || context.threshold > 1 || !Number.isFinite(context.threshold)) {
        return { ok: false, feedback: { kind: "InvalidThreshold", threshold: context.threshold } };
    }
    const clusterData = [];
    for (const item of context.corpus) {
        const itemTokens = context.extractTokens(item);
        let bestClusterIdx = -1;
        let bestSimilarity = 0;
        for (let i = 0; i < clusterData.length; i++) {
            const sim = jaccardSimilarity(itemTokens, clusterData[i].repTokens);
            if (sim > bestSimilarity) {
                bestSimilarity = sim;
                bestClusterIdx = i;
            }
        }
        if (bestClusterIdx >= 0 && bestSimilarity >= context.threshold) {
            clusterData[bestClusterIdx].members.push(item);
        }
        else {
            clusterData.push({ rep: item, repTokens: itemTokens, members: [item] });
        }
    }
    const clusters = clusterData.map((c) => ({
        representative: c.rep,
        members: c.members,
        canonicalForm: `[similarity:${context.threshold}]:${[...c.repTokens].sort().join(",")}`,
    }));
    return {
        ok: true,
        clusters,
        uniqueCount: clusters.length,
    };
}
/**
 * Convenience: extract representatives only (drop duplicates).
 *
 * Substrate-honest substrate-engineering: when dedup is the goal,
 * this is the canonical "give me the unique items" form.
 */
export function uniqueRepresentatives(result) {
    if (!result.ok)
        return [];
    return result.clusters.map((c) => c.representative);
}
