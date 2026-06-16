#!/usr/bin/env bun
/**
 * src/Core.TypeScript/observe/simulate-tick.ts — DI-injectable tick simulation.
 *
 * The real `run-loop-real.ts` is wired to the live backlog + git sink + forge host.
 * This module exposes the same tick pipeline with EVERY dependency injectable:
 *
 *   - World (backlog items, operator state, mode) — inject synthetic scenarios
 *   - EventSink — inject a fake (no git I/O) or the real folder sink
 *   - CommandExecutor — inject a fake, a local-LLM-driven executor, or the real bash executor
 *   - ModelBackend — inject ollama (temperature 0, deterministic) or a mock
 *
 * This is for testing LOOP STABILITY, not code quality. The LLM at temperature 0
 * produces deterministic output; the test asserts the loop completes without crashing,
 * the observations land correctly, and the world transitions match the pure oracle.
 *
 * Usage:
 *   bun src/Core.TypeScript/observe/simulate-tick.ts                    # default scenario
 *   bun src/Core.TypeScript/observe/simulate-tick.ts --scenario empty   # empty backlog
 *   bun src/Core.TypeScript/observe/simulate-tick.ts --scenario work    # single ready item
 *   bun src/Core.TypeScript/observe/simulate-tick.ts --scenario mixed   # mixed backlog
 *   bun src/Core.TypeScript/observe/simulate-tick.ts --use-llm          # use local ollama
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/observe.ts (World / observe / simulate / fold)
 *   - src/Core.TypeScript/observe/execute.ts (execute / EventSink)
 *   - src/Core.TypeScript/observe/do-item.ts (CommandExecutor / fakeExecutor)
 *   - src/Core.TypeScript/accelerator/local-llm.ts (ollamaBackend / chooseIndex)
 */

import { observe, observeWithLlm, simulate, renderAction, type BacklogItem, type World, type NextAction } from "./observe";
import { execute, type EventSink, type AppendOutcome, type OperatorPort } from "./execute";
import { fakeExecutor, type DoItemOptions, type RunOutcome } from "./do-item";
import { ollamaBackend, type ModelBackend } from "../accelerator/local-llm";

// ─── Synthetic scenarios (DI-injectable worlds) ──────────────────────────────

function item(id: string, title: string, ready = true, ambiguous = false): BacklogItem {
  return { id, title, ready, ambiguous };
}

export const SCENARIOS: Record<string, World> = {
  empty: { backlog: [] },
  work: { backlog: [item("081KSIM000000001", "test-item: prove loop stability")] },
  ambiguous: { backlog: [item("081KSIM000000002", "big-item: needs decomposition", false, true)] },
  mixed: {
    backlog: [
      item("081KSIM000000003", "ready-item: do this"),
      item("081KSIM000000004", "ambiguous-item: decompose this", false, true),
    ],
  },
  operator: {
    backlog: [item("081KSIM000000005", "background-work")],
    operator: { pendingMessage: true, pendingFerry: false },
  },
  ferry: {
    backlog: [],
    operator: { pendingMessage: false, pendingFerry: true },
  },
  persisted_mode: {
    backlog: [item("081KSIM000000006", "work-available-but-mode-persisted")],
    mode: "explore",
  },
};

// ─── Fake EventSink (no git, in-memory log) ──────────────────────────────────

export interface FakeSinkState {
  readonly events: NextAction[];
  readonly ids: string[];
}

export function fakeSink(): EventSink & { state: FakeSinkState } {
  let counter = 0;
  const state: FakeSinkState = { events: [], ids: [] };
  return {
    state,
    append: async (event: NextAction): Promise<AppendOutcome> => {
      const eventId = `sim-${String(++counter).padStart(4, "0")}`;
      state.events.push(event);
      state.ids.push(eventId);
      return { ok: true, eventId };
    },
  };
}

// ─── Fake OperatorPort (no I/O) ──────────────────────────────────────────────

function fakeOperatorPort(): OperatorPort {
  return {
    preserveFerry: async () => ({ ok: true as const, path: "sim/ferry.md" }),
    emitResponse: async () => ({ ok: true as const }),
  };
}

// ─── Tick simulation ─────────────────────────────────────────────────────────

export interface TickResult {
  readonly scenario: string;
  readonly world: World;
  readonly action: NextAction;
  readonly oracleAction: NextAction;
  readonly oracleAgreement: boolean;
  readonly executeOk: boolean;
  readonly nextWorld: World;
  readonly eventCount: number;
  readonly usedLlm: boolean;
}

