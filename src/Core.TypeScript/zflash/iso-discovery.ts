// src/Core.TypeScript/zflash/iso-discovery.ts
//
// "Is there already an installer ISO on this machine?" — separated from cli.ts
// so the answer can be TESTED.
//
// WHY IT MOVED. This logic lived in cli.ts as autoDiscoverIso, and cli.ts calls
// main() at module scope, so importing it from a test runs the whole CLI. That
// made the function untestable, and an untestable function is where this defect
// lived: on a machine with no `zeta-installer-*.iso` in ~/Downloads it called
// bail(2, ...) and exited, and it ran BEFORE the CI auto-pull. So the bare
// `zflash` form both metal runbooks recommend could not bootstrap itself — it
// told the operator to go download an ISO by hand on the exact code path whose
// job is to download the ISO for them.
//
// THE SHAPE THAT FIXES IT: three outcomes, not two.
//
//   found    — use it (possibly with a warning)
//   none     — nothing here; the CALLER decides, and the caller can pull
//   refused  — something here is positively WRONG (every candidate names a
//              different architecture). Not the same as "none", and it must
//              never fall through to a download that would paper over it.
//
// Collapsing `none` and `refused` in either direction is a bug: treating a
// refusal as "none" hides a real arch mismatch behind a fresh download, and
// treating "none" as a refusal is the exit-2 this file exists to end.

import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { selectDownloadedIsoForArch, type IsoArch } from "./lib.ts";

export const ISO_GLOB_PREFIX = "zeta-installer-";

export const NO_LOCAL_ISO_HELP =
  `no Zeta installer ISO found under ~/Downloads/${ISO_GLOB_PREFIX}*.iso\n` +
  "Either download one from a successful build-ai-cluster-iso workflow\n" +
  "run, or pass an ISO path explicitly: zflash <path/to/iso>";

export type LocalIsoDiscovery =
  | { readonly kind: "found"; readonly path: string; readonly warning: string | null }
  | { readonly kind: "none" }
  | { readonly kind: "refused"; readonly error: string };

/**
 * Look for an installer ISO already sitting in the operator's Downloads folder.
 *
 * `downloadsDir` is a parameter so this is checkable against a temp directory —
 * the null-not-exit property cannot be established by reading the source,
 * because a reintroduced bail leaves the signature perfectly honest while the
 * body stops being.
 *
 * Newest-by-mtime first, then arch decides among them. Sorting first keeps
 * "newest" the tiebreak it always was; the arch filter only stops a wrong-arch
 * ISO from winning purely by being recent.
 */
export function discoverLocalIso(
  wantArch: IsoArch,
  downloadsDir: string = join(homedir(), "Downloads"),
): LocalIsoDiscovery {
  if (!existsSync(downloadsDir)) return { kind: "none" };

  let names: readonly string[];
  try {
    names = readdirSync(downloadsDir);
  } catch {
    // An unreadable Downloads folder is not a refusal about ARCH, and it is not
    // evidence that no ISO exists either. "none" lets the pull try; if that also
    // fails the caller still refuses, so nothing is silently permitted.
    return { kind: "none" };
  }

  const candidates = names
    .filter((f) => f.startsWith(ISO_GLOB_PREFIX) && f.endsWith(".iso"))
    .map((f) => join(downloadsDir, f))
    .filter((p) => {
      try {
        return statSync(p).isFile();
      } catch {
        return false;
      }
    });

  if (candidates.length === 0) return { kind: "none" };

  candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  const picked = selectDownloadedIsoForArch(candidates, wantArch);
  if (!picked.ok) return { kind: "refused", error: picked.error };
  return { kind: "found", path: picked.path, warning: picked.warning };
}
