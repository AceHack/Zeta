/**
 * vault-state-bridge.test.ts — independent tests for the vault monitoring adapter.
 *
 * WRITTEN BY A DIFFERENT PARTY THAN THE IMPLEMENTATION, ON PURPOSE.
 *
 * The adapter shipped as 668 lines with zero tests. That matters more than usual here
 * because this module is the one that decides whether a dweller renders live, cold, stale,
 * heat, or silent — it IS the honesty surface Addison's UI shows. Tests written by the
 * author of a module share the author's blind spots; the whole reason Iris demanded
 * timestamps instead of precomputed adjectives was to make dishonesty structurally
 * impossible rather than merely intended.
 *
 * So these are written against the CONTRACT (docs/design/2026-08-01-vault-monitoring-bridge.md),
 * not against the code. Where the contract and the implementation disagree, the contract wins
 * and the test is the bug report.
 *
 * The load-bearing one is "a stopped society must never render live". Everything else is
 * support for that.
 */

import { describe, expect, test } from "bun:test";
import { buildRoster, buildVaultState, type BridgeInput, type ObserveEvent } from "./vault-state-bridge.ts";

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
const DAY = 24 * HOUR;

/** A fixed instant. Never Date.now() — the adapter injects nowMs precisely so tests can pin it. */
const NOW = Date.parse("2026-08-01T12:00:00.000Z");

let eventSeq = 0;
/** Attribution is `by`, not a nested actor object — matches the observe event on disk. */
function event(agent: string, kind: string, atMs: number): ObserveEvent {
  eventSeq += 1;
  return {
    id: `ev-${String(eventSeq)}`,
    at: new Date(atMs).toISOString(),
    by: agent,
    action: { kind },
  } as ObserveEvent;
}

/**
 * Default input carries ONE recent event, because the adapter treats an empty event list as
 * no-evidence and correctly returns cold regardless of frame age. Tests about frame-age
 * boundaries therefore have to supply evidence, or they only ever re-measure that guard.
 */
function input(overrides: Partial<BridgeInput> = {}): BridgeInput {
  return {
    events: [event("otto", "commit", NOW - 5 * MIN)],
    tickHistory: { frames: [] },
    driftLedger: null,
    nowMs: NOW,
    ...overrides,
  } as BridgeInput;
}

/** A tick frame stamped at `atMs`. Field is `t` — the metrics frame's own name. */
function frame(atMs: number) {
  return {
    t: new Date(atMs).toISOString(),
    total_events: 10,
    last_action: "commit",
    last_mode: "heal",
    last_agent: "otto",
    ticks_24h: 20,
    agents_active: 3,
  };
}

/** A tick history whose most recent frame is `ageMs` old. */
function historyAged(ageMs: number): BridgeInput["tickHistory"] {
  return { frames: [frame(NOW - ageMs)] } as BridgeInput["tickHistory"];
}

describe("THE LOAD-BEARING PROPERTY: a stopped society cannot render live", () => {
  test("no frames at all yields cold, never live", () => {
    // The failure Iris's contract exists to prevent: a frozen file claiming liveness.
    // With no data the only honest answer is cold.
    const state = buildVaultState(input({ events: [], tickHistory: { frames: [] } }));
    expect(state.status).toBe("cold");
    expect(state.status).not.toBe("live");
  });

  test("a fresh frame with NO events still reads cold — evidence, not just a heartbeat", () => {
    // A frame proves the workflow ran; events prove it did anything. Without evidence the
    // honest reading is cold, and this guard is why a society that ticks but accomplishes
    // nothing cannot present as live.
    const state = buildVaultState(input({ events: [], tickHistory: historyAged(1 * MIN) }));
    expect(state.status).toBe("cold");
  });

  test("a frame from a week ago yields cold, not live", () => {
    const state = buildVaultState(input({ tickHistory: historyAged(7 * DAY) }));
    expect(state.status).toBe("cold");
  });

  test("status degrades monotonically as the last frame ages", () => {
    // live -> stale -> cold. Age can only ever make the reading worse, never better.
    // If this ordering inverted, a long-dead society would climb back to live.
    const fresh = buildVaultState(input({ tickHistory: historyAged(1 * MIN) })).status;
    const middling = buildVaultState(input({ tickHistory: historyAged(90 * MIN) })).status;
    const ancient = buildVaultState(input({ tickHistory: historyAged(30 * DAY) })).status;

    expect(fresh).toBe("live");
    expect(middling).toBe("stale");
    expect(ancient).toBe("cold");
  });
});

