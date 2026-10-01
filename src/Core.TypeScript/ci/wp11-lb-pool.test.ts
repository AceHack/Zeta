/**
 * wp11-lb-pool.test.ts - the WP11 installed-disk lane stages a Cilium LoadBalancer range.
 *
 * THE DEFECT (run 36832486494): a QEMU user-mode (SLIRP) guest is given no
 * CiliumLoadBalancerIPPool, so every Service of type LoadBalancer stays <pending> and every
 * Gateway reports Programmed!=True, which ArgoCD reports as Progressing forever for the apps
 * that own them (the `platform` Application's `zeta-gateway`). A real install supplies a range
 * (docs/ops/INSTALL-TIME-CONFIG.md row 3); the lane now stages one on the ESP the same way.
 *
 * WHAT THESE TESTS PIN, AND WHY EACH CAN FAIL:
 *  (a) the lane's range reaches `/zeta-firstboot.conf` as a ZETA_LB_POOL line, through the same
 *      planner a real `zflash --lb-pool` uses;
 *  (b) the range is ACCEPTED by the installer's own shell validator for the SLIRP LAN
 *      (node 10.0.2.15/24, gateway 10.0.2.2) - a range the installer would REFUSE would fail phase
 *      1 outright, a 90-minute lane found out the slow way;
 *  (c) "did this lane stage a conf" is DERIVED from the bake, so the WP27 read-back contract
 *      cannot go dormant again behind a hardcoded `false`;
 *  (d) the guest's `lbPool` note is judged three ways, never two.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  LB_POOL_AUTO,
  planLbPool,
  renderLbPoolConfLine,
  reservedCidrsFor,
  validateLbPool,
} from "../installer/lan-config.ts";
import { planFileBackedZflashImage } from "../zflash/lib.ts";
import { stagesEspFirstbootConf } from "../zflash/test-harness/prepare-boot-image.ts";
import {
  evaluateLbPoolNote,
  laneLbPool,
  SLIRP_LAN,
  summarizeK3sFirstBootVerifyVerdict,
  WP11_LB_POOL_SPEC,
  WP11_LB_POOL_START,
  WP11_LB_POOL_STOP,
  type K3sFirstBootVerifyLbPool,
  type K3sFirstBootVerifyVerdict,
} from "./qemu-full-install-test.ts";

const HERE = import.meta.dir;
const REPO = resolve(HERE, "../../..");
const LANE_SRC = readFileSync(resolve(HERE, "qemu-full-install-test.ts"), "utf8");
const PREPARE_SRC = readFileSync(resolve(HERE, "../zflash/test-harness/prepare-boot-image.ts"), "utf8");
const INSTALL_SH = readFileSync(resolve(REPO, "full-ai-cluster/usb-nixos-installer/zeta-install.sh"), "utf8");
const IDENTITY = JSON.parse(readFileSync(resolve(REPO, "full-ai-cluster/cluster-identity.json"), "utf8")) as {
  clusterName: string;
};

const RANGE = `${WP11_LB_POOL_START}-${WP11_LB_POOL_STOP}`;
const base = {
  isoPath: "/tmp/installer.iso",
  outputImagePath: "/tmp/out.img",
  espOffsetBytes: 141_312,
  pubkeyPath: "/tmp/id.pub",
} as const;

// --------------------------------------------------------------------------
// (a) the lane stages the range, through the real planner
// --------------------------------------------------------------------------

describe("(a) the WP11 lane stages its LoadBalancer range on the ESP conf", () => {
  test("the WP11 lane asks for a range; a lane that never reaches a cluster does not", () => {
    expect(laneLbPool(true)).toEqual(WP11_LB_POOL_SPEC);
    expect(laneLbPool(false)).toBeUndefined();
  });

  test("the range is an explicit range, never `auto` (auto REFUSES when the installer cannot read the LAN)", () => {
    expect(WP11_LB_POOL_SPEC.kind).toBe("range");
    expect(JSON.stringify(WP11_LB_POOL_SPEC)).not.toContain(LB_POOL_AUTO);
  });

  test("the planner the bake uses accepts it and renders the SAME spec back", () => {
    const planned = planLbPool(RANGE);
    expect(planned).toEqual({ ok: true, value: WP11_LB_POOL_SPEC });
  });

  test("the staged ESP /zeta-firstboot.conf carries ZETA_LB_POOL for exactly that range", () => {
    const lbPool = laneLbPool(true);
    if (lbPool === undefined) throw new Error("the WP11 lane must stage a range");
    const plan = planFileBackedZflashImage({ ...base, lbPool });
    if (!plan.ok) throw new Error(plan.error);
    const conf = plan.value.espWrites.find((w) => w.destination === "/zeta-firstboot.conf");
    expect(conf?.content).toContain("ZETA_LB_POOL=");
    expect(conf?.content).toBe(renderLbPoolConfLine(WP11_LB_POOL_SPEC));
    expect(conf?.content).toBe(`ZETA_LB_POOL='${RANGE}'\n`);
  });

  test("the lane's bake call hands the range to prepareBootImage, and prepareBootImage hands it to the bake", () => {
    // Two static checks, because a real bake needs an ISO and mtools. They are the weak half and
    // say so: they pin that the value is WIRED, not that it arrived in a guest (that is the
    // esp-conf= contract and the guest's lb-pool: note).
    expect(LANE_SRC).toContain("...(laneLbPoolSpec === undefined ? {} : { lbPool: laneLbPoolSpec })");
    expect(PREPARE_SRC).toContain("...(input.lbPool === undefined ? {} : { lbPool: input.lbPool })");
  });
});

// --------------------------------------------------------------------------
// (b) the installer's OWN validator accepts it on the SLIRP LAN
// --------------------------------------------------------------------------

const workdir = mkdtempSync(join(tmpdir(), "zeta-wp11-lb-pool-"));
const fwd = (p: string) => p.replaceAll("\\", "/");

function lbPoolBlock(): string {
  const b = INSTALL_SH.indexOf("# ZETA-LB-POOL-BEGIN");
  const e = INSTALL_SH.indexOf("# ZETA-LB-POOL-END");
  if (b < 0 || e < b) throw new Error("ZETA-LB-POOL markers missing/out of order in zeta-install.sh");
  return INSTALL_SH.slice(b, e + "# ZETA-LB-POOL-END".length);
}
const blockPath = fwd(join(workdir, "block.sh"));
writeFileSync(blockPath, `${lbPoolBlock()}\n`, "utf8");

/** `ping` that answers only for loopback and $FAKE_PING_UP: SLIRP answers nothing in .240-.250. */
const FAKES = `
ping() {
  local last
  for last in "$@"; do :; done
  if [ "$last" = "127.0.0.1" ]; then return 0; fi
  case " \${FAKE_PING_UP:-} " in *" $last "*) return 0 ;; esac
  return 1
}
`;

