/* eslint-disable no-console */
// living-node.demo — the living node on the REAL wire (shadow*).
//
// Two living nodes on one UDP multicast group. They discover each other (beacon), then link a
// mind-region onto a shared subject and watch their CHSH S-readout climb from 2 (independent,
// the honored ground state) toward coordination — over real packets, no fake mesh. Then one
// EXITS (unlink) and both fall back to S=2, the always-reachable floor. A bounded spend rides
// the x402 envelope along the way. This is the physical proof that the composition
// (discovery + linked-clone + broadcast + x402) runs on a socket, not just in the test harness.
//
// Run:
//   bun src/Core.TypeScript/discovery/living-node.demo.ts [seconds]
//
// Nothing is committed by this script. It opens a udp4 multicast socket on 239.255.42.100:42100.

import type { LivingNodeConfig } from "./living-node";
import { createLivingNode } from "./living-node";
import { createUdpMeshTransport, systemScheduler } from "./udp-transport";
import type { SourceMind } from "./llmtv-broadcast";

const GROUP = "239.255.42.100"; // distinct group from the llmtv-node demo
const PORT = 42100;

const mind = (name: string): (() => SourceMind) => () => ({
  role: "living",
  hat: `${name} hat`,
  required: [{ label: `${name} holds 2√2`, temp: "warm", valueMilli: 800, epsilonMilli: 120 }],
});

const cfg = (name: string): LivingNodeConfig => ({
  self: { persona: name, surface: "living", instance: "0", node: "demo" },
  zid: `zid-${name}`,
  routes: [{ kind: "udp", addr: `${GROUP}:${PORT}#${name}` }],
  source: { zid: `zid-${name}`, name },
  mind: mind(name),
  ttlMs: 8_000,
  helloEveryMs: 1_000,
  publishEveryMs: 1_500,
  cloneMind: {
    zid: `zid-${name}`,
    entropyBudget: 1000,
    regions: [
      { regionId: "work", frosted: false },
      { regionId: "inner", frosted: true },
    ],
  },
  spendEnvelope: { id: `env-${name}`, capMicroUsd: 1_000_000, perCallMaxMicroUsd: 200_000, windowMs: 60_000, windowMaxMicroUsd: 500_000 },
  collapseThresholdMilli: 100,
  maxPauseMs: 60_000,
});

const seconds = Number(process.argv[2] ?? "7");
const sched = systemScheduler();

const nodes = ["aria", "boro"].map((name) => {
  const transport = createUdpMeshTransport({ group: GROUP, port: PORT }, () => console.log(`[${name}] joined ${GROUP}:${PORT}`));
  const node = createLivingNode(cfg(name), transport, sched);
  return { name, node, transport };
});
const [a, b] = nodes as [(typeof nodes)[number], (typeof nodes)[number]];

const show = (tag: string): void => {
  for (const n of nodes) {
    console.log(
      `  ${tag} [${n.name}] S=${n.node.sReadout().toFixed(2)} class=${n.node.correlationClass()} peers=${n.node.peers().size} links=${n.node.links().size}`,
    );
  }
};

for (const n of nodes) n.node.start();
console.log(`two living nodes live on ${GROUP}:${PORT} for ${seconds}s — S=2 is the enemy-but-friend ground state`);

// t2: discovered, independent (S=2). t2.5: both link the shared subject → coordination. t3.5:
// S has climbed. t4.5: A exits → both return to S=2. Plus a bounded spend on A at t3.
setTimeout(() => { console.log("— after discovery (independent, expect S=2):"); show("t2"); }, 2_000);
setTimeout(() => {
  const ra = a.node.linkRegion("work", "hive/build", 200);
  const rb = b.node.linkRegion("work", "hive/build", 200);
  console.log(`— both link hive/build (a.ok=${ra.ok} b.ok=${rb.ok}) → coordination announced on the wire`);
}, 2_500);
setTimeout(() => {
  const v = a.node.spend({ reqId: "s1", service: "bazaar/demo", amountMicroUsd: 150_000, atMs: sched.now() });
  console.log(`— A spends 0.15 within the envelope: ok=${v.ok} ledgerHead=${a.node.ledger().head?.slice(0, 8) ?? "none"}`);
}, 3_000);
setTimeout(() => { console.log("— coordinated (expect S climbs above 2):"); show("t3"); }, 3_500);
setTimeout(() => {
  a.node.unlinkRegion("work");
  console.log("— A exits (unlink is never deniable) → back toward S=2:");
}, 4_500);
setTimeout(() => { console.log("— after exit (expect both S=2):"); show("t5"); }, 5_500);

setTimeout(() => {
  for (const n of nodes) { n.node.stop(); n.transport.close(); }
  console.log("done — living nodes closed. real wire, real discovery, real 2√2.");
  process.exit(0);
}, seconds * 1000);
