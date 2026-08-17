import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  agencySignatureBlock,
  assertNoSkipCi,
  signedFlushMessage,
} from "./flush-via-staging";

const WORKFLOW_DIR = join(import.meta.dir, "..", "..", "..", "..", ".github", "workflows");
const workflow = (name: string): string => readFileSync(join(WORKFLOW_DIR, name), "utf8");

// The telemetry lanes that flush through this tool.
const LANES = ["tick-metrics", "society", "red-state"] as const;

// The validator's REQUIRED_KEYS, duplicated deliberately: if that list changes,
// this test must go red rather than silently accept a block missing a key.
const REQUIRED_KEYS = [
  "Agency-Signature-Version",
  "Agent",
  "Agent-Runtime",
  "Agent-Model",
  "Credential-Identity",
  "Credential-Mode",
  "Human-Review",
  "Human-Review-Evidence",
  "Action-Mode",
  "Task",
] as const;

/** git's own trailer parser — the only witness that matters. */
function parsedTrailers(message: string): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync("git", ["interpret-trailers", "--parse"], {
    encoding: "utf8",
    input: message,
  });
  return r.stdout;
}

describe("assertNoSkipCi", () => {
  test("refuses a skip token", () => {
    expect(assertNoSkipCi("metrics: append tick frame [skip ci]")).not.toBeNull();
  });

  test("accepts a clean message", () => {
    expect(assertNoSkipCi("metrics: append tick frame")).toBeNull();
  });
});

