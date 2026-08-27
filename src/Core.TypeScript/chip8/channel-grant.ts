import { assistedRunChannelLabel, keyText, type RunChannelLabel, type RunKey } from "../chip9/chip8-cross-run-store";

/**
 * Honest boundary: TypeScript cannot make the harness factory inaccessible to another module,
 * and in-process code can still touch `frame.mem` directly. The branded token plus WeakMap gives
 * the typed path a runtime refusal; process or WASM isolation is required for a stronger claim.
 */

export type ChannelDirection = "read" | "write";

export interface ChannelSpec {
  readonly channel: string;
  readonly direction: ChannelDirection;
  readonly startAddress: number;
  readonly endAddress: number;
}

export type ChannelGrantFeedbackCode =
  | "empty-channel-set"
  | "invalid-channel-name"
  | "invalid-channel-range"
  | "overlapping-channel-ranges"
  | "invalid-experimenter-id"
  | "invalid-channel-set"
  | "invalid-derived-channel-label"
  | "run-key-channel-mismatch"
  | "invalid-channel-grant"
  | "crossing-not-granted"
  | "crossing-count-overflow"
  | "run-key-digest-failed";

export interface ChannelGrantFeedback {
  readonly code: ChannelGrantFeedbackCode;
  readonly detail: string;
}

export type ChannelGrantResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: ChannelGrantFeedback };

const fail = <T>(code: ChannelGrantFeedbackCode, detail: string): ChannelGrantResult<T> => ({
  ok: false,
  feedback: { code, detail },
});

const channelSetBrand: unique symbol = Symbol("zeta.channel-set");
const grantBrand: unique symbol = Symbol("zeta.channel-grant");

export interface ChannelSet {
  readonly [channelSetBrand]: true;
  readonly channels: readonly ChannelSpec[];
}

export interface ChannelGrant {
  readonly [grantBrand]: true;
  readonly channels: ChannelSet;
  readonly issuedBy: string;
  readonly runKey: Readonly<RunKey>;
  readonly channelLabel: RunChannelLabel;
}

export interface ChannelCrossing {
  readonly channel: string;
  readonly direction: ChannelDirection;
  readonly address: number;
}

export interface ChannelMeterRow extends ChannelSpec {
  readonly crossings: number;
}

export interface ChannelMeterSnapshot {
  readonly channelLabel: RunChannelLabel;
  readonly issuedBy: string;
  readonly runKey: string;
  readonly rows: readonly ChannelMeterRow[];
}

export interface ChannelGrantHarness {
  readonly issuedBy: string;
  issue(runKey: RunKey, channels: ChannelSet): ChannelGrantResult<ChannelGrant>;
}

interface GrantState {
  readonly grant: ChannelGrant;
  readonly counts: Map<string, number>;
}

const issuedChannelSets = new WeakSet<object>();
const issuedGrants = new WeakMap<object, GrantState>();
const MAX_ADDRESS = 0xfff;

/** The complete apparatus used by the two live memory-observing CHIP-8 hosts. */
export const FULL_RAM_TAS_CHANNELS: readonly ChannelSpec[] = Object.freeze([
  Object.freeze({ channel: "ram", direction: "read", startAddress: 0, endAddress: MAX_ADDRESS }),
  Object.freeze({ channel: "ram", direction: "write", startAddress: 0, endAddress: MAX_ADDRESS }),
]);

function directionText(direction: ChannelDirection): string {
  return direction;
}

function canonicalSpec(spec: ChannelSpec): string {
  return `${spec.channel}-${directionText(spec.direction)}@${spec.startAddress.toString(16).padStart(4, "0")}-${spec.endAddress.toString(16).padStart(4, "0")}`;
}

