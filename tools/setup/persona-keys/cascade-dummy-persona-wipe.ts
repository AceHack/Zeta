// Dummy-persona cascade memory wipe — SANDBOX ONLY.
//
// Binding (Aaron 2026-07-08): live wipe tests use a throwaway dummy persona with no real
// data — NEVER a real persona under memory/<real>/. ALIGNMENT HC-9 / GOVERNANCE §36 still
// require persona consent; this module only exercises the wipe door on an empty dummy.
//
// Safety:
//   * personaId MUST match /^dummy-[a-z0-9-]+$/
//   * memoryRoot MUST be an injected sandbox (tests pass mkdtemp); never the repo memory/
//   * directory must be empty OR contain only the .cascade-dummy marker
//   * personaConsentNodeIds must include the node (human-only consent fails)

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertCascadeAllowed,
  planCascadeTeardown,
  type CascadeAllowedResult,
  type CascadeConsents,
  type CascadeTeardownPlan,
} from "./cascade-teardown.ts";

/** Marker file that identifies an intentional empty dummy persona dir (not real memory). */
export const CASCADE_DUMMY_MARKER = ".cascade-dummy";

/** Only these persona id shapes may be wiped by this harness. */
export const DUMMY_PERSONA_ID_RE = /^dummy-[a-z0-9-]+$/;

export interface DummyPersonaWipeEffects {
  readonly exists: (path: string) => boolean;
  readonly listNames: (dir: string) => readonly string[];
  readonly mkdirp: (dir: string) => void;
  readonly writeMarker: (path: string, body: string) => void;
  /** Securely remove one path (file or empty dir). Tests inject plain unlink/rm. */
  readonly removePath: (path: string) => void;
}

export interface CreateDummyPersonaOpts {
  readonly memoryRoot: string;
  readonly personaId: string;
}

export interface WipeDummyPersonaOpts {
  readonly memoryRoot: string;
  readonly personaId: string;
  readonly targetId: string;
  readonly requestedByUserId: string;
  readonly consents: CascadeConsents;
  /** When true, report would-wipe and touch nothing. Default true. */
  readonly dryRun?: boolean;
}

export type DummyPersonaWipeResult =
  | {
      readonly ok: true;
      readonly dryRun: boolean;
      readonly personaId: string;
      readonly path: string;
      readonly action: "wiped" | "would-wipe" | "already-absent";
      readonly plan: CascadeTeardownPlan;
    }
  | {
      readonly ok: false;
      readonly personaId: string;
      readonly path: string;
      readonly reasons: readonly string[];
      readonly plan?: CascadeTeardownPlan;
      readonly gate?: CascadeAllowedResult;
    };

export function isAllowedDummyPersonaId(personaId: string): boolean {
  return DUMMY_PERSONA_ID_RE.test(personaId);
}

export function dummyPersonaMemoryPath(memoryRoot: string, personaId: string): string {
  return join(memoryRoot, personaId);
}

/** Create an empty dummy persona dir with only the cascade-dummy marker. Refuses real ids. */
export function createEmptyDummyPersona(
  fx: DummyPersonaWipeEffects,
  opts: CreateDummyPersonaOpts,
): { readonly ok: true; readonly path: string } | { readonly ok: false; readonly reasons: readonly string[] } {
  const reasons = validateDummyTarget(opts.memoryRoot, opts.personaId);
  if (reasons.length > 0) return { ok: false, reasons };

  const path = dummyPersonaMemoryPath(opts.memoryRoot, opts.personaId);
  fx.mkdirp(path);
  fx.writeMarker(join(path, CASCADE_DUMMY_MARKER), "cascade-dummy-empty\n");
  return { ok: true, path };
}

/**
 * Plan + (optionally) wipe a dummy persona memory dir.
 * Never touches real personas. Requires persona consent on the cascade gate.
 */
