/**
 * Content-addressed ChangeSet id — changeSetId = uuid(org:workItem:targetRef:revision).
 * Re-deriving the same (org, workItem, targetRef, revision) yields the same id, so a
 * resubmit at the same revision is idempotent and a new revision is a new id lineage.
 * Same discipline as the memory content-addressing.
 */

import { createHash } from "node:crypto";

const CHANGE_CONTROL_NAMESPACE = "9f1c0d2e-7b3a-4e51-8c64-2a7f1e9b0c33";

/**
 * A UUID whose bits come from SHA-256 of `namespace:name`, tagged as **version 8**.
 *
 * WHY NOT v5, WHICH THIS USED TO CALL ITSELF. RFC 4122 §4.3 fixes UUIDv5's hash as
 * SHA-1, so "content-addressed UUID" and "no weak hash" cannot both be true under
 * that version number — and SHA-1 has had a practical collision since Stevens et al.,
 * *SHAttered* (2017). Two distinct (org, workItem, targetRef, revision) tuples
 * colliding here would merge two ChangeSet lineages into one id, which is a
 * correctness failure in an idempotency key before it is a security one. CodeQL
 * alert 131 (`js/weak-cryptographic-algorithm`) named it.
 *
 * RFC 9562 §5.8 defines **version 8** precisely for this: a UUID whose 122 free bits
 * are vendor-chosen, with only the version and variant fields fixed. So the honest
 * move is to keep the derivation and change the version number to the one that
 * permits it, rather than keep a v5 label over a hash v5 does not allow.
 *
 * NOT RFC 4122 v5 IN ANY CASE, and it never was: a real v5 hashes the namespace's
 * sixteen RAW BYTES followed by the name's bytes. This hashes the namespace's ASCII
 * spelling, a colon, and the name. The old name claimed an interop property the code
 * did not have.
 *
 * NO GOLDEN VECTORS PINNED THE OLD IDS — checked 2026-09-11: the only assertions are
 * idempotency (same tuple, same id) and distinctness (new revision, new id), both of
 * which hold unchanged. Ids minted before this change do not re-derive; they remain
 * valid opaque keys for the rows that already carry them, and nothing re-derives an
 * id for an existing row.
 */
function uuidv8FromSha256(name: string, namespace: string): string {
  const digest = createHash("sha256").update(`${namespace}:${name}`).digest("hex");
  const chars = digest.slice(0, 32).split("");
  chars[12] = "8"; // RFC 9562 §4.2 version field — 8 = custom
  const variantNibble = (parseInt(chars[16]!, 16) & 0x3) | 0x8; // variant 10xx (RFC 4122/9562)
  chars[16] = variantNibble.toString(16);
  const h = chars.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function contentAddressedChangeSetId(
  organizationId: string,
  workItemId: string,
  targetRef: string,
  revision: number,
): string {
  return uuidv8FromSha256(`${organizationId}:${workItemId}:${targetRef}:${revision}`, CHANGE_CONTROL_NAMESPACE);
}
