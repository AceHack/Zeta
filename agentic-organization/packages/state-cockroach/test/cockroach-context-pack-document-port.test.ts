import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  DocLifecycleState,
  DocScopeKind,
  DocType,
  type DocUnit,
} from "../../domain/src/index.ts";
import {
  ContextPackDocConsultOutcomeClass,
  RunLifecyclePhase,
  type ContextPackDocumentReadRequest,
  type ContextPackDocConsultOutcomeLookup,
} from "../../application/src/index.ts";
import {
  createCockroachContextPackDocumentPort,
} from "../src/cockroach-context-pack-document-port.ts";
import { createCockroachDocEntityStore } from "../src/cockroach-doc-entity-store.ts";
import { createCockroachDocUnitStore } from "../src/cockroach-doc-unit-store.ts";
import type { CockroachGenericSqlExecutor } from "../src/cockroach-sql-executor.ts";

test("Cockroach context-pack document port retrieves scoped docs and bound consult docs", async () => {
  const store = createCockroachDocUnitStore({ executor: fakeExecutor() });
  await store.upsert(docUnit({
    docUnitId: "project-brd",
    type: DocType.Brd,
    title: "Billing BRD",
    summary: "Billing recovery requirements.",
    scopeKind: DocScopeKind.Project,
    scopeId: "project-billing",
  }));
  await store.upsert(docUnit({
    docUnitId: "director-handbook",
    type: DocType.Handbook,
    title: "Director Blocker Handbook",
    summary: "Directors must resolve ownership blockers.",
    scopeKind: DocScopeKind.Department,
    scopeId: "engineering",
    boundHatIds: ["engineering_director"],
    boundStageIds: [RunLifecyclePhase.Blocked],
  }));
  await store.upsert(docUnit({
    docUnitId: "other-project",
    title: "Other Project",
    summary: "Unrelated context.",
    scopeKind: DocScopeKind.Project,
    scopeId: "project-other",
  }));

  const port = createCockroachContextPackDocumentPort({
    docUnits: store,
    sourceGraphVersion: "cockroach-doc-units:test",
  });

  const result = await port.retrieve(request());

  equal(result.sourceGraphVersion, "cockroach-doc-units:test");
  ok(result.retrieval.hits.some((hit) => hit.unit.docUnitId === "project-brd"));
  ok(result.retrieval.consulted.some((unit) => unit.docUnitId === "director-handbook"));
  ok(!result.retrieval.hits.some((hit) => hit.unit.docUnitId === "other-project"));
});

test("Cockroach context-pack document port de-duplicates scoped and bound units", async () => {
  const store = createCockroachDocUnitStore({ executor: fakeExecutor() });
  await store.upsert(docUnit({
    docUnitId: "project-stage-doc",
    title: "Project Stage Doc",
    summary: "Billing blocked stage context.",
    scopeKind: DocScopeKind.Project,
    scopeId: "project-billing",
    boundStageIds: [RunLifecyclePhase.Blocked],
  }));

  const port = createCockroachContextPackDocumentPort({ docUnits: store });
  const result = await port.retrieve(request());

  equal(result.retrieval.diagnostics.corpusSize, 1);
});

test("Cockroach context-pack document port passes preferred doc types through scoped retrieval", async () => {
  const store = createCockroachDocUnitStore({ executor: fakeExecutor() });
  await store.upsert(docUnit({
    docUnitId: "project-brd",
    type: DocType.Brd,
    title: "Customer Rulebook",
    summary: "Revenue approval criteria.",
    scopeKind: DocScopeKind.Project,
    scopeId: "project-billing",
  }));
  await store.upsert(docUnit({
    docUnitId: "project-runbook",
    type: DocType.Runbook,
    title: "Operator Notes",
    summary: "Console maintenance rotation.",
    scopeKind: DocScopeKind.Project,
    scopeId: "project-billing",
  }));
  await store.upsert(docUnit({
    docUnitId: "other-brd",
    type: DocType.Brd,
    title: "Other Customer Rulebook",
    summary: "Revenue approval criteria.",
    scopeKind: DocScopeKind.Project,
    scopeId: "project-other",
  }));

  const port = createCockroachContextPackDocumentPort({ docUnits: store });
  const result = await port.retrieve({
    ...request(),
    query: "billing blocker",
    retrievalContext: {
      ...request().retrievalContext,
      preferredDocTypes: [DocType.Brd],
    },
  });

  equal(result.retrieval.hits[0]?.unit.docUnitId, "project-brd");
  ok(result.retrieval.hits[0]?.reasons.includes(`preferred-doc-type:${DocType.Brd}`));
  equal(result.retrieval.diagnostics.preferredTypeBoosts, 1);
  ok(!result.retrieval.hits.some((hit) => hit.unit.docUnitId === "project-runbook"));
  ok(!result.retrieval.hits.some((hit) => hit.unit.docUnitId === "other-brd"));
});