function ordinal(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function rangesOverlap(left: ChannelSpec, right: ChannelSpec): boolean {
  return (
    left.channel === right.channel &&
    left.direction === right.direction &&
    left.startAddress <= right.endAddress &&
    right.startAddress <= left.endAddress
  );
}

function isChannelSet(value: ChannelSet): boolean {
  return issuedChannelSets.has(value);
}

export function createChannelSet(specs: readonly ChannelSpec[]): ChannelGrantResult<ChannelSet> {
  if (specs.length === 0) return fail("empty-channel-set", "at least one TAS channel is required");

  const channels = specs.map((spec) => ({ ...spec }));
  for (const spec of channels) {
    if (!/^[a-z][a-z0-9-]*$/.test(spec.channel)) {
      return fail("invalid-channel-name", spec.channel);
    }
    if (
      !Number.isInteger(spec.startAddress) ||
      !Number.isInteger(spec.endAddress) ||
      spec.startAddress < 0 ||
      spec.endAddress > MAX_ADDRESS ||
      spec.startAddress > spec.endAddress
    ) {
      return fail("invalid-channel-range", `${spec.channel}:${String(spec.startAddress)}-${String(spec.endAddress)}`);
    }
  }

  for (let left = 0; left < channels.length; left += 1) {
    for (let right = left + 1; right < channels.length; right += 1) {
      const a = channels[left];
      const b = channels[right];
      if (a !== undefined && b !== undefined && rangesOverlap(a, b)) {
        return fail("overlapping-channel-ranges", `${a.channel}:${a.direction}`);
      }
    }
  }

  channels.sort((left, right) => ordinal(canonicalSpec(left), canonicalSpec(right)));
  channels.forEach(Object.freeze);
  const channelSet: ChannelSet = Object.freeze({
    [channelSetBrand]: true as const,
    channels: Object.freeze(channels),
  });
  issuedChannelSets.add(channelSet);
  return { ok: true, value: channelSet };
}

export function channelLabelFor(channels: ChannelSet): ChannelGrantResult<RunChannelLabel> {
  if (!isChannelSet(channels)) return fail("invalid-channel-set", "channel set was not created by createChannelSet");
  const label = assistedRunChannelLabel(channels.channels.map(canonicalSpec).join(","));
  return label.ok ? label : fail("invalid-derived-channel-label", `${label.feedback.code}:${label.feedback.detail}`);
}

function validExperimenterId(issuedBy: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(issuedBy);
}

export function createChannelGrantHarness(issuedBy: string): ChannelGrantResult<ChannelGrantHarness> {
  if (!validExperimenterId(issuedBy)) return fail("invalid-experimenter-id", issuedBy);

  return {
    ok: true,
    value: Object.freeze({
      issuedBy,
      issue(runKey: RunKey, channels: ChannelSet): ChannelGrantResult<ChannelGrant> {
        const label = channelLabelFor(channels);
        if (!label.ok) return label;
        if (runKey.channelLabel !== label.value) {
          return fail("run-key-channel-mismatch", `expected=${label.value};actual=${runKey.channelLabel}`);
        }

        const frozenRunKey = Object.freeze({ ...runKey });
        const grant: ChannelGrant = Object.freeze({
          [grantBrand]: true as const,
          channels,
          issuedBy,
          runKey: frozenRunKey,
          channelLabel: label.value,
        });
        issuedGrants.set(grant, {
          grant,
          counts: new Map(channels.channels.map((spec) => [canonicalSpec(spec), 0])),
        });
        return { ok: true, value: grant };
      },
    }),
  };
}

/** Source-owned harness edge: bind a grant to the exact ROM and apparatus before play begins. */
export async function issueChip8ChannelGrant(
  issuedBy: string,
  rom: Uint8Array,
  specs: readonly ChannelSpec[],
  seed: number,
): Promise<ChannelGrantResult<ChannelGrant>> {
  const channels = createChannelSet(specs);
  if (!channels.ok) return channels;
  const channelLabel = channelLabelFor(channels.value);
  if (!channelLabel.ok) return channelLabel;
  const harness = createChannelGrantHarness(issuedBy);
  if (!harness.ok) return harness;

  try {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", rom.slice().buffer));
    const romSha256 = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const runKey: RunKey = {
      romSha256,
      seedHex: BigInt(seed >>> 0)
        .toString(16)
        .padStart(16, "0"),
      loadAddrHex: "0200",
      dialect: "chip8",
      channelLabel: channelLabel.value,
      stepMapVersion: "chip8cow-step-v1",
    };
    return harness.value.issue(runKey, channels.value);
  } catch (error: unknown) {
    return fail("run-key-digest-failed", error instanceof Error ? error.message : String(error));
  }
}

function stateFor(grant: ChannelGrant): ChannelGrantResult<GrantState> {
  const state = issuedGrants.get(grant);
  return state === undefined
    ? fail("invalid-channel-grant", "grant was not issued by createChannelGrantHarness")
    : { ok: true, value: state };
}

function specFor(
  state: GrantState,
  channel: string,
  direction: ChannelDirection,
  address: number,
): ChannelSpec | undefined {
  return state.grant.channels.channels.find(
    (spec) =>
      spec.channel === channel &&
      spec.direction === direction &&
      address >= spec.startAddress &&
      address <= spec.endAddress,
  );
}

function snapshot(state: GrantState): ChannelMeterSnapshot {
  return Object.freeze({
    channelLabel: state.grant.channelLabel,
    issuedBy: state.grant.issuedBy,
    runKey: keyText(state.grant.runKey),
    rows: Object.freeze(
      state.grant.channels.channels.map((spec) =>
        Object.freeze({ ...spec, crossings: state.counts.get(canonicalSpec(spec)) ?? 0 }),
      ),
    ),
  });
}

export function channelMeterSnapshot(grant: ChannelGrant): ChannelGrantResult<ChannelMeterSnapshot> {
  const state = stateFor(grant);
  return state.ok ? { ok: true, value: snapshot(state.value) } : state;
}

export function meterCrossings(
  grant: ChannelGrant,
  crossings: readonly ChannelCrossing[],
): ChannelGrantResult<ChannelMeterSnapshot> {
  const state = stateFor(grant);
  if (!state.ok) return state;

  const increments = new Map<string, number>();
  for (const crossing of crossings) {
    if (!Number.isInteger(crossing.address)) {
      return fail("crossing-not-granted", `${crossing.channel}:${crossing.direction}@${String(crossing.address)}`);
    }
    const spec = specFor(state.value, crossing.channel, crossing.direction, crossing.address);
    if (spec === undefined) {
      return fail("crossing-not-granted", `${crossing.channel}:${crossing.direction}@${String(crossing.address)}`);
    }
    const key = canonicalSpec(spec);
    increments.set(key, (increments.get(key) ?? 0) + 1);
  }

  for (const [key, increment] of increments) {
    const current = state.value.counts.get(key) ?? 0;
    if (current > Number.MAX_SAFE_INTEGER - increment) {
      return fail("crossing-count-overflow", key);
    }
  }
  for (const [key, increment] of increments) {
    state.value.counts.set(key, (state.value.counts.get(key) ?? 0) + increment);
  }
  return { ok: true, value: snapshot(state.value) };
}

export function meterCrossingRange(
  grant: ChannelGrant,
  crossing: Omit<ChannelSpec, "startAddress" | "endAddress"> & {
    readonly startAddress: number;
    readonly endAddress: number;
  },
): ChannelGrantResult<ChannelMeterSnapshot> {
  const state = stateFor(grant);
  if (!state.ok) return state;
  if (
    !Number.isInteger(crossing.startAddress) ||
    !Number.isInteger(crossing.endAddress) ||
    crossing.startAddress > crossing.endAddress
  ) {
    return fail(
      "crossing-not-granted",
      `${crossing.channel}:${crossing.direction}@${String(crossing.startAddress)}-${String(crossing.endAddress)}`,
    );
  }

  const increments = new Map<string, number>();
  let address = crossing.startAddress;
  while (address <= crossing.endAddress) {
    const spec = specFor(state.value, crossing.channel, crossing.direction, address);
    if (spec === undefined) {
      return fail("crossing-not-granted", `${crossing.channel}:${crossing.direction}@${String(address)}`);
    }
    const coveredEnd = Math.min(spec.endAddress, crossing.endAddress);
    const key = canonicalSpec(spec);
    increments.set(key, (increments.get(key) ?? 0) + coveredEnd - address + 1);
    address = coveredEnd + 1;
  }

  for (const [key, increment] of increments) {
    const current = state.value.counts.get(key) ?? 0;
    if (current > Number.MAX_SAFE_INTEGER - increment) {
      return fail("crossing-count-overflow", key);
    }
  }
  for (const [key, increment] of increments) {
    state.value.counts.set(key, (state.value.counts.get(key) ?? 0) + increment);
  }
  return { ok: true, value: snapshot(state.value) };
}
