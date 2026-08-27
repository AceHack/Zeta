#!/usr/bin/env bun
// episode-protocol.ts — the retraction-healer episode state machine
// (workitem 081KZHGP45V actuator half; the RFC's review-round conditions ARE
// this module's spec — docs/letters/to-roster-auto-revert-healer-design-rfc.md).
//
// Soraya's seat condition, verbatim: "a sibling episode-protocol harness (a
// DST-modeled trigger→attempt→gate→outcome state machine sharing the
// Verdict/LawViolation vocabulary, with golden vectors proving at-most-once
// under replay and refusal on non-unique isolation) rather than overloading
// certify() into attesting what it never evaluates." This is that harness.
//
// Shape follows the society's own harness grammar (observe.ts): events,
// states, and COMMANDS are discriminated unions; the transition is a pure
// fold `step(state, event) → { state, command }`. The machine never performs
// IO — commands are data the edge executes (noninterference §13), which is
// what makes every law below a replayable golden vector (DST §7).
//
// The laws, from the seats:
//   Vera-3   idempotence key = episode id ⊕ breaking-commit SHA — a flapping
//            detector re-opening an episode on the same break cannot re-arm.
//   Vera-2   auto-merge disarms + PR closes if the sweep reports healed
//            before the revert lands (no fix-forward double-patch race).
//   Lior-2   vector-touching reverts open with armed: false — the ack is a
//            considered human act, never a rubber stamp racing a merge.
//   Riven-1  the author's own fix-PR counts as fleet-heal-in-flight — the
//            bot stands down when the lane is already moving.
//   Riven-2  the author notification carries the re-land recipe verbatim.
//   RFC-4    refusal over cleverness: non-unique breaking-commit isolation
//            refuses to humans, permanently for the episode.
//   Trigger  BD001 open ≥ 2 consecutive ticks (the fleet's measured MTTH) —
//            the bot only moves when the fleet is slower than its own norm.
//
// NO write token exists yet: per Soraya's condition (b) and the operator's
// word (Aaron 2026-08-10, "lets just pick one or a few and test them out"),
// this harness must pass before any actuator edge is wired, and ARMING
// remains a separate operator decision after dry-run evidence.

// ── Events (what the world reports to the machine) ──────────────────────────

export type EpisodeEvent =
  | {
      readonly kind: "break_detected";
      readonly tick: number;
      readonly openTicks: number; // consecutive ticks BD001 has been open
      readonly candidateShas: readonly string[]; // isolation result
      readonly fleetHealInFlight: boolean; // includes the author's own fix-PR (Riven-1)
      readonly touchesVectorContracts: boolean; // computed on the REVERT's own diff (Lior-1)
      readonly authorPersona: string;
      /**
       * Is this red ATTRIBUTABLE to the isolated commit?
       *
       * Every other guard on this event is about UNIQUENESS (exactly one
       * candidate) or AT-MOST-ONCE (one attempt per episode). Neither is
       * attribution: uniqueness is a property of the commit GRAPH, attribution
       * is a property of the FAILURE. An infrastructure outage produces a
       * perfectly unique isolation and a completely wrong answer.
       *
       * Required, not optional, and deliberately so — an optional field would
       * default to "absent" at every existing construction site and the guard
       * would silently not apply. Compute it with `isAttributable` in
       * `retraction-actuator.ts`, which is asymmetric: an underivable subject
       * yields FALSE, so it withholds the remedy rather than licensing it.
       *
       * Live counterexample (2026-08-26, `docs/DECISIONS/2026-08-26-acting-on-a-
       * verdict-about-a-commit-that-is-no-longer-the-tip.md` §3.2): `www.gnupg.org:443`
       * stopped answering; isolation was exactly one commit; that commit was
       * #15683, a GraphQL-transport hygiene lint, causally unrelated. Without
       * this field the machine would have emitted `push_retraction` for it.
       */
      readonly attributable: boolean;
    }
  | { readonly kind: "sweep_healed"; readonly tick: number } // BD001 openCount → 0
  | { readonly kind: "push_result"; readonly tick: number; readonly pushed: boolean }
  | { readonly kind: "post_push_gate"; readonly tick: number; readonly pass: boolean } // main's gate run after the push
  | { readonly kind: "human_cleared"; readonly tick: number }; // manual episode reset

// ── Commands (what the machine asks the edge to do — data, never IO) ────────

export type EpisodeCommand =
  | { readonly kind: "none"; readonly reason: string }
  | {
      readonly kind: "push_retraction"; // sovereign: construct revert at main's tip, push it
      readonly breakSha: string;
      readonly notifyAuthor: {
        readonly persona: string;
        readonly relandRecipe: string; // verbatim one-command re-land (Riven-2)
      };
    }
  | { readonly kind: "file_findings_and_stop"; readonly reason: string }; // floor / RFC-4

// ── States ──────────────────────────────────────────────────────────────────

export type EpisodeState =
  | { readonly kind: "idle" }
  | {
      readonly kind: "attempted"; // retraction pushed (or push in flight)
      readonly attemptKey: string; // episodeId ⊕ breakSha (Vera-3)
      readonly breakSha: string;
    }
  | { readonly kind: "landed"; readonly breakSha: string }
  | { readonly kind: "closed_healed"; readonly reason: string }
  | { readonly kind: "refused"; readonly reason: string }; // terminal until human_cleared

export const IDLE: EpisodeState = { kind: "idle" };

export const TRIGGER_OPEN_TICKS = 2; // the fleet's measured MTTH norm