test("Cockroach context-pack document port loads entities for alias-anchored retrieval", async () => {
  const executor = fakeExecutor();
  const docUnits = createCockroachDocUnitStore({ executor });
  const docEntities = createCockroachDocEntityStore({ executor });
  await docEntities.upsert({
    docEntityId: "ent-billing",
    organizationId: "org-lfg",
    canonicalName: "Billing",
    kind: "service",
    aliases: ["customer revenue subsystem", "services/billing"],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-30T00:00:00.000Z",
  });
  await docUnits.upsert(docUnit({
    docUnitId: "billing-runbook",
    title: "Billing operations",
    summary: "Worker pool ownership and queue recovery.",
    scopeKind: DocScopeKind.Project,
    scopeId: "project-billing",
  }));
  await docUnits.upsert(docUnit({
    docUnitId: "generic-runbook",
    title: "Generic operations",
    summary: "Worker pool ownership and queue recovery.",
    scopeKind: DocScopeKind.Project,
    scopeId: "project-billing",
  }));

  const port = createCockroachContextPackDocumentPort({ docUnits, docEntities });
  const result = await port.retrieve({
    ...request(),
    query: "customer revenue subsystem",
  });

  equal(result.retrieval.hits[0]?.unit.docUnitId, "billing-runbook");
  ok(result.retrieval.hits[0]?.reasons.includes("entity-anchored"));
  ok(result.retrieval.diagnostics.queryEntities.includes("ent-billing"));
});

test("Cockroach context-pack document port applies consult outcome utility from a generic reader", async () => {
  const lookups: ContextPackDocConsultOutcomeLookup[] = [];
  const store = createCockroachDocUnitStore({ executor: fakeExecutor() });
  await store.upsert(docUnit({
    docUnitId: "historically-useful",
    title: "Billing Blocker Useful",
    summary: "Billing blocker context.",
  }));
  await store.upsert(docUnit({
    docUnitId: "historically-risky",
    title: "Billing Blocker Risky",
    summary: "Billing blocker context.",
  }));

  const port = createCockroachContextPackDocumentPort({
    docUnits: store,
    consultOutcomes: {
      loadOutcomeCounts: async (lookup) => {
        lookups.push(lookup);
        return new Map([
          ["historically-useful", {
            [ContextPackDocConsultOutcomeClass.Success]: 5,
            [ContextPackDocConsultOutcomeClass.Failure]: 0,
          }],
          ["historically-risky", {
            [ContextPackDocConsultOutcomeClass.Success]: 0,
            [ContextPackDocConsultOutcomeClass.Failure]: 5,
          }],
        ]);
      },
    },
  });

  const result = await port.retrieve(request());

  equal(result.retrieval.hits[0]?.unit.docUnitId, "historically-useful");
  ok(result.retrieval.hits[0]?.reasons.includes("kpi:1.00"));
  ok(result.retrieval.hits.some((hit) =>
    hit.unit.docUnitId === "historically-risky" && hit.reasons.includes("kpi:-1.00")
  ));
  equal(lookups.length, 1);
  deepEqual(lookups[0], {
    organizationId: "org-lfg",
    hatId: "engineering_director",
    stageId: RunLifecyclePhase.Blocked,
    projectId: "project-billing",
  });
});

function request(): ContextPackDocumentReadRequest {
  return {
    query: "engineering_director blocked project-billing billing",
    observedAt: "2026-05-31T00:00:00.000Z",
    retrievalContext: {
      organizationId: "org-lfg",
      hatId: "engineering_director",
      stageId: RunLifecyclePhase.Blocked,
      workItemId: "work-billing",
      scopes: [
        { kind: DocScopeKind.Organization, id: "org-lfg" },
        { kind: DocScopeKind.Project, id: "project-billing" },
      ],
    },
  };
}