export function wipeDummyPersonaMemory(
  fx: DummyPersonaWipeEffects,
  opts: WipeDummyPersonaOpts,
): DummyPersonaWipeResult {
  const dryRun = opts.dryRun !== false;
  const path = dummyPersonaMemoryPath(opts.memoryRoot, opts.personaId);
  const preReasons = validateDummyTarget(opts.memoryRoot, opts.personaId);
  if (preReasons.length > 0) {
    return { ok: false, personaId: opts.personaId, path, reasons: preReasons };
  }

  const nodeId = `memory:${opts.personaId}`;
  const plan = planCascadeTeardown({
    target: { id: opts.targetId, ownerUserId: opts.requestedByUserId },
    requestedByUserId: opts.requestedByUserId,
    inventory: {
      extraCare: [
        {
          id: nodeId,
          kind: "persona-memory",
          ownerUserId: opts.requestedByUserId,
          personaId: opts.personaId,
          dependsOn: [opts.targetId],
        },
      ],
    },
  });

  const gate = assertCascadeAllowed(plan, opts.consents);
  if (!gate.ok) {
    return {
      ok: false,
      personaId: opts.personaId,
      path,
      reasons: gate.reasons,
      plan,
      gate,
    };
  }

  if (!fx.exists(path)) {
    return { ok: true, dryRun, personaId: opts.personaId, path, action: "already-absent", plan };
  }

  const contentReasons = assertDummyDirWipeable(fx, path);
  if (contentReasons.length > 0) {
    return { ok: false, personaId: opts.personaId, path, reasons: contentReasons, plan, gate };
  }

  if (dryRun) {
    return { ok: true, dryRun: true, personaId: opts.personaId, path, action: "would-wipe", plan };
  }

  for (const name of fx.listNames(path)) {
    fx.removePath(join(path, name));
  }
  fx.removePath(path);
  return { ok: true, dryRun: false, personaId: opts.personaId, path, action: "wiped", plan };
}

export const realDummyPersonaWipeEffects: DummyPersonaWipeEffects = {
  exists: (p) => existsSync(p),
  listNames: (dir) => (existsSync(dir) ? readdirSync(dir) : []),
  mkdirp: (dir) => mkdirSync(dir, { recursive: true }),
  writeMarker: (path, body) => writeFileSync(path, body, { encoding: "utf8", mode: 0o600 }),
  removePath: (path) => {
    if (!existsSync(path)) return;
    rmSync(path, { recursive: true, force: true });
  },
};

function validateDummyTarget(memoryRoot: string, personaId: string): string[] {
  const reasons: string[] = [];
  if (!isAllowedDummyPersonaId(personaId)) {
    reasons.push(
      `${personaId}: refused — live wipe harness only allows dummy-* persona ids (never a real persona)`,
    );
  }
  if (memoryRoot.length === 0) {
    reasons.push("memoryRoot: empty — refuse (would be unsafe)");
  }
  // Hard refuse if caller points at the repo's tracked memory/ tree by basename convention
  // when the path ends with `/memory` AND persona is not dummy — already covered by id check.
  // Also refuse absolute paths that look like the canonical repo memory folder name without sandbox.
  if (/(^|\/)memory$/.test(memoryRoot.replace(/\\/g, "/")) && !memoryRoot.includes("cascade-dummy-sandbox")) {
    reasons.push(
      `memoryRoot: looks like a real memory/ tree (${memoryRoot}) — use a *cascade-dummy-sandbox* temp root`,
    );
  }
  return reasons;
}

function assertDummyDirWipeable(fx: DummyPersonaWipeEffects, path: string): string[] {
  const names = fx.listNames(path);
  if (names.length === 0) return [];
  if (names.length === 1 && names[0] === CASCADE_DUMMY_MARKER) return [];
  return [
    `${path}: refused — dummy dir is not empty (only ${CASCADE_DUMMY_MARKER} or empty allowed; no real data)`,
  ];
}
