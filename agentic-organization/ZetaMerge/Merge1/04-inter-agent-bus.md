# Merge1 §04 — Inter-Agent Bus → Agentic-Org Migration

**Scope:** Port the inter-agent communication bus from `tools/bus/` into the agentic-organization TypeScript codebase, making it the room's `TransportPort` implementation. The bus becomes the room's message transport, relation protocol becomes room federation, and HMAC envelope receipts become room message authentication.

**Outside sources:**

- `tools/bus/types.ts` — `AgentId` (16 identities), `Topic` (11 topics), `BusMessage` (12 message types), `MessageEnvelope`
- `tools/bus/bus.ts` — `publish()`, `list()`, `readMessage()`, `clean()`, `watch()`, ephemeral `/tmp` transport
- `tools/bus/envelope-receipt.ts` — `BusEnvelopeReceipt`, HMAC-SHA256 signing, key rotation, timing-safe comparison
- `tools/bus/relation-protocol.ts` — `RelationProtocolCommand`, offer→accept→edge handshake
- `tools/bus/relation-graph.ts` — `RelationEdge`, `RelationEdgeTlaProjection`, bidirectional edges
- `tools/bus/relation-publication.ts` — batch publishing, recovery, authenticated projection
- `tools/bus/claim.ts` — work item claim/release coordination
- `tools/bus/g-set-view.ts` — G-Set view for dedup

**Agentic-org files touched:**

- `packages/application/src/room.ts` — Room with `TransportPort` seam, `CommunicationStrategy`
- `packages/application/src/rmo.ts` — RMO with `planTaskRooms`
- `packages/application/src/ports.ts` — transport port definitions
- `packages/domain/src/supervisor-communication.ts` — supervisor signal types
- `packages/domain/src/hat-communication-brief.ts` — hat communication brief
- NEW: `packages/application/src/bus-transport.ts`
- NEW: `packages/application/src/bus-envelope-receipt.ts`
- NEW: `packages/application/src/bus-relation-protocol.ts`
- NEW: `packages/application/src/bus-claim-coordinator.ts`

**Governing doctrine:** §10 (MP-2 Seam Injectability, MP-3 ZetaId Addressability, MP-4 Retraction-Native, MP-6 Asymmetric Authorship, MP-7 Result Over Exception)

---

## 1. What's Solved Outside

| Type/Function | File:Line | What it does |
|---|---|---|
| `AgentId` | `types.ts:32` | 16-variant DU: otto/alexa/riven/vera/lior/aaron/addison/max/soraya + surface variants + `*` broadcast |
| `SenderAgentId` | `types.ts:69` | `Exclude<AgentId, "*">` — valid sender identities |
| `Topic` | `types.ts:71` | 11 topics: heartbeat, claim, shadow-catch, review-request, infinite-backlog-nudge, work-assignment, missed-substrate-cascade, lounge-presence, relation-offer, relation-accept, relation-edge, formal-verification-result |
| `BusMessage` | `types.ts:196` | 12-variant discriminated union keyed by `topic` |
| `MessageEnvelope` | `types.ts` | `{ id, from, to, topic, payload, publishedAt, ttlMs }` |
| `publish()` | `bus.ts` | Write message to `/tmp/zeta-bus/` JSON file |
| `list()` | `bus.ts` | List messages matching filter |
| `readMessage()` | `bus.ts` | Read single message by ID |
| `clean()` | `bus.ts` | Prune expired messages |
| `watch()` | `bus.ts` | Watch for new messages (polling) |
| `BusEnvelopeReceipt` | `envelope-receipt.ts:4` | `{ envelopeId, from, to, topic, payloadSha256, senderKeyId?, senderHmacSha256? }` |
| `BusEnvelopeReceiptSigningKey` | `envelope-receipt.ts:14` | `{ keyId, secret, notBeforeIso?, notAfterIso? }` |
| `BusEnvelopeReceiptKeyring` | `envelope-receipt.ts:21` | `Partial<Record<SenderAgentId, readonly SigningKey[]>>` |
| `receiptForEnvelope()` | `envelope-receipt.ts:29` | Build receipt + optional HMAC signature |
| `authenticatedReceiptMatchesEnvelope()` | `envelope-receipt.ts:61` | Verify receipt with HMAC + timing-safe comparison |
| `validateReceiptKeyringPolicy()` | `envelope-receipt.ts:75` | Check key validity window |
| `RelationProtocolCommand` | `relation-protocol.ts:4` | `{ to: AgentId, message: BusMessage }` |
| `RelationEdge` | `relation-graph.ts` | `{ from, to, relationId, basis, acceptedBy }` — bidirectional durable edge |
| `RelationEdgeTlaProjection` | `relation-graph.ts` | TLA+ projection for formal verification |
| `ClaimPayload` | `types.ts:95` | `{ action: "claim"\|"release", itemId, branch?, worktree? }` |
| `claim check/acquire/release` | `claim.ts` | CLI commands for work-item claim coordination with file locks + stale-lock recovery |

