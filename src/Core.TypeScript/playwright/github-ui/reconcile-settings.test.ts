import { describe, expect, test } from "bun:test";
import { reconcile, SETTINGS_MAPPING, type MappingEntry } from "./reconcile-settings";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(url: string, toggles: Record<string, boolean>) {
  return {
    url,
    timestamp: "2026-05-09T00:00:00.000Z",
    extracted: { toggles },
  };
}

// Minimal expected-settings shape covering the entries in SETTINGS_MAPPING.
const EXPECTED_FULL = {
  repo: {
    allow_merge_commit: false,
    allow_squash_merge: true,
    allow_rebase_merge: false,
    allow_auto_merge: true,
    delete_branch_on_merge: true,
    web_commit_signoff_required: false,
    allow_update_branch: true,
    security_and_analysis: {
      dependabot_security_updates: { status: "enabled" },
      secret_scanning: { status: "enabled" },
      secret_scanning_push_protection: { status: "enabled" },
      secret_scanning_ai_detection: { status: "disabled" },
    },
  },
};

// ---------------------------------------------------------------------------
// reconcile — match / drift / unmapped
// ---------------------------------------------------------------------------

describe("reconcile", () => {
  test("match: UI value equals expected value", () => {
    const snap = makeSnapshot("https://github.com/Lucent-Financial-Group/Zeta/settings", {
      "allow-squash-merge": true,  // expected: true
      "allow-merge-commit": false, // expected: false
    });
    const result = reconcile(snap, EXPECTED_FULL);
    expect(result.match.length).toBe(2);
    expect(result.drift.length).toBe(0);
    expect(result.match.map((m) => m.uiKey)).toContain("allow-squash-merge");
    expect(result.match.map((m) => m.uiKey)).toContain("allow-merge-commit");
  });

  test("drift: UI value differs from expected value", () => {
    const snap = makeSnapshot("https://github.com/Lucent-Financial-Group/Zeta/settings", {
      "allow-squash-merge": false, // expected: true → drift
      "allow-merge-commit": false, // expected: false → match
    });
    const result = reconcile(snap, EXPECTED_FULL);
    expect(result.drift.length).toBe(1);
    expect(result.drift[0]?.uiKey).toBe("allow-squash-merge");
    expect(result.drift[0]?.uiValue).toBe(false);
    expect(result.drift[0]?.expectedValue).toBe(true);
    expect(result.match.length).toBe(1);
  });

  test("unmapped: toggle key not in mapping table", () => {
    const snap = makeSnapshot("https://github.com/Lucent-Financial-Group/Zeta/settings", {
      "allow-squash-merge": true,
      "unknown-github-feature": true, // no mapping entry
    });
    const result = reconcile(snap, EXPECTED_FULL);
    expect(result.unmapped).toContain("unknown-github-feature");
    expect(result.unmapped).not.toContain("allow-squash-merge");
  });

  test("skips toggle absent from snapshot (not counted as match or drift)", () => {
    // Only one toggle in the snapshot; the rest of the mapping has no data
    const snap = makeSnapshot("https://github.com/Lucent-Financial-Group/Zeta/settings", {
      "allow-squash-merge": true,
    });
    const result = reconcile(snap, EXPECTED_FULL);
    const allKeys = [...result.match, ...result.drift].map((e) => e.uiKey);
    expect(allKeys).toEqual(["allow-squash-merge"]);
  });

  test("statusToBoolean: enabled → true (match)", () => {
    const snap = makeSnapshot("https://github.com/Lucent-Financial-Group/Zeta/settings/security_analysis", {
      "dependabot-security-updates": true, // expected: enabled → true
    });
    const result = reconcile(snap, EXPECTED_FULL);
    expect(result.match.map((m) => m.uiKey)).toContain("dependabot-security-updates");
    expect(result.drift.length).toBe(0);
  });

  test("statusToBoolean: enabled → true, UI false → drift", () => {
    const snap = makeSnapshot("https://github.com/Lucent-Financial-Group/Zeta/settings/security_analysis", {
      "secret-scanning": false, // expected: enabled → true → drift
    });
    const result = reconcile(snap, EXPECTED_FULL);
    expect(result.drift.map((d) => d.uiKey)).toContain("secret-scanning");
    expect(result.drift[0]?.expectedValue).toBe(true);
  });

  test("statusToBoolean: disabled → false (match)", () => {
    const snap = makeSnapshot("https://github.com/Lucent-Financial-Group/Zeta/settings/security_analysis", {
      "secret-scanning-ai-detection": false, // expected: disabled → false
    });
    const result = reconcile(snap, EXPECTED_FULL);
    expect(result.match.map((m) => m.uiKey)).toContain("secret-scanning-ai-detection");
    expect(result.drift.length).toBe(0);
  });

  test("skips mapping entry with malformed expected value (null from toExpectedBool)", () => {
    const customMapping: readonly MappingEntry[] = [
      { uiKey: "foo", jsonPath: "repo.bad_path" }, // repo.bad_path does not exist
    ];
    const snap = makeSnapshot("https://github.com/example", { foo: true });
    const result = reconcile(snap, EXPECTED_FULL, customMapping);
    // bad path returns undefined → toExpectedBool returns null → skipped
    expect(result.match.length).toBe(0);
    expect(result.drift.length).toBe(0);
    // foo is in the mapping, so it should be marked as matched-key (not unmapped)
    expect(result.unmapped).not.toContain("foo");
  });

  test("result is JSON-serializable", () => {
    const snap = makeSnapshot("https://github.com/Lucent-Financial-Group/Zeta/settings", {
      "allow-squash-merge": true,
    });
    const result = reconcile(snap, EXPECTED_FULL);
    const serialized = JSON.stringify(result);
    const parsed = JSON.parse(serialized) as typeof result;
    expect(parsed.url).toBe(result.url);
    expect(parsed.match.length).toBe(result.match.length);
  });

  test("SETTINGS_MAPPING covers at least 3 required settings", () => {
    const keys = SETTINGS_MAPPING.map((e) => e.uiKey);
    // Branch-protection coverage
    expect(keys.some((k) => k.includes("merge-commit") || k.includes("rebase") || k.includes("squash"))).toBe(true);
    // Secret scanning coverage
    expect(keys.some((k) => k.includes("secret-scanning"))).toBe(true);
    // Dependabot coverage
    expect(keys.some((k) => k.includes("dependabot"))).toBe(true);
  });

  test("url and timestamp flow through from snapshot", () => {
    const snap = makeSnapshot("https://github.com/test/repo/settings", { "allow-squash-merge": true });
    const result = reconcile(snap, EXPECTED_FULL);
    expect(result.url).toBe("https://github.com/test/repo/settings");
    expect(result.timestamp).toBe("2026-05-09T00:00:00.000Z");
  });
});
