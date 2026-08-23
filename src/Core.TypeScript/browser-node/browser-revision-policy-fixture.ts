import {
  BROWSER_CHECKPOINT_RECORD_SCHEMA,
  type BrowserCheckpointFeedback,
  type BrowserCheckpointPort,
  type BrowserCheckpointRecord,
} from "./browser-checkpoint-port";
import {
  openNativeIndexedDbCheckpointPort,
  type NativeIndexedDbCheckpointFeedback,
  type NativeIndexedDbCheckpointResult,
} from "./browser-indexeddb-checkpoint";
import {
  compareAndSwapRevisionPolicy,
  monotoneLastWriterWinsRevisionPolicy,
  type RevisionPolicyId,
  type RevisionPolicyPort,
} from "../persistence/revision-policy";

export const BROWSER_REVISION_POLICY_FIXTURE_SCHEMA = "zeta.browser-revision-policy-fixture.v1" as const;

export interface BrowserRevisionPolicyFixtureRecord {
  readonly revision: number;
  readonly payload: string;
}

export interface BrowserRevisionPolicyFixtureReadout {
  readonly schema: typeof BROWSER_REVISION_POLICY_FIXTURE_SCHEMA;
  readonly policyId: RevisionPolicyId;
}

export type BrowserRevisionPolicyFixtureFeedback = BrowserCheckpointFeedback | NativeIndexedDbCheckpointFeedback;

export type BrowserRevisionPolicyFixtureResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserRevisionPolicyFixtureFeedback };

export interface BrowserRevisionPolicyFixtureApi {
  ready(): Promise<BrowserRevisionPolicyFixtureResult<BrowserRevisionPolicyFixtureReadout>>;
  load(): Promise<BrowserRevisionPolicyFixtureResult<BrowserRevisionPolicyFixtureRecord | null>>;
  save(
    revision: number,
    payload: string,
  ): Promise<BrowserRevisionPolicyFixtureResult<BrowserRevisionPolicyFixtureRecord>>;
  remove(throughRevision: number): Promise<BrowserRevisionPolicyFixtureResult<boolean>>;
  close(): Promise<BrowserRevisionPolicyFixtureResult<null>>;
}

interface BrowserRevisionPolicyFixtureGlobal {
  __zetaBrowserRevisionPolicy?: BrowserRevisionPolicyFixtureApi;
}

function record(value: unknown): Readonly<Record<string, unknown>> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function queryParameter(name: string): string | null {
  const location = record(Reflect.get(globalThis, "location"));
  const search = location === null ? "" : Reflect.get(location, "search");
  return new URLSearchParams(typeof search === "string" ? search : "").get(name);
}

function selectPolicy(value: string | null): RevisionPolicyPort | null | undefined {
  if (value === null) return undefined;
  if (value === compareAndSwapRevisionPolicy.id) return compareAndSwapRevisionPolicy;
  if (value === monotoneLastWriterWinsRevisionPolicy.id) return monotoneLastWriterWinsRevisionPolicy;
  return null;
}

function configurationFailed(detail: string): NativeIndexedDbCheckpointResult<BrowserCheckpointPort> {
  return {
    ok: false,
    feedback: { severity: "heat", code: "indexed-db-configuration-invalid", detail },
  };
}

function toFixtureRecord(value: BrowserCheckpointRecord): BrowserRevisionPolicyFixtureRecord {
  return { revision: value.revision, payload: new TextDecoder().decode(value.payload) };
}

const policyValue = queryParameter("policy");
const revisionPolicy = selectPolicy(policyValue);
const databaseName = queryParameter("database") ?? "zeta-browser-revision-policy";
const storeName = queryParameter("store") ?? "checkpoints";
const nodeId = queryParameter("node") ?? "revision-policy-node";
const opened =
  revisionPolicy === null
    ? Promise.resolve(configurationFailed(`Unknown revision policy: ${policyValue ?? "missing"}.`))
    : openNativeIndexedDbCheckpointPort(globalThis, {
        databaseName,
        storeName,
        ...(revisionPolicy === undefined ? {} : { revisionPolicy }),
      });

async function withPort<T>(
  operation: (port: BrowserCheckpointPort) => Promise<BrowserRevisionPolicyFixtureResult<T>>,
): Promise<BrowserRevisionPolicyFixtureResult<T>> {
  const result = await opened;
  return result.ok ? operation(result.value) : result;
}

const api: BrowserRevisionPolicyFixtureApi = {
  ready: () =>
    withPort((port) =>
      Promise.resolve({
        ok: true,
        value: { schema: BROWSER_REVISION_POLICY_FIXTURE_SCHEMA, policyId: port.revisionPolicy.id },
      }),
    ),
  load: () =>
    withPort(async (port) => {
      const loaded = await port.load(nodeId);
      return loaded.ok ? { ok: true, value: loaded.value === null ? null : toFixtureRecord(loaded.value) } : loaded;
    }),
  save: (revision, payload) =>
    withPort(async (port) => {
      const saved = await port.save({
        schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
        nodeId,
        revision,
        payload: new TextEncoder().encode(payload),
      });
      return saved.ok ? { ok: true, value: toFixtureRecord(saved.value) } : saved;
    }),
  remove: (throughRevision) => withPort((port) => port.remove(nodeId, throughRevision)),
  close: () =>
    withPort((port) => {
      const closed = port.close();
      return Promise.resolve(closed);
    }),
};

(globalThis as unknown as BrowserRevisionPolicyFixtureGlobal).__zetaBrowserRevisionPolicy = api;
