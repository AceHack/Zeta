#!/usr/bin/env bun
/**
 * src/Core.TypeScript/observe/backlog-reader.ts — bridge the REAL backlog to the observe DU.
 *
 * observe.ts's `observe()` is the pure 4-button controller (a toy oracle over a
 * synthetic BacklogItem). The REAL backlog already has a deterministic selector:
 * `src/Core.TypeScript/backlog/autonomous-pickup.ts` `selectNextBacklogItem` (priority-ranked,
 * dependency-aware, claim-aware, decompose-vs-claim). This reader REUSES it and
 * maps its `PickupSelection` onto the observe `NextAction` DU — it does NOT
 * reimplement selection. So on real rows, `selectNextBacklogItem` is the oracle;
 * `observe()` stays the DU definition + the LLM-chooser grading oracle for
 * synthetic scenarios.
 *
 * Mapping:
 *   selected + "claim-and-implement" → do_item
 *   selected + "decompose-first"     → decompose
 *   empty                            → free_time   (the exit)
 *   (edit_grammar is the escape-hatch the agent/LLM raises — not derivable from
 *    backlog frontmatter, so this DETERMINISTIC reader never emits it; it stays
 *    available in the LLM-chooser menu via observe.ts `buildMenu`.)
 *
 * ── FORWARD CONTEXT / MIGRATION SEAM (operator 2026-05-31) ────────────────────
 * Three things this reader absorbs as the system scales — and it is the single
 * place the rest of observe.ts is insulated from all of them:
 *
 *  1. TYPE axis (operator decided: `tasks + bugs`). A backlog row is not its own
 *     thing — it's a WORK-ITEM with a TYPE. Per Azure DevOps (umbrella =
 *     `WorkItem`; `Task` + `Bug` are peer leaf TYPES; Epic/Feature are the
 *     hierarchy above): sub-types are `task` + `bug` (+ later feature/epic).
 *     "backlog" is NOT a type — it's a STATE/view (the queued lane), orthogonal
 *     to type. So: WorkItem.type ∈ {task, bug, …}; WorkItem.state ∈ {backlog,
 *     active, done, …}.
 *
 *  2. ID axis. ZetaId gets a new `WorkItem` CATEGORY (operator 2026-05-31:
 *     "zetaid gets a new workitem category too after bus") — after `Bus`,
 *     alongside `Spawn`/`Heartbeat`. `B-xxxxx` ids COLLIDE at scale (the problem
 *     128-bit ZetaIds solve everywhere else). Migration: `B-xxxxx` → 128-bit
 *     ZetaId **WorkItem-category** ids (the `type` is a sub-type field within
 *     `WorkItem`). THIS reader is where that mapping lands: today `id` carries
 *     `B-xxxxx`; post-migration it carries (or pairs with) a `WorkItem` ZetaId.
 *
 *  3. EXECUTION axis. A WorkItem RUNS AS a durable Task (Durable Functions / Task
 *     framework) whose lifecycle is an Rx `Observable<WorkItemEvent>` (the
 *     heartbeat/bus stream IS that observable). "Task" here is the EXECUTION
 *     primitive — a different layer from the planning `task` TYPE. DECIDED
 *     (operator 2026-05-31): keep `WorkItem` as the planning umbrella (matches
 *     Azure DevOps; clean Jira/ADO plugin-interop; git-native first) and RELATE
 *     it to execution (runs-as-Task, observed-via-Rx) — do NOT replace it with
 *     `Task` (which would invert Azure DevOps + overload the word).
 *
 * Keeping the reader the single seam means observe.ts never sees `B-xxxxx` vs
 * ZetaId, or task vs bug vs state — only the observe DU.
 */
import { readBacklogItems, selectNextBacklogItem } from "../backlog/autonomous-pickup";
import { renderAction } from "./observe";
/**
 * Map the existing backlog selector's result onto the observe DU (pure).
 * `selectNextBacklogItem` only returns an item that already passed its blockers,
 * so a selected item is `ready: true`; `decompose-first` is the `ambiguous` signal.
 */
export function pickupToAction(sel) {
    if (sel.status === "empty" || sel.selected === null) {
        return { kind: "free_time", reason: sel.reason };
    }
    const picked = sel.selected;
    const item = {
        id: picked.id, // B-xxxxx today → ZetaId work-item id post-migration (the seam)
        title: picked.title,
        ready: true,
        ambiguous: sel.action === "decompose-first",
    };
    return sel.action === "decompose-first" ? { kind: "decompose", item } : { kind: "do_item", item };
}
/** Read the real backlog and return the next observe action (deterministic). */
export function nextActionFromBacklog(repoRoot, activeClaims = [], maxPriority = "P2") {
    const items = readBacklogItems(repoRoot);
    const sel = selectNextBacklogItem(items, activeClaims, maxPriority);
    return pickupToAction(sel);
}
// ─── demo: print the real next action from the actual backlog ────────────────
if (import.meta.main) {
    const repoRoot = process.argv[2] ?? process.cwd();
    const action = nextActionFromBacklog(repoRoot);
    console.log(`observe ← real backlog (${repoRoot})`);
    console.log(`  ${renderAction(action)}`);
}
