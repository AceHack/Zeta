#!/usr/bin/env bun
/**
 * swarm-controller.ts
 * 
 * Orchestrates the 4-Role Swarm over the UDP Lossy Mesh.
 * Instantiates Cartographer, Pilot, Recursive Composer, and Chronologist.
 */

import { observeWithLlm, simulate, type World, type NextAction } from "../observe/observe";
import { SWARM_ROLES, buildRoleInstruction } from "./roles";
import { fetchTransport } from "../model-backend/fetch-transport";
import { openAiCompatBackend } from "../model-backend/backend";
import { getPersona, localLlmPersona } from "../service/persona-registry";
import { executeSkillSequence } from "../arc-solver/grid-skills";
import { evaluateGrid } from "../arc-solver/grid-evaluator";

import { HardwareRegistry } from "../discovery/hardware-registry";

export interface UdpMeshNode {
  send: (data: Buffer) => void;
}
// Both parameters are part of the intended shape and unused by this stub: the mesh does not yet
// drop anything, and the stub sink discards what it is handed. Named with `_` so the signature
// still documents the contract without asserting behaviour the stub does not have.
function createLossyUdpMesh(size: number, _dropRate: number): UdpMeshNode[] {
  return Array.from({ length: size }, () => ({
    send: (_data: Buffer) => { /* dummy */ }
  }));
}

interface RoleNode {
  role: typeof SWARM_ROLES[0];
  mesh: UdpMeshNode;
  backend: any;
}

export class SwarmController {
  private nodes: RoleNode[] = [];
  private hwRegistry: HardwareRegistry;
  
  constructor() {
    this.hwRegistry = new HardwareRegistry();
    this.hwRegistry.start();
  }
  
  async init(dropRate = 0) {
    const meshNodes = createLossyUdpMesh(4, dropRate);
    const useLocalLlm = process.env.ZETA_SWARM_USE_LOCAL_LLM === "1";
    
    for (let i = 0; i < 4; i++) {
      const role = SWARM_ROLES[i]!;
      let config = getPersona(role.personaName);
      if (!config) throw new Error(`Missing persona: ${role.personaName}`);
      
      // Override for free GitHub Actions tier
      if (useLocalLlm) {
        console.log(`[SwarmController] Forcing local-llm for role ${role.name}`);
        config = localLlmPersona(role.personaName, { model: "qwen2.5:0.5b" });
      }
      
      const transport = fetchTransport();
      const backend = openAiCompatBackend({ baseUrl: config.harness.host ?? "http://localhost:11434", apiKey: "dummy", model: config.preferredModel }, transport);
      
      this.nodes.push({ role, mesh: meshNodes[i]!, backend });
    }
  }
  
