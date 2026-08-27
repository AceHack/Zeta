import { describe, expect, it } from "bun:test";

import {
  channelLabelFor,
  channelMeterSnapshot,
  createChannelGrantHarness,
  createChannelSet,
  issueChip8ChannelGrant,
  meterCrossingRange,
  meterCrossings,
  type ChannelGrant,
  type ChannelGrantResult,
  type ChannelSet,
} from "./channel-grant";
import type { RunChannelLabel, RunKey } from "../chip9/chip8-cross-run-store";

function value<T>(result: ChannelGrantResult<T>): T {
  if (!result.ok) throw new Error(`${result.feedback.code}:${result.feedback.detail}`);
  return result.value;
}

function apparatus(): ChannelSet {
  return value(
    createChannelSet([
      { channel: "ram", direction: "write", startAddress: 0x300, endAddress: 0x3ff },
      { channel: "ram", direction: "read", startAddress: 0x200, endAddress: 0xfff },
    ]),
  );
}

function runKey(channelLabel: RunChannelLabel): RunKey {
  return {
    romSha256: "1".repeat(64),
    seedHex: "0000000000000004",
    loadAddrHex: "0200",
    dialect: "chip8",
    channelLabel,
    stepMapVersion: "chip8cow-step-v1",
  };
}

function grant(): ChannelGrant {
  const channels = apparatus();
  const label = value(channelLabelFor(channels));
  const harness = value(createChannelGrantHarness("arc-harness"));
  return value(harness.issue(runKey(label), channels));
}

describe("ChannelGrant", () => {
  it("canonicalizes the complete apparatus independently of declaration order", () => {
    const first = apparatus();
    const second = value(createChannelSet([...first.channels].reverse()));
    expect(value(channelLabelFor(first))).toBe("assisted:ram-read@0200-0fff,ram-write@0300-03ff");
    expect(channelLabelFor(second)).toEqual(channelLabelFor(first));
  });

  it("refuses issuance when the run key hides the open channels", () => {
    const channels = apparatus();
    const result = value(createChannelGrantHarness("arc-harness")).issue(runKey("clean"), channels);
    expect(result).toMatchObject({
      ok: false,
      feedback: { code: "run-key-channel-mismatch" },
    });
  });

  it("refuses a structurally forged token at runtime", () => {
    const forged = {
      channels: apparatus(),
      issuedBy: "agent",
      runKey: runKey("clean"),
      channelLabel: "clean",
    } as unknown as ChannelGrant;
    expect(channelMeterSnapshot(forged)).toEqual({
      ok: false,
      feedback: {
        code: "invalid-channel-grant",
        detail: "grant was not issued by createChannelGrantHarness",
      },
    });
  });

  it("counts read and write crossings on separate rows", () => {
    const issued = grant();
    expect(
      meterCrossings(issued, [
        { channel: "ram", direction: "read", address: 0x200 },
        { channel: "ram", direction: "write", address: 0x300 },
      ]).ok,
    ).toBe(true);
    const snapshot = value(
      meterCrossingRange(issued, {
        channel: "ram",
        direction: "read",
        startAddress: 0x201,
        endAddress: 0x203,
      }),
    );
    expect(snapshot.issuedBy).toBe("arc-harness");
    expect(snapshot.runKey).toContain(`channel=${snapshot.channelLabel}`);
    expect(snapshot.rows).toEqual([
      {
        channel: "ram",
        direction: "read",
        startAddress: 0x200,
        endAddress: 0xfff,
        crossings: 4,
      },
      {
        channel: "ram",
        direction: "write",
        startAddress: 0x300,
        endAddress: 0x3ff,
        crossings: 1,
      },
    ]);
  });

  it("refuses an ungranted range atomically", () => {
    const issued = grant();
    const refused = meterCrossingRange(issued, {
      channel: "ram",
      direction: "write",
      startAddress: 0x3ff,
      endAddress: 0x400,
    });
    expect(refused).toMatchObject({
      ok: false,
      feedback: { code: "crossing-not-granted", detail: "ram:write@1024" },
    });
    expect(value(channelMeterSnapshot(issued)).rows[1]?.crossings).toBe(0);
  });

  it("rejects overlapping declarations so one crossing has one meter row", () => {
    expect(
      createChannelSet([
        { channel: "ram", direction: "read", startAddress: 0x200, endAddress: 0x300 },
        { channel: "ram", direction: "read", startAddress: 0x280, endAddress: 0x400 },
      ]),
    ).toMatchObject({
      ok: false,
      feedback: { code: "overlapping-channel-ranges" },
    });
  });

  it("the harness binds issuance to the exact ROM bytes", async () => {
    const issued = await issueChip8ChannelGrant("arc-harness", new Uint8Array([0x12, 0x00]), apparatus().channels, 4);
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issued.value.runKey.romSha256).toHaveLength(64);
    expect(issued.value.runKey.seedHex).toBe("0000000000000004");
    expect(issued.value.runKey.channelLabel).toBe("assisted:ram-read@0200-0fff,ram-write@0300-03ff");
  });
});
