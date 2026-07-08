import { describe, expect, it } from "bun:test";
import {
  assertHappyPathFirstSessionSerial,
  assertMockIdentityAuthFirstSessionSerial,
  assertSkipGhFirstSessionSerial,
  firstSessionMarkersSatisfied,
} from "./qemu-first-session-phase3";

describe("qemu-first-session-phase3", () => {
  it("firstSessionMarkersSatisfied passes for setup-gh local-only happy path", () => {
    const serial = [
      "zeta-first-session: begin",
      "zeta-first-session: choice kind=setup_credential vendor=gh",
      "zeta-first-session: choice kind=use_local_llm_only",
      "zeta-first-session: complete canSelfRegister=true",
    ].join("\n");

    expect(firstSessionMarkersSatisfied(serial)).toBe(true);
    expect("ok" in assertHappyPathFirstSessionSerial(serial)).toBe(true);
  });

  it("firstSessionMarkersSatisfied passes for mock identity-auth coverage path", () => {
    const serial = [
      "zeta-first-session: begin",
      "zeta-first-session: choice kind=setup_credential vendor=gh",
      "zeta-first-session: identity-auth-begin",
      "zeta-first-session: identity-auth-mock-begin",
      "zeta-first-session: identity-auth-mock-user-code ZETA-CI",
      "zeta-first-session: identity-auth-mock-ok",
      "zeta-first-session: setup-gh outcome=ready",
      "zeta-first-session: choice kind=use_local_llm_only",
      "zeta-first-session: complete canSelfRegister=true",
    ].join("\n");

    expect(firstSessionMarkersSatisfied(serial)).toBe(true);
    expect("ok" in assertMockIdentityAuthFirstSessionSerial(serial)).toBe(true);
  });

  it("firstSessionMarkersSatisfied passes for skip-gh continue-later path", () => {
    const serial = [
      "zeta-first-session: begin",
      "zeta-first-session: choice kind=skip_credential vendor=gh",
      "  Continue later: run gh auth login when ready.",
      "zeta-first-session: choice kind=use_local_llm_only",
      "zeta-first-session: complete canSelfRegister=false",
    ].join("\n");

    expect(firstSessionMarkersSatisfied(serial)).toBe(true);
    expect("ok" in assertSkipGhFirstSessionSerial(serial)).toBe(true);
  });

  it("firstSessionMarkersSatisfied fails when only begin present", () => {
    expect(firstSessionMarkersSatisfied("zeta-first-session: begin")).toBe(false);
  });

  it("firstSessionMarkersSatisfied rejects obsolete begin+complete-only transcript", () => {
    const serial = ["zeta-first-session: begin", "zeta-first-session: complete"].join("\n");

    expect(firstSessionMarkersSatisfied(serial)).toBe(false);
  });
});