---

## 2. What Exists in Agentic-Org Today

| TS Type | File:Line | What it does | Gap vs bus |
|---|---|---|---|
| `CommunicationStrategy` | `room.ts:32` | `"artifact" \| "english" \| "chip8"` | No mapping to bus message types |
| `RoomSeamName` | `room.ts:35` | Includes `"transport"` seam | No TransportPort interface defined |
| `Room.seams` | `room.ts:118` | `readonly RoomSeamBinding[]` | Transport binding exists but no implementation |
| `SupervisorChainLevel` | `supervisor-communication.ts:1` | 5-level supervisor hierarchy | No bus topic equivalent |
| `SupervisorSignalToolType` | `supervisor-communication.ts:15` | 8 signal types (ask_question, report_blocker, etc.) | Maps to bus topics but not typed as such |
| `SupervisorSignalStatus` | `supervisor-communication.ts:35` | 5 statuses (sent, acknowledged, triaged, routed, closed) | No bus message lifecycle equivalent |
| `SupervisorTriageActionType` | `supervisor-communication.ts:45` | 6 triage actions | No bus routing equivalent |

---

## 3. Migration Plan

### 3.1 TransportPort interface

**Create:** `packages/application/src/bus-transport.ts`

The bus becomes the room's `TransportPort` implementation. The port interface is seam-injectable (real bus vs mock bus).

```typescript
// packages/application/src/bus-transport.ts

/** The room's message transport seam. Real = /tmp bus or NATS;
 * mock = in-memory ring buffer. Same interface, DST-safe.
 * MP-7: all operations return Result — never throw. */
export type TransportError =
  | { readonly kind: "publish_failed"; readonly reason: string }
  | { readonly kind: "list_failed"; readonly reason: string }
  | { readonly kind: "read_failed"; readonly reason: string }
  | { readonly kind: "clean_failed"; readonly reason: string };

export interface TransportPort {
  publish(message: BusMessageEnvelope): Promise<PublishResult>;
  list(filter: MessageFilter): Promise<Result<readonly BusMessageEnvelope[], TransportError>>;
  read(messageId: string): Promise<Result<BusMessageEnvelope | undefined, TransportError>>;
  clean(): Promise<Result<number, TransportError>>;
  watch(filter: MessageFilter, callback: (message: BusMessageEnvelope) => void): WatchHandle;
}

export type PublishResult =
  | { outcome: "published"; messageId: string }
  | { outcome: "feedback"; reason: string };

export type MessageFilter = {
  from?: AgentId;
  to?: AgentId;
  topic?: Topic;
  since?: string;
};

export type WatchHandle = {
  cancel(): void;
};

/** The full envelope — port of tools/bus/types.ts MessageEnvelope. */
export type BusMessageEnvelope = {
  id: string;              // ZetaId
  from: SenderAgentId;
  to: AgentId;             // includes "*" for broadcast
  topic: Topic;
  payload: BusMessage;
  publishedAt: string;     // ISO-8601
  ttlMs: number;
};
```

**Composes with Room:** Room's `transport` seam binds either:

