import { describe, expect, test } from "bun:test";
import {
  assertHappyPathFirstSessionSerial,
  assertMockIdentityAuthFirstSessionSerial,
  assertSkipGhFirstSessionSerial,
  serialFirstBootInProgress
} from "./serial-markers";
describe("serialFirstBootInProgress", () => {
  test("idle serial-getty shell alone is not first-boot progress", () => {
    expect(serialFirstBootInProgress("nixos@zeta-installer:~$")).toBe(!1);
  });
  test("mirrored first-boot banner suppresses getty-race false positive", () => {
    expect(serialFirstBootInProgress(`nixos@zeta-installer:~$
  Zeta cluster installer
Role selected: control-plane`)).toBe(!0);
  });
});
describe("first-session path serial markers", () => {
  test("happy path requires local-only completion with self-register enabled", () => {
    const serial = [
      "zeta-first-session: begin",
      "zeta-first-session: choice kind=setup_credential vendor=gh",
      "zeta-first-session: dry-run setup gh",
      "zeta-first-session: choice kind=use_local_llm_only",
      "zeta-first-session: dry-run use_local_llm_only",
      "zeta-first-session: complete canSelfRegister=true"
    ].join(`
`), result = assertHappyPathFirstSessionSerial(serial);
    expect("ok" in result).toBe(!0);
  });
  test("mock identity-auth path requires mock markers plus happy-path completion", () => {
    const serial = [
      "zeta-first-session: begin",
      "zeta-first-session: choice kind=setup_credential vendor=gh",
      "zeta-first-session: identity-auth-mock-begin",
      "zeta-first-session: identity-auth-mock-ok",
      "zeta-first-session: choice kind=use_local_llm_only",
      "zeta-first-session: complete canSelfRegister=true"
    ].join(`
`);
    expect("ok" in assertMockIdentityAuthFirstSessionSerial(serial)).toBe(!0);
    expect("error" in assertMockIdentityAuthFirstSessionSerial([
      "zeta-first-session: begin",
      "zeta-first-session: choice kind=setup_credential vendor=gh",
      "zeta-first-session: dry-run setup gh",
      "zeta-first-session: choice kind=use_local_llm_only",
      "zeta-first-session: complete canSelfRegister=true"
    ].join(`
`))).toBe(!0);
  });
  test("skip-gh path accepts the continue-later guidance as path evidence", () => {
    const serial = [
      "zeta-first-session: begin",
      "zeta-first-session: choice kind=skip_credential vendor=gh",
      "  Continue later: run gh auth login when ready.",
      "  Tip: on this machine run the first-login helper again, or SSH in and set up GitHub there.",
      "zeta-first-session: choice kind=use_local_llm_only",
      "zeta-first-session: complete canSelfRegister=false"
    ].join(`
`), result = assertSkipGhFirstSessionSerial(serial);
    expect("ok" in result).toBe(!0);
  });
  test("obsolete begin+complete-only transcript is not path proof", () => {
    const serial = ["zeta-first-session: begin", "zeta-first-session: complete"].join(`
`);
    expect("error" in assertHappyPathFirstSessionSerial(serial)).toBe(!0);
    expect("error" in assertSkipGhFirstSessionSerial(serial)).toBe(!0);
  });
});
