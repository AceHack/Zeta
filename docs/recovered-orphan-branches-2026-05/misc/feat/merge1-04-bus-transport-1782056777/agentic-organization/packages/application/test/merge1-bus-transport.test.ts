import { deepEqual, equal, ok } from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  ROOM_AGENT_IDS,
  ROOM_TOPIC_TTL_MS,
  SENDER_ROOM_AGENT_IDS,
  SIGNAL_TO_TOPIC,
  isRoomAgentId,
  isSenderRoomAgentId,
  topicForStrategy,
  type BusMessageEnvelope,
  type RoomTopic,
} from "../src/bus-types.ts";
import {
  createEphemeralBusTransport,
  createMockBusTransport,
  type TransportPort,
} from "../src/bus-transport.ts";
import {
  authenticatedReceiptMatchesEnvelope,
  receiptForEnvelope,
  validateReceiptKeyringPolicy,
  type BusEnvelopeKeyring,
  type BusEnvelopeSigningKey,
} from "../src/bus-envelope-receipt.ts";
import {
  addRelationEdge,
  processRelationCommand,
  relationEdgesFor,
  toTlaProjection,
  type RelationEdge,
} from "../src/bus-relation-protocol.ts";
import { computeActiveClaims, createClaimCoordinator } from "../src/bus-claim-coordinator.ts";

// A frozen clock far in the past so default TTLs keep messages live.
const T0 = Date.UTC(2026, 0, 1, 0, 0, 0);
const frozen = (ms: number) => () => ms;

function envelope(over: Partial<BusMessageEnvelope> = {}): BusMessageEnvelope {
  return {
    topic: "shadow-catch",
    payload: { content: "hello" },
    id: "msg-1",
    from: "otto",
    to: "vera",
    publishedAt: new Date(T0).toISOString(),
    ttlMs: ROOM_TOPIC_TTL_MS["shadow-catch"],
    ...over,
  } as BusMessageEnvelope;
}

// ─── bus-types: vocabulary + mappings ─────────────────────────────────────────

test("topicForStrategy maps every CommunicationStrategy", () => {
  equal(topicForStrategy("artifact"), "shadow-catch");
  equal(topicForStrategy("english"), "review-request");
  equal(topicForStrategy("chip8"), "heartbeat");
});

test("SIGNAL_TO_TOPIC values are all real topics and the map is total", () => {
  const values = Object.values(SIGNAL_TO_TOPIC);
  equal(values.length, 8);
  for (const topic of values) ok(topic in ROOM_TOPIC_TTL_MS, `${topic} must have a TTL`);
});

test("every RoomTopic has a TTL entry", () => {
  const topics: RoomTopic[] = [
    "heartbeat", "claim", "shadow-catch", "review-request", "infinite-backlog-nudge",
    "work-assignment", "missed-substrate-cascade", "formal-verification-result",
    "lounge-presence", "relation-offer", "relation-accept", "relation-edge",
  ];
  for (const t of topics) ok(ROOM_TOPIC_TTL_MS[t] > 0);
});

test("agent id guards: broadcast is an agent but not a sender", () => {
  ok(isRoomAgentId("*"));
  ok(!isSenderRoomAgentId("*"));
  ok(isSenderRoomAgentId("otto"));
  ok(!isRoomAgentId("nobody"));
  equal(ROOM_AGENT_IDS.length, SENDER_ROOM_AGENT_IDS.length + 1);
});

// ─── mock transport: round-trip, filtering, lifecycle, DST ────────────────────

test("mock transport: publish → read round-trip", async () => {
  const bus = createMockBusTransport({ now: frozen(T0) });
  const result = await bus.publish(envelope());
  equal(result.outcome, "published");
  const read = await bus.read("msg-1");
  ok(read.ok && read.value?.from === "otto");
});

test("mock transport: list filters by from/to/topic and honors broadcast", async () => {
  const bus = createMockBusTransport({ now: frozen(T0) });
  await bus.publish(envelope({ id: "a", from: "otto", to: "vera", topic: "shadow-catch" }));
  await bus.publish(envelope({ id: "b", from: "alexa", to: "*", topic: "heartbeat", payload: { status: "alive" } }));
  const toVera = await bus.list({ to: "vera" });
  ok(toVera.ok);
  // vera sees the direct message AND the broadcast.
  deepEqual(toVera.value.map((m) => m.id).sort(), ["a", "b"]);
  const heartbeats = await bus.list({ topic: "heartbeat" });
  ok(heartbeats.ok && heartbeats.value.length === 1 && heartbeats.value[0]!.id === "b");
});

test("mock transport: list excludes expired; clean prunes them", async () => {
  const bus = createMockBusTransport({ now: frozen(T0 + 10 * 60_000) }); // 10 min later
  await bus.publish(envelope({ id: "hb", topic: "heartbeat", payload: { status: "alive" }, ttlMs: ROOM_TOPIC_TTL_MS.heartbeat }));
  const listed = await bus.list({});
  ok(listed.ok && listed.value.length === 0); // heartbeat TTL is 5 min < 10 min
  const cleaned = await bus.clean();
  ok(cleaned.ok && cleaned.value === 1);
});