describe("status boundaries are pinned on both sides", () => {
  test("just under 30 minutes is live; just over is not", () => {
    expect(buildVaultState(input({ tickHistory: historyAged(29 * MIN) })).status).toBe("live");
    expect(buildVaultState(input({ tickHistory: historyAged(31 * MIN) })).status).not.toBe("live");
  });

  test("just under 2 hours is stale; just over is cold", () => {
    expect(buildVaultState(input({ tickHistory: historyAged(119 * MIN) })).status).toBe("stale");
    expect(buildVaultState(input({ tickHistory: historyAged(121 * MIN) })).status).toBe("cold");
  });

  test("the measured real cadence (~65min) reads stale, not live", () => {
    // Grounding the boundary in the actual system rather than a round number: the heartbeat
    // declares */15 but measured 63/71/65/86/66-minute intervals on 2026-08-01. Under the
    // contract that is honestly "stale" — the society is running, just not at declared
    // cadence. A threshold that called this "live" would hide exactly the gap that motivated
    // self-hosted runners.
    expect(buildVaultState(input({ tickHistory: historyAged(65 * MIN) })).status).toBe("stale");
  });
});

describe("heat overrides freshness — failures are not hidden by a recent frame", () => {
  test("a recent failure reads heat even when the last frame is seconds old", () => {
    // Otherwise a society failing every tick still renders live, because it IS ticking.
    const state = buildVaultState(
      input({
        tickHistory: historyAged(1 * MIN),
        events: [event("otto", "heartbeat.failure", NOW - 10 * MIN)],
      }),
    );
    expect(state.status).toBe("heat");
  });

  test("an OLD failure does not pin heat forever", () => {
    // Recovery has to be observable, or heat becomes a permanent scar and the signal dies.
    const state = buildVaultState(
      input({
        tickHistory: historyAged(1 * MIN),
        events: [event("otto", "heartbeat.failure", NOW - 6 * HOUR)],
      }),
    );
    expect(state.status).toBe("live");
  });
});

describe("determinism — no ambient clock, no ambient entropy", () => {
  test("same input yields byte-identical output", () => {
    // #7 DST and #13 noninterference: nowMs is an injected parameter, so the adapter must be
    // a pure function of its input. Any Date.now() reached for internally breaks replay.
    const shared = input({
      tickHistory: historyAged(45 * MIN),
      events: [event("alexa", "commit", NOW - 20 * MIN)],
    });
    expect(JSON.stringify(buildVaultState(shared))).toBe(JSON.stringify(buildVaultState(shared)));
  });

  test("advancing only nowMs changes the reading — time is genuinely an input", () => {
    // The negative control for the test above. If output were constant under a moving clock,
    // "deterministic" would just mean "ignores its inputs".
    const frameAt = NOW - 10 * MIN;
    const early = buildVaultState(
      input({ tickHistory: { frames: [frame(frameAt)] } as BridgeInput["tickHistory"] }),
    );
    const later = buildVaultState(
      input({
        nowMs: NOW + 5 * HOUR,
        tickHistory: { frames: [frame(frameAt)] } as BridgeInput["tickHistory"],
      }),
    );
    expect(early.status).toBe("live");
    expect(later.status).not.toBe("live");
  });
});

