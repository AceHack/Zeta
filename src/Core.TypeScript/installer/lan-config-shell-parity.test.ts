/**
 * lan-config-shell-parity.test.ts - docs/ops/INSTALL-TIME-CONFIG.md rows 3 and 4.
 *
 * Extracts the ZETA-LB-POOL block from the real zeta-install.sh and runs it under bash,
 * the same harness as public-endpoint-shell-parity.test.ts:
 *
 *   1. the shell validators agree with lan-config.ts over every input class, including
 *      the live defect (192.168.1.240-250 applied on a different LAN);
 *   2. the shell cluster-CIDR derivation replays the SAME golden vectors the TypeScript
 *      and Nix derivations replay (nixos/tests/cluster-cidr-golden-vectors.json);
 *   3. resolution order is ESP -> prompt -> UNSET, an ESP value that cannot work is
 *      REFUSED (and refuses the install when nobody can be asked), and a value whose
 *      addresses already answer on the LAN is refused rather than applied;
 *   4. the call sites in the real scripts sit where a refusal is still free.
 *
 * `ping` and `ip` are bash FUNCTIONS defined by the harness: a real `ping` on a CI
 * runner answers for whatever happens to be on its network, and Git Bash on Windows
 * ships the Windows ping.exe. A function is portable and deterministic, and the block's
 * `command -v ping` / `ping -c 1 -W 1 ADDR` call sites see it exactly as they would the
 * binary.
 *
 * What this cannot prove: that a real `ip` prints the fixtures' format on the live ISO
 * (iproute2's `-o route get` / `-o addr show` are stable, documented one-line forms, but
 * it is a fixture, not a boot), that a real subnet host answers ICMP at all (a silent
 * host is invisible to the probe - it is evidence, not proof), and the imperative call
 * site beyond the ORDER pinned in the last block. The QEMU lanes exercise the
 * non-interactive UNSET path only.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  hostNetworkCollisions,
  proposeLbPool,
  reservedCidrsFor,
  validateLbPool,
  type LanFacts,
} from "./lan-config.ts";
import { deriveClusterNetwork } from "../cluster/cluster-cidr.ts";

const INSTALL_SH = resolve(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh");
const FIRST_BOOT_SH = resolve(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh");
const ISO_CONFIG = resolve(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix");
const GOLDEN = resolve(import.meta.dir, "../../../full-ai-cluster/nixos/tests/cluster-cidr-golden-vectors.json");
const IDENTITY = resolve(import.meta.dir, "../../../full-ai-cluster/cluster-identity.json");
const SRC = readFileSync(INSTALL_SH, "utf8");
const BEGIN = "# ZETA-LB-POOL-BEGIN";
const END = "# ZETA-LB-POOL-END";

function extractBlock(): string {
  const b = SRC.indexOf(BEGIN);
  const e = SRC.indexOf(END);
  if (b < 0 || e < 0 || e < b) throw new Error("ZETA-LB-POOL markers missing/out of order in zeta-install.sh");
  return SRC.slice(b, e + END.length);
}

const workdir = mkdtempSync(join(tmpdir(), "zeta-lan-config-"));
const fwd = (p: string) => p.replaceAll("\\", "/");
const blockPath = fwd(join(workdir, "block.sh"));
writeFileSync(blockPath, extractBlock() + "\n", "utf8");

/** `ping` that answers only for loopback and the addresses in $FAKE_PING_UP. `ip` is never used by the pure tests. */
const FAKES = `
ping() {
  local last
  for last in "$@"; do :; done
  if [ "$last" = "127.0.0.1" ]; then return 0; fi
  case " \${FAKE_PING_UP:-} " in *" $last "*) return 0 ;; esac
  return 1
}
`;

function runBashFull(script: string, env: Record<string, string>, stdin = ""): { out: string; err: string } {
  const runner = join(workdir, "runner.sh");
  writeFileSync(runner, `set -uo pipefail\n${FAKES}\nsource ${blockPath}\n${script}\n`, "utf8");
  const r = spawnSync("bash", [fwd(runner)], {
    encoding: "utf8",
    input: stdin,
    env: { ...process.env, ZETA_LB_POOL: "", FAKE_PING_UP: "", ...env },
  });
  if (r.status !== 0) throw new Error(`bash exited ${String(r.status)}: ${String(r.stderr)}`);
  return { out: String(r.stdout).trim(), err: String(r.stderr) };
}
const runBash = (script: string, env: Record<string, string>, stdin = ""): string => runBashFull(script, env, stdin).out;

