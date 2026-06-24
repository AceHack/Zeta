import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  PERSONA_REGISTRY,
  distinctVendors,
  getPersona,
  listPersonas,
} from "../src/agent-persona-registry.ts";
import {
  DEFAULT_ROOM_LIFECYCLE,
  buildRoomLifecycle,
  renderAgentUnit,
} from "../src/systemd-runtime-adapter.ts";
import {
  MIN_PEERS_FOR_BFT,
  canAttemptRepair,
  countHealthy,
  createMockMutualRepair,
  type HealthStatus,
} from "../src/mutual-repair.ts";
import {
  classifyProvisioningValues,
  validateRoomInitializationConfig,
  type RoomInitializationConfig,
} from "../src/room-initialization.ts";

// --- §6.1 persona registry --------------------------------------------------

test("persona registry has ≥3 vendor-diverse agents", () => {
  const personas = listPersonas();
  ok(personas.length >= 3);
  ok(distinctVendors().length >= 3); // BFT diversity floor
});

test("listPersonas is deterministically ordered (DST replay)", () => {
  deepEqual(
    listPersonas().map((p) => p.name),
    ["alexa", "lior", "otto", "riven", "vera"],
  );
});

test("getPersona returns the donor invocation contract", () => {
  equal(getPersona("otto")?.binary, "claude");
  deepEqual(getPersona("otto")?.invocationArgs, ["--print", "<<autonomous-loop>>"]);
  // donor source of truth: lior ships `agy` (Antigravity CLI), not `gemini`
  equal(getPersona("lior")?.binary, "agy");
  equal(getPersona("nope"), undefined);
});

test("every persona has a distinct binary", () => {
  const binaries = listPersonas().map((p) => p.binary);
  equal(new Set(binaries).size, binaries.length);
});

// --- §6.2 room lifecycle config ---------------------------------------------

test("room lifecycle defaults to always-restart, cluster-independent", () => {
  const lifecycle = buildRoomLifecycle(PERSONA_REGISTRY.otto!);
  equal(lifecycle.restartPolicy, "always");
  equal(lifecycle.independentOfCluster, true);
  deepEqual(lifecycle, DEFAULT_ROOM_LIFECYCLE);
});

test("buildRoomLifecycle applies overrides", () => {
  const lifecycle = buildRoomLifecycle(PERSONA_REGISTRY.otto!, { tickIntervalSec: 1, restartPolicy: "on-failure" });
  equal(lifecycle.tickIntervalSec, 1);
  equal(lifecycle.restartPolicy, "on-failure");
  equal(lifecycle.restartSec, DEFAULT_ROOM_LIFECYCLE.restartSec); // untouched
});

test("renderAgentUnit depends on network, NOT the cluster", () => {
  const unit = renderAgentUnit(PERSONA_REGISTRY.vera!, DEFAULT_ROOM_LIFECYCLE);
  deepEqual(unit.after, ["network-online.target"]);
  ok(!unit.after.some((d) => d.includes("k3s") || d.includes("k8s")));
  deepEqual(unit.execStart, ["codex", "exec", "<<autonomous-loop>>"]);
  equal(unit.restart, "always");
  equal(unit.serviceType, "simple");
});

// --- §6.3 mutual repair BFT quorum ------------------------------------------

const healthy: HealthStatus = { healthy: true, lastTickAt: "2026-01-01T00:00:00.000Z" };
const unhealthy: HealthStatus = { healthy: false, reason: "no tick" };

test("need ≥3 healthy peers for mutual repair", () => {
  equal(MIN_PEERS_FOR_BFT, 3);
  ok(!canAttemptRepair([healthy, unhealthy]));
  ok(!canAttemptRepair([healthy, healthy]));
  ok(canAttemptRepair([healthy, healthy, healthy]));
  equal(countHealthy([healthy, unhealthy, healthy]), 2);
});

test("mock mutual repair reports peer health deterministically", async () => {
  const repair = createMockMutualRepair({ healthyPeers: ["room-a"], nowIso: "2026-02-02T00:00:00.000Z" });
  const a = await repair.checkPeerHealth("room-a");
  ok(a.healthy && a.lastTickAt === "2026-02-02T00:00:00.000Z");
  const b = await repair.checkPeerHealth("room-b");
  ok(!b.healthy);
});

test("mock mutual repair: repair peer / unknown peer / cluster (Result-shaped)", async () => {
  const repair = createMockMutualRepair({ knownPeers: ["room-a"], repairSucceeds: true });
  const ok1 = await repair.repairPeer("room-a");
  equal(ok1.outcome, "repaired");
  const missing = await repair.repairPeer("room-x");
  ok(missing.outcome === "peer_not_found" && missing.peerRoomId === "room-x");
  const cluster = await repair.repairCluster();
  equal(cluster.outcome, "repaired");

  const failing = createMockMutualRepair({ knownPeers: ["room-a"], repairSucceeds: false, clusterRepairSucceeds: false });
  equal((await failing.repairPeer("room-a")).outcome, "repair_failed");
  equal((await failing.repairCluster()).outcome, "repair_failed");
});

// --- §6.6 room initialization (6-value provisioning) ------------------------

const MIN_CONFIG: RoomInitializationConfig = {
  hostname: "node-1",
  operatorSshPubkey: "ssh-ed25519 AAAA",
  zetaUserPasswordHash: "$6$abc",
};

test("provisioning values are classified public vs secret", () => {
  const classified = classifyProvisioningValues({
    ...MIN_CONFIG,
    clusterJoinToken: "tok",
    vendorApiKeys: { anthropic: "sk-..." },
  });
  const publicFields = classified.filter((c) => c.contentClass === "public_identifier").map((c) => c.field);
  deepEqual(publicFields, ["hostname", "operatorSshPubkey"]);
  // password / wifi / token / api keys are all secret
  ok(classified.find((c) => c.field === "zetaUserPasswordHash")?.contentClass === "secret_material");
  ok(classified.find((c) => c.field === "wifiCredentials")?.present === false);
  ok(classified.find((c) => c.field === "clusterJoinToken")?.present === true);
});

test("validateRoomInitializationConfig requires the 3 mandatory fields", () => {
  equal(validateRoomInitializationConfig(MIN_CONFIG).outcome, "ok");
  const noHost = validateRoomInitializationConfig({ ...MIN_CONFIG, hostname: "" });
  ok(noHost.outcome === "feedback" && noHost.error.kind === "missing_hostname");
  const noKey = validateRoomInitializationConfig({ ...MIN_CONFIG, operatorSshPubkey: "" });
  ok(noKey.outcome === "feedback" && noKey.error.kind === "missing_operator_pubkey");
  const noPass = validateRoomInitializationConfig({ ...MIN_CONFIG, zetaUserPasswordHash: "" });
  ok(noPass.outcome === "feedback" && noPass.error.kind === "missing_password_hash");
});