export interface TickOptions {
  /** Which scenario to run (key into SCENARIOS, or a custom World). */
  readonly world: World;
  readonly scenarioName: string;
  /** Use a local LLM (ollama, temperature 0) instead of pure oracle. */
  readonly useLlm?: boolean;
  /** Model backend override (for testing with mocks). */
  readonly backend?: ModelBackend;
  /** EventSink override (default: in-memory fake). */
  readonly sink?: EventSink;
  /** Whether to print output. */
  readonly verbose?: boolean;
}

/**
 * Run ONE tick of the observe loop with injected dependencies.
 * Returns the full result for assertion / logging.
 */
export async function simulateTick(opts: TickOptions): Promise<TickResult> {
  const world = opts.world;
  const sink = opts.sink ?? fakeSink();
  const sinkState = "state" in sink ? (sink as ReturnType<typeof fakeSink>).state : null;

  // Pick action — either via LLM (temperature 0, deterministic) or pure oracle
  const oracleAction = observe(world);
  let action: NextAction;
  let usedLlm = false;

  if (opts.useLlm) {
    const backend = opts.backend ?? ollamaBackend({ model: "qwen2.5:0.5b", seed: 42 });
    action = await observeWithLlm(world, backend);
    usedLlm = true;
  } else {
    action = oracleAction;
  }

  const oracleAgreement = action.kind === oracleAction.kind;

  if (opts.verbose) {
    console.log(`[sim:${opts.scenarioName}] oracle: ${renderAction(oracleAction)}`);
    if (usedLlm && !oracleAgreement) {
      console.log(`[sim:${opts.scenarioName}]    llm: ${renderAction(action)} (DISAGREE)`);
    }
  }

  // Execute — fake executor for do_item (always succeeds), fake operator port
  const fakeExec = fakeExecutor({ ok: true, stdout: "simulated work done", exitCode: 0 } as RunOutcome);
  const doItemOpts: DoItemOptions | undefined = action.kind === "do_item"
    ? { spec: { script: "echo simulated" }, gated: false }
    : undefined;

  const result = await execute(world, action, sink, fakeExec, doItemOpts, fakeOperatorPort());

  const executeOk = result.ok;
  const nextWorld = result.ok ? result.world : world;

  if (opts.verbose) {
    console.log(`[sim:${opts.scenarioName}] execute: ${executeOk ? "OK" : "FAILED"} → mode=${nextWorld.mode ?? "unset"}`);
  }

  return {
    scenario: opts.scenarioName,
    world,
    action,
    oracleAction,
    oracleAgreement,
    executeOk,
    nextWorld,
    eventCount: sinkState?.events.length ?? 0,
    usedLlm,
  };
}

/**
 * Run ALL scenarios in sequence. Returns results for each.
 * This is the loop-stability smoke test: every scenario must complete without crash.
 */
export async function simulateAllScenarios(opts?: { useLlm?: boolean; verbose?: boolean }): Promise<TickResult[]> {
  const results: TickResult[] = [];
  for (const [name, world] of Object.entries(SCENARIOS)) {
    const result = await simulateTick({
      world,
      scenarioName: name,
      useLlm: opts?.useLlm ?? false,
      verbose: opts?.verbose ?? true,
    });
    results.push(result);
  }
  return results;
}

// ─── CLI entrypoint ──────────────────────────────────────────────────────────

if (import.meta.main) {
  const useLlm = process.argv.includes("--use-llm");
  const scenarioArg = process.argv.find((_, i, a) => a[i - 1] === "--scenario");

  console.log(`simulate-tick: ${useLlm ? "LLM (temperature 0, deterministic)" : "pure oracle"}\n`);

  if (scenarioArg && SCENARIOS[scenarioArg]) {
    const result = await simulateTick({
      world: SCENARIOS[scenarioArg]!,
      scenarioName: scenarioArg,
      useLlm,
      verbose: true,
    });
    console.log(`\nResult: ${result.executeOk ? "✅ PASS" : "❌ FAIL"} — ${result.scenario}`);
    process.exit(result.executeOk ? 0 : 1);
  } else {
    const results = await simulateAllScenarios({ useLlm, verbose: true });
    const allPass = results.every(r => r.executeOk);
    const agreements = results.filter(r => r.oracleAgreement).length;

    console.log(`\n${"─".repeat(60)}`);
    console.log(`Results: ${results.length} scenarios, ${allPass ? "ALL PASS ✅" : "SOME FAILED ❌"}`);
    if (useLlm) {
      console.log(`Oracle agreement: ${agreements}/${results.length} (${Math.round(100 * agreements / results.length)}%)`);
    }
    process.exit(allPass ? 0 : 1);
  }
}
