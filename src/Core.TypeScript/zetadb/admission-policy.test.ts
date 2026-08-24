import { describe, expect, test } from "bun:test";

import { noForgetBackpressureAdmissionPolicy } from "./admission-policy";

describe("ZetaDB admission policy port", () => {
  test("admits proposals exactly at both finite bounds", () => {
    expect(
      noForgetBackpressureAdmissionPolicy.decide({
        resource: "retained-events",
        current: 2,
        candidate: 3,
        limit: 3,
      }),
    ).toEqual({ action: "admit" });
    expect(
      noForgetBackpressureAdmissionPolicy.decide({
        resource: "checkpoint-bytes",
        current: 511,
        candidate: 512,
        limit: 512,
      }),
    ).toEqual({ action: "admit" });
  });

  test("refuses entry growth without displacing retained events", () => {
    expect(
      noForgetBackpressureAdmissionPolicy.decide({
        resource: "retained-events",
        current: 3,
        candidate: 4,
        limit: 3,
      }),
    ).toEqual({
      action: "backpressure",
      detail: "The retained event ledger reached its 3-entry no-forget budget.",
    });
  });

  test("reports the candidate checkpoint size when its byte bound is crossed", () => {
    expect(
      noForgetBackpressureAdmissionPolicy.decide({
        resource: "checkpoint-bytes",
        current: 480,
        candidate: 529,
        limit: 512,
      }),
    ).toEqual({
      action: "backpressure",
      detail: "The next database image needs 529 bytes; the no-forget checkpoint budget is 512 bytes.",
    });
  });
});
