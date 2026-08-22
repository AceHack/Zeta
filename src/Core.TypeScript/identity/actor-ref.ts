import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { VALID_PERSONAS, type PersonaId } from "./generated-registry.ts";

/**
 * CellRef - Open-ended execution coordinate hanging off the hub (the satellite).
 */
export interface CellRef {
  surface?: string;
  instance?: string;
  node?: string;
}

/**
 * ActorRef - Combined identity + address composition.
 */
export interface ActorRef {
  persona: PersonaId;
  cell: CellRef;
}

/**
 * Map of legacy SENDER_IDS composites and bare personas to their structured ActorRef representation.
 */
const LEGACY_MAP: Record<string, ActorRef> = {
  "otto": { persona: "otto", cell: {} },
  "alexa": { persona: "alexa", cell: {} },
  "riven": { persona: "riven", cell: {} },
  "vera": { persona: "vera", cell: {} },
  "lior": { persona: "lior", cell: {} },
  "soraya": { persona: "soraya", cell: {} },
  "aaron": { persona: "aaron", cell: {} },
  "addison": { persona: "addison", cell: {} },
  "otto-cli": { persona: "otto", cell: { surface: "cli" } },
  "otto-desktop": { persona: "otto", cell: { surface: "desktop" } },
  "otto-vscode": { persona: "otto", cell: { surface: "vscode" } },
  "otto-windows": { persona: "otto", cell: { surface: "windows" } },
  "alexa-cli": { persona: "alexa", cell: { surface: "cli" } },
  "alexa-kiro": { persona: "alexa", cell: { surface: "kiro" } },
  "riven-cli": { persona: "riven", cell: { surface: "cli" } },
  "riven-cursor": { persona: "riven", cell: { surface: "cursor" } },
  "lior-antigravity": { persona: "lior", cell: { surface: "antigravity" } },
  "lior-gemini": { persona: "lior", cell: { surface: "gemini" } },
  "vera-codex": { persona: "vera", cell: { surface: "codex" } },
};

/**
 * Parse a string projection of an actor ref into its structured format.
 * Supports legacy composites (e.g. "otto-cli") and new canonical grammar:
 * `<persona>/<surface>[/<instance>][@<node>]`
 */
// Segment charset: lowercase alnum start, then alnum/dot/underscore/dash.
// Culture-invariant, byte-stable; excludes "/" and "@" (grammar chars) and
// uppercase. The invalid-vector class of the treaty byte-lock floor.
const SEGMENT_RE = /^[a-z0-9][a-z0-9._-]*$/;

function assertSegment(kind: string, value: string, source: string): void {
  if (!SEGMENT_RE.test(value)) {
    throw new Error(`Invalid ${kind} segment "${value}" in actor ref "${source}" (must match ${String(SEGMENT_RE)})`);
  }
}

/**
 * Split off an optional `@node` suffix, rejecting multiple "@" and an invalid
 * node segment (INVALID_VECTORS: "otto/cli@a@b").
 *
 * Shared by BOTH doors into `ActorRef` — the canonical-string parser and the
 * SPIFFE-URI parser. F# parity: `ActorRef.splitNode` (`src/Core/ActorRef.fs`).
 * One implementation is what keeps the two doors from disagreeing about the
 * invalid-vector class; they disagreed for as long as they were separate.
 */
function splitNode(input: string, source: string): { remaining: string; node: string | undefined } {
  const atIdx = input.indexOf("@");
  if (atIdx === -1) {
    return { remaining: input, node: undefined };
  }
  if (input.indexOf("@", atIdx + 1) !== -1) {
    throw new Error(`Invalid actor ref (multiple "@"): "${source}"`);
  }
  const node = input.substring(atIdx + 1);
  assertSegment("node", node, source);
  return { remaining: input.substring(0, atIdx), node };
}

/**
 * Assemble a validated `CellRef` from grammar pieces. Enforces the segment
 * charset on surface/instance, rejects empty segments (INVALID_VECTORS:
 * "otto//fg") and node-without-surface (INVALID_VECTORS: "otto@machine-a").
 *
 * Shared by BOTH doors. F# parity: `ActorRef.assemble` (`src/Core/ActorRef.fs`).
 */
function assembleCell(
  surface: string | undefined,
  instance: string | undefined,
  node: string | undefined,
  source: string,
): CellRef {
  const cell: CellRef = {};
  if (surface !== undefined) {
    if (surface === "") {
      throw new Error(`Invalid actor ref (empty surface segment): "${source}"`);
    }
    assertSegment("surface", surface, source);
    cell.surface = surface;
  }
  if (instance !== undefined) {
    if (instance === "") {
      throw new Error(`Invalid actor ref (empty instance segment): "${source}"`);
    }
    assertSegment("instance", instance, source);
    cell.instance = instance;
  }
  if (node !== undefined) {
    if (cell.surface === undefined) {
      throw new Error(`Invalid actor ref (node requires a surface): "${source}"`);
    }
    cell.node = node;
  }
  return cell;
}

