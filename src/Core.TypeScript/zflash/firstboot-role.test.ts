// src/Core.TypeScript/zflash/firstboot-role.test.ts
//
// 081KSNY2Z0008QG0R0008PN7RQ scenario 5 role provisioning — pure-core tests.
//
// Every test here runs with no QEMU, no ISO, no filesystem: the config is a
// pure function of the requested role, so the whole derivation is checkable
// in milliseconds and replays byte-identically (§7 DST).
//
// Run: bun test src/Core.TypeScript/zflash/firstboot-role.test.ts

import { describe, expect, test } from "bun:test";
import {
  composeFirstbootConfFileContent,
  DEFAULT_FIRST_CONTROL_PLANE_FLAKE_HOST,
  DEFAULT_JOINER_FLAKE_HOST,
  firstbootRoleFromFlags,
  K3S_AGENT_TOKEN_INSTALLED_PATH,
  planFirstbootConfFileContent,
  resolveFirstbootConfig,
  K3S_NODE_TOKEN_WITH_CA_HASH,
  validateJoinServerUrl,
  validateJoinTokenMaterial,
  validateTokenEspPath,
  ZETA_FIRSTBOOT_CONF_ESP_DESTINATION,
  ZETA_JOIN_TOKEN_ESP_DESTINATION,
  type ZetaFirstbootRole,
} from "./firstboot-role.ts";
import { planFileBackedZflashImage } from "./lib.ts";

describe("constants pinned against the guest tree", () => {
  test("token destination matches k3s-agent.nix tokenFile", () => {
    // nixos/modules/k3s-agent.nix: services.k3s.tokenFile =
    // lib.mkDefault "/var/lib/rancher/k3s/agent/token". If that moves and
    // this does not, a joiner installs with its token in the wrong place and
    // silently never joins.
    expect(K3S_AGENT_TOKEN_INSTALLED_PATH).toBe("/var/lib/rancher/k3s/agent/token");
  });

  test("ESP destinations are the ones the planner emits", () => {
    expect(ZETA_FIRSTBOOT_CONF_ESP_DESTINATION).toBe("/zeta-firstboot.conf");
    expect(ZETA_JOIN_TOKEN_ESP_DESTINATION).toBe("/zeta-join-token");
  });

  test("default flake hosts exist in full-ai-cluster/flake.nix", () => {
    // Checked against nixosConfigurations on 2026-08-17: control-plane,
    // worker-gpu, worker-template. worker-template imports k3s-agent.nix.
    expect(DEFAULT_FIRST_CONTROL_PLANE_FLAKE_HOST).toBe("control-plane");
    expect(DEFAULT_JOINER_FLAKE_HOST).toBe("worker-template");
  });
});

describe("resolveFirstbootConfig", () => {
  test("first-control-plane defaults to the control-plane flake host", () => {
    const resolved = resolveFirstbootConfig({ kind: "first-control-plane" });
    expect(resolved).toEqual({
      ok: true,
      value: { role: "first-control-plane", flakeHost: "control-plane" },
    });
  });

  test("first-control-plane carries no join fields at all", () => {
    const resolved = resolveFirstbootConfig({ kind: "first-control-plane" });
    if (!resolved.ok) throw new Error(resolved.error);
    // Not "empty string" — absent. A founding node with an empty join URL
    // would be a joiner that cannot join.
    expect(resolved.value.joinServerUrl).toBeUndefined();
    expect(resolved.value.joinTokenEspPath).toBeUndefined();
  });

  test("joiner defaults to worker-template and keeps its endpoint", () => {
    const resolved = resolveFirstbootConfig({
      kind: "joiner",
      serverUrl: "https://control-plane.local:6443",
    });
    expect(resolved).toEqual({
      ok: true,
      value: {
        role: "joiner",
        flakeHost: "worker-template",
        joinServerUrl: "https://control-plane.local:6443",
      },
    });
  });

  test("joiner keeps an explicit token ESP path", () => {
    const resolved = resolveFirstbootConfig({
      kind: "joiner",
      serverUrl: "https://control-plane.local:6443",
      tokenEspPath: "/zeta-join-token",
    });
    if (!resolved.ok) throw new Error(resolved.error);
    expect(resolved.value.joinTokenEspPath).toBe("/zeta-join-token");
  });

  test("an explicit worker-gpu flake host is honoured", () => {
    const resolved = resolveFirstbootConfig({
      kind: "joiner",
      flakeHost: "worker-gpu",
      serverUrl: "https://control-plane.local:6443",
    });
    if (!resolved.ok) throw new Error(resolved.error);
    expect(resolved.value.flakeHost).toBe("worker-gpu");
  });

  test("refuses a flake host that is not a lowercase DNS label", () => {
    for (const bad of ["Worker-GPU", "-worker", "worker-", "worker gpu", "worker/gpu", ""]) {
      const resolved = resolveFirstbootConfig({ kind: "first-control-plane", flakeHost: bad });
      if (bad === "") {
        // Empty falls back to the default rather than refusing.
        expect(resolved.ok).toBe(true);
        continue;
      }
      expect(resolved.ok).toBe(false);
    }
  });

  test("refuses a flake host carrying a command substitution", () => {
    const resolved = resolveFirstbootConfig({
      kind: "first-control-plane",
      flakeHost: "control-plane$(rm -rf /)",
    });
    expect(resolved.ok).toBe(false);
  });
});

