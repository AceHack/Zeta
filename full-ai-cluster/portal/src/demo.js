// full-ai-cluster/portal/src/demo.ts
//
// A seeded in-memory platform so the portal runs with no cluster (PORTAL_DEMO=1)
// — for design review and local UI work. Mirrors the starter Blueprint library
// and shows one of each archetype plus a Room mid-incident (the GMod OOM with a
// pending budget approval), so the needs-me board is non-empty in the demo.
import { InMemoryPlatform } from "./data-memory.js";
const DEMO_BLUEPRINTS = [
    { metadata: { name: "gmod", namespace: "zeta-platform" }, spec: { category: "game", image: "ghcr.io/ich777/steamcmd:gmod", stateful: true, defaultExpose: "lan", variables: [{ name: "MAP", default: "gm_construct" }, { name: "MAXPLAYERS", default: "16" }] } },
    { metadata: { name: "web", namespace: "zeta-platform" }, spec: { category: "web", image: "nginx:1.27-alpine", stateful: false, defaultExpose: "public" } },
    { metadata: { name: "postgres", namespace: "zeta-platform" }, spec: { category: "database", image: "postgres:16-alpine", stateful: true, defaultExpose: "cluster", variables: [{ name: "DB", default: "app" }] } },
    { metadata: { name: "worker", namespace: "zeta-platform" }, spec: { category: "app", image: "busybox:1.36", stateful: false, defaultExpose: "none" } },
];
const DEMO_DEPLOYABLES = [
    { metadata: { name: "friday-sandbox", namespace: "acme" }, spec: { blueprint: "gmod", expose: "lan", ai: { admin: "otto" } }, status: { phase: "CrashLoopBackOff", message: "OOMKilled at 6Gi", children: ["StatefulSet/friday-sandbox", "Service/friday-sandbox"] } },
    { metadata: { name: "landing", namespace: "acme" }, spec: { blueprint: "web", host: "demo.zeta.example.com", expose: "public", ai: { admin: "otto" } }, status: { phase: "Ready", children: ["Deployment/landing", "Service/landing", "HTTPRoute/landing"] } },
    { metadata: { name: "orders-db", namespace: "acme" }, spec: { blueprint: "postgres", ai: { admin: "vera" } }, status: { phase: "Ready", children: ["StatefulSet/orders-db", "Service/orders-db"] } },
    { metadata: { name: "nightly", namespace: "acme" }, spec: { blueprint: "worker", ai: { admin: "lior" } }, status: { phase: "Running", children: ["Deployment/nightly"] } },
];
const DEMO_ROOMS = [
    {
        resource: "acme/friday-sandbox",
        events: [
            { id: "evt-0", seq: 0, weight: 1, proposedBy: { id: "system", kind: "persona" }, body: { type: "state-change", phase: "Running" } },
            { id: "evt-1", seq: 1, weight: 1, proposedBy: { id: "system", kind: "persona" }, body: { type: "state-change", phase: "CrashLoopBackOff", detail: "OOMKilled at 6Gi" } },
            { id: "evt-2", seq: 2, weight: 1, proposedBy: { id: "otto", kind: "persona" }, body: { type: "message", text: "Crash: OOM at 6Gi. Needs 8Gi — that exceeds Acme's quota. Requesting approval." } },
            { id: "evt-3", seq: 3, weight: 1, proposedBy: { id: "otto", kind: "persona" }, body: { type: "authorization-request", gated: "budget", action: { domain: "scaling", summary: "bump memory 6→8Gi (exceeds quota)" } } },
        ],
    },
];
/** The seeded demo resources (blueprints + deployables), without any rooms. */
export function demoResources() {
    return { listDeployables: async () => DEMO_DEPLOYABLES, listBlueprints: async () => DEMO_BLUEPRINTS };
}
/** A full in-memory demo platform: seeded resources + a Room mid-incident. */
export function demoPlatform() {
    return new InMemoryPlatform(structuredClone(DEMO_DEPLOYABLES), structuredClone(DEMO_BLUEPRINTS), structuredClone(DEMO_ROOMS));
}
