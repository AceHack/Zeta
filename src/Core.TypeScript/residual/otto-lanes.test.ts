import { expect, test } from "bun:test";
import { extractLanes } from "./run-otto-lanes";

test("extractLanes: splits records by actor trailer; missing actor -> UNKNOWN", () => {
  const raw = "\x1efeat: a\x1factor: otto-loop\n\x1edocs: b\x1factor: zeta-otto\n\x1efix: c\x1fno trailer here\n\x1efeat: d\x1factor: otto-loop\n";
  const lanes = Object.fromEntries(extractLanes(raw).map((l) => [l.actor, l.subjects]));
  expect(lanes["otto-loop"]).toEqual(["feat: a", "feat: d"]);
  expect(lanes["zeta-otto"]).toEqual(["docs: b"]);
  expect(lanes["UNKNOWN"]).toEqual(["fix: c"]);
});
