import { VALID_PERSONAS } from "./generated-registry.js";

/**
 * Map of legacy SENDER_IDS composites and bare personas to their structured ActorRef representation.
 */
const LEGACY_MAP = {
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
 */
export function parse(str) {
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

  let remaining = str;
  let node = undefined;

  // Extract optional @node suffix
  const atIdx = remaining.indexOf("@");
  if (atIdx !== -1) {
    node = remaining.substring(atIdx + 1);
    remaining = remaining.substring(0, atIdx);
  }

  // Split remainder into persona, surface, instance
  const parts = remaining.split("/");
  const persona = parts[0];

  if (!VALID_PERSONAS.has(persona)) {
    throw new Error(`Invalid persona identifier: "${persona}" in actor ref string "${str}"`);
  }

  const cell = {};
  if (parts.length > 1) {
    const s = parts[1];
    if (s !== undefined) {
      cell.surface = s;
    }
  }
  if (parts.length > 2) {
    const inst = parts[2];
    if (inst !== undefined) {
      cell.instance = inst;
    }
  }
  if (parts.length > 3) {
    throw new Error(`Invalid canonical actor ref (too many segments): "${str}"`);
  }
  if (node !== undefined) {
    cell.node = node;
  }

  return { persona, cell };
}

/**
 * Project a structured ActorRef into its canonical string projection format.
 */
export function project(actor) {
  if (!actor || !actor.persona) {
    throw new Error("Cannot project invalid ActorRef.");
  }

  let str = actor.persona;
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
 * Convert a structured ActorRef to its canonical SPIFFE ID URI format.
 */
export function toSpiffe(actor) {
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
export function parseSpiffe(uri) {
  const prefix = "spiffe://zeta/persona/";
  if (!uri || !uri.startsWith(prefix)) {
    throw new Error(`Invalid SPIFFE URI prefix: "${uri}" (expected "${prefix}...")`);
  }

  let remaining = uri.substring(prefix.length);
  let node = undefined;

  // Extract optional @node suffix
  const atIdx = remaining.indexOf("@");
  if (atIdx !== -1) {
    node = remaining.substring(atIdx + 1);
    remaining = remaining.substring(0, atIdx);
  }

  const parts = remaining.split("/");
  const persona = parts[0];

  if (!VALID_PERSONAS.has(persona)) {
    throw new Error(`Invalid persona identifier: "${persona}" in SPIFFE URI "${uri}"`);
  }

  const cell = {};
  if (parts.length > 1) {
    if (parts[1] !== "cell") {
      throw new Error(`Invalid SPIFFE URI segment: "${parts[1]}" (expected "/cell/...")`);
    }
    if (parts.length < 3) {
      throw new Error(`Invalid SPIFFE URI: missing cell surface kind in "${uri}"`);
    }
    const s = parts[2];
    if (s !== undefined) {
      cell.surface = s;
    }
    if (parts.length > 3) {
      const inst = parts[3];
      if (inst !== undefined) {
        cell.instance = inst;
      }
    }
    if (parts.length > 4) {
      throw new Error(`Invalid SPIFFE URI (too many segments): "${uri}"`);
    }
  }

  if (node !== undefined) {
    cell.node = node;
  }

  return { persona, cell };
}

export const GOLDEN_VECTORS = [
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
    stringProj: "soraya@verifier-node",
    spiffeUri: "spiffe://zeta/persona/soraya@verifier-node",
    actorRef: { persona: "soraya", cell: { node: "verifier-node" } },
  },
];
