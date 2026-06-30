/**
 * Durability mode — the persistence promise a room makes. Port of
 * `src/Core/Durability.fs` (`DurabilityMode`).
 *
 * Merge1 §01 (F# Core Algebra). `Room.durabilityMode` selects the promise:
 * `in_memory_only` for ephemeral test/simulation rooms; `stable_storage` for
 * production rooms; `witness_durable` when a quorum of witnesses must acknowledge.
 */
export type DurabilityMode =
  /** Survives process and OS crash (fsync to stable storage). */
  | "stable_storage"
  /** Buffered by the OS; survives process crash but not power loss. */
  | "os_buffered"
  /** Never persisted; lost on process exit. For pure simulation. */
  | "in_memory_only"
  /** Durable once a quorum of witnesses acknowledges. */
  | "witness_durable";

export const DurabilityMode = {
  StableStorage: "stable_storage",
  OsBuffered: "os_buffered",
  InMemoryOnly: "in_memory_only",
  WitnessDurable: "witness_durable",
} as const satisfies Record<string, DurabilityMode>;
