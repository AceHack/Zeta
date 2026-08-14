import { describe, expect, test } from "bun:test";

import {
  hasMisspelledVersionKey,
  isGrandfatheredPr,
  isUnfilledPlaceholder,
} from "./validate-agencysignature-pr-body";

const CUTOVER = "2026-08-15T00:00:00Z";

// `Agency-Signature-Version` is canonical (this validator's REQUIRED_KEYS, the
// spec doc, the post-merge auditor, the four cadence workflows that echo it).
// `Agent-Signature-Version` reached main three times on 2026-08-13/14 as a
// hand-composition slip, and the auditor exempted those commits — unsigned AND
// exempt at once. The pre-merge side names the slip explicitly now.
describe("Agent-/Agency- version key", () => {
  test("the misspelling is recognised", () => {
    expect(hasMisspelledVersionKey("Agent-Signature-Version: 1\n")).toBe(true);
    expect(hasMisspelledVersionKey("agent-signature-version: 2\n")).toBe(true);
  });

  test("the canonical key is not flagged", () => {
    expect(hasMisspelledVersionKey("Agency-Signature-Version: 1\n")).toBe(false);
  });

  test("other Agent-* trailers in the canonical v1 block are not flagged", () => {
    // `Agent:` and `Agent-Runtime:` are REQUIRED keys — only the VERSION key
    // has a wrong-spelling twin, so the detector must not swallow the block.
    expect(hasMisspelledVersionKey("Agent: otto\nAgent-Runtime: claude-code\n")).toBe(false);
    expect(hasMisspelledVersionKey("Agent-Model: claude-opus-5\n")).toBe(false);
  });
});

// The PR template now ships the trailer block pre-populated (that is the only
// way the block survives GitHub's squash-merge, which uses the BODY as the
// commit message). The new easy failure is therefore shipping the SKELETON —
// and MEASURED before the guard existed, the template validated CLEANLY with
// `Agent: <persona>` in it. A check that accepts attribution-to-nobody is the
// same silent-green shape as the audit that exempted the whole fleet (#10564).
describe("unfilled template placeholders", () => {
  test.each([
    "<persona>",
    "<model id>",
    "<harness, e.g. claude-code | codex-cli>",
    "  <account the credential belongs to>  ",
  ])("MUTATION: %s is rejected as unfilled", (value) => {
    expect(isUnfilledPlaceholder(value)).toBe(true);
  });

  test.each([
    "the shadow",
    "claude-opus-5",
    "claude-code",
    "acehack00@gmail.com",
    "none",
    "1",
  ])("a real value (%s) is accepted", (value) => {
    expect(isUnfilledPlaceholder(value)).toBe(false);
  });

  test("a value that merely CONTAINS angle brackets is not a placeholder", () => {
    // `Credential-Identity` is plausibly written as a git-style ident. Only a
    // value that is ENTIRELY `<...>` is the template skeleton.
    expect(isUnfilledPlaceholder("Aaron Stainback <aaron_bond@yahoo.com>")).toBe(false);
  });
});

// The grandfather window is what lets a blocking pre-merge check turn on
// without red-X'ing the in-flight fleet (measured 2026-08-14: 0 of 12 open PRs
// carried a valid block). It lives here, and not in the CI yaml, precisely so
// it has falsifiers.
describe("grandfather window", () => {
  test("a PR opened before the cutover is exempt", () => {
    expect(isGrandfatheredPr("2026-08-14T23:59:59Z", CUTOVER)).toBe(true);
    expect(isGrandfatheredPr("2026-06-01T00:00:00Z", CUTOVER)).toBe(true);
  });

  test("MUTATION: a PR opened AT or AFTER the cutover is NOT exempt", () => {
    // If this ever returns true the check becomes one that cannot fail.
    expect(isGrandfatheredPr("2026-08-15T00:00:00Z", CUTOVER)).toBe(false);
    expect(isGrandfatheredPr("2026-08-15T00:00:01Z", CUTOVER)).toBe(false);
    expect(isGrandfatheredPr("2027-01-01T00:00:00Z", CUTOVER)).toBe(false);
  });

  test("MUTATION: an unparseable timestamp does NOT buy an exemption", () => {
    // Fail-closed on bad input, or a malformed/absent `created_at` silently
    // exempts every PR — the same shape as the audit that assumed
    // human-authorship whenever it did not recognise a trailer.
    expect(isGrandfatheredPr("", CUTOVER)).toBe(false);
    expect(isGrandfatheredPr("not-a-date", CUTOVER)).toBe(false);
    expect(isGrandfatheredPr("2026-08-01T00:00:00Z", "not-a-date")).toBe(false);
  });

  test("timezone offsets compare correctly, not lexically", () => {
    // 2026-08-14T21:00:00-04:00 is 2026-08-15T01:00Z — AFTER the cutover,
    // though it reads as the 14th. A string comparison would get this wrong.
    expect(isGrandfatheredPr("2026-08-14T21:00:00-04:00", CUTOVER)).toBe(false);
    expect(isGrandfatheredPr("2026-08-14T19:00:00-04:00", CUTOVER)).toBe(true);
  });
});