describe("validateJoinServerUrl — the guard on a value bash will source", () => {
  test("accepts https host:port and bare https host", () => {
    expect(validateJoinServerUrl("https://control-plane.local:6443")).toBeNull();
    expect(validateJoinServerUrl("https://10.0.2.15:6443")).toBeNull();
    expect(validateJoinServerUrl("https://control-plane.local")).toBeNull();
  });

  test("refuses http — the node-token crosses this connection", () => {
    const error = validateJoinServerUrl("http://control-plane.local:6443");
    expect(error).not.toBeNull();
    expect(error).toContain("https");
  });

  test("refuses shell metacharacters", () => {
    // Each of these, sourced unguarded, executes rather than assigns.
    for (const hostile of [
      "https://host:6443;rm -rf /",
      "https://host:6443$(id)",
      "https://host:6443`id`",
      "https://host:6443\nHOST=control-plane",
      "https://host:6443'",
      "https://host:6443 && reboot",
    ]) {
      expect(validateJoinServerUrl(hostile)).not.toBeNull();
    }
  });

  test("refuses metacharacters in a PORT-LESS host — the case only the allowlist catches", () => {
    // Found by mutation, 2026-08-17, and worth recording as an owned miss.
    // Deleting the allowlist check left EVERY hostile case in the test above
    // still failing — they were being caught incidentally by the numeric-port
    // rule, not by the guard that exists for them. So that test did not
    // falsify the guard it appeared to test. A port-less authority never
    // reaches the numeric-port rule, and without the allowlist
    // `https://host;reboot` VALIDATED and would have been sourced by bash.
    // These are the inputs that actually falsify the guard.
    expect(validateJoinServerUrl("https://host;reboot")).not.toBeNull();
    expect(validateJoinServerUrl("https://host$(id)")).not.toBeNull();
    expect(validateJoinServerUrl("https://host`id`")).not.toBeNull();
    expect(validateJoinServerUrl("https://host&&reboot")).not.toBeNull();
    expect(validateJoinServerUrl("https://ho st")).not.toBeNull();
    expect(validateJoinServerUrl("https://host'")).not.toBeNull();
    expect(validateJoinServerUrl("https://host\nHOST=control-plane")).not.toBeNull();
  });

  test("refuses a path, userinfo, empty host, and a bad port", () => {
    expect(validateJoinServerUrl("https://host:6443/join")).not.toBeNull();
    expect(validateJoinServerUrl("https://user@host:6443")).not.toBeNull();
    expect(validateJoinServerUrl("https://")).not.toBeNull();
    expect(validateJoinServerUrl("https://host:0")).not.toBeNull();
    expect(validateJoinServerUrl("https://host:65536")).not.toBeNull();
    expect(validateJoinServerUrl("https://host:64k")).not.toBeNull();
    expect(validateJoinServerUrl("")).not.toBeNull();
  });
});

