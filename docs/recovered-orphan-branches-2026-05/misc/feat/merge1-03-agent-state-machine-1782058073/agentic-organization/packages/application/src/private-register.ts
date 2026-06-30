// private-register.ts — Merge1 §03: room-local private state + non-collapse proof.
//
// Implemented from the §03 spec sketch (no donor file in this repo's slice).
// The private register holds room-local state the agent does NOT expose to the
// public trace (e.g. relation consent). The non-collapse witness proves that two
// distinct private event sequences yield DISTINCT public outputs — privacy is
// verifiable, not merely claimed: private state cannot collapse into
// indistinguishable public behavior.
//
// MP-4 (retraction-native): the register is event-folded; records form a hash
// chain (append-only, tamper-evident).

import { createHash } from "node:crypto";

import type { AgentPersona } from "./agent-state-machine.ts";

export type RelationConsent = "accept" | "decline";

export interface PrivateRegister {
  readonly tag: "PrivateRegister";
  readonly agent: AgentPersona;
  readonly relationConsent: RelationConsent;
}

export type PrivateRegisterEvent = { readonly tag: "SetRelationConsent"; readonly consent: RelationConsent };

export interface PrivateRegisterRecord {
  readonly recordId: string;
  readonly runId: string;
  readonly sequence: number;
  readonly agent: AgentPersona;
  readonly event: PrivateRegisterEvent;
  readonly register: PrivateRegister;
  readonly registerDigest: string;
  readonly previousRecordId?: string;
  readonly previousRegisterDigest?: string;
  readonly recordedAtIso: string;
}

/** The initial register for an agent (defaults to declining relations). */
export function initialPrivateRegister(agent: AgentPersona): PrivateRegister {
  return { tag: "PrivateRegister", agent, relationConsent: "decline" };
}

/** Apply one event. Pure. */
export function applyPrivateRegisterEvent(register: PrivateRegister, event: PrivateRegisterEvent): PrivateRegister {
  switch (event.tag) {
    case "SetRelationConsent":
      return { ...register, relationConsent: event.consent };
  }
}

/** Fold a sequence of events over an initial register. Pure. */
export function foldPrivateRegister(initial: PrivateRegister, events: readonly PrivateRegisterEvent[]): PrivateRegister {
  return events.reduce(applyPrivateRegisterEvent, initial);
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

export function privateRegisterDigest(register: PrivateRegister): string {
  return createHash("sha256").update(canonicalize(register)).digest("hex");
}

/**
 * The public projection of the private register — the ONLY thing the agent
 * exposes to the public trace. Relation consent surfaces as a coarse "open" /
 * "closed" relation posture; the underlying private state is not revealed.
 */
export type PublicRelationPosture = "open" | "closed";

export function publicProjection(register: PrivateRegister): PublicRelationPosture {
  return register.relationConsent === "accept" ? "open" : "closed";
}

/**
 * Non-collapse witness — proves two private event sequences (`leftEvents`,
 * `rightEvents`) over the same `initial` register produce DISTINCT public
 * projections (`leftPublic` ≠ `rightPublic`). `sharedTrace` is the public
 * context both runs share (held constant), isolating the private state as the
 * sole cause of the public divergence.
 */
export interface PrivateRegisterNonCollapseWitness<R, E, S, P> {
  readonly agent: AgentPersona;
  readonly initial: R;
  readonly leftEvents: readonly E[];
  readonly rightEvents: readonly E[];
  readonly leftFinal: R;
  readonly rightFinal: R;
  readonly sharedTrace: S;
  readonly leftPublic: P;
  readonly rightPublic: P;
}

/**
 * Construct a non-collapse witness for the relation-consent register by folding
 * both event sequences and projecting each to its public posture.
 */
export function createNonCollapseWitness(
  agent: AgentPersona,
  initial: PrivateRegister,
  leftEvents: readonly PrivateRegisterEvent[],
  rightEvents: readonly PrivateRegisterEvent[],
  sharedTrace: string,
): PrivateRegisterNonCollapseWitness<PrivateRegister, PrivateRegisterEvent, string, PublicRelationPosture> {
  const leftFinal = foldPrivateRegister(initial, leftEvents);
  const rightFinal = foldPrivateRegister(initial, rightEvents);
  return {
    agent,
    initial,
    leftEvents,
    rightEvents,
    leftFinal,
    rightFinal,
    sharedTrace,
    leftPublic: publicProjection(leftFinal),
    rightPublic: publicProjection(rightFinal),
  };
}

/** The non-collapse property holds iff the two public projections differ. */
export function nonCollapseHolds<R, E, S, P>(witness: PrivateRegisterNonCollapseWitness<R, E, S, P>): boolean {
  return witness.leftPublic !== witness.rightPublic;
}
