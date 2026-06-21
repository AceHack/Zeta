import { describe, expect, test } from "bun:test";

import {
  hasAgencySignatureV1,
  hasAgentCoauthorSignal,
  hasAgentCoauthorTrailer,
} from "./audit-agencysignature-main-tip";

describe("hasAgentCoauthorTrailer", () => {
  test.each([
    "Co-authored-by: Claude <noreply@anthropic.com>",
    "Co-Authored-By: Codex <noreply@openai.com>",
    "Co-authored-by: Grok <noreply@x.ai>",
    "Co-Authored-By: Gemini <noreply@google.com>",
    "Co-authored-by: Kiro <noreply@kiro.dev>",
    "Co-authored-by: Claude Opus 4.8 <noreply@anthropic.com>",
  ])("detects the agent trailer %s", (trailer) => {
    expect(hasAgentCoauthorTrailer(trailer)).toBe(true);
  });

  test("does not treat an ordinary human co-author as an agent signal", () => {
    expect(hasAgentCoauthorTrailer("Co-authored-by: Ada <ada@example.com>")).toBe(false);
  });
});

describe("hasAgencySignatureV1", () => {
  test("detects a signature block before a GitHub-appended co-author trailer", () => {
    const message = `feat(vision): add forecast scheduler wrapper (#8096)

Agency-Signature-Version: 1
Agent: Vera
Task: none

Co-authored-by: Codex <noreply@openai.com>
`;

    expect(hasAgencySignatureV1(message)).toBe(true);
  });

  test("detects the compact AgencySignature-v1 block used by current squash commits", () => {
    const message = `feat(core): name no-forget bounded gset policy (#8986)

Co-Authored-By: Codex <noreply@openai.com>

AgencySignature-v1:
  persona: vera
  actor: zeta-vera
`;

    expect(hasAgencySignatureV1(message)).toBe(true);
  });
});

describe("hasAgentCoauthorSignal", () => {
  test("falls back to the full commit message when parsed terminal trailers drop Co-Authored-By", () => {
    const parsedTrailers = `AgencySignature-v1: persona: vera actor: zeta-vera`;
    const message = `feat(core): name no-forget bounded gset policy (#8986)

Co-Authored-By: Codex <noreply@openai.com>

AgencySignature-v1:
  persona: vera
`;

    expect(hasAgentCoauthorSignal(parsedTrailers, message)).toBe(true);
  });
});
