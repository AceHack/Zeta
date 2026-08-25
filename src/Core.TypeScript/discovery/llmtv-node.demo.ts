// llmtv-node.demo — make it live. Three nodes on one UDP multicast group, each announcing
// itself and broadcasting its LLMTV mind; every node folds the others into a live society
// grid that drains to replay JSON + zero-JS HTML on a readout cadence (shadow*).
//
// Run:
//   bun src/Core.TypeScript/discovery/llmtv-node.demo.ts [seconds] [out.html] [out.replay.json]
//   bun src/Core.TypeScript/discovery/llmtv-node.demo.ts [seconds] --root-site <dir>
//
// This is the physical proof of "the whole society broadcasts at once, over the mesh":
// three independent sources, one socket group, no central broadcaster — the tiles populate
// from packets on the wire. Reticulum is the next transport into the same port; UDP
// multicast is the first. Nothing is committed by this script; it writes to the path you
// give (default: a scratch file it prints).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { LlmtvNodeConfig } from "./llmtv-node";
import { createUdpMeshTransport, systemScheduler } from "./udp-transport";
import type { SourceMind } from "./llmtv-broadcast";
import { createLlmtvLiveReplayBridge } from "./llmtv-live-replay-bridge";
import { createLlmtvLiveReadout } from "./llmtv-live-readout";
import { createRootSiteLlmtvLiveReadout, rootSiteLlmtvPaths } from "./llmtv-root-site-readout";

import { earnThenFrostOrThrow } from "../ledger/privacy-budget";

// Frost is EARNED now, not asserted: `SourceMind.personal.frost` takes a `FrostReceipt`, and the
// only way to get one is to have a peer attest value and then spend it. A `frosted: true` literal
// no longer typechecks. See src/Core.TypeScript/ledger/privacy-budget.ts.
const frostReceiptFor = (region: string) =>
  earnThenFrostOrThrow({
    owner: `owner-of-${region}`,
    attestor: `peer-of-${region}`,
    earn: 100,
    cost: 10,
    region,
    witness: "fixture: a peer attested that the owner added value",
  });

const GROUP = "239.255.42.99";
const PORT = 42099;

function takeRootSiteArg(argv: string[]): string | undefined {
  const index = argv.indexOf("--root-site");
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("-")) {
    throw new Error("--root-site requires a directory");
  }
  argv.splice(index, 2);
  return value;
}

function writeText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf-8");
}

const args = process.argv.slice(2);
const rootSiteDir = takeRootSiteArg(args);
const rootSitePaths = rootSiteDir === undefined ? undefined : rootSiteLlmtvPaths(rootSiteDir);
const seconds = Number(args[0] ?? "6");
const outPath = rootSitePaths?.htmlPath ?? args[1] ?? "/tmp/llmtv-live.html";
const replayPath = rootSitePaths?.replayPath ?? args[2] ?? `${outPath}.replay.json`;

const minds: Record<string, () => SourceMind> = {
  alexa: () => ({
    role: "coding · qwen3-coder",
    hat: "coder hat",
    required: [
      { label: "next tick lands green", temp: "hot", valueMilli: 820, epsilonMilli: 120 },
      { label: "PR merges before horizon", temp: "warm", valueMilli: 640, epsilonMilli: 200 },
    ],
    personal: {
      frost: frostReceiptFor("node-demo"),
      veilLabel: "what it is really hoping for",
      predictions: [{ label: "PRIVATE", temp: "warm", valueMilli: 500, epsilonMilli: 300 }],
    },
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
    personal: {
      frost: frostReceiptFor("node-demo"),
      veilLabel: "the doubt it does not say aloud",
      predictions: [{ label: "PRIVATE", temp: "warm", valueMilli: 400, epsilonMilli: 250 }],
    },
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
  phaseClock: { seed: "S4", source: "llmtv-node.demo" },
});

const sched = systemScheduler();
const nodes = Object.keys(minds).map((name) => {
  const transport = createUdpMeshTransport({ group: GROUP, port: PORT }, () => {
    // eslint-disable-next-line no-console
    console.log(`[${name}] joined ${GROUP}:${PORT}`);
  });
  const bridge = createLlmtvLiveReplayBridge(nodeConfig(name), transport, transport, sched);
  return { name, bridge, transport };
});

// Any node's live grid is the whole society; drain node[0]'s captured wires on a cadence
// into replay JSON, then render that artifact to the zero-JS page.
const watcher = nodes[0]!;
const readout =
  rootSiteDir === undefined
    ? createLlmtvLiveReadout(
        watcher.bridge,
        sched,
        { writeText },
        {
          seed: "S4",
          readoutEveryMs: 1_000,
          replayPath,
          htmlPath: outPath,
          title: "Zeta — LLMTV (LIVE over the mesh)",
        },
      )
    : createRootSiteLlmtvLiveReadout(
        watcher.bridge,
        sched,
        { writeText },
        {
          rootDir: rootSiteDir,
          seed: "S4",
          readoutEveryMs: 1_000,
          title: "Zeta — LLMTV (LIVE over the mesh)",
        },
      );

for (const n of nodes) n.bridge.node.start();
readout.start();
// eslint-disable-next-line no-console
console.log(`three nodes live on ${GROUP}:${PORT} for ${seconds}s — watching from ${watcher.name}`);
// eslint-disable-next-line no-console
console.log(`readout cadence: ${replayPath} → ${outPath}`);

setTimeout(() => {
  const final = readout.flushNow();
  readout.stop();
  for (const n of nodes) {
    n.bridge.node.stop();
    n.transport.close();
  }
  // eslint-disable-next-line no-console
  console.log(
    final.ok && !final.skipped
      ? `done — final replay frames=${final.summary.frames} dwellers=${final.summary.dwellers} written to ${replayPath} and ${outPath}`
      : `done — no final replay frame; latest readout remains at ${outPath}`,
  );
  process.exit(0);
}, seconds * 1000);