describe("validateTokenEspPath", () => {
  test("accepts an absolute ESP path", () => {
    expect(validateTokenEspPath("/zeta-join-token")).toBeNull();
  });

  test("refuses relative paths, traversal, and metacharacters", () => {
    expect(validateTokenEspPath("zeta-join-token")).not.toBeNull();
    expect(validateTokenEspPath("/../etc/shadow")).not.toBeNull();
    expect(validateTokenEspPath("/zeta-join-token;id")).not.toBeNull();
    expect(validateTokenEspPath("")).not.toBeNull();
  });
});

describe("composeFirstbootConfFileContent", () => {
  test("founder config names the role and the flake host bash will use", () => {
    const planned = planFirstbootConfFileContent({ kind: "first-control-plane" });
    if (!planned.ok) throw new Error(planned.error);
    expect(planned.value).toContain("ZETA_ROLE='first-control-plane'\n");
    // HOST is the variable zeta-first-boot.sh already reads before
    // exec'ing `zeta-install "$HOST"`. Renaming it silently disables the
    // whole mechanism, so it is pinned.
    expect(planned.value).toContain("HOST='control-plane'\n");
    expect(planned.value).not.toContain("ZETA_JOIN_SERVER_URL");
    expect(planned.value).not.toContain("ZETA_JOIN_TOKEN_ESP_PATH");
  });

  test("joiner config is byte-exact and ends with a newline", () => {
    const planned = planFirstbootConfFileContent({
      kind: "joiner",
      serverUrl: "https://control-plane.local:6443",
      tokenEspPath: "/zeta-join-token",
    });
    if (!planned.ok) throw new Error(planned.error);
    const assignments = planned.value.split("\n").filter((line) => !line.startsWith("#") && line.length > 0);
    expect(assignments).toEqual([
      "ZETA_ROLE='joiner'",
      "HOST='worker-template'",
      "ZETA_JOIN_SERVER_URL='https://control-plane.local:6443'",
      "ZETA_JOIN_TOKEN_ESP_PATH='/zeta-join-token'",
    ]);
    expect(planned.value.endsWith("\n")).toBe(true);
  });

  // ── joining-node-address-assignment ───────────────────────────────────────
  //
  // These exist because MUTATION TESTING found the gap, not because the shape
  // looked thin. Two mutations survived the first pass: dropping
  // `clusterSegmentMac` from the resolved fields, and deleting the
  // `ZETA_CLUSTER_CONTROL_PLANE_IP` line from the emitted file. Both left 397
  // tests green while producing a medium that cannot address the segment —
  // the all-three-or-none invariant was documented in prose and constrained
  // by nothing, which is the vacuity class.

  test("a joiner's conf carries all three addressing lines, byte-exact", () => {
    const planned = planFirstbootConfFileContent({
      kind: "joiner",
      serverUrl: "https://control-plane:6443",
      tokenEspPath: "/zeta-join-token",
      clusterSegment: { segmentNicMac: "52:54:00:7a:f1:02" },
    });
    if (!planned.ok) throw new Error(planned.error);
    const assignments = planned.value.split("\n").filter((line) => !line.startsWith("#") && line.length > 0);
    expect(assignments).toEqual([
      "ZETA_ROLE='joiner'",
      "HOST='worker-template'",
      "ZETA_JOIN_SERVER_URL='https://control-plane:6443'",
      "ZETA_JOIN_TOKEN_ESP_PATH='/zeta-join-token'",
      "ZETA_CLUSTER_NODE_CIDR='10.88.0.2/24'",
      "ZETA_CLUSTER_SEGMENT_MAC='52:54:00:7a:f1:02'",
      "ZETA_CLUSTER_CONTROL_PLANE_IP='10.88.0.1'",
    ]);
  });

  test("a founder's conf carries its own address and names itself the control plane", () => {
    const planned = planFirstbootConfFileContent({
      kind: "first-control-plane",
      clusterSegment: { segmentNicMac: "52:54:00:7a:f1:01" },
    });
    if (!planned.ok) throw new Error(planned.error);
    expect(planned.value).toContain("ZETA_CLUSTER_NODE_CIDR='10.88.0.1/24'\n");
    expect(planned.value).toContain("ZETA_CLUSTER_SEGMENT_MAC='52:54:00:7a:f1:01'\n");
    expect(planned.value).toContain("ZETA_CLUSTER_CONTROL_PLANE_IP='10.88.0.1'\n");
  });

  test("ALL THREE addressing fields or NONE — a partial set is never emitted", () => {
    // A node with an address and no MAC configures an arbitrary NIC; a node
    // with a MAC and no control-plane address can speak on the segment and
    // cannot name what it is joining. Both fail as network faults, so neither
    // is representable.
    const cases: readonly ZetaFirstbootRole[] = [
      { kind: "first-control-plane" },
      { kind: "first-control-plane", clusterSegment: { segmentNicMac: "52:54:00:7a:f1:01" } },
      { kind: "joiner", serverUrl: "https://control-plane:6443" },
      {
        kind: "joiner",
        serverUrl: "https://control-plane:6443",
        clusterSegment: { segmentNicMac: "52:54:00:7a:f1:02" },
      },
      {
        kind: "joiner",
        serverUrl: "https://control-plane:6443",
        tokenEspPath: "/zeta-join-token",
        clusterSegment: { segmentNicMac: "52:54:00:7a:f1:03", hostIndex: 3 },
      },
    ];
    for (const role of cases) {
      const resolved = resolveFirstbootConfig(role);
      if (!resolved.ok) throw new Error(resolved.error);
      const present = [
        resolved.value.clusterNodeAddressCidr,
        resolved.value.clusterSegmentMac,
        resolved.value.clusterControlPlaneAddress,
      ].filter((field) => field !== undefined).length;
      expect([0, 3]).toContain(present);
      // And the emitted file agrees with the resolved config — a field that
      // resolves and is never written is the same failure one layer down.
      const planned = planFirstbootConfFileContent(role);
      if (!planned.ok) throw new Error(planned.error);
      const emitted = ["ZETA_CLUSTER_NODE_CIDR=", "ZETA_CLUSTER_SEGMENT_MAC=", "ZETA_CLUSTER_CONTROL_PLANE_IP="].filter(
        (key) => planned.value.includes(key),
      ).length;
      expect(emitted).toBe(present);
    }
  });

  test("a node flashed with no clusterSegment keeps DHCP — no addressing lines at all", () => {
    const planned = planFirstbootConfFileContent({ kind: "first-control-plane" });
    if (!planned.ok) throw new Error(planned.error);
    expect(planned.value).not.toContain("ZETA_CLUSTER_");
  });

  test("a bad segment MAC refuses the whole config rather than dropping addressing", () => {
    const planned = planFirstbootConfFileContent({
      kind: "joiner",
      serverUrl: "https://control-plane:6443",
      clusterSegment: { segmentNicMac: "01:00:5e:00:00:01" },
    });
    expect(planned.ok).toBe(false);
    if (!planned.ok) {
      expect(planned.error).toContain("MULTICAST");
    }
  });

  test("every value is single-quoted", () => {
    const planned = planFirstbootConfFileContent({
      kind: "joiner",
      serverUrl: "https://control-plane.local:6443",
      tokenEspPath: "/zeta-join-token",
    });
    if (!planned.ok) throw new Error(planned.error);
    for (const line of planned.value.split("\n")) {
      if (line.startsWith("#") || line.length === 0) continue;
      const value = line.slice(line.indexOf("=") + 1);
      expect(value.startsWith("'")).toBe(true);
      expect(value.endsWith("'")).toBe(true);
    }
  });

  test("is deterministic — same input, byte-identical output", () => {
    const role = { kind: "joiner", serverUrl: "https://a.local:6443" } as const;
    const first = planFirstbootConfFileContent(role);
    const second = planFirstbootConfFileContent(role);
    if (!first.ok || !second.ok) throw new Error("expected both to resolve");
    expect(first.value).toBe(second.value);
  });

  test("distinguishes the two roles — the whole point of the file", () => {
    const founder = planFirstbootConfFileContent({ kind: "first-control-plane" });
    const joiner = planFirstbootConfFileContent({
      kind: "joiner",
      serverUrl: "https://control-plane.local:6443",
    });
    if (!founder.ok || !joiner.ok) throw new Error("expected both to resolve");
    expect(founder.value).not.toBe(joiner.value);
    expect(composeFirstbootConfFileContent(founder.config)).toBe(founder.value);
  });
});

