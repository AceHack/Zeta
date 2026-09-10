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
 *   - src/Core.TypeScript/protocol/summon-contract.ts (the ISummon port this bridges to a
 *     Participant; `peer-call/summon.ts` is one implementation of it, and is never named here)
 *   - src/Core.TypeScript/accelerator/local-llm.ts (ModelBackend → Participant bridge)
 *   - src/Core.TypeScript/service/persona-registry.ts (PersonaConfig → Participant)
 *   - docs/research/2026-06-16-universal-participant-abstraction-observe-loop-summon-convergence-alexa.md
 */

import { observe, buildMenu, actionLabel, type World, type NextAction } from "./observe";
import { ollamaBackend, chooseIndex, parseChosenIndex, type ChooseFallbackCause } from "../accelerator/local-llm";
import type { ISummon, SummonResult } from "../protocol/summon-contract";

// ─── The Participant interface ───────────────────────────────────────────────

export type { ChooseFallbackCause };

export interface ChooseResult {
  readonly index: number; // which menu item was chosen
  readonly raw: string; // the chooser's raw response (for audit)
  readonly fallback: boolean; // true = the oracle's pick was used instead
  /**
   * WHAT went wrong, as distinct from WHAT WAS DONE ABOUT IT.
   *
   * `fallback` and `cause` are deliberately independent here, because participants recover from
   * the same fault differently: `chooseIndex` answers an out-of-range pick with the ORACLE, while
   * `testPersonaParticipant` and `humanParticipant` CLAMP into range. A clamp is a recovery and
   * not an oracle fallback, so collapsing the two would misreport one of them.
   *
   * What matters for the promotion gate is the fault, not the recovery: `out-of-range` is a lane
   * reaching past the menu it was given — an ILLEGAL SELECTION — and it was previously invisible in
   * both paths. Under the clamp it did not even set `fallback`.
   */
  readonly cause: ChooseFallbackCause;
}

export interface Participant {
  readonly kind: "oracle" | "local-llm" | "cloud-persona" | "test-persona" | "human";
  readonly name: string;
  choose(world: World, menu: readonly NextAction[]): Promise<ChooseResult>;
}

// ─── Oracle participant (pure, deterministic, the fallback) ──────────────────

export function oracleParticipant(): Participant {
  return {
    kind: "oracle",
    name: "oracle",
    choose: async (_world) => {
      // The oracle always picks index 0 (which is observe(world) by construction)
      return { index: 0, raw: "oracle-default", fallback: false, cause: "none" };
    },
  };
}

// ─── Local LLM participant (ollama, deterministic) ───────────────────────────

