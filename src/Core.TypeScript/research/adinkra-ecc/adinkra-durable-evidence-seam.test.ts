import { describe, expect, test } from "bun:test";
import { InMemoryStoragePort, ZetaStorageCell } from "../../browser-node/zeta-storage-cell";
import {
  buildSenderBlock,
  encodePacket,
  LossyUdpChannel,
  PACKET_HEADER_BYTES,
} from "../../discovery/udp-lossy-transport";
import {
  AdinkraRoomEvidenceBridge,
  decodeRoomEvidenceDatagram,
  DurableRoomEvidenceLedger,
  encodeRoomEvidenceDatagram,
  foldRoomEvidence,
  ROOM_EVIDENCE_DATAGRAM_HEADER_BYTES,
  ROOM_EVIDENCE_RECEIPT_SCHEMA,
  type RoomEvidenceReceipt,
  type RoomEvidenceResult,
  type StoredRoomEvidence,
} from "../../observe/room/durable-room-evidence";
import {
  ADINKRA_844_AMBIGUOUS_WEIGHT4_MASKS,
  adinkra844ErasureCensus,
  classifyAdinkra844ErasureMask,
} from "./adinkra-durable-evidence-seam";

function receipt(weight: 1 | -1, overrides: Partial<RoomEvidenceReceipt> = {}): RoomEvidenceReceipt {
  return {
    schema: ROOM_EVIDENCE_RECEIPT_SCHEMA,
    roomId: "chip9-adinkra-room",
    roomFingerprint: "room:adinkra-root-seam:v1",
    channelFingerprint: "channel:udp-adinkra:v1",
    spectrumSlice: "rainbow:amber-490",
    signatureSplit: "split:agent-alpha",
    runId: "run:finite-census",
    episodeId: "episode:0",
    factId: "fact:0",
    sourceArtifact: "zeta://dagfs/adinkra-root-seam",
    weight,
    uncertainty: { meanPpm: 625_000, precisionPpm: 400_000 },
    solved: true,
    actionCount: 12,
    elapsedMs: 480,
    actionBudget: 20,
    timeBudgetMs: 1_000,
    ...overrides,
  };
}

function makeLedger(nodeId: string): DurableRoomEvidenceLedger {
  return new DurableRoomEvidenceLedger(new ZetaStorageCell({ primary: new InMemoryStoragePort(), nodeId }));
}

class TrackingLedger extends DurableRoomEvidenceLedger {
  private readonly pending: Array<Promise<RoomEvidenceResult<StoredRoomEvidence>>> = [];

  constructor(nodeId: string) {
    super(new ZetaStorageCell({ primary: new InMemoryStoragePort(), nodeId }));
  }

  override append(raw: RoomEvidenceReceipt): Promise<RoomEvidenceResult<StoredRoomEvidence>> {
    const write = super.append(raw);
    this.pending.push(write);
    return write;
  }

  get appendCount(): number {
    return this.pending.length;
  }

  async settle(): Promise<void> {
    await Promise.all(this.pending);
  }
}

class CapturedTransport {
  readonly broadcasts: string[] = [];
  private receive: (text: string, from: string) => void = () => {};

  broadcast(text: string): void {
    this.broadcasts.push(text);
  }

  onMessage(handler: (text: string, from: string) => void): void {
    this.receive = handler;
  }

  deliver(text: string): void {
    this.receive(text, "sender");
  }
}

function dataFrames(transport: CapturedTransport): string[] {
  return transport.broadcasts.filter((text) => {
    const envelope = JSON.parse(text) as { type?: string };
    return envelope.type === "lossy-udp";
  });
}

async function captureFrames(receipts: readonly RoomEvidenceReceipt[]): Promise<string[]> {
  const transport = new CapturedTransport();
  const channel = new LossyUdpChannel(transport, "sender");
  const bridge = new AdinkraRoomEvidenceBridge(channel, makeLedger("seam-sender"));
  for (const value of receipts) {
    const stored = await bridge.send(value);
    expect(stored.ok).toBe(true);
  }
  bridge.flush();
  const frames = dataFrames(transport);
  expect(frames).toHaveLength(8);
  return frames;
}

function corruptWithoutUpdatingCrc(frame: string): string {
  const envelope = JSON.parse(frame) as { type: string; zid: string; pkt: string };
  const bytes = Buffer.from(envelope.pkt, "base64");
  bytes[PACKET_HEADER_BYTES] = bytes[PACKET_HEADER_BYTES]! ^ 0x01;
  return JSON.stringify({ ...envelope, pkt: bytes.toString("base64") });
}

