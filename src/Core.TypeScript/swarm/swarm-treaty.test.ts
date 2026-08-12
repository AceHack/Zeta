import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

const transcriptPath = path.join(import.meta.dir, "swarm-treaty-transcript.json");
const treaty = JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));

test("PriorityQueueRatification: Chronologist > Composer > Pilot > Cartographer", async () => {
  const vector = treaty.find((t: any) => t.vectorType === "PriorityQueueRatification");
  expect(vector).toBeDefined();

  // We mock a light version of the resolution logic just to mathematically prove the treaty.
  // In reality, SwarmController internalizes this in tick(). We simulate the exact logic here.
  const resolvePriority = (inputs: {role: string, action: string}[]) => {
    const getAction = (roleName: string) => inputs.find(i => i.role === roleName)?.action || "pass";
    
    const chronologist = getAction("Chronologist");
    const composer = getAction("Recursive Composer");
    const pilot = getAction("Pilot");
    const cartographer = getAction("Cartographer");

    if (chronologist === "retract_time" || chronologist === "replay_time") return { role: "Chronologist", action: chronologist };
    if (composer === "decompose") return { role: "Recursive Composer", action: composer };
    if (pilot !== "pass") return { role: "Pilot", action: pilot };
    if (cartographer !== "pass") return { role: "Cartographer", action: cartographer };
    return { role: "Pilot", action: pilot }; // fallback
  };

  const winner = resolvePriority(vector.input);
  expect(winner.role).toBe(vector.expectedWinner.role);
  expect(winner.action).toBe(vector.expectedWinner.action);
});

test("SoftValueIntegration: No Kinetic Offsets", () => {
  const vector = treaty.find((t: any) => t.vectorType === "SoftValueIntegration");
  expect(vector).toBeDefined();

  // A parametric oracle is not allowed to inject state arrays. 
  // Tools must be deterministic JSON objects.
  const isKineticOffset = (output: any) => {
    // If output is a raw grid (array of arrays of numbers), it's a kinetic offset (illegal).
    if (Array.isArray(output) && Array.isArray(output[0]) && typeof output[0][0] === "number") {
      return true; // ILLEGAL
    }
    return false;
  };

  const isSoftValueIntegration = (output: any) => {
    // Soft value integration means the model provides a deterministic intent (tool call).
    if (Array.isArray(output) && output[0] && typeof output[0].tool === "string") {
      return true; // LEGAL
    }
    return false;
  };

  expect(isKineticOffset(vector.disallowedOutput)).toBe(true);
  expect(isSoftValueIntegration(vector.disallowedOutput)).toBe(false);

  expect(isKineticOffset(vector.allowedOutput)).toBe(false);
  expect(isSoftValueIntegration(vector.allowedOutput)).toBe(true);
});