const reservedFor = (name: string) => reservedCidrsFor(name).join(" ");

// --------------------------------------------------------------------------
// 1. validators: shell == TypeScript
// --------------------------------------------------------------------------

const HOME: LanFacts = { nodeIp: "192.168.1.74", prefix: 24, gateway: "192.168.1.254" };
const NO_GW = (nodeIp: string, prefix: number): LanFacts => ({ nodeIp, prefix, gateway: "" });

const POOL_CASES: ReadonlyArray<readonly [string, string, string, LanFacts]> = [
  ["valid on the subnet it was written for", "192.168.1.240", "192.168.1.250", HOME],
  ["THE DEFECT: same range, other 192.168 LAN", "192.168.1.240", "192.168.1.250", { nodeIp: "192.168.0.10", prefix: 24, gateway: "192.168.0.1" }],
  ["same range, 10.x LAN", "192.168.1.240", "192.168.1.250", { nodeIp: "10.0.0.5", prefix: 24, gateway: "10.0.0.1" }],
  ["bad first", "192.168.1.999", "192.168.1.250", HOME],
  ["octal-looking first", "192.168.1.010", "192.168.1.250", HOME],
  ["bad last", "192.168.1.240", "nope", HOME],
  ["empty first", "", "192.168.1.250", HOME],
  ["backwards", "192.168.1.250", "192.168.1.240", HOME],
  ["too large", "10.0.0.0", "10.0.255.255", NO_GW("10.0.0.5", 16)],
  ["exactly 256 is allowed", "10.0.1.0", "10.0.1.255", NO_GW("10.0.0.5", 16)],
  ["257 is not", "10.0.1.0", "10.0.2.0", NO_GW("10.0.0.5", 16)],
  ["network address", "192.168.1.0", "192.168.1.10", HOME],
  ["broadcast address", "192.168.1.250", "192.168.1.255", HOME],
  ["contains the node", "192.168.1.70", "192.168.1.80", HOME],
  ["contains the gateway", "192.168.1.250", "192.168.1.254", HOME],
  ["no gateway: the same range is fine", "192.168.1.250", "192.168.1.254", NO_GW("192.168.1.74", 24)],
  ["straddles the subnet edge", "192.168.1.250", "192.168.2.5", HOME],
  ["unusable prefix /31", "192.168.1.240", "192.168.1.250", NO_GW("192.168.1.74", 31)],
  ["unusable prefix /7", "10.0.0.200", "10.0.0.210", NO_GW("10.0.0.5", 7)],
  ["inside zeta's pod CIDR", "10.143.5.240", "10.143.5.250", { nodeIp: "10.143.5.10", prefix: 24, gateway: "10.143.5.1" }],
  ["inside the service CIDR", "10.99.200.240", "10.99.200.250", { nodeIp: "10.99.200.10", prefix: 24, gateway: "10.99.200.1" }],
  ["inside the inter-node segment", "10.88.0.100", "10.88.0.110", NO_GW("10.88.0.7", 24)],
  ["a wider LAN, window elsewhere in it", "172.16.9.240", "172.16.9.250", { nodeIp: "172.16.9.20", prefix: 16, gateway: "172.16.0.1" }],
];

describe("(1) validators: shell == TypeScript", () => {
  for (const [name, a, b, lan] of POOL_CASES) {
    test(name, () => {
      const ts = validateLbPool(a, b, lan, reservedCidrsFor("zeta"));
      const sh = runBash('zeta_lb_pool_validate "$T_A" "$T_B" "$T_NODE" "$T_PREFIX" "$T_GW" "$T_RESERVED"', {
        T_A: a,
        T_B: b,
        T_NODE: lan.nodeIp,
        T_PREFIX: String(lan.prefix),
        T_GW: lan.gateway,
        T_RESERVED: reservedFor("zeta"),
      });
      expect(sh).toBe(ts);
    });
  }

  test("the table is not vacuous: it exercises every verdict", () => {
    const seen = new Set(POOL_CASES.map(([, a, b, lan]) => validateLbPool(a, b, lan, reservedCidrsFor("zeta"))));
    for (const v of [
      "valid", "bad-start", "bad-stop", "reversed", "too-large", "outside-lan",
      "network-or-broadcast", "contains-node", "contains-gateway", "overlaps-reserved",
    ]) {
      expect(seen.has(v as never)).toBe(true);
    }
  });
});