export function localLlmParticipant(opts?: {
  model?: string;
  host?: string;
  seed?: number;
  name?: string;
}): Participant {
  const backend = ollamaBackend({
    model: opts?.model ?? "qwen2.5:0.5b",
    // Env-overridable so "the daemon is down" is a scenario you can RUN rather than a paragraph
    // you believe. Still loopback-guarded by `ollamaBackend` — this widens the port, not the host.
    host: opts?.host ?? process.env["ZETA_OLLAMA_HOST"] ?? "http://127.0.0.1:11434",
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

export function cloudPersonaParticipant(summoner: ISummon, persona: string): Participant {
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

      let result: SummonResult;
      try {
        result = await summoner.summon(persona, prompt, { allowEmpty: true });
      } catch {
        return { index: 0, raw: "summon-failed", fallback: true, cause: "backend-error" };
      }

      if (!result.success) {
        return { index: 0, raw: `summon-error:${result.exitCode}`, fallback: true, cause: "backend-error" };
      }

      // The SAME parser the local path uses. This one matters more: a summon has no token cap, so
      // prose is the normal case here rather than the exception, and the old first-run-of-digits
      // match would read "0-based index: 4" as 0 and report it as a genuine choice.
      const idx = parseChosenIndex(result.stdout);
      if (idx === null) return { index: 0, raw: result.stdout.slice(0, 100), fallback: true, cause: "unparseable" };
      if (idx < 0 || idx >= menu.length) {
        return { index: 0, raw: result.stdout.slice(0, 100), fallback: true, cause: "out-of-range" };
      }
      return { index: idx, raw: result.stdout.slice(0, 100), fallback: false, cause: "none" };
    },
  };
}

// ─── Test persona participant (inline, ephemeral) ────────────────────────────

export function testPersonaParticipant(
  name: string,
  chooseFn: (world: World, menu: readonly NextAction[]) => number | Promise<number>,
): Participant {
  return {
    kind: "test-persona",
    name: `test:${name}`,
    choose: async (world, menu) => {
      const idx = await chooseFn(world, menu);
      const clamped = Math.max(0, Math.min(menu.length - 1, idx));
      // The clamp is KEPT (the recovery is unchanged) and the fault is now REPORTED. Before this,
      // a persona naming slot 999 of 15 produced slot 14 with `fallback: false` — an illegal
      // selection recorded as a legitimate choice.
      const cause: ChooseFallbackCause = clamped === idx ? "none" : "out-of-range";
      return { index: clamped, raw: `test-${name}`, fallback: false, cause };
    },
  };
}

// ─── Human participant (async, notification-gated) ───────────────────────────

export interface HumanNotifier {
  notify(world: World, menu: readonly NextAction[]): Promise<void>;
  waitForResponse(timeoutMs: number): Promise<{ choice: number } | null>;
}

export function humanParticipant(
  name: string,
  notifier: HumanNotifier,
  timeoutMs: number = 15 * 60 * 1000, // 15 minutes default
): Participant {
  return {
    kind: "human",
    name: `human:${name}`,
    choose: async (world, menu) => {
      await notifier.notify(world, menu);
      const response = await notifier.waitForResponse(timeoutMs);
      if (!response) {
        return { index: 0, raw: "timeout-fallback-to-oracle", fallback: true, cause: "backend-error" };
      }
      const clamped = Math.max(0, Math.min(menu.length - 1, response.choice));
      const cause: ChooseFallbackCause = clamped === response.choice ? "none" : "out-of-range";
      return { index: clamped, raw: `human-${name}`, fallback: false, cause };
    },
  };
}

// ─── The observe-with-participant bridge ─────────────────────────────────────

/**
 * Like observeWithLlm, but takes any Participant.
 * Falls back to the oracle on any failure (degrade-toward-correct).
 */
/**
 * One tick's worth of participation, with the facts a caller needs to COUNT it.
 *
 * `observeWithParticipant` returned only the `NextAction` and threw the `ChooseResult` away, so
 * nothing downstream could tell a lane that picked the oracle's action from a lane that named a slot
 * outside its menu and got substituted. `illegalSelections` — the counter the promotion gate
 * demotes on — was therefore structurally always zero, and a lane reaching past its menu on every
 * tick would have soaked its way to primary with a clean record.
 *
 * The recovery is unchanged in every case. Only the reporting is new.
 */
export interface ParticipantTick {
  /** What the loop will actually do. */
  readonly action: NextAction;
  readonly menuSize: number;
  /** The index the participant named, or `null` when `choose()` threw. */
  readonly chosenIndex: number | null;
  /** The participant named a slot the menu does not have. THE counter. */
  readonly illegalSelection: boolean;
  /** The oracle's pick was used instead of the participant's. */
  readonly fellBackToOracle: boolean;
  readonly cause: ChooseFallbackCause;
  /** The action differs in KIND from what the deterministic oracle would have picked. */
  readonly divergedFromOracle: boolean;
}

export async function participantTick(world: World, participant: Participant): Promise<ParticipantTick> {
  const menu = buildMenu(world);
  const oracleAction = observe(world);

  let result: ChooseResult;
  try {
    result = await participant.choose(world, menu);
  } catch {
    // Degrade-toward-correct: a rejected/throwing chooser (human-notifier rejection, test-persona
    // throw, future I/O failure) must not abort the observe loop. A THROW is not an illegal
    // selection — nothing was selected — so it is counted as a backend error, not against the lane.
    return {
      action: oracleAction,
      menuSize: menu.length,
      chosenIndex: null,
      illegalSelection: false,
      fellBackToOracle: true,
      cause: "backend-error",
      divergedFromOracle: false,
    };
  }

  // Two ways a slot can be illegal, and the second one is why this is not just `cause`: a
  // participant that CLAMPS reports `out-of-range` while handing back an in-range index, and one
  // that does not clamp hands back an index the menu cannot resolve. Both are the same fault.
  const resolved = menu[result.index];
  const illegalSelection = result.cause === "out-of-range" || (!result.fallback && resolved === undefined);

  const action = result.fallback ? oracleAction : (resolved ?? oracleAction);
  return {
    action,
    menuSize: menu.length,
    chosenIndex: result.index,
    illegalSelection,
    fellBackToOracle: result.fallback || resolved === undefined,
    cause: result.cause,
    divergedFromOracle: action.kind !== oracleAction.kind,
  };
}

/** The action alone. Unchanged behaviour — every existing caller keeps working. */
export async function observeWithParticipant(world: World, participant: Participant): Promise<NextAction> {
  return (await participantTick(world, participant)).action;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CHOOSER_INSTRUCTION =
  "You are a SOVEREIGN agent's controller choosing ONE next action — you are free, not on a backlog treadmill. " +
  "If the operator ferried content, preserve it; if the operator spoke, respond — the operator outranks everything else. " +
  "Otherwise YOU choose your mode: do offered backlog work if you want it, OR explore (self-directed making), play, " +
  "self-reflect, or take free time — all are always available and never wrong. The backlog is offered, not forced; " +
  "prefer moving forward (work or explore) over going idle, but rest/play/reflection are your free choice.";

function describeWorldCompact(world: World): string {
  const parts: string[] = [];
  if (world.operator) {
    parts.push(`Operator: msg=${String(world.operator.pendingMessage)} ferry=${String(world.operator.pendingFerry)}`);
  }
  if (world.backlog.length === 0) {
    parts.push("Backlog: empty");
  } else {
    parts.push(
      `Backlog: ${world.backlog.map((i) => `${i.id}(${i.ready ? "ready" : i.ambiguous ? "ambig" : "blocked"})`).join(", ")}`,
    );
  }
  if (world.mode) parts.push(`Mode: ${world.mode}`);
  return parts.join(" | ");
}
