import { deepEqual, equal, ok as assertOk, throws } from "node:assert/strict";
import { test } from "node:test";

import {
  createSystemEnvironment,
  createVirtualEnvironment,
  splitMix64,
} from "../src/simulation-environment.ts";
import { createChaosEnvironment, type ChaosPolicy } from "../src/chaos-environment.ts";
import { createOutputBuffer } from "../src/operator-algebra.ts";
import {
  createBufferReader,
  createBufferWriter,
  createInMemoryCheckpointStore,
  type Checkpointable,
} from "../src/checkpoint.ts";
import { composeKleisli, identityArrow, pipeKleisli, type KleisliArrow } from "../src/kleisli-trace.ts";
import { isOk } from "../src/result.ts";
import {
  packZetaObservation,
  unpackZetaObservation,
  type ZetaObservation,
} from "../src/observe.ts";
import { createDeterministicRoom } from "../src/room.ts";

// ── §3.1 SimulationEnvironment / DST replay ──────────────────────────────────

test("VirtualEnvironment is deterministic: same seed → same trace (MP-1)", () => {
  const env1 = createVirtualEnvironment(42n);
  const env2 = createVirtualEnvironment(42n);
  for (let i = 0; i < 1000; i++) {
    equal(env1.now(), env2.now());
    equal(env1.nextInt64(), env2.nextInt64());
    equal(env1.newGuid(), env2.newGuid());
  }
});

test("VirtualEnvironment: different seeds diverge in RNG and GUIDs", () => {
  const a = createVirtualEnvironment(1n);
  const b = createVirtualEnvironment(2n);
  equal(a.now(), b.now()); // clock is seed-independent
  let differs = false;
  for (let i = 0; i < 100; i++) {
    if (a.nextInt64() !== b.nextInt64()) {
      differs = true;
    }
  }
  assertOk(differs);
});

test("VirtualEnvironment.delay fast-forwards virtual time without waiting", async () => {
  const env = createVirtualEnvironment(7n, 1000, 0);
  equal(env.now(), new Date(1000).toISOString());
  await env.delay(5000);
  equal(env.now(), new Date(6000).toISOString());
});

test("VirtualEnvironment advanceTime/setTime control the clock", () => {
  const env = createVirtualEnvironment(0n, 0, 0);
  env.advanceTime(1234);
  equal(env.now(), new Date(1234).toISOString());
  env.setTime(0);
  equal(env.now(), new Date(0).toISOString());
});

test("splitMix64 is a pure function of state", () => {
  const a = splitMix64(99n);
  const b = splitMix64(99n);
  equal(a.value, b.value);
  equal(a.next, b.next);
});

test("SystemEnvironment produces well-formed effects", () => {
  const env = createSystemEnvironment();
  assertOk(!Number.isNaN(Date.parse(env.now())));
  assertOk(typeof env.nextInt64() === "bigint");
  assertOk(/^[0-9a-f-]{36}$/.test(env.newGuid()));
});

// ── §3.2 ChaosEnvironment ────────────────────────────────────────────────────

test("ChaosEnvironment: same seed+policy → same trace (MP-1)", () => {
  const policy: ChaosPolicy[] = ["delay_jitter", "clock_skew", "rng_stall"];
  const env1 = createChaosEnvironment(42n, policy);
  const env2 = createChaosEnvironment(42n, policy);
  for (let i = 0; i < 100; i++) {
    equal(env1.now(), env2.now());
    equal(env1.nextInt64(), env2.nextInt64());
  }
});

test("ChaosEnvironment clock_skew perturbs the clock vs a plain virtual env", () => {
  const chaos = createChaosEnvironment(3n, "clock_skew", { clockSkewMs: 100, stepMs: 0 });
  let skewed = false;
  for (let i = 0; i < 50; i++) {
    if (chaos.now() !== new Date(0).toISOString()) {
      skewed = true;
    }
  }
  assertOk(skewed);
});

// ── §3.3 Operator algebra (OutputBuffer publish-once) ────────────────────────

test("OutputBuffer enforces publish-exactly-once per tick", () => {
  const buf = createOutputBuffer<number>();
  equal(buf.published(), false);
  buf.publish(5);
  equal(buf.published(), true);
  throws(() => buf.publish(6));
  equal(buf.take(), 5);
  equal(buf.published(), false);
  throws(() => buf.take());
});

// ── §3.4 Checkpoint round-trip ───────────────────────────────────────────────

function makeCounter(initial: number): Checkpointable & { value: number } {
  return {
    value: initial,
    stateVersion: 1,
    saveState(writer) {
      writer.writeInt32(this.value);
    },
    loadState(reader) {
      this.value = reader.readInt32();
    },
  };
}

test("Checkpoint buffer writer/reader round-trips primitives", () => {
  const w = createBufferWriter();
  w.writeInt32(-7);
  w.writeInt64(9_007_199_254_740_993n);
  w.writeFloat(3.5);
  w.writeBool(true);
  w.writeString("héllo");
  w.writeBytes(Uint8Array.from([1, 2, 3]));
  const r = createBufferReader(w.toBytes());
  equal(r.readInt32(), -7);
  equal(r.readInt64(), 9_007_199_254_740_993n);
  equal(r.readFloat(), 3.5);
  equal(r.readBool(), true);
  equal(r.readString(), "héllo");
  deepEqual([...r.readBytes()], [1, 2, 3]);
});

