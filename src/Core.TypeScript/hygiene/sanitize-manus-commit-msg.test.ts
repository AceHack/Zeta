import { describe, expect, test } from "bun:test";
import {
  hasManusWrapperSignature,
  sanitizeManusCommitMsg,
  sanitizeManusCommitMsgStrict,
} from "./sanitize-manus-commit-msg.ts";

const LEAK =
  `__manus_ec=$?; trap '' PIPE; printf "%d:%s\\n" $__manus_ec "$PWD" 2>/dev/null >&3; trap - PIPE` +
  "feat: AntiSybil.fs — hard-money entropy budget\n";

describe("sanitize-manus-commit-msg", () => {
  test("strips the observed 44763cdc1 wrapper glued to the subject", () => {
    const got = sanitizeManusCommitMsg(LEAK);
    expect(got.startsWith("feat:")).toBe(true);
    expect(hasManusWrapperSignature(got)).toBe(false);
  });

  test("strict accepts a clean message", () => {
    const r = sanitizeManusCommitMsgStrict("feat: hello\n\nbody\n");
    expect(r.refused).toBe(false);
    expect(r.changed).toBe(false);
  });

  test("strict refuses residual signatures on the subject", () => {
    const r = sanitizeManusCommitMsgStrict("__manus_ec=oops feat: x\n");
    expect(r.refused).toBe(true);
  });

  test("strict allows documenting the tokens in the body", () => {
    const r = sanitizeManusCommitMsgStrict(
      "feat: install commit-msg hook\n\nStrips __manus_ec and trap '' PIPE from subjects.\n",
    );
    expect(r.refused).toBe(false);
  });

  test("strict refuses wrapper-only messages", () => {
    const only =
      `__manus_ec=$?; trap '' PIPE; printf "%d:%s\\n" $__manus_ec "$PWD" 2>/dev/null >&3; trap - PIPE`;
    const r = sanitizeManusCommitMsgStrict(only);
    expect(r.refused).toBe(true);
  });
});