describe("the contract's forbidden fields are absent from the emitted JSON", () => {
  test("no color anywhere — the design system owns visual mapping", () => {
    // Change 3 of Iris's five. Duplicating the DU in JSON creates two sources of truth for
    // "what colour means", and they drift silently.
    const serialised = JSON.stringify(buildVaultState(input({ tickHistory: historyAged(5 * MIN) })));
    expect(/"color"/i.test(serialised)).toBe(false);
  });

  test("no precomputed state adjectives like working/idle/degenerate", () => {
    // Change 1 and change 5. `status` carries the shipped live|cold|stale|heat vocabulary;
    // "working" and "degenerate" are exactly the words the contract removed.
    const serialised = JSON.stringify(buildVaultState(input({ tickHistory: historyAged(5 * MIN) })));
    for (const banned of ["working", "degenerate", "provenance", "mock"]) {
      expect(serialised.includes(banned)).toBe(false);
    }
  });

  test("status is always one of the four shipped values", () => {
    for (const age of [0, 5 * MIN, 45 * MIN, 3 * HOUR, 40 * DAY]) {
      const status = buildVaultState(input({ tickHistory: historyAged(age) })).status;
      expect(["live", "cold", "stale", "heat"]).toContain(status);
    }
  });
});

describe("roster is the hub — stable, and independent of state", () => {
  test("buildRoster takes no input and is therefore drawable when the state fetch fails", () => {
    // The whole point of the hub/satellite split (change 4): the settlement can still draw
    // its dwellers when vault-state.json is unreachable.
    const roster = buildRoster();
    expect(roster.schema).toBe("zeta.vault-roster.v1");
    expect(roster.agents.length).toBeGreaterThan(0);
  });

  test("roster is identical across calls — it is not time-dependent", () => {
    expect(JSON.stringify(buildRoster())).toBe(JSON.stringify(buildRoster()));
  });

  test("roster carries identity only, never liveness", () => {
    // If liveness leaked into the hub it would go stale exactly when it is most needed —
    // during the fetch failure the split exists to survive.
    const serialised = JSON.stringify(buildRoster());
    for (const leak of ["status", "last_seen", "live", "cold", "stale", "heat"]) {
      expect(serialised.includes(leak)).toBe(false);
    }
  });
});

describe("epsilon is signed, and uncertainty is highest when evidence is thinnest", () => {
  test("an agent with no events carries large uncertainty, never false confidence", () => {
    const state = buildVaultState(input({ tickHistory: historyAged(5 * MIN) }));
    const dwellers = JSON.stringify(state);
    // With zero evidence, no dweller may claim a confident reputation.
    expect(dwellers.includes('"epsilon":0,')).toBe(false);
  });
});

/**
 * THE SILENCE QUORUM — k >= 2 peers, and why it is not the Cantelli k.
 *
 * Found unpinned by mutation sweep 2026-08-01: flipping `activePeers >= 2` to `>` left the
 * suite green, and so would `>= 1`. That threshold is the only thing standing between
 * "consensus-declared absent" and "one peer unilaterally exiled another", which is the
 * profitable-collusion case the contract calls out.
 *
 * With three agents, k >= 2 means peer UNANIMITY: both others must be active before anyone
 * is called silent. Being unobserved is not evidence of absence unless the observers were
 * demonstrably there to observe.
 *
 * Naming it once so it cannot be re-conflated downstream: this k is a PEER COUNT
 * (combinatorial — how many independent witnesses). It is NOT the Cantelli k ~ 1.95 from
 * alpha = 1/(1+k^2) in the whitewashing-proofness bound. Different quantities, coincidentally
 * close numbers.
 */
function dwellerReputation(state: unknown, agentId: string): { value: number; epsilon: number; silent: boolean } | null {
  const vaults = (state as { vaults?: { rooms?: { dwellers?: { agent_id: string; reputation: { value: number; epsilon: number; silent: boolean } }[] }[] }[] }).vaults ?? [];
  for (const vault of vaults) {
    for (const room of vault.rooms ?? []) {
      for (const dweller of room.dwellers ?? []) {
        if (dweller.agent_id === agentId) return dweller.reputation;
      }
    }
  }
  return null;
}

