// agent-state-store.ts — Merge1 §03: tamper-evident agent state records.
//
// Implemented from the §03 spec sketch (no donor file in this repo's slice).
// Each state record carries a SHA256 digest of its state plus a link to the
// previous record's id + digest, forming a hash chain. Lineage dominance: the
// longest valid chain wins (fork resolution). Records persist as ZetaId-named
// JSON files, mirroring the §02 event sink.
//
// MP-3 (ZetaId addressability): recordId is the record identity.
// MP-4 (retraction-native): records are append-only; a fork is resolved by
// dominance, never by overwriting history.

import { createHash } from "node:crypto";

import type { AgentState, MenuOption, WorkResult } from "./agent-state-machine.ts";

/** What the agent saw + chose at a Transition (the menu-selector input). */
export interface AgentStateRecordMenuInput {
  readonly menuOptionCount: number;
  readonly chosenOptionTag: MenuOption["tag"];
}

export type AgentStateRecordCause =
  | { readonly tag: "Transition"; readonly menuInput: AgentStateRecordMenuInput; readonly option: MenuOption }
  | { readonly tag: "CycleClose" }
  | { readonly tag: "PostResultTransition"; readonly result: WorkResult }
  | { readonly tag: "SessionRestart"; readonly reason: string };

export interface AgentStateRecord {
  readonly recordId: string; // ZetaId
  readonly runId: string;
  readonly sequence: number;
  readonly state: AgentState;
  readonly stateDigest: string; // SHA256 of the canonical state
  readonly previousRecordId?: string;
  readonly previousStateDigest?: string;
  readonly previousAgentRecordId?: string;
  readonly previousAgentStateDigest?: string;
  readonly cause?: AgentStateRecordCause;
  readonly recordedAtIso: string;
}

/** Fields supplied by the caller when appending a new record. */
export interface NewAgentStateRecord {
  readonly recordId: string;
  readonly runId: string;
  readonly state: AgentState;
  readonly recordedAtIso: string;
  readonly cause?: AgentStateRecordCause;
  /** The previous record from a DIFFERENT agent run (cross-agent lineage), if any. */
  readonly previousAgentRecord?: Pick<AgentStateRecord, "recordId" | "stateDigest">;
}

/** Stable JSON: object keys sorted recursively, so the digest is order-independent. */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

/** SHA256 digest of the canonical state — the chain link. */
export function agentStateDigest(state: AgentState): string {
  return createHash("sha256").update(canonicalize(state)).digest("hex");
}

/**
 * Build a state record, linking it to `previous` (the prior record in this run)
 * to form the hash chain: sequence increments, and the previous id + digest are
 * stamped so any tampering of an earlier record breaks the chain.
 */
export function createAgentStateRecord(input: NewAgentStateRecord, previous?: AgentStateRecord): AgentStateRecord {
  const stateDigest = agentStateDigest(input.state);
  return {
    recordId: input.recordId,
    runId: input.runId,
    sequence: previous === undefined ? 0 : previous.sequence + 1,
    state: input.state,
    stateDigest,
    ...(previous === undefined ? {} : { previousRecordId: previous.recordId, previousStateDigest: previous.stateDigest }),
    ...(input.previousAgentRecord === undefined
      ? {}
      : { previousAgentRecordId: input.previousAgentRecord.recordId, previousAgentStateDigest: input.previousAgentRecord.stateDigest }),
    ...(input.cause === undefined ? {} : { cause: input.cause }),
    recordedAtIso: input.recordedAtIso,
  };
}

/**
 * Verify a chain is intact: sequences are contiguous from 0, each record's
 * back-links match the prior record, and each stateDigest matches its state.
 * Returns the index of the first broken link, or -1 if the chain is sound.
 */
export function firstBrokenLink(chain: readonly AgentStateRecord[]): number {
  for (let i = 0; i < chain.length; i++) {
    const rec = chain[i]!;
    if (rec.sequence !== i) return i;
    if (rec.stateDigest !== agentStateDigest(rec.state)) return i;
    if (i === 0) {
      if (rec.previousRecordId !== undefined || rec.previousStateDigest !== undefined) return i;
    } else {
      const prev = chain[i - 1]!;
      if (rec.previousRecordId !== prev.recordId || rec.previousStateDigest !== prev.stateDigest) return i;
    }
  }
  return -1;
}

/**
 * Lineage dominance: of two chains, the longer valid one wins; ties break on the
 * tip's stateDigest (deterministic). A chain with a broken link cannot dominate
 * an intact one. Returns the dominant chain.
 */
export function dominantChain(a: readonly AgentStateRecord[], b: readonly AgentStateRecord[]): readonly AgentStateRecord[] {
  const aBroken = firstBrokenLink(a) !== -1;
  const bBroken = firstBrokenLink(b) !== -1;
  if (aBroken && !bBroken) return b;
  if (bBroken && !aBroken) return a;
  if (a.length !== b.length) return a.length > b.length ? a : b;
  const aTip = a[a.length - 1];
  const bTip = b[b.length - 1];
  if (aTip === undefined) return b;
  if (bTip === undefined) return a;
  return aTip.stateDigest >= bTip.stateDigest ? a : b;
}
