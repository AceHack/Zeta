// full-ai-cluster/platform-controller/src/controller.ts
//
// The reconcile loop. Watches Deployable CRs, resolves the referenced Blueprint
// (tenant-namespace blueprint first, then the shared zeta-platform library),
// renders concrete Kubernetes objects with the generic engine, and server-side
// applies them. Pure resolution/render is split out (reconcile) so it is unit
// tested without a cluster; run() is the thin I/O wrapper.

import { type Blueprint, type Deployable, renderDeployable } from "./blueprint.ts";
import { GROUP, VERSION } from "./types.ts";
import { inClusterConfig, K8sClient, KIND_PLURAL } from "./k8s.ts";

export const LIBRARY_NAMESPACE = "zeta-platform";

/** Build the room-service append URL for a resource (ns/name → ns~name path seg). */
export function roomEventUrl(base: string, namespace: string, name: string): string {
  return `${base.replace(/\/$/, "")}/api/rooms/${namespace}~${name}/events`;
}

/**
 * Emit a state-change Event to the room-service (best-effort: a reconcile must
 * never fail because the portal is down). The persona that "operates" the
 * resource is the proposer of the lifecycle Event.
 */
async function emitState(cr: Deployable, phase: string, detail?: string): Promise<void> {
  const base = process.env.ROOM_SERVICE_URL;
  if (!base) return;
  const by = cr.spec.ai?.admin ?? "system";
  try {
    await fetch(roomEventUrl(base, cr.metadata.namespace, cr.metadata.name), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ by, kind: "persona", body: { type: "state-change", phase, ...(detail ? { detail } : {}) } }),
    });
  } catch {
    // room-service unreachable — the reconcile itself succeeded; skip the Event
  }
}

/** A Blueprint indexed by namespace/name, with the shared library as fallback. */
export type BlueprintIndex = Map<string, Blueprint>;
const key = (ns: string, name: string) => `${ns}/${name}`;

/** Build the index key map from a flat list of Blueprint CRs. */
export function indexBlueprints(items: Array<{ metadata: { name: string; namespace: string }; spec: Blueprint }>): BlueprintIndex {
  const idx: BlueprintIndex = new Map();
  for (const b of items) idx.set(key(b.metadata.namespace, b.metadata.name), { ...b.spec, name: b.metadata.name });
  return idx;
}

/** Resolve a Deployable's Blueprint: same-namespace first, then the library. */
export function resolveBlueprint(idx: BlueprintIndex, cr: Deployable): Blueprint | undefined {
  return idx.get(key(cr.metadata.namespace, cr.spec.blueprint)) ?? idx.get(key(LIBRARY_NAMESPACE, cr.spec.blueprint));
}

export type Reconciled = { ok: true; objects: ReturnType<typeof renderDeployable> } | { ok: false; reason: string };

/** Pure reconcile: resolve + render. No I/O — fully unit testable. */
export function reconcile(idx: BlueprintIndex, cr: Deployable): Reconciled {
  const bp = resolveBlueprint(idx, cr);
  if (!bp) return { ok: false, reason: `Blueprint "${cr.spec.blueprint}" not found in ${cr.metadata.namespace} or ${LIBRARY_NAMESPACE}` };
  try {
    return { ok: true, objects: renderDeployable(bp, cr) };
  } catch (e) {
    return { ok: false, reason: `render failed: ${(e as Error).message}` };
  }
}

// ── I/O wrapper ───────────────────────────────────────────────────────

async function applyAll(client: K8sClient, objs: ReturnType<typeof renderDeployable>): Promise<void> {
  for (const o of objs) {
    const plural = KIND_PLURAL[o.kind];
    if (!plural) throw new Error(`no REST plural mapping for kind ${o.kind}`);
    await client.apply(o, plural);
  }
}

async function reconcileOne(client: K8sClient, idx: BlueprintIndex, cr: Deployable): Promise<void> {
  const result = reconcile(idx, cr);
  const ns = cr.metadata.namespace;
  if (!result.ok) {
    console.error(`[deployable ${ns}/${cr.metadata.name}] ${result.reason}`);
    await client.patchStatus(GROUP, VERSION, "deployables", ns, cr.metadata.name, { phase: "Error", message: result.reason });
    await emitState(cr, "Error", result.reason);
    return;
  }
  await applyAll(client, result.objects);
  console.log(`[deployable ${ns}/${cr.metadata.name}] applied ${result.objects.length} object(s) from blueprint "${cr.spec.blueprint}"`);
  await client.patchStatus(GROUP, VERSION, "deployables", ns, cr.metadata.name, {
    phase: "Ready",
    blueprint: cr.spec.blueprint,
    children: result.objects.map((o) => `${o.kind}/${o.metadata.name}`),
  });
  await emitState(cr, "Ready", `applied ${result.objects.length} object(s) from blueprint "${cr.spec.blueprint}"`);
}

/** Run the controller: load blueprints, then watch Deployables and reconcile. */
export async function run(): Promise<void> {
  const client = new K8sClient(inClusterConfig());

  const loadBlueprints = async (): Promise<BlueprintIndex> => {
    const { items } = await client.list(GROUP, VERSION, "blueprints");
    return indexBlueprints(items as unknown as Array<{ metadata: { name: string; namespace: string }; spec: Blueprint }>);
  };

  let idx = await loadBlueprints();
  console.log(`loaded ${idx.size} blueprint(s)`);

  const { items, resourceVersion } = await client.list(GROUP, VERSION, "deployables");
  for (const cr of items) await reconcileOne(client, idx, cr as unknown as Deployable);

  console.log(`watching deployables from rv ${resourceVersion}`);
  for (;;) {
    try {
      const start = (await client.list(GROUP, VERSION, "deployables")).resourceVersion;
      for await (const ev of client.watch(GROUP, VERSION, "deployables", undefined, start)) {
        if (ev.type === "BOOKMARK") continue;
        if (ev.type === "DELETED") continue; // ownerReferences cascade-delete children
        idx = await loadBlueprints(); // refresh library each event (cheap; few blueprints)
        await reconcileOne(client, idx, ev.object as unknown as Deployable);
      }
    } catch (e) {
      console.error(`watch error, retrying in 3s: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

if (import.meta.main) {
  run().catch((e) => {
    console.error("controller fatal:", e);
    process.exit(1);
  });
}
