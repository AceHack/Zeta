// full-ai-cluster/platform-controller/src/controller.ts
//
// The reconcile loop. Watches Deployable CRs, resolves the referenced Blueprint
// (tenant-namespace blueprint first, then the shared zeta-platform library),
// renders concrete Kubernetes objects with the generic engine, and server-side
// applies them. Pure resolution/render is split out (reconcile) so it is unit
// tested without a cluster; run() is the thin I/O wrapper.
import { renderDeployable } from "./blueprint.js";
import { GROUP, VERSION } from "./types.js";
import { inClusterConfig, K8sClient, KIND_PLURAL } from "./k8s.js";
import { renderTenant, TENANT_KIND_PLURAL } from "./tenant.js";
export const LIBRARY_NAMESPACE = "zeta-platform";
/** Build the room-service append URL for a resource (ns/name → ns~name path seg). */
export function roomEventUrl(base, namespace, name) {
    return `${base.replace(/\/$/, "")}/api/rooms/${namespace}~${name}/events`;
}
/**
 * Emit a state-change Event to the room-service (best-effort: a reconcile must
 * never fail because the portal is down). The persona that "operates" the
 * resource is the proposer of the lifecycle Event.
 */
async function emitState(cr, phase, detail) {
    const base = process.env.ROOM_SERVICE_URL;
    if (!base)
        return;
    const by = cr.spec.ai?.admin ?? "system";
    try {
        await fetch(roomEventUrl(base, cr.metadata.namespace, cr.metadata.name), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ by, kind: "persona", body: { type: "state-change", phase, ...(detail ? { detail } : {}) } }),
        });
    }
    catch {
        // room-service unreachable — the reconcile itself succeeded; skip the Event
    }
}
const key = (ns, name) => `${ns}/${name}`;
/** Build the index key map from a flat list of Blueprint CRs. */
export function indexBlueprints(items) {
    const idx = new Map();
    for (const b of items)
        idx.set(key(b.metadata.namespace, b.metadata.name), { ...b.spec, name: b.metadata.name });
    return idx;
}
/** Resolve a Deployable's Blueprint: same-namespace first, then the library. */
export function resolveBlueprint(idx, cr) {
    return idx.get(key(cr.metadata.namespace, cr.spec.blueprint)) ?? idx.get(key(LIBRARY_NAMESPACE, cr.spec.blueprint));
}
/** Pure reconcile: resolve + render. No I/O — fully unit testable. */
export function reconcile(idx, cr) {
    const bp = resolveBlueprint(idx, cr);
    if (!bp)
        return { ok: false, reason: `Blueprint "${cr.spec.blueprint}" not found in ${cr.metadata.namespace} or ${LIBRARY_NAMESPACE}` };
    try {
        return { ok: true, objects: renderDeployable(bp, cr) };
    }
    catch (e) {
        return { ok: false, reason: `render failed: ${e.message}` };
    }
}
// ── I/O wrapper ───────────────────────────────────────────────────────
async function applyAll(client, objs) {
    for (const o of objs) {
        const plural = KIND_PLURAL[o.kind];
        if (!plural)
            throw new Error(`no REST plural mapping for kind ${o.kind}`);
        await client.apply(o, plural);
    }
}
async function reconcileOne(client, idx, cr) {
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
/** Reconcile one Tenant: render + server-side-apply its namespace/quota/isolation. */
async function reconcileTenant(client, cr) {
    const objs = renderTenant(cr);
    for (const o of objs) {
        const plural = TENANT_KIND_PLURAL[o.kind];
        if (!plural)
            throw new Error(`no REST plural for tenant child ${o.kind}`);
        await client.apply(o, plural);
    }
    console.log(`[tenant ${cr.metadata.name}] applied ${objs.length} object(s) → namespace ${cr.spec.namespace}`);
    await client.patchStatus(GROUP, VERSION, "tenants", "", cr.metadata.name, { phase: "Ready", namespace: cr.spec.namespace, children: objs.map((o) => `${o.kind}/${o.metadata.name}`) });
}
/** Run the controller: reconcile + watch BOTH Deployables and Tenants concurrently. */
export async function run() {
    const client = new K8sClient(inClusterConfig());
    const loadBlueprints = async () => {
        const { items } = await client.list(GROUP, VERSION, "blueprints");
        return indexBlueprints(items);
    };
    // ── Deployable reconcile + watch ───────────────────────────────────
    const runDeployables = async () => {
        let idx = await loadBlueprints();
        console.log(`loaded ${idx.size} blueprint(s)`);
        const { items } = await client.list(GROUP, VERSION, "deployables");
        for (const cr of items)
            await reconcileOne(client, idx, cr);
        console.log("watching deployables");
        for (;;) {
            try {
                const start = (await client.list(GROUP, VERSION, "deployables")).resourceVersion;
                for await (const ev of client.watch(GROUP, VERSION, "deployables", undefined, start)) {
                    if (ev.type === "BOOKMARK" || ev.type === "DELETED")
                        continue;
                    idx = await loadBlueprints();
                    await reconcileOne(client, idx, ev.object);
                }
            }
            catch (e) {
                console.error(`deployable watch error, retrying in 3s: ${e.message}`);
                await new Promise((r) => setTimeout(r, 3000));
            }
        }
    };
    // ── Tenant reconcile + watch (cluster-scoped) ──────────────────────
    const runTenants = async () => {
        const { items } = await client.list(GROUP, VERSION, "tenants");
        for (const cr of items)
            await reconcileTenant(client, cr).catch((e) => console.error(`[tenant ${cr.metadata.name}] ${e.message}`));
        console.log("watching tenants");
        for (;;) {
            try {
                const start = (await client.list(GROUP, VERSION, "tenants")).resourceVersion;
                for await (const ev of client.watch(GROUP, VERSION, "tenants", undefined, start)) {
                    if (ev.type === "BOOKMARK" || ev.type === "DELETED")
                        continue;
                    await reconcileTenant(client, ev.object);
                }
            }
            catch (e) {
                console.error(`tenant watch error, retrying in 3s: ${e.message}`);
                await new Promise((r) => setTimeout(r, 3000));
            }
        }
    };
    await Promise.all([runDeployables(), runTenants()]);
}
if (import.meta.main) {
    run().catch((e) => {
        console.error("controller fatal:", e);
        process.exit(1);
    });
}