test("InMemoryCheckpointStore save/restore round-trip (DST replay from checkpoint)", async () => {
  const store = createInMemoryCheckpointStore();
  const counter = makeCounter(41);
  counter.value = 42;
  const saved = await store.saveCheckpoint("room-x", 5, [[0, counter]]);
  assertOk(isOk(saved));

  const loaded = await store.loadCheckpoint("room-x");
  assertOk(isOk(loaded));
  if (isOk(loaded)) {
    const value = loaded.value;
    assertOk(value !== undefined);
    if (value !== undefined) {
      equal(value.tick, 5);
      const entry = value.states[0];
      assertOk(entry !== undefined);
      if (entry !== undefined) {
        const [slot, reader] = entry;
        equal(slot, 0);
        const restored = makeCounter(0);
        equal(reader.readInt32(), restored.stateVersion); // version prefix
        restored.loadState(reader);
        equal(restored.value, 42);
      }
    }
  }
});

test("loadCheckpoint returns ok(undefined) for an unknown room", async () => {
  const store = createInMemoryCheckpointStore();
  const loaded = await store.loadCheckpoint("nope");
  assertOk(isOk(loaded));
  if (isOk(loaded)) {
    equal(loaded.value, undefined);
  }
});

// ── §3.8 Kleisli trace arrows (category laws) ────────────────────────────────

const ctx = { traceId: "t", spanId: "s" };

test("Kleisli composition is associative", async () => {
  const f: KleisliArrow<number, number> = (_c, n) => Promise.resolve(n + 1);
  const g: KleisliArrow<number, number> = (_c, n) => Promise.resolve(n * 2);
  const h: KleisliArrow<number, number> = (_c, n) => Promise.resolve(n - 3);
  const left = composeKleisli(composeKleisli(f, g), h);
  const right = composeKleisli(f, composeKleisli(g, h));
  equal(await left(ctx, 10), await right(ctx, 10));
});

test("identityArrow is a left and right unit", async () => {
  const f: KleisliArrow<number, string> = (_c, n) => Promise.resolve(`#${n}`);
  equal(await composeKleisli(identityArrow<number>(), f)(ctx, 4), await f(ctx, 4));
  equal(await composeKleisli(f, identityArrow<string>())(ctx, 4), await f(ctx, 4));
});

test("pipeKleisli threads context across a pipeline", async () => {
  const inc: KleisliArrow<number, number> = (_c, n) => Promise.resolve(n + 1);
  const pipeline = pipeKleisli(inc, inc, inc);
  equal(await pipeline(ctx, 0), 3);
});

// ── §3.6 ZetaObservation pack/unpack round-trip (MP-8 parity bytes) ───────────

test("ZetaObservation pack/unpack round-trips canonical observations", () => {
  const obs: ZetaObservation = {
    version: 1,
    timestamp: 1_700_000_000_000,
    category: "workflow",
    authority: "trusted_agent",
    persona: "firefly_coherence",
    momentum: 96,
    location: "west_europe",
  };
  const id = packZetaObservation(obs);
  deepEqual(unpackZetaObservation(id), obs);
});

test("ZetaObservation pack rejects out-of-range fields", () => {
  const base: ZetaObservation = {
    version: 1,
    timestamp: 0,
    category: "observation",
    authority: "raw",
    persona: "human_maintainer",
    momentum: 0,
    location: "unknown",
  };
  throws(() => packZetaObservation({ ...base, momentum: 999 }));
  throws(() => packZetaObservation({ ...base, timestamp: 2 ** 49 }));
});

// ── §4.2 Room wiring: env projection ─────────────────────────────────────────

test("createDeterministicRoom projects clock+ids from a virtual env", () => {
  const room = createDeterministicRoom({
    roomId: "zid-room-1",
    hatIds: ["reviewer"],
    baseTimeMs: 0,
    stepMs: 1000,
  });
  assertOk(room.env !== undefined);
  equal(room.durabilityMode, "in_memory_only");
  equal(room.clock.now(), "1970-01-01T00:00:00.000Z");
  equal(room.clock.now(), "1970-01-01T00:00:01.000Z");
  equal(room.ids.createId("evt"), "evt-001");
  equal(room.ids.createId("evt"), "evt-002");
});

test("createDeterministicRoom with same seed → identical env RNG draws (DST)", () => {
  const a = createDeterministicRoom({ roomId: "r", hatIds: [], seed: 123 });
  const b = createDeterministicRoom({ roomId: "r", hatIds: [], seed: 123 });
  assertOk(a.env !== undefined && b.env !== undefined);
  if (a.env !== undefined && b.env !== undefined) {
    for (let i = 0; i < 50; i++) {
      equal(a.env.nextInt64(), b.env.nextInt64());
    }
  }
});