describe("(1) proposal: shell == TypeScript", () => {
  const LANS: ReadonlyArray<LanFacts> = [
    HOME,
    { nodeIp: "10.7.3.20", prefix: 24, gateway: "10.7.3.1" },
    { nodeIp: "172.16.9.20", prefix: 16, gateway: "172.16.0.1" },
    NO_GW("192.168.1.74", 25), // too small
    NO_GW("192.168.1.245", 24), // window contains the node
    NO_GW("10.143.5.10", 24), // window inside the pod CIDR
    NO_GW("bad", 24),
  ];
  for (const lan of LANS) {
    test(`${lan.nodeIp}/${lan.prefix}`, () => {
      const ts = proposeLbPool(lan, reservedCidrsFor("zeta"));
      const sh = runBash('zeta_lb_pool_propose "$T_NODE" "$T_PREFIX" "$T_GW" "$T_RESERVED"', {
        T_NODE: lan.nodeIp,
        T_PREFIX: String(lan.prefix),
        T_GW: lan.gateway,
        T_RESERVED: reservedFor("zeta"),
      });
      expect(sh).toBe(ts === null ? "" : `${ts.start}-${ts.stop}`);
    });
  }
});

// --------------------------------------------------------------------------
// 2. the shell CIDR derivation replays the golden vectors
// --------------------------------------------------------------------------

interface Vector {
  readonly clusterName: string;
  readonly podCidr: string;
  readonly serviceCidr: string;
}
const vectors = (JSON.parse(readFileSync(GOLDEN, "utf8")) as { vectors: Vector[] }).vectors;

describe("(2) zeta_cluster_cidrs replays nixos/tests/cluster-cidr-golden-vectors.json", () => {
  test("the vector file is non-empty (a replay of nothing proves nothing)", () => {
    expect(vectors.length).toBeGreaterThanOrEqual(4);
  });
  for (const v of vectors) {
    test(`${v.clusterName}`, () => {
      expect(runBash('zeta_cluster_cidrs "$T_NAME"', { T_NAME: v.clusterName })).toBe(`${v.podCidr} ${v.serviceCidr}`);
    });
  }
  test("and agrees with the TypeScript derivation for names the vectors do not list", () => {
    for (const name of ["a", "x9", "my-home-lab", "node-0123456789abcdef0123456789a"]) {
      const net = deriveClusterNetwork(name);
      if (!net.ok) throw new Error(`${name} must derive`);
      expect(runBash('zeta_cluster_cidrs "$T_NAME"', { T_NAME: name })).toBe(`${net.value.podCidr} ${net.value.serviceCidr}`);
    }
  });
  test("a name Cilium would refuse derives nothing", () => {
    for (const bad of ["", "Upper", "-lead", "trail-", "has space", "a".repeat(33)]) {
      expect(runBash('zeta_cluster_cidrs "$T_NAME"', { T_NAME: bad })).toBe("");
    }
  });
  test("the cluster identity is readable from the real file the ISO ships", () => {
    expect(runBash('zeta_cluster_name_from_identity "$T_FILE"', { T_FILE: fwd(IDENTITY) })).toBe("zeta");
    expect(runBash('zeta_cluster_name_from_identity "/nonexistent/identity.json"', {})).toBe("");
  });
});

// --------------------------------------------------------------------------
// collisions: shell == TypeScript
// --------------------------------------------------------------------------

