/**
 * first-session-llm.test.ts — local LLM chooser over first-session DU.
 *
 * Reuses the observe/workflow test harness:
 *   - mock ModelBackend + backendChoosing (closed-loop.test.ts pattern)
 *   - chooseIndex fallback → oracle lead (observe.test.ts pattern)
 *   - fold reconstructs state from event log (closed-loop invariant)
 */

import { describe, expect, it } from "bun:test";
import type { ModelBackend } from "../accelerator/local-llm";
import {
  buildFirstSessionMenu,
  defaultNodeSession,
  firstSessionOracle,
  firstSessionWithLlm,
  firstSessionActionsEqual,
  foldFirstSession,
  runFirstSessionLoop,
  simulateFirstSession,
  type FirstSessionAction,
  type NodeSessionState,
} from "./first-session";
import type { TickBudget } from "./tick-budget";

const mock = (reply: string): ModelBackend => ({ name: "mock", complete: () => Promise.resolve(reply) });

const downBackend: ModelBackend = {
  name: "down",
  complete: () => Promise.reject(new Error("ollama down")),
};

function backendChoosing(session: NodeSessionState, target: FirstSessionAction): ModelBackend {
  const menu = buildFirstSessionMenu(session);
  const idx = menu.findIndex((a) => firstSessionActionsEqual(a, target));
  if (idx < 0) throw new Error(`menu has no ${JSON.stringify(target)} for this session`);
  return mock(String(idx));
}

describe("firstSessionWithLlm — mock backend chooser (CI shield)", () => {
  it("picks setup gh when mock returns oracle index", async () => {
    const session = defaultNodeSession();
    const oracle = firstSessionOracle(session);
    const chosen = await firstSessionWithLlm(session, backendChoosing(session, oracle));
    expect(firstSessionActionsEqual(chosen, oracle)).toBe(true);
    expect(chosen.kind).toBe("setup_credential");
    if (chosen.kind === "setup_credential") expect(chosen.vendor).toBe("gh");
  });

  it("agent can skip gh (free choice over oracle default)", async () => {
    const session = defaultNodeSession();
    const skipGh: FirstSessionAction = {
      kind: "skip_credential",
      vendor: "gh",
      reason: "x",
    };
    const chosen = await firstSessionWithLlm(session, backendChoosing(session, skipGh));
    expect(firstSessionActionsEqual(chosen, skipGh)).toBe(true);
  });

  it("agent can choose local-llm-only after gh ready", async () => {
    const session: NodeSessionState = {
      credentials: { gh: "ready", claude: "missing", codex: "missing", gemini: "missing" },
      complete: false,
      cloudHelpersOffered: false,
    };
    const localOnly: FirstSessionAction = {
      kind: "use_local_llm_only",
      reason: "x",
    };
    const chosen = await firstSessionWithLlm(session, backendChoosing(session, localOnly));
    expect(chosen.kind).toBe("use_local_llm_only");
  });

  it("falls back to oracle when backend is down", async () => {
    const session = defaultNodeSession();
    const chosen = await firstSessionWithLlm(session, downBackend);
    expect(firstSessionActionsEqual(chosen, firstSessionOracle(session))).toBe(true);
  });

  it("falls back to oracle on unparseable reply", async () => {
    const session = defaultNodeSession();
    const chosen = await firstSessionWithLlm(session, mock("banana"));
    expect(firstSessionActionsEqual(chosen, firstSessionOracle(session))).toBe(true);
  });
});

describe("first-session closed-loop — fold reconstructs setup trace", () => {
  it("one tick: simulate matches fold of appended action", async () => {
    const initial = defaultNodeSession();
    const pick = await firstSessionWithLlm(
      initial,
      backendChoosing(initial, { kind: "setup_credential", vendor: "gh", reason: "x" }),
    );
    const next = simulateFirstSession(initial, pick);
    expect(foldFirstSession(initial, [pick])).toEqual(next);
    expect(next.credentials.gh).toBe("ready");
  });

  it("multi-tick recommended path CLOSES: fold(trace) === live final session", async () => {
    let session = defaultNodeSession();
    const initial = session;
    const trace: FirstSessionAction[] = [];

    const steps: FirstSessionAction[] = [
      { kind: "setup_credential", vendor: "gh", reason: "x" },
      { kind: "use_local_llm_only", reason: "x" },
    ];

    for (const step of steps) {
      const pick = await firstSessionWithLlm(session, backendChoosing(session, step));
      expect(firstSessionActionsEqual(pick, step)).toBe(true);
      trace.push(pick);
      session = simulateFirstSession(session, pick);
    }

    expect(session.complete).toBe(true);
    expect(foldFirstSession(initial, trace)).toEqual(session);
  });

  it("runFirstSessionLoop advances via oracle-index mock (one tick)", async () => {
    const oneTick: TickBudget = {
      name: "one-tick-probe",
      maxTicks: 1,
      chosenBy: "this test",
      rationale: "isolates a single choose→simulate step; not a production bound",
    };
    const { trace, finalSession } = await runFirstSessionLoop(
      defaultNodeSession(),
      mock("0"),
      oneTick,
    );
    expect(trace).toHaveLength(1);
    expect(trace[0]?.kind).toBe("setup_credential");
    expect(finalSession.credentials.gh).toBe("ready");
  });
});
