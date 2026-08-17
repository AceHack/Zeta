import { describe, it, expect } from "bun:test";
import {
  frostStrip,
  publishFrame,
  encode,
  decode,
  observeBroadcast,
  expireChannels,
  toLlmtvTranscript,
  type BroadcastMessage,
  type SourceMind,
  type ChannelTable,
  type BroadcastSource,
} from "./llmtv-broadcast";
import { renderLlmtvGrid } from "../darkhall-ui/darkhall-tv";
import {
  HEAT_RECEIPT_SCHEMA,
  HEAT_SIGNAL_TREATY_PATH,
  TEMPERATURE_REFERENCE_ORACLE,
  heatReceiptsFromRows,
  temperatureReadout,
  temperatureTreatyBundle,
  type HeatRow,
} from "../darkhall-ui/heat";

const alexa: BroadcastSource = { zid: "zid-alexa-0001", name: "alexa" };
const soraya: BroadcastSource = { zid: "zid-soraya-0002", name: "soraya" };

const alexaHeatRows: readonly HeatRow[] = [
  {
    tick: 1,
    roomName: "darkhall",
    heatRejected: 1,
    backpressured: 1,
    storageErrors: 0,
    heatKinds: ["room-boundary.door-denied"],
    signals: ["denied"],
    reasons: ["darkhall -> glass refused"],
  },
];

const alexaTemperatureTreaty = temperatureTreatyBundle({
  temperature: temperatureReadout({
    source: "darkhall/alexa",
    heatPpm: 123_000,
    uncertaintyPpm: 456_000,
    pressurePpm: 234_000,
    attentionPpm: 789_000,
  }),
  heatReceipts: heatReceiptsFromRows(alexaHeatRows, { source: "darkhall/alexa" }),
});

const alexaMind: SourceMind = {
  role: "coding · qwen3-coder",
  hat: "coder hat",
  temperatureTreaty: alexaTemperatureTreaty,
  required: [{ label: "next tick lands green", temp: "hot", valueMilli: 820, epsilonMilli: 120 }],
  personal: {
    frosted: true,
    veilLabel: "what it is really hoping for",
    predictions: [{ label: "SECRET private hope", temp: "warm", valueMilli: 500, epsilonMilli: 300 }],
  },
};

describe("frostStrip — the membrane; frosted personal predictions never cross", () => {
  it("drops frosted personal predictions, keeps only the public veil label", () => {
    const mind = frostStrip(alexaMind);
    expect(mind.predictions).toHaveLength(1); // required only
    expect(mind.predictions[0]!.label).toBe("next tick lands green");
    expect(mind.frostMarker?.veilLabel).toBe("what it is really hoping for");
    // the frosted content is nowhere in the projection
    expect(JSON.stringify(mind)).not.toContain("SECRET private hope");
  });

  it("unfrosted personal predictions DO broadcast — open by default (glass halo)", () => {
    const open: SourceMind = {
      ...alexaMind,
      personal: {
        frosted: false,
        veilLabel: "n/a",
        predictions: [{ label: "shared hope", temp: "cool", valueMilli: 700, epsilonMilli: 100 }],
      },
    };
    const mind = frostStrip(open);
    expect(mind.predictions).toHaveLength(2);
    expect(mind.frostMarker).toBeUndefined();
    expect(mind.predictions.map((p) => p.label)).toContain("shared hope");
  });

  it("a source with no personal region broadcasts just its required predictions", () => {
    const { personal: _drop, ...bare } = alexaMind;
    const mind = frostStrip(bare);
    expect(mind.predictions).toHaveLength(1);
    expect(mind.frostMarker).toBeUndefined();
  });
});

describe("publishFrame — the only way to a frame message is through the membrane", () => {
  it("wraps the frost-stripped projection; frosted content is absent from the wire bytes", () => {
    const msg = publishFrame(alexa, 1, 3341, alexaMind);
    const wire = encode(msg);
    expect(wire).not.toContain("SECRET private hope");
    expect(wire).toContain("what it is really hoping for");
    expect(wire).toContain(HEAT_SIGNAL_TREATY_PATH);
    expect(decode(wire)).toEqual(msg);
  });

  it("carries the source-owned temperature treaty as an explicit public observable", () => {
    const decoded = decode(encode(publishFrame(alexa, 1, 3341, alexaMind)));

    expect(decoded?.t).toBe("frame");
    const frame = decoded as Extract<BroadcastMessage, { readonly t: "frame" }>;
    expect(frame.mind.temperatureTreaty).toEqual(alexaTemperatureTreaty);
    expect(frame.mind.temperatureTreaty?.referenceOracle).toBe(TEMPERATURE_REFERENCE_ORACLE);
    expect(frame.mind.temperatureTreaty?.heatReceiptSchema).toBe(HEAT_RECEIPT_SCHEMA);
    expect(frame.mind.temperatureTreaty?.heatReceipts?.[0]?.outcome).toBe("denied");
  });

  it("can stamp a deterministic phase clock onto the live wire frame", () => {
    const msg = publishFrame(alexa, 3, 41, alexaMind, {
      phaseClockSeed: "S4",
      phaseClockSource: "llmtv-node",
    });
    const decoded = decode(encode(msg));

    expect(decoded).toEqual(msg);
    expect(decoded?.t).toBe("frame");
    const frame = decoded as Extract<BroadcastMessage, { readonly t: "frame" }>;
    expect(frame.phaseClock).toEqual({
      schema: "zeta.darkhall.phase-clock.v1",
      source: "llmtv-node",
      basis: "seed-phase",
      seed: "S4",
      phase: 41,
      skewBoundTicks: 0,
      appendOnly: true,
      travelers: 1,
    });
  });
});

