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
    }
  | { readonly kind: "sweep_healed"; readonly tick: number } // BD001 openCount → 0
  | { readonly kind: "gate_result"; readonly tick: number; readonly pass: boolean }
  | { readonly kind: "merge_result"; readonly tick: number; readonly merged: boolean }
  | { readonly kind: "human_cleared"; readonly tick: number }; // manual episode reset

// ── Commands (what the machine asks the edge to do — data, never IO) ────────

export type EpisodeCommand =
  | { readonly kind: "none"; readonly reason: string }
  | {
      readonly kind: "open_revert_pr";
      readonly breakSha: string;
      readonly armed: boolean; // false when touchesVectorContracts (Lior-2)
      readonly notifyAuthor: {
        readonly persona: string;
        readonly relandRecipe: string; // verbatim one-command re-land (Riven-2)
      };
    }
  | { readonly kind: "disarm_and_close_pr"; readonly reason: string } // Vera-2
  | { readonly kind: "file_findings_and_stop"; readonly reason: string }; // RFC-4

// ── States ──────────────────────────────────────────────────────────────────

export type EpisodeState =
  | { readonly kind: "idle" }
  | {
      readonly kind: "attempted";
      readonly attemptKey: string; // episodeId ⊕ breakSha (Vera-3)
      readonly breakSha: string;
      readonly armed: boolean;
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
      const armed = !event.touchesVectorContracts; // Lior-2
      return {
        state: { kind: "attempted", attemptKey: attemptKey(episodeId, breakSha), breakSha, armed },
        command: {
          kind: "open_revert_pr",
          breakSha,
          armed,
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
          const reason = "episode healed before revert landed — disarm, no double-patch (Vera-2)";
          return { state: { kind: "closed_healed", reason }, command: { kind: "disarm_and_close_pr", reason } };
        }
        case "gate_result": {
          if (event.pass) return none("gate passed — auto-merge (or human, if unarmed) proceeds at the edge");
          const reason = "revert failed the floor gate — closure violated, humans own the P1";
          return { state: { kind: "refused", reason }, command: { kind: "file_findings_and_stop", reason } };
        }
        case "merge_result": {
          if (event.merged) {
            return { state: { kind: "landed", breakSha: state.breakSha }, command: { kind: "none", reason: "revert landed" } };
          }
          const reason = "merge did not complete — refuse to humans rather than retry";
          return { state: { kind: "refused", reason }, command: { kind: "file_findings_and_stop", reason } };
        }
        case "human_cleared":
          return { state: IDLE, command: { kind: "none", reason: "human cleared the episode" } };
        default:
          return none("unreachable");
      }
    }
    case "landed":
    case "closed_healed":
      return event.kind === "human_cleared"
        ? { state: IDLE, command: { kind: "none", reason: "human cleared the episode" } }
        : none(`${state.kind} is terminal for this episode`);
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
