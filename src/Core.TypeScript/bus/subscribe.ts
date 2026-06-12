import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { BUS_DIR, ensureDir, list } from "./bus";
import type { MessageEnvelope, Topic } from "./types";

const SURFACE_RE = /^[a-z0-9_-]{1,64}$/;

/**
 * Reads envelopes from the bus matching the given topic and recipient,
 * calls the handler for each unseen envelope, and marks them as seen
 * in a surface-specific seen.json file.
 */
export async function subscribeOnce<T extends Topic>(
  topic: T,
  surface: string,
  handler: (envelope: MessageEnvelope & { topic: T }) => Promise<void> | void,
  adapters = { list }
): Promise<void> {
  // P1 defense-in-depth: surface is interpolated into a filename; constrain
  // to a safe charset so a stray "../" cannot escape BUS_DIR.
  if (!SURFACE_RE.test(surface)) {
    throw new Error(`subscribeOnce: invalid surface "${surface}" (must match ${SURFACE_RE})`);
  }

  ensureDir();
  const seenFile = join(BUS_DIR, `seen-${surface}.json`);
  let seenIds: Set<string>;

  // Single readFileSync + ENOENT-aware catch. Other errors (permission,
  // JSON corruption) re-throw so we never silently drop seen-state and
  // re-deliver already-handled envelopes.
  try {
    const data = JSON.parse(readFileSync(seenFile, "utf8"));
    seenIds = new Set(Array.isArray(data) ? data : []);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      seenIds = new Set();
    } else {
      throw err;
    }
  }

  // Get all envelopes matching topic and targeted at this surface (or broadcast)
  const envelopes = adapters.list({ topic, to: surface as any });

  let newlySeen = false;

  for (const envelope of envelopes) {
    if (!seenIds.has(envelope.id)) {
      try {
        await handler(envelope as MessageEnvelope & { topic: T });
        seenIds.add(envelope.id);
        newlySeen = true;
      } catch (err) {
        // If handler fails, we do NOT mark as seen, so it can be retried next tick
        console.error(`[subscribeOnce] Handler for ${envelope.id} failed:`, err);
      }
    }
  }

  if (newlySeen) {
    // Symmetric with read-side: surface persistence failures to the caller so
    // already-handled envelopes don't silently re-deliver on the next poll.
    writeFileSync(seenFile, JSON.stringify(Array.from(seenIds), null, 2));
  }
}
