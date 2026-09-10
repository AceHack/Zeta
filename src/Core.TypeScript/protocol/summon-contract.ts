// src/Core.TypeScript/protocol/summon-contract.ts
//
// `ISummon` — the port for "ask a named peer a question and get its answer".
//
// ── WHY IT IS HERE AND NOT IN `peer-call/summon.ts` ─────────────────────────
// `summon.ts` declares the interface AND the class that implements it. The
// class is heavy on purpose: it resolves a persona registry, runs the peer
// firewall, shells out to vendor CLIs, opens WebSockets, and speaks the
// multiplexed persona transport. So a consumer that only wanted the SHAPE —
// `observe/participant.ts` builds a `Participant` out of any `ISummon` and
// never constructs one — was importing all of that to get three type
// declarations, and that import is one of the meta-harness's 38 measured
// back-edges (`docs/research/2026-09-09-repo-split-round-4-*.md` §3.1).
//
// This is the exact division
// `.claude/rules/interfaces-free-classes-earned-under-rules.md` carves: the
// interface is FREE — pure shape, no instance state, nothing to capture — and
// the class is the earned part. Free things go where anyone may reach them;
// earned things stay with the weight they carry. `peer-call/summon.ts` imports
// these back and re-exports them, so nothing that already imports from there
// changes.
//
// ── WHAT THIS MODULE MAY CONTAIN ────────────────────────────────────────────
// Types only. A value here would make the port a thing both sides must
// execute rather than merely agree to.

/** How the caller wants the peer invoked. Every field is optional: the port's
 *  minimum contract is (persona, prompt) → result. */
export interface SummonOptions {
  readonly model?: string | undefined;
  readonly file?: string | undefined;
  readonly contextCmd?: string | undefined;
  readonly outputFile?: string | undefined;
  readonly allowEmpty?: boolean | undefined;
  readonly json?: boolean | undefined;
  readonly stream?: boolean | undefined;
  readonly review?: boolean | undefined;
}

/**
 * What came back. `success` is the answer to "did the peer reply", NOT to "was
 * the reply any good" — that judgement belongs to the caller's oracle, never to
 * the transport (`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`).
 * A refusal, a firewall rejection and a crashed CLI are all reported here as
 * facts with an exit code, and it is the caller that decides what each means.
 */
export interface SummonResult {
  readonly success: boolean;
  readonly exitCode: number;
  readonly outputFile: string;
  readonly stdout: string;
  readonly stderr: string;
}

/** The port. Implemented by `peer-call/summon.ts`'s `PersonaSummoner` in
 *  production, and by a plain object literal in any test that needs a peer's
 *  ANSWER without needing a peer. */
export interface ISummon {
  summon(persona: string, prompt: string, options?: SummonOptions): Promise<SummonResult>;
}