function fakeExecutor(): CockroachGenericSqlExecutor {
  const docUnitRows = new Map<string, Record<string, unknown>>();
  const docEntityRows = new Map<string, Record<string, unknown>>();
  const execute = async (statement: { sql: string; parameters: readonly unknown[] }) => {
    const sql = statement.sql;
    const parameters = statement.parameters;
    if (sql.includes("INSERT INTO agentic_org_doc_entities")) {
      const row = docEntityRowFromParameters(parameters);
      docEntityRows.set(row["doc_entity_id"] as string, row);
      return { rows: [] };
    }
    if (sql.includes("FROM agentic_org_doc_entities")) {
      return {
        rows: [...docEntityRows.values()].filter((row) => row["organization_id"] === parameters[0]),
      };
    }
    if (sql.includes("INSERT INTO")) {
      const row = rowFromParameters(parameters);
      docUnitRows.set(row["doc_unit_id"] as string, row);
      return { rows: [] };
    }
    if (sql.includes("scope_kind = $2 AND scope_id = $3")) {
      return {
        rows: [...docUnitRows.values()].filter((row) =>
          row["organization_id"] === parameters[0] &&
          row["scope_kind"] === parameters[1] &&
          row["scope_id"] === parameters[2]
        ),
      };
    }
    if (sql.includes("bound_hat_ids @>")) {
      const boundHatIds = JSON.parse(parameters[2] as string) as string[];
      const boundStageIds = JSON.parse(parameters[3] as string) as string[];
      return {
        rows: [...docUnitRows.values()].filter((row) =>
          row["organization_id"] === parameters[0] &&
          row["status"] === parameters[1] &&
          (
            boundHatIds.some((hatId) => (JSON.parse(row["bound_hat_ids"] as string) as string[]).includes(hatId)) ||
            boundStageIds.some((stageId) => (JSON.parse(row["bound_stage_ids"] as string) as string[]).includes(stageId))
          )
        ),
      };
    }
    if (sql.includes("status = $2")) {
      return {
        rows: [...docUnitRows.values()].filter((row) =>
          row["organization_id"] === parameters[0] &&
          row["status"] === parameters[1]
        ),
      };
    }
    return { rows: [] };
  };
  return {
    execute,
    executeTransaction: async (operation: (executor: { execute: typeof execute }) => unknown) =>
      await operation({ execute }),
  } as unknown as CockroachGenericSqlExecutor;
}

function docEntityRowFromParameters(parameters: readonly unknown[]): Record<string, unknown> {
  return {
    doc_entity_id: parameters[0],
    organization_id: parameters[1],
    canonical_name: parameters[2],
    kind: parameters[3],
    aliases: parameters[4],
    created_at: parameters[5],
    updated_at: parameters[6],
  };
}

function rowFromParameters(parameters: readonly unknown[]): Record<string, unknown> {
  return {
    doc_unit_id: parameters[0],
    organization_id: parameters[1],
    source_id: parameters[2],
    type: parameters[3],
    scope_kind: parameters[4],
    scope_id: parameters[5],
    title: parameters[6],
    summary: parameters[7],
    content_ref: parameters[8],
    content_hash: parameters[9],
    status: parameters[10],
    freshness_at: parameters[11],
    bound_hat_ids: parameters[12],
    bound_stage_ids: parameters[13],
    supersedes_id: parameters[14],
    provenance_change_set_id: parameters[15],
    created_at: parameters[16],
    updated_at: parameters[17],
    version: parameters[18],
  };
}

function docUnit(overrides: Partial<DocUnit>): DocUnit {
  const id = overrides.docUnitId ?? "doc";
  return {
    docUnitId: id,
    organizationId: "org-lfg",
    sourceId: "source-main",
    type: DocType.Runbook,
    scopeKind: DocScopeKind.Project,
    scopeId: "project-billing",
    title: "Doc",
    summary: "Billing context",
    contentRef: `git://docs/${id}.md`,
    contentHash: `hash-${id}`,
    status: DocLifecycleState.Active,
    freshnessAt: "2026-05-30T00:00:00.000Z",
    boundHatIds: [],
    boundStageIds: [],
    provenanceChangeSetId: "cs-docs",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-30T00:00:00.000Z",
    version: 1,
    ...overrides,
  };
}
