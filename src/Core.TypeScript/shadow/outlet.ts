import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, sep } from "node:path";

export interface ShadowOutlet {
  readonly path: string;
  readonly id: string;
  cleanup(): Promise<void>;
}

/**
 * Creates an ephemeral shadow outlet under the OS temp directory.
 * Phase 1 implementation: atomic creation via mkdtemp, auto-clean optional.
 * Future: replace with cryptographic private store (Phase 2).
 */
export async function createShadowOutlet(prefix = "zeta-shadow"): Promise<ShadowOutlet> {
  // Reject separators and parent segments to prevent escaping tmpdir
  const safe = prefix.replace(/[/\\]/g, "").replace(/\.\./g, "");
  if (!safe) throw new Error(`Invalid outlet prefix: "${prefix}"`);
  const root = tmpdir();
  const path = await mkdtemp(join(root, `${safe}-`));
  const id = basename(path);
  return {
    path,
    id,
    async cleanup() {
      // Guard: verify path stays within the root captured at creation time
      if (!path.startsWith(root + sep)) {
        throw new Error(`Refusing cleanup outside tmpdir: ${path}`);
      }
      await rm(path, { recursive: true, force: true });
    },
  };
}
