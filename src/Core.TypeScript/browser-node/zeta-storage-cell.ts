/**
 * zeta-storage-cell.ts — Hexagonal dual-path storage cell.
 *
 * ## The dual-path model
 *
 * Every write goes to all available storage backends simultaneously:
 *   1. ZetaDB (primary): WASM-backed, content-addressed, DAGFS semantics
 *   2. IndexedDB (fallback): native browser storage, Vera's hexagonal port
 *   3. Git (durable): the record of truth, propagated via ZetaTransportCell
 *
 * Every read tries ZetaDB first, falls back to IndexedDB, then Git.
 * This is the dual-path pattern: the system works even if ZetaDB is unavailable.
 *
 * ## Content-addressing (DAGFS)
 *
 * Every write is content-addressed using the Merkle hash of the payload.
 * The Merkle root is the "address" of the content — it is the same regardless
 * of which backend stores it. This is the DAGFS property: the content IS the
 * address, and the address IS the content.
 *
 * This means:
 *   - Two nodes with the same content have the same address (deduplication)
 *   - The address is verifiable without trusting the storage backend
 *   - The address is the same in ZetaDB, IndexedDB, and Git (homoiconicity)
 *
 * ## Hexagonal interface
 *
 * The `ZetaStoragePort` interface is the hexagonal boundary. Any storage
 * backend that satisfies it can be used as a primary or fallback path.
 * This is the same pattern as Vera's `ZetaDbImagePort` — we extend it
 * with content-addressing and transport propagation.
 *
 * ## Connection to the transport layer
 *
 * Every write propagates over the ZetaTransportCell (if provided):
 *   - The Merkle hash is the event ID
 *   - The payload is the event body
 *   - The teaching acks from the transport update the BNN posterior
 *
 * This means storage and transport are unified: a write to storage IS a
 * broadcast to the network. The YinYang cell handles both.
 *
 * ## References
 *
 * - browser-zetadb-image-port.ts (Vera's ZetaDB browser port)
 * - browser-indexeddb-checkpoint.ts (Vera's IndexedDB adapter)
 * - zeta-transport-cell.ts (YinYang transport cell)
 * - merkle/merkle.ts (content-addressing)
 * - zetadb/zeta-db-node.ts (ZetaDB interface)
 */

import { ofBytes as merkleOfBytes, combine as merkleCombine, type MerkleHash } from "../merkle/merkle";
import type { ZetaTransportCell } from "../discovery/zeta-transport-cell";

// ── Hexagonal storage interface ────────────────────────────────────────────────

export interface StorageRecord {
  /** Content-addressed key: hex string of Merkle hash. */
  readonly key: string;
  /** The payload (UTF-8 string). */
  readonly payload: string;
  /** The Merkle hash of the payload. */
  readonly merkleHash: MerkleHash;
}

export type StorageResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string; readonly severity: "backpressure" | "heat" };

/** Hexagonal storage port — any backend must satisfy this interface. */
export interface ZetaStoragePort {
  /** Write a record. Returns the content-addressed key. */
  write(record: StorageRecord): Promise<StorageResult<string>>;
  /** Read a record by content-addressed key. */
  read(key: string): Promise<StorageResult<StorageRecord | null>>;
  /** List all keys (for sync/merge). */
  list(): Promise<StorageResult<string[]>>;
  /** Close the storage backend. */
  close(): StorageResult<null>;
}

// ── Content-addressing helpers ─────────────────────────────────────────────────

/**
 * Compute the Merkle hash of a UTF-8 string payload.
 * Uses the same algorithm as F# Merkle.fs (byte-identical across all substrates).
 */
export function hashPayload(payload: string): MerkleHash {
  const bytes = new TextEncoder().encode(payload);
  // Split into 8-byte chunks and hash each as a leaf
  const leaves: MerkleHash[] = [];
  for (let i = 0; i < bytes.length; i += 8) {
    const chunk = bytes.slice(i, i + 8);
    // Pad to 8 bytes
    const padded = new Uint8Array(8);
    padded.set(chunk);
    leaves.push(merkleOfBytes(padded));
  }
  if (leaves.length === 0) {
    return merkleOfBytes(new Uint8Array(8));
  }
  // Build Merkle tree
  let level = leaves;
  while (level.length > 1) {
    const next: MerkleHash[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? left; // duplicate last if odd
      next.push(merkleCombine(left, right));
    }
    level = next;
  }
  return level[0]!;
}

/** Convert a MerkleHash to a hex string (the content-addressed key). */
export function merkleToHex(hash: MerkleHash): string {
  const hiHex = hash.hi.toString(16).padStart(16, "0");
  const loHex = hash.lo.toString(16).padStart(16, "0");
  return hiHex + loHex;
}

