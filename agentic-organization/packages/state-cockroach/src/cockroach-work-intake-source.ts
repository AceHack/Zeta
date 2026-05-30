/**
 * Cockroach-backed Work OS intake source (A1) — turns the worker's work-os cadence
 * lane into a REAL living loop instead of an idle/synthetic one. Each call atomically
 * CLAIMS one `proposed` initiative and flips it to `active`, returning the work tuple
 * the lane drives through `runWorkOsCycle`. The claim is dequeue-once: an initiative
 * is only ever in `proposed` until claimed, so it is driven exactly once and the next
 * tick sees nothing to claim → the lane idles (no synthetic flood, no re-drive).
 *
 * The dequeue lifecycle lives HERE, inside the source, so the cadence lane stays a
 * pure consumer of `WorkIntake` (single responsibility). The branch is synthesized
 * deterministically from the initiative id — initiatives carry no branch column, and
 * a stable derived ref keeps the cycle reproducible.
 *
 * Returns the structural `WorkIntake` shape (projectId/initiativeId/initiativeBranch)
 * so this state-layer module never imports the apps layer — structural typing makes
 * it assignable to `WorkIntakeSource` at the composition site.
 */

import { InitiativeStatus } from "../../domain/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";

export type ClaimedWorkIntake = {
  projectId: string;
  initiativeId: string;
  initiativeBranch: string;
};

export type CreateCockroachWorkIntakeSourceInput = {
  executor: CockroachGenericSqlExecutor;
  organizationId: string;
  /** current time as an ISO string, for the claim's updated_at */
  nowIso: () => string;
};

type ClaimRow = { initiative_id: string; project_id: string };

/**
 * Atomic claim: pick the oldest `proposed` initiative and flip it to `active` in one
 * statement, returning its identity. Single-statement update on the PK is atomic; the
 * deployment runs one worker replica, so no skip-locked contention to arbitrate.
 */
export function createCockroachWorkIntakeSource(
  input: CreateCockroachWorkIntakeSourceInput,
): () => Promise<ClaimedWorkIntake | null> {
  const sql = `
    UPDATE ${CockroachTableName.Initiatives}
    SET status = $3, updated_at = $2, version = version + 1
    WHERE initiative_id = (
      SELECT initiative_id FROM ${CockroachTableName.Initiatives}
      WHERE organization_id = $1 AND status = $4
      ORDER BY created_at ASC
      LIMIT 1
    )
    RETURNING initiative_id, project_id
  `.trim();

  return async () => {
    const result = await input.executor.execute<ClaimRow>({
      name: "claim_proposed_initiative",
      sql,
      parameters: [input.organizationId, input.nowIso(), InitiativeStatus.Active, InitiativeStatus.Proposed],
    });
    const row = result.rows[0];
    if (row === undefined) return null; // nothing proposed → the lane idles this tick
    return {
      projectId: row.project_id,
      initiativeId: row.initiative_id,
      initiativeBranch: `feat/${row.initiative_id}`,
    };
  };
}
