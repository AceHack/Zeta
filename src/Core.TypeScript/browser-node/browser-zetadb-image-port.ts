import type {
  BrowserCheckpointFeedback,
  BrowserCheckpointPort,
  BrowserCheckpointResult,
} from "./browser-checkpoint-port";
import {
  openNativeIndexedDbCheckpointPort,
  type NativeIndexedDbCheckpointOptions,
} from "./browser-indexeddb-checkpoint";
import type {
  ZetaDbConvergencePolicy,
  ZetaDbFeedback,
  ZetaDbImagePort,
  ZetaDbImageRecord,
  ZetaDbResult,
  ZetaDbTickReadout,
  ZetaDbTickRequest,
} from "../zetadb/zeta-db-node";
import { runConvergentZetaDbNodeTick } from "../zetadb/zeta-db-node";
import { noForgetBackpressureAdmissionPolicy, type ZetaDbAdmissionPolicyPort } from "../zetadb/admission-policy";

export const DEFAULT_BROWSER_ZETA_DB_CONVERGENCE_POLICY: ZetaDbConvergencePolicy = { maxAttempts: 3 };

function mapCheckpointFeedback(
  feedback: BrowserCheckpointFeedback,
  operation: "read" | "write",
): { readonly ok: false; readonly feedback: ZetaDbFeedback } {
  let code: ZetaDbFeedback["code"] = operation === "read" ? "database-read-failed" : "database-write-failed";
  if (feedback.code === "checkpoint-revision-conflict") code = "database-revision-conflict";
  return {
    ok: false,
    feedback: {
      severity: feedback.severity,
      code,
      detail: feedback.detail,
    },
  };
}

/** Load one browser-backed image without exposing the checkpoint adapter to database callers. */
export async function loadBrowserZetaDbImage(
  root: unknown,
  options: NativeIndexedDbCheckpointOptions,
  nodeId: string,
): Promise<ZetaDbResult<ZetaDbImageRecord | null>> {
  const opened = await openNativeIndexedDbCheckpointPort(root, options);
  if (!opened.ok) {
    return {
      ok: false,
      feedback: { severity: opened.feedback.severity, code: "database-read-failed", detail: opened.feedback.detail },
    };
  }
  const loaded = mapRecordResult(await opened.value.load(nodeId), "read");
  const closed = opened.value.close();
  if (loaded.ok && !closed.ok) return mapCheckpointFeedback(closed.feedback, "read");
  return loaded;
}

function mapRecordResult(
  result: BrowserCheckpointResult<{
    readonly nodeId: string;
    readonly revision: number;
    readonly payload: Uint8Array;
  } | null>,
  operation: "read" | "write",
): ZetaDbResult<ZetaDbImageRecord | null> {
  if (!result.ok) return mapCheckpointFeedback(result.feedback, operation);
  if (result.value === null) return { ok: true, value: null };
  return {
    ok: true,
    value: { ...result.value, payload: new Uint8Array(result.value.payload) },
  };
}

/** Adapt browser persistence without making the database kernel depend on browser APIs. */
export function createBrowserZetaDbImagePort(checkpoints: BrowserCheckpointPort): ZetaDbImagePort {
  return {
    // Inherit the executable policy the checkpoint adapter applies inside its transaction.
    revisionPolicy: checkpoints.revisionPolicy,
    load: async (nodeId) => mapRecordResult(await checkpoints.load(nodeId), "read"),
    save: async (record) => {
      const saved = mapRecordResult(
        await checkpoints.save({
          schema: "zeta.browser-checkpoint-record.v1",
          nodeId: record.nodeId,
          revision: record.revision,
          payload: new Uint8Array(record.payload),
        }),
        "write",
      );
      if (!saved.ok) return saved;
      if (saved.value === null) {
        return {
          ok: false,
          feedback: {
            severity: "heat",
            code: "database-write-failed",
            detail: "The browser checkpoint adapter returned no record after a successful save.",
          },
        };
      }
      return { ok: true, value: saved.value };
    },
    close: () => {
      const closed = checkpoints.close();
      return closed.ok ? { ok: true, value: null } : mapCheckpointFeedback(closed.feedback, "write");
    },
  };
}

/** Open the IndexedDB adapter and expose it only through the owned ZetaDB image port. */
export async function openBrowserZetaDbImagePort(
  root: unknown,
  options: NativeIndexedDbCheckpointOptions,
): Promise<ZetaDbResult<ZetaDbImagePort>> {
  const opened = await openNativeIndexedDbCheckpointPort(root, options);
  if (!opened.ok) {
    return {
      ok: false,
      feedback: {
        severity: opened.feedback.severity,
        code: "database-read-failed",
        detail: opened.feedback.detail,
      },
    };
  }
  return { ok: true, value: createBrowserZetaDbImagePort(opened.value) };
}

/** Open, run one finite tick, and close. No browser worker lifetime is part of database state. */
export async function runBrowserZetaDbWake(
  root: unknown,
  options: NativeIndexedDbCheckpointOptions,
  request: ZetaDbTickRequest,
  convergencePolicy: ZetaDbConvergencePolicy = DEFAULT_BROWSER_ZETA_DB_CONVERGENCE_POLICY,
  admissionPolicy: ZetaDbAdmissionPolicyPort = noForgetBackpressureAdmissionPolicy,
): Promise<ZetaDbResult<ZetaDbTickReadout>> {
  const opened = await openBrowserZetaDbImagePort(root, options);
  if (!opened.ok) return opened;
  const result = await runConvergentZetaDbNodeTick(opened.value, request, convergencePolicy, admissionPolicy);
  const closed = opened.value.close();
  if (result.ok && !closed.ok) return closed;
  return result;
}

/** Save one browser-backed image and preserve the checkpoint adapter's revision conflict. */
export async function saveBrowserZetaDbImage(
  root: unknown,
  options: NativeIndexedDbCheckpointOptions,
  record: ZetaDbImageRecord,
): Promise<ZetaDbResult<ZetaDbImageRecord>> {
  const opened = await openNativeIndexedDbCheckpointPort(root, options);
  if (!opened.ok) {
    return {
      ok: false,
      feedback: { severity: opened.feedback.severity, code: "database-write-failed", detail: opened.feedback.detail },
    };
  }
  const port = createBrowserZetaDbImagePort(opened.value);
  const saved = await port.save(record);
  const closed = opened.value.close();
  if (saved.ok && !closed.ok) return mapCheckpointFeedback(closed.feedback, "write");
  return saved;
}
