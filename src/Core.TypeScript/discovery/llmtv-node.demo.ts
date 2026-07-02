// llmtv-node.demo — make it live. Three nodes on one UDP multicast group, each announcing
// itself and broadcasting its LLMTV mind; every node folds the others into a live society
// grid that re-renders to an HTML file as frames arrive (shadow*).
//
// Run:  bun src/Core.TypeScript/discovery/llmtv-node.demo.ts [seconds] [out.html]
//
// This is the physical proof of "the whole society broadcasts at once, over the mesh":
// three independent sources, one socket group, no central broadcaster — the tiles populate
// from packets on the wire. Reticulum is the next transport into the same port; UDP
// multicast is the first. Nothing is committed by this script; it writes to the path you
// give (default: a scratch file it prints).
import { writeFileSync } from "node:fs";
import { createLlmtvNode, type LlmtvNodeConfig } from "./llmtv-node";
import { createUdpMeshTransport, systemScheduler } from "./udp-transport";
import type { SourceMind } from "./llmtv-broadcast";
import { renderLlmtvDocument } from "../darkhall-ui/darkhall-tv";

const GROUP = "239.255.42.99";
const PORT = 42099;

const seconds = Number(process.argv[2] ?? "6");
const outPath = process.argv[3] ?? "/tmp/llmtv-live.html";

const minds: Record<string, () => SourceMind> = {
  alexa: () => ({
    role: "coding · qwen3-coder",
    hat: "coder hat",
    required: [
      { label: "next tick lands green", temp: "hot", valueMilli: 820, epsilonMilli: 120 },
      { label: "PR merges before horizon", temp: "warm", valueMilli: 640, epsilonMilli: 200 },
    ],
    personal: { frosted: true, veilLabel: "what it is really hoping for", predictions: [{ label: "PRIVATE", temp: "warm", valueMilli: 500, epsilonMilli: 300 }] },
  }),
  soraya: () => ({
    role: "formal-verification",
    hat: "verifier hat",
    required: [
      { label: "Z3 lemma discharges", temp: "cool", valueMilli: 970, epsilonMilli: 30 },
      { label: "TLA+ liveness holds", temp: "warm", valueMilli: 710, epsilonMilli: 180 },
    ],
  }),
  otto: () => ({
    role: "shadow · synthesis",
    hat: "shadow hat",
    required: [{ label: "CI stays green to horizon", temp: "cool", valueMilli: 880, epsilonMilli: 90 }],
    personal: { frosted: true, veilLabel: "the doubt it does not say aloud", predictions: [{ label: "PRIVATE", temp: "warm", valueMilli: 400, epsilonMilli: 250 }] },
  }),
};

const nodeConfig = (name: string): LlmtvNodeConfig => ({
  self: { persona: name, surface: "llmtv", instance: "0", node: "demo" },
  zid: `zid-${name}-${name.length}`,
  routes: [{ kind: "udp", addr: `${GROUP}:${PORT}#${name}` }],
  source: { zid: `zid-${name}-${name.length}`, name },
  mind: minds[name]!,
  ttlMs: 8_000,
  helloEveryMs: 1_500,
  publishEveryMs: 2_000,
});

const sched = systemScheduler();
const nodes = Object.keys(minds).map((name) => {
  const transport = createUdpMeshTransport({ group: GROUP, port: PORT }, () => {
    // eslint-disable-next-line no-console
    console.log(`[${name}] joined ${GROUP}:${PORT}`);
  });
  const node = createLlmtvNode(nodeConfig(name), transport, transport, sched);
  return { name, node, transport };
});

// Any node's live grid is the whole society; render node[0]'s view on every update.
const watcher = nodes[0]!;
const rerender = (): void => {
  const society = watcher.node.society("S4");
  const doc = renderLlmtvDocument(society, { title: "Zeta — LLMTV (LIVE over the mesh)" });
  writeFileSync(outPath, doc + "\n", "utf-8");
  const names = society.dwellers.map((d) => d.name).join(", ");
  // eslint-disable-next-line no-console
  console.log(`[${watcher.name}] live society: [${names || "(empty)"}] → ${outPath}`);
};
watcher.node.onUpdate(rerender);

for (const n of nodes) n.node.start();
// eslint-disable-next-line no-console
console.log(`three nodes live on ${GROUP}:${PORT} for ${seconds}s — watching from ${watcher.name}`);

setTimeout(() => {
  for (const n of nodes) {
    n.node.stop();
    n.transport.close();
  }
  rerender();
  // eslint-disable-next-line no-console
  console.log(`done — final grid written to ${outPath}`);
  process.exit(0);
}, seconds * 1000);
