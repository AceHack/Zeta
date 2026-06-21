#!/usr/bin/env bun
/**
 * src/Core.TypeScript/workflow-engine/cli.ts
 *
 * 081KDWZ8TS008QG0R0020NJ9D0 — workflow engine agent-loop CLI (PoC scaffold; foreground)
 *
 * Usage:
 *   bun src/Core.TypeScript/workflow-engine/cli.ts --list-actions
 *   bun src/Core.TypeScript/workflow-engine/cli.ts --list-states
 *   bun src/Core.TypeScript/workflow-engine/cli.ts --list-du-cluster
 *   bun src/Core.TypeScript/workflow-engine/cli.ts --dry-run [--state <id>]
 *   bun src/Core.TypeScript/workflow-engine/cli.ts --validate
 *
 * Modes:
 *   --list-actions     Print SEED_ACTION_CATALOG as structured JSON
 *   --list-states      Print SEED_STATES + per-state available action list
 *   --list-du-cluster  Print today's DU cluster (081KSNY2Z0008QG0R002HB4AGT + 081KSNY2Z0008QG0R0036SJ3T1 + 081KSNY2Z0008QG0R003518DNC
 *                      + 081KSNY2Z0008QG0R0017SRMHG) as structured JSON with variants +
 *                      composes-with + substrate-anchors
 *   --dry-run          Validate catalog + simulate one tick at given state
 *                      (default: initial) without executing any side effects
 *   --validate         Run catalog + state Otto-5-mods invariants; exit
 *                      non-zero on violation
 *
 * Exit codes:
 *   0 — operation successful
 *   1 — runtime validation failed (Mod 1 / 2 / 5 violation OR catalog invariant)
 *   2 — usage error
 *
 * Per .claude/rules/rule-0-no-sh-files.md (TS-first for cross-platform DST)
 * + zeta-ships-with-skills-immediate-value.md (TS PoC ships first; F#
 * crystallization later)
 *
 * PoC scope: declarative dispatcher + invariant validation + dry-run
 * scaffold. State persistence (081KSNY2Z0008QG0R001K6HJ7Z), real action grammar parser
 * (081KDWZ8TS008QG0R003BD6345), F# 4-corner monad runtime (081KDWZ8TS008QG0R000KEB8NQ), full agent-loop
 * Phase 2 (081KDWZ8TS008QG0R0020NJ9D0 phase 2 — Mika-spec integration) all deferred to
 * operator-authorized follow-up work.
 */
