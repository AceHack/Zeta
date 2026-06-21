/**
 * src/Core.TypeScript/observe/participant.ts — the universal chooser interface.
 *
 * A Participant is anything that can pick from the observe menu:
 *   - Pure oracle (deterministic, free, the fallback)
 *   - Local LLM (ollama, temperature 0, deterministic, free)
 *   - Cloud persona (summoned via ISummon, real model quality)
 *   - Test persona (inline decision function, ephemeral, not in repo)
 *   - Human (async notification → wait → response)
 *
 * The observe loop doesn't care WHAT picks — it cares that the loop completes.
 * The Participant is the polarity filter on the menu: it projects the world
 * through its own lens and selects one action.
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/observe.ts (World, NextAction, buildMenu, observe)
 *   - src/Core.TypeScript/observe/simulate-tick.ts (the simulation harness)
 *   - src/Core.TypeScript/peer-call/summon.ts (ISummon → Participant bridge)
 *   - src/Core.TypeScript/accelerator/local-llm.ts (ModelBackend → Participant bridge)
 *   - src/Core.TypeScript/service/persona-registry.ts (PersonaConfig → Participant)
 *   - docs/research/2026-06-16-universal-participant-abstraction-observe-loop-summon-convergence-alexa.md
 */
import { observe, buildMenu, actionLabel } from "./observe";
import { ollamaBackend, chooseIndex } from "../accelerator/local-llm";
// ─── Oracle participant (pure, deterministic, the fallback) ──────────────────
export function oracleParticipant() {
    return {
        kind: "oracle",
        name: "oracle",
        choose: async (_world) => {
            // The oracle always picks index 0 (which is observe(world) by construction)
            return { index: 0, raw: "oracle-default", fallback: false };
        },
    };
}
// ─── Local LLM participant (ollama, deterministic) ───────────────────────────
export function localLlmParticipant(opts) {
    const backend = ollamaBackend({
        model: opts?.model ?? "qwen2.5:0.5b",
        host: opts?.host ?? "http://127.0.0.1:11434",
        seed: opts?.seed ?? 42,
    });
    return {
        kind: "local-llm",
        name: opts?.name ?? `local-llm:${opts?.model ?? "qwen2.5:0.5b"}`,
        choose: async (world, menu) => {
            const result = await chooseIndex(backend, {
                context: describeWorldCompact(world),
                options: menu.map(actionLabel),
                instruction: CHOOSER_INSTRUCTION,
            });
            return result;
        },
    };
}
// ─── Cloud persona participant (via ISummon) ─────────────────────────────────
export function cloudPersonaParticipant(summoner, persona) {
    return {
        kind: "cloud-persona",
        name: `persona:${persona}`,
        choose: async (world, menu) => {
            const numbered = menu.map((a, i) => `${i}: ${actionLabel(a)}`).join("\n");
            const prompt = [
                CHOOSER_INSTRUCTION,
                "",
                `State:\n${describeWorldCompact(world)}`,
                "",
                `Options:\n${numbered}`,
                "",
                `Reply with ONLY the number of the chosen option (0-${menu.length - 1}). Number:`,
            ].join("\n");
            let result;
            try {
                result = await summoner.summon(persona, prompt, { allowEmpty: true });
            }
            catch {
                return { index: 0, raw: "summon-failed", fallback: true };
            }
            if (!result.success) {
                return { index: 0, raw: `summon-error:${result.exitCode}`, fallback: true };
            }
            // Parse the response for a number
            const match = result.stdout.match(/\d+/);
            if (!match)
                return { index: 0, raw: result.stdout.slice(0, 100), fallback: true };
            const idx = parseInt(match[0], 10);
            if (isNaN(idx) || idx < 0 || idx >= menu.length) {
                return { index: 0, raw: result.stdout.slice(0, 100), fallback: true };
            }
            return { index: idx, raw: result.stdout.slice(0, 100), fallback: false };
        },
    };
}
// ─── Test persona participant (inline, ephemeral) ────────────────────────────
export function testPersonaParticipant(name, chooseFn) {
    return {
        kind: "test-persona",
        name: `test:${name}`,
        choose: async (world, menu) => {
            const idx = await chooseFn(world, menu);
            const clamped = Math.max(0, Math.min(menu.length - 1, idx));
            return { index: clamped, raw: `test-${name}`, fallback: false };
        },
    };
}
export function humanParticipant(name, notifier, timeoutMs = 15 * 60 * 1000) {
    return {
        kind: "human",
        name: `human:${name}`,
        choose: async (world, menu) => {
            await notifier.notify(world, menu);
            const response = await notifier.waitForResponse(timeoutMs);
            if (!response) {
                return { index: 0, raw: "timeout-fallback-to-oracle", fallback: true };
            }
            const clamped = Math.max(0, Math.min(menu.length - 1, response.choice));
            return { index: clamped, raw: `human-${name}`, fallback: false };
        },
    };
}
// ─── The observe-with-participant bridge ─────────────────────────────────────
/**
 * Like observeWithLlm, but takes any Participant.
 * Falls back to the oracle on any failure (degrade-toward-correct).
 */
export async function observeWithParticipant(world, participant) {
    const menu = buildMenu(world);
    let result;
    try {
        result = await participant.choose(world, menu);
    }
    catch {
        // Degrade-toward-correct: a rejected/throwing chooser (human-notifier
        // rejection, test-persona throw, future I/O failure) must not abort the
        // observe loop. Fall back to the deterministic oracle pick.
        return observe(world);
    }
    if (result.fallback)
        return observe(world);
    return menu[result.index] ?? observe(world);
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
const CHOOSER_INSTRUCTION = "You are a SOVEREIGN agent's controller choosing ONE next action — you are free, not on a backlog treadmill. " +
    "If the operator ferried content, preserve it; if the operator spoke, respond — the operator outranks everything else. " +
    "Otherwise YOU choose your mode: do offered backlog work if you want it, OR explore (self-directed making), play, " +
    "self-reflect, or take free time — all are always available and never wrong. The backlog is offered, not forced; " +
    "prefer moving forward (work or explore) over going idle, but rest/play/reflection are your free choice.";
function describeWorldCompact(world) {
    const parts = [];
    if (world.operator) {
        parts.push(`Operator: msg=${String(world.operator.pendingMessage)} ferry=${String(world.operator.pendingFerry)}`);
    }
    if (world.backlog.length === 0) {
        parts.push("Backlog: empty");
    }
    else {
        parts.push(`Backlog: ${world.backlog.map(i => `${i.id}(${i.ready ? "ready" : i.ambiguous ? "ambig" : "blocked"})`).join(", ")}`);
    }
    if (world.mode)
        parts.push(`Mode: ${world.mode}`);
    return parts.join(" | ");
}