test("mock transport: watch fires synchronously on a matching publish", async () => {
  const bus = createMockBusTransport({ now: frozen(T0) });
  const seen: string[] = [];
  const handle = bus.watch({ topic: "shadow-catch" }, (m) => seen.push(m.id));
  await bus.publish(envelope({ id: "x", topic: "shadow-catch" }));
  await bus.publish(envelope({ id: "y", topic: "heartbeat", payload: { status: "idle" } }));
  handle.cancel();
  await bus.publish(envelope({ id: "z", topic: "shadow-catch" }));
  deepEqual(seen, ["x"]); // only matching topic, and nothing after cancel
});

test("mock transport: G-Set idempotent re-publish, collision on different content", async () => {
  const bus = createMockBusTransport({ now: frozen(T0) });
  ok((await bus.publish(envelope({ id: "dup" }))).outcome === "published");
  ok((await bus.publish(envelope({ id: "dup" }))).outcome === "published"); // idempotent
  const collision = await bus.publish(envelope({ id: "dup", payload: { content: "changed" } }));
  equal(collision.outcome, "feedback");
});

test("mock transport is deterministic (DST): same publishes → identical list", async () => {
  const mk = async (): Promise<readonly BusMessageEnvelope[]> => {
    const bus = createMockBusTransport({ now: frozen(T0) });
    await bus.publish(envelope({ id: "b", from: "alexa", to: "*", topic: "heartbeat", payload: { status: "alive" } }));
    await bus.publish(envelope({ id: "a", from: "otto", to: "vera" }));
    const r = await bus.list({});
    return r.ok ? r.value : [];
  };
  deepEqual(await mk(), await mk());
});

// ─── ephemeral (folder) transport ─────────────────────────────────────────────

test("ephemeral transport: publish → read round-trip via injected dir", async () => {
  const dir = mkdtempSync(join(tmpdir(), "zeta-bus-"));
  const bus = createEphemeralBusTransport({ dir, now: frozen(T0) });
  ok((await bus.publish(envelope({ id: "f1" }))).outcome === "published");
  const read = await bus.read("f1");
  ok(read.ok && read.value?.id === "f1");
  const listed = await bus.list({ topic: "shadow-catch" });
  ok(listed.ok && listed.value.length === 1);
});

test("ephemeral transport: path traversal in id is rejected", async () => {
  const dir = mkdtempSync(join(tmpdir(), "zeta-bus-"));
  const bus = createEphemeralBusTransport({ dir, now: frozen(T0) });
  const res = await bus.publish(envelope({ id: "../escape" }));
  equal(res.outcome, "feedback");
});

// ─── envelope receipts: integrity + HMAC authenticity ─────────────────────────

test("receipt: integrity verifies; tampering is detected", () => {
  const env = envelope();
  const receipt = receiptForEnvelope(env);
  ok(authenticatedReceiptMatchesEnvelope(receipt, env, {}));
  const tampered = envelope({ payload: { content: "evil" } });
  ok(!authenticatedReceiptMatchesEnvelope(receipt, tampered, {}));
});

test("receipt: HMAC verifies an authentic message", () => {
  const key: BusEnvelopeSigningKey = { keyId: "k1", secret: "super-secret" };
  const keyring: BusEnvelopeKeyring = { otto: [key] };
  const env = envelope();
  const receipt = receiptForEnvelope(env, key);
  ok(receipt.senderHmacSha256?.startsWith("hmac-sha256:"));
  ok(authenticatedReceiptMatchesEnvelope(receipt, env, keyring));
});

test("receipt: forged HMAC / unknown key / wrong sender all fail", () => {
  const key: BusEnvelopeSigningKey = { keyId: "k1", secret: "super-secret" };
  const env = envelope();
  const receipt = receiptForEnvelope(env, key);
  // unknown key in keyring
  ok(!authenticatedReceiptMatchesEnvelope(receipt, env, { otto: [{ keyId: "other", secret: "x" }] }));
  // right keyId but wrong secret → bad hmac
  ok(!authenticatedReceiptMatchesEnvelope(receipt, env, { otto: [{ keyId: "k1", secret: "wrong" }] }));
  // sender not in keyring at all
  ok(!authenticatedReceiptMatchesEnvelope(receipt, env, {}));
});

test("receipt: key validity window is enforced", () => {
  const key: BusEnvelopeSigningKey = {
    keyId: "k1",
    secret: "s",
    notBeforeIso: new Date(T0 + 60_000).toISOString(), // not yet valid at T0
  };
  equal(validateReceiptKeyringPolicy(key, new Date(T0).toISOString()), false);
  equal(validateReceiptKeyringPolicy(key, new Date(T0 + 120_000).toISOString()), true);
  const env = envelope(); // publishedAt = T0 → before notBefore
  const receipt = receiptForEnvelope(env, key);
  ok(!authenticatedReceiptMatchesEnvelope(receipt, env, { otto: [key] }));
});

