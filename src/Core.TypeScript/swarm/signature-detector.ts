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

  // FNV-1a Hash implementation (32-bit)
  let hash = 2166136261;
  for (let i = 0; i < maskedMem.length; i++) {
    hash ^= maskedMem[i]!;
    hash = Math.imul(hash, 16777619);
  }
  for (let i = 0; i < displayBytes.length; i++) {
    hash ^= displayBytes[i]!;
    hash = Math.imul(hash, 16777619);
  }

  // Convert to hex string and pad
  return (hash >>> 0).toString(16).padStart(8, '0');
}