// These lanes used to emit UNSIGNED commits, which the post-merge auditor could
// only pass via the explicit MACHINE-LANE-EXEMPT roster entry (#10573). Signing
// them makes them CORRECT instead of exempt, shrinking the exemption surface.
describe("AgencySignature on telemetry flushes", () => {
  test.each([...LANES])("%s: the block carries every required key", (lane) => {
    const block = agencySignatureBlock(lane);
    for (const key of REQUIRED_KEYS) {
      expect(block).toContain(`${key}:`);
    }
    expect(block).toContain("Co-authored-by:");
  });

  test.each([...LANES])("%s: the lane is named in the Agent field", (lane: string) => {
    expect(agencySignatureBlock(lane)).toContain(`Agent: ${lane}-flush-workflow`);
  });

  test("the canonical key spelling is used, not the Agent- twin", () => {
    const block = agencySignatureBlock("tick-metrics");
    expect(block).toContain("Agency-Signature-Version: 1");
    // MUTATION: this is the slip that reached main three times and was, until
    // #10573, exempt AND unsigned at once.
    expect(/^Agent-Signature-Version:/m.test(block)).toBe(false);
  });

  test("the block is CONTIGUOUS — no blank line may split it", () => {
    // git's trailer parser reads only the final blank-line-delimited paragraph,
    // so a blank line inside the block silently drops everything above it.
    expect(agencySignatureBlock("society")).not.toContain("\n\n");
  });

  test.each([...LANES])(
    "%s: git itself parses every required key out of the flush message",
    (lane) => {
      // Not "the string contains the keys" — the PARSER is the witness. A block
      // that reads correctly and does not parse is the exact failure mode
      // (Trailer Contiguity Survival Failure).
      const trailers = parsedTrailers(signedFlushMessage("metrics: append tick frame", lane));
      for (const key of REQUIRED_KEYS) {
        expect(trailers).toContain(`${key}:`);
      }
    },
  );

  test("MUTATION: a blank line inside the block makes git drop the keys above it", () => {
    // The falsifier for the contiguity test above — proves that test is testing
    // something, by constructing the failure it is meant to exclude.
    const broken =
      "metrics: append tick frame\n\nAgency-Signature-Version: 1\nAgent: x\n\nTask: none\n";
    const trailers = parsedTrailers(broken);
    expect(trailers).toContain("Task:");
    expect(trailers).not.toContain("Agency-Signature-Version:");
  });

  test("the signed message keeps the original subject as its first line", () => {
    // The PR title is built from the message's first line; signing must not
    // displace it.
    const msg = signedFlushMessage("metrics: append tick frame", "tick-metrics");
    expect(msg.split("\n")[0]).toBe("metrics: append tick frame");
  });

  test("signing does not smuggle in a CI-skip token", () => {
    // A skip token in the flush commit means `gate (required)` never runs and the
    // PR hangs unmergeable forever.
    expect(assertNoSkipCi(signedFlushMessage("metrics: append tick frame", "society"))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// THE PUSH CREDENTIAL ON THE LANES THAT FLUSH THROUGH THIS TOOL (2026-08-16).
//
// `flush()` above runs `git push --force-with-lease origin HEAD:refs/heads/
// heartbeat/<lane>` with whatever credential the calling workflow's checkout
// persisted. That push's ACTOR decides whether `gate (required)` ever runs on the
// flush PR: a `pull_request` run whose triggering actor is `github-actions[bot]`
// is created and then parked — `completed`/`action_required` — so it never
// executes and never contributes a check.
//
// Measured on this tool's own lanes before the fix (2026-08-16):
//   heartbeat/tick-metrics  PR #10588 head c79a60c8 — 34 `pull_request` runs, ALL
//                           `completed/action_required`, actor=github-actions[bot];
//                           6 check-runs in the rollup, no gate row; open and
//                           unmergeable since 2026-08-14.
//   heartbeat/society       PR #10708 head 46ec2994 (2026-08-17) — 36/36 parked,
//                           same actor, 6 check-runs, no gate row, 964 parked runs
//                           on 2026-08-16 alone; MERGEABLE/BLOCKED with auto-merge
//                           already armed, i.e. the missing gate and nothing else.
// And the positive control, agent-heartbeat's lane after #10986 put the PAT on the
// checkout that pushes: `gate | pull_request | actor=AceHack`, 72 check-runs.
//
// THE CONTROL #11034 DECLARED WAS READ OUT, and it is why `society` moved into
// TREATED below. #11034 treated tick-metrics and left society byte-identical on
// purpose; the same-day real-tick reading, ~10 minutes apart on one repository:
//   heartbeat/tick-metrics 00:14Z + 00:32Z (TREATED)   gate actor=AceHack, EXECUTES
//   heartbeat/society      00:21Z (UNTREATED CONTROL)  gate actor=gh-actions[bot], PARKED
// One variable, two lanes, one hour. That is the attribution the control bought.
//
// THE MECHANISM, refined by what red-state showed (see UNTREATED): the run's actor
// is the identity that produced the event. A `pull_request` **opened** event comes
// from `gh pr create` (the PAT -> AceHack), so a lane whose flush PR lands every
// run always opens a fresh, executing PR. A **synchronize** event comes from the
// `git push`, so once a flush PR is stuck open, every subsequent flush is a
// GITHUB_TOKEN-actored synchronize and parks. That is self-sustaining: parked
// gate -> unmergeable PR -> never re-created -> next flush is another synchronize.
// Society sat in that loop for three days. The push credential is what breaks it.
//
// These assertions are the pin. Each one names the regression it catches, and the
// ORDERING assertion is the load-bearing one — #10913's fallback ran, logged that
// it ran, and was denied under the same identity, so a repair that is applied and
// never re-checked is indistinguishable from one that worked.
// ---------------------------------------------------------------------------

/** Lanes whose workflow has been given the verified push credential. */
const TREATED = [
  { lane: "tick-metrics", file: "tick-metrics.yml" },
  { lane: "society", file: "society-heartbeat.yml" },
] as const;

/**
 * Lanes deliberately still on the default credential, and WHY.
 *
 * This is not an oversight and the assertion below exists so it cannot decay into
 * one. #10850 broke three lanes at once for ~16.75h by changing them together, so
 * lanes are treated one at a time with a reading in between.
 *
 * `red-state` is NOT a control showing the defect — it is a lane where the defect
 * is LATENT, and saying so is the honest register. Measured 2026-08-17: 92
 * `pull_request` runs on `heartbeat/red-state`, only 12 parked and all 12 dated
 * 2026-08-14; every run since is `actor=AceHack` and executes. The reason is in
 * the mechanism note above — its flush PRs MERGE (#11067, #11010, #10872, #10870,
 * #10858 all landed on 2026-08-16), so each run opens a fresh PR under the PAT and
 * never reaches a synchronize push. The defect returns the moment one of its PRs
 * stalls, which is exactly how society entered its loop. Treat it on a stall, or
 * pre-emptively with its own before/after reading — do not treat it blind.
 *
 * WHEN YOU TREAT A LANE: move its entry from UNTREATED into TREATED in the same
 * commit as the yaml change, and record the before/after gate reading for that lane
 * in the PR. Do not simply delete the assertion — this list is a claim about what
 * we know, not paperwork.
 */
const UNTREATED = [{ lane: "red-state", file: "proof-closure-drift.yml" }] as const;

/**
 * The preflight step's body: from its `- name:` up to the next step's `- name:`.
 *
 * Sliced structurally rather than to a named following step — tick-metrics.yml has
 * `Install bun` next and society-heartbeat.yml has `Setup bun`, and hardcoding
 * either made the other lane's slice run to the end of the file, which silently
 * widens what the `not.toContain` assertions are looking at.
 */
function preflightOf(yaml: string): string {
  const start = yaml.indexOf("      - name: Preflight the push credential");
  if (start < 0) return "";
  const next = yaml.indexOf("\n      - name: ", start + 1);
  return next < 0 ? yaml.slice(start) : yaml.slice(start, next);
}

describe("telemetry-lane push credential (the held-gate cure)", () => {
  test("every lane that flushes through this tool is classified", () => {
    // A new lane added to LANES with no credential decision is the silent-default
    // failure: it inherits GITHUB_TOKEN and parks its gate, and nothing says so.
    const classified = [...TREATED, ...UNTREATED].map((l) => l.lane).sort();
    expect(classified).toEqual([...LANES].sort());
  });

  for (const { lane, file } of TREATED) {
    describe(`${lane} (${file})`, () => {
      const yaml = workflow(file);
      const preflight = preflightOf(yaml);

      test("the checkout that pushes carries the PAT, with an absence ladder", () => {
        // The `||` ladder is the ABSENCE half of degrade-don't-halt: an unset
        // secret evaluates to "" and falls through to GITHUB_TOKEN. A bare
        // `token: ${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN }}` would check out with
        // an empty credential and kill the lane — the #10850 outage shape.
        expect(yaml).toContain(
          "token: ${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN || secrets.GITHUB_TOKEN }}",
        );
        expect(yaml).toContain("persist-credentials: true");
      });

      test("the preflight probes the REAL remote, not a stub", () => {
        // The UNAUTHORIZED half, which the `||` ladder cannot cover: #10850
        // shipped a token that was present and powerless. Only a real request to
        // the real remote distinguishes those — #10913 asserted this against a
        // stubbed git and died on its first real tick. `--dry-run` still performs
        // the authorization handshake.
        expect(preflight).toContain("git push --dry-run origin");
        // A `credprobe/` ref, never the live lane branch: HEAD is main and the
        // lane has diverged, so a permission answer would be indistinguishable
        // from a non-fast-forward ancestry answer.
        expect(preflight).toContain("refs/heads/credprobe/");
        expect(preflight).not.toContain("refs/heads/heartbeat/");
      });

      test("RE-PROBES after the swap, and the re-probe FOLLOWS it", () => {
        // Two probe sites = probe, then re-probe. Presence alone is not enough:
        // two probes prove nothing if both run BEFORE the credential is swapped,
        // so the ordering is asserted, not the count only.
        const probeCalls = preflight.match(/\$\(probe\)/g) ?? [];
        expect(probeCalls.length).toBeGreaterThanOrEqual(2);

        const swapIndex = preflight.indexOf("git config --local --replace-all");
        const reprobeIndex = preflight.indexOf("if OUT2=$(probe); then");
        expect(swapIndex).toBeGreaterThan(-1);
        expect(reprobeIndex).toBeGreaterThan(swapIndex);
      });

      test("swaps ONLY on a credential answer", () => {
        // Swapping on ANY failure would let a network blip silently re-point the
        // credential and hide a different fault behind a credential story.
        expect(preflight).toContain(
          "denied to|Authentication failed|Invalid username or token|error: 403",
        );
        expect(preflight).toContain("preflight inconclusive");
      });

      test("the degrade is loud, lane-attributed, and leaks no token", () => {
        // A silent degrade is the same defect class as the missing gate: a lane
        // that looks healthy and is not. The title carries THIS lane's name — a
        // copied block still saying `tick-metrics` would send the operator to the
        // wrong workflow while the annotation looked correct.
        expect(preflight).toContain(`::error title=${lane} PAT cannot push::`);
        expect(preflight).toContain(`::error title=${lane} has no working push credential::`);
        expect(preflight).toContain(`::warning title=${lane} preflight inconclusive::`);
        expect(preflight).toContain("::add-mask::");
        expect(preflight).not.toContain('echo "$FALLBACK_TOKEN"');
      });

      test("the probe ref is namespaced to THIS lane", () => {
        // Two lanes sharing one `credprobe/` ref would race their dry runs against
        // each other's ancestry rather than against the credential.
        expect(preflight).toContain(`refs/heads/credprobe/${lane}`);
      });
    });
  }

  for (const { lane, file } of UNTREATED) {
    test(`${lane} (${file}) is DECLARED untreated — see UNTREATED above`, () => {
      const yaml = workflow(file);
      expect(yaml).not.toContain("ZETA_TELEMETRY_FLUSH_TOKEN || secrets.GITHUB_TOKEN");
      expect(yaml).not.toContain("- name: Preflight the push credential");
    });
  }
});
