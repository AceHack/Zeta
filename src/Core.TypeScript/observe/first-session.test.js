import { describe, expect, it } from "bun:test";
import {
  buildFirstSessionMenu,
  canSelfRegister,
  defaultNodeSession,
  firstSessionLabel,
  firstSessionOracle,
  simulateFirstSession
} from "./first-session.js";
describe("first-session \u2014 credential setup oracle", () => {
  it("defaults to setup gh when all creds missing", () => {
    const action = firstSessionOracle(defaultNodeSession());
    expect(action).toEqual({
      kind: "setup_credential",
      vendor: "gh",
      reason: expect.stringContaining("cluster")
    });
  });
  it("recommends local after gh is ready (cloud stays hidden)", () => {
    expect(firstSessionOracle({
      credentials: { gh: "ready", claude: "missing", codex: "missing", gemini: "missing" },
      complete: !1,
      cloudHelpersOffered: !1
    }).kind).toBe("use_local_llm_only");
  });
  it("offers optional vendor setup only after cloud helpers are offered", () => {
    const session = {
      credentials: { gh: "ready", claude: "missing", codex: "missing", gemini: "missing" },
      complete: !1,
      cloudHelpersOffered: !0
    };
    expect(firstSessionOracle(session).kind).toBe("setup_credential");
    const lead = firstSessionOracle(session);
    if (lead.kind === "setup_credential")
      expect(lead.vendor).toBe("claude");
  });
  it("complete when gh resolved and all optional creds resolved", () => {
    expect(firstSessionOracle({
      credentials: { gh: "ready", claude: "skipped", codex: "skipped", gemini: "skipped" },
      complete: !1,
      cloudHelpersOffered: !0
    }).kind).toBe("complete_first_session");
  });
});
describe("first-session \u2014 setup menu", () => {
  it("includes skip gh with continue-later guidance while gh missing", () => {
    const menu = buildFirstSessionMenu(defaultNodeSession()), skipGh = menu.find((a) => a.kind === "skip_credential" && a.vendor === "gh");
    expect(skipGh).toBeDefined();
    expect(skipGh?.reason).toContain("local console");
    expect(skipGh?.reason).toContain("SSH");
    expect(menu[0]?.kind).toBe("setup_credential");
    if (menu[0]?.kind === "setup_credential")
      expect(menu[0].vendor).toBe("gh");
  });
  it("after gh ready: local default + offer-cloud; no per-vendor cloud rows yet", () => {
    const menu = buildFirstSessionMenu({
      credentials: { gh: "ready", claude: "missing", codex: "missing", gemini: "missing" },
      complete: !1,
      cloudHelpersOffered: !1
    });
    expect(menu.some((a) => a.kind === "use_local_llm_only")).toBe(!0);
    expect(menu.some((a) => a.kind === "offer_cloud_helpers")).toBe(!0);
    expect(menu.some((a) => a.kind === "setup_credential" && a.vendor === "claude")).toBe(!1);
    expect(menu.some((a) => a.kind === "skip_optional_credentials")).toBe(!1);
  });
  it("after offer_cloud_helpers: optional vendors appear", () => {
    const menu = buildFirstSessionMenu({
      credentials: { gh: "ready", claude: "missing", codex: "missing", gemini: "missing" },
      complete: !1,
      cloudHelpersOffered: !0
    });
    expect(menu.some((a) => a.kind === "setup_credential" && a.vendor === "claude")).toBe(!0);
    expect(menu.some((a) => a.kind === "skip_optional_credentials")).toBe(!0);
  });
  it("labels are plain-language for humans and LLM chooser", () => {
    const label = firstSessionLabel({
      kind: "setup_credential",
      vendor: "gh",
      reason: "join the cluster"
    });
    expect(label).toContain("GitHub");
    expect(label).toContain("cluster");
  });
});
describe("first-session \u2014 simulate state transitions", () => {
  it("setup_credential marks vendor ready", () => {
    const next = simulateFirstSession(defaultNodeSession(), {
      kind: "setup_credential",
      vendor: "gh",
      reason: "x"
    });
    expect(next.credentials.gh).toBe("ready");
    expect(canSelfRegister(next)).toBe(!0);
  });
  it("skip gh blocks self-register until later setup", () => {
    const next = simulateFirstSession(defaultNodeSession(), {
      kind: "skip_credential",
      vendor: "gh",
      reason: "x"
    });
    expect(next.credentials.gh).toBe("skipped");
    expect(canSelfRegister(next)).toBe(!1);
  });
  it("use_local_llm_only skips optional vendors and completes session", () => {
    let session = simulateFirstSession(defaultNodeSession(), {
      kind: "setup_credential",
      vendor: "gh",
      reason: "x"
    });
    session = simulateFirstSession(session, {
      kind: "use_local_llm_only",
      reason: "x"
    });
    expect(session.complete).toBe(!0);
    expect(session.credentials.claude).toBe("skipped");
    expect(session.credentials.codex).toBe("skipped");
    expect(session.credentials.gemini).toBe("skipped");
    expect(canSelfRegister(session)).toBe(!0);
  });
  it("recommended path: gh setup then local-only completes", () => {
    const final = [
      { kind: "setup_credential", vendor: "gh", reason: "x" },
      { kind: "use_local_llm_only", reason: "x" }
    ].reduce(simulateFirstSession, defaultNodeSession());
    expect(final.complete).toBe(!0);
    expect(canSelfRegister(final)).toBe(!0);
    expect(final.credentials.claude).toBe("skipped");
    expect(final.cloudHelpersOffered).toBe(!1);
  });
  it("offer_cloud_helpers unlocks optional vendors without completing", () => {
    let session = simulateFirstSession(defaultNodeSession(), {
      kind: "setup_credential",
      vendor: "gh",
      reason: "x"
    });
    session = simulateFirstSession(session, {
      kind: "offer_cloud_helpers",
      reason: "x"
    });
    expect(session.cloudHelpersOffered).toBe(!0);
    expect(session.complete).toBe(!1);
    expect(buildFirstSessionMenu(session).some((a) => a.kind === "setup_credential" && a.vendor === "claude")).toBe(!0);
  });
});
