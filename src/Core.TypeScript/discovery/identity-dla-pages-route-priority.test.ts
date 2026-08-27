import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  assertEvidenceRoomRoutePriority,
  EVIDENCE_ROOM_ROUTE,
  ROOT_HOME_ROUTE,
} from "./identity-dla-pages-route-priority";

const pagesRouterPath = fileURLToPath(new URL("../../../demo/identity-dla-site/src/App.tsx", import.meta.url));

describe("Identity-DLA Pages evidence-room route priority", () => {
  test("declares /evidence-seam before the root route", () => {
    assertEvidenceRoomRoutePriority(readFileSync(pagesRouterPath, "utf8"));
  });

  test("FAULT INJECTION: rejects a root route that shadows the evidence room", () => {
    expect(() => assertEvidenceRoomRoutePriority(`${ROOT_HOME_ROUTE}\n${EVIDENCE_ROOM_ROUTE}`)).toThrow(
      "captures the evidence-room hash route",
    );
  });

  test("FAULT INJECTION: rejects an artifact source that omitted the evidence-room route", () => {
    expect(() => assertEvidenceRoomRoutePriority(ROOT_HOME_ROUTE)).toThrow("omits");
  });
});
