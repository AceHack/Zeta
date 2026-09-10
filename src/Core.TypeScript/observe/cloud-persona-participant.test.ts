/**
 * observe/cloud-persona-participant.test.ts — what `cloudPersonaParticipant`
 * does when the peer it summoned does not answer.
 *
 * ── WHY THIS FILE IS HERE, AND WHY IT HAS NO TRANSPORT IN IT ────────────────
 * This is one half of the former `observe/udp-lossy-loop.test.ts`, which stood
 * up a whole lossy UDP mesh, a multiplexed duplex transport, a served persona
 * and an interruptible model loop — six `model-backend/` modules — in order to
 * make a summon return a non-zero exit code, and then asserted on what the
 * participant did with it.
 *
 * The participant does not know any of that exists. It takes an `ISummon`
 * (`protocol/summon-contract.ts`) and reads a `SummonResult`, so the honest
 * subject of these assertions is: given a result, what index does it report and
 * does it admit to falling back. That needs an object literal, not a network.
 * Constructing the real stack to produce a failing result was seven of the
 * meta-harness's 38 measured back-edges
 * (`docs/research/2026-09-09-repo-split-round-4-*.md` §3.1) — and, separately
 * from the edge count, it made the test slow, timing-dependent, and unable to
 * say which layer had broken when it went red.
 *
 * The transport claim it used to carry is not lost: it is asserted directly,
 * against the transport, in `model-backend/udp-lossy-persona-interrupt.test.ts`.
 * Together the two files assert strictly more than the one file did, because
 * each now names its own subject.
 */

import { describe, expect, test } from "bun:test";
import { cloudPersonaParticipant } from "./participant.ts";
import type { NextAction } from "./observe.ts";
import type { ISummon, SummonResult } from "../protocol/summon-contract.ts";

const MENU: readonly NextAction[] = [{ kind: "explore", reason: "test-nav" }];
const WORLD = { backlog: [], mode: "explore" } as const;

/** An `ISummon` that answers with whatever it was handed. */
function fixedSummoner(result: SummonResult): ISummon {
  return { summon: () => Promise.resolve(result) };
}

/** An `ISummon` that never returns a result at all. */
function throwingSummoner(message: string): ISummon {
  return {
    summon: () => Promise.reject(new Error(message)),
  };
}

describe("cloudPersonaParticipant — the peer did not answer", () => {
  test("an interrupted summon (exit 2) falls back to index 0 and says so", async () => {
    // Exactly the shape the persona transport produces when a 'stop' signal
    // reaches a served loop mid-turn: not-success, exit 2, the reason on stderr.
    const participant = cloudPersonaParticipant(
      fixedSummoner({
        success: false,
        exitCode: 2,
        outputFile: "",
        stdout: "",
        stderr: "persona loop interrupted (feedback corner)",
      }),
      "UniversalGrammarPersona",
    );

    const result = await participant.choose(WORLD, MENU);

    expect(result.fallback).toBe(true);
    expect(result.raw).toBe("summon-error:2");
    expect(result.index).toBe(0);
    expect(result.cause).toBe("backend-error");
  });

  test("the exit code travels into `raw`, so a fallback names WHICH failure", async () => {
    // A firewall rejection is exit 3, not exit 2. The participant reports the
    // code rather than flattening every failure to one string — the caller's
    // oracle decides what a 3 means, not this bridge.
    const participant = cloudPersonaParticipant(
      fixedSummoner({ success: false, exitCode: 3, outputFile: "", stdout: "", stderr: "rejected" }),
      "UniversalGrammarPersona",
    );

    const result = await participant.choose(WORLD, MENU);

    expect(result.raw).toBe("summon-error:3");
    expect(result.fallback).toBe(true);
  });

  test("a summoner that THROWS is a different fact from one that fails", async () => {
    const participant = cloudPersonaParticipant(throwingSummoner("wire down"), "UniversalGrammarPersona");

    const result = await participant.choose(WORLD, MENU);

    expect(result.raw).toBe("summon-failed");
    expect(result.fallback).toBe(true);
    expect(result.index).toBe(0);
  });

  test("a peer that answers with an index is NOT a fallback", async () => {
    // The control the old test never had: without this, every assertion above
    // would still pass if `choose` returned a fallback unconditionally.
    const participant = cloudPersonaParticipant(
      fixedSummoner({ success: true, exitCode: 0, outputFile: "", stdout: "0", stderr: "" }),
      "UniversalGrammarPersona",
    );

    const result = await participant.choose(WORLD, MENU);

    expect(result.fallback).toBe(false);
    expect(result.index).toBe(0);
    expect(result.cause).toBe("none");
  });
});