describe("firstbootRoleFromFlags", () => {
  test("no flags means no role — unchanged legacy behaviour", () => {
    expect(firstbootRoleFromFlags({})).toEqual({ ok: true, value: undefined });
  });

  test("refuses join flags without a role instead of ignoring them", () => {
    expect(firstbootRoleFromFlags({ joinServerUrl: "https://a.local:6443" }).ok).toBe(false);
    expect(firstbootRoleFromFlags({ joinTokenSourcePath: "/tmp/token" }).ok).toBe(false);
    expect(firstbootRoleFromFlags({ flakeHost: "worker-gpu" }).ok).toBe(false);
  });

  test("refuses join flags on a founding control plane", () => {
    expect(
      firstbootRoleFromFlags({ role: "first-control-plane", joinServerUrl: "https://a.local:6443" }).ok,
    ).toBe(false);
    expect(firstbootRoleFromFlags({ role: "first-control-plane", joinTokenSourcePath: "/tmp/t" }).ok).toBe(false);
  });

  test("refuses a joiner with no endpoint", () => {
    expect(firstbootRoleFromFlags({ role: "joiner" }).ok).toBe(false);
  });

  test("refuses an unknown role", () => {
    expect(firstbootRoleFromFlags({ role: "worker" }).ok).toBe(false);
  });

  test("a joiner with a token names the ESP destination the planner writes", () => {
    const built = firstbootRoleFromFlags({
      role: "joiner",
      joinServerUrl: "https://control-plane.local:6443",
      joinTokenSourcePath: "/tmp/node-token",
    });
    if (!built.ok || built.value === undefined) throw new Error("expected a role");
    expect(built.value).toEqual({
      kind: "joiner",
      serverUrl: "https://control-plane.local:6443",
      tokenEspPath: ZETA_JOIN_TOKEN_ESP_DESTINATION,
    });
  });

  // ── joining-node-address-assignment: the flag surface ─────────────────────

  test("--cluster-segment-mac opts a joiner into static addressing", () => {
    const built = firstbootRoleFromFlags({
      role: "joiner",
      joinServerUrl: "https://control-plane:6443",
      clusterSegmentMac: "52:54:00:7a:f1:02",
    });
    if (!built.ok || built.value === undefined) throw new Error("expected a role");
    expect(built.value).toEqual({
      kind: "joiner",
      serverUrl: "https://control-plane:6443",
      clusterSegment: { segmentNicMac: "52:54:00:7a:f1:02" },
    });
  });

  test("--cluster-segment-mac works for a founder too", () => {
    const built = firstbootRoleFromFlags({
      role: "first-control-plane",
      clusterSegmentMac: "52:54:00:7a:f1:01",
    });
    if (!built.ok || built.value === undefined) throw new Error("expected a role");
    expect(built.value).toEqual({
      kind: "first-control-plane",
      clusterSegment: { segmentNicMac: "52:54:00:7a:f1:01" },
    });
  });

  test("--cluster-host-index is carried through as a number", () => {
    const built = firstbootRoleFromFlags({
      role: "joiner",
      joinServerUrl: "https://control-plane:6443",
      clusterSegmentMac: "52:54:00:7a:f1:03",
      clusterHostIndex: "3",
    });
    if (!built.ok || built.value === undefined) throw new Error("expected a role");
    expect(built.value).toEqual({
      kind: "joiner",
      serverUrl: "https://control-plane:6443",
      clusterSegment: { segmentNicMac: "52:54:00:7a:f1:03", hostIndex: 3 },
    });
  });

  test("REFUSES --cluster-host-index without --cluster-segment-mac", () => {
    // Naming WHICH address without naming WHICH NIC is the partial-addressing
    // shape arriving through the flag surface. A permissive parser would
    // accept and ignore it, leaving an operator sure they allocated .3.
    const built = firstbootRoleFromFlags({
      role: "joiner",
      joinServerUrl: "https://control-plane:6443",
      clusterHostIndex: "3",
    });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.error).toContain("requires --cluster-segment-mac");
    }
  });

  test("REFUSES addressing flags with no --role", () => {
    expect(firstbootRoleFromFlags({ clusterSegmentMac: "52:54:00:7a:f1:02" }).ok).toBe(false);
    expect(firstbootRoleFromFlags({ clusterHostIndex: "3" }).ok).toBe(false);
  });

  test("REFUSES a non-numeric --cluster-host-index", () => {
    const built = firstbootRoleFromFlags({
      role: "joiner",
      joinServerUrl: "https://control-plane:6443",
      clusterSegmentMac: "52:54:00:7a:f1:03",
      clusterHostIndex: "3; reboot",
    });
    expect(built.ok).toBe(false);
  });

  test("the flag path and the harness path produce the same medium", () => {
    // The harness prints a zflash invocation in `missingRuntimeRequirements`.
    // If that command produced a different config than `scenario5FirstbootRole`
    // plans for, an operator following the instructions would flash a medium
    // the plan does not describe.
    const fromFlags = firstbootRoleFromFlags({
      role: "joiner",
      joinServerUrl: "https://control-plane:6443",
      joinTokenSourcePath: "/tmp/node-token",
      clusterSegmentMac: "52:54:00:7a:f1:02",
    });
    if (!fromFlags.ok || fromFlags.value === undefined) throw new Error("expected a role");
    const viaFlags = planFirstbootConfFileContent(fromFlags.value);
    const viaHarness = planFirstbootConfFileContent({
      kind: "joiner",
      flakeHost: DEFAULT_JOINER_FLAKE_HOST,
      serverUrl: "https://control-plane:6443",
      tokenEspPath: ZETA_JOIN_TOKEN_ESP_DESTINATION,
      clusterSegment: { segmentNicMac: "52:54:00:7a:f1:02" },
    });
    if (!viaFlags.ok || !viaHarness.ok) throw new Error("both must plan");
    expect(viaFlags.value).toBe(viaHarness.value);
  });
});

