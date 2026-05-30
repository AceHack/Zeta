/**
 * Content-addressed ChangeSet id — changeSetId = uuidv5(org:workItem:targetRef:revision).
 * Re-deriving the same (org, workItem, targetRef, revision) yields the same id, so a
 * resubmit at the same revision is idempotent and a new revision is a new id lineage.
 * Same discipline as the memory content-addressing.
 */

import { createHash } from "node:crypto";

const CHANGE_CONTROL_NAMESPACE = "9f1c0d2e-7b3a-4e51-8c64-2a7f1e9b0c33";

function uuidv5(name: string, namespace: string): string {
  const digest = createHash("sha1").update(`${namespace}:${name}`).digest("hex");
  const chars = digest.slice(0, 32).split("");
  chars[12] = "5";
  const variantNibble = (parseInt(chars[16]!, 16) & 0x3) | 0x8;
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
  return uuidv5(`${organizationId}:${workItemId}:${targetRef}:${revision}`, CHANGE_CONTROL_NAMESPACE);
}
