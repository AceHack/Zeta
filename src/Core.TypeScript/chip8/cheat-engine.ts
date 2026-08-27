import type { Frame } from "./chip8";
import {
  meterCrossingRange,
  meterCrossings,
  type ChannelGrant,
  type ChannelGrantFeedback,
  type ChannelMeterSnapshot,
} from "./channel-grant";

export interface CheatTable {
  readonly frozenAddresses: Map<number, number>;
}

export type CheatEngineFeedbackCode = "invalid-address" | "invalid-byte-value" | "invalid-hex";

export interface CheatEngineFeedback {
  readonly code: CheatEngineFeedbackCode;
  readonly detail: string;
}

export type CheatEngineResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: CheatEngineFeedback | ChannelGrantFeedback };

export interface RamRead {
  readonly byte: number;
  readonly meter: ChannelMeterSnapshot;
}

export interface RamRangeRead {
  readonly bytes: Uint8Array;
  readonly meter: ChannelMeterSnapshot;
}

export interface CodeInjectionReceipt {
  readonly bytesWritten: number;
  readonly meter: ChannelMeterSnapshot;
}

const MAX_ADDRESS = 0xfff;

const fail = <T>(code: CheatEngineFeedbackCode, detail: string): CheatEngineResult<T> => ({
  ok: false,
  feedback: { code, detail },
});

function validAddress(address: number): boolean {
  return Number.isInteger(address) && address >= 0 && address <= MAX_ADDRESS;
}

export function createCheatTable(): CheatTable {
  return { frozenAddresses: new Map() };
}

/** Apply every freeze only after the complete write set is admitted and counted. */
export function applyCheatTable(
  grant: ChannelGrant,
  frame: Frame,
  table: CheatTable,
): CheatEngineResult<ChannelMeterSnapshot> {
  const writes = [...table.frozenAddresses.entries()];
  for (const [address, value] of writes) {
    if (!validAddress(address)) return fail("invalid-address", String(address));
    if (!Number.isInteger(value) || !Number.isFinite(value)) {
      return fail("invalid-byte-value", `${String(address)}=${String(value)}`);
    }
  }

  const metered = meterCrossings(
    grant,
    writes.map(([address]) => ({ channel: "ram", direction: "write", address })),
  );
  if (!metered.ok) return metered;

  for (const [address, value] of writes) {
    frame.mem.set(address, value & 0xff);
    frame.causalMask[address] = true;
  }
  return metered;
}

/** The only typed path for a non-display memory read. */
export function readRam(grant: ChannelGrant, frame: Frame, address: number): CheatEngineResult<RamRead> {
  if (!validAddress(address)) return fail("invalid-address", String(address));
  const metered = meterCrossings(grant, [{ channel: "ram", direction: "read", address }]);
  if (!metered.ok) return metered;
  return { ok: true, value: { byte: frame.mem.get(address) ?? 0, meter: metered.value } };
}

/** Batch form for an inclusive contiguous range; still counts one crossing per address. */
export function readRamRange(
  grant: ChannelGrant,
  frame: Frame,
  startAddress: number,
  endAddress: number,
): CheatEngineResult<RamRangeRead> {
  if (!validAddress(startAddress) || !validAddress(endAddress) || startAddress > endAddress) {
    return fail("invalid-address", `${String(startAddress)}-${String(endAddress)}`);
  }
  const metered = meterCrossingRange(grant, {
    channel: "ram",
    direction: "read",
    startAddress,
    endAddress,
  });
  if (!metered.ok) return metered;

  const bytes = new Uint8Array(endAddress - startAddress + 1);
  for (const [address, value] of frame.mem) {
    if (address >= startAddress && address <= endAddress) {
      bytes[address - startAddress] = value & 0xff;
    }
  }
  return { ok: true, value: { bytes, meter: metered.value } };
}

/** Inject raw hex only after every target byte is admitted and counted. */
export function injectCode(
  grant: ChannelGrant,
  frame: Frame,
  address: number,
  hexString: string,
): CheatEngineResult<CodeInjectionReceipt> {
  if (!validAddress(address)) return fail("invalid-address", String(address));
  let normalized = hexString.replace(/^0x/i, "");
  if (normalized.length === 0 || !/^[0-9a-f]+$/i.test(normalized)) {
    return fail("invalid-hex", hexString);
  }
  if (normalized.length % 2 !== 0) normalized = `0${normalized}`;

  const bytesWritten = normalized.length / 2;
  const endAddress = address + bytesWritten - 1;
  if (!validAddress(endAddress)) {
    return fail("invalid-address", `${String(address)}-${String(endAddress)}`);
  }

  const metered = meterCrossingRange(grant, {
    channel: "ram",
    direction: "write",
    startAddress: address,
    endAddress,
  });
  if (!metered.ok) return metered;

  for (let index = 0; index < bytesWritten; index += 1) {
    const target = address + index;
    const byte = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
    frame.mem.set(target, byte);
    frame.causalMask[target] = true;
  }
  return { ok: true, value: { bytesWritten, meter: metered.value } };
}
