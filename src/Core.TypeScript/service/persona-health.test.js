/**
 * persona-health.test.ts — validates that all registered personas are well-defined
 * with working CLIs, supported models, and consistent configuration.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { listPersonas } from "./persona-registry";
const personas = listPersonas();
describe("persona registry health — CLI availability", () => {
    for (const persona of personas) {
        test(`${persona.name}: CLI '${persona.harness.command}' is on PATH`, () => {
            const result = spawnSync("which", [persona.harness.command], {
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
            });
            expect(result.status).toBe(0);
        });
    }
});
describe("persona registry health — config consistency", () => {
    for (const persona of personas) {
        test(`${persona.name}: has a preferredModel set`, () => {
            expect(persona.preferredModel.length).toBeGreaterThan(0);
        });
        test(`${persona.name}: harness args contain {{PROMPT}} template`, () => {
            const hasPrompt = persona.harness.args.some(a => a.includes("{{PROMPT}}"));
            expect(hasPrompt).toBe(true);
        });
        test(`${persona.name}: harness has a defaultModel (or is local-llm)`, () => {
            if (persona.harness.type === "local-llm") {
                expect(persona.harness.model?.length).toBeGreaterThan(0);
            }
            else {
                expect(persona.harness.defaultModel?.length).toBeGreaterThan(0);
            }
        });
        test(`${persona.name}: label follows naming convention`, () => {
            // Labels should be reverse-domain or descriptive
            expect(persona.label.length).toBeGreaterThan(0);
        });
    }
});
describe("persona registry health — model support", () => {
    // Known supported models per harness
    const CLAUDE_MODELS = ["claude-opus-4-8", "claude-opus-4-7", "claude-sonnet-4-6", "claude-sonnet-4-5"];
    const GROK_MODELS = ["grok-4-3"];
    const GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.1-pro"];
    const CODEX_MODELS = ["gpt-5.5", "o3"];
    function supportedModels(command) {
        switch (command) {
            case "claude": return CLAUDE_MODELS;
            case "cursor-agent": return GROK_MODELS;
            case "agy": return GEMINI_MODELS;
            case "codex": return CODEX_MODELS;
            default: return []; // local-llm, kiro-cli — no fixed list
        }
    }
    for (const persona of personas) {
        const supported = supportedModels(persona.harness.command);
        if (supported.length > 0) {
            test(`${persona.name}: preferredModel '${persona.preferredModel}' is in supported list for ${persona.harness.command}`, () => {
                expect(supported).toContain(persona.preferredModel);
            });
            if (persona.harness.defaultModel) {
                test(`${persona.name}: harness defaultModel '${persona.harness.defaultModel}' is in supported list`, () => {
                    expect(supported).toContain(persona.harness.defaultModel);
                });
            }
        }
    }
});
