/**
 * Checkpoint — room state save/restore at tick boundaries, enabling DST replay
 * from a checkpoint. Port of `src/Core/Checkpoint.fs`
 * (`ICheckpointable`, `ICheckpointStore`, `FileCheckpointStore`).
 *
 * Merge1 §01 (F# Core Algebra). Result discipline (§10 MP-7): store operations
 * return `Result<_, CheckpointError>` and never throw on the hot path. A room
 * that implements `Checkpointable` can save/restore its state so a simulation
 * resumes deterministically from the checkpoint.
 */
import type { Result } from "./result.ts";
import { ok, feedback } from "./result.ts";

/** Reads primitive state in the same order it was written. */
export interface CheckpointReader {
  readInt32(): number;
  readInt64(): bigint;
  readFloat(): number;
  readBool(): boolean;
  readBytes(): Uint8Array;
  readString(): string;
}

/** Writes primitive state into a checkpoint payload. */
export interface CheckpointWriter {
  writeInt32(v: number): void;
  writeInt64(v: bigint): void;
  writeFloat(v: number): void;
  writeBool(v: boolean): void;
  writeBytes(v: Uint8Array): void;
  writeString(v: string): void;
}

/** A stateful object that can serialise/restore itself. Port of `ICheckpointable`. */
export interface Checkpointable {
  saveState(writer: CheckpointWriter): void;
  loadState(reader: CheckpointReader): void;
  readonly stateVersion: number;
}

export type CheckpointError =
  | { readonly kind: "write_failed"; readonly reason: string }
  | { readonly kind: "read_failed"; readonly reason: string }
  | { readonly kind: "version_mismatch"; readonly expected: number; readonly actual: number };

export type LoadedCheckpoint = {
  readonly tick: number;
  readonly states: readonly (readonly [number, CheckpointReader])[];
};

/** Persists and restores room checkpoints. Port of `ICheckpointStore`. */
export interface CheckpointStore {
  saveCheckpoint(
    roomId: string,
    tick: number,
    states: readonly (readonly [number, Checkpointable])[],
  ): Promise<Result<void, CheckpointError>>;
  loadCheckpoint(roomId: string): Promise<Result<LoadedCheckpoint | undefined, CheckpointError>>;
}

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

/** A growable little-endian buffer writer. */
export function createBufferWriter(): CheckpointWriter & { toBytes: () => Uint8Array } {
  const bytes: number[] = [];
  const pushU32 = (v: number): void => {
    bytes.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  };
  return {
    writeInt32: (v) => pushU32(v | 0),
    writeInt64: (v) => {
      let u = BigInt.asUintN(64, v);
      for (let i = 0; i < 8; i++) {
        bytes.push(Number(u & 0xffn));
        u >>= 8n;
      }
    },
    writeFloat: (v) => {
      const buf = new ArrayBuffer(8);
      new DataView(buf).setFloat64(0, v, true);
      bytes.push(...new Uint8Array(buf));
    },
    writeBool: (v) => bytes.push(v ? 1 : 0),
    writeBytes: (v) => {
      pushU32(v.length);
      bytes.push(...v);
    },
    writeString: (v) => {
      const encoded = TEXT_ENCODER.encode(v);
      pushU32(encoded.length);
      bytes.push(...encoded);
    },
    toBytes: () => Uint8Array.from(bytes),
  };
}

/** A little-endian buffer reader paired with {@link createBufferWriter}. */
export function createBufferReader(data: Uint8Array): CheckpointReader {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;
  const readU32 = (): number => {
    const v = view.getUint32(offset, true);
    offset += 4;
    return v;
  };
  return {
    readInt32: () => {
      const v = view.getInt32(offset, true);
      offset += 4;
      return v;
    },
    readInt64: () => {
      const v = view.getBigInt64(offset, true);
      offset += 8;
      return v;
    },
    readFloat: () => {
      const v = view.getFloat64(offset, true);
      offset += 8;
      return v;
    },
    readBool: () => {
      const v = view.getUint8(offset);
      offset += 1;
      return v !== 0;
    },
    readBytes: () => {
      const len = readU32();
      const slice = data.slice(offset, offset + len);
      offset += len;
      return slice;
    },
    readString: () => {
      const len = readU32();
      const slice = data.subarray(offset, offset + len);
      offset += len;
      return TEXT_DECODER.decode(slice);
    },
  };
}

/**
 * In-memory checkpoint store for simulation and tests. Production rooms use a
 * file/object-store backed implementation (FileCheckpointStore port, §08).
 */
export function createInMemoryCheckpointStore(): CheckpointStore {
  const byRoom = new Map<string, { tick: number; states: (readonly [number, Uint8Array])[] }>();
  return {
    saveCheckpoint: (roomId, tick, states) => {
      try {
        const encoded = states.map(([slot, checkpointable]): readonly [number, Uint8Array] => {
          const writer = createBufferWriter();
          writer.writeInt32(checkpointable.stateVersion);
          checkpointable.saveState(writer);
          return [slot, writer.toBytes()];
        });
        byRoom.set(roomId, { tick, states: encoded });
        return Promise.resolve(ok<void>(undefined));
      } catch (error) {
        return Promise.resolve(
          feedback<CheckpointError>({ kind: "write_failed", reason: String(error) }),
        );
      }
    },
    loadCheckpoint: (roomId) => {
      const stored = byRoom.get(roomId);
      if (stored === undefined) {
        return Promise.resolve(ok<LoadedCheckpoint | undefined>(undefined));
      }
      try {
        const states = stored.states.map(
          ([slot, bytes]): readonly [number, CheckpointReader] => [slot, createBufferReader(bytes)],
        );
        return Promise.resolve(ok<LoadedCheckpoint | undefined>({ tick: stored.tick, states }));
      } catch (error) {
        return Promise.resolve(
          feedback<CheckpointError>({ kind: "read_failed", reason: String(error) }),
        );
      }
    },
  };
}