export function parse(str: string): ActorRef {
  if (!str) {
    throw new Error("Cannot parse empty actor reference string.");
  }

  // Check legacy map first
  const matched = Object.prototype.hasOwnProperty.call(LEGACY_MAP, str) ? LEGACY_MAP[str] : undefined;
  if (matched !== undefined) {
    return {
      persona: matched.persona,
      cell: { ...matched.cell },
    };
  }

  // Extract optional @node suffix (exactly zero or one "@")
  const { remaining, node } = splitNode(str, str);

  // Split remainder into persona, surface, instance
  const parts = remaining.split("/");
  const persona = parts[0] as PersonaId;

  if (!VALID_PERSONAS.has(persona)) {
    throw new Error(`Invalid persona identifier: "${persona}" in actor ref string "${str}"`);
  }
  if (parts.length > 3) {
    throw new Error(`Invalid canonical actor ref (too many segments): "${str}"`);
  }

  const cell = assembleCell(
    parts.length > 1 ? parts[1] : undefined,
    parts.length > 2 ? parts[2] : undefined,
    node,
    str,
  );

  return { persona, cell };
}

/**
 * Project a structured ActorRef into its canonical string projection format:
 * `<persona>/<surface>[/<instance>][@<node>]`
 * If cell is empty, projects to just `<persona>`.
 */
export function project(actor: ActorRef): string {
  if (!actor || !actor.persona) {
    throw new Error("Cannot project invalid ActorRef.");
  }

  let str: string = actor.persona;
  if (actor.cell.surface) {
    str += `/${actor.cell.surface}`;
    if (actor.cell.instance) {
      str += `/${actor.cell.instance}`;
    }
  }
  if (actor.cell.node) {
    str += `@${actor.cell.node}`;
  }
  return str;
}

/**
 * Convert a structured ActorRef to its canonical SPIFFE ID URI format:
 * `spiffe://zeta/persona/<persona>[/cell/<surface>[/<instance>][@<node>]]`
 */
export function toSpiffe(actor: ActorRef): string {
  if (!actor || !actor.persona) {
    throw new Error("Cannot format invalid ActorRef to SPIFFE URI.");
  }

  let uri = `spiffe://zeta/persona/${actor.persona}`;
  if (actor.cell.surface) {
    uri += `/cell/${actor.cell.surface}`;
    if (actor.cell.instance) {
      uri += `/${actor.cell.instance}`;
    }
  }
  if (actor.cell.node) {
    uri += `@${actor.cell.node}`;
  }
  return uri;
}

/**
 * Parse a canonical SPIFFE ID URI format back into a structured ActorRef.
 */
export function parseSpiffe(uri: string): ActorRef {
  const prefix = "spiffe://zeta/persona/";
  if (!uri || !uri.startsWith(prefix)) {
    throw new Error(`Invalid SPIFFE URI prefix: "${uri}" (expected "${prefix}...")`);
  }

  // Extract optional @node suffix. Routed through the SAME `splitNode` the
  // canonical parser uses, so "@a@b" and an out-of-charset node are rejected
  // here too. This door faces PEERS (a SPIFFE URI is what another node sends),
  // so it must be at least as strict as the internal one — it was laxer.
  const { remaining, node } = splitNode(uri.substring(prefix.length), uri);

  const parts = remaining.split("/");
  const persona = parts[0] as PersonaId;

  if (!VALID_PERSONAS.has(persona)) {
    throw new Error(`Invalid persona identifier: "${persona}" in SPIFFE URI "${uri}"`);
  }

  let surface: string | undefined = undefined;
  let instance: string | undefined = undefined;
  if (parts.length > 1) {
    if (parts[1] !== "cell") {
      throw new Error(`Invalid SPIFFE URI segment: "${parts[1]}" (expected "/cell/...")`);
    }
    if (parts.length < 3) {
      throw new Error(`Invalid SPIFFE URI: missing cell surface kind in "${uri}"`);
    }
    if (parts.length > 4) {
      throw new Error(`Invalid SPIFFE URI (too many segments): "${uri}"`);
    }
    surface = parts[2];
    instance = parts.length > 3 ? parts[3] : undefined;
  }

  const cell = assembleCell(surface, instance, node, uri);

  return { persona, cell };
}

/**
 * GoldenVector definition.
 */
export interface GoldenVector {
  readonly stringProj: string;
  readonly spiffeUri: string;
  readonly actorRef: ActorRef;
}

/**
 * The mechanical byte-lock floor for Persona/Cell identity.
 * Includes legacy composite mapping (which roundtrips to canonical)
 * and new canonical + SPIFFE layout options.
 */
