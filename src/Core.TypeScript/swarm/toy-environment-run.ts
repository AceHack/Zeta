import { createLevel, mapToyToMemory } from "./toy-environment";
import { runLoop, classify } from "../observe/observe";
import type { World } from "../observe/observe";
import { ollamaBackend } from "../accelerator/local-llm";
async function main() {
  const layout = [
    "#####",
    "#P .#",
    "#. T#",
    "#####"
  ];
  let toyState = createLevel(5, 4, layout);

  console.log("Initial Toy Environment State:");
  console.log(layout.join("\n"));
  
  // Set up world with the Pilot hat instruction injected into the backlog 
  // (In a real run, this would be passed through the chooser directly)
  const initialWorld: World = {
    backlog: [{
      id: "toy-1",
      title: "Navigate the grid. You are the Pilot. Bias toward reading memory.",
      ready: true,
      ambiguous: false
    }],
    cheatEngine: {
      memorySectors: [mapToyToMemory(toyState)]
    }
  };

  const backend = ollamaBackend();
  
  // Check if Ollama is up
  try {
    await backend.complete("ok", { maxTokens: 1 });
  } catch {
    console.error(`[ERROR] ${backend.name} not reachable. Please start ollama + \`ollama pull qwen2.5:0.5b\` to run this test.`);
    process.exit(1);
  }

  console.log("\nStarting Swarm Loop with local Qwen backend...");
  
  // Run the loop for up to 10 steps
  const result = await runLoop(initialWorld, backend, 10);

  console.log("\n--- Trace ---");
  result.trace.forEach((action, idx) => {
    let label = classify(initialWorld, initialWorld, action); // mock before/after for logging
    console.log(`Step ${idx + 1}: ${action.kind} -> ${label}`);
  });

  console.log(`\nSteady State Reached: ${result.steadyState}`);
}

main().catch(console.error);