  /**
   * Run one tick of the swarm.
   * All 4 roles observe the world simultaneously.
   * The Priority Queue resolves conflicts: Chronologist > Composer > Pilot > Cartographer
   */
  async tick(world: World): Promise<World> {
    console.log(`\n--- SWARM TICK ---`);
    console.log(`Current World Mode: ${world.mode}`);
    console.log(`Backlog size: ${world.backlog.length}`);
    
    // Broadcast state to all nodes via UDP (simulated sync)
    for (const node of this.nodes) {
      node.mesh.send(Buffer.from(JSON.stringify(world)));
    }
    
    // Concurrently ask all 4 roles for their preferred NextAction
    const promises = this.nodes.map(async (node) => {
      const instruction = buildRoleInstruction(node.role);
      const action = await observeWithLlm(world, node.backend, instruction);
      console.log(`[${node.role.name} / ${node.role.personaName}] chose: ${action.kind}`);
      return { role: node.role, action };
    });
    
    const results = await Promise.all(promises);
    
    // Resolve Priority
    const chronologist = results.find(r => r.role.name === "Chronologist");
    const composer = results.find(r => r.role.name === "Recursive Composer");
    const pilot = results.find(r => r.role.name === "Pilot");
    const cartographer = results.find(r => r.role.name === "Cartographer");
    
    let chosenAction: NextAction | null = null;
    let chosenBy = "";
    
    // 1. Chronologist wins if retracting time
    if (chronologist && (chronologist.action.kind === "retract_time" || chronologist.action.kind === "replay_time")) {
      chosenAction = chronologist.action;
      chosenBy = chronologist.role.name;
    } 
    // 2. Composer wins if decomposing
    else if (composer && composer.action.kind === "decompose") {
      chosenAction = composer.action;
      chosenBy = composer.role.name;
    }
    // 3. Pilot gets default right of way for execution
    // NOTE: this was `pilot.action.kind !== "pass"`, but "pass" is not a member of
    // NextAction["kind"] — the comparison was ALWAYS true and excluded nothing. Reduced to the
    // behaviour it actually had, rather than inventing the abstention it was reaching for. If
    // roles should be able to abstain, that needs a real `pass` action in the union.
    else if (pilot) {
      chosenAction = pilot.action;
      chosenBy = pilot.role.name;
    }
    // 4. Cartographer explores if idle
    // Same vacuous "pass" comparison as above; same reduction.
    else if (cartographer) {
      chosenAction = cartographer.action;
      chosenBy = cartographer.role.name;
    }
    else {
      // Fallback to Pilot
      chosenAction = pilot!.action;
      chosenBy = "Pilot (Fallback)";
    }
    
    console.log(`>>> PRIORITY RESOLUTION: ${chosenBy} wins with '${chosenAction.kind}'`);
    
    if (chosenAction.kind === "decompose") {
      console.log(`[SwarmController] Decompose won. Requesting semantic sub-tasks from ${chosenBy}...`);
      const decomposerNode = results.find(r => r.role.name === chosenBy)?.role ? this.nodes.find(n => n.role.name === chosenBy) : this.nodes[0];
      if (decomposerNode) {
        const item = chosenAction.item;
        
        // --- HOT-SWAP HARDWARE NODE ---
        let backend = decomposerNode.backend;
        const activeHw = this.hwRegistry.getActiveNode(chosenBy);
        if (activeHw) {
          console.log(`[SwarmController] ⚡ HOT-SWAP: Routing ${chosenBy} to physical hardware at ${activeHw.host} (${activeHw.model})`);
          backend = openAiCompatBackend({ baseUrl: activeHw.host, apiKey: "dummy", model: activeHw.model }, fetchTransport());
        }
        
        const prompt = `You are decomposing a complex task: "${item.title}".
Analyze the following context if any, and break the task down into a flat list of smaller sub-tasks.
Output ONLY a valid JSON array of strings representing the sub-tasks. Example: ["Extract blue shapes", "Find translation vector", "Apply to test grid"]
`;
        try {
          const completion = await backend.complete({
            messages: [{ role: "user", content: prompt }]
          });
          if (completion.ok) {
            const raw = completion.result.content.replace(/^```json/, "").replace(/```$/, "").trim();
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.every(s => typeof s === "string")) {
              chosenAction = { ...chosenAction, subTasks: parsed };
              console.log(`[SwarmController] Successfully generated semantic sub-tasks:`, parsed);
            } else {
              console.error(`[SwarmController] LLM returned invalid JSON array:`, raw);
            }
          } else {
            console.error(`[SwarmController] Backend completion failed:`, completion.error);
          }
        } catch (e) {
          console.error(`[SwarmController] Failed to generate semantic sub-tasks:`, e);
        }
      }
    } else if (chosenAction.kind === "do_item") {
      console.log(`[SwarmController] Pilot won with do_item. Requesting deterministic grid tool calls from ${chosenBy}...`);
      const pilotNode = results.find(r => r.role.name === chosenBy)?.role ? this.nodes.find(n => n.role.name === chosenBy) : this.nodes[0];
      if (pilotNode) {
        const item = chosenAction.item;
        
        // --- HOT-SWAP HARDWARE NODE ---
        let backend = pilotNode.backend;
        const activeHw = this.hwRegistry.getActiveNode(chosenBy);
        if (activeHw) {
          console.log(`[SwarmController] ⚡ HOT-SWAP: Routing ${chosenBy} to physical hardware at ${activeHw.host} (${activeHw.model})`);
          backend = openAiCompatBackend({ baseUrl: activeHw.host, apiKey: "dummy", model: activeHw.model }, fetchTransport());
        }

        const prompt = `You are executing a sub-task on an ARC grid: "${item.title}".
Available deterministic tools:
- {"tool": "readGridLenography", "args": {"sector": 0}}
- {"tool": "findShapes"}
- {"tool": "recolorShape", "args": {"shapeId": "shape_1", "color": 5}}
- {"tool": "translateShape", "args": {"shapeId": "shape_1", "dx": 1, "dy": 0}}
- {"tool": "rotateGrid", "args": {"degrees": 90}}

Output ONLY a valid JSON array of tool calls you wish to execute. Example: [{"tool": "findShapes"}, {"tool": "recolorShape", "args": {"shapeId": "shape_1", "color": 5}}]
You MUST wrap your response in an array [ ... ]. Do NOT output a single object without the array brackets.
`;
        try {
          const completion = await backend.complete({
            messages: [{ role: "user", content: prompt }]
          });
          if (completion.ok) {
            const raw = completion.result.content.replace(/^```json/, "").replace(/```$/, "").trim();
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              console.log(`[SwarmController] Successfully generated grid tool calls:`, parsed);
              
              if (item.gridData) {
                const initialGrid = item.gridData.input;
                const expectedGrid = item.gridData.output;
                
                console.log(`[SwarmController] Executing skills on grid substrate...`);
                const actualGrid = executeSkillSequence(initialGrid, parsed);
                
                const evaluation = evaluateGrid(actualGrid, expectedGrid);
                console.log(`\n[Cartographer KPI] Pixel Accuracy: ${evaluation.accuracy.toFixed(2)}%`);
                console.log(`[Cartographer KPI] Difference: ${evaluation.diffPixels} pixels off out of ${evaluation.totalPixels} total.\n`);
                if (chosenAction.kind === "do_item") {
                  chosenAction.evaluation = evaluation;
                }
              } else {
                console.log(`[SwarmController] No gridData attached to item. Skipping evaluation.`);
              }
            } else {
              console.error(`[SwarmController] LLM returned invalid JSON array for tools:`, raw);
            }
          } else {
            console.error(`[SwarmController] Backend completion failed for do_item:`, completion.error);
          }
        } catch (e) {
          console.error(`[SwarmController] Failed to generate grid tool calls:`, e);
        }
      }
    }    // Advance world
    return simulate(world, chosenAction);
  }
}

async function main() {
  console.log("Initializing Mux-Duplex Swarm (4-Roles)...");
  const swarm = new SwarmController();
  await swarm.init(0.0); // 0% drop rate for local test
  
  let world: World = {
    // `mode` is optional and documented as "absent = unset", which is what "idle" meant here.
    backlog: [],
    history: [],
    cartography: { scopeLevel: 0, timeOffset: 0 }
  };
  
  // Just run 1 tick for test
  world = await swarm.tick(world);
  console.log("Swarm test tick complete.");
  return 0;
}

if (import.meta.main) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