function bash(script: string, env: Record<string, string> = {}): string {
  const runner = join(workdir, "runner.sh");
  writeFileSync(runner, `set -uo pipefail\n${FAKES}\nsource ${blockPath}\n${script}\n`, "utf8");
  const r = spawnSync("bash", [fwd(runner)], { encoding: "utf8", env: { ...process.env, ZETA_LB_POOL: "", FAKE_PING_UP: "", ...env } });
  if (r.status !== 0) throw new Error(`bash exited ${String(r.status)}: ${String(r.stderr)}`);
  return String(r.stdout).trim();
}

/** Exactly what zeta-install.sh builds for ZETA_LB_RESERVED_CIDRS once it has read the identity file. */
const SHELL_RESERVED =
  'printf "%s %s" "$(zeta_cluster_cidrs "$T_NAME")" "$ZETA_CLUSTER_SEGMENT_CIDR"';

describe("(b) the staged range passes the installer's own validator on the SLIRP LAN", () => {
  const lan = { nodeIp: SLIRP_LAN.nodeIp, prefix: SLIRP_LAN.prefix, gateway: SLIRP_LAN.gateway };

  test("the SLIRP LAN facts are the ones QEMU's default user netdev hands out", () => {
    // 10.0.2.0/24: guest 10.0.2.15 (first DHCP lease), host/gateway 10.0.2.2, DNS 10.0.2.3.
    expect(lan).toEqual({ nodeIp: "10.0.2.15", prefix: 24, gateway: "10.0.2.2" });
    expect(LANE_SRC).toContain("user,id=net0");
    expect(LANE_SRC).not.toMatch(/user,id=net0,[^"]*net=/u);
  });

  test("shell zeta_lb_pool_validate says `valid` (what the installer runs before it wipes anything)", () => {
    const verdict = bash(
      `reserved="$(${SHELL_RESERVED})"; zeta_lb_pool_validate "$T_A" "$T_B" "$T_NODE" "$T_PREFIX" "$T_GW" "$reserved"`,
      {
        T_NAME: IDENTITY.clusterName,
        T_A: WP11_LB_POOL_START,
        T_B: WP11_LB_POOL_STOP,
        T_NODE: lan.nodeIp,
        T_PREFIX: String(lan.prefix),
        T_GW: lan.gateway,
      },
    );
    expect(verdict).toBe("valid");
  });

  test("the TypeScript twin agrees, against the cluster's REAL derived pod/service CIDRs", () => {
    const reserved = reservedCidrsFor(IDENTITY.clusterName);
    // The reserved list must really be the derived blocks - an empty list would make `valid` free.
    expect(reserved.length).toBe(3);
    expect(validateLbPool(WP11_LB_POOL_START, WP11_LB_POOL_STOP, lan, reserved)).toBe("valid");
  });

  test("zeta_lb_pool_resolve ACCEPTS it from the ESP conf non-interactively, with nothing on the LAN answering", () => {
    const out = bash(
      `export ZETA_LAN_OK ZETA_LAN_SRC ZETA_LAN_PREFIX ZETA_LAN_GW ZETA_LB_RESERVED_CIDRS ZETA_LB_POOL
       ZETA_LB_RESERVED_CIDRS="$(${SHELL_RESERVED})"
       zeta_lb_pool_resolve none
       echo "RESULT=\${ZETA_LB_POOL_SOURCE}|\${ZETA_LB_POOL_START}|\${ZETA_LB_POOL_STOP}"`,
      {
        T_NAME: IDENTITY.clusterName,
        ZETA_LAN_OK: "1",
        ZETA_LAN_SRC: lan.nodeIp,
        ZETA_LAN_PREFIX: String(lan.prefix),
        ZETA_LAN_GW: lan.gateway,
        ZETA_LB_POOL: RANGE,
      },
    );
    expect(out.split("\n").find((l) => l.startsWith("RESULT="))).toBe(
      `RESULT=esp|${WP11_LB_POOL_START}|${WP11_LB_POOL_STOP}`,
    );
  });

  test("NOT VACUOUS: the same harness REFUSES ranges that collide with the SLIRP guest, gateway, DNS neighbour or the inter-node segment", () => {
    const verdictFor = (a: string, b: string): string =>
      bash(
        `reserved="$(${SHELL_RESERVED})"; zeta_lb_pool_validate "$T_A" "$T_B" 10.0.2.15 24 10.0.2.2 "$reserved"`,
        { T_NAME: IDENTITY.clusterName, T_A: a, T_B: b },
      );
    expect(verdictFor("10.0.2.10", "10.0.2.20")).toBe("contains-node");
    expect(verdictFor("10.0.2.1", "10.0.2.4")).toBe("contains-gateway");
    expect(verdictFor("10.0.2.250", "10.0.2.255")).toBe("network-or-broadcast");
    expect(verdictFor("10.0.3.240", "10.0.3.250")).toBe("outside-lan");
    expect(verdictFor("10.88.0.240", "10.88.0.250")).toBe("outside-lan");
  });

  test("the range stays clear of every special SLIRP address (.2 gateway, .3 DNS, .4 smb/tftp, .15 guest)", () => {
    const first = Number.parseInt(WP11_LB_POOL_START.split(".")[3] ?? "", 10);
    const last = Number.parseInt(WP11_LB_POOL_STOP.split(".")[3] ?? "", 10);
    for (const special of [2, 3, 4, 15]) {
      expect(special < first || special > last).toBe(true);
    }
  });
});

// --------------------------------------------------------------------------
// (c) stagedEspFirstbootConf is derived, not hardcoded
// --------------------------------------------------------------------------

describe("(c) 'this lane staged a conf' is derived from the bake", () => {
  test("false when nothing is staged, true once a range is", () => {
    expect(stagesEspFirstbootConf({})).toBe(false);
    expect(stagesEspFirstbootConf({ lbPool: WP11_LB_POOL_SPEC })).toBe(true);
    expect(stagesEspFirstbootConf({ allowLonghornUndersized: true })).toBe(true);
    expect(stagesEspFirstbootConf({ firstbootRole: { kind: "first-control-plane" } })).toBe(true);
    // `false` is "not asked for", not "asked for".
    expect(stagesEspFirstbootConf({ allowLonghornUndersized: false })).toBe(false);
  });

  test("agrees with what the planner REALLY writes, so a new conf-writing input cannot hide", () => {
    const roles = [undefined, { kind: "first-control-plane" } as const];
    const pools = [undefined, WP11_LB_POOL_SPEC];
    const longhorn = [false, true];
    for (const firstbootRole of roles) {
      for (const lbPool of pools) {
        for (const allowLonghornUndersized of longhorn) {
          const asked = {
            ...(firstbootRole === undefined ? {} : { firstbootRole }),
            ...(lbPool === undefined ? {} : { lbPool }),
            ...(allowLonghornUndersized ? { allowLonghornUndersized } : {}),
          };
          const plan = planFileBackedZflashImage({ ...base, ...asked });
          if (!plan.ok) throw new Error(plan.error);
          const wroteConf = plan.value.espWrites.some((w) => w.destination === "/zeta-firstboot.conf");
          expect(stagesEspFirstbootConf(asked)).toBe(wroteConf);
        }
      }
    }
  });

  test("the lane reads it off the bake's result and no longer hardcodes false", () => {
    expect(LANE_SRC).not.toMatch(/const stagedEspFirstbootConf = false/u);
    expect(LANE_SRC).toContain("stagedEspFirstbootConf = prepared.espFirstbootConfStaged;");
    expect(PREPARE_SRC).toContain("espFirstbootConfStaged: stagesEspFirstbootConf(input)");
  });

  test("the contract is no longer described as dormant where the lane runs it", () => {
    expect(LANE_SRC).not.toContain("DORMANT AS OF THIS COMMIT");
    expect(LANE_SRC).not.toContain("conf contract DORMANT");
  });
});

// --------------------------------------------------------------------------
// (d) the guest's note: three outcomes, never two
// --------------------------------------------------------------------------

const OK_NOTE: K3sFirstBootVerifyLbPool = {
  state: "ok",
  detail: "Application cilium-lb-ipam-pool exists and CiliumLoadBalancerIPPool zeta-lb-pool lists the range",
  expected: RANGE,
  application: "present",
  pool: "present",
  blocks: RANGE,
};

describe("(d) the guest's lbPool note", () => {
  test("PASS only when the installed disk AND the live pool carry exactly the staged range", () => {
    const r = evaluateLbPoolNote(OK_NOTE, RANGE);
    expect(r.failed).toBe(false);
    expect(r.line).toContain("PASS");
  });

  test("UNKNOWN when the API could not be asked: neither a pass nor a failure", () => {
    const r = evaluateLbPoolNote(
      { ...OK_NOTE, state: "unknown", application: "unknown", pool: "unknown", blocks: "", detail: "the API could not be asked" },
      RANGE,
    );
    expect(r.failed).toBe(false);
    expect(r.line).toContain("UNKNOWN");
    expect(r.line).not.toContain("PASS");
  });

  test("FAIL when the API answered and the object is absent", () => {
    const r = evaluateLbPoolNote(
      { ...OK_NOTE, state: "fail", application: "absent", blocks: "", detail: "the API answered and Application cilium-lb-ipam-pool does not exist" },
      RANGE,
    );
    expect(r.failed).toBe(true);
    expect(r.line).toContain("FAIL");
  });

  test("FAIL when the range staged on the ESP never reached the installed disk", () => {
    const r = evaluateLbPoolNote(
      { ...OK_NOTE, state: "not-configured", expected: "", application: "unknown", pool: "unknown", blocks: "", detail: "no /etc/zeta/lb-pool" },
      RANGE,
    );
    expect(r.failed).toBe(true);
    expect(r.line).toContain("lost between the ESP and the installed system");
  });

  test("FAIL when the cluster holds a DIFFERENT range than the lane staged, even if the guest called it ok", () => {
    const r = evaluateLbPoolNote({ ...OK_NOTE, expected: "10.0.2.100-10.0.2.110", blocks: "10.0.2.100-10.0.2.110" }, RANGE);
    expect(r.failed).toBe(true);
  });

  test("no key at all is REPORTED, never read as a pass", () => {
    const r = evaluateLbPoolNote(undefined, RANGE);
    expect(r.failed).toBe(false);
    expect(r.line).toContain("NOT REPORTED");
    expect(r.line).toContain("not a pass");
  });
});

describe("(d) the note reaches the verdict summary and gates it", () => {
  const passing: K3sFirstBootVerifyVerdict = {
    bootedMultiUser: { ok: true, elapsedSeconds: 1 },
    k3sServiceActive: { ok: true, elapsedSeconds: 2 },
    nodeReady: { ok: true, elapsedSeconds: 3 },
    helmJobs: { jobs: [], elapsedSeconds: 4 },
    rootLanded: { ok: true, verdict: "ROOT_LANDED", elapsedSeconds: 5 },
    noBadPods: { ok: true, pods: [], elapsedSeconds: 6 },
    rosterConverged: {
      ok: true,
      apps: [],
      elapsedSeconds: 7,
      appCount: 3,
      convergedCount: 3,
      unconvergedCount: 0,
      excludedCount: 0,
      undecidableCount: 0,
      unattributedPodCount: 0,
      samples: 1,
      rootSyncStatus: "Synced",
      k3sActive: true,
    },
    lbPool: OK_NOTE,
  };

  test("a passing note keeps the verdict green and prints its line", () => {
    const s = summarizeK3sFirstBootVerifyVerdict(passing);
    expect(s.ok).toBe(true);
    expect(s.lines.join("\n")).toContain("8. lbPool (note): PASS");
  });

  test("a FAIL note turns an otherwise green verdict red", () => {
    const s = summarizeK3sFirstBootVerifyVerdict({
      ...passing,
      lbPool: { ...OK_NOTE, state: "fail", pool: "absent", blocks: "", detail: "the API answered and CiliumLoadBalancerIPPool zeta-lb-pool does not exist" },
    });
    expect(s.ok).toBe(false);
    expect(s.lines.join("\n")).toContain("8. lbPool (note): FAIL");
  });

  test("an UNKNOWN note does NOT turn a green verdict red, and is not printed as a pass", () => {
    const s = summarizeK3sFirstBootVerifyVerdict({
      ...passing,
      lbPool: { ...OK_NOTE, state: "unknown", application: "unknown", pool: "unknown", blocks: "", detail: "api unreachable" },
    });
    expect(s.ok).toBe(true);
    expect(s.lines.join("\n")).toContain("8. lbPool (note): UNKNOWN");
  });

  test("verdict JSON predating the note still parses and still passes", () => {
    const { lbPool: _omitted, ...older } = passing;
    const s = summarizeK3sFirstBootVerifyVerdict(older);
    expect(s.ok).toBe(true);
    expect(s.lines.join("\n")).toContain("NOT REPORTED");
  });
});

describe("(d) the guest's JSON keys are the ones the host reads", () => {
  const nix = readFileSync(resolve(REPO, "full-ai-cluster/nixos/modules/zeta-first-boot-k3s-verify.nix"), "utf8");

  test("lbPool: {state, detail, expected, application, pool, blocks} is emitted by the unit", () => {
    expect(nix).toContain(
      "lbPool: {state: $lbPoolState, detail: $lbPoolDetail, expected: $lbPoolExpected, application: $lbPoolApplication, pool: $lbPoolPool, blocks: $lbPoolBlocks}",
    );
  });

  test("the unit looks for the exact objects injected-lb-pool.nix and the template create", () => {
    expect(nix).toContain("application cilium-lb-ipam-pool");
    expect(nix).toContain("ciliumloadbalancerippools.cilium.io zeta-lb-pool");
    const template = readFileSync(resolve(REPO, "full-ai-cluster/k8s/lb-ipam/argocd-application.yaml.in"), "utf8");
    expect(template).toContain("name: cilium-lb-ipam-pool");
    expect(template).toContain("name: zeta-lb-pool");
  });
});
