// _firewall.test.ts -- closes the coverage gap deferred by smoke.test.ts:35
// ("Input firewall behavior covered by _firewall.ts itself when its own
// tests land"). Designed by Soraya (formal-verification-expert) on Otto's
// invocation; routing verdict: pure/total/deterministic classifier ->
// table-driven unit tests (every decision branch) + fast-check properties
// (totality, determinism, the two unconditional accept laws). NOT TLA+/Z3/
// Lean -- no temporal, arithmetic-identity, or deep-math axis to discharge.
//
// CONTRACT NOTE (peer pushback, intentional and documented, not a bug):
// peerFirewallCheck is a COARSE spam-gate, deliberately asymmetric -- it
// favors false-ACCEPT over false-REJECT, because rejecting a real peer call
// is worse than admitting a marginal one. The trigger check is a SUBSTRING
// match, so non-substantive prompts that merely CONTAIN a trigger substring
// (e.g. "spec" inside "especially") pass. _firewall.ts's own header already
// disclaims detection of "manipulative framing"; this suite encodes that
// looseness as the intended contract (see "documented coarseness" below),
// so a future tightening must consciously update these expectations.
//
// ASCII only (BP-09).

import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
  peerFirewallCheck,
  DEFAULT_SUBSTANTIVE_TRIGGERS,
  CLAUDE_SUBSTANTIVE_TRIGGERS,
} from "./_firewall.ts";

// ─── Branch-by-branch fixture table (the "test prompts") ────────────────────
//
// Each row names the decision branch in peerFirewallCheck it pins. `verdict`
// is "reject" (returns a MISSING_PAYLOAD:* string) or "accept" (returns null).
// `reasonFragment` is asserted as a substring of the rejection string so a
// reason-code rename is caught.

interface Fixture {
  readonly id: string;
  readonly prompt: string;
  readonly verdict: "accept" | "reject";
  readonly reasonFragment?: string;
}

const FIXTURES: readonly Fixture[] = [
  // --- REJECT: rote-heartbeat shapes (len < 100, isRoteHeartbeat) ---
  { id: "R1 bare heartbeat", prompt: "tick heartbeat", verdict: "reject", reasonFragment: "rote-heartbeat-pattern" },
  { id: "R2 tick-N digits", prompt: "Tick N 42 heartbeat", verdict: "reject", reasonFragment: "rote-heartbeat-pattern" },
  { id: "R3 minimal heartbeat", prompt: "Tick 7 minimal heartbeat", verdict: "reject", reasonFragment: "rote-heartbeat-pattern" },
  { id: "R4 brief plotmirror", prompt: "tick 3 brief plotmirror", verdict: "reject", reasonFragment: "rote-heartbeat-pattern" },
  { id: "R5 brief plot mirror", prompt: "tick 3 brief plot mirror", verdict: "reject", reasonFragment: "rote-heartbeat-pattern" },

  // --- REJECT: bare tick + Otto sign-off (isBareTickSignoff) ---
  { id: "R6 bare signoff", prompt: "Tick 5 Otto", verdict: "reject", reasonFragment: "bare-tick-signoff" },

  // --- REJECT: no extractable payload, short and medium band ---
  { id: "R7 short no-payload (the smoke 'hi' case)", prompt: "hi", verdict: "reject", reasonFragment: "no-trust-calculus-payload-detected" },
  {
    id: "R8 medium band no-payload (100 <= len < 400)",
    // ~120 chars, no trigger substring, no '?' / '```' / '{\"'.
    prompt: "the quick brown fox jumps over a lazy dog while the morning fog lingers on the hills near the old mill and the town sleeps",
    verdict: "reject",
    reasonFragment: "no-trust-calculus-payload-detected",
  },

  // --- ACCEPT: substantive trigger present ---
  { id: "A1 trigger 'design' (the live summon fixture)", prompt: "design test prompt", verdict: "accept" },

  // --- ACCEPT: escape hatches (question / code-block / json), even when short ---
  { id: "A2 question mark, short", prompt: "ready?", verdict: "accept" },
  { id: "A3 code block", prompt: "see this ``` x = 1 ``` snippet", verdict: "accept" },
  { id: "A4 json object opener", prompt: 'please send {"k":1}', verdict: "accept" },

  // --- ACCEPT: long prompt (len >= 400) passes unconditionally ---
  {
    id: "A5 long >= 400, no trigger",
    prompt: ("the quick brown fox jumps over a lazy dog while the morning fog lingers on the hills near the old mill and the town sleeps ").repeat(4),
    verdict: "accept",
  },

  // --- PRECEDENCE: heartbeat check runs BEFORE the trigger check (len < 100) ---
  // "design" is a trigger, but a tick-heartbeat shape under 100 chars is
  // rejected first. This locks the branch ORDER, not just the branches.
  { id: "P1 heartbeat beats trigger when short", prompt: "tick heartbeat design", verdict: "reject", reasonFragment: "rote-heartbeat-pattern" },

  // --- DOCUMENTED COARSENESS: substring trigger match (intended false-accept) ---
  // "especially" contains the substring "spec" (a DEFAULT trigger). This
  // ACCEPTS a non-substantive prompt. Asserting it as accept records the
  // contract: the gate is deliberately permissive. Flip this to "reject"
  // only when the trigger match is intentionally tightened to word-boundary.
  { id: "L1 substring looseness ('spec' in 'especially')", prompt: "especially nothing real to do here right now", verdict: "accept" },
];