- `createEphemeralBusTransport()` — `/tmp/zeta-bus/` JSON files (port of `tools/bus/bus.ts`)
- `createNatsTransport()` — NATS pub/sub (production)
- `createMockBusTransport()` — in-memory ring buffer (DST)

```typescript
// room.ts — AFTER upgrade
// The transport seam is selected by the adapter field:
//   "ephemeral-bus" → createEphemeralBusTransport()  (dev: /tmp/zeta-bus/ JSON files)
//   "nats"          → createNatsTransport()           (prod: NATS pub/sub)
//   "mock-bus"      → createMockBusTransport()         (DST: in-memory ring buffer)
export function createRealRoom(input: CreateRealRoomInput): Room {
  const transport = input.transportAdapter === "nats"
    ? createNatsTransport(input.natsUrl)
    : input.transportAdapter === "mock-bus"
    ? createMockBusTransport()
    : createEphemeralBusTransport();  // default: ephemeral-bus
  return {
    ...createDeterministicRoom(input),
    seamMode: "real",
    seams: [
      { seam: "transport", mode: "real", adapter: input.transportAdapter ?? "ephemeral-bus" },
      // ... other real seams
    ],
    transport,
  };
}
```

### 3.2 Bus message types port

**Create:** `packages/application/src/bus-types.ts`

Port the full `AgentId`, `Topic`, `BusMessage` discriminated union. The 16 agent identities become room agent personas; the 11 topics become room message types.

> **Cross-reference:** The 8 unsuffixed names (otto/alexa/riven/vera/lior/aaron/addison/max) are the core `AgentPersona` registry defined in §03. The suffixed variants (otto-cli, otto-desktop, etc.) are surface-specific sender IDs. See §03 §3.1 for the persona registry scope clarification.

```typescript
// packages/application/src/bus-types.ts

/** Room agent identity — port of tools/bus/types.ts AgentId.
 * The unsuffixed name is the identity; surface variants are distinct
 * sender IDs for the same identity on different surfaces.
 * The 8 unsuffixed names = AgentPersona from §03. */
export type RoomAgentId =
  | "otto" | "alexa" | "riven" | "vera" | "lior"
  | "aaron" | "addison" | "max" | "soraya"
  | "otto-cli" | "otto-desktop" | "otto-vscode" | "otto-windows"
  | "alexa-cli" | "alexa-kiro"
  | "riven-cli" | "riven-cursor"
  | "lior-antigravity" | "lior-gemini"
  | "vera-codex"
  | "*";  // broadcast

export type SenderRoomAgentId = Exclude<RoomAgentId, "*">;

/** Room message topic — port of tools/bus/types.ts Topic. */
export type RoomTopic =
  | "heartbeat" | "claim" | "shadow-catch" | "review-request"
  | "infinite-backlog-nudge" | "work-assignment" | "missed-substrate-cascade"
  | "lounge-presence" | "relation-offer" | "relation-accept" | "relation-edge"
  | "formal-verification-result";

/** CommunicationStrategy → RoomTopic mapping. */
export function topicForStrategy(strategy: CommunicationStrategy): RoomTopic {
  switch (strategy) {
    case "artifact": return "shadow-catch";      // structured artifact exchange
    case "english": return "review-request";      // plain-language review
    case "chip8": return "heartbeat";             // rehearsal-arena liveness
  }
}
```

### 3.3 Envelope receipt / HMAC authentication

**Create:** `packages/application/src/bus-envelope-receipt.ts`

Port the HMAC-SHA256 envelope receipt system for room message authentication.

