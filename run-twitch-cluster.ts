/**
 * run-twitch-cluster.ts
 * Launches the realtime server and 4 separate CHIP-8 Swarm AI nodes for the Twitch Multi-Stream demo.
 */
import { spawn } from "bun";

const PROCS: ReturnType<typeof spawn>[] = [];

async function main() {
  console.log("Starting Twitch AI Cluster...");

  // Start Realtime Server
  console.log("Starting Realtime Server on port 9876...");
  const server = spawn({
    cmd: ["bun", "src/Core.TypeScript/observe/realtime-server.ts"],
    stdout: "inherit",
    stderr: "inherit"
  });
  PROCS.push(server);

  // Give the server a moment to bind to the port
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Define agents
  const agents = ["Alpha", "Beta", "Gamma", "Delta"];

  for (const agent of agents) {
    console.log(`Spawning Agent ${agent}...`);
    const proc = spawn({
      cmd: ["bun", "src/Core.TypeScript/swarm/chip8-live-node.ts", agent],
      stdout: "inherit",
      stderr: "inherit"
    });
    PROCS.push(proc);
    
    // Stagger starts to avoid SQLite/API concurrency spikes
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log("Cluster is running. Press Ctrl+C to stop all nodes.");
}

process.on("SIGINT", () => {
  console.log("Killing cluster...");
  for (const proc of PROCS) {
    proc.kill();
  }
  process.exit(0);
});

main().catch(console.error);
