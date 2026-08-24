#!/usr/bin/env bun
/**
 * swarm-controller.ts
 * 
 * Orchestrates the 4-Hat Swarm over the UDP Lossy Mesh.
 * Instantiates Cartographer, Pilot, Recursive Composer, and Chronologist.
 */

import { observeWithLlm, simulate, type World, type NextAction } from "../observe/observe";
import { SWARM_HATS, buildHatInstruction } from "./hats";
import type { HatDefinition } from "./hats";
import { fetchTransport } from "../model-backend/fetch-transport";
import { openAiCompatBackend } from "../model-backend/backend";
import { getPersona, localLlmPersona } from "../service/persona-registry";
import { executeSkillSequence } from "../arc-solver/grid-skills";
import { evaluateGrid } from "../arc-solver/grid-evaluator";
import { CelegansController, loadFromCsv } from "../chip8/celegans-controller";
import { ATTENTION_TOP_K, BnnSocietyPredictor, thompsonKeyOf, type SocietySnapshot } from "../bayesian/bnn-key-predictor";
import type { ArenaReadout, ArenaTrackReadout, AttentionReadoutWire } from "../observe/observe";
import { ArcExplorer } from "../bayesian/arc-explorer";
import { cooperate } from "../tri-boolean/tri-boolean";
import { readKnownSignatures } from "./swarm-known-signatures";
// removed path

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

interface SwarmNode {
  hat: HatDefinition;
  mesh: UdpMeshNode;
  backend: any;
}

export class SwarmController {
  private nodes: SwarmNode[] = [];
  private hwRegistry: HardwareRegistry;
  public wormSociety: CelegansController[] = [];
  public bnnSociety: BnnSocietyPredictor | undefined;
  public arcExplorer?: ArcExplorer;
  private previousDisplay: number[] = [];
  private visualDeltaLog: string[] = [];
  
  // CHIP-8 Superorganism State
  private pheromoneField: Map<number, number> = new Map();
  private scarcity: number = 0.8; // High scarcity defaults trigger tower formation

  /** The key committed LAST tick — feeds the predictor's self-identification. */
  private lastChosenKey: number | undefined;
  /** Priors to restore into the BNN society when it is (lazily) created. */
  private pendingGamePriors: SocietySnapshot | null = null;
  /** Outer-loop LLM tuning fires ONLY on explicit opt-in — never in the browser. */
  private llmTuningEnabled = false;

  constructor() {
    this.hwRegistry = new HardwareRegistry();
    this.hwRegistry.start();
  }

  /**
   * Install per-cart priors (from a committed priors module) and reset the
   * live society so the next tick rebuilds it — restored from the snapshot
   * when one exists, fresh otherwise. Called at boot and on every cart
   * switch: the learned posteriors are per-cart, while the STRUCTURAL layers
   * (objects/OCR/roles) are stateless and transfer to any cart — that split
   * is the soft-regime continual-learning story.
   */
  setGamePriors(snapshot: SocietySnapshot | null) {
    this.pendingGamePriors = snapshot;
    this.bnnSociety = undefined;
    this.lastChosenKey = undefined;
  }
  
  async init(dropRate = 0) {
    // 300 TICKS (~10s at 30fps) of exploration — counted on the worker's own
    // cycle counter, never wall-clock, and drawn from the seeded stream. The
    // predictor's own layer-5 probing does the purposeful part; this is the
    // outer safety net.
    this.arcExplorer = new ArcExplorer(300);
    const meshNodes = createLossyUdpMesh(4, dropRate);
    const useLocalLlm = process.env.ZETA_SWARM_USE_LOCAL_LLM === "1";
    // The outer-loop tuning fetch previously fired on every orbit shift even
    // where no LLM can exist (the browser) — a guaranteed-failing request in
    // the console. It now requires the same explicit opt-in.
    this.llmTuningEnabled = useLocalLlm;
    
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
      node.mesh.send(Buffer.from(JSON.stringify(world)));
    }

    // [Visual Delta Log for ARC-AGI-3 Tracking]
    if (world.cheatEngine && world.cheatEngine.display) {
      if (this.previousDisplay.length === world.cheatEngine.display.length) {
        let deltaCount = 0;
        const deltas = [];
        for (let i = 0; i < this.previousDisplay.length; i++) {
          if (this.previousDisplay[i] !== world.cheatEngine.display[i]) {
            deltas.push(`(${i % 64}, ${Math.floor(i / 64)})`);
            deltaCount++;
          }
        }
        if (deltaCount > 0) {
          const lastEvent = world.history && world.history.length > 0 ? world.history[world.history.length - 1] as any : null;
          const actionLog = lastEvent?.actions?.map((a: any) => JSON.stringify(a)).join(", ") ?? "Unknown";
          this.visualDeltaLog.push(`Action: ${actionLog} -> Changed ${deltaCount} pixels at: ${deltas.slice(0, 10).join(', ')}${deltaCount > 10 ? '...' : ''}`);
          if (this.visualDeltaLog.length > 10) this.visualDeltaLog.shift(); // keep last 10
        }
      }
      this.previousDisplay = [...world.cheatEngine.display];
    }

