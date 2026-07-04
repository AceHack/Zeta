import { describe, expect, test } from "bun:test";
import {
  hasAgencySignature,
  hasAgencySignatureV1,
  hasAgencySignatureV2,
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
describe("hasAgencySignatureV2 (ADR phase 4 — Cell trailer)", () => {
  const v2Message = `feat(identity): wire cell trailer (#9999)

Agency-Signature-Version: 2
Agent: otto
Persona: otto
Cell: cowork/main@machine-a
Task: none
`;
  test("detects a v2 block", () => {
    expect(hasAgencySignatureV2(v2Message)).toBe(true);
    expect(hasAgencySignature(v2Message)).toBe(true);
  });
  test("v2 block is NOT v1 (version share must be observable for the phase-8 contract)", () => {
    expect(hasAgencySignatureV1(v2Message)).toBe(false);
  });
  test("v1 block is not v2", () => {
    const v1 = "Agency-Signature-Version: 1\nAgent: Vera\n";
    expect(hasAgencySignatureV2(v1)).toBe(false);
    expect(hasAgencySignature(v1)).toBe(true);
  });
  test("version 12 or 21 does not false-positive either matcher (word boundary)", () => {
    expect(hasAgencySignatureV1("Agency-Signature-Version: 12\n")).toBe(false);
    expect(hasAgencySignatureV2("Agency-Signature-Version: 21\n")).toBe(false);
  });
});
