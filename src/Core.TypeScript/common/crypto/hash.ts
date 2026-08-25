import { ContentHash256 } from "../../blake3/blake3";

/** Content hash of raw bytes, in the `blake3:<hex>` form Ace manifests use. */
export function contentHash(bytes: Uint8Array): string {
  return "blake3:" + ContentHash256.ofBytes(bytes).toHex();
}
