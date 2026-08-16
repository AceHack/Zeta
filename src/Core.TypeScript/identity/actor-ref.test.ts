import { test, expect, describe } from "bun:test";
import {
  parse,
  project,
  parseSpiffe,
  toSpiffe,
  GOLDEN_VECTORS,
} from "./actor-ref";

describe("ActorRef Identity Parser and Projector", () => {
  test("Golden Vectors - parse and project roundtrip", () => {
    for (const vector of GOLDEN_VECTORS) {
      // 1. String projection parsing must resolve to the correct ActorRef
      const parsedActor = parse(vector.stringProj);
      expect(parsedActor).toEqual(vector.actorRef);

      // 2. Projecting the actor ref should match the canonical format
      // Note: Legacy inputs (like "otto-cli") will project to their canonical equivalent ("otto/cli").
      const projectedString = project(vector.actorRef);
      
      const expectedProj: Record<string, string> = {
        "otto-cli": "otto/cli",
        "otto-desktop": "otto/desktop",
        "otto-vscode": "otto/vscode",
        "otto-windows": "otto/windows",
        "alexa-kiro": "alexa/kiro",
        "riven-cursor": "riven/cursor",
        "lior-antigravity": "lior/antigravity",
        "vera-codex": "vera/codex"
      };

      const expected = expectedProj[vector.stringProj];
      if (expected !== undefined) {
        expect(projectedString).toBe(expected);
      } else {
        expect(projectedString).toBe(vector.stringProj);
      }
    }
  });

  test("Golden Vectors - SPIFFE URIs parse and project roundtrip", () => {
    for (const vector of GOLDEN_VECTORS) {
      // 1. SPIFFE URI parsing must resolve to the correct ActorRef
      const parsedActor = parseSpiffe(vector.spiffeUri);
      expect(parsedActor).toEqual(vector.actorRef);

      // 2. Formatting actor ref to SPIFFE URI must match
      const spiffeUri = toSpiffe(vector.actorRef);
      expect(spiffeUri).toBe(vector.spiffeUri);
    }
  });

  test("Invalid actor reference string formats throw errors", () => {
    // Non-existent persona
    expect(() => parse("invalidagent/cli")).toThrow(/Invalid persona identifier/);
    
    // Too many slash segments
    expect(() => parse("otto/cli/instance/extra")).toThrow(/too many segments/);
    
    // Empty input
    expect(() => parse("")).toThrow(/empty/);
  });

  test("Invalid SPIFFE URI formats throw errors", () => {
    // Malformed prefix
    expect(() => parseSpiffe("http://zeta/persona/otto")).toThrow(/Invalid SPIFFE URI prefix/);
    
    // Non-existent persona
    expect(() => parseSpiffe("spiffe://zeta/persona/invalidagent/cell/cli")).toThrow(/Invalid persona identifier/);
    
    // Missing cell label segment
    expect(() => parseSpiffe("spiffe://zeta/persona/otto/invalid/cli")).toThrow(/expected "\/cell\/..."/);
    
    // Missing surface kind
    expect(() => parseSpiffe("spiffe://zeta/persona/otto/cell")).toThrow(/missing cell surface kind/);
    
    // Too many segments
    expect(() => parseSpiffe("spiffe://zeta/persona/otto/cell/cli/fg/extra")).toThrow(/too many segments/);
  });
});

import {
  INVALID_VECTORS,
  INVALID_SPIFFE_VECTORS,
  parse as parseRef,
  parseSpiffe as parseSpiffeRef,
  project as projectRef,
  toSpiffe as toSpiffeRef,
} from "./actor-ref.ts";
import { describe as d2, expect as e2, test as t2 } from "bun:test";

d2("invalid vectors — byte-lock floor rejection class", () => {
  t2("the shared file is the only list (081M00J1EWW)", () => {
    e2(INVALID_VECTORS.length).toBeGreaterThan(0);
    e2(INVALID_SPIFFE_VECTORS.length).toBeGreaterThan(0);
  });
  for (const bad of INVALID_VECTORS) {
    t2(`rejects ${bad}`, () => {
      e2(() => parseRef(bad)).toThrow();
    });
  }
});