export const GOLDEN_VECTORS: GoldenVector[] = [
  {
    stringProj: "otto",
    spiffeUri: "spiffe://zeta/persona/otto",
    actorRef: { persona: "otto", cell: {} },
  },
  {
    stringProj: "alexa",
    spiffeUri: "spiffe://zeta/persona/alexa",
    actorRef: { persona: "alexa", cell: {} },
  },
  {
    stringProj: "otto-cli",
    spiffeUri: "spiffe://zeta/persona/otto/cell/cli",
    actorRef: { persona: "otto", cell: { surface: "cli" } },
  },
  {
    stringProj: "otto-desktop",
    spiffeUri: "spiffe://zeta/persona/otto/cell/desktop",
    actorRef: { persona: "otto", cell: { surface: "desktop" } },
  },
  {
    stringProj: "otto-vscode",
    spiffeUri: "spiffe://zeta/persona/otto/cell/vscode",
    actorRef: { persona: "otto", cell: { surface: "vscode" } },
  },
  {
    stringProj: "otto-windows",
    spiffeUri: "spiffe://zeta/persona/otto/cell/windows",
    actorRef: { persona: "otto", cell: { surface: "windows" } },
  },
  {
    stringProj: "alexa-kiro",
    spiffeUri: "spiffe://zeta/persona/alexa/cell/kiro",
    actorRef: { persona: "alexa", cell: { surface: "kiro" } },
  },
  {
    stringProj: "riven-cursor",
    spiffeUri: "spiffe://zeta/persona/riven/cell/cursor",
    actorRef: { persona: "riven", cell: { surface: "cursor" } },
  },
  {
    stringProj: "lior-antigravity",
    spiffeUri: "spiffe://zeta/persona/lior/cell/antigravity",
    actorRef: { persona: "lior", cell: { surface: "antigravity" } },
  },
  {
    stringProj: "vera-codex",
    spiffeUri: "spiffe://zeta/persona/vera/cell/codex",
    actorRef: { persona: "vera", cell: { surface: "codex" } },
  },
  {
    stringProj: "otto/cli",
    spiffeUri: "spiffe://zeta/persona/otto/cell/cli",
    actorRef: { persona: "otto", cell: { surface: "cli" } },
  },
  {
    stringProj: "otto/cli/fg",
    spiffeUri: "spiffe://zeta/persona/otto/cell/cli/fg",
    actorRef: { persona: "otto", cell: { surface: "cli", instance: "fg" } },
  },
  {
    stringProj: "otto/cli/fg@node-a",
    spiffeUri: "spiffe://zeta/persona/otto/cell/cli/fg@node-a",
    actorRef: { persona: "otto", cell: { surface: "cli", instance: "fg", node: "node-a" } },
  },
  {
    stringProj: "aaron/desktop@machine-b",
    spiffeUri: "spiffe://zeta/persona/aaron/cell/desktop@machine-b",
    actorRef: { persona: "aaron", cell: { surface: "desktop", node: "machine-b" } },
  },
  {
    // verifier-node is a SURFACE (registry/cell-surfaces.yaml), not a node —
    // vector corrected 2026-07-04 (Otto phase 4); node-without-surface is in
    // INVALID_VECTORS ("otto@machine-a").
    stringProj: "soraya/verifier-node",
    spiffeUri: "spiffe://zeta/persona/soraya/cell/verifier-node",
    actorRef: { persona: "soraya", cell: { surface: "verifier-node" } },
  },
];

/**
 * Invalid-vector class of the treaty byte-lock floor. The list lives in
 * `tests/cross-verification/actor-ref/vectors.json` — one file, every
 * oracle. Adding a row there with no parser change must turn a test red
 * (081M00J1EWW).
 */
export const ACTOR_REF_VECTORS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../tests/cross-verification/actor-ref/vectors.json",
);

function loadSharedInvalid(door: "parse" | "parseSpiffe"): readonly string[] {
  const doc = JSON.parse(readFileSync(ACTOR_REF_VECTORS_PATH, "utf8")) as {
    invalid: readonly { input: string; door: "parse" | "parseSpiffe" }[];
  };
  return doc.invalid.filter((v) => v.door === door).map((v) => v.input);
}

export const INVALID_VECTORS: readonly string[] = loadSharedInvalid("parse");

/**
 * The SAME rejection class, expressed through the SPIFFE URI port.
 *
 * A SPIFFE URI is the door a PEER knocks on — it arrives from another node,
 * not from our own call sites — so it is the door that most needs the floor.
 * Until 2026-08-14 this port enforced almost none of it: four of the seven
 * INVALID_VECTORS above were accepted through it while the canonical parser
 * rejected them, and two of those produced an `ActorRef` that silently LOST a
 * segment on the way back out (`.../cell//fg` → surface "", instance "fg" →
 * projects to bare "otto", colliding with a genuinely different identity).
 *
 * F# parity: `Invalid SPIFFE vectors — same rejection class through the URI
 * port` in `tests/Tests.FSharp/ActorRef.Tests.fs`, which has asserted these
 * since the F# port landed. The F# oracle was right and this one was wrong.
 */
export const INVALID_SPIFFE_VECTORS: readonly string[] = loadSharedInvalid("parseSpiffe");
