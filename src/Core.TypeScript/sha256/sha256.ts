import { createHash } from "node:crypto";

/** SHA-256 of `bytes` → 32-byte digest. Our port over node:crypto (no 3rd-party dep). */
export function sha256(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(bytes).digest());
}

/** SHA-256 of `bytes` → lowercase-hex string (the golden-vector + display form). */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