describe("(2) address-space collisions: shell == TypeScript", () => {
  const CASES: ReadonlyArray<readonly [string, string[]]> = [
    ["zeta", ["192.168.1.0/24", "192.168.0.0/16", "172.17.0.0/16"]],
    ["zeta", ["10.143.100.0/24"]],
    ["zeta", ["10.128.0.0/9"]],
    ["zeta", ["10.0.0.0/8"]],
    ["zeta", ["10.99.200.0/24", "10.88.0.0/24"]],
    ["zeta-home", ["10.143.100.0/24"]],
    ["zeta-home", ["10.228.130.0/24", "192.168.1.0/24"]],
    ["Not A Valid Name", ["10.143.100.0/24", "10.88.0.0/24"]],
  ];
  for (const [name, hosts] of CASES) {
    test(`${name} vs ${hosts.join(",")}`, () => {
      const ts = hostNetworkCollisions(hosts, name).map((c) => `${c.host} ${c.against} ${c.cidr}`);
      const sh = runBash('printf "%s\\n" $T_HOSTS | zeta_cidr_collisions "$T_NAME"', {
        T_NAME: name,
        T_HOSTS: hosts.join(" "),
      });
      expect(sh === "" ? [] : sh.split("\n")).toEqual(ts);
    });
  }

  test("THE DEFECT: with no check, a 10.x site LAN inside the pod CIDR installs silently; here it is a finding", () => {
    const out = runBash('printf "10.143.100.0/24\\n" | zeta_cidr_collisions zeta', {});
    expect(out).toBe("10.143.100.0/24 pod 10.143.0.0/17");
  });
});

// --------------------------------------------------------------------------
// LAN measurement parsing
// --------------------------------------------------------------------------

describe("(2) LAN measurement parses what `ip` prints", () => {
  const ROUTE_VIA =
    "1.1.1.1 via 192.168.1.254 dev enp172s0 src 192.168.1.74 uid 1000 \\    cache";
  const ROUTE_ONLINK = "1.1.1.1 dev eth0 src 10.9.8.7 uid 0 \\    cache";
  const ADDR = "2: enp172s0    inet 192.168.1.74/24 brd 192.168.1.255 scope global dynamic noprefixroute enp172s0\\       valid_lft 85000sec";

  test("a routed default: device, source, gateway", () => {
    const out = runBash('zeta_lan_parse_route "$T_LINE"; echo "$ZETA_LAN_DEV|$ZETA_LAN_SRC|$ZETA_LAN_GW"', { T_LINE: ROUTE_VIA });
    expect(out).toBe("enp172s0|192.168.1.74|192.168.1.254");
  });
  test("an on-link default has no gateway", () => {
    const out = runBash('zeta_lan_parse_route "$T_LINE"; echo "$ZETA_LAN_DEV|$ZETA_LAN_SRC|$ZETA_LAN_GW"', { T_LINE: ROUTE_ONLINK });
    expect(out).toBe("eth0|10.9.8.7|");
  });
  test("the prefix is read for THE node's address, not another one on the interface", () => {
    const two = `${ADDR}\n2: enp172s0    inet 10.0.0.9/8 brd 10.255.255.255 scope global enp172s0`;
    expect(runBash('zeta_lan_prefix_from_addr "$T_ADDR" 192.168.1.74', { T_ADDR: two })).toBe("24");
    expect(runBash('zeta_lan_prefix_from_addr "$T_ADDR" 10.0.0.9', { T_ADDR: two })).toBe("8");
    expect(runBash('zeta_lan_prefix_from_addr "$T_ADDR" 172.16.0.1', { T_ADDR: two })).toBe("");
  });
  test("zeta_lan_detect composes them through `ip`; an unreadable LAN is ZETA_LAN_OK=0, never a guess", () => {
    const ok = runBash(
      `ip() {
         case "$*" in
           *"route get"*) echo "$T_ROUTE" ;;
           *"addr show"*) echo "$T_ADDR" ;;
         esac
       }
       zeta_lan_detect; echo "$ZETA_LAN_OK|$ZETA_LAN_SRC|$ZETA_LAN_PREFIX|$ZETA_LAN_GW"`,
      { T_ROUTE: ROUTE_VIA, T_ADDR: ADDR },
    );
    expect(ok).toBe("1|192.168.1.74|24|192.168.1.254");
    const none = runBash(`ip() { return 0; }\nzeta_lan_detect; echo "$ZETA_LAN_OK"`, {});
    expect(none).toBe("0");
    const noPrefix = runBash(
      `ip() { case "$*" in *"route get"*) echo "$T_ROUTE" ;; *) ;; esac; }\nzeta_lan_detect; echo "$ZETA_LAN_OK"`,
      { T_ROUTE: ROUTE_VIA },
    );
    expect(noPrefix).toBe("0");
  });
});

// --------------------------------------------------------------------------
// 3. resolution order
// --------------------------------------------------------------------------