    // [Causal Orbit Detection]
    // If the world has an attached CheatEngine emulator frame, we hash the Playable Quote footprint
    if (world.cheatEngine && world.cheatEngine.memorySectors.length > 0 && world.cheatEngine.causalMask && world.cheatEngine.display) {
      const { detectCausalSignature } = await import("./signature-detector");
      const { renderDisplay } = await import("../chip8/chip8");
      let fs: any = null;
      let path: any = null;
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        try {
          const fsName = "fs";
          const pathName = "path";
          fs = await import(/* @vite-ignore */ fsName);
          path = await import(/* @vite-ignore */ pathName);
        } catch(e) {}
      }

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
        if (this.llmTuningEnabled && activePilot && this.wormSociety.length > 0) {
          console.log(`[SwarmController] LLM Outer Loop: Analyzing C. elegans performance and tuning hyperparameters...`);
          try {
            const deltaContext = this.visualDeltaLog.length > 0 ? `Recent Visual Deltas:\n${this.visualDeltaLog.join('\\n')}` : `No visual deltas yet.`;
            const prompt = `The C. elegans worm Pilot has successfully shifted the CHIP-8 causal orbit from ${prevSig} to ${sig}.
You are optimizing the biological controller AND the environment (Cheat Engine). 
${deltaContext}

Available tools:
- {"tool": "setWormCouplingGain", "args": {"gain": 1.5}}
- {"tool": "freezeMemory", "args": {"address": 512, "value": 255}}
- {"tool": "unfreezeMemory", "args": {"address": 512}}
- {"tool": "injectCode", "args": {"address": 512, "hex": "1220"}}
Output a JSON array of tool calls you wish to execute. Example: [{"tool": "setWormCouplingGain", "args": {"gain": 1.2}}, {"tool": "freezeMemory", "args": {"address": 512, "value": 255}}]`;
            const completion = await activePilot.backend.complete({ messages: [{ role: "user", content: prompt }] });
            if (completion.ok) {
              const raw = completion.result.content.replace(/^```json/, "").replace(/```$/, "").trim();
              try {
                const parsed = JSON.parse(raw);
                console.log(`[SwarmController] LLM Tuning Output:`, parsed);
                if (Array.isArray(parsed)) {
                  outerLoopActions = parsed;
                }
              } catch (e) {
                // ignore LLM json parse errors on outer loop for now
              }
            }
          } catch(e) {
            console.error(`[SwarmController] LLM Tuning failed:`, e);
          }
        }