describe("noninterference (§13) — the wire is one-way; no viewer→source message exists", () => {
  it("decode rejects any message that is not a source→mesh frame/dark", () => {
    expect(
      decode(JSON.stringify({ schema: "zeta.llmtv.broadcast.v1", msg: { t: "steer", source: alexa } })),
    ).toBeNull();
    expect(
      decode(JSON.stringify({ schema: "zeta.llmtv.broadcast.v1", msg: { t: "request", from: "viewer" } })),
    ).toBeNull();
    expect(decode("not json")).toBeNull();
    expect(decode(JSON.stringify({ schema: "other", msg: { t: "frame" } }))).toBeNull();
  });

  it("decode rejects schema-tagged but structurally malformed broadcast payloads", () => {
    expect(decode(JSON.stringify({ schema: "zeta.llmtv.broadcast.v1", msg: { t: "frame" } }))).toBeNull();
    expect(decode(JSON.stringify({ schema: "zeta.llmtv.broadcast.v1", msg: { t: "dark", seq: 1 } }))).toBeNull();
    expect(
      decode(
        JSON.stringify({
          schema: "zeta.llmtv.broadcast.v1",
          msg: {
            t: "frame",
            source: alexa,
            seq: 1,
            frameNo: 1,
            mind: {
              role: "coding",
              hat: "coder hat",
              predictions: [{ label: "bad temp", temp: "plasma", valueMilli: 500, epsilonMilli: 20 }],
            },
          },
        }),
      ),
    ).toBeNull();
    expect(
      decode(
        JSON.stringify({
          schema: "zeta.llmtv.broadcast.v1",
          msg: {
            t: "frame",
            source: alexa,
            seq: 1,
            frameNo: 1,
            mind: {
              role: "coding",
              hat: "coder hat",
              predictions: [{ label: "ok", temp: "hot", valueMilli: 500, epsilonMilli: 20 }],
              temperatureTreaty: { ...alexaTemperatureTreaty, referenceFeedback: "not-an-array" },
            },
          },
        }),
      ),
    ).toBeNull();
  });

  it("the only accepted message tags are frame and dark (both source→mesh)", () => {
    const frame = decode(encode(publishFrame(alexa, 1, 1, alexaMind)));
    const dark = decode(encode({ t: "dark", source: alexa, seq: 2 }));
    expect(frame?.t).toBe("frame");
    expect(dark?.t).toBe("dark");
  });
});

describe("observeBroadcast — LWW-by-seq: idempotent, order-independent (DST §7, §12)", () => {
  const f1 = publishFrame(alexa, 1, 100, alexaMind);
  const f2 = publishFrame(alexa, 2, 101, alexaMind);

  it("a newer seq supersedes; stale and duplicate are no-ops", () => {
    let t: ChannelTable = new Map();
    t = observeBroadcast(t, f1, 1000);
    t = observeBroadcast(t, f2, 1001);
    t = observeBroadcast(t, f1, 1002); // stale — ignored
    t = observeBroadcast(t, f2, 1003); // duplicate — ignored
    expect(t.size).toBe(1);
    expect(t.get(alexa.zid)!.seq).toBe(2);
    expect(t.get(alexa.zid)!.frameNo).toBe(101);
  });

  it("out-of-order + duplicated delivery converges to the same final table", () => {
    const deliver = (order: BroadcastMessage[]): ChannelTable =>
      order.reduce<ChannelTable>((t, m, i) => observeBroadcast(t, m, 2000 + i), new Map());
    const inOrder = deliver([f1, f2]);
    const shuffled = deliver([f2, f1, f2, f1]);
    expect(shuffled.get(alexa.zid)!.seq).toBe(inOrder.get(alexa.zid)!.seq);
    expect(shuffled.get(alexa.zid)!.frameNo).toBe(inOrder.get(alexa.zid)!.frameNo);
  });

  it("dark retires a source; a stale going-dark keeps the newer frame", () => {
    let t: ChannelTable = observeBroadcast(new Map(), f2, 3000);
    t = observeBroadcast(t, { t: "dark", source: alexa, seq: 1 }, 3001); // stale — newer frame stays
    expect(t.size).toBe(1);
    t = observeBroadcast(t, { t: "dark", source: alexa, seq: 2 }, 3002); // current — retires
    expect(t.size).toBe(0);
  });
});