describe("silence requires a peer quorum — one witness is never enough", () => {
  const WEEK_OLD = NOW - 9 * DAY;

  test("both peers active + target silent for 7 days => silent is declared", () => {
    const state = buildVaultState(
      input({
        tickHistory: historyAged(5 * MIN),
        events: [
          event("otto", "commit", NOW - 1 * HOUR),
          event("alexa", "commit", NOW - 2 * HOUR),
          event("soraya", "commit", WEEK_OLD), // outside the 7d window
        ],
      }),
    );
    expect(dwellerReputation(state, "soraya")?.silent).toBe(true);
  });

  test("only ONE peer active => NOT silent, merely uncertain", () => {
    // The load-bearing half. A lone active peer cannot declare another absent — that is the
    // unilateral exile the quorum exists to prevent. The honest output is low value with
    // wide uncertainty, not a verdict.
    const state = buildVaultState(
      input({
        tickHistory: historyAged(5 * MIN),
        events: [
          event("otto", "commit", NOW - 1 * HOUR),
          event("alexa", "commit", WEEK_OLD),
          event("soraya", "commit", WEEK_OLD),
        ],
      }),
    );
    const soraya = dwellerReputation(state, "soraya");
    expect(soraya?.silent).toBe(false);
    expect(Math.abs(soraya?.epsilon ?? 0)).toBeGreaterThan(0.2); // wide, not confident
  });

  test("a silent verdict is never issued when NO peer is active", () => {
    // Everyone quiet means the observers are gone too — nothing can be concluded about anyone.
    const state = buildVaultState(
      input({
        tickHistory: historyAged(5 * MIN),
        events: [event("otto", "commit", WEEK_OLD), event("alexa", "commit", WEEK_OLD), event("soraya", "commit", WEEK_OLD)],
      }),
    );
    for (const agent of ["otto", "alexa", "soraya"]) {
      expect(dwellerReputation(state, agent)?.silent).toBe(false);
    }
  });
});

describe("reputation weights recent activity above old activity", () => {
  test("the same event count scores higher when it is recent", () => {
    // Pins the (2*recent + older)/3 weighting. A sign flip there would make old activity
    // subtract from standing, so an agent that worked last week and rested would score BELOW
    // one that never appeared at all.
    const recentBurst = buildVaultState(
      input({
        tickHistory: historyAged(5 * MIN),
        events: [
          ...Array.from({ length: 30 }, (_v, i) => event("otto", "commit", NOW - (i + 1) * MIN)),
          event("alexa", "commit", NOW - 1 * HOUR),
          event("soraya", "commit", NOW - 1 * HOUR),
        ],
      }),
    );
    const oldBurst = buildVaultState(
      input({
        tickHistory: historyAged(5 * MIN),
        events: [
          ...Array.from({ length: 30 }, (_v, i) => event("otto", "commit", NOW - 5 * DAY - i * MIN)),
          event("alexa", "commit", NOW - 1 * HOUR),
          event("soraya", "commit", NOW - 1 * HOUR),
        ],
      }),
    );
    const recentValue = dwellerReputation(recentBurst, "otto")?.value ?? 0;
    const oldValue = dwellerReputation(oldBurst, "otto")?.value ?? 0;
    expect(recentValue).toBeGreaterThan(oldValue);
  });

  test("reputation never falls below the 0.1 floor — trust is graced, not earned from zero", () => {
    // Aaron 2026-08-01: everyone is graced trust; the question is whether it is kept, never
    // whether it is earned from nothing. A floor of 0 would make a quiet week indistinguishable
    // from a bad actor.
    const state = buildVaultState(
      input({
        tickHistory: historyAged(5 * MIN),
        events: [event("otto", "commit", NOW - 6 * DAY), event("alexa", "commit", NOW - 1 * HOUR), event("soraya", "commit", NOW - 1 * HOUR)],
      }),
    );
    expect(dwellerReputation(state, "otto")?.value ?? 0).toBeGreaterThanOrEqual(0.1);
  });
});

/**
 * PER-VAULT STATUS — the gap Iris found that these tests missed.
 *
 * The suite above pins page-level status thoroughly and never checked a single vault. Iris
 * caught it reviewing the emitted JSON: buildEconomyVault returns
 *   status: events.length > 0 ? "live" : "cold"
 * with no recency test at all, plus a hardcoded confidence of {0.8, 0.1} unconditioned on any
 * evidence. So a vault reads "live" off a seven-hour-old event, and asserts 80% confidence in
 * a reading it did not measure.
 *
 * The page can cap this (a child's status never raises its parent), but the FILE still says
 * something false, and every other consumer inherits it — monitor.html, a future CLI, anything
 * reading the JSON directly. Honesty has to hold in the artifact, not only in one renderer.
 *
 * This is a straight miss on my part: I tested the property at the scope I happened to think of.
 */
