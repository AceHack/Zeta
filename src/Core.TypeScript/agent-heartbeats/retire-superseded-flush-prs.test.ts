import { describe, expect, test } from "bun:test";
import { parseFlushRef, supersededFlushPrs } from "./retire-superseded-flush-prs";

const SHA_A = "6e7dca3074ff9fa5d54bfa1b828cf991d15ab955";
const SHA_B = "34ed80f97e740e1e9f0c49fdcf8612345678abcd";
const SHA_C = "f74192a6d3959a008722b94f86d87235b1ae55ae";

const pr = (number: number, headRef: string, createdAt = "2026-08-17T11:13:07Z") => ({
  number,
  headRef,
  createdAt,
});

describe("parseFlushRef", () => {
  test("reads agent and sha out of a snapshot ref", () => {
    expect(parseFlushRef(`heartbeat/alexa-flush-${SHA_A}`)).toEqual({ agent: "alexa", sha: SHA_A });
  });

  test("the MUTABLE LANE is not a snapshot — retiring it would destroy the lane", () => {
    expect(parseFlushRef("heartbeat/alexa")).toBeNull();
    expect(parseFlushRef("heartbeat/otto")).toBeNull();
  });

  test("non-heartbeat refs are never flush snapshots", () => {
    expect(parseFlushRef(`shadow/alexa-flush-${SHA_A}`)).toBeNull();
    expect(parseFlushRef("fix/something")).toBeNull();
  });

  test("rejects a ref whose trailing segment is not a sha", () => {
    expect(parseFlushRef("heartbeat/alexa-flush-")).toBeNull();
    expect(parseFlushRef("heartbeat/alexa-flush-not-a-sha")).toBeNull();
  });

  test("splits on the LAST -flush- so an agent cannot smuggle another lane", () => {
    expect(parseFlushRef(`heartbeat/odd-flush-name-flush-${SHA_A}`)).toEqual({
      agent: "odd-flush-name",
      sha: SHA_A,
    });
  });
});

describe("supersededFlushPrs", () => {
  test("retires the older snapshot for the same lane", () => {
    const open = [
      pr(11426, `heartbeat/alexa-flush-${SHA_A}`),
      pr(11435, `heartbeat/alexa-flush-${SHA_B}`),
    ];
    expect(supersededFlushPrs(open, "alexa", SHA_B)).toEqual([11426]);
  });

  // The load-bearing guard. Closing the predecessor when the replacement never
  // opened would strand the delta behind a closed PR with no live path to main.
  test("retires NOTHING when the keeper is not open", () => {
    const open = [pr(11426, `heartbeat/alexa-flush-${SHA_A}`)];
    expect(supersededFlushPrs(open, "alexa", SHA_B)).toEqual([]);
  });

  test("never touches another agent's lane", () => {
    const open = [
      pr(11433, `heartbeat/otto-flush-${SHA_C}`),
      pr(11435, `heartbeat/alexa-flush-${SHA_B}`),
    ];
    expect(supersededFlushPrs(open, "alexa", SHA_B)).toEqual([]);
  });

  test("never retires the keeper itself", () => {
    const open = [pr(11435, `heartbeat/alexa-flush-${SHA_B}`)];
    expect(supersededFlushPrs(open, "alexa", SHA_B)).toEqual([]);
  });

  test("leaves ordinary PRs and mutable lanes alone", () => {
    const open = [
      pr(10738, "fix/consensus-local-clock"),
      pr(11401, "heartbeat/society"),
      pr(11426, `heartbeat/alexa-flush-${SHA_A}`),
      pr(11435, `heartbeat/alexa-flush-${SHA_B}`),
    ];
    expect(supersededFlushPrs(open, "alexa", SHA_B)).toEqual([11426]);
  });

  test("retires every older snapshot when several piled up (the 2026-08-17 shape)", () => {
    const open = [
      pr(11362, `heartbeat/alexa-flush-${SHA_A}`),
      pr(11394, `heartbeat/alexa-flush-${SHA_C}`),
      pr(11435, `heartbeat/alexa-flush-${SHA_B}`),
    ];
    expect(supersededFlushPrs(open, "alexa", SHA_B)).toEqual([11362, 11394]);
  });
});
