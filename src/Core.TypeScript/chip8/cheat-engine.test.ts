import { describe, expect, it } from "bun:test";

import { create } from "./chip8";
import { applyCheatTable, createCheatTable, injectCode, readRam, readRamRange } from "./cheat-engine";
import {
  channelLabelFor,
  createChannelGrantHarness,
  createChannelSet,
  type ChannelGrant,
  type ChannelGrantResult,
} from "./channel-grant";
import type { RunKey } from "../chip9/chip8-cross-run-store";

function value<T>(result: ChannelGrantResult<T>): T {
  if (!result.ok) throw new Error(`${result.feedback.code}:${result.feedback.detail}`);
  return result.value;
}

function grant(
  specs = [
    { channel: "ram", direction: "read" as const, startAddress: 0, endAddress: 0xfff },
    { channel: "ram", direction: "write" as const, startAddress: 0, endAddress: 0xfff },
  ],
): ChannelGrant {
  const channels = value(createChannelSet(specs));
  const channelLabel = value(channelLabelFor(channels));
  const runKey: RunKey = {
    romSha256: "2".repeat(64),
    seedHex: "0000000000000004",
    loadAddrHex: "0200",
    dialect: "chip8",
    channelLabel,
    stepMapVersion: "chip8cow-step-v1",
  };
  return value(value(createChannelGrantHarness("cheat-engine-test")).issue(runKey, channels));
}

describe("metered CHIP-8 TAS membrane", () => {
  it("freezes memory and counts every write", () => {
    const frame = create();
    const table = createCheatTable();
    table.frozenAddresses.set(0x300, 0x1ff);
    table.frozenAddresses.set(0x301, 0x80);
    const result = applyCheatTable(grant(), frame, table);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(frame.mem.get(0x300)).toBe(0xff);
    expect(frame.causalMask[0x301]).toBe(true);
    expect(result.value.rows.find((row) => row.direction === "write")?.crossings).toBe(2);
  });

  it("an ungranted write refuses before any byte changes", () => {
    const frame = create();
    const original = frame.mem.get(0x300);
    const table = createCheatTable();
    table.frozenAddresses.set(0x300, 0xaa);
    const readOnly = grant([{ channel: "ram", direction: "read", startAddress: 0, endAddress: 0xfff }]);
    const result = applyCheatTable(readOnly, frame, table);
    expect(result).toMatchObject({
      ok: false,
      feedback: { code: "crossing-not-granted" },
    });
    expect(frame.mem.get(0x300)).toBe(original);
    expect(frame.causalMask[0x300]).toBe(false);
  });

  it("meters single and range reads independently from writes", () => {
    const frame = create();
    frame.mem.set(0x200, 0x12);
    frame.mem.set(0x201, 0x34);
    const issued = grant();
    expect(readRam(issued, frame, 0x200)).toMatchObject({ ok: true, value: { byte: 0x12 } });
    const range = readRamRange(issued, frame, 0x200, 0x201);
    expect(range.ok).toBe(true);
    if (!range.ok) return;
    expect([...range.value.bytes]).toEqual([0x12, 0x34]);
    expect(range.value.meter.rows.find((row) => row.direction === "read")?.crossings).toBe(3);
  });

  it("invalid or denied injection leaves both frame and meter untouched", () => {
    const frame = create();
    const issued = grant();
    expect(injectCode(issued, frame, 0x300, "not-hex")).toMatchObject({
      ok: false,
      feedback: { code: "invalid-hex" },
    });
    expect(frame.mem.has(0x300)).toBe(false);

    const denied = injectCode(issued, frame, 0xfff, "aabb");
    expect(denied).toMatchObject({ ok: false, feedback: { code: "invalid-address" } });
    expect(frame.mem.has(0xfff)).toBe(false);
  });

  it("injects odd-length hex deterministically and reports cumulative writes", () => {
    const frame = create();
    const issued = grant();
    const result = injectCode(issued, frame, 0x300, "abc");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([frame.mem.get(0x300), frame.mem.get(0x301)]).toEqual([0x0a, 0xbc]);
    expect(result.value.bytesWritten).toBe(2);
    expect(result.value.meter.rows.find((row) => row.direction === "write")?.crossings).toBe(2);
  });
});
