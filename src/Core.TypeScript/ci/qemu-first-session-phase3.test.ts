import { describe, expect, it } from "bun:test";
import {
  assertHappyPathFirstSessionSerial,
  assertMockIdentityAuthFirstSessionSerial,
  assertSkipGhFirstSessionSerial,
  firstSessionMarkersSatisfied,
  phase3BootMarkersSatisfied,
} from "./qemu-first-session-phase3";

describe("qemu-first-session-phase3", () => {
  it("firstSessionMarkersSatisfied rejects dry-run-only happy path by default", () => {
    const prev = process.env.ZETA_FIRST_SESSION_ALLOW_DRY_RUN_AUTH;
    delete process.env.ZETA_FIRST_SESSION_ALLOW_DRY_RUN_AUTH;
    try {
      const serial = [
        "zeta-first-session: begin",
        "zeta-first-session: choice kind=setup_credential vendor=gh",
        "zeta-first-session: choice kind=use_local_llm_only",
        "zeta-first-session: complete canSelfRegister=true",
      ].join("\n");

      expect(firstSessionMarkersSatisfied(serial)).toBe(false);
      expect("ok" in assertHappyPathFirstSessionSerial(serial)).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.ZETA_FIRST_SESSION_ALLOW_DRY_RUN_AUTH;
      else process.env.ZETA_FIRST_SESSION_ALLOW_DRY_RUN_AUTH = prev;
    }
  });

  it("firstSessionMarkersSatisfied allows dry-run happy path with escape hatch", () => {
    const prev = process.env.ZETA_FIRST_SESSION_ALLOW_DRY_RUN_AUTH;
    process.env.ZETA_FIRST_SESSION_ALLOW_DRY_RUN_AUTH = "1";
    try {
      const serial = [
        "zeta-first-session: begin",
        "zeta-first-session: choice kind=setup_credential vendor=gh",
        "zeta-first-session: choice kind=use_local_llm_only",
        "zeta-first-session: complete canSelfRegister=true",
      ].join("\n");
      expect(firstSessionMarkersSatisfied(serial)).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.ZETA_FIRST_SESSION_ALLOW_DRY_RUN_AUTH;
      else process.env.ZETA_FIRST_SESSION_ALLOW_DRY_RUN_AUTH = prev;
    }
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

  it("phase3BootMarkersSatisfied requires post-boot self-register when phase3 on", () => {
    const prevPhase3 = process.env.QEMU_FIRST_SESSION_PHASE3;
    const prevMissing = process.env.QEMU_SELF_REGISTER_ALLOW_MISSING;
    process.env.QEMU_FIRST_SESSION_PHASE3 = "1";
    delete process.env.QEMU_SELF_REGISTER_ALLOW_MISSING;
    try {
      const firstSessionOnly = [
        "zeta-first-session: begin",
        "zeta-first-session: choice kind=setup_credential vendor=gh",
        "zeta-first-session: identity-auth-mock-begin",
        "zeta-first-session: identity-auth-mock-ok",
        "zeta-first-session: choice kind=use_local_llm_only",
        "zeta-first-session: complete canSelfRegister=true",
      ].join("\n");
      expect(firstSessionMarkersSatisfied(firstSessionOnly)).toBe(true);
      expect(phase3BootMarkersSatisfied(firstSessionOnly)).toBe(false);

      const withSelfReg = [
        firstSessionOnly,
        "zeta-self-register: begin",
        "zeta-self-register: ci-dry-run",
        "zeta-self-register: composed maintainer=qemu-ci node=node-dead01",
        "zeta-self-register: tree-path=maintainers/qemu-ci/cluster-nodes/node-dead01/node.yaml",
        "zeta-self-register: complete",
      ].join("\n");
      expect(phase3BootMarkersSatisfied(withSelfReg)).toBe(true);
    } finally {
      if (prevPhase3 === undefined) delete process.env.QEMU_FIRST_SESSION_PHASE3;
      else process.env.QEMU_FIRST_SESSION_PHASE3 = prevPhase3;
      if (prevMissing === undefined) delete process.env.QEMU_SELF_REGISTER_ALLOW_MISSING;
      else process.env.QEMU_SELF_REGISTER_ALLOW_MISSING = prevMissing;
    }
  });
});
