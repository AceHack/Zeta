/**
 * Work-item event G-Set (081KSXN940008QG0R002FWR9B2 slice 1).
 *
 * Append-only, ZetaId-keyed JSON files under `workitems/events/` — the same
 * disjoint-file / G-Set CRDT property as the agent-bus (081KSXN940008QG0R00171YAZW).
 * Events are FACTS (created / state-changed / closed); the markdown file in
 * `workitems/` is the current projection; this log is the durable substrate
 * for folds (open backlog Z-set view, DORA Bag-folds).
 */
import { join } from "node:path";
import { pack, DEFAULT_ENV, type SimulationEnvironment } from "../zeta-id/zeta-id";
import { isCanonicalZetaIdHex } from "../zeta-id/canonical-hex";
import {
  Category,
  IdVersion,
  Chromosome,
  Persona,
  LocationHint,
  type ZetaObservation,
  type Milliseconds,
} from "../zeta-id/types";
import type { WorkItemType } from "../backlog/new-workitem";

/** Repo-relative root; override with `ZETA_WORKITEM_EVENTS_DIR` in tests. */
export const WORKITEM_EVENTS_ROOT: string = process.env.ZETA_WORKITEM_EVENTS_DIR ?? "workitems/events";

export type WorkItemLifecycleState = "backlog" | "in-progress" | "done" | "closed";

export type WorkItemCreatedPayload = {
  readonly workItemId: string;
  readonly type: WorkItemType;
  readonly title: string;
  readonly slug: string;
  readonly priority: string;
  readonly filename: string;
};

export type WorkItemStateChangedPayload = {
  readonly workItemId: string;
  readonly from: WorkItemLifecycleState;
  readonly to: WorkItemLifecycleState;
};

export type WorkItemClosedPayload = {
  readonly workItemId: string;
  readonly reason?: string;
};

export type WorkItemEvent =
  | {
      readonly id: string;
      readonly at: string;
      readonly by: string;
      readonly kind: "created";
      readonly payload: WorkItemCreatedPayload;
    }
  | {
      readonly id: string;
      readonly at: string;
      readonly by: string;
      readonly kind: "state-changed";
      readonly payload: WorkItemStateChangedPayload;
    }
  | {
      readonly id: string;
      readonly at: string;
      readonly by: string;
      readonly kind: "closed";
      readonly payload: WorkItemClosedPayload;
    };

const pad2 = (n: number): string => String(n).padStart(2, "0");

export function isCanonicalTimestamp(ts: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(ts);
}

/**
 * A canonical work-item event id is 32 lowercase hex that DECODES as a ZetaId.
 *
 * Was a bare `/^[0-9a-f]{32}$/` — an encoding check standing in for a value check, which
 * accepts any 32 hex characters (a truncated hash, hex-encoded JSON, random hex). All
 * 205 event ids under `workitems/events/` decode cleanly, so this is a tightening with
 * no legacy carve-out. See `src/Core.TypeScript/zeta-id/canonical-hex.ts`.
 */
export function isCanonicalEventId(id: string): boolean {
  return isCanonicalZetaIdHex(id);
}

/** `<root>/<YYYY>/<MM>/<DD>/<id>.json` (UTC date partition). */
export function eventPath(root: string, id: string, at: Date = new Date()): string {
  if (!isCanonicalEventId(id)) {
    throw new Error(`work-items: unsafe event id ${JSON.stringify(id)}`);
  }
  return join(
    root,
    String(at.getUTCFullYear()),
    pad2(at.getUTCMonth() + 1),
    pad2(at.getUTCDate()),
    `${id}.json`,
  );
}

/** Mint a WorkItem-category ZetaId as 32-hex — the event identity (distinct from workItemId). */
export function mintWorkItemEventIdHex(env: SimulationEnvironment = DEFAULT_ENV, atMs: number = Date.now()): string {
  const obs: ZetaObservation = {
    version: IdVersion.V1,
    timestamp: atMs as Milliseconds,
    chromosome: Chromosome.MetaCoherence,
    category: Category.WorkItem,
    authority: { type: "TrustedAgent" },
    persona: Persona.FireflyCoherence,
    momentum: { type: "Normal" },
    location: LocationHint.EastUS_VA1,
  };
  return pack(obs, env).toString(16).padStart(32, "0");
}

export function serializeEvent(event: WorkItemEvent): string {
  return `${JSON.stringify(event, null, 2)}\n`;
}

export function makeCreatedEvent(
  payload: WorkItemCreatedPayload,
  by: string,
  atMs: number,
  mintAt: (atMs: number) => string = (ms) => mintWorkItemEventIdHex(DEFAULT_ENV, ms),
): Extract<WorkItemEvent, { kind: "created" }> {
  return {
    id: mintAt(atMs),
    at: new Date(atMs).toISOString(),
    by,
    kind: "created",
    payload,
  };
}

export function makeStateChangedEvent(
  payload: WorkItemStateChangedPayload,
  by: string,
  atMs: number,
  mintAt: (atMs: number) => string = (ms) => mintWorkItemEventIdHex(DEFAULT_ENV, ms),
): Extract<WorkItemEvent, { kind: "state-changed" }> {
  return {
    id: mintAt(atMs),
    at: new Date(atMs).toISOString(),
    by,
    kind: "state-changed",
    payload,
  };
}

export function makeClosedEvent(
  payload: WorkItemClosedPayload,
  by: string,
  atMs: number,
  mintAt: (atMs: number) => string = (ms) => mintWorkItemEventIdHex(DEFAULT_ENV, ms),
): Extract<WorkItemEvent, { kind: "closed" }> {
  return {
    id: mintAt(atMs),
    at: new Date(atMs).toISOString(),
    by,
    kind: "closed",
    payload,
  };
}

const LIFECYCLE_STATES: readonly WorkItemLifecycleState[] = ["backlog", "in-progress", "done", "closed"];

export function parseLifecycleState(raw: string | undefined): WorkItemLifecycleState | undefined {
  if (!raw) return undefined;
  return (LIFECYCLE_STATES as readonly string[]).includes(raw) ? (raw as WorkItemLifecycleState) : undefined;
}