        // Persist signature to known-signatures.json
        let known: string[] = [];
        if (fs && typeof fs !== 'undefined' && fs.readFileSync && fs.writeFileSync && typeof __dirname !== 'undefined') {
          const sigFile = path.join(__dirname, "known-signatures.json");
          known = readKnownSignatures(
            (filePath) => fs.readFileSync(filePath, "utf-8"),
            sigFile,
          );
          if (!known.includes(sig)) {
            known.push(sig);
            fs.writeFileSync(sigFile, JSON.stringify(known, null, 2));
            console.log(`[SwarmController] 💾 Saved new signature ${sig} to known-signatures.json`);
          }
        } else if (typeof localStorage !== 'undefined') {
          const stored = localStorage.getItem("zeta_known_signatures");
          known = stored ? JSON.parse(stored) : [];
          if (!known.includes(sig)) {
            known.push(sig);
            localStorage.setItem("zeta_known_signatures", JSON.stringify(known));
            console.log(`[SwarmController] 💾 Saved new signature ${sig} to localStorage`);
          }
        }
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
            const connectome = loadFromCsv();
            // Instantiate 5 worms cooperating
            for (let i = 0; i < 5; i++) {
              this.wormSociety.push(new CelegansController(connectome, BigInt(1337 + i)));
            }
          }
          if (!this.bnnSociety) {
            console.log("[SwarmController] Initializing Society of BNN Key Predictors for CHIP-8 (Inner Loop)...");
            this.bnnSociety = new BnnSocietyPredictor(3);
            if (this.pendingGamePriors) {
              this.bnnSociety.importSnapshot(this.pendingGamePriors);
              console.log(`[SwarmController] 🧠 Restored game priors (${this.pendingGamePriors.exploreTicksDone} explore ticks pre-spent).`);
            }
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
          
          // BNN Key Predictor computes its consensus separately. The key we
          // committed LAST tick closes the action→perception loop: it is how
          // the predictor learns which on-screen object answers to the keys.
          let bnnPredictions = this.bnnSociety.predict(world.cheatEngine!.display!, this.lastChosenKey);
          
          if (this.arcExplorer && this.arcExplorer.tick()) {
            // Override with pure uniform exploration if in exploration phase
            bnnPredictions = this.arcExplorer.explore();
          }
          
          // If BNN is highly uncertain (max prob < 0.2), scarcity is high!
          // (The argmax key itself is no longer read here — the committed key
          // comes from posterior sampling below, not from a thresholded peak.)
          let maxProb = -1;
          for (const prob of Object.values(bnnPredictions)) {
            if (prob > maxProb) maxProb = prob;
          }
          this.scarcity = maxProb < 0.2 ? 0.9 : 0.4;
          
          // Tri-Boolean Cooperation: Superorganism Tower Formation (Perez & Ding 2025)
          const cooperativeThreshold = 0.15; // Requires some signal to commit to the collective
          
          let towerCount = 0;
          let towerKey = -1;
          
          for (const worm of this.wormSociety) {
            // Integrate-as-Choice Locus & Food Scarcity Trigger
            const result = worm.tickWithSuperorganism(
              displayMap, 
              this.scarcity, 
              this.pheromoneField, 
              cooperativeThreshold
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
          let wormConsensusKey = towerCount >= 2 ? towerKey : -1;
          
          
          // Fusion policy: POSTERIOR SAMPLING, not an absolute confidence gate.
          //
          // This line used to read `maxProb > 0.4 ? bestBnnKey : wormConsensusKey`.
          // Measured 2026-08-24: the consensus over 17 keys peaks at 0.3818
          // (p50 0.3433), so that gate was crossed 0 times in 900 ticks and the
          // agent committed NOTHING once its 300-tick explorer expired — the
          // "buttons go random for a while, then it stops moving" report. See
          // `thompsonKeyOf` for why the fix deletes the constant instead of
          // lowering it. The worm tower stays as the tie-break for when the
          // distribution is degenerate and sampling names nothing.
          const sampledKey = thompsonKeyOf(bnnPredictions, () => this.bnnSociety!.gaussianDraw());
          const chosenKey = sampledKey >= 0 ? sampledKey : wormConsensusKey;
          this.lastChosenKey = chosenKey >= 0 ? chosenKey : undefined;

          if (chosenAction.kind === "do_item") {
            chosenAction.actions = [
              ...(chosenAction.actions || []),
              {"tool": "pressKey", "args": {"key": chosenKey}}
            ];
          }

          // The forced-perception readout: boxes, roles, mode, OCR — so the
          // page can SHOW what the agent sees instead of asking for trust.
          const bnn = this.bnnSociety;
          const arenaTracks: ArenaTrackReadout[] = bnn.lastPerception.tracks.map((t) => ({
            id: t.id,
            color: t.color,
            minX: Math.round(t.minX),
            minY: Math.round(t.minY),
            maxX: Math.round(t.maxX),
            maxY: Math.round(t.maxY),
            isStatic: t.isStatic,
            everMoved: t.everMoved,
            role:
              t.id === bnn.lastSelfId
                ? "self"
                : t.id === bnn.lastAdversaryId
                  ? "adversary"
                  : t.isStatic && !t.everMoved
                    ? "scenery"
                    : "object",
          }));
          const arena: ArenaReadout = {
            mode: bnn.lastMode,
            tracks: arenaTracks,
            ocr: bnn.lastOcr.map((n) => ({ value: n.value, row: n.row, col: n.col, color: n.color })),
            desired: bnn.lastDesired ? { dx: bnn.lastDesired.dx, dy: bnn.lastDesired.dy } : null,
          };

          // D1-D4 (#14503): the attention field, fixation, meter and measured
          // society-rho ride the same readout as the frame they label.
          const fieldReadout = bnn.attentionField.readout();
          const attention: AttentionReadoutWire = {
            cols: fieldReadout.cols,
            rows: fieldReadout.rows,
            variance: fieldReadout.variance,
            mean: fieldReadout.mean,
            attended: bnn.lastAttendedTiles,
            fixation: bnn.lastFixationTile,
            usefulWork: bnn.lastUsefulWork,
            rho: bnn.societyRho(),
            topK: ATTENTION_TOP_K,
          };

          // D5 (#14503): the WHY chain's input — the deciding state itself,
          // assembled by the predictor so the UI's answers cite the numbers
          // that actually drove this tick.
          const why = bnn.whyContext();

          const nextWorld = simulate(world, chosenAction);
          // Attach BNN predictions and the chosen key to cheatEngine so TV can render them
          return {
            ...nextWorld,
            cheatEngine: {
              ...nextWorld.cheatEngine!,
              keyPredictions: bnnPredictions,
              chosenKey: chosenKey,
              arena,
              attention,
              why
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
            const raw = completion.result.content.replace(/^```json/, "").replace(/```$/, "").trim();
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
  main().then((code) => {
    process.exit(code);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
