#!/usr/bin/env bun
/**
 * swarm-controller.ts
 * 
 * Orchestrates the 4-Hat Swarm over the UDP Lossy Mesh.
 * Instantiates Cartographer, Pilot, Recursive Composer, and Chronologist.
 */

import { observeWithLlm, simulate, type World, type NextAction } from "../observe/observe";
import { SWARM_HATS, buildHatInstruction, type HatDefinition } from "./hats";
import { fetchTransport } from "../model-backend/fetch-transport";
import { openAiCompatBackend, type ModelBackend, type BackendConfig, type ChatMessage } from "../model-backend/backend";
import { getPersona, localLlmPersona } from "../service/persona-registry";
import { executeSkillSequence } from "../arc-solver/grid-skills";
import { evaluateGrid } from "../arc-solver/grid-evaluator";
import { CelegansController, parseCsvContent } from "../chip8/celegans-controller";
import { SemioticsEngine } from "./semiotics-engine";
import connectomeCsv from "../../Core/data/celegans-connectome-chemical.csv?raw";
import { BnnSocietyPredictor } from "../bayesian/bnn-key-predictor";
import { cooperate } from "../tri-boolean/tri-boolean";
import { HardwareRegistry } from "../discovery/hardware-registry";

export interface UdpMeshNode {
  send: (data: Uint8Array) => void;
}
// Both parameters are part of the intended shape and unused by this stub: the mesh does not yet
// drop anything, and the stub sink discards what it is handed. Named with `_` so the signature
// still documents the contract without asserting behaviour the stub does not have.
function createLossyUdpMesh(size: number, _dropRate: number): UdpMeshNode[] {
  return Array.from({ length: size }, () => ({
    send: (_data: Uint8Array) => { /* dummy */ }
  }));
}

interface SwarmNode {
  hat: HatDefinition;
  mesh: UdpMeshNode;
  backend: any;
}

export class SwarmController {
  private nodes: SwarmNode[] = [];
  private hwRegistry: HardwareRegistry;
  private llmBackend: ModelBackend | null = null;
  public wormSociety: CelegansController[] = [];
  public bnnSociety?: BnnSocietyPredictor;
  
  // CHIP-8 Superorganism State
  private pheromoneField: Map<number, number> = new Map();
  private scarcity: number = 0.8; // High scarcity defaults trigger tower formation
  private semioticsEngine: SemioticsEngine = new SemioticsEngine();
  
  // Semantic Visual Cortex properties
  public readonly SEMANTIC_CONCEPTS = ["Time", "Logic", "Structure", "Language", "Love", "Chaos", "Order", "Humanity", "Nature", "Technology"];
  private currentConceptIndex = 0;
  
  // ARC-AGI Gamification / Level progression
  public readonly GAME_LEVELS = ["Horizontal Bar", "Vertical Pillar", "Diagonal Staircase"];
  private currentGameLevel = 0;
  
  private getSemanticVector(concept: string): number[] {
    const vec = new Array(64).fill(0);
    let hash = 5381;
    for (let i = 0; i < concept.length; i++) {
      hash = ((hash << 5) + hash) + concept.charCodeAt(i);
    }
    // Generate a stable pseudorandom vector for this concept
    for (let i = 0; i < 64; i++) {
      hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
      hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
      vec[i] = (hash >>> 0) / 4294967296; // Normalize to [0, 1]
    }
    return vec;
  }
  
  constructor() {
    this.hwRegistry = new HardwareRegistry();
    this.hwRegistry.start();
  }
  
  async init(llmConfig?: BackendConfig) {
    if (llmConfig) {
      this.llmBackend = openAiCompatBackend(llmConfig, fetchTransport());
    }
    const meshNodes = createLossyUdpMesh(4, 0);
    const useLocalLlm = false;
    for (let i = 0; i < 4; i++) {
      const hat = SWARM_HATS[i]!;
      let config = getPersona(hat.personaName);
      if (!config) throw new Error(`Missing persona: ${hat.personaName}`);
      
      // Override for free GitHub Actions tier
      if (useLocalLlm) {
        console.log(`[SwarmController] Forcing local-llm for hat ${hat.name}`);
        config = localLlmPersona(hat.personaName, { model: "qwen2.5:0.5b" });
      }
      
      const transport = fetchTransport();
      const backend = openAiCompatBackend({ baseUrl: config.harness.host ?? "http://localhost:11434", apiKey: "dummy", model: config.preferredModel }, transport);
      
      this.nodes.push({ hat, mesh: meshNodes[i]!, backend });
    }
  }
  
