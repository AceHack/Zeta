/**
 * Identity-DLA Pages route-priority guard.
 *
 * The GitHub Pages client uses Wouter's ordered Switch. The root route is a
 * prefix match, so it must be declared after the specific evidence-room path.
 * This guard deliberately checks source order: a bundle can contain both
 * chunks and still make the evidence room unreachable when `/` appears first.
 */
export const EVIDENCE_ROOM_ROUTE = 'path={"/evidence-seam"}';
export const ROOT_HOME_ROUTE = 'path={"/"} component={Home}';

export function assertEvidenceRoomRoutePriority(source: string): void {
  const evidenceRouteIndex = source.indexOf(EVIDENCE_ROOM_ROUTE);
  if (evidenceRouteIndex < 0) {
    throw new Error(`teaching error: Pages router omits ${EVIDENCE_ROOM_ROUTE}`);
  }

  const rootRouteIndex = source.indexOf(ROOT_HOME_ROUTE);
  if (rootRouteIndex < 0) {
    throw new Error(`teaching error: Pages router omits ${ROOT_HOME_ROUTE}`);
  }

  if (rootRouteIndex < evidenceRouteIndex) {
    throw new Error(
      "teaching error: Pages root route precedes /evidence-seam and captures the evidence-room hash route; declare specific routes first",
    );
  }
}