describe("peerFirewallCheck -- decision-branch fixture table", () => {
  for (const fx of FIXTURES) {
    test(fx.id, () => {
      const result = peerFirewallCheck(fx.prompt);
      if (fx.verdict === "accept") {
        expect(result).toBeNull();
      } else {
        expect(result).not.toBeNull();
        expect(result!.startsWith("MISSING_PAYLOAD:")).toBe(true);
        if (fx.reasonFragment) {
          expect(result!.includes(fx.reasonFragment)).toBe(true);
        }
      }
    });
  }
});

// ─── Per-trigger-list sensitivity (cross-list fixture) ──────────────────────
// "wake" is a CLAUDE trigger but NOT a DEFAULT trigger. The same prompt must
// flip verdict with the trigger list -- proving the triggers parameter is
// actually consulted (not a hardcoded DEFAULT).
describe("peerFirewallCheck -- trigger list is parameterized", () => {
  const prompt = "time to wake"; // 'wake' substring, no '?'/code/json, len < 100, not a tick shape

  test("rejected under DEFAULT triggers", () => {
    const r = peerFirewallCheck(prompt, DEFAULT_SUBSTANTIVE_TRIGGERS);
    expect(r).not.toBeNull();
    expect(r!.includes("no-trust-calculus-payload-detected")).toBe(true);
  });

  test("accepted under CLAUDE triggers ('wake')", () => {
    expect(peerFirewallCheck(prompt, CLAUDE_SUBSTANTIVE_TRIGGERS)).toBeNull();
  });
});

// ─── Properties (fast-check, BP-16 cross-check) ─────────────────────────────

describe("peerFirewallCheck -- properties", () => {
  test("P-total: returns null or a MISSING_PAYLOAD string for ANY input (never throws)", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const r = peerFirewallCheck(s);
        return r === null || r.startsWith("MISSING_PAYLOAD:");
      }),
    );
  });

  test("P-deterministic: pure -- same input yields identical output", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        return peerFirewallCheck(s) === peerFirewallCheck(s);
      }),
    );
  });

  test("P-long-accept: any prompt of length >= 400 is accepted (unconditional law)", () => {
    fc.assert(
      // heartbeat/signoff branch only runs for len < 100, so >= 400 always
      // reaches the `if (len >= 400) return null` gate.
      fc.property(fc.string({ minLength: 400, maxLength: 2000 }), (s) => {
        return peerFirewallCheck(s) === null;
      }),
    );
  });

  test("P-question-accept: a prompt containing '?' and len >= 100 is accepted", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 99, maxLength: 300 }), (s) => {
        // len >= 100 so the heartbeat branch is skipped; '?' is step 2.
        const withQ = s + "?";
        return peerFirewallCheck(withQ) === null;
      }),
    );
  });
});