export function attemptKey(episodeId: string, breakSha: string): string {
  return `${episodeId}⊕${breakSha}`; // ⊕ — the pair IS the identity (Vera-3)
}

export interface StepResult {
  readonly state: EpisodeState;
  readonly command: EpisodeCommand;
}

/** The pure transition. Total over (state, event); unknown combinations are
 * explicit no-ops with a reason — a state machine that throws is a state
 * machine with undeclared states. */
export function step(episodeId: string, state: EpisodeState, event: EpisodeEvent): StepResult {
  const none = (reason: string): StepResult => ({ state, command: { kind: "none", reason } });

  switch (state.kind) {
    case "idle": {
      if (event.kind !== "break_detected") return none(`idle ignores ${event.kind}`);
      if (event.openTicks < TRIGGER_OPEN_TICKS) {
        return none(`below trigger: open ${String(event.openTicks)} < ${String(TRIGGER_OPEN_TICKS)} ticks`);
      }
      if (event.fleetHealInFlight) {
        return none("fleet heal in flight — the bot stands down (Riven-1)");
      }
      if (event.candidateShas.length !== 1) {
        const reason = `non-unique isolation (${String(event.candidateShas.length)} candidates) — human work (RFC-4)`;
        return { state: { kind: "refused", reason }, command: { kind: "file_findings_and_stop", reason } };
      }
      const breakSha = event.candidateShas[0]!;
      if (!event.attributable) {
        // THE GATE THIS MACHINE WAS MISSING. Reached only once isolation is
        // unique — so this refusal fires exactly where the old code emitted
        // `push_retraction`, on the one path that could retract an innocent
        // commit. Sticky, like every other refusal here: cleared by a human,
        // never by the next tick looking more convincing.
        const reason = `red is not attributable to ${breakSha.slice(0, 9)} — uniqueness is not attribution (§3.2)`;
        return { state: { kind: "refused", reason }, command: { kind: "file_findings_and_stop", reason } };
      }
      if (event.touchesVectorContracts) {
        // Sovereign mode has nothing between "push" and "human": a bot
        // cannot self-grant the vector ack, so this is a floor refusal.
        const reason = "retraction touches byte-lock vector contracts — human hands only (Lior)";
        return { state: { kind: "refused", reason }, command: { kind: "file_findings_and_stop", reason } };
      }
      return {
        state: { kind: "attempted", attemptKey: attemptKey(episodeId, breakSha), breakSha },
        command: {
          kind: "push_retraction",
          breakSha,
          notifyAuthor: {
            persona: event.authorPersona,
            relandRecipe: `git cherry-pick ${breakSha}  # episode ${episodeId}; re-land after heal`,
          },
        },
      };
    }
    case "attempted": {
      switch (event.kind) {
        case "break_detected": {
          // At-most-once under replay (Vera-3): same or different candidates,
          // an attempted episode never opens a second PR.
          return none("already attempted this episode — at-most-once (Vera-3)");
        }
        case "sweep_healed": {
          // Healed while the push was still in flight (or before it went
          // out): stand down — Vera-2's law, sovereign form. The edge treats
          // this as "do not push / abandon the in-flight push if possible".
          const reason = "episode healed before the retraction landed — stand down, no double-patch (Vera-2)";
          return { state: { kind: "closed_healed", reason }, command: { kind: "none", reason } };
        }
        case "push_result": {
          if (event.pushed) {
            return { state: { kind: "landed", breakSha: state.breakSha }, command: { kind: "none", reason: "retraction pushed" } };
          }
          const reason = "push did not complete — refuse to humans rather than retry";
          return { state: { kind: "refused", reason }, command: { kind: "file_findings_and_stop", reason } };
        }
        case "post_push_gate":
          return none("post-push gate applies to the landed state, not the attempt");
        case "human_cleared":
          return { state: IDLE, command: { kind: "none", reason: "human cleared the episode" } };
        default:
          return none("unreachable");
      }
    }
    case "landed": {
      if (event.kind === "post_push_gate" && !event.pass) {
        // The retraction itself broke the build: BD001 will re-open, and the
        // at-most-once key stops any second attempt — the machine refuses to
        // humans instead of oscillating (the ADR's flapping-healer lesson).
        const reason = "post-push gate red — the retraction broke the build; humans own it";
        return { state: { kind: "refused", reason }, command: { kind: "file_findings_and_stop", reason } };
      }
      return event.kind === "human_cleared"
        ? { state: IDLE, command: { kind: "none", reason: "human cleared the episode" } }
        : none("landed is terminal for this episode");
    }
    case "closed_healed":
      return event.kind === "human_cleared"
        ? { state: IDLE, command: { kind: "none", reason: "human cleared the episode" } }
        : none("closed_healed is terminal for this episode");
    case "refused":
      // Refusal is sticky until a human clears it — a failed attempt refuses
      // forever; the machine never self-rehabilitates.
      return event.kind === "human_cleared"
        ? { state: IDLE, command: { kind: "none", reason: "human cleared the refusal" } }
        : none("refused — sticky until human_cleared");
    default:
      return none("unreachable state");
  }
}

/** Fold a whole episode's event history — DST replay: same events, same
 * final state and same command trace, bit for bit. */
export function replay(
  episodeId: string,
  events: readonly EpisodeEvent[],
): { readonly state: EpisodeState; readonly commands: readonly EpisodeCommand[] } {
  let state: EpisodeState = IDLE;
  const commands: EpisodeCommand[] = [];
  for (const e of events) {
    const r = step(episodeId, state, e);
    state = r.state;
    commands.push(r.command);
  }
  return { state, commands };
}
