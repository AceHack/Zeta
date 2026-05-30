/**
 * Content-addressed memory id (§12.3). memoryId = uuidv5(org:tier:scope:key) — a
 * deterministic, stable join key shared by the Hindsight CONTENT write and the
 * Cockroach STATE row. Re-deriving the same (org, tier, scope, key) yields the
 * same id, so "store every turn" collapses repeats into idempotent reinforcement
 * instead of duplicates. The "is this new?" question is answered by the key, not
 * by a forgetful agent.
 */

import { createHash } from "node:crypto";
import type { MemoryTier } from "../../domain/src/index.ts";

// A fixed namespace for the org memory system (any stable UUID works as the seed).
const MEMORY_NAMESPACE = "1b671a64-40d5-491e-99b0-da01ff1f3341";

function uuidv5(name: string, namespace: string): string {
  // Content-addressing for our own join key (not cross-impl interop) — a single
  // SHA-1 over (namespace ⊕ name) is deterministic + collision-resistant enough.
  const digest = createHash("sha1").update(`${namespace}:${name}`).digest("hex"); // 40 hex chars
  const chars = digest.slice(0, 32).split(""); // first 16 bytes
  chars[12] = "5"; // version 5 (high nibble of byte 6)
  const variantNibble = (parseInt(chars[16]!, 16) & 0x3) | 0x8; // RFC-4122 variant (10xx)
  chars[16] = variantNibble.toString(16);
  const h = chars.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function contentAddressedMemoryId(
  organizationId: string,
  tier: MemoryTier,
  scope: string,
  key: string,
): string {
  return uuidv5(`${organizationId}:${tier}:${scope}:${key}`, MEMORY_NAMESPACE);
}