// ─── relation protocol: offer → accept → edge ─────────────────────────────────

test("relation: offer emits no edge, accept completes the handshake", () => {
  const offer = processRelationCommand("otto", { to: "vera", message: { topic: "relation-offer", payload: { relationId: "r1", basis: "offer-accept" } } }, []);
  ok(offer.ok && offer.value === undefined);
  // vera accepts otto's offer r1
  const accept = processRelationCommand("vera", { to: "otto", message: { topic: "relation-accept", payload: { relationId: "r1" } } }, []);
  ok(accept.ok && accept.value !== undefined);
  equal(accept.value!.from, "otto"); // offerer
  equal(accept.value!.to, "vera"); // acceptor
  equal(accept.value!.acceptedBy, "vera");
});

test("relation: addRelationEdge is idempotent and surfaces conflicts", () => {
  const edge: RelationEdge = { relationId: "r1", from: "otto", to: "vera", basis: "offer-accept", acceptedBy: "vera" };
  const g1 = addRelationEdge([], edge);
  ok(g1.ok && g1.value.length === 1);
  const g2 = addRelationEdge(g1.value, edge); // same → idempotent
  ok(g2.ok && g2.value.length === 1);
  const conflict = addRelationEdge(g1.value, { ...edge, to: "lior", acceptedBy: "lior" });
  ok(!conflict.ok && conflict.error.kind === "edge_conflict");
});

test("relation: edges are bidirectional; tla projection normalizes endpoints", () => {
  const edge: RelationEdge = { relationId: "r1", from: "vera", to: "otto", basis: "offer-accept", acceptedBy: "otto" };
  const incidentToOtto = relationEdgesFor([edge], "otto");
  equal(incidentToOtto.length, 1);
  const proj = toTlaProjection(edge);
  deepEqual(proj.endpoints, ["otto", "vera"]); // order-normalized
  equal(proj.accepted, true);
});

test("relation: a non-relation topic is feedback", () => {
  const res = processRelationCommand("otto", { to: "vera", message: { topic: "heartbeat", payload: { status: "alive" } } }, []);
  ok(!res.ok && res.error.kind === "not_a_relation_topic");
});

// ─── claim coordinator: no split-brain ────────────────────────────────────────

function counterMint(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${n++}`;
}

test("claim: check unclaimed → acquire → check claimed", async () => {
  const transport = createMockBusTransport({ now: frozen(T0) });
  const otto = createClaimCoordinator({ self: "otto", transport, mint: counterMint("otto"), now: frozen(T0) });
  equal((await otto.check("item-1")).outcome, "unclaimed");
  const acq = await otto.acquire("item-1", "feat/x");
  equal(acq.outcome, "acquired");
  const status = await otto.check("item-1");
  ok(status.outcome === "claimed" && status.by === "otto");
});

test("claim: two rooms cannot acquire the same item (no split-brain)", async () => {
  const transport = createMockBusTransport({ now: frozen(T0) });
  const otto = createClaimCoordinator({ self: "otto", transport, mint: counterMint("otto"), now: frozen(T0) });
  const vera = createClaimCoordinator({ self: "vera", transport, mint: counterMint("vera"), now: frozen(T0) });
  equal((await otto.acquire("item-1", "feat/x")).outcome, "acquired");
  equal((await vera.acquire("item-1", "feat/y")).outcome, "feedback");
});

test("claim: release frees the item for another room", async () => {
  const transport = createMockBusTransport({ now: frozen(T0) });
  const otto = createClaimCoordinator({ self: "otto", transport, mint: counterMint("otto"), now: () => T0 });
  const vera = createClaimCoordinator({ self: "vera", transport, mint: counterMint("vera"), now: () => T0 + 1000 });
  await otto.acquire("item-1");
  equal((await otto.release("item-1")).outcome, "released");
  equal((await vera.acquire("item-1")).outcome, "acquired"); // release tombstone is newer
});

test("computeActiveClaims: latest action per sender wins; release cancels", () => {
  const mk = (id: string, action: "claim" | "release", at: number): BusMessageEnvelope => ({
    topic: "claim",
    payload: { action, itemId: "i" },
    id,
    from: "otto",
    to: "*",
    publishedAt: new Date(at).toISOString(),
    ttlMs: ROOM_TOPIC_TTL_MS.claim,
  });
  // claim then release → no active claim
  deepEqual(computeActiveClaims([mk("1", "claim", T0), mk("2", "release", T0 + 1000)], "i"), []);
  // release then re-claim → active
  const active = computeActiveClaims([mk("1", "release", T0), mk("2", "claim", T0 + 1000)], "i");
  equal(active.length, 1);
  equal(active[0]!.from, "otto");
});

// ─── transport is a valid Room seam binding ───────────────────────────────────

test("a TransportPort satisfies the room transport seam", () => {
  const transport: TransportPort = createMockBusTransport();
  ok(typeof transport.publish === "function");
  ok(typeof transport.watch === "function");
});
