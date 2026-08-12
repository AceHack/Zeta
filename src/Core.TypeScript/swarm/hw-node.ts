import { parseArgs } from "node:util";
import { createUdpMeshTransport } from "../discovery/udp-transport";
import type { HwBeacon } from "../discovery/hardware-registry";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    role: { type: "string" },
    host: { type: "string" },
    model: { type: "string" },
  }
});

const role = values.role || "Pilot";
const host = values.host || "http://localhost:11434";
const model = values.model || "qwen2.5:72b";

console.log(`[HardwareNode] Starting Oracle for role: ${role}`);
console.log(`[HardwareNode] Host: ${host}`);
console.log(`[HardwareNode] Model: ${model}`);

const transport = createUdpMeshTransport({
  group: "239.255.42.99",
  port: 4000,
  loopback: true
}, () => {
  console.log(`[HardwareNode] Connected to UDP Mesh. Broadcasting heartbeats...`);
  
  setInterval(() => {
    const beacon: HwBeacon = {
      type: "hw_beacon",
      role,
      host,
      model,
      timestamp: Date.now()
    };
    transport.broadcast(JSON.stringify(beacon));
    process.stdout.write("."); // tick
  }, 2000);
});
