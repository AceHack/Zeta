// full-ai-cluster/platform-controller/src/controller.test.ts
//
// Tests the pure reconcile core: Blueprint indexing, namespace-then-library
// resolution, render success, and the missing-blueprint error path.
import { describe, expect, test } from "bun:test";
import { API_VERSION } from "./types.js";
import { indexBlueprints, LIBRARY_NAMESPACE, reconcile, resolveBlueprint, roomEventUrl } from "./controller.js";
function bpItem(name, namespace, spec) {
    return { metadata: { name, namespace }, spec: { name, image: "img", ...spec } };
}
function dep(name, namespace, spec) {
    return { apiVersion: API_VERSION, kind: "Deployable", metadata: { name, namespace, uid: `u-${name}` }, spec };
}
describe("blueprint resolution", () => {
    const idx = indexBlueprints([
        bpItem("web", LIBRARY_NAMESPACE, { image: "nginx", ports: [{ name: "http", port: 8080, web: true }], defaultExpose: "public" }),
        bpItem("web", "tenant-a", { image: "tenant-custom-nginx", ports: [{ name: "http", port: 8080, web: true }] }), // tenant override
    ]);
    test("same-namespace blueprint shadows the library", () => {
        const bp = resolveBlueprint(idx, dep("site", "tenant-a", { blueprint: "web" }));
        expect(bp?.image).toBe("tenant-custom-nginx");
    });
    test("falls back to the shared library when tenant has none", () => {
        const bp = resolveBlueprint(idx, dep("site", "tenant-b", { blueprint: "web" }));
        expect(bp?.image).toBe("nginx");
    });
    test("returns undefined for an unknown blueprint", () => {
        expect(resolveBlueprint(idx, dep("x", "tenant-b", { blueprint: "does-not-exist" }))).toBeUndefined();
    });
});
describe("reconcile", () => {
    const idx = indexBlueprints([
        bpItem("gmod", LIBRARY_NAMESPACE, {
            stateful: true,
            image: "gmod",
            ports: [{ name: "game", port: 27015, protocol: "UDP" }],
            storage: { size: "20Gi", mountPath: "/data" },
            defaultExpose: "lan",
        }),
    ]);
    test("renders objects for a valid Deployable", () => {
        const r = reconcile(idx, dep("clan", "tenant-a", { blueprint: "gmod" }));
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.objects.some((o) => o.kind === "StatefulSet")).toBe(true);
            expect(r.objects.some((o) => o.kind === "Service")).toBe(true);
        }
    });
    test("errors with a clear reason for a missing blueprint", () => {
        const r = reconcile(idx, dep("oops", "tenant-a", { blueprint: "nope" }));
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.reason).toContain("nope");
            expect(r.reason).toContain(LIBRARY_NAMESPACE);
        }
    });
});
describe("roomEventUrl", () => {
    test("builds the room-service append URL, encoding ns/name as ns~name", () => {
        expect(roomEventUrl("http://portal.svc", "acme", "clan")).toBe("http://portal.svc/api/rooms/acme~clan/events");
    });
    test("tolerates a trailing slash on the base", () => {
        expect(roomEventUrl("http://portal.svc/", "acme", "clan")).toBe("http://portal.svc/api/rooms/acme~clan/events");
    });
});
