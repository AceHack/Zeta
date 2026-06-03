import type { DocEntity } from "../../domain/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";

export type DocEntityStore = {
  upsert: (entity: DocEntity) => Promise<void>;
  listByOrg: (organizationId: string) => Promise<readonly DocEntity[]>;
};

export type CreateCockroachDocEntityStoreInput = { executor: CockroachGenericSqlExecutor };

type DocEntityRow = {
  doc_entity_id: string;
  organization_id: string;
  canonical_name: string;
  kind: string;
  aliases: unknown;
  created_at: string | Date;
  updated_at: string | Date;
};

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function rowToDocEntity(row: DocEntityRow): DocEntity {
  return {
    docEntityId: row.doc_entity_id,
    organizationId: row.organization_id,
    canonicalName: row.canonical_name,
    kind: row.kind,
    aliases: parseJson<string[]>(row.aliases),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function createCockroachDocEntityStore(input: CreateCockroachDocEntityStoreInput): DocEntityStore {
  const select = `
    SELECT doc_entity_id, organization_id, canonical_name, kind, aliases, created_at, updated_at
    FROM ${CockroachTableName.DocEntities}`;

  return {
    async upsert(entity): Promise<void> {
      await input.executor.execute({
        name: "upsert_doc_entity",
        sql: `
          INSERT INTO ${CockroachTableName.DocEntities} (
            doc_entity_id, organization_id, canonical_name, kind, aliases, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT (doc_entity_id) DO UPDATE SET
            canonical_name = excluded.canonical_name,
            kind = excluded.kind,
            aliases = excluded.aliases,
            updated_at = excluded.updated_at`,
        parameters: [
          entity.docEntityId,
          entity.organizationId,
          entity.canonicalName,
          entity.kind,
          JSON.stringify(entity.aliases),
          entity.createdAt,
          entity.updatedAt,
        ],
      });
    },
    async listByOrg(organizationId): Promise<readonly DocEntity[]> {
      const result = await input.executor.execute<DocEntityRow>({
        name: "list_doc_entities_by_org",
        sql: `${select} WHERE organization_id = $1 ORDER BY created_at ASC`,
        parameters: [organizationId],
      });
      return result.rows.map(rowToDocEntity);
    },
  };
}
