import { describe, expect, test } from "bun:test";
import { aiAttributionFooter, appendAttribution } from "./ai-attribution";

describe("aiAttributionFooter", () => {
  test("includes agent name", () => {
    const footer = aiAttributionFooter({ agent: "Claude Code" });
    expect(footer).toContain("Claude Code");
    expect(footer).toContain("🤖");
  });

  test("includes onBehalfOf when provided", () => {
    const footer = aiAttributionFooter({
      agent: "Claude Code",
      onBehalfOf: "acehack",
    });
    expect(footer).toContain("@acehack");
    expect(footer).toContain("on behalf of");
  });

  test("omits onBehalfOf when not provided", () => {
    const footer = aiAttributionFooter({ agent: "batch-resolve" });
    expect(footer).not.toContain("on behalf of");
    expect(footer).not.toContain("@");
  });
});

describe("appendAttribution", () => {
  test("appends footer to body with separator", () => {
    const result = appendAttribution("Some review comment.", {
      agent: "Claude Code",
      onBehalfOf: "acehack",
    });
    expect(result).toStartWith("Some review comment.");
    expect(result).toContain("---");
    expect(result).toContain("🤖");
    expect(result).toContain("Claude Code");
    expect(result).toContain("@acehack");
  });

  test("preserves original body exactly", () => {
    const body = "Line 1\nLine 2\n\nParagraph 2";
    const result = appendAttribution(body, { agent: "test-tool" });
    expect(result.startsWith(body)).toBe(true);
  });
});
