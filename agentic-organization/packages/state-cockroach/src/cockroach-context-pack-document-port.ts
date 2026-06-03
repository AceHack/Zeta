import { DocScopeKind, type DocEntity, type DocUnit } from "../../domain/src/index.ts";
import {
  runRetrieval,
  type ContextPackDocumentReadPort,
  type ContextPackDocumentReadRequest,
  type ContextPackDocumentReadResult,
  type ContextPackDocConsultOutcomeReaderPort,
  type RetrievalContext,
  type RetrievalDeps,
} from "../../application/src/index.ts";
import type { DocUnitStore } from "./cockroach-doc-unit-store.ts";

export type CreateCockroachContextPackDocumentPortInput = {
  docUnits: Pick<DocUnitStore, "listByOrgScope" | "listBoundConsults">;
  docEntities?: DocEntityReader | undefined;
  retrievalDeps?: RetrievalDeps | undefined;
  consultOutcomes?: ContextPackDocConsultOutcomeReaderPort | undefined;
  sourceGraphVersion?: string | undefined;
};

export type DocEntityReader = {
  listByOrg: (organizationId: string) => Promise<readonly DocEntity[]>;
};

const COCKROACH_CONTEXT_PACK_SOURCE_GRAPH_VERSION = "cockroach-doc-units:v1";

export function createCockroachContextPackDocumentPort(
  input: CreateCockroachContextPackDocumentPortInput,
): ContextPackDocumentReadPort {
  return {
    async retrieve(request): Promise<ContextPackDocumentReadResult> {
      const corpus = await loadRetrievalCorpus(input.docUnits, request);
      const entities = input.docEntities === undefined
        ? []
        : await input.docEntities.listByOrg(request.retrievalContext.organizationId);
      const retrievalDeps = await retrievalDepsFor(input, request.retrievalContext);
      return {
        retrieval: runRetrieval(
          request.query,
          request.retrievalContext,
          corpus,
          entities,
          retrievalDeps,
        ),
        sourceGraphVersion: input.sourceGraphVersion ?? COCKROACH_CONTEXT_PACK_SOURCE_GRAPH_VERSION,
      };
    },
  };
}

async function retrievalDepsFor(
  input: CreateCockroachContextPackDocumentPortInput,
  context: RetrievalContext,
): Promise<RetrievalDeps | undefined> {
  if (input.consultOutcomes === undefined) return input.retrievalDeps;
  const consultOutcomes = await input.consultOutcomes.loadOutcomeCounts({
    organizationId: context.organizationId,
    ...(context.hatId === undefined ? {} : { hatId: context.hatId }),
    ...(context.stageId === undefined ? {} : { stageId: context.stageId }),
    ...optionalScopeLookup(context, DocScopeKind.Project, "projectId"),
    ...optionalScopeLookup(context, DocScopeKind.Team, "teamId"),
  });
  return {
    ...input.retrievalDeps,
    consultOutcomes: mergeConsultOutcomes(input.retrievalDeps?.consultOutcomes, consultOutcomes),
  };
}

function mergeConsultOutcomes(
  base: RetrievalDeps["consultOutcomes"],
  current: NonNullable<RetrievalDeps["consultOutcomes"]>,
): NonNullable<RetrievalDeps["consultOutcomes"]> {
  if (base === undefined) return current;
  return new Map([...base, ...current]);
}

function optionalScopeLookup<Key extends "projectId" | "teamId">(
  context: RetrievalContext,
  kind: DocScopeKind,
  key: Key,
): { [K in Key]?: string } {
  const id = context.scopes.find((scope) => scope.kind === kind)?.id;
  return id === undefined ? {} : { [key]: id } as { [K in Key]?: string };
}

async function loadRetrievalCorpus(
  docUnits: Pick<DocUnitStore, "listByOrgScope" | "listBoundConsults">,
  request: ContextPackDocumentReadRequest,
): Promise<readonly DocUnit[]> {
  const scoped = await Promise.all(
    request.retrievalContext.scopes.map((scope) =>
      docUnits.listByOrgScope(request.retrievalContext.organizationId, scope.kind, scope.id)
    ),
  );
  const boundConsults = await docUnits.listBoundConsults(
    request.retrievalContext.organizationId,
    request.retrievalContext.hatId,
    request.retrievalContext.stageId,
  );
  return uniqueDocUnits([
    ...scoped.flat(),
    ...boundConsults,
  ]);
}

function uniqueDocUnits(units: readonly DocUnit[]): readonly DocUnit[] {
  const seen = new Set<string>();
  return units.filter((unit) => {
    if (seen.has(unit.docUnitId)) return false;
    seen.add(unit.docUnitId);
    return true;
  });
}
