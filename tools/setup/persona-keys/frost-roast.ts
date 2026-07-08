// FROST ROAST-shaped robust signing coordinator (documented subset).
//
// This is NOT the full ROAST paper protocol. It is the narrow slice needed by
// 081KWPHRNFW: concurrent session isolation, duplicate/conflicting partial
// aborts, timeout aborts with retry, mixed-session refusal, and threshold-only
// combination after partial verification.
//
// Subset boundary: each attempt opens one exact threshold-sized FROST signing
// set. Robustness comes from aborting a failed attempt and retrying with a new
// exact threshold set, not from the full ROAST asynchronous scheduler.

import { ed25519 } from "@noble/curves/ed25519.js";
import {
  frostCombine,
  frostOpenSession,
  frostPartialSign,
  frostVerify,
  type FrostKeyShare,
  type FrostSignSession,
} from "./frost.ts";

const Fn = ed25519.Point.Fn;
const G = ed25519.Point.BASE;

export interface FrostRoastEffects {
  readonly nowMs: () => number;
}

export interface FrostRoastParticipant {
  readonly participantIndex: number;
  readonly nonceCommitment: Uint8Array;
  /** Public share Y_i = [s_i]B; used to verify z_i without reading s_i. */
  readonly publicShare: Uint8Array;
}

export interface OpenFrostRoastSessionOptions {
  readonly sessionId: string;
  readonly groupPublicKey: Uint8Array;
  readonly message: Uint8Array;
  readonly threshold: number;
  readonly participants: readonly FrostRoastParticipant[];
  readonly timeoutMs: number;
}

export interface FrostRoastPartial {
  readonly sessionId: string;
  readonly participantIndex: number;
  readonly z: bigint;
}

export interface FrostRoastSessionView {
  readonly sessionId: string;
  readonly threshold: number;
  readonly participantIndices: readonly number[];
  readonly startedAtMs: number;
  readonly expiresAtMs: number;
  readonly partialCount: number;
  readonly aborted: boolean;
  readonly abortReason?: string;
}

interface MutableRoastSession {
  readonly sessionId: string;
  readonly groupPublicKey: Uint8Array;
  readonly message: Uint8Array;
  readonly threshold: number;
  readonly participantIndices: readonly number[];
  readonly nonceCommitments: ReadonlyMap<number, Uint8Array>;
  readonly publicShares: ReadonlyMap<number, Uint8Array>;
  readonly frostSession: FrostSignSession;
  readonly startedAtMs: number;
  readonly expiresAtMs: number;
  readonly partials: Map<number, FrostRoastPartial>;
  abortReason?: string;
}

function viewOf(session: MutableRoastSession): FrostRoastSessionView {
  const view: FrostRoastSessionView = {
    sessionId: session.sessionId,
    threshold: session.threshold,
    participantIndices: session.participantIndices,
    startedAtMs: session.startedAtMs,
    expiresAtMs: session.expiresAtMs,
    partialCount: session.partials.size,
    aborted: session.abortReason !== undefined,
  };
  if (session.abortReason !== undefined) return { ...view, abortReason: session.abortReason };
  return view;
}

function assertUniqueParticipants(participants: readonly FrostRoastParticipant[]): void {
  const seen = new Set<number>();
  for (const p of participants) {
    if (seen.has(p.participantIndex)) {
      throw new Error(`frost-roast: duplicate participant ${String(p.participantIndex)}`);
    }
    seen.add(p.participantIndex);
  }
}

export class FrostRoastCoordinator {
  private readonly sessions = new Map<string, MutableRoastSession>();
  private readonly effects: FrostRoastEffects;

  public constructor(effects: FrostRoastEffects = { nowMs: () => Date.now() }) {
    this.effects = effects;
  }

  public openSession(opts: OpenFrostRoastSessionOptions): FrostRoastSessionView {
    if (this.sessions.has(opts.sessionId)) {
      throw new Error(`frost-roast: duplicate session id ${opts.sessionId}`);
    }
    if (opts.threshold < 1) throw new Error("frost-roast: threshold must be positive");
    if (opts.participants.length !== opts.threshold) {
      throw new Error("frost-roast: documented subset opens one exact threshold signing set per attempt");
    }
    assertUniqueParticipants(opts.participants);

    const startedAtMs = this.effects.nowMs();
    const participantIndices = opts.participants.map((p) => p.participantIndex);
    const frostSession = frostOpenSession(
      opts.groupPublicKey,
      opts.message,
      participantIndices,
      opts.participants.map((p) => p.nonceCommitment),
    );
    const session: MutableRoastSession = {
      sessionId: opts.sessionId,
      groupPublicKey: opts.groupPublicKey,
      message: opts.message,
      threshold: opts.threshold,
      participantIndices,
      nonceCommitments: new Map(opts.participants.map((p) => [p.participantIndex, p.nonceCommitment])),
      publicShares: new Map(opts.participants.map((p) => [p.participantIndex, p.publicShare])),
      frostSession,
      startedAtMs,
      expiresAtMs: startedAtMs + opts.timeoutMs,
      partials: new Map(),
    };
    this.sessions.set(opts.sessionId, session);
    return viewOf(session);
  }

