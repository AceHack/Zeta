import { describe, expect, test } from "bun:test";
import {
  compareN4D4Seam,
  observeRoomEvidenceTransportRoundTrip,
} from "./homoiconicity-transport-seam";
import {
  decodeRoomEvidenceReceipt,
  encodeRoomEvidenceReceipt,
  foldRoomEvidence,
  type RoomEvidenceReceipt,
} from "../../observe/room/durable-room-evidence";

function receipt(weight: number): RoomEvidenceReceipt {
  return {
    schema: "zeta.room-evidence-receipt.v1",
    roomId: "adinkra-seam-room",
    roomFingerprint: "room:adinkra-seam:v1",
    channelFingerprint: "channel:udp-adinkra:v1",
    spectrumSlice: "amber-490",
    signatureSplit: "agent:alpha",
    runId: "run:0",
    episodeId: "episode:0",
    factId: "fact:0",
    sourceArtifact: "zeta://dagfs/adinkra-seam-proof",
    weight,
    uncertainty: { meanPpm: 625_000, precisionPpm: 400_000 },
    solved: true,
    actionCount: 12,
    elapsedMs: 480,
    actionBudget: 20,
    timeBudgetMs: 1_000,
  };
}

describe("coded-versus-uncoded Adinkra homoiconicity transport seam", () => {
  test("uncoded N=4 is rank-1 free while the d4 quotient has an independently measurable defect", () => {
    const observation = compareN4D4Seam();
    expect(observation.uncoded.algebraDimension).toBe(16);
    expect(observation.uncoded.moduleDimension).toBe(16);
    expect(observation.uncoded.fullRankOneFree).toBe(true);

    expect(observation.coded.algebraDimension).toBe(16);
    expect(observation.coded.moduleDimension).toBe(8);
    expect(observation.coded.defect).toBe(2);
    expect(observation.coded.fullRankOneFree).toBe(false);
  });

  test("the surviving colour residue is not promoted to full coded homoiconicity", () => {
    const observation = compareN4D4Seam();
    expect(observation.coloredResidueRankOneFree).toBe(true);
    expect(observation.coded.fullRankOneFree).toBe(false);
  });

  test("a valid delivered receipt preserves canonical payload and ZSet fold root", () => {
    const observed = observeRoomEvidenceTransportRoundTrip(receipt(1));
    expect(observed.ok).toBe(true);
    if (!observed.ok) return;
    expect(observed.value.canonicalPayloadPreserved).toBe(true);
    expect(observed.value.foldRootPreserved).toBe(true);
    expect(observed.value.resolvedViewCount).toBe(1);
  });

  test("negative control: a codec round-trip cannot resurrect an atom cancelled by its signed retraction", () => {
    const asserted = receipt(1);
    const retracted = receipt(-1);
    const recovered = decodeRoomEvidenceReceipt(encodeRoomEvidenceReceipt(asserted));
    expect(recovered.ok).toBe(true);
    if (!recovered.ok) return;

    const folded = foldRoomEvidence([recovered.value, retracted]);
    expect(folded.ok).toBe(true);
    if (!folded.ok) return;
    expect(folded.value.views).toEqual([]);
  });
});