describe("per-vault status obeys the same honesty rule as the page", () => {
  test("no vault reads live off stale evidence", () => {
    const sevenHoursAgo = NOW - 7 * HOUR;
    const state = buildVaultState(
      input({
        tickHistory: historyAged(5 * MIN),
        events: [
          event("otto", "commit", sevenHoursAgo),
          event("alexa", "commit", sevenHoursAgo),
          event("soraya", "commit", sevenHoursAgo),
        ],
      }),
    );
    const vaults = (state as unknown as { vaults: { id: string; status: string }[] }).vaults;
    const wronglyLive = vaults.filter((v) => v.status === "live").map((v) => v.id);
    expect(wronglyLive).toEqual([]);
  });

  test("no vault asserts confidence it did not measure", () => {
    // A hardcoded {0.8, 0.1} is a claim of 80% certainty with a narrow band, emitted whether or
    // not anything was observed. With no recent evidence the honest output is a low value with
    // a wide band, exactly as the contract's confidence table specifies.
    const state = buildVaultState(
      input({
        tickHistory: historyAged(5 * MIN),
        events: [event("otto", "commit", NOW - 7 * HOUR)],
      }),
    );
    const vaults = (state as unknown as { vaults: { id: string; confidence: { value: number; epsilon: number } }[] }).vaults;
    for (const vault of vaults) {
      if (vault.confidence.value >= 0.8) {
        expect(Math.abs(vault.confidence.epsilon)).toBeGreaterThan(0.1);
      }
    }
  });
});

/**
 * THE SILENT-EPSILON INVERSION.
 *
 * Found independently by Soraya (formal review) and Iris (render review) on 2026-08-01, and
 * missed by the 25 tests already in this file — those asserted `silent === true` and never
 * looked at the epsilon beside it.
 *
 * The adapter emitted `{ value: 0, epsilon: 0, silent: true }`. Epsilon zero is a claim of
 * PERFECT CERTAINTY, asserted at the point of MAXIMUM absence of evidence: an agent from
 * which nothing has been heard for seven days. Iris's render-side reading of the same line:
 * a full-track empty bar with no admitted uncertainty is the strongest statement the bar can
 * make, and it is exactly backwards.
 *
 * Two different quantities were being conflated:
 *   - `silent` is a CORROBORATED FACT about absence — zero ticks, k >= 2 peers active. High
 *     confidence in that is correct; it is a quorum observation.
 *   - `epsilon` is uncertainty about the agent's VALUE, and seven days of silence is no
 *     evidence at all about capability. It is the most uncertain object in the system.
 *
 * This also directly contradicts the stated design (Aaron 2026-08-01): "you start at 100%
 * trust with 0.1% certainty ... everyone is graced trust." Zero epsilon is 100% certainty,
 * asserted about the one dweller we know least about.
 */
