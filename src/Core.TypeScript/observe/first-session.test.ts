import { describe, expect, it } from "bun:test";
import {
  buildFirstSessionMenu,
  canSelfRegister,
  defaultNodeSession,
  firstSessionLabel,
  firstSessionOracle,
  simulateFirstSession,
  type FirstSessionAction,
  type NodeSessionState,
} from "./first-session";

describe("first-session — credential adventure oracle", () => {
  it("defaults to setup gh when all creds missing", () => {
    const action = firstSessionOracle(defaultNodeSession());
    expect(action).toEqual({
      kind: "setup_credential",
      vendor: "gh",
      reason: expect.stringContaining("self-register"),
    });
  });

  it("offers optional vendor setup after gh is ready", () => {
    const session: NodeSessionState = {
      credentials: { gh: "ready", claude: "missing", codex: "missing", gemini: "missing" },
      complete: false,
    };
    expect(firstSessionOracle(session).kind).toBe("setup_credential");
    const lead = firstSessionOracle(session);
    if (lead.kind === "setup_credential") {
      expect(lead.vendor).toBe("claude");
    }
  });

  it("complete when gh resolved and all optional creds resolved", () => {
    const session: NodeSessionState = {
      credentials: { gh: "ready", claude: "skipped", codex: "skipped", gemini: "skipped" },
      complete: false,
    };
    expect(firstSessionOracle(session).kind).toBe("complete_first_session");
  });
});

describe("first-session — adventure menu", () => {
  it("includes skip gh with register warning while gh missing", () => {
    const menu = buildFirstSessionMenu(defaultNodeSession());
    const kinds = menu.map((a) => (a.kind === "skip_credential" && a.vendor === "gh" ? "skip-gh" : a.kind));
    expect(kinds).toContain("skip-gh");
    expect(menu[0]?.kind).toBe("setup_credential");
    if (menu[0]?.kind === "setup_credential") {
      expect(menu[0].vendor).toBe("gh");
    }
  });

  it("offers local-llm-only path when optional creds remain", () => {
    const session: NodeSessionState = {
      credentials: { gh: "ready", claude: "missing", codex: "missing", gemini: "missing" },
      complete: false,
    };
    const menu = buildFirstSessionMenu(session);
    expect(menu.some((a) => a.kind === "use_local_llm_only")).toBe(true);
    expect(menu.some((a) => a.kind === "skip_optional_credentials")).toBe(true);
  });

  it("labels are human-readable for LLM chooser", () => {
    const label = firstSessionLabel({
      kind: "setup_credential",
      vendor: "gh",
      reason: "register",
    });
    expect(label).toContain("gh");
    expect(label).toContain("register");
  });
});

describe("first-session — simulate state transitions", () => {
  it("setup_credential marks vendor ready", () => {
    const next = simulateFirstSession(defaultNodeSession(), {
      kind: "setup_credential",
      vendor: "gh",
      reason: "x",
    });
    expect(next.credentials.gh).toBe("ready");
    expect(canSelfRegister(next)).toBe(true);
  });

  it("skip gh blocks self-register until later setup", () => {
    const next = simulateFirstSession(defaultNodeSession(), {
      kind: "skip_credential",
      vendor: "gh",
      reason: "x",
    });
    expect(next.credentials.gh).toBe("skipped");
    expect(canSelfRegister(next)).toBe(false);
  });

  it("use_local_llm_only skips optional vendors and completes session", () => {
    let session = simulateFirstSession(defaultNodeSession(), {
      kind: "setup_credential",
      vendor: "gh",
      reason: "x",
    });
    session = simulateFirstSession(session, {
      kind: "use_local_llm_only",
      reason: "x",
    });
    expect(session.complete).toBe(true);
    expect(session.credentials.claude).toBe("skipped");
    expect(session.credentials.codex).toBe("skipped");
    expect(session.credentials.gemini).toBe("skipped");
    expect(canSelfRegister(session)).toBe(true);
  });

  it("adventure path: gh setup then skip optional then complete", () => {
    const steps: FirstSessionAction[] = [
      { kind: "setup_credential", vendor: "gh", reason: "x" },
      { kind: "skip_optional_credentials", reason: "x" },
      { kind: "complete_first_session", reason: "x" },
    ];
    const final = steps.reduce(simulateFirstSession, defaultNodeSession());
    expect(final.complete).toBe(true);
    expect(canSelfRegister(final)).toBe(true);
    expect(final.credentials.claude).toBe("skipped");
  });
});