const LAN_ENV = {
  ZETA_LAN_OK: "1",
  ZETA_LAN_SRC: "192.168.1.74",
  ZETA_LAN_PREFIX: "24",
  ZETA_LAN_GW: "192.168.1.254",
  ZETA_LAN_DEV: "enp172s0",
  ZETA_LB_RESERVED_CIDRS: reservedFor("zeta"),
};
const RESOLVE =
  'export ZETA_LAN_OK ZETA_LAN_SRC ZETA_LAN_PREFIX ZETA_LAN_GW ZETA_LAN_DEV ZETA_LB_RESERVED_CIDRS\n' +
  'zeta_lb_pool_resolve "$T_MODE"; echo "RESULT=${ZETA_LB_POOL_SOURCE}|${ZETA_LB_POOL_START}|${ZETA_LB_POOL_STOP}"';
function resolveWith(mode: string, env: Record<string, string>, stdin = ""): string {
  const out = runBash(RESOLVE, { T_MODE: mode, ...LAN_ENV, ...env }, stdin);
  const line = out.split("\n").find((l) => l.startsWith("RESULT="));
  if (line === undefined) throw new Error(`no RESULT line in: ${out}`);
  return line.slice("RESULT=".length);
}

describe("(3) resolution order: ESP -> prompt -> UNSET", () => {
  test("1. a valid ESP range wins and nothing is asked (stdin is not read)", () => {
    expect(resolveWith("ask", { ZETA_LB_POOL: "192.168.1.200-192.168.1.210" }, "192.168.1.100-192.168.1.110\n")).toBe(
      "esp|192.168.1.200|192.168.1.210",
    );
  });

  test("1. ESP `auto` derives the proposal from the measured LAN", () => {
    expect(resolveWith("none", { ZETA_LB_POOL: "auto" })).toBe("esp|192.168.1.240|192.168.1.250");
    expect(
      resolveWith("none", { ZETA_LB_POOL: "auto", ZETA_LAN_SRC: "10.7.3.20", ZETA_LAN_GW: "10.7.3.1" }),
    ).toBe("esp|10.7.3.240|10.7.3.250");
  });

  test("THE DEFECT: the old hardcoded range on ANOTHER LAN is REFUSED non-interactively - the install stops, nothing is applied", () => {
    const other = { ZETA_LAN_SRC: "10.0.0.5", ZETA_LAN_GW: "10.0.0.1", ZETA_LB_POOL: "192.168.1.240-192.168.1.250" };
    expect(resolveWith("none", other)).toBe("refused||");
    expect(resolveWith("gate:1", other)).toBe("refused||");
  });

  test("an ESP range that cannot work is refused; interactively it falls through to the prompt", () => {
    const other = { ZETA_LAN_SRC: "10.0.0.5", ZETA_LAN_GW: "10.0.0.1", ZETA_LB_POOL: "192.168.1.240-192.168.1.250" };
    expect(resolveWith("ask", other, "10.0.0.200-10.0.0.210\n")).toBe("prompt|10.0.0.200|10.0.0.210");
  });

  test("an ESP `auto` with no clear window is refused, not guessed", () => {
    expect(resolveWith("none", { ZETA_LB_POOL: "auto", ZETA_LAN_PREFIX: "25" })).toBe("refused||");
  });

  test("a malformed ESP value is refused", () => {
    expect(resolveWith("none", { ZETA_LB_POOL: "$(id)" })).toBe("refused||");
    expect(resolveWith("none", { ZETA_LB_POOL: "192.168.1.240" })).toBe("refused||");
  });

  test("addresses that already answer on the LAN are refused, not applied", () => {
    expect(resolveWith("none", { ZETA_LB_POOL: "192.168.1.200-192.168.1.210", FAKE_PING_UP: "192.168.1.205" })).toBe("refused||");
    expect(resolveWith("none", { ZETA_LB_POOL: "auto", FAKE_PING_UP: "192.168.1.241 192.168.1.99" })).toBe("refused||");
  });

  test("an address outside the range answering is irrelevant", () => {
    expect(resolveWith("none", { ZETA_LB_POOL: "192.168.1.200-192.168.1.210", FAKE_PING_UP: "192.168.1.99" })).toBe(
      "esp|192.168.1.200|192.168.1.210",
    );
  });

  test("2. no ESP value -> 'y' accepts the PROPOSAL; it is never applied unasked", () => {
    expect(resolveWith("ask", {}, "y\n")).toBe("prompt|192.168.1.240|192.168.1.250");
    // and nothing typed means nothing applied
    expect(resolveWith("ask", {}, "")).toBe("unset||");
  });

  test("2. a typed range is validated against the LAN and re-asked until it fits", () => {
    const stdin = "192.168.9.1-192.168.9.9\nnonsense\n192.168.1.250-192.168.1.240\n192.168.1.100-192.168.1.110\n";
    expect(resolveWith("ask", {}, stdin)).toBe("prompt|192.168.1.100|192.168.1.110");
  });

  test("2. a typed range containing this node is refused", () => {
    expect(resolveWith("ask", {}, "192.168.1.70-192.168.1.80\n\n")).toBe("unset||");
  });

  test("2. a busy proposal is NOT offered: answering 'y' to nothing leaves it UNSET", () => {
    expect(resolveWith("ask", { FAKE_PING_UP: "192.168.1.245" }, "y\n")).toBe("unset||");
  });

  test("3. Enter / none / EOF -> UNSET, not a default; and the loop terminates", () => {
    expect(resolveWith("ask", {}, "\n")).toBe("unset||");
    expect(resolveWith("ask", {}, "none\n")).toBe("unset||");
    expect(resolveWith("ask", {}, "bad\nbad\nbad\nbad\nbad\nbad\nbad\n")).toBe("unset||");
  });

  test("3. non-interactive with no ESP value -> UNSET without reading stdin (and NOT 'refused': nothing was wrong)", () => {
    expect(resolveWith("none", {}, "192.168.1.100-192.168.1.110\n")).toBe("unset||");
  });

  test("gate mode: no 'l' within the window -> UNSET; 'l' opens the prompt", () => {
    expect(resolveWith("gate:1", {}, "x")).toBe("unset||");
    expect(resolveWith("gate:1", {}, "ly\n")).toBe("prompt|192.168.1.240|192.168.1.250");
  });

  test("with the LAN UNREADABLE: an explicit range is accepted (shape only) with a warning; `auto` is refused", () => {
    const blind = { ZETA_LAN_OK: "0" };
    expect(resolveWith("none", { ...blind, ZETA_LB_POOL: "192.168.1.200-192.168.1.210" })).toBe("esp|192.168.1.200|192.168.1.210");
    expect(resolveWith("none", { ...blind, ZETA_LB_POOL: "auto" })).toBe("refused||");
    expect(resolveWith("none", { ...blind, ZETA_LB_POOL: "192.168.1.210-192.168.1.200" })).toBe("refused||");
  });

  test("a probe that cannot run is reported as such and is NOT a pass", () => {
    // `ping` that cannot even reach loopback (no raw-socket permission): every address
    // would look free. The block must say the probe DID NOT RUN rather than stay silent.
    const r = runBashFull(
      `ping() { return 1; }
       ${RESOLVE}`,
      { T_MODE: "none", ...LAN_ENV, ZETA_LB_POOL: "192.168.1.200-192.168.1.210" },
    );
    expect(r.out).toContain("RESULT=esp|192.168.1.200|192.168.1.210");
    expect(r.err).toContain("DID NOT RUN");
    expect(r.err).toContain("NOT a check that passed");
    // and the working-ping case says nothing of the sort
    const ok = runBashFull(RESOLVE, { T_MODE: "none", ...LAN_ENV, ZETA_LB_POOL: "192.168.1.200-192.168.1.210" });
    expect(ok.err).not.toContain("DID NOT RUN");
  });
});