```typescript
// packages/application/src/bus-envelope-receipt.ts

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Receipt proving a bus message's integrity and (optionally) authenticity.
 * Port of tools/bus/envelope-receipt.ts BusEnvelopeReceipt. */
export type BusEnvelopeReceipt = {
  readonly envelopeId: string;
  readonly from: SenderRoomAgentId;
  readonly to: RoomAgentId;
  readonly topic: RoomTopic;
  readonly payloadSha256: `sha256:${string}`;
  readonly senderKeyId?: string;
  readonly senderHmacSha256?: `hmac-sha256:${string}`;
};

export type BusEnvelopeSigningKey = {
  readonly keyId: string;
  readonly secret: string | Uint8Array;
  readonly notBeforeIso?: string;
  readonly notAfterIso?: string;
};

export type BusEnvelopeKeyring = Partial<
  Record<SenderRoomAgentId, readonly BusEnvelopeSigningKey[]>
>;

export function receiptForEnvelope(
  envelope: BusMessageEnvelope,
  signingKey?: BusEnvelopeSigningKey,
): BusEnvelopeReceipt {
  // Full implementation ported from tools/bus/envelope-receipt.ts:29
}

export function authenticatedReceiptMatchesEnvelope(
  receipt: BusEnvelopeReceipt,
  envelope: BusMessageEnvelope,
  keyring: BusEnvelopeKeyring,
): boolean {
  // Full implementation ported from tools/bus/envelope-receipt.ts:61
  // Uses crypto.timingSafeEqual for constant-time comparison
}
```

**Composes with Room:** Every cross-room message carries a receipt. The receiving room verifies the receipt against its keyring before processing. This is the room's message authentication layer — the agent never names a tool, and the sender never forges an identity.

### 3.4 Relation protocol → room federation

**Create:** `packages/application/src/bus-relation-protocol.ts`

Port the offer→accept→edge handshake as room federation discovery.

```typescript
// packages/application/src/bus-relation-protocol.ts

/** Room federation handshake — port of tools/bus/relation-protocol.ts.
 * Two rooms establish a durable relation via:
 *   1. relation-offer: room A proposes a relation to room B
 *   2. relation-accept: room B accepts the offer
 *   3. relation-edge: durable edge certificate emitted
 * The edge is bidirectional and append-only (retraction-native). */
export type RelationEdge = {
  readonly relationId: string;
  readonly from: SenderRoomAgentId;
  readonly to: SenderRoomAgentId;
  readonly basis: "offer-accept";
  readonly acceptedBy: SenderRoomAgentId;
  readonly batchId?: string;
};

export type RelationProtocolCommand = {
  readonly to: RoomAgentId;
  readonly message: BusMessage;
};

/** Process a relation protocol command. Returns the resulting edge
 * (if the handshake completes) or feedback (if it doesn't). */
export function processRelationCommand(
  command: RelationProtocolCommand,
  existingEdges: readonly RelationEdge[],
): Result<RelationEdge | undefined, RelationProtocolFeedback>;
```

**Composes with Room:** Rooms discover each other via the relation protocol. A room federation is a graph of `RelationEdge`s. This is how rooms form the "harmonious division" — aperiodic proximity, not total order (cf. `docs/research/2026-06-01-harmonious-division-...`).

### 3.5 Claim coordinator → room work-item coordination

**Create:** `packages/application/src/bus-claim-coordinator.ts`

Port the claim/release work-item coordination as room-level work assignment.

```typescript
// packages/application/src/bus-claim-coordinator.ts

/** Room work-item claim coordination — port of tools/bus/claim.ts.
 * Rooms coordinate ownership of work items without split-brain.
 * File-lock-based for the ephemeral bus; CAS-based for NATS. */
export interface ClaimCoordinator {
  check(itemId: string): Promise<ClaimStatus>;
  acquire(itemId: string, branch?: string): Promise<ClaimResult>;
  release(itemId: string): Promise<ClaimResult>;
}

export type ClaimStatus =
  | { outcome: "unclaimed" }
  | { outcome: "claimed"; by: SenderRoomAgentId; worktree?: string };

export type ClaimResult =
  | { outcome: "acquired"; itemId: string }
  | { outcome: "released"; itemId: string }
  | { outcome: "feedback"; reason: string };
```

**Composes with Room:** When a room picks up a work item, it acquires a claim via the coordinator. Other rooms see the claim and back off. This prevents split-brain work across room federation.

### 3.6 CommunicationStrategy → bus topic mapping

The existing `CommunicationStrategy` in `room.ts` maps to bus topics:

