/**
 * tools/agent-bus/g-set-view.ts — the agent-bus AS a first-class G-Set
 * (081KSXN940008QG0R00171YAZW on the G-Set foundation; the read-model the §3 math note describes).
 *
 * The existing `subscribe.ts` reads ONE `origin/main` tree via an ordered
 * `(timestamp, id)` cursor — exactly right for "stream me what's new in MY clone."
 * But the **cross-machine** bus state is the UNION of every machine's clone, and
 * the union of disjoint ZetaId-named envelope files IS a **G-Set** (grow-only,
 * idempotent / commutative / associative — the three CRDT convergence laws). This
 * module models that union explicitly, on the first-class `GSet` (`src/Core.TypeScript/g-set/`).
 *
 * This is the 081KSXN940008QG0R003FCQ7WT §0 agent-partition recognition applied to the bus: each clone
 * is a shard; the global bus = the CRDT **merge** of shards; no coordinator is
 * needed because the merge is a pure G-Set union. It is monotone, so per CALM it is
 * coordination-free: reading + merging bus views across machines never needs to
 * agree on an order — union is commutative + idempotent.
 *
 * PURE: no git, no IO. Callers feed it the envelopes that `subscribe.ts`'
 * `readEnvelopesFromGitRef` / `readEnvelopesSince` already produced (per machine),
 * and this folds + merges them. Composes the read side onto the algebra.
 */
import { contains, ofArray, stringCompare, toArray, union } from "../g-set/g-set";
/**
 * The bus AS a G-Set: the grow-only set of envelope ids. Idempotent — re-reading
 * the same clone (or duplicate envelopes sharing an id) yields the same set.
 */
export function busIdSet(envelopes) {
    return ofArray(stringCompare, envelopes.map((e) => e.id));
}
/**
 * Cross-machine merge: union the id-sets of N machines' clones. This is the whole
 * cross-machine story in one line — disjoint ZetaId files mean the union is exact
 * and conflict-free (G-Set CRDT). Commutative + idempotent: merge order does not
 * matter and re-merging a view already included changes nothing.
 */
export function mergeViews(views) {
    let acc = [];
    for (const v of views)
        acc = union(stringCompare, acc, v);
    return acc;
}
/**
 * Ids a peer's clone has that mine does not — "what's new to me after a merge."
 * (A set difference: present-in-`theirs`, absent-from-`mine`.)
 */
export function unseen(mine, theirs) {
    return toArray(theirs).filter((id) => !contains(stringCompare, mine, id));
}
/**
 * Re-hydrate the merged id-set back to envelopes, given a per-id lookup built from
 * the machines' reads. Ids with no envelope in `byId` are dropped (best-effort,
 * schema-on-read already filtered malformed envelopes upstream).
 */
export function envelopesIn(ids, byId) {
    const out = [];
    for (const id of toArray(ids)) {
        const env = byId.get(id);
        if (env !== undefined)
            out.push(env);
    }
    return out;
}
