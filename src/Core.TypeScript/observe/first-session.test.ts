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

describe("first-session — credential setup oracle", () => {
  it("defaults to setup gh when all creds missing", () => {
    const action = firstSessionOracle(defaultNodeSession());
    expect(action).toEqual({
      kind: "setup_credential",
      vendor: "gh",
      reason: expect.stringContaining("cluster"),
    });
  });

  it("recommends local after gh is ready (cloud stays hidden)", () => {
    const session: NodeSessionState = {
      credentials: { gh: "ready", claude: "missing", codex: "missing", gemini: "missing" },
      complete: false,
      cloudHelpersOffered: false,
    };
    expect(firstSessionOracle(session).kind).toBe("use_local_llm_only");
  });

  it("offers optional vendor setup only after cloud helpers are offered", () => {
    const session: NodeSessionState = {
      credentials: { gh: "ready", claude: "missing", codex: "missing", gemini: "missing" },
      complete: false,
      cloudHelpersOffered: true,
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
      cloudHelpersOffered: true,
    };
    expect(firstSessionOracle(session).kind).toBe("complete_first_session");
  });
});

describe("first-session — setup menu", () => {
  it("includes skip gh with register warning while gh missing", () => {
    const menu = buildFirstSessionMenu(defaultNodeSession());
    const kinds = menu.map((a) => (a.kind === "skip_credential" && a.vendor === "gh" ? "skip-gh" : a.kind));
    expect(kinds).toContain("skip-gh");
    expect(menu[0]?.kind).toBe("setup_credential");
    if (menu[0]?.kind === "setup_credential") {
      expect(menu[0].vendor).toBe("gh");
    }
  });

  it("after gh ready: local default + offer-cloud; no per-vendor cloud rows yet", () => {
    const session: NodeSessionState = {
      credentials: { gh: "ready", claude: "missing", codex: "missing", gemini: "missing" },
      complete: false,
      cloudHelpersOffered: false,
    };
    const menu = buildFirstSessionMenu(session);
    expect(menu.some((a) => a.kind === "use_local_llm_only")).toBe(true);
    expect(menu.some((a) => a.kind === "offer_cloud_helpers")).toBe(true);
    expect(menu.some((a) => a.kind === "setup_credential" && a.vendor === "claude")).toBe(false);
    expect(menu.some((a) => a.kind === "skip_optional_credentials")).toBe(false);
  });

  it("after offer_cloud_helpers: optional vendors appear", () => {
    const session: NodeSessionState = {
      credentials: { gh: "ready", claude: "missing", codex: "missing", gemini: "missing" },
      complete: false,
      cloudHelpersOffered: true,
    };
    const menu = buildFirstSessionMenu(session);
    expect(menu.some((a) => a.kind === "setup_credential" && a.vendor === "claude")).toBe(true);
    expect(menu.some((a) => a.kind === "skip_optional_credentials")).toBe(true);
  });

  it("labels are plain-language for humans and LLM chooser", () => {
    const label = firstSessionLabel({
      kind: "setup_credential",
      vendor: "gh",
      reason: "join the cluster",
    });
    expect(label).toContain("GitHub");
    expect(label).toContain("cluster");
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

  it("recommended path: gh setup then local-only completes", () => {
    const steps: FirstSessionAction[] = [
      { kind: "setup_credential", vendor: "gh", reason: "x" },
      { kind: "use_local_llm_only", reason: "x" },
    ];
    const final = steps.reduce(simulateFirstSession, defaultNodeSession());
    expect(final.complete).toBe(true);
    expect(canSelfRegister(final)).toBe(true);
    expect(final.credentials.claude).toBe("skipped");
    expect(final.cloudHelpersOffered).toBe(false);
  });

  it("offer_cloud_helpers unlocks optional vendors without completing", () => {
    let session = simulateFirstSession(defaultNodeSession(), {
      kind: "setup_credential",
      vendor: "gh",
      reason: "x",
    });
    session = simulateFirstSession(session, {
      kind: "offer_cloud_helpers",
      reason: "x",
    });
    expect(session.cloudHelpersOffered).toBe(true);
    expect(session.complete).toBe(false);
    expect(buildFirstSessionMenu(session).some((a) => a.kind === "setup_credential" && a.vendor === "claude")).toBe(
      true,
    );
  });
});
