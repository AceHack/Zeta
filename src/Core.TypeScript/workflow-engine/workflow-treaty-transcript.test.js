// src/Core.TypeScript/workflow-engine/workflow-treaty-transcript.test.ts
import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { transition, postResultTransition, cycleClose } from "./agent-loop/state-machine";
import { applyTransition } from "./agent-loop/work-lifecycle-state-machine";
describe("Workflow Treaty Transcript (TS-side verification)", () => {
    const transcriptPath = join(__dirname, "workflow-treaty-transcript.json");
    const vectors = JSON.parse(readFileSync(transcriptPath, "utf-8"));
    test("all 264 treaty vectors match TS implementation dynamically", () => {
        let count = 0;
        for (const vector of vectors) {
            switch (vector.vectorType) {
                case "AgentTransition": {
                    const actual = transition(vector.initialState, vector.option);
                    expect(actual).toEqual(vector.expectedState);
                    count++;
                    break;
                }
                case "PostResultTransition": {
                    const actual = postResultTransition(vector.initialState, vector.result);
                    expect(actual).toEqual(vector.expectedState);
                    count++;
                    break;
                }
                case "CycleClose": {
                    const actual = cycleClose(vector.initialState);
                    expect(actual).toEqual(vector.expectedState);
                    count++;
                    break;
                }
                case "WorkLifecycleTransition": {
                    const actual = applyTransition(vector.initialState, vector.event);
                    // For ResolveAllThreads, TS uses new Date().toISOString() dynamically.
                    // We assert tag and non-timestamp fields are equal.
                    if (vector.event.tag === "ResolveAllThreads") {
                        expect(actual.ok).toBe(vector.expectedResult.ok);
                        if (actual.ok && vector.expectedResult.ok) {
                            expect(actual.state.tag).toBe(vector.expectedResult.state.tag);
                            expect(actual.state.tag).toBe("Approved");
                            expect(vector.expectedResult.state.tag).toBe("Approved");
                            if (actual.state.tag === "Approved" && vector.expectedResult.state.tag === "Approved") {
                                expect(actual.state.row).toEqual(vector.expectedResult.state.row);
                                expect(actual.state.prNumber).toBe(vector.expectedResult.state.prNumber);
                            }
                        }
                    }
                    else {
                        expect(actual).toEqual(vector.expectedResult);
                    }
                    count++;
                    break;
                }
                default:
                    throw new Error(`unknown vectorType in transcript: ${vector.vectorType}`);
            }
        }
        expect(count).toBeGreaterThan(0);
    });
});
