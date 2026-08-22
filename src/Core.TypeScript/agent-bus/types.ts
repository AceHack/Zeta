/**
 * Agent-bus Phase 1 (081KSXN940008QG0R00171YAZW) — the git-native cross-machine agent comms channel.
 *
 * Envelopes are ZetaId-named files in
 *   docs/agent-bus/<persona>/<YYYY>/<MM>/<DD>/<id>.json
 * a **G-Set CRDT**: disjoint, ZetaId-named files never collide, so concurrent agents
 * on different machines write different files -> conflict-free -> cross-machine /
 * Windows-safe (git is the transport). Per the #6219 spec; no-PR direct-to-main per
 * 081KSKBP80008QG0R001KK9WV6 (heartbeat folder) + folders-on-main per 081KSNY2Z0008QG0R000E5KTPX.
 *
 * The envelope **reuses the existing local-bus `MessageEnvelope`** (`tools/bus/types`)
 * per the spec's "extend MessageEnvelope" guidance — `id` is the Bus-category ZetaId
 * hex (filename + dedup key); `topic`/`payload` are the existing `BusMessage` union;
 * `from`/`to`/`timestamp`/`expiresAt` are the existing fields. Same shape as the
 * local bus, so the legacy-bus bridge (081KSXN940008QG0R00171YAZW sub-target) is a transport swap, not a
 * reshape. NOT a new id scheme or action language.
 *
 * This module is PURE (path + mint + types). The git layer lives behind the CLIs in
 * publish.ts / subscribe.ts so tests + importers never touch git or the real folder.
 */
import { join } from "node:path";
import { TTL_MS, type AgentId, type SenderAgentId, type BusMessage, type MessageEnvelope } from "../bus/types";
import { pack, DEFAULT_ENV, type SimulationEnvironment } from "../zeta-id/zeta-id";
import { isCanonicalZetaIdHex } from "../zeta-id/canonical-hex";
import {
  Category,
  IdVersion,
  Chromosome,
  Persona,
  LocationHint,
  type ZetaObservation,
  type Milliseconds,
} from "../zeta-id/types";

/** Repo-relative root for the bus folder; override with `ZETA_AGENT_BUS_DIR` (tests). */
export const AGENT_BUS_ROOT: string = process.env.ZETA_AGENT_BUS_DIR ?? "docs/agent-bus";

/**
 * One bus envelope = one file. **Reuses the local-bus `MessageEnvelope`** — `id` is
 * the 32-hex Bus-category ZetaId (filename + dedup key); `topic`/`payload` come from
 * `BusMessage`; `from`/`to`/`timestamp`/`expiresAt` are the existing fields.
 */
export type AgentBusEnvelope = MessageEnvelope;

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * A path segment must be a single name that is valid on EVERY OS. Positive allowlist:
 * letters, digits, dot, underscore, hyphen — no leading dot, no `..`. Everything
 * Windows forbids (`< > : " / \ | ? *`, control chars, spaces) is rejected by
 * omission. Our real segments are SENDER_IDS personas (kebab-case, e.g. otto-cli /
 * otto-windows) + 32-hex ids, which already satisfy this; the allowlist makes the
 * "Windows-safe" claim actually hold for any future caller (Copilot #6283).
 */
// Windows reserved device names (case-insensitive, with or without an extension) — invalid
// as filenames on Windows even though they pass the char allowlist (Copilot #6283).
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

export function isSafeSegment(seg: string): boolean {
  return (
    /^[A-Za-z0-9._-]+$/.test(seg) &&
    !seg.startsWith(".") &&
    !seg.includes("..") &&
    !WINDOWS_RESERVED_NAME.test(seg)
  );
}

/**
 * A canonical envelope timestamp is exactly `Date.toISOString()` output
 * (`YYYY-MM-DDTHH:mm:ss.sssZ`). This guarantees lexical string order == time order, which
 * the readers' compound `(timestamp, id)` cursor relies on — a non-ISO timestamp (e.g.
 * `2026/05/31`) would sort wrong and break cursor progression (Copilot #6283).
 */
export function isCanonicalTimestamp(ts: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(ts);
}

/**
 * A canonical bus id is 32 lowercase hex chars that DECODE as a ZetaId
 * (`mintBusZetaIdHex` output).
 *
 * Was a bare `/^[0-9a-f]{32}$/` — an encoding check standing in for a value check. The
 * bus is the cross-MACHINE channel, so its reader (`subscribe.ts`) is the one place
 * here that accepts ids minted by a peer we do not control; a shape-only check there
 * accepts whatever any producer emits. All 49 envelopes under `docs/agent-bus/` decode
 * cleanly, so this is a tightening with no legacy carve-out. See
 * `src/Core.TypeScript/zeta-id/canonical-hex.ts`.
 */
export function isCanonicalBusId(id: string): boolean {
  return isCanonicalZetaIdHex(id);
}

/** `<root>/<persona>/<YYYY>/<MM>/<DD>/<id>.json` (UTC date partition). */
export function envelopePath(root: string, persona: string, id: string, at: Date = new Date()): string {
  if (!isSafeSegment(persona) || !isSafeSegment(id)) {
    throw new Error(`agent-bus: unsafe path segment (persona=${persona}, id=${id})`);
  }
  return join(
    root,
    persona,
    String(at.getUTCFullYear()),
    pad2(at.getUTCMonth() + 1),
    pad2(at.getUTCDate()),
    `${id}.json`,
  );
}

/**
 * Mint a Bus-category ZetaId as 32-hex. `DEFAULT_ENV` (crypto randomness) makes each
 * call unique even with identical semantic fields. Pass `DETERMINISTIC_ENV` for
 * reproducible tests (identical fields -> identical id -> the safe idempotent same-file
 * the G-Set CRDT relies on; see the spec's collision caveat).
 */
export function mintBusZetaIdHex(env: SimulationEnvironment = DEFAULT_ENV, atMs: number = Date.now()): string {
  const obs: ZetaObservation = {
    version: IdVersion.V1,
    timestamp: atMs as Milliseconds,
    chromosome: Chromosome.MetaCoherence,
    category: Category.Bus,
    authority: { type: "TrustedAgent" },
    persona: Persona.FireflyCoherence,
    momentum: { type: "Normal" },
    location: LocationHint.EastUS_VA1,
  };
  return pack(obs, env).toString(16).padStart(32, "0");
}

/** Build an envelope (reuses MessageEnvelope): mint a Bus id + stamp timestamp/expiresAt. */
export function makeEnvelope(
  from: SenderAgentId,
  to: AgentId,
  message: BusMessage,
  atMs: number = Date.now(),
): AgentBusEnvelope {
  return {
    ...message,
    id: mintBusZetaIdHex(undefined, atMs),
    from,
    to,
    timestamp: new Date(atMs).toISOString(),
    expiresAt: new Date(atMs + TTL_MS[message.topic]).toISOString(), // per-topic TTL (Record<Topic, number>)
  };
}

/** Canonical on-disk serialization (stable: pretty + trailing newline). */
export function serializeEnvelope(env: AgentBusEnvelope): string {
  return `${JSON.stringify(env, null, 2)}\n`;
}
