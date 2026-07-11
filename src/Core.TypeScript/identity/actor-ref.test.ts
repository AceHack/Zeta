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

import { INVALID_VECTORS, parse as parseRef } from "./actor-ref.ts";
import { describe as d2, expect as e2, test as t2 } from "bun:test";

d2("invalid vectors — byte-lock floor rejection class", () => {
  for (const bad of INVALID_VECTORS) {
    t2(`rejects ${bad}`, () => {
      e2(() => parseRef(bad)).toThrow();
    });
  }
});
