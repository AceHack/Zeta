
import { createHash } from "node:crypto";

/**
 * Signature Detector
 * 
 * Computes a structural signature of the "Playable Quote" (causal orbit)
 * by hashing ONLY the memory addresses that the CHIP-8 VM has causally 
 * accessed during the current execution loop, ALONG WITH the visual display state.
 */
export function detectCausalSignature(mem: Uint8Array, mask: boolean[], display: boolean[]): string {
  // Construct the causally masked memory footprint
  const maskedMem = new Uint8Array(4096);
  for (let i = 0; i < 4096; i++) {
    if (mask[i]) {
      maskedMem[i] = mem[i] ?? 0;
    } else {
      maskedMem[i] = 0; // Erased by "soft regime" inference
    }
  }

  // Pack the boolean display array into bytes
  const displayBytes = new Uint8Array(256); // 64 * 32 = 2048 bits = 256 bytes
  for (let i = 0; i < 2048; i++) {
    if (display[i]) {
      displayBytes[i >> 3]! |= (1 << (7 - (i & 7)));
    }
  }

  // Hash the Playable Quote footprint + Visual State
  const hash = createHash("sha256");
  hash.update(maskedMem);
  hash.update(displayBytes);
  return hash.digest("hex").substring(0, 16); // 16-char short signature
}