  public getSession(sessionId: string): FrostRoastSessionView {
    return viewOf(this.requireSession(sessionId));
  }

  public abortTimedOut(sessionId: string): FrostRoastSessionView {
    const session = this.requireSession(sessionId);
    if (this.effects.nowMs() < session.expiresAtMs) return viewOf(session);
    session.abortReason = "timeout";
    return viewOf(session);
  }

  public retryTimedOutSession(timedOutSessionId: string, next: OpenFrostRoastSessionOptions): FrostRoastSessionView {
    const timedOut = this.abortTimedOut(timedOutSessionId);
    if (!timedOut.aborted) {
      throw new Error(`frost-roast: session ${timedOutSessionId} has not timed out`);
    }
    return this.openSession(next);
  }

  public createPartial(sessionId: string, share: FrostKeyShare, nonce: bigint): FrostRoastPartial {
    const session = this.requireLiveSession(sessionId);
    return {
      sessionId,
      participantIndex: share.x,
      z: frostPartialSign(share, session.frostSession, nonce),
    };
  }

  public submitPartial(partial: FrostRoastPartial): FrostRoastSessionView {
    const session = this.requireLiveSession(partial.sessionId);
    if (this.effects.nowMs() >= session.expiresAtMs) {
      session.abortReason = "timeout";
      throw new Error(`frost-roast: session ${partial.sessionId} timed out`);
    }
    this.acceptPartial(session, partial, session.partials);
    return viewOf(session);
  }

  public combineSubmitted(sessionId: string): Uint8Array {
    const session = this.requireLiveSession(sessionId);
    return this.combineMap(session, session.partials);
  }

  public combinePartials(sessionId: string, partials: readonly FrostRoastPartial[]): Uint8Array {
    const session = this.requireLiveSession(sessionId);
    const accepted = new Map<number, FrostRoastPartial>();
    for (const partial of partials) {
      if (partial.sessionId !== sessionId) {
        session.abortReason = "mixed-session";
        throw new Error("frost-roast: refused mixed-session partials");
      }
      this.acceptPartial(session, partial, accepted);
    }
    return this.combineMap(session, accepted);
  }

  private requireSession(sessionId: string): MutableRoastSession {
    const session = this.sessions.get(sessionId);
    if (session === undefined) throw new Error(`frost-roast: unknown session ${sessionId}`);
    return session;
  }

  private requireLiveSession(sessionId: string): MutableRoastSession {
    const session = this.requireSession(sessionId);
    if (session.abortReason !== undefined) {
      throw new Error(`frost-roast: session ${sessionId} aborted: ${session.abortReason}`);
    }
    return session;
  }

  private acceptPartial(
    session: MutableRoastSession,
    partial: FrostRoastPartial,
    accepted: Map<number, FrostRoastPartial>,
  ): void {
    if (!session.participantIndices.includes(partial.participantIndex)) {
      session.abortReason = "unexpected-participant";
      throw new Error(`frost-roast: participant ${String(partial.participantIndex)} not in session`);
    }
    const existing = accepted.get(partial.participantIndex);
    if (existing !== undefined) {
      session.abortReason = existing.z === partial.z ? "duplicate-partial" : "conflicting-partial";
      throw new Error(`frost-roast: ${session.abortReason} from participant ${String(partial.participantIndex)}`);
    }
    if (!this.verifyPartial(session, partial)) {
      session.abortReason = "invalid-partial";
      throw new Error(`frost-roast: invalid partial from participant ${String(partial.participantIndex)}`);
    }
    accepted.set(partial.participantIndex, partial);
  }

  private verifyPartial(session: MutableRoastSession, partial: FrostRoastPartial): boolean {
    const nonceCommitment = session.nonceCommitments.get(partial.participantIndex);
    const publicShare = session.publicShares.get(partial.participantIndex);
    const lambda = session.frostSession.lambdas.get(partial.participantIndex);
    if (nonceCommitment === undefined || publicShare === undefined || lambda === undefined) {
      return false;
    }
    const lhs = G.multiply(Fn.create(partial.z));
    const rhs = ed25519.Point.fromBytes(nonceCommitment).add(
      ed25519.Point.fromBytes(publicShare).multiply(Fn.mul(session.frostSession.challenge, lambda)),
    );
    return lhs.equals(rhs);
  }

  private combineMap(session: MutableRoastSession, accepted: ReadonlyMap<number, FrostRoastPartial>): Uint8Array {
    if (this.effects.nowMs() >= session.expiresAtMs) {
      session.abortReason = "timeout";
      throw new Error(`frost-roast: session ${session.sessionId} timed out`);
    }
    if (accepted.size < session.threshold) {
      throw new Error(
        `frost-roast: need at least ${String(session.threshold)} valid partials, got ${String(accepted.size)}`,
      );
    }
    const partials = session.participantIndices.map((x) => accepted.get(x)!.z);
    const signature = frostCombine(session.frostSession, partials);
    if (!frostVerify(session.groupPublicKey, session.message, signature)) {
      session.abortReason = "invalid-aggregate-signature";
      throw new Error("frost-roast: combined signature failed verification");
    }
    return signature;
  }
}