  /**
   * Run one tick of the swarm.
   * All 4 hats observe the world simultaneously.
   * The Priority Queue resolves conflicts: Chronologist > Composer > Pilot > Cartographer
   */
  async tick(world: World): Promise<World> {
    let outerLoopActions: any[] = [];
    const isChip8 = world.cheatEngine && world.cheatEngine.causalMask;
    if (!isChip8) {
      console.log(`\n--- SWARM TICK ---`);
      console.log(`Current World Mode: ${world.mode}`);
      console.log(`Backlog size: ${world.backlog.length}`);
    }
    
    // Broadcast state to all nodes via UDP (simulated sync)
    for (const node of this.nodes) {
      node.mesh.send(new TextEncoder().encode(JSON.stringify(world)));
    }

    // [Causal Orbit Detection]
    // If the world has an attached CheatEngine emulator frame, we hash the Playable Quote footprint
    if (world.cheatEngine && world.cheatEngine.memorySectors.length > 0 && world.cheatEngine.causalMask && world.cheatEngine.display) {
      const { detectCausalSignature } = await import("./signature-detector");
      const { renderDisplay } = await import("../chip8/chip8");
      
      const mem = world.cheatEngine.memorySectors[0]!;
      const mask = world.cheatEngine.causalMask;
      const display = world.cheatEngine.display;
      
      const sig = detectCausalSignature(mem, mask, display);
      const prevSig = world.cartography?.activeOrbitSignature;
      
      if (prevSig && sig !== prevSig) {
        console.log(`[SwarmController] 🪐 CAUSAL ORBIT SHIFT DETECTED! (${prevSig} -> ${sig})`);
        
        // Render human-readable visual state
        console.log(`[SwarmController] 👁️  Visual State for Orbit ${sig}:`);
        // We construct a fake frame just for renderDisplay to work cleanly since we changed signature
        // of detectCausalSignature but not renderDisplay
        const dummyFrame = { display: new Map<number, boolean>() } as any;
        for (let i = 0; i < display.length; i++) {
          if (display[i]) dummyFrame.display.set(i, true);
        }
        console.log(renderDisplay(dummyFrame));

        console.log(`[SwarmController] Swarm shifting Hats to adapt to new ruleset...`);

        // Ask LLM to optimize worm hyperparameters on orbit shift (Outer Loop)
        const activePilot = this.nodes.find(n => n.hat.name === "Pilot");
        if (activePilot && this.wormSociety.length > 0) {
          console.log(`[SwarmController] LLM Outer Loop: Analyzing drawn shape to build Contextual Grammar...`);
          try {
            const activePixels: string[] = [];
            for (let y = 0; y < 32; y++) {
              for (let x = 0; x < 64; x++) {
                if (display[x + y * 64]) {
                  activePixels.push(`(${x},${y})`);
                }
              }
            }
            
            const promptText = `The C. elegans biological inner loop has just completed a drawing cycle on a 64x32 canvas.
Here are the (x,y) coordinates of the pixels drawn (if too many, focus on the general pattern):
[${activePixels.slice(0, 150).join(", ")}${activePixels.length > 150 ? "... (truncated)" : ""}]

You are the Spatial Pattern Recognizer for building a Context-Aware Shape Grammar. The biological substrate was actively stimulated by the semantic concept of: [${this.SEMANTIC_CONCEPTS[this.currentConceptIndex]}]. 
The Swarm is currently trying to beat Level ${this.currentGameLevel + 1}: Draw a "${this.GAME_LEVELS[this.currentGameLevel] || 'Free Play'}".
Analyze these coordinates and determine if they form a recognizable geometric shape, line, or spatial rule. Correlate the shape's meaning or poetry to the semantic concept if possible.
Output a JSON array containing a single object describing the shape:
[{"tool": "saveShapeGrammar", "args": {"name": "ShapeName", "grammarRule": "Description of the spatial logic used to create this shape"}}]`;

            let completionContent = "";
            
            if (this.llmBackend) {
              const messages: ChatMessage[] = [
                { role: "system", content: "You are a spatial pattern recognition engine evaluating Swarm coordinates." },
                { role: "user", content: promptText }
              ];
              const response = await this.llmBackend.complete({ messages });
              if (response.ok) {
                completionContent = response.result.content;
              } else {
                console.warn(`[SwarmController] LLM Call Failed: ${response.error}`);
              }
            }
            
            // Fallback to MOCK inference if backend failed or is absent
            if (!completionContent) {
              let shapeName = "Unknown Shape";
              let grammarRule = "Chaotic spatial logic";
              
              if (activePixels.length > 0) {
                 // Determine general bounding box aspect ratio to guess shape
                 let minX = 64, maxX = 0, minY = 32, maxY = 0;
                 for (const p of activePixels) {
                    const parts = p.replace("(", "").replace(")", "").split(",");
                    const px = parseInt(parts[0]);
                    const py = parseInt(parts[1]);
                    if (px < minX) minX = px;
                    if (px > maxX) maxX = px;
                    if (py < minY) minY = py;
                    if (py > maxY) maxY = py;
                 }
                 const width = maxX - minX;
                 const height = maxY - minY;
                 
                 if (width > height * 2) {
                    shapeName = "Horizontal Bar";
                    grammarRule = "Continuous lateral movement (x-axis dominated)";
                 } else if (height > width * 2) {
                    shapeName = "Vertical Pillar";
                    grammarRule = "Continuous vertical movement (y-axis dominated)";
                 } else if (width > 0 && height > 0) {
                    shapeName = "Diagonal Staircase";
                    grammarRule = "Correlated x and y axis movement creating a slope";
                 }
              }
              completionContent = `[{"tool": "saveShapeGrammar", "args": {"name": "${shapeName}", "grammarRule": "${grammarRule}"}}]`;
            }

            const raw = completionContent.replace(/^```json/, "").replace(/```$/, "").trim();
            try {
              const parsed = JSON.parse(raw);
              console.log(`[SwarmController] LLM Shape Grammar Evaluation:`, parsed);
              if (Array.isArray(parsed)) {
                outerLoopActions = parsed;
                
                // Check for saveShapeGrammar tool
                for (const action of parsed) {
                  if (action.tool === "saveShapeGrammar" && action.args) {
                    let knownGrammar: Record<string, string> = {};
                    try {
                      const saved = localStorage.getItem('known-grammar');
                      if (saved) knownGrammar = JSON.parse(saved);
                    } catch (e) {}
                    knownGrammar[action.args.name] = action.args.grammarRule;
                    localStorage.setItem('known-grammar', JSON.stringify(knownGrammar));
                    console.log(`[SwarmController] 🧠 Added new Contextual Grammar Rule: ${action.args.name}`);
                    
                    // Translate geometric shape to human language
                    const linguisticToken = this.semioticsEngine.translate(action.args.name, this.SEMANTIC_CONCEPTS[this.currentConceptIndex]);
                    console.log(`[SwarmController] 🗣️  Translated to Language: ${linguisticToken.pictogram} | ${linguisticToken.english} (${linguisticToken.meaning})`);
                    
                    if (world.cheatEngine) {
                      (world.cheatEngine as any).linguisticToken = linguisticToken;
                      
                      // Gamification: Check Level Up
                      const currentObjective = this.GAME_LEVELS[this.currentGameLevel];
                      if (currentObjective && action.args.name === currentObjective) {
                        console.log(`[SwarmController] 🏆 LEVEL UP! Swarm successfully learned: ${currentObjective}`);
                        this.currentGameLevel++;
                        (world.cheatEngine as any).levelUpEvent = true;
                      } else {
                        (world.cheatEngine as any).levelUpEvent = false;
                      }
                    }
                  }
                }
              }
            } catch (e) {
              // ignore LLM json parse errors on outer loop for now
            }
          } catch(e) {
            console.error(`[SwarmController] LLM Tuning failed:`, e);
          }
        }

        // Persist signature to known-signatures.json
        let known: string[] = [];
        try {
          const saved = localStorage.getItem('known-signatures');
          if (saved) known = JSON.parse(saved);
        } catch (e) {}

        if (!known.includes(sig)) {
          known.push(sig);
          localStorage.setItem('known-signatures', JSON.stringify(known));
          console.log(`[SwarmController] 💾 Saved new signature ${sig} to localStorage`);
        }
        
        // Progress to the next concept when the visual cortex finishes a thought
        this.currentConceptIndex = (this.currentConceptIndex + 1) % this.SEMANTIC_CONCEPTS.length;
        console.log(`[SwarmController] 🧠 Visual Cortex shifting to next semantic concept: [${this.SEMANTIC_CONCEPTS[this.currentConceptIndex]}]`);
      }
      
      const activeConcept = this.SEMANTIC_CONCEPTS[this.currentConceptIndex];
      if (world.cheatEngine) {
        (world.cheatEngine as any).activeConcept = activeConcept;
      }
      
      world = { 
        ...world, 
        cartography: { 
          ...world.cartography,
          scopeLevel: world.cartography?.scopeLevel ?? 0,
          timeOffset: world.cartography?.timeOffset ?? 0,
          activeOrbitSignature: sig 
        } 
      };
    }
    
    let results: { hat: HatDefinition; action: NextAction }[] = [];
    
    // If CHIP-8, we skip LLM for the other hats to run at high biological speed
    if (world.cheatEngine && world.cheatEngine.causalMask) {
      const pilotHat = this.nodes.find(n => n.hat.name === "Pilot")!.hat;
      results = [{
        hat: pilotHat,
        action: { kind: "do_item", item: world.backlog[0] ?? { id: "chip8", title: "CHIP-8 Game", ready: true, ambiguous: false }, actions: outerLoopActions }
      }];
    } else {
      // Concurrently ask all 4 hats for their preferred NextAction
      const promises = this.nodes.map(async (node) => {
        const instruction = buildHatInstruction(node.hat);
        const action = await observeWithLlm(world, node.backend, instruction);
        console.log(`[${node.hat.name} / ${node.hat.personaName}] chose: ${action.kind}`);
        return { hat: node.hat, action };
      });
      results = await Promise.all(promises);
    }
    
    // Resolve Priority
    const chronologist = results.find(r => r.hat.name === "Chronologist");
    const composer = results.find(r => r.hat.name === "Recursive Composer");
    const pilot = results.find(r => r.hat.name === "Pilot");
    const cartographer = results.find(r => r.hat.name === "Cartographer");
    
    let chosenAction: NextAction | null = null;
    let chosenBy = "";
    
    // 1. Chronologist wins if retracting time
    if (chronologist && (chronologist.action.kind === "retract_time" || chronologist.action.kind === "replay_time")) {
      chosenAction = chronologist.action;
      chosenBy = chronologist.hat.name;
    } 
    // 2. Composer wins if decomposing
    else if (composer && composer.action.kind === "decompose") {
      chosenAction = composer.action;
      chosenBy = composer.hat.name;
    }
    // 3. Pilot gets default right of way for execution
    else if (pilot) {
      chosenAction = pilot.action;
      chosenBy = pilot.hat.name;
    }
    // 4. Cartographer explores if idle
    else if (cartographer) {
      chosenAction = cartographer.action;
      chosenBy = cartographer.hat.name;
    }
    else {
      // Fallback to Pilot
      chosenAction = pilot!.action;
      chosenBy = "Pilot (Fallback)";
    }
    
    if (!isChip8) {
      console.log(`>>> PRIORITY RESOLUTION: ${chosenBy} wins with '${chosenAction.kind}'`);
    }
    
    if (chosenAction.kind === "decompose") {
      if (!isChip8) console.log(`[SwarmController] Decompose won. Requesting semantic sub-tasks from ${chosenBy}...`);
      const decomposerNode = results.find(r => r.hat.name === chosenBy)?.hat ? this.nodes.find(n => n.hat.name === chosenBy) : this.nodes[0];
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
            let raw = completion.result.content.replace(/^```json/, "").replace(/```$/, "").trim();
            
            // Basic fix for unterminated array
            if (!raw.endsWith("]")) raw += "]";
            
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.every(s => typeof s === "string")) {
                chosenAction = { ...chosenAction, subTasks: parsed };
                console.log(`[SwarmController] Successfully generated semantic sub-tasks:`, parsed);
              } else {
                console.error(`[SwarmController] LLM returned invalid JSON array:`, raw);
              }
            } catch (e) {
              console.error(`[SwarmController] Failed to parse sub-tasks JSON:`, e);
            }
          } else {
            console.error(`[SwarmController] Backend completion failed:`, completion.error);
          }
        } catch (e) {
          console.error(`[SwarmController] Failed to generate semantic sub-tasks:`, e);
        }
      }
    } else if (chosenAction.kind === "do_item") {
      if (!isChip8) console.log(`[SwarmController] Pilot won with do_item. Requesting deterministic grid tool calls from ${chosenBy}...`);
      const pilotNode = results.find(r => r.hat.name === chosenBy)?.hat ? this.nodes.find(n => n.hat.name === chosenBy) : this.nodes[0];
      if (pilotNode) {
        const item = chosenAction.item;
        
        // --- HOT-SWAP HARDWARE NODE ---
        let backend = pilotNode.backend;
        const activeHw = this.hwRegistry.getActiveNode(chosenBy);
        if (activeHw) {
          console.log(`[SwarmController] ⚡ HOT-SWAP: Routing ${chosenBy} to physical hardware at ${activeHw.host} (${activeHw.model})`);
          backend = openAiCompatBackend({ baseUrl: activeHw.host, apiKey: "dummy", model: activeHw.model }, fetchTransport());
        }

        const isChip8 = world.cheatEngine && world.cheatEngine.causalMask;
        
        if (isChip8) {
          // Inner Loop: Fast path using Society of C. elegans worms & Society of BNNs
          if (this.wormSociety.length === 0) {
            console.log("[SwarmController] Initializing Society of C. elegans biological substrates (Inner Loop)...");
            const connectome = parseCsvContent(connectomeCsv);
            // Instantiate 5 worms cooperating
            for (let i = 0; i < 5; i++) {
              this.wormSociety.push(new CelegansController(connectome, BigInt(1337 + i)));
            }
          }
          if (!this.bnnSociety) {
            console.log("[SwarmController] Initializing Society of BNN Key Predictors for CHIP-8 (Inner Loop)...");
            this.bnnSociety = new BnnSocietyPredictor(3);
          }
          
          // Inject display and step Kuramoto oscillator
          const displayMap = new Map<number, boolean>();
          for (let i = 0; i < world.cheatEngine!.display!.length; i++) {
            if (world.cheatEngine!.display![i]) displayMap.set(i, true);
          }
          
          // Initialize Pheromone field if needed
          if (this.pheromoneField.size === 0) {
            for (let i = 0; i <= 0xF; i++) this.pheromoneField.set(i, 0.0);
          }
          
          // BNN Key Predictor computes its consensus separately
          const bnnPredictions = this.bnnSociety.predict(world.cheatEngine!.display!);
          
          // If BNN is highly uncertain (max prob < 0.2), scarcity is high!
          let maxProb = 0;
          for (const [_key, prob] of Object.entries(bnnPredictions)) {
            if (prob > maxProb) { maxProb = prob; }
          }
          this.scarcity = maxProb < 0.2 ? 0.9 : 0.4;
          
          // Thompson Sampling: Sample from the BNN posterior distribution for human-like non-deterministic play
          let bnnSampledKey = 0;
          let r = Math.random();
          for (const [key, prob] of Object.entries(bnnPredictions)) {
            r -= (prob as number);
            if (r <= 0) {
              bnnSampledKey = parseInt(key, 10);
              break;
            }
          }
          
          // Tri-Boolean Cooperation: Superorganism Tower Formation (Perez & Ding 2025)
          const cooperativeThreshold = 0.15; // Requires some signal to commit to the collective
          
          let towerCount = 0;
          // Apply to cheat engine to update dashboard UI immediately
          if (world.cheatEngine) {
            (world.cheatEngine as any).activeConcept = this.SEMANTIC_CONCEPTS[this.currentConceptIndex];
            (world.cheatEngine as any).gameLevel = this.currentGameLevel + 1;
            (world.cheatEngine as any).gameObjective = this.GAME_LEVELS[this.currentGameLevel] || "Free Play";
          }
          let towerKey = -1;
          
          const currentConcept = this.SEMANTIC_CONCEPTS[this.currentConceptIndex] || "Time";
          const semanticVector = this.getSemanticVector(currentConcept);
          
          for (const worm of this.wormSociety) {
            // Integrate-as-Choice Locus & Food Scarcity Trigger
            const result = worm.tickWithSuperorganism(
              world.cheatEngine!.display!,
              this.scarcity, 
              this.pheromoneField, 
              cooperativeThreshold,
              semanticVector
            );
            
            // Tonal Momentum: Agent emits pheromones to signal intent
            if (result.pheromoneEmit) {
              const current = this.pheromoneField.get(result.pheromoneEmit.key) || 0;
              this.pheromoneField.set(result.pheromoneEmit.key, current + result.pheromoneEmit.amount);
            }
            
            // Did it cross threshold and commit?
            if (result.joinedTower) {
              towerCount++;
              towerKey = result.key;
            }
          }
          
          // Pheromone Decay (environmental dissipation)
          for (const [key, val] of this.pheromoneField.entries()) {
            this.pheromoneField.set(key, val * 0.9);
          }
          
          // Apply cooperate() identity to simulate non-collapsing quantum identity engagement
          cooperate(null as any); 

          // Consensus: The superorganism tower formed if at least 2 worms joined the same locus
          let wormConsensusKey = towerCount >= 2 ? towerKey : 0;
          
          
          // Simple Fusion Policy: if max BNN prob is strong enough, use sampled BNN key; otherwise use biological tower
          const chosenKey = maxProb > 0.4 ? bnnSampledKey : wormConsensusKey;

          if (chosenKey !== 0 && chosenAction.kind === "do_item") {
            chosenAction.actions = [
              ...(chosenAction.actions || []),
              {"tool": "pressKey", "args": {"key": chosenKey}}
            ];
          }
          const nextWorld = simulate(world, chosenAction);
          // Attach chosen action to cheatEngine so TV can render it accurately
          const displayPredictions = { ...bnnPredictions };
          if (chosenKey !== 0) {
            displayPredictions[chosenKey] = 1.0;
          }

          return {
            ...nextWorld,
            cheatEngine: {
              ...nextWorld.cheatEngine!,
              keyPredictions: displayPredictions
            }
          };
        }
        
        let prompt = "";
        
        prompt = `You are executing a sub-task on an ARC grid: "${item.title}".
Available deterministic tools:
- {"tool": "readGridLensography", "args": {"sector": 0}}
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
            let raw = completion.result.content.replace(/^```json/, "").replace(/```$/, "").trim();
            
            // Attempt basic fix for unterminated JSON array/object from LLM cutoff
            if (!raw.endsWith("]") && raw.startsWith("[")) {
              if (raw.endsWith("}")) raw += "]";
              else if (raw.endsWith("\"")) raw += "}]";
              else raw += "\"}]";
            }
            
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                if (chosenAction.kind === "do_item") {
                  chosenAction.actions = parsed;
                }
                
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
            } catch (e) {
              console.error(`[SwarmController] JSON parse error for tool calls:`, e);
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
