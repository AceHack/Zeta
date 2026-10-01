/**
 * full-ai-cluster/nixos/modules/k3s-leader-elect.test.ts
 *
 * Falsifiers for the leader-election windows in `k3s-server.nix`.
 *
 * WP11 run 36875247887 restarted k3s.service 19 times and every exit in its
 * `k3s-exits` timeline is a lost lease (`leaderelection lost` from the
 * controller-manager and the cloud-controller-manager). Upstream treats a lost
 * lease as fatal and k3s runs those components in one process, so one slow etcd
 * renewal under a CPU/IO burst took the whole control plane down, repeatedly.
 * `k3s-server.nix` now widens the three windows on all three electing
 * components; these tests pin that, and the ordering client-go refuses to start
 * without.
 *
 * Same method as `k3s-process-protection.test.ts`: the module's flag strings are
 * read out of the source with comments stripped, so the rationale can never
 * satisfy an assertion. Each case below fails if the flags are deleted, reduced
 * to the upstream defaults, or reordered into an invalid combination.
 *
 * WHAT THIS CANNOT TELL YOU: that NixOS passes the flags through to k3s, or that
 * k3s forwards them to the component. `k3s-server.nix` cannot be evaluated on its
 * own (it needs the whole NixOS module graph), so this is a source-level
 * assertion, not a Nix eval. Only a boot shows the live effect, and the WP11
 * `k3s-exits` timeline is where it will show: if exits still read
 * `leaderelection lost` for these components, the windows were not the cause.
 * It also cannot say anything about k3s's own election (`for k3s`, `for
 * k3s-etcd`), which has no flag.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (name: string): string => readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8");

const stripComments = (text: string): string =>
  text
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .map((line) => line.replace(/\s+#\s.*$/, ""))
    .join("\n");

const SERVER = stripComments(read("k3s-server.nix"));
const AGENT = stripComments(read("k3s-agent.nix"));

/** client-go's leaderelection.JitterFactor: the retry period is jittered up to this multiple. */
const JITTER_FACTOR = 1.2;

/** Upstream defaults for kube-controller-manager / kube-scheduler / cloud-controller-manager. */
const UPSTREAM = { lease: 15, renew: 10, retry: 2 } as const;

/**
 * The ordering `leaderelection.NewLeaderElector` enforces at startup:
 *   lease > renew, and renew > retry * JitterFactor.
 * A violation is a component that REFUSES TO START, i.e. a boot failure.
 */
export function validLeaderElection(lease: number, renew: number, retry: number): boolean {
  return lease > renew && renew > retry * JITTER_FACTOR && retry > 0;
}

const COMPONENTS = ["kube-controller-manager", "kube-scheduler", "kube-cloud-controller-manager"] as const;
const KEYS = ["lease-duration", "renew-deadline", "retry-period"] as const;

interface Window {
  readonly lease: number;
  readonly renew: number;
  readonly retry: number;
}

/** Every `--<component>-arg=leader-elect-<key>=<n>s` flag for one component, by key. */
function flagValues(text: string, component: string, key: string): number[] {
  const re = new RegExp(`"--${component}-arg=leader-elect-${key}=([0-9]+)s"`, "gu");
  return [...text.matchAll(re)].map((m) => Number(m[1]));
}

function windowOf(component: string): Window {
  const one = (key: string): number => {
    const v = flagValues(SERVER, component, key);
    if (v.length !== 1 || v[0] === undefined) {
      throw new Error(`${component} must carry exactly one leader-elect-${key} flag in k3s-server.nix, found ${String(v.length)}`);
    }
    return v[0];
  };
  return { lease: one("lease-duration"), renew: one("renew-deadline"), retry: one("retry-period") };
}

describe("the ordering invariant, as a unit", () => {
  test("upstream defaults are valid", () => {
    expect(validLeaderElection(UPSTREAM.lease, UPSTREAM.renew, UPSTREAM.retry)).toBe(true);
  });

  test("the widened window is valid", () => {
    expect(validLeaderElection(90, 60, 10)).toBe(true);
  });

  test("renew must be strictly below lease", () => {
    expect(validLeaderElection(60, 60, 10)).toBe(false);
    expect(validLeaderElection(60, 90, 10)).toBe(false);
  });

  test("retry must leave room for jitter under renew (renew > retry * 1.2)", () => {
    expect(validLeaderElection(90, 12, 10)).toBe(false); // 12 is not > 12
    expect(validLeaderElection(90, 13, 10)).toBe(true);
    expect(validLeaderElection(90, 60, 60)).toBe(false);
  });

  test("zero and negative periods are invalid", () => {
    expect(validLeaderElection(90, 60, 0)).toBe(false);
    expect(validLeaderElection(90, 60, -1)).toBe(false);
  });
});

describe("k3s-server.nix widens the leader-election windows", () => {
  for (const component of COMPONENTS) {
    for (const key of KEYS) {
      test(`${component} carries exactly one leader-elect-${key} flag`, () => {
        expect(flagValues(SERVER, component, key)).toHaveLength(1);
      });
    }
  }

  test("every electing component is configured, none left on the defaults that failed", () => {
    for (const component of COMPONENTS) {
      expect(() => windowOf(component)).not.toThrow();
    }
  });

  for (const component of COMPONENTS) {
    test(`${component}: renew < lease and renew > retry * jitter (client-go refuses to start otherwise)`, () => {
      const w = windowOf(component);
      expect(validLeaderElection(w.lease, w.renew, w.retry)).toBe(true);
    });

    test(`${component}: strictly wider than upstream on lease AND renew (the measured stalls were 5-10 s)`, () => {
      const w = windowOf(component);
      expect(w.lease).toBeGreaterThan(UPSTREAM.lease);
      expect(w.renew).toBeGreaterThan(UPSTREAM.renew);
      // A renewal must be able to ride out a stall at least several times the measured worst case (10 s).
      expect(w.renew).toBeGreaterThanOrEqual(30);
    });
  }

  test("the three components agree, so one of them is not the new weakest link", () => {
    const [a, b, c] = COMPONENTS.map(windowOf);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  test("no component is configured with an unknown election flag (a typo is a k3s that will not start)", () => {
    const flags = [...SERVER.matchAll(/"--(kube-[a-z-]+)-arg=(leader-elect[a-z-]*)=/gu)].map((m) => `${m[1]}:${m[2]}`);
    const allowed = new Set(COMPONENTS.flatMap((c) => KEYS.map((k) => `${c}:leader-elect-${k}`)));
    for (const f of flags) expect(allowed.has(f)).toBe(true);
  });

  test("agents are untouched: they run no controller-manager, scheduler or CCM", () => {
    expect(AGENT).not.toMatch(/leader-elect/u);
  });
});