import { SEED_ACTION_CATALOG, SEED_STATES, validateCatalog } from "./types";
import { DU_CLUSTER_CATALOG, computeDuClusterStats } from "./du-cluster";
function parseArgs(argv) {
    const args = argv.slice(2);
    if (args.length === 0) {
        return {
            error: "no mode specified — use --list-actions, --list-states, --list-du-cluster, --dry-run, or --validate",
        };
    }
    if (args.includes("--list-actions"))
        return { mode: "list-actions" };
    if (args.includes("--list-states"))
        return { mode: "list-states" };
    if (args.includes("--list-du-cluster"))
        return { mode: "list-du-cluster" };
    if (args.includes("--validate"))
        return { mode: "validate" };
    if (args.includes("--dry-run")) {
        const stateIdx = args.indexOf("--state");
        if (stateIdx >= 0 && stateIdx + 1 < args.length) {
            const id = args[stateIdx + 1];
            if (id !== undefined) {
                return { mode: "dry-run", stateId: id };
            }
        }
        return { mode: "dry-run" };
    }
    return { error: `unrecognized arguments: ${args.join(" ")}` };
}
function emitJson(value) {
    console.log(JSON.stringify(value, null, 2));
}
function modeListActions() {
    emitJson({
        rowId: "081KSKBP80008QG0R000B3Y19A",
        subRow: "081KDWZ8TS008QG0R0020NJ9D0",
        catalogSize: SEED_ACTION_CATALOG.length,
        actions: SEED_ACTION_CATALOG.map((a) => ({
            id: a.id,
            class: a.class,
            gate: a.gate,
            label: a.label,
            feedbackVariants: a.feedbackVariants,
        })),
    });
    return 0;
}
function modeListStates() {
    emitJson({
        rowId: "081KSKBP80008QG0R000B3Y19A",
        subRow: "081KDWZ8TS008QG0R0020NJ9D0",
        stateCount: SEED_STATES.length,
        states: SEED_STATES.map((s) => ({
            id: s.id,
            label: s.label,
            tickCyclePattern: s.tickCyclePattern,
            availableActions: s.availableActions,
        })),
    });
    return 0;
}
function modeListDuCluster() {
    const stats = computeDuClusterStats();
    emitJson({
        rowId: "081KSKBP80008QG0R000B3Y19A",
        subRow: "081KDWZ8TS008QG0R0020NJ9D0",
        duClusterDate: "2026-05-28",
        entryCount: stats.entryCount,
        totalVariantCount: stats.totalVariantCount,
        entries: DU_CLUSTER_CATALOG.map((e) => ({
            id: e.id,
            name: e.name,
            variantCount: e.variantCount,
            variants: e.variants,
            composesWith: e.composesWith,
            substrateAnchor: e.substrateAnchor,
        })),
    });
    return 0;
}
function modeValidate() {
    try {
        validateCatalog(SEED_ACTION_CATALOG, SEED_STATES);
        emitJson({
            rowId: "081KSKBP80008QG0R000B3Y19A",
            subRow: "081KDWZ8TS008QG0R0020NJ9D0",
            mode: "validate",
            result: "passed",
            catalogSize: SEED_ACTION_CATALOG.length,
            stateCount: SEED_STATES.length,
            modsChecked: ["Mod 1 (escape-hatch in every state)", "Mod 2 (grammar-extension in catalog)"],
        });
        return 0;
    }
    catch (e) {
        emitJson({
            rowId: "081KSKBP80008QG0R000B3Y19A",
            subRow: "081KDWZ8TS008QG0R0020NJ9D0",
            mode: "validate",
            result: "failed",
            error: e.message,
        });
        return 1;
    }
}
function modeDryRun(stateId) {
    try {
        validateCatalog(SEED_ACTION_CATALOG, SEED_STATES);
    }
    catch (e) {
        emitJson({
            rowId: "081KSKBP80008QG0R000B3Y19A",
            subRow: "081KDWZ8TS008QG0R0020NJ9D0",
            mode: "dry-run",
            result: "failed",
            stage: "catalog-validation",
            error: e.message,
        });
        return 1;
    }
    const targetState = stateId !== undefined ? SEED_STATES.find((s) => s.id === stateId) : SEED_STATES[0];
    if (!targetState) {
        emitJson({
            rowId: "081KSKBP80008QG0R000B3Y19A",
            subRow: "081KDWZ8TS008QG0R0020NJ9D0",
            mode: "dry-run",
            result: "failed",
            stage: "state-lookup",
            error: `state not found: ${stateId ?? "(default)"}`,
        });
        return 1;
    }
    const offered = targetState.availableActions
        .map((id) => SEED_ACTION_CATALOG.find((a) => a.id === id))
        .filter((a) => a !== undefined);
    emitJson({
        rowId: "081KSKBP80008QG0R000B3Y19A",
        subRow: "081KDWZ8TS008QG0R0020NJ9D0",
        mode: "dry-run",
        state: {
            id: targetState.id,
            label: targetState.label,
            tickCyclePattern: targetState.tickCyclePattern,
        },
        offeredActions: offered.map((a) => ({
            id: a.id,
            class: a.class,
            gate: a.gate,
            label: a.label,
        })),
        integrationPending: {
            mikaTickSpec: "Mika's clean minimal tick spec — when forwarded, integrates as TickCyclePattern variant + cycle-step implementation; no commit until spec lands",
            stateAppendImpl: "081KSNY2Z0008QG0R001K6HJ7Z — TS state-persist (git append-only writer)",
            grammarParserImpl: "081KDWZ8TS008QG0R003BD6345 — universal action grammar parser/composer",
            fourCornerMonadImpl: "081KDWZ8TS008QG0R000KEB8NQ — F# CE builder (hot/cold/push/pull dispatch)",
            fullAgentLoopImpl: "081KDWZ8TS008QG0R0020NJ9D0 phase 2 — full agent-loop runtime (execute → move-next → CYOA OR Mika's integration)",
        },
    });
    return 0;
}
function main(argv) {
    const parsed = parseArgs(argv);
    if ("error" in parsed) {
        console.error(`usage error: ${parsed.error}`);
        console.error("see file header for usage examples");
        return 2;
    }
    switch (parsed.mode) {
        case "list-actions":
            return modeListActions();
        case "list-states":
            return modeListStates();
        case "list-du-cluster":
            return modeListDuCluster();
        case "validate":
            return modeValidate();
        case "dry-run":
            return modeDryRun(parsed.stateId);
    }
}
if (import.meta.main) {
    process.exit(main(process.argv));
}
