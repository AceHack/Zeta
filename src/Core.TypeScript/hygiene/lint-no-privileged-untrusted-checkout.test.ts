import { describe, expect, it } from "bun:test";
import {
  PRIVILEGED_TRIGGERS,
  checkoutRefs,
  findPrivilegedUntrustedCheckout,
  gatePinsBaseRef,
  isUntrusted,
  triggersOf,
} from "./lint-no-privileged-untrusted-checkout.ts";

describe("triggersOf — every spelling of the `on:` block", () => {
  it("reads the block form", () => {
    expect(triggersOf("on:\n  pull_request:\n    types: [opened]\n")).toEqual(["pull_request"]);
  });

  // A reader handling only the block form sees NO triggers on a flow-form workflow and passes
  // it unconditionally — the vacuity class arriving through a parser gap rather than a bug.
  it("reads the flow and scalar forms", () => {
    expect(triggersOf("on: [push, workflow_run]\n")).toEqual(["push", "workflow_run"]);
    expect(triggersOf("on: push\n")).toEqual(["push"]);
  });

  it("reads the quoted key", () => {
    expect(triggersOf('"on":\n  pull_request_target:\n')).toEqual(["pull_request_target"]);
  });

  it("stops at the first dedent to column 0", () => {
    expect(triggersOf("on:\n  push:\n    branches: [main]\njobs:\n  a:\n    steps: []\n")).toEqual(["push"]);
  });

  it("ignores a commented trigger", () => {
    expect(triggersOf("on:\n  push:\n#  pull_request_target:\n")).toEqual(["push"]);
  });
});

describe("checkoutRefs", () => {
  it("records an absent ref as <default> rather than skipping the step", () => {
    expect(checkoutRefs("jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n")).toEqual(["<default>"]);
  });

  it("reads a block-form ref", () => {
    const y = "jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: abc\n";
    expect(checkoutRefs(y)).toEqual(["abc"]);
  });

  it("reads a flow-mapping ref", () => {
    const y = 'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n        with: { ref: "abc" }\n';
    expect(checkoutRefs(y)).toEqual(["abc"]);
  });

  // A pinned action carries `# v7.0.1` after the SHA. Splitting on `#` outside quotes is why
  // the comment stripper is quote-aware; getting this wrong silently truncates refs.
  it("does not let a pin comment corrupt the step", () => {
    const y = "jobs:\n  a:\n    steps:\n      - uses: actions/checkout@3d3c42e # v7.0.1\n        with:\n          ref: main\n";
    expect(checkoutRefs(y)).toEqual(["main"]);
  });

  it("does not leak a later step's ref into an earlier bare checkout", () => {
    const y = [
      "jobs:", "  a:", "    steps:",
      "      - uses: actions/checkout@v4",
      "      - uses: actions/checkout@v4",
      "        with:", "          ref: second",
    ].join("\n");
    expect(checkoutRefs(y)).toEqual(["<default>", "second"]);
  });

  it("ignores a `ref:` belonging to a non-checkout step", () => {
    const y = "jobs:\n  a:\n    steps:\n      - uses: oven-sh/setup-bun@v2\n        with:\n          ref: nope\n";
    expect(checkoutRefs(y)).toEqual([]);
  });
});

describe("isUntrusted — the default ref's trust depends on the EVENT", () => {
  it("treats the default ref as untrusted under pull_request*", () => {
    expect(isUntrusted("<default>", ["pull_request_target"])).toBe(true);
    expect(isUntrusted("<default>", ["pull_request"])).toBe(true);
  });

  // The checker's first version got this wrong and fired on `rerun-cancelled-gate.yml`, whose
  // bare checkout IS its documented guard: under workflow_run the default ref is the default
  // branch. Pinned so the false positive cannot return.
  it("treats the default ref as TRUSTED under workflow_run", () => {
    expect(isUntrusted("<default>", ["workflow_run"])).toBe(false);
  });

  it("flags an explicit author-controlled ref under any event", () => {
    for (const r of [
      "${{ github.event.pull_request.head.sha }}",
      "${{ github.head_ref }}",
      "refs/pull/12/merge",
      "${{ github.event.workflow_run.head_branch }}",
    ]) expect(isUntrusted(r, ["push"])).toBe(true);
  });

  it("does not flag a base-side ref", () => {
    expect(isUntrusted("${{ github.event.pull_request.base.sha }}", ["pull_request_target"])).toBe(false);
  });
});

describe("findPrivilegedUntrustedCheckout — the critical pair", () => {
  const head = 'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n        with: { ref: "${{ github.event.pull_request.head.sha }}" }\n';

  it("REFUSES a privileged trigger that checks out author-controlled code", () => {
    for (const t of PRIVILEGED_TRIGGERS) {
      const f = findPrivilegedUntrustedCheckout("bad.yml", `on: [${t}]\n${head}`);
      expect(f).not.toBeNull();
      expect(f?.detail).toContain(t);
    }
  });

  // The safe single halves must keep working, or the checker forces a worse design.
  it("PERMITS a head checkout under the non-privileged pull_request", () => {
    expect(findPrivilegedUntrustedCheckout("ok.yml", `on: [pull_request]\n${head}`)).toBeNull();
  });

  it("PERMITS a privileged trigger with a base-side ref", () => {
    const y = 'on: [pull_request_target]\njobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n        with: { ref: "${{ github.event.pull_request.base.sha }}" }\n';
    expect(findPrivilegedUntrustedCheckout("ok.yml", y)).toBeNull();
  });

  it("PERMITS a privileged trigger with a bare checkout (default branch)", () => {
    expect(findPrivilegedUntrustedCheckout("ok.yml", "on: [workflow_run]\njobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n")).toBeNull();
  });
});

describe("gatePinsBaseRef — alert #798's own premise", () => {
  const mk = (ref: string): string =>
    `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n        with: { ref: "${ref}" }\n`;

  it("holds when a base-side ref is pinned", () => {
    expect(gatePinsBaseRef(mk("${{ github.event.pull_request.base.sha }}"))).toBe(true);
  });

  it("FAILS when the pin is replaced by a head checkout — the regression #798 guards", () => {
    expect(gatePinsBaseRef(mk("${{ github.event.pull_request.head.sha }}"))).toBe(false);
  });

  // A file with no checkout cannot CONFIRM the premise. Returning true there would be a check
  // that passes by finding nothing — the shape this whole file refuses.
  it("does NOT pass a workflow with no checkout at all", () => {
    expect(gatePinsBaseRef("jobs:\n  a:\n    steps:\n      - run: echo hi\n")).toBe(false);
  });
});
