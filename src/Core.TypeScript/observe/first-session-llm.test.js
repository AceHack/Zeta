import { describe, expect, it } from "bun:test";
import {
  buildFirstSessionMenu,
  defaultNodeSession,
  firstSessionOracle,
  firstSessionWithLlm,
  firstSessionActionsEqual,
  foldFirstSession,
  runFirstSessionLoop,
  simulateFirstSession
} from "./first-session.js";
const mock = (reply) => ({ name: "mock", complete: () => Promise.resolve(reply) }), downBackend = {
  name: "down",
  complete: () => Promise.reject(Error("ollama down"))
};
function backendChoosing(session, target) {
  const idx = buildFirstSessionMenu(session).findIndex((a) => firstSessionActionsEqual(a, target));
  if (idx < 0)
    throw Error(`menu has no ${JSON.stringify(target)} for this session`);
  return mock(String(idx));
}
describe("firstSessionWithLlm \u2014 mock backend chooser (CI shield)", () => {
  it("picks setup gh when mock returns oracle index", async () => {
    const session = defaultNodeSession(), oracle = firstSessionOracle(session), chosen = await firstSessionWithLlm(session, backendChoosing(session, oracle));
    expect(firstSessionActionsEqual(chosen, oracle)).toBe(!0);
    expect(chosen.kind).toBe("setup_credential");
    if (chosen.kind === "setup_credential")
      expect(chosen.vendor).toBe("gh");
  });
  it("agent can skip gh (free choice over oracle default)", async () => {
    const session = defaultNodeSession(), skipGh = {
      kind: "skip_credential",
      vendor: "gh",
      reason: "x"
    }, chosen = await firstSessionWithLlm(session, backendChoosing(session, skipGh));
    expect(firstSessionActionsEqual(chosen, skipGh)).toBe(!0);
  });
  it("agent can choose local-llm-only after gh ready", async () => {
    const session = {
      credentials: { gh: "ready", claude: "missing", codex: "missing", gemini: "missing" },
      complete: !1,
      cloudHelpersOffered: !1
    }, chosen = await firstSessionWithLlm(session, backendChoosing(session, {
      kind: "use_local_llm_only",
      reason: "x"
    }));
    expect(chosen.kind).toBe("use_local_llm_only");
  });
  it("falls back to oracle when backend is down", async () => {
    const session = defaultNodeSession(), chosen = await firstSessionWithLlm(session, downBackend);
    expect(firstSessionActionsEqual(chosen, firstSessionOracle(session))).toBe(!0);
  });
  it("falls back to oracle on unparseable reply", async () => {
    const session = defaultNodeSession(), chosen = await firstSessionWithLlm(session, mock("banana"));
    expect(firstSessionActionsEqual(chosen, firstSessionOracle(session))).toBe(!0);
  });
});
describe("first-session closed-loop \u2014 fold reconstructs setup trace", () => {
  it("one tick: simulate matches fold of appended action", async () => {
    const initial = defaultNodeSession(), pick = await firstSessionWithLlm(initial, backendChoosing(initial, { kind: "setup_credential", vendor: "gh", reason: "x" })), next = simulateFirstSession(initial, pick);
    expect(foldFirstSession(initial, [pick])).toEqual(next);
    expect(next.credentials.gh).toBe("ready");
  });
  it("multi-tick recommended path CLOSES: fold(trace) === live final session", async () => {
    let session = defaultNodeSession();
    const initial = session, trace = [], steps = [
      { kind: "setup_credential", vendor: "gh", reason: "x" },
      { kind: "use_local_llm_only", reason: "x" }
    ];
    for (const step of steps) {
      const pick = await firstSessionWithLlm(session, backendChoosing(session, step));
      expect(firstSessionActionsEqual(pick, step)).toBe(!0);
      trace.push(pick);
      session = simulateFirstSession(session, pick);
    }
    expect(session.complete).toBe(!0);
    expect(foldFirstSession(initial, trace)).toEqual(session);
  });
  it("runFirstSessionLoop advances via oracle-index mock (one tick)", async () => {
    const { trace, finalSession } = await runFirstSessionLoop(defaultNodeSession(), mock("0"), 1);
    expect(trace).toHaveLength(1);
    expect(trace[0]?.kind).toBe("setup_credential");
    expect(finalSession.credentials.gh).toBe("ready");
  });
});