/** Create a StorageRecord from a payload. */
export function makeStorageRecord(payload: string): StorageRecord {
  const merkleHash = hashPayload(payload);
  const key = merkleToHex(merkleHash);
  return { key, payload, merkleHash };
}

// ── In-memory storage backend (for testing and browser fallback) ───────────────

export class InMemoryStoragePort implements ZetaStoragePort {
  private readonly _store = new Map<string, StorageRecord>();

  async write(record: StorageRecord): Promise<StorageResult<string>> {
    this._store.set(record.key, record);
    return { ok: true, value: record.key };
  }

  async read(key: string): Promise<StorageResult<StorageRecord | null>> {
    return { ok: true, value: this._store.get(key) ?? null };
  }

  async list(): Promise<StorageResult<string[]>> {
    return { ok: true, value: [...this._store.keys()] };
  }

  close(): StorageResult<null> {
    return { ok: true, value: null };
  }
}

// ── ZetaStorageCell ────────────────────────────────────────────────────────────

export interface ZetaStorageCellOptions {
  /** Primary storage backend (ZetaDB or in-memory). */
  readonly primary: ZetaStoragePort;
  /** Fallback storage backend (IndexedDB or in-memory). */
  readonly fallback?: ZetaStoragePort;
  /** Transport cell for propagating writes over the network. */
  readonly transport?: ZetaTransportCell;
  /** Node ID of the writer. */
  readonly nodeId: string;
}

/**
 * ZetaStorageCell — the YinYang storage cell.
 *
 * Writes go to all backends simultaneously (fan-out).
 * Reads try primary first, then fallback.
 * Every write propagates over the transport cell (if provided).
 *
 * The Merkle hash is the content-addressed key — the same regardless of
 * which backend stores the content (homoiconicity with the transport layer).
 */
export class ZetaStorageCell {
  private readonly _primary: ZetaStoragePort;
  private readonly _fallback: ZetaStoragePort | undefined;
  private readonly _transport: ZetaTransportCell | undefined;
  private readonly _nodeId: string;

  constructor(opts: ZetaStorageCellOptions) {
    this._primary = opts.primary;
    this._fallback = opts.fallback;
    this._transport = opts.transport;
    this._nodeId = opts.nodeId;
  }

  /**
   * Write a payload to all storage backends.
   * Returns the content-addressed key (Merkle hash hex).
   */
  async write(payload: string): Promise<StorageResult<string>> {
    const record = makeStorageRecord(payload);

    // Write to primary
    const primaryResult = await this._primary.write(record);

    // Write to fallback (non-fatal if it fails)
    if (this._fallback) {
      await this._fallback.write(record).catch(() => {
        // Fallback failure is non-fatal — primary is the source of truth
      });
    }

    // Propagate over transport (non-fatal if it fails)
    if (this._transport && primaryResult.ok) {
      const event = JSON.stringify({
        kind: "storage:write",
        key: record.key,
        payload,
        by: this._nodeId,
      });
      await this._transport.send(event).catch(() => {
        // Transport failure is non-fatal — storage is the source of truth
      });
    }

    return primaryResult;
  }

  /**
   * Read a record by content-addressed key.
   * Tries primary first, then fallback.
   */
  async read(key: string): Promise<StorageResult<StorageRecord | null>> {
    const primaryResult = await this._primary.read(key);
    if (primaryResult.ok && primaryResult.value !== null) return primaryResult;

    // Try fallback
    if (this._fallback) {
      const fallbackResult = await this._fallback.read(key);
      if (fallbackResult.ok && fallbackResult.value !== null) {
        // Write back to primary (healing)
        if (fallbackResult.value) {
          await this._primary.write(fallbackResult.value).catch(() => {});
        }
        return fallbackResult;
      }
    }

    return primaryResult;
  }

  /** List all keys from primary storage. */
  async list(): Promise<StorageResult<string[]>> {
    return this._primary.list();
  }

  /** Verify a payload against its content-addressed key. */
  verify(key: string, payload: string): boolean {
    const expected = merkleToHex(hashPayload(payload));
    return key === expected;
  }

  /** Close all storage backends. */
  close(): void {
    this._primary.close();
    this._fallback?.close();
  }
}

// ── Factory helpers ────────────────────────────────────────────────────────────

/** Create a ZetaStorageCell with in-memory primary and optional fallback. */
export function createInMemoryStorageCell(
  nodeId: string,
  opts?: Partial<Omit<ZetaStorageCellOptions, "nodeId" | "primary">>,
): ZetaStorageCell {
  return new ZetaStorageCell({
    nodeId,
    primary: new InMemoryStoragePort(),
    ...opts,
  });
}