describe("silence is a corroborated FACT, not a confident measurement", () => {
  const WEEK_OLD = NOW - 9 * DAY;

  test("a silent dweller carries HIGH uncertainty, never zero", () => {
    const state = buildVaultState(
      input({
        tickHistory: historyAged(5 * MIN),
        events: [
          event("otto", "commit", NOW - 1 * HOUR),
          event("alexa", "commit", NOW - 2 * HOUR),
          event("soraya", "commit", WEEK_OLD),
        ],
      }),
    );
    const soraya = dwellerReputation(state, "soraya");
    expect(soraya?.silent).toBe(true);
    // The load-bearing assertion. Zero here is a claim of perfect knowledge about an agent
    // we have not heard from at all.
    //
    // ASSERTED ON SIGN, NOT MAGNITUDE. `Math.abs` here was a could-not-fail assertion: the
    // adapter's epsilon sign is the whole claim (the page turns it into ▲/▼ via `signedBar`),
    // and an abs-wrapped test cannot see it move. Flipping the sign at the adapter left all
    // 27 tests green. `-1` is the deliberate withheld sentinel, defended at
    // vault-state-bridge.ts:309-321 — pin it, not its size.
    expect(soraya?.epsilon).toBeLessThan(0);
  });

  test("a silent dweller is MORE uncertain than an observed one", () => {
    // Ordering, not just non-zero: absence of evidence must not read as tighter than
    // evidence. If a silent agent's band were narrower than an active agent's, the surface
    // would present ignorance as precision.
    const state = buildVaultState(
      input({
        tickHistory: historyAged(5 * MIN),
        events: [
          ...Array.from({ length: 30 }, (_v, i) => event("otto", "commit", NOW - (i + 1) * MIN)),
          event("alexa", "commit", NOW - 2 * HOUR),
          event("soraya", "commit", WEEK_OLD),
        ],
      }),
    );
    // `abs` is legitimate HERE — this is a width claim, and width is a magnitude. But width
    // alone was the only thing asserted, so the sign rode along untested. Both now.
    const silent = Math.abs(dwellerReputation(state, "soraya")?.epsilon ?? 0);
    const observed = Math.abs(dwellerReputation(state, "otto")?.epsilon ?? 1);
    expect(silent).toBeGreaterThan(observed);
    expect(dwellerReputation(state, "soraya")?.epsilon).toBeLessThan(0);
    // Deliberately NOT pinning otto's sign: it derives from the fixture's trend
    // (vault-state-bridge.ts:353) and is not a property this test is about.
  });

  // ───────────────────────────────────────────────────────────────────────────────────────
  // P2 — peer-independence. Peer count gates `silent` and NOTHING ELSE.
  //
  // Soraya 2026-08-02, formalised after the whitewash-floor routing:
  //
  //   ∀ agent a, ∀ own-evidence o, ∀ peer configs P, P':
  //     R(o,P).value == R(o,P').value  ∧  sign(R(o,P).ε) == sign(R(o,P').ε)
  //     -- `silent` MAY differ; it is the only peer-derived output.
  //
  // WHY IT IS A SECURITY PROPERTY, not a tidiness one: peer count is not the subject's own
  // evidence, so letting it move `value`/`sign(ε)` makes the reputation non-monotone in
  // absence — an agent improves its own reading by going dark in company. With a 3-agent
  // roster that is a 2-of-3 coalition and requires no identity change, which makes it
  // strictly cheaper than whitewashing.
  //
  // SCOPE: this pins the 0-vs-1 peer pair, which lands on ONE branch today and is therefore
  // true both before and after the adapter fix — a fix-agnostic guard. The 1-vs-2 pair
  // crosses the silent threshold and FAILS on current main; it ships with the adapter fix
  // (Alexa's) so main never goes red. Do not add a sign assertion to the two `<2 peers`
  // cases above — that cell is the defect, and pinning its sign would cement it.
  // ───────────────────────────────────────────────────────────────────────────────────────
  describe("P2: peer count may set `silent`, and may not touch value or epsilon's sign", () => {
    /** Soraya with zero trailing-7d evidence, under a chosen number of active peers. */
    function subjectUnderPeers(activePeers: 0 | 1): { value: number; epsilon: number } {
      const state = buildVaultState(
        input({
          tickHistory: historyAged(5 * MIN),
          events: [
            event("otto", "commit", activePeers >= 1 ? NOW - 1 * HOUR : WEEK_OLD),
            event("alexa", "commit", WEEK_OLD),
            event("soraya", "commit", WEEK_OLD), // the subject: identical in both worlds
          ],
        }),
      );
      const r = dwellerReputation(state, "soraya");
      return { value: r?.value ?? Number.NaN, epsilon: r?.epsilon ?? Number.NaN };
    }

    test("0 vs 1 active peer: identical own-evidence yields identical value", () => {
      expect(subjectUnderPeers(0).value).toBe(subjectUnderPeers(1).value);
    });

    test("0 vs 1 active peer: identical own-evidence yields the same epsilon SIGN", () => {
      // The assertion the abs-wrapped originals could not make.
      expect(Math.sign(subjectUnderPeers(0).epsilon)).toBe(Math.sign(subjectUnderPeers(1).epsilon));
    });
  });
});