// ═══ The same floor, through the PEER-FACING door ════════════════════════════
//
// Regression class for the 2026-08-14 two-oracle divergence: the F# oracle
// rejected these through `parseSpiffe`, the TypeScript oracle accepted them.

d2("invalid SPIFFE vectors — same rejection class through the URI port", () => {
  for (const bad of INVALID_SPIFFE_VECTORS) {
    t2(`rejects ${bad}`, () => {
      e2(() => parseSpiffeRef(bad)).toThrow();
    });
  }
});

// ═══ The LAW, not the case list ══════════════════════════════════════════════
//
// A case list only catches the vectors someone thought of. These two tests are
// closure properties: they fail for ANY input where the doors disagree, whether
// or not it is in a list.

d2("cross-door closure laws", () => {
  // Every corpus string that could reach either door.
  const corpus: readonly string[] = [
    ...INVALID_VECTORS,
    ...INVALID_SPIFFE_VECTORS,
    "otto",
    "otto/cli",
    "otto/cli/fg",
    "otto/cli/fg@node-a",
    "aaron/desktop@machine-b",
    "soraya/verifier-node",
    "spiffe://zeta/persona/otto",
    "spiffe://zeta/persona/otto/cell/cli",
    "spiffe://zeta/persona/otto/cell/cli/fg",
    "spiffe://zeta/persona/otto/cell/cli/fg@node-a",
  ];

  t2("LAW: anything parseSpiffe accepts survives parse∘project unchanged", () => {
    // The break this catches: parseSpiffe used to mint ActorRefs that the
    // canonical parser rejected (COWORK, "@a@b", node-without-surface) or
    // silently altered (empty surface swallowing the instance).
    let accepted = 0;
    for (const s of corpus) {
      let ref;
      try {
        ref = parseSpiffeRef(s);
      } catch {
        continue; // rejected at the door — nothing to close over
      }
      accepted++;
      const round = parseRef(projectRef(ref)); // MUST NOT throw
      e2(round).toEqual(ref); // MUST NOT silently differ
    }
    // Guard the guard: if parseSpiffe rejected everything, the loop above is
    // vacuous and would pass while proving nothing.
    e2(accepted).toBeGreaterThan(0);
  });

  t2("LAW: anything parse accepts survives toSpiffe∘parseSpiffe unchanged", () => {
    let accepted = 0;
    for (const s of corpus) {
      let ref;
      try {
        ref = parseRef(s);
      } catch {
        continue;
      }
      accepted++;
      const round = parseSpiffeRef(toSpiffeRef(ref));
      e2(round).toEqual(ref);
    }
    e2(accepted).toBeGreaterThan(0);
  });

  t2("LAW: the two doors agree on the verdict for the same identity", () => {
    // Same identity, two encodings; accept/reject must match. This is the
    // property the F# and TS oracles are supposed to share.
    const pairs: readonly (readonly [string, string])[] = [
      ["otto/COWORK", "spiffe://zeta/persona/otto/cell/COWORK"],
      ["otto//fg", "spiffe://zeta/persona/otto/cell//fg"],
      ["otto/cli@a@b", "spiffe://zeta/persona/otto/cell/cli@a@b"],
      ["otto@machine-a", "spiffe://zeta/persona/otto@machine-a"],
      ["kenji/cli", "spiffe://zeta/persona/kenji/cell/cli"],
      ["otto/cli/fg/extra", "spiffe://zeta/persona/otto/cell/cli/fg/extra"],
      ["otto/cli", "spiffe://zeta/persona/otto/cell/cli"],
      ["otto/cli/fg@node-a", "spiffe://zeta/persona/otto/cell/cli/fg@node-a"],
    ];
    const verdict = (f: () => unknown): boolean => {
      try {
        f();
        return true;
      } catch {
        return false;
      }
    };
    for (const [canonical, spiffe] of pairs) {
      e2({
        input: canonical,
        canonicalAccepted: verdict(() => parseRef(canonical)),
      }).toEqual({
        input: canonical,
        canonicalAccepted: verdict(() => parseSpiffeRef(spiffe)),
      });
    }
  });
});
