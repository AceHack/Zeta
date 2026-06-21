// full-ai-cluster/portal/src/room-agent.test.ts
//
// The sandboxed Room agent: intent classification + the no-directives gating,
// and (via the BFF) the full chat loop — human message → persona reply → an
// auto action OR an authorization-request. Sandbox: the agent only ever names
// the resource it was given.
import { beforeEach, describe, expect, test } from "bun:test";
import { DEFAULT_POLICY, decide, respond } from "./room-agent.js";
import { encodeResource, handle } from "./api.js";
import { InMemoryPlatform } from "./data-memory.js";
const game = { game: true, memory: "6Gi", replicas: 1, phase: "CrashLoopBackOff" };
const r = "acme/friday-sandbox";
describe("respond — intent + sandbox", () => {
    test("restart → an auto lifecycle op", () => {
        const res = respond(r, "please restart it", game);
        expect(res.op?.kind).toBe("restart");
        expect(decide(DEFAULT_POLICY, res.op.action).level).toBe("auto");
    });
    test("scale to N → an auto scaling op with the parsed count", () => {
        const res = respond(r, "scale to 4", game);
        expect(res.op).toMatchObject({ kind: "scale", replicas: 4 });
        expect(decide(DEFAULT_POLICY, res.op.action).level).toBe("auto");
    });
    test("more memory / fix the crash → a budget-gated config op (propose)", () => {
        const res = respond(r, "it keeps crashing, give it more memory", game);
        expect(res.op?.kind).toBe("config");
        expect(res.op.patch.memory).toBe("8Gi");
        expect(decide(DEFAULT_POLICY, res.op.action).level).toBe("propose");
    });
    test("change map → a mods op (propose)", () => {
        const res = respond(r, "change the map to gm_construct", game);
        expect(res.op.patch.values).toEqual({ MAP: "gm_construct" });
        expect(decide(DEFAULT_POLICY, res.op.action).level).toBe("propose");
    });
    test("delete → refused in words, NO op (data is human-only)", () => {
        const res = respond(r, "delete this server and wipe the data", game);
        expect(res.op).toBeUndefined();
        expect(res.reply).toMatch(/human-only|Danger zone/);
    });
    test("status → a read-only reply, no op", () => {
        const res = respond(r, "how is it doing?", game);
        expect(res.op).toBeUndefined();
        expect(res.reply).toContain("friday-sandbox");
    });
    test("analyze logs → reasons over the connected logs/traces, no op", () => {
        const res = respond(r, "why does it keep crashing? analyze the logs", { ...game, recentErrors: ["OOM: srcds exceeded 6Gi memory limit, container killed"] });
        expect(res.op).toBeUndefined();
        expect(res.reply).toMatch(/OOM|memory ceiling|6Gi/);
        expect(res.reply).toMatch(/more memory/); // suggests the gated fix
    });
    test("analyze logs with clean telemetry → reports healthy", () => {
        const res = respond("acme/orders-db", "check the logs and traces for errors", { ...game, game: false, recentErrors: [], slowTraces: [] });
        expect(res.reply).toMatch(/nothing abnormal|healthy/);
    });
    test("the reply only ever names the given resource (sandbox)", () => {
        const res = respond("acme/orders-db", "restart it", { ...game, game: false });
        expect(res.reply).toContain("orders-db");
        expect(res.reply).not.toContain("friday-sandbox");
    });
});
describe("chat BFF loop", () => {
    let data;
    const blueprints = [{ metadata: { name: "gmod", namespace: "zeta-platform" }, spec: { category: "game", image: "gmod" } }];
    const deployables = [{ metadata: { name: "friday-sandbox", namespace: "acme" }, spec: { blueprint: "gmod", ai: { admin: "otto" } }, status: { phase: "CrashLoopBackOff" } }];
    const rooms = [{ resource: r, events: [] }];
    beforeEach(() => {
        data = new InMemoryPlatform(structuredClone(deployables), structuredClone(blueprints), structuredClone(rooms));
    });
    const chat = (text) => handle(new Request(`http://x/api/rooms/${encodeResource("acme", "friday-sandbox")}/chat`, { method: "POST", body: JSON.stringify({ text, by: "you" }) }), data);
    const body = async (resp) => (resp ? resp.json() : null);
    test("an auto request: human msg + persona reply + an action event", async () => {
        const j = await body(await chat("restart the server"));
        const types = j.room.events.map((e) => e.body.type);
        expect(types).toContain("message"); // human + persona messages
        expect(types).toContain("action"); // the restart was performed
        // the persona (otto) spoke
        expect(j.room.events.some((e) => e.proposedBy.id === "otto" && e.body.type === "message")).toBe(true);
    });
    test("a gated request: human msg + persona reply + an authorization-request (no action)", async () => {
        const j = await body(await chat("please give it more memory, it's OOMing"));
        const types = j.room.events.map((e) => e.body.type);
        expect(types).toContain("authorization-request");
        expect(types).not.toContain("action"); // nothing ran without a human grant
        expect(j.room.pending.length).toBe(1);
    });
    test("missing text → 400", async () => {
        const resp = await handle(new Request(`http://x/api/rooms/${encodeResource("acme", "friday-sandbox")}/chat`, { method: "POST", body: JSON.stringify({ by: "you" }) }), data);
        expect(resp.status).toBe(400);
    });
});