// --------------------------------------------------------------------------
// 4. call-site wiring in the real scripts
// --------------------------------------------------------------------------

describe("(4) call-site wiring in the real scripts", () => {
  test("measure + collision check + resolver all run BEFORE disk enumeration, while refusing is free", () => {
    const detect = SRC.indexOf("zeta_lan_detect\nif [");
    const resolver = SRC.indexOf('zeta_lb_pool_resolve "$ZETA_LB_POOL_MODE"');
    const collisions = SRC.indexOf("ZETA_LAN_COLLISIONS=");
    expect(detect).toBeGreaterThan(SRC.indexOf(END));
    expect(collisions).toBeGreaterThan(detect);
    expect(resolver).toBeGreaterThan(collisions);
    const step1 = SRC.indexOf("# ── Step 1: enumerate internal disks");
    expect(resolver).toBeLessThan(step1);
    const wipe = SRC.indexOf("# ── Step 3: wipe every disk in scope");
    expect(wipe).toBeGreaterThan(step1);
    expect(collisions).toBeLessThan(wipe);
  });

  test("a collision REFUSES the install unless the operator names the override", () => {
    expect(SRC).toContain('bail "this node can already route to a network that overlaps the cluster');
    expect(SRC).toContain("ZETA_ALLOW_CIDR_OVERLAP");
    expect(SRC).toMatch(/Nothing has been wiped\."\n\s*fi\nelse\n\s*echo "\[lan\] no overlap/);
  });

  test("a refused ESP pool REFUSES the install before the wipe", () => {
    expect(SRC).toMatch(/refused\)\n\s*bail "the ESP asked for a LoadBalancer range that cannot work/);
  });

  test("a joiner never asks and never applies an ESP pool (the range is the founder's)", () => {
    expect(SRC).toContain('if [[ "${ZETA_ROLE:-}" == "joiner" ]]; then\n  ZETA_LB_POOL_MODE="none"\n  ZETA_LB_POOL=""');
  });

  test("the pool is written to /mnt/etc/zeta and symlinked for flake eval BEFORE nixos-install", () => {
    const install = SRC.indexOf("Running nixos-install --flake");
    const write = SRC.indexOf("/mnt/etc/zeta/lb-pool");
    const link = SRC.indexOf("maybe_symlink /mnt/etc/zeta/lb-pool /etc/zeta/lb-pool");
    expect(write).toBeGreaterThan(0);
    expect(link).toBeGreaterThan(0);
    expect(write).toBeLessThan(install);
    expect(link).toBeLessThan(install);
  });

  test("the written value is re-validated (shape) before it is written", () => {
    const write = SRC.indexOf("printf '%s-%s\\n' \"$ZETA_LB_POOL_START\"");
    const check = SRC.indexOf('zeta_lb_pool_shape "$ZETA_LB_POOL_START" "$ZETA_LB_POOL_STOP"');
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(write);
  });

  test("after the clone the collision is re-checked against the tree that is actually installed", () => {
    const pin = SRC.indexOf('echo "[repo-pin] outcome=${REPO_PIN_OUTCOME}');
    const recheck = SRC.indexOf("ZETA_CLONED_CLUSTER_NAME=");
    const nixosInstall = SRC.indexOf("Running nixos-install --flake");
    expect(recheck).toBeGreaterThan(pin);
    expect(recheck).toBeLessThan(nixosInstall);
  });

  test("zeta-first-boot.sh EXPORTS the ESP-sourced value and the override (a sourced var never reaches the child)", () => {
    const fb = readFileSync(FIRST_BOOT_SH, "utf8");
    expect(fb).toMatch(/export ZETA_LB_POOL="\$\{ZETA_LB_POOL:-\}"/);
    expect(fb).toMatch(/export ZETA_ALLOW_CIDR_OVERLAP="\$\{ZETA_ALLOW_CIDR_OVERLAP:-\}"/);
  });

  test("the override is never baked into the ISO's own conf (that would clear the guard for every install)", () => {
    const iso = readFileSync(ISO_CONFIG, "utf8");
    const conf = iso.slice(iso.indexOf('environment.etc."zeta-firstboot.conf".text'));
    expect(conf.slice(0, conf.indexOf("'';"))).not.toContain("ZETA_ALLOW_CIDR_OVERLAP");
  });

  test("the ISO ships the cluster identity the pre-wipe check reads", () => {
    const iso = readFileSync(ISO_CONFIG, "utf8");
    expect(iso).toContain('environment.etc."zeta-cluster-identity.json".source = ../../../cluster-identity.json;');
    expect(SRC).toContain('ZETA_CLUSTER_IDENTITY_FILE="${ZETA_CLUSTER_IDENTITY_FILE:-/etc/zeta-cluster-identity.json}"');
  });

  test("the completion banner says which range was applied, or that none was", () => {
    const banner = SRC.slice(SRC.indexOf("ZETA CLUSTER NODE INSTALL COMPLETE"));
    expect(banner).toContain("LOADBALANCER RANGE: ${ZETA_LB_POOL_START}");
    expect(banner).toContain("LOADBALANCER RANGE: NOT SET");
  });
});