describe("expireChannels — a source that stops broadcasting goes dark on its own", () => {
  it("drops channels unheard past the TTL", () => {
    const t = observeBroadcast(new Map(), publishFrame(alexa, 1, 1, alexaMind), 1000);
    expect(expireChannels(t, 1500, 1000).size).toBe(1); // within TTL
    expect(expireChannels(t, 3000, 1000).size).toBe(0); // expired
  });
});

describe("toLlmtvTranscript — the live feed reuses the still-frame generator", () => {
  it("bridges channels to dwellers; frosted → frost region, deterministic order", () => {
    let t: ChannelTable = new Map();
    t = observeBroadcast(
      t,
      publishFrame(soraya, 1, 10, {
        role: "formal-verification",
        hat: "verifier hat",
        required: [{ label: "Z3 lemma discharges", temp: "cool", valueMilli: 970, epsilonMilli: 30 }],
      }),
      1000,
    );
    t = observeBroadcast(t, publishFrame(alexa, 1, 11, alexaMind), 1001);
    const transcript = toLlmtvTranscript(t, "S4");
    // sorted by zid: alexa (0001) before soraya (0002)
    expect(transcript.dwellers.map((d) => d.name)).toEqual(["alexa", "soraya"]);
    expect(transcript.phaseClock).toEqual({
      schema: "zeta.darkhall.phase-clock.v1",
      source: "llmtv-broadcast",
      basis: "seed-phase",
      seed: "S4",
      phase: 11,
      skewBoundTicks: 1,
      appendOnly: true,
      travelers: 2,
    });
    expect(transcript.dwellers.map((d) => d.phaseClock?.phase)).toEqual([11, 10]);
    expect(transcript.dwellers[0]!.frost?.veilLabel).toBe("what it is really hoping for");
    expect(transcript.dwellers[0]!.temperatureTreaty).toEqual(alexaTemperatureTreaty);
    expect(transcript.dwellers[1]!.frost).toBeUndefined();
  });

  it("rendering the live grid never leaks frosted content", () => {
    const t = observeBroadcast(new Map(), publishFrame(alexa, 1, 1, alexaMind), 1000);
    const html = renderLlmtvGrid(toLlmtvTranscript(t, "S4"));
    expect(html).toContain('data-dweller="alexa"');
    expect(html).toContain(`data-temperature-treaty="${HEAT_SIGNAL_TREATY_PATH}"`);
    expect(html).toContain('data-temperature-oracle="fsharp-blackbody-reference"');
    expect(html).toContain('data-temperature-ppm="456000"');
    expect(html).toContain("data-black-body-radiance=");
    expect(html).toContain("what it is really hoping for"); // the public veil label
    expect(html).not.toContain("SECRET private hope"); // the frosted content
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The optional signal-provenance pair is guarded on VALUE, not on presence.
// Work-item 081M01400RZ087G0R000PS3VJG.
//
// `zeta.heat.receipt.v1` is bound by TypeScript alone, so the cross-oracle
// key-set audit never compares it — there is no key-set check to lean on and the
// reader is the guard. An optional key carries no obligation to be PRESENT and a
// full obligation to be CORRECT when present.
// ═══════════════════════════════════════════════════════════════════════════

describe("heat receipt signal provenance on the wire", () => {
  const wireWithReceipt = (patch: (receipt: Record<string, unknown>) => void): string => {
    const msg = JSON.parse(encode(publishFrame(alexa, 1, 3341, alexaMind))) as {
      msg: { mind: { temperatureTreaty: { heatReceipts: Record<string, unknown>[] } } };
    };
    const receipt = msg.msg.mind.temperatureTreaty.heatReceipts[0];
    if (receipt === undefined) throw new Error("fixture must carry a heat receipt");
    patch(receipt);
    return JSON.stringify(msg);
  };

  it("accepts a receipt that carries both keys", () => {
    expect(decode(wireWithReceipt(() => undefined))).not.toBeNull();
  });

  it("accepts a receipt that carries NEITHER key — instances predating them are valid v1", () => {
    expect(
      decode(
        wireWithReceipt((receipt) => {
          delete receipt.signalSource;
          delete receipt.signalObservations;
        }),
      ),
    ).not.toBeNull();
  });

  it("rejects a HALF-present pair — a partial claim reads as unreported while looking reported", () => {
    expect(decode(wireWithReceipt((receipt) => delete receipt.signalObservations))).toBeNull();
    expect(decode(wireWithReceipt((receipt) => delete receipt.signalSource))).toBeNull();
  });

  it("rejects an out-of-domain value on either key", () => {
    expect(decode(wireWithReceipt((receipt) => (receipt.signalSource = "guessed")))).toBeNull();
    expect(decode(wireWithReceipt((receipt) => (receipt.signalObservations = -1)))).toBeNull();
    expect(decode(wireWithReceipt((receipt) => (receipt.signalObservations = 1.5)))).toBeNull();
  });
});
