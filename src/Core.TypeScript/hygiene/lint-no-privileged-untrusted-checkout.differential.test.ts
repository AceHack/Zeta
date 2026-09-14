// lint-no-privileged-untrusted-checkout.differential.test.ts
//
// SPLIT OUT ON PURPOSE. The production checker runs in `lint (build-graph completeness)`,
// a job that sets up bun but never runs `bun install` -- so neither it nor the unit tests
// listed in that job may import a package. This file DOES import `yaml`, so it deliberately
// lives outside that list and runs only in the hermetic tier, which has dependencies.
//
// Keeping the differential rather than deleting it is the point: a hand-rolled YAML reader
// under-reports silently, and under-reporting here means missing a real privileged+untrusted
// pair. The reader is therefore compared against the real parser over every workflow in the
// tree -- checked, not trusted.

import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { checkoutRefs, triggersOf } from "./lint-no-privileged-untrusted-checkout.ts";

// ─────────────────────────────────────────────────────────────────────────────
// THE HAND PARSER IS CHECKED, NOT TRUSTED.
//
// The production file imports nothing, because it runs in a job that never runs
// `bun install`. A hand-rolled YAML reader is exactly the kind of thing that under-reports
// silently — and under-reporting here means missing a real privileged+untrusted pair. This
// tier HAS dependencies, so the reader is compared against the real `yaml` parser over every
// workflow in the tree. Divergence on any of the 96 fails.
describe("differential: the dependency-free reader agrees with the `yaml` parser", () => {
  const dir = ".github/workflows";
  const files = readdirSync(dir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

  const yamlTriggers = (doc: unknown): string[] => {
    if (doc === null || typeof doc !== "object") return [];
    const d = doc as Record<string, unknown>;
    const on = d["on"] ?? d["true"];
    if (typeof on === "string") return [on];
    if (Array.isArray(on)) return on.filter((k): k is string => typeof k === "string");
    if (on !== null && typeof on === "object") return Object.keys(on as Record<string, unknown>);
    return [];
  };

  it("finds the same trigger set in every workflow", () => {
    expect(files.length).toBeGreaterThan(50); // a shrunken corpus would make this vacuous
    for (const f of files) {
      const text = readFileSync(join(dir, f), "utf8");
      expect({ f, t: [...triggersOf(text)].sort() }).toEqual({ f, t: yamlTriggers(parse(text)).sort() });
    }
  });

  it("finds the same NUMBER of checkout steps in every workflow", () => {
    const countUses = (node: unknown): number => {
      if (Array.isArray(node)) return node.reduce<number>((a, n) => a + countUses(n), 0);
      if (node === null || typeof node !== "object") return 0;
      const o = node as Record<string, unknown>;
      const self = typeof o["uses"] === "string" && (o["uses"] as string).startsWith("actions/checkout") ? 1 : 0;
      return self + Object.values(o).reduce<number>((a, v) => a + countUses(v), 0);
    };
    for (const f of files) {
      const text = readFileSync(join(dir, f), "utf8");
      expect({ f, n: checkoutRefs(text).length }).toEqual({ f, n: countUses(parse(text)) });
    }
  });
});

describe("ref values are reported WHOLE, not truncated", () => {
  // The first version's flow-mapping regex stopped at the first `}`, so a block-form
  // `ref: ${{ ... }}` was reported truncated. Detection still worked by luck — the substring
  // it kept happened to contain the pattern — and a report you cannot read is a report you
  // will not act on. Pinned both ways.
  it("keeps the whole block-form expression", () => {
    const y = "jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n";
    expect(checkoutRefs(y)).toEqual(["${{ github.event.pull_request.head.sha }}"]);
  });

  it("still strips the flow mapping's own closing brace", () => {
    const y = 'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n        with: { ref: "${{ github.head_ref }}" }\n';
    expect(checkoutRefs(y)).toEqual(["${{ github.head_ref }}"]);
  });
});