async function deliver(
  frames: readonly string[],
  erasedMask = 0,
  corruptedMask = 0,
  order: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7],
): Promise<{ readonly ledger: TrackingLedger; readonly fold: ReturnType<DurableRoomEvidenceLedger["fold"]> }> {
  const transport = new CapturedTransport();
  const channel = new LossyUdpChannel(transport, "receiver");
  const ledger = new TrackingLedger(`seam-receiver-${erasedMask}-${corruptedMask}`);
  new AdinkraRoomEvidenceBridge(channel, ledger);
  for (const position of order) {
    if ((erasedMask & (1 << position)) !== 0) continue;
    const frame = frames[position]!;
    transport.deliver((corruptedMask & (1 << position)) !== 0 ? corruptWithoutUpdatingCrc(frame) : frame);
  }
  await ledger.settle();
  return { ledger, fold: ledger.fold() };
}

function rootOf(receipts: readonly RoomEvidenceReceipt[]): string {
  const folded = foldRoomEvidence(receipts);
  if (!folded.ok) throw new Error(folded.reason);
  return folded.value.root;
}

describe("Adinkra [8,4,4] durable room-evidence seam", () => {
  test("ADES-1: the independent finite model has the [1,8,28,56,56,0,...] identifiability census", () => {
    expect(ADINKRA_844_AMBIGUOUS_WEIGHT4_MASKS).toHaveLength(14);
    expect(new Set(ADINKRA_844_AMBIGUOUS_WEIGHT4_MASKS).size).toBe(14);
    expect(adinkra844ErasureCensus()).toEqual([
      "0: 1/1",
      "1: 8/8",
      "2: 28/28",
      "3: 56/56",
      "4: 56/70",
      "5: 0/56",
      "6: 0/28",
      "7: 0/8",
      "8: 0/1",
    ]);
    for (const mask of ADINKRA_844_AMBIGUOUS_WEIGHT4_MASKS) {
      expect(classifyAdinkra844ErasureMask(mask).status).toBe("ambiguous-codeword-support");
    }
    expect(() => classifyAdinkra844ErasureMask(-1)).toThrow(RangeError);
    expect(() => classifyAdinkra844ErasureMask(256)).toThrow(RangeError);
  });

  test("ADES-2 (exhaustive): every identifiable pattern preserves the exact durable root for both signs", async () => {
    const emptyRoot = rootOf([]);
    for (const weight of [1, -1] as const) {
      const value = receipt(weight);
      const expectedRoot = rootOf([value]);
      const frames = await captureFrames([value]);
      for (let mask = 0; mask < 256; mask++) {
        const classification = classifyAdinkra844ErasureMask(mask);
        const observed = await deliver(frames, mask);
        expect(observed.fold.ok).toBe(true);
        if (!observed.fold.ok) continue;
        if (classification.status === "identifiable") {
          expect(observed.ledger.appendCount).toBe(1);
          expect(observed.fold.value.root).toBe(expectedRoot);
        } else {
          expect(observed.ledger.appendCount).toBe(0);
          expect(observed.fold.value.root).toBe(emptyRoot);
          expect(observed.fold.value.root).not.toBe(expectedRoot);
        }
      }
    }
  });

  test("ADES-3: four unequal receipt lengths survive padding, parity-only first arrival, and reverse order", async () => {
    const values = [
      receipt(1, { factId: "f-a", sourceArtifact: "zeta://a" }),
      receipt(1, { factId: "fact-b-longer", sourceArtifact: "zeta://dagfs/a-much-longer-artifact-reference" }),
      receipt(-1, { factId: "f-c", spectrumSlice: "rainbow:cyan" }),
      receipt(1, { factId: "fact-d", signatureSplit: "split:agent-with-a-longer-local-name" }),
    ] as const;
    const frames = await captureFrames(values);
    const observed = await deliver(frames, 0, 0, [7, 6, 5, 4, 3, 2, 1, 0]);
    expect(observed.ledger.appendCount).toBe(4);
    expect(observed.fold.ok).toBe(true);
    if (observed.fold.ok) expect(observed.fold.value.root).toBe(rootOf(values));
  });

  test("ADES-4: duplicate and reordered frames deliver each semantic atom exactly once", async () => {
    const value = receipt(1);
    const frames = await captureFrames([value]);
    const transport = new CapturedTransport();
    const channel = new LossyUdpChannel(transport, "receiver");
    const ledger = new TrackingLedger("seam-duplicate-receiver");
    new AdinkraRoomEvidenceBridge(channel, ledger);
    for (const position of [3, 7, 1, 5, 0, 4, 2, 6, 6, 2, 4, 0, 5, 1, 7, 3]) transport.deliver(frames[position]!);
    await ledger.settle();
    expect(ledger.appendCount).toBe(1);
    const folded = ledger.fold();
    expect(folded.ok).toBe(true);
    if (folded.ok) expect(folded.value.root).toBe(rootOf([value]));
  });

  test("ADES-5: CRC-detected substitutions degrade to erasures inside the domain and refuse ambiguous patterns", async () => {
    const value = receipt(1);
    const frames = await captureFrames([value]);
    const oneCorrupt = await deliver(frames, 0, 1 << 0);
    expect(oneCorrupt.fold.ok).toBe(true);
    if (oneCorrupt.fold.ok) expect(oneCorrupt.fold.value.root).toBe(rootOf([value]));

    const ambiguousCorruption = ADINKRA_844_AMBIGUOUS_WEIGHT4_MASKS[0]!;
    const overBudget = await deliver(frames, 0, ambiguousCorruption);
    expect(overBudget.ledger.appendCount).toBe(0);
    expect(overBudget.fold.ok).toBe(true);
    if (overBudget.fold.ok) expect(overBudget.fold.value.root).toBe(rootOf([]));
  });

  test("ADES-6: CRC-valid semantic alterations are distinct evidence, not authenticated equality", async () => {
    const baseline = receipt(1);
    const changedUncertainty = receipt(1, { uncertainty: { meanPpm: 624_999, precisionPpm: 400_000 } });
    const changedIdentity = receipt(1, { spectrumSlice: "rainbow:violet", signatureSplit: "split:agent-beta" });
    for (const changed of [changedUncertainty, changedIdentity]) {
      const frames = await captureFrames([changed]);
      const observed = await deliver(frames);
      expect(observed.fold.ok).toBe(true);
      if (observed.fold.ok) {
        expect(observed.fold.value.root).toBe(rootOf([changed]));
        expect(observed.fold.value.root).not.toBe(rootOf([baseline]));
      }
    }
  });

  test("ADES-7: the length frame accepts zero padding but rejects truncation and non-zero suffixes", () => {
    const value = receipt(1);
    const framed = encodeRoomEvidenceDatagram(value);
    const padded = new Uint8Array(framed.length + 8);
    padded.set(framed);
    expect(decodeRoomEvidenceDatagram(padded)).toEqual({ ok: true, value });

    expect(decodeRoomEvidenceDatagram(framed.subarray(0, framed.length - 1))).toEqual({
      ok: false,
      reason: "receipt datagram is truncated",
    });
    padded[padded.length - 1] = 1;
    expect(decodeRoomEvidenceDatagram(padded)).toEqual({
      ok: false,
      reason: "receipt datagram has non-zero bytes after its declared payload",
    });
    expect(decodeRoomEvidenceDatagram(new Uint8Array(ROOM_EVIDENCE_DATAGRAM_HEADER_BYTES))).toEqual({
      ok: false,
      reason: "receipt datagram payload length must be positive",
    });
  });

  test("ADES-8 (anti-self-certifying): an ambiguous support admits two distinct messages with identical survivors", () => {
    const data = [
      Uint8Array.from([0x10, 0x20]),
      Uint8Array.from([0x30, 0x40]),
      Uint8Array.from([0x50, 0x60]),
      Uint8Array.from([0x70, 0x80]),
    ];
    const original = buildSenderBlock(0, data);
    const originalWord = [...original.dataPackets, ...original.parityPackets];
    const alternativeData = data.map((symbol, index) => {
      const changed = new Uint8Array(symbol);
      if (index === 0) for (let byte = 0; byte < changed.length; byte++) changed[byte] = changed[byte]! ^ 0xff;
      return changed;
    });
    const alternative = buildSenderBlock(0, alternativeData);
    const alternativeWord = [...alternative.dataPackets, ...alternative.parityPackets];
    const ambiguousMask = ADINKRA_844_AMBIGUOUS_WEIGHT4_MASKS[0]!;
    expect(classifyAdinkra844ErasureMask(ambiguousMask).status).toBe("ambiguous-codeword-support");
    for (let position = 0; position < 8; position++) {
      if ((ambiguousMask & (1 << position)) !== 0) continue;
      expect(Array.from(alternativeWord[position]!)).toEqual(Array.from(originalWord[position]!));
    }
    expect(Array.from(alternativeWord[0]!)).not.toEqual(Array.from(originalWord[0]!));
  });

  test("ADES-9: the packet-level checksum control is exercised by a real encoded frame", () => {
    const symbol = encodeRoomEvidenceDatagram(receipt(1));
    const packet = encodePacket({ seq: 0, blockSeq: 0, blockPos: 0, isData: true, payloadLen: symbol.length }, symbol);
    expect(packet.length).toBeGreaterThan(PACKET_HEADER_BYTES + ROOM_EVIDENCE_DATAGRAM_HEADER_BYTES);
  });
});
