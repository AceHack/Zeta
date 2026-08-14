import { describe, expect, test } from "bun:test";

import { hasMisspelledVersionKey } from "./validate-agencysignature-pr-body";

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
