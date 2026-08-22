import { describe, expect, test } from "bun:test";

import { extractLastAssistantText } from "./stop-detect-response-rut";
import { detectRepeatedTokenRut } from "../../src/Core.TypeScript/hygiene/detect-repeated-token-rut";

function asstLine(text: string): string {
  return JSON.stringify({
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text }] },
  });
}

function userLine(text: string): string {
  return JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ type: "text", text }] },
  });
}

describe("extractLastAssistantText", () => {
  test("returns the latest assistant turn's text", () => {
    const jsonl = [
      userLine("hi"),
      asstLine("first reply"),
      userLine("tick"),
      asstLine("Green. Holding."),
    ].join("\n");
    expect(extractLastAssistantText(jsonl)).toBe("Green. Holding.");
  });

  test("concatenates multiple text blocks of the last turn", () => {
    const jsonl = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "line one" },
          { type: "tool_use", name: "Bash", input: {} },
          { type: "text", text: "line two" },
        ],
      },
    });
    expect(extractLastAssistantText(jsonl)).toBe("line one\nline two");
  });

  test("tool-only assistant turn yields empty (nothing to check)", () => {
    const jsonl = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "tool_use", name: "Bash", input: {} }],
      },
    });
    expect(extractLastAssistantText(jsonl)).toBe("");
  });

  test("tolerates malformed/blank lines", () => {
    const jsonl = ["", "not json", asstLine("ok then"), "   "].join("\n");
    expect(extractLastAssistantText(jsonl)).toBe("ok then");
  });

  test("empty transcript yields empty string", () => {
    expect(extractLastAssistantText("")).toBe("");
  });
});

describe("hook composition (extract → detect)", () => {
  test("a normal response is NOT a rut", () => {
    const jsonl = asstLine(
      "Merged the PR; gate is green and the branch is in sync with origin main.",
    );
    const text = extractLastAssistantText(jsonl);
    expect(detectRepeatedTokenRut(text).isRut).toBe(false);
  });

  test("a 'court'×N response IS a rut", () => {
    const jsonl = asstLine("court ".repeat(12).trim());
    const text = extractLastAssistantText(jsonl);
    const v = detectRepeatedTokenRut(text);
    expect(v.isRut).toBe(true);
    expect(v.reasons).toContain("run");
  });

  test("terse heartbeat 'Green. Holding.' does NOT false-positive", () => {
    const text = extractLastAssistantText(asstLine("Green. Holding."));
    expect(detectRepeatedTokenRut(text).isRut).toBe(false);
  });
});