describe("planFileBackedZflashImage role provisioning", () => {
  const base = {
    isoPath: "/tmp/installer.iso",
    outputImagePath: "/tmp/out.img",
    espOffsetBytes: 141_312,
    pubkeyPath: "/tmp/id.pub",
  } as const;

  test("no role means the ESP write set is untouched", () => {
    const planned = planFileBackedZflashImage({ ...base });
    if (!planned.ok) throw new Error(planned.error);
    expect(planned.value.espWrites.map((w) => w.destination)).toEqual(["/zeta-authorized-keys.pub"]);
  });

  test("a role appends /zeta-firstboot.conf with the composed content", () => {
    const planned = planFileBackedZflashImage({
      ...base,
      firstbootRole: { kind: "joiner", serverUrl: "https://control-plane.local:6443" },
    });
    if (!planned.ok) throw new Error(planned.error);
    const conf = planned.value.espWrites.find((w) => w.destination === "/zeta-firstboot.conf");
    expect(conf).toBeDefined();
    expect(conf?.content).toContain("ZETA_ROLE='joiner'");
    expect(conf?.sourcePath).toBeUndefined();
  });

  test("a token lands on the ESP only alongside a role that names it", () => {
    const planned = planFileBackedZflashImage({
      ...base,
      firstbootRole: {
        kind: "joiner",
        serverUrl: "https://control-plane.local:6443",
        tokenEspPath: "/zeta-join-token",
      },
      joinTokenSourcePath: "/tmp/node-token",
    });
    if (!planned.ok) throw new Error(planned.error);
    const token = planned.value.espWrites.find((w) => w.destination === "/zeta-join-token");
    expect(token?.sourcePath).toBe("/tmp/node-token");
  });

  test("refuses a token the config does not point at — a write nothing reads", () => {
    const planned = planFileBackedZflashImage({
      ...base,
      // No tokenEspPath on the role, so nothing on the guest would look for it.
      firstbootRole: { kind: "joiner", serverUrl: "https://control-plane.local:6443" },
      joinTokenSourcePath: "/tmp/node-token",
    });
    expect(planned.ok).toBe(false);
  });

  test("refuses a token with no role at all", () => {
    const planned = planFileBackedZflashImage({ ...base, joinTokenSourcePath: "/tmp/node-token" });
    expect(planned.ok).toBe(false);
  });

  test("propagates a role refusal instead of writing a corrected config", () => {
    const planned = planFileBackedZflashImage({
      ...base,
      firstbootRole: { kind: "joiner", serverUrl: "http://control-plane.local:6443" },
    });
    expect(planned.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// JOIN-TOKEN MATERIAL — the CA hash is what authenticates the bootstrap
// ---------------------------------------------------------------------------
//
// Traced through k3s `pkg/clientaccess/token.go` on 2026-08-21 rather than
// assumed. The three upstream facts these tests exist for:
//
//   parseToken       a token with no `K10` prefix is REWRITTEN to `K10:::<pw>`,
//                    not rejected, so `caHash` silently becomes empty.
//   getCACerts       the CA bundle is fetched with `insecureClient`, whose
//                    tls.Config sets `InsecureSkipVerify: true`.
//   validateCAHash   empty caHash + non-empty CACerts -> logrus.Warn, return nil.
//
// Net: `https://` protects nothing at bootstrap on a self-signed cluster. The
// CA hash does. So a hash-less token is refused at flash time.

const VALID_NODE_TOKEN = `K10${"a".repeat(64)}::server:0123456789abcdef`;

describe("validateJoinTokenMaterial", () => {
  test("accepts the shape k3s itself writes to node-token", () => {
    expect(validateJoinTokenMaterial(VALID_NODE_TOKEN)).toBeNull();
  });

  test("accepts a trailing newline — WriteToken appends one", () => {
    // pkg/server/handlers/token.go: os.WriteFile(file, []byte(token+"\n"), 0600)
    expect(validateJoinTokenMaterial(`${VALID_NODE_TOKEN}\n`)).toBeNull();
  });

  test("REFUSES a bare shared secret (the K3S_TOKEN=hunter2 pattern)", () => {
    const error = validateJoinTokenMaterial("hunter2");
    expect(error).not.toBeNull();
    expect(error).toContain("CA hash");
    expect(error).toContain("InsecureSkipVerify");
  });

  test("REFUSES a kubeadm-style bootstrap token, which parseToken also accepts", () => {
    // parseToken turns `abcdef.0123456789abcdef` into `K10::<that>` — parses
    // fine upstream, still carries no CA hash.
    expect(validateJoinTokenMaterial("abcdef.0123456789abcdef")).not.toBeNull();
  });

  test("REFUSES K10 with an empty hash — the exact `K10::creds` degenerate form", () => {
    expect(validateJoinTokenMaterial("K10::server:secret")).not.toBeNull();
  });

  test("REFUSES a hash of the wrong length (caHashLength = sha256.Size * 2 = 64)", () => {
    expect(validateJoinTokenMaterial(`K10${"a".repeat(63)}::server:s`)).not.toBeNull();
    expect(validateJoinTokenMaterial(`K10${"a".repeat(65)}::server:s`)).not.toBeNull();
  });

  test("REFUSES an uppercase hash — hex.EncodeToString emits lowercase and the compare is ==", () => {
    expect(validateJoinTokenMaterial(`K10${"A".repeat(64)}::server:s`)).not.toBeNull();
  });

  test("REFUSES a hash with no credentials after the separator", () => {
    expect(validateJoinTokenMaterial(`K10${"a".repeat(64)}::`)).not.toBeNull();
  });

  test("REFUSES empty and whitespace-only material", () => {
    expect(validateJoinTokenMaterial("")).toContain("empty");
    expect(validateJoinTokenMaterial("   \n  ")).toContain("empty");
  });

  test("REFUSES multi-line material — the wrong file was passed", () => {
    const error = validateJoinTokenMaterial(`${VALID_NODE_TOKEN}\n${VALID_NODE_TOKEN}`);
    expect(error).toContain("one token line");
  });

  test("K3S_NODE_TOKEN_WITH_CA_HASH is anchored at both ends", () => {
    expect(K3S_NODE_TOKEN_WITH_CA_HASH.test(`prefix K10${"a".repeat(64)}::s`)).toBe(false);
  });
});