| Strategy | Bus Topic | Meaning |
|---|---|---|
| `"artifact"` | `shadow-catch` | Structured artifact exchange (JSON, code, etc.) |
| `"english"` | `review-request` | Plain-language review request |
| `"chip8"` | `heartbeat` | Rehearsal-arena liveness signal (chip-8 emulator voice) |

This mapping is implemented in `topicForStrategy()` above.

---

## 4. Upgrade Path

### 4.1 `ports.ts` — EXTEND

**Before:** No transport port defined.

**After:** Add `TransportPort` interface and `BusMessageEnvelope` type. Existing ports unchanged.

### 4.2 `room.ts` — EXTEND

**Before:** Room has `seams` with a `"transport"` entry but no transport field.

**After:** Room gains `transport?: TransportPort` field. When present, cross-room messages route through it. The `CommunicationStrategy` maps to bus topics via `topicForStrategy()`.

### 4.3 `supervisor-communication.ts` — EXTEND

**Before:** `SupervisorSignalToolType` has 8 signal types with no bus mapping.

**After:** Add mapping from `SupervisorSignalToolType` to `RoomTopic`:

```typescript
export const SIGNAL_TO_TOPIC: Readonly<Record<SupervisorSignalToolType, RoomTopic>> = {
  ask_question: "shadow-catch",
  report_blocker: "missed-substrate-cascade",
  request_decision: "review-request",
  request_resource: "work-assignment",
  request_review: "review-request",
  report_risk: "missed-substrate-cascade",
  suggest_improvement: "shadow-catch",
  request_escalation: "infinite-backlog-nudge",
};
```

---

## 5. Dependencies

- **Depends on:** §10 (doctrine), §01 (F# core — ZetaId for message IDs)
- **Blocks:** §03 (agent-loop uses bus for free-time scheduler), §07 (hat-system uses bus for tick emission)

---

## 6. Testing Strategy

### 6.1 Bus publish/read round-trip

```typescript
Deno.test("Bus publish → read round-trip", async () => {
  const bus = createMockBusTransport();
  const result = await bus.publish({
    id: "test-1", from: "otto", to: "vera", topic: "shadow-catch",
    payload: { topic: "shadow-catch", payload: { content: "hello" } },
    publishedAt: new Date().toISOString(), ttlMs: 60000,
  });
  assertEquals(result.outcome, "published");
  const msg = await bus.read("test-1");
  assertEquals(msg?.from, "otto");
});
```

### 6.2 HMAC receipt verification

```typescript
Deno.test("HMAC receipt verifies authentic message", () => {
  const key: BusEnvelopeSigningKey = { keyId: "k1", secret: "super-secret" };
  const keyring: BusEnvelopeKeyring = { otto: [key] };
  const receipt = receiptForEnvelope(envelope, key);
  assertEquals(authenticatedReceiptMatchesEnvelope(receipt, envelope, keyring), true);
});
```

### 6.3 Relation protocol handshake

```typescript
Deno.test("Relation offer → accept → edge", () => {
  const offer = processRelationCommand(
    { to: "vera", message: { topic: "relation-offer", payload: { ... } } },
    [],
  );
  // ... accept the offer
  // ... verify edge emitted
});
```

### 6.4 Claim coordination (no split-brain)

```typescript
Deno.test("Two rooms cannot acquire same work item", async () => {
  const coord = createFileClaimCoordinator();
  const r1 = await coord.acquire("081KR7JY10008QG0R000R503K2", "feat/x");
  const r2 = await coord.acquire("081KR7JY10008QG0R000R503K2", "feat/y");
  assertEquals(r1.outcome, "acquired");
  assertEquals(r2.outcome, "feedback");
});
```

### 6.5 DST replay (mock bus)

```typescript
Deno.test("Mock bus is deterministic", async () => {
  const bus1 = createMockBusTransport();
  const bus2 = createMockBusTransport();
  await bus1.publish(msg1);
  await bus2.publish(msg1);
  const list1 = await bus1.list({});
  const list2 = await bus2.list({});
  assertEquals(list1, list2);
});
```
