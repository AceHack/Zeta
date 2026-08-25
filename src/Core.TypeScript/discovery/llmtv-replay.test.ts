import { describe, expect, it } from "bun:test";
import { renderLlmtvGrid } from "../darkhall-ui/darkhall-tv";
import { HEAT_SIGNAL_TREATY_PATH, temperatureReadout, temperatureTreatyBundle } from "../darkhall-ui/heat";
import { publishFrame, type BroadcastSource, type SourceMind } from "./llmtv-broadcast";
import {
  REPLAY_SCHEMA,
  decodeReplayArtifact,
  encodeReplayArtifact,
  foldReplayArtifact,
  foldReplayFrames,
  renderReplayDocument,
  replayFrame,
  type ReplayArtifact,
} from "./llmtv-replay";

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

const alexa: BroadcastSource = { zid: "zid-alexa-0001", name: "alexa" };
const soraya: BroadcastSource = { zid: "zid-soraya-0002", name: "soraya" };

const alexaTemperatureTreaty = temperatureTreatyBundle({
  temperature: temperatureReadout({
    source: "replay/alexa",
    heatPpm: 111_000,
    uncertaintyPpm: 222_000,
    pressurePpm: 333_000,
    attentionPpm: 444_000,
  }),
});

const alexaMind: SourceMind = {
  role: "coding",
  hat: "coder hat",
  temperatureTreaty: alexaTemperatureTreaty,
  required: [{ label: "next tick lands green", temp: "hot", valueMilli: 820, epsilonMilli: 120 }],
  personal: {
    frost: frostReceiptFor("replay"),
    veilLabel: "private hope",
    predictions: [{ label: "SECRET private hope", temp: "warm", valueMilli: 700, epsilonMilli: 110 }],
  },
};

const sorayaMind: SourceMind = {
  role: "verification",
  hat: "verifier hat",
  required: [{ label: "Z3 lemma discharges", temp: "cool", valueMilli: 970, epsilonMilli: 30 }],
};

describe("LLMTV replay source -- pure fold from wire frames to transcript", () => {
  it("folds transport wire frames into the same transcript the generated page renders", () => {
    const result = foldReplayFrames(
      [
        replayFrame(publishFrame(soraya, 1, 10, sorayaMind), 1000, "fake-bus/soraya"),
        replayFrame(publishFrame(alexa, 1, 11, alexaMind), 1001, "fake-bus/alexa"),
      ],
      "S4",
    );

    expect(result.stats).toEqual({ accepted: 2, rejected: 0, expired: 0 });
    expect(result.transcript.generatedBy).toBe("llmtv-replay");
    expect(result.transcript.phaseClock).toEqual({
      schema: "zeta.darkhall.phase-clock.v1",
      source: "llmtv-broadcast",
      basis: "seed-phase",
      seed: "S4",
      phase: 11,
      skewBoundTicks: 1,
      appendOnly: true,
      travelers: 2,
    });
    expect(result.transcript.dwellers.map((dweller) => dweller.name)).toEqual(["alexa", "soraya"]);
    expect(result.transcript.dwellers.map((dweller) => dweller.phaseClock?.phase)).toEqual([11, 10]);
    expect(result.transcript.dwellers[0]?.frost?.veilLabel).toBe("private hope");
    expect(result.transcript.dwellers[0]?.temperatureTreaty).toEqual(alexaTemperatureTreaty);

    const html = renderLlmtvGrid(result.transcript);
    expect(html).toContain('data-dweller="alexa"');
    expect(html).toContain(`data-temperature-treaty="${HEAT_SIGNAL_TREATY_PATH}"`);
    expect(html).toContain("private hope");
    expect(html).not.toContain("SECRET private hope");
  });

  it("is deterministic under duplicate and out-of-order replay", () => {
    const alexa1 = replayFrame(publishFrame(alexa, 1, 1, alexaMind), 1000);
    const alexa2 = replayFrame(publishFrame(alexa, 2, 2, alexaMind), 1002);
    const soraya1 = replayFrame(publishFrame(soraya, 1, 3, sorayaMind), 1001);

    const inOrder = foldReplayFrames([alexa1, soraya1, alexa2], "S4").transcript;
    const shuffled = foldReplayFrames([alexa2, alexa1, soraya1, alexa2], "S4").transcript;

    expect(shuffled).toEqual(inOrder);
  });

  it("rejects malformed frames as cold telemetry instead of throwing", () => {
    const result = foldReplayFrames(
      [
        { receivedAtMs: 1000, wire: "not json" },
        { receivedAtMs: 1001, wire: JSON.stringify({ schema: "wrong", msg: { t: "frame" } }) },
        { receivedAtMs: 1002, wire: JSON.stringify({ schema: "zeta.llmtv.broadcast.v1", msg: { t: "frame" } }) },
        replayFrame(publishFrame(alexa, 1, 1, alexaMind), 1003),
      ],
      "S4",
      { generatedBy: "test-replay" },
    );

    expect(result.stats).toEqual({ accepted: 1, rejected: 3, expired: 0 });
    expect(result.transcript.generatedBy).toBe("test-replay");
    expect(result.transcript.dwellers).toHaveLength(1);
  });

  it("applies injected expiry without an ambient clock", () => {
    const artifact: ReplayArtifact = {
      schema: REPLAY_SCHEMA,
      seed: "S4",
      expire: { nowMs: 3000, ttlMs: 1000 },
      frames: [
        replayFrame(publishFrame(alexa, 1, 1, alexaMind), 1000),
        replayFrame(publishFrame(soraya, 1, 2, sorayaMind), 2500),
      ],
    };

    const result = foldReplayArtifact(artifact);

    expect(result.stats).toEqual({ accepted: 2, rejected: 0, expired: 1 });
    expect(result.transcript.dwellers.map((dweller) => dweller.name)).toEqual(["soraya"]);
  });

  it("round-trips the replay artifact and renders a zero-script document", () => {
    const artifact: ReplayArtifact = {
      schema: REPLAY_SCHEMA,
      seed: "S4",
      generatedBy: "fake-bus-recording",
      frames: [replayFrame(publishFrame(alexa, 1, 3341, alexaMind), 1000, "fake-bus/alexa")],
    };

    const decoded = decodeReplayArtifact(encodeReplayArtifact(artifact));

    expect(decoded).toEqual(artifact);
    expect(decodeReplayArtifact("not json")).toBeNull();
    expect(
      decodeReplayArtifact(JSON.stringify({ schema: REPLAY_SCHEMA, seed: "S4", frames: [{ wire: "x" }] })),
    ).toBeNull();

    const doc = renderReplayDocument(artifact);
    expect(doc).toContain('data-schema="zeta.darkhall.llmtv.v1"');
    expect(doc).toContain('data-phase-clock="zeta.darkhall.phase-clock.v1"');
    expect(doc).toContain('data-phase="3341"');
    expect(doc).toContain('data-dweller="alexa"');
    expect(doc).toContain('data-temperature-ppm="333000"');
    expect(doc).not.toContain("<script");
    expect(doc).not.toContain("SECRET private hope");
  });
});
