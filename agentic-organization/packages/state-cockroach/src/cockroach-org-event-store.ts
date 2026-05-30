/**
 * Cockroach-backed OrgEvent store — the durable, append-only organizational trace.
 * Every org transition writes exactly one row here; "what is happening" is a
 * query over this table (plus the binding rows). The supervisor chain + evidence
 * refs are JSONB so the full authorization context is preserved per event.
 */

import { randomUUID } from "node:crypto";

import { OrgEventKind, type DepartmentId, type OrgEvent } from "../../domain/src/index.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";

export type OrgEventStore = {
  append: (event: OrgEvent) => Promise<void>;
  listByOrganization: (organizationId: string, limit: number) => Promise<readonly OrgEvent[]>;
  listBySubject: (subjectId: string, limit: number) => Promise<readonly OrgEvent[]>;
};

export type CreateCockroachOrgEventStoreInput = {
  executor: CockroachGenericSqlExecutor;
  generateId?: () => string;
};

type OrgEventRow = {
  org_event_id: string;
  kind: string;
  organization_id: string;
  actor_hat_id: string | null;
  actor_agent_id: string | null;
  department_id: string | null;
  subject_id: string;
  from_state: string | null;
  to_state: string | null;
  decision: string;
  supervisor_chain: unknown;
  evidence_refs: unknown;
  correlation_id: string;
  causation_id: string;
  trace_id: string;
  occurred_at: string | Date;
};

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function asStringArray(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowToEvent(row: OrgEventRow): OrgEvent {
  return {
    id: row.org_event_id,
    kind: row.kind as OrgEventKind,
    occurredAt: toIso(row.occurred_at),
    organizationId: row.organization_id,
    ...(row.actor_hat_id !== null ? { actorHatId: row.actor_hat_id } : {}),
    ...(row.actor_agent_id !== null ? { actorAgentId: row.actor_agent_id } : {}),
    ...(row.department_id !== null ? { departmentId: row.department_id as DepartmentId } : {}),
    subjectId: row.subject_id,
    ...(row.from_state !== null ? { fromState: row.from_state } : {}),
    ...(row.to_state !== null ? { toState: row.to_state } : {}),
    decision: row.decision,
    supervisorChain: asStringArray(row.supervisor_chain),
    evidenceRefs: asStringArray(row.evidence_refs),
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    traceId: row.trace_id,
  };
}

export function createCockroachOrgEventStore(input: CreateCockroachOrgEventStoreInput): OrgEventStore {
  const nextId = input.generateId ?? (() => `orgevt-${randomUUID()}`);
  return {
    async append(eventInput: OrgEvent): Promise<void> {
      const id = eventInput.id !== "" ? eventInput.id : nextId();
      await input.executor.execute({
        name: "append_org_event",
        sql: `
          INSERT INTO agentic_org_org_events (
            org_event_id, kind, organization_id, actor_hat_id, actor_agent_id, department_id,
            subject_id, from_state, to_state, decision, supervisor_chain, evidence_refs,
            correlation_id, causation_id, trace_id, occurred_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::JSONB, $12::JSONB, $13, $14, $15, $16
          )
          ON CONFLICT (org_event_id) DO NOTHING`,
        parameters: [
          id, eventInput.kind, eventInput.organizationId, eventInput.actorHatId ?? null, eventInput.actorAgentId ?? null, eventInput.departmentId ?? null,
          eventInput.subjectId, eventInput.fromState ?? null, eventInput.toState ?? null, eventInput.decision,
          JSON.stringify(eventInput.supervisorChain), JSON.stringify(eventInput.evidenceRefs),
          eventInput.correlationId, eventInput.causationId, eventInput.traceId, eventInput.occurredAt,
        ],
      });
    },

    async listByOrganization(organizationId: string, limit: number): Promise<readonly OrgEvent[]> {
      const result = await input.executor.execute({
        name: "list_org_events_by_org",
        sql: `SELECT * FROM agentic_org_org_events WHERE organization_id = $1 ORDER BY occurred_at DESC LIMIT $2`,
        parameters: [organizationId, limit],
      });
      return (result.rows as OrgEventRow[]).map(rowToEvent);
    },

    async listBySubject(subjectId: string, limit: number): Promise<readonly OrgEvent[]> {
      const result = await input.executor.execute({
        name: "list_org_events_by_subject",
        sql: `SELECT * FROM agentic_org_org_events WHERE subject_id = $1 ORDER BY occurred_at DESC LIMIT $2`,
        parameters: [subjectId, limit],
      });
      return (result.rows as OrgEventRow[]).map(rowToEvent);
    },
  };
}
