import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { renderLlmtvGrid } from "../darkhall-ui/darkhall-tv";
import { encode, publishFrame, toLlmtvTranscript, type SourceMind } from "./llmtv-broadcast";
import { decodeReplayArtifact, foldReplayArtifact } from "./llmtv-replay";
import { createReplayRecorder, type ReplayRecorderSnapshotOptions } from "./llmtv-replay-recorder";
import {
  createRootSiteLlmtvLiveReadout,
  rootSiteLlmtvPaths,
  ROOT_SITE_LLMTV_GENERATED_BY,
  ROOT_SITE_LLMTV_HTML_RELATIVE_PATH,
  ROOT_SITE_LLMTV_REPLAY_RELATIVE_PATH,
  ROOT_SITE_LLMTV_STATUS_RELATIVE_PATH,
  ROOT_SITE_LLMTV_TITLE,
} from "./llmtv-root-site-readout";
import { decodeRootSiteLlmtvStatus, rootSiteLlmtvStatusPath } from "./llmtv-root-site-status";
import type { LlmtvLiveReplayBridge } from "./llmtv-live-replay-bridge";
import type { LlmtvLiveReadoutIo } from "./llmtv-live-readout";
import type { LlmtvNodeHandle, Scheduler } from "./llmtv-node";

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

function sourceMind(label: string): SourceMind {
  return {
    role: "root-site",
    hat: "viewer hat",
    required: [{ label, temp: "hot", valueMilli: 810, epsilonMilli: 120 }],
    personal: {
      frost: frostReceiptFor("root-site-readout"),
      veilLabel: "private root-site prior",
      predictions: [{ label: "SECRET", temp: "warm", valueMilli: 500, epsilonMilli: 300 }],
    },
  };
}

function inertNode(): LlmtvNodeHandle {
  return {
    start() {},
    stop() {},
    peers: () => new Map(),
    channels: () => new Map(),
    society: (seed) => toLlmtvTranscript(new Map(), seed),
    onUpdate() {},
  };
}

function bridgeWithOneFrame(nowMs = 1_000): LlmtvLiveReplayBridge {
  const recorder = createReplayRecorder(() => nowMs);
  recorder.record(
    encode(publishFrame({ zid: "zid-alexa", name: "alexa" }, 1, 41, sourceMind("root-site artifact lands"))),
    "fake-root-site-bus",
  );

  return {
    node: inertNode(),
    recorder,
    artifact: (options: ReplayRecorderSnapshotOptions) => recorder.artifact(options),
    encode: (options: ReplayRecorderSnapshotOptions) => recorder.encode(options),
    drain: (options: ReplayRecorderSnapshotOptions) => {
      const artifact = recorder.artifact(options);
      recorder.clear();
      return artifact;
    },
  };
}

function memoryIo(): { readonly io: LlmtvLiveReadoutIo; readonly writes: Map<string, string> } {
  const writes = new Map<string, string>();
  return {
    writes,
    io: {
      writeText: (path, text) => writes.set(path, text),
    },
  };
}

const scheduler: Scheduler = {
  now: () => 1_000,
  setInterval: () => () => {},
};

describe("LLMTV root-site readout contract", () => {
  it("names the same-origin replay and zero-JS page paths under the root site", () => {
    expect(rootSiteLlmtvPaths("/site")).toEqual({
      replayPath: join("/site", ...ROOT_SITE_LLMTV_REPLAY_RELATIVE_PATH.split("/")),
      htmlPath: join("/site", ...ROOT_SITE_LLMTV_HTML_RELATIVE_PATH.split("/")),
    });
    expect(rootSiteLlmtvStatusPath("/site")).toBe(join("/site", ...ROOT_SITE_LLMTV_STATUS_RELATIVE_PATH.split("/")));
  });

  it("writes the root-site replay artifact, status sidecar, and static LLMTV page through injected IO", () => {
    const bridge = bridgeWithOneFrame();
    const { io, writes } = memoryIo();
    const readout = createRootSiteLlmtvLiveReadout(bridge, scheduler, io, {
      rootDir: "/site",
      seed: "S4",
      readoutEveryMs: 1_000,
      expireTtlMs: 10_000,
    });

    const result = readout.flushNow();
    const paths = rootSiteLlmtvPaths("/site");
    const statusPath = rootSiteLlmtvStatusPath("/site");
    const replayText = writes.get(paths.replayPath);
    const html = writes.get(paths.htmlPath);
    const statusText = writes.get(statusPath);

    expect(result.ok).toBe(true);
    expect(replayText).toBeString();
    expect(statusText).toBeString();
    expect(html).toContain(`<title>${ROOT_SITE_LLMTV_TITLE}</title>`);
    expect(html).toContain('data-readout-status="live"');
    expect(html).toContain('data-phase-clock="zeta.darkhall.phase-clock.v1"');
    expect(html).toContain('data-phase="41"');
    expect(html).toContain("<b>skew</b>");
    expect(html).toContain('data-dweller="alexa"');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("SECRET");

    const replay = decodeReplayArtifact(replayText!);
    expect(replay).not.toBeNull();
    expect(replay!.generatedBy).toBe(ROOT_SITE_LLMTV_GENERATED_BY);
    const folded = foldReplayArtifact(replay!);
    expect(folded.transcript.phaseClock?.phase).toBe(41);
    expect(folded.transcript.dwellers.map((dweller) => dweller.name)).toEqual(["alexa"]);
    expect(decodeRootSiteLlmtvStatus(statusText!)).toMatchObject({
      channel: "live-mesh",
      generatedBy: ROOT_SITE_LLMTV_GENERATED_BY,
      replayPath: paths.replayPath,
      htmlPath: paths.htmlPath,
      status: "live",
      reason: "live",
      frames: 1,
      dwellers: 1,
      stats: { accepted: 1, rejected: 0, expired: 0 },
      phaseClock: {
        schema: "zeta.darkhall.phase-clock.v1",
        seed: "S4",
        phase: 41,
        skewBoundTicks: 0,
        travelers: 1,
      },
    });
    expect(bridge.recorder.frames()).toEqual([]);
  });

  it("allows explicit provenance and title while keeping the root-site paths fixed", () => {
    const { io, writes } = memoryIo();
    const readout = createRootSiteLlmtvLiveReadout(bridgeWithOneFrame(), scheduler, io, {
      rootDir: "/site",
      seed: "S4",
      readoutEveryMs: 1_000,
      generatedBy: "test-root-site-export",
      title: "Custom Root LLMTV",
    });

    readout.flushNow();
    const paths = rootSiteLlmtvPaths("/site");
    const replay = decodeReplayArtifact(writes.get(paths.replayPath)!);
    const html = writes.get(paths.htmlPath)!;

    expect(replay?.generatedBy).toBe("test-root-site-export");
    expect(renderLlmtvGrid(foldReplayArtifact(replay!).transcript)).toContain('data-dwellers="1"');
    expect(html).toContain("<title>Custom Root LLMTV</title>");
  });
});
