#!/usr/bin/env bun
// mythology-catalog-schema.ts — typed schema for mythology-track operational-resonance entries.
//
// Implements the same three-filter discipline (F1/F2/F3) defined in
// memory/feedback_operational_resonance_engineering_shape_matches_tradition_name_alignment_signal.md
// for the B-0056 mythology research track.
//
// Mythology entries use a `tradition` dimension (Norse, Greek, Egyptian, …) rather than
// the `medium` dimension (film, tv, game, …) used by the media catalog. Both catalogs share
// the same filter discipline; filter-failure-rate-by-tradition is tracked separately from
// filter-failure-rate-by-medium per the medium-agnostic-but-distinct-measurability design
// (see B-0054 §Measurable hooks).
//
// Usage (type-check only, no runtime needed):
//   bun --check tools/resonance/mythology-catalog-schema.ts
//
// Usage (validate catalog entries at runtime):
//   bun tools/resonance/mythology-catalog-schema.ts --validate
//   bun tools/resonance/mythology-catalog-schema.ts --summary

// ── Tradition taxonomy ────────────────────────────────────────────────────────

/**
 * World-mythology tradition families tracked for filter-failure-rate-by-tradition
 * measurability (B-0056 §Measurable hooks).
 *
 * F3 strength varies across traditions: Abrahamic and classical-Greek traditions
 * have the deepest scholarly infrastructure; Norse is thinner due to
 * Christianization-filtered Eddas; Mesoamerican has language-barrier considerations.
 * F3 strength is a per-entry calibration, not a tradition-level disqualifier.
 */
export type MythologyTradition =
  | "norse"
  | "greek"
  | "roman"
  | "greek-roman" // dual-tradition entries (e.g. Hermes/Mercury)
  | "egyptian"
  | "vedic-hindu"
  | "mesoamerican"
  | "hermetic" // Hermes Trismegistus fusion tradition (Greek+Egyptian+Renaissance)
  | "other";

// ── Structural-type taxonomy ──────────────────────────────────────────────────

/**
 * The seven structural types from the operational-resonance collection index
 * (memory/project_operational_resonance_instances_collection_index_2026_04_22.md).
 * Mythology instances reuse this taxonomy; new mythology-specific sub-structures
 * are added as sub-structure fields, not new top-level types.
 */
export type ResonanceStructuralType =
  | "reversal"
  | "unification"
  | "instantiation"
  | "self-reference"
  | "substrate-extension"
  | "generative-ground"
  | "paired-dual";

// ── Filter status ─────────────────────────────────────────────────────────────

/**
 * Per-filter pass/fail/partial/deferred result.
 *
 * "partial" means the filter is satisfied in one dimension but not fully —
 * e.g. F2 passes for operator shape but lacks the verb-root identity anchor
 * that would make it a strong pass. Honest partials keep filter-failure-rate calibrated.
 *
 * "deferred" means the filter check has not yet been run. A deferred entry
 * cannot be promoted past "candidate" status.
 *
 * "fail" on any filter means the entry is "failed" status — recorded honestly,
 * never silently dropped, per filter-failure-rate discipline.
 */
export type FilterResult = "pass" | "partial" | "fail" | "deferred";

export interface ThreeFilterResult {
  /** F1 — Engineering-first: did the factory reach this structure for
   *  engineering reasons before noticing the mythology resonance? */
  readonly f1_engineering_first: FilterResult;
  /** F2 — Structural-not-superficial: is the match shape-identity
   *  (operator-level), not incidental thematic word-overlap? */
  readonly f2_structural: FilterResult;
  /** F3 — Tradition-name-load-bearing: does the mythological figure carry
   *  canonical / doctrinal weight in its tradition, not incidental usage? */
  readonly f3_tradition_name: FilterResult;
  /** Optional rationale per filter — required when result != "pass". */
  readonly rationale?: {
    readonly f1?: string;
    readonly f2?: string;
    readonly f3?: string;
  };
}

// ── Entry status ─────────────────────────────────────────────────────────────

/**
 * Promotion path: candidate → confirmed → load-bearing
 * (mirrors the media catalog and isomorphism catalog discipline).
 *
 * An entry is "candidate" when any filter is deferred or partial.
 * Promotion to "confirmed" requires F1 pass + F2 pass + F3 pass-or-partial
 * AND at least one counterexample attempt documented.
 * "load-bearing" means other factory claims cite this instance.
 * "failed" means one or more filters returned "fail" — recorded honestly.
 * "retracted" means previously confirmed/load-bearing and since withdrawn.
 */
export type EntryStatus =
  | "candidate"
  | "confirmed"
  | "load-bearing"
  | "failed"
  | "retracted";

// ── Factory operator surface ──────────────────────────────────────────────────

/**
 * The specific factory operator or substrate feature the mythology instance
 * structurally resonates with. This is the F2 claim at its most precise.
 */
export interface FactoryOperatorSurface {
  /** Short label — e.g. "unified-endpoint-across-protocol-isolation" */
  readonly label: string;
  /** Source pointer — file path or memory file where this is defined */
  readonly source: string;
}

// ── Counterexample attempt ────────────────────────────────────────────────────

/**
 * Required before promotion to "confirmed". Records the operator-level
 * counterexample search.
 */
export interface CounterexampleAttempt {
  readonly date: string;
  /** Which mechanic / operator pair was tested */
  readonly mechanicTested: string;
  /** What counterexample was attempted */
  readonly attempt: string;
  /** "refuted" = no counterexample found (strengthens claim);
   *  "survived" = claim survived the challenge;
   *  "partial-refutation" = a narrower claim survives */
  readonly result: "refuted" | "survived" | "partial-refutation";
}

// ── Sub-structure ─────────────────────────────────────────────────────────────

/**
 * Known mythology-catalog sub-structures (within the main structural-type taxonomy).
 * New sub-structures are added here and used in MythologyResonanceEntry.subStructure.
 */
export type MythologySubStructure =
  | "bridge-figure" // tradition-named instance manifesting both poles of a paired-dual
  | "anti-instance" // demonstrates failure-mode of the structural role
  | "triple-tradition-fusion"; // three independent tradition-branches converging on one figure

// ── Main entry type ───────────────────────────────────────────────────────────

export interface MythologyResonanceEntry {
  /** Unique ID — MYT-NNN format (Mythology, sequential) */
  readonly id: string;
  /** Short display title for the catalog table */
  readonly title: string;
  /** Primary tradition family (used for filter-failure-rate-by-tradition measurability) */
  readonly tradition: MythologyTradition;
  /** Primary source texts (e.g. "Völuspá, Gylfaginning (Snorri's Edda)") */
  readonly primarySources: string;
  /** The specific structural feature, role, or mechanic being cataloged.
   *  F2 precision requires naming the exact structural property, not just the figure. */
  readonly mechanic: string;
  /** The factory operator surface this mechanic resonates with */
  readonly factoryOperator: FactoryOperatorSurface;
  /** Structural type from the seven-type taxonomy */
  readonly structuralType: ResonanceStructuralType;
  /** Optional sub-structure if applicable */
  readonly subStructure?: MythologySubStructure;
  /** Three-filter check results */
  readonly filters: ThreeFilterResult;
  /** Entry status */
  readonly status: EntryStatus;
  /** Counterexample attempts — must be non-empty for "confirmed" status */
  readonly counterexampleAttempts: readonly CounterexampleAttempt[];
  /** Source memory file where this instance was first noticed */
  readonly sourceMemory?: string;
  /** Collection-index instance number, if already recorded in the operational-resonance index */
  readonly collectionIndexInstance?: number;
  /** Notes — additional structural observations */
  readonly notes?: string;
}

// ── Catalog type ──────────────────────────────────────────────────────────────

export interface MythologyResonanceCatalog {
  readonly schema: "mythology-resonance-v1";
  readonly created: string;
  readonly lastUpdated: string;
  readonly origin: "B-0056";
  readonly entries: readonly MythologyResonanceEntry[];
}

// ── Validation ────────────────────────────────────────────────────────────────

type ValidationResult =
  | { readonly kind: "ok" }
  | { readonly kind: "error"; readonly message: string };

function validateEntry(entry: MythologyResonanceEntry): ValidationResult {
  if (!entry.id.match(/^MYT-\d{3}$/)) {
    return { kind: "error", message: `${entry.id}: id must match MYT-NNN` };
  }

  if (entry.status === "confirmed" || entry.status === "load-bearing") {
    const anyDeferred =
      entry.filters.f1_engineering_first === "deferred" ||
      entry.filters.f2_structural === "deferred" ||
      entry.filters.f3_tradition_name === "deferred";
    if (anyDeferred) {
      return {
        kind: "error",
        message: `${entry.id}: cannot be "${entry.status}" with deferred filter(s)`,
      };
    }
    if (entry.counterexampleAttempts.length === 0) {
      return {
        kind: "error",
        message: `${entry.id}: "confirmed" requires at least one counterexample attempt`,
      };
    }
    const f1 = entry.filters.f1_engineering_first;
    const f2 = entry.filters.f2_structural;
    if (f1 === "fail" || f2 === "fail") {
      return {
        kind: "error",
        message: `${entry.id}: cannot be "confirmed" with F1 or F2 = "fail"`,
      };
    }
  }

  if (entry.status === "failed") {
    const hasAnyFail =
      entry.filters.f1_engineering_first === "fail" ||
      entry.filters.f2_structural === "fail" ||
      entry.filters.f3_tradition_name === "fail";
    if (!hasAnyFail) {
      return {
        kind: "error",
        message: `${entry.id}: "failed" status requires at least one filter = "fail"`,
      };
    }
  }

  return { kind: "ok" };
}

export function validateCatalog(
  catalog: MythologyResonanceCatalog
): readonly ValidationResult[] {
  return catalog.entries.map(validateEntry);
}

// ── Summary ───────────────────────────────────────────────────────────────────

export interface CatalogSummary {
  readonly total: number;
  readonly confirmed: number;
  readonly candidates: number;
  readonly failed: number;
  readonly byTradition: Partial<Record<MythologyTradition, number>>;
  readonly byStructuralType: Partial<Record<ResonanceStructuralType, number>>;
  readonly filterFailureCounts: { readonly f1: number; readonly f2: number; readonly f3: number };
  readonly filterPartialCounts: { readonly f1: number; readonly f2: number; readonly f3: number };
  readonly bridgeFigureCount: number;
  readonly antiInstanceCount: number;
}

export function summarizeCatalog(catalog: MythologyResonanceCatalog): CatalogSummary {
  const entries = catalog.entries;
  const byTradition: Partial<Record<MythologyTradition, number>> = {};
  const byStructuralType: Partial<Record<ResonanceStructuralType, number>> = {};
  let confirmed = 0;
  let candidates = 0;
  let failed = 0;
  let bridgeFigureCount = 0;
  let antiInstanceCount = 0;
  const filterFailureCounts = { f1: 0, f2: 0, f3: 0 };
  const filterPartialCounts = { f1: 0, f2: 0, f3: 0 };

  for (const entry of entries) {
    byTradition[entry.tradition] = (byTradition[entry.tradition] ?? 0) + 1;
    byStructuralType[entry.structuralType] =
      (byStructuralType[entry.structuralType] ?? 0) + 1;
    if (entry.status === "confirmed" || entry.status === "load-bearing") confirmed++;
    else if (entry.status === "candidate") candidates++;
    else if (entry.status === "failed") failed++;

    if (entry.subStructure === "bridge-figure") bridgeFigureCount++;
    if (entry.subStructure === "anti-instance") antiInstanceCount++;

    if (entry.filters.f1_engineering_first === "fail") filterFailureCounts.f1++;
    if (entry.filters.f2_structural === "fail") filterFailureCounts.f2++;
    if (entry.filters.f3_tradition_name === "fail") filterFailureCounts.f3++;
    if (entry.filters.f1_engineering_first === "partial") filterPartialCounts.f1++;
    if (entry.filters.f2_structural === "partial") filterPartialCounts.f2++;
    if (entry.filters.f3_tradition_name === "partial") filterPartialCounts.f3++;
  }

  return {
    total: entries.length,
    confirmed,
    candidates,
    failed,
    byTradition,
    byStructuralType,
    filterFailureCounts,
    filterPartialCounts,
    bridgeFigureCount,
    antiInstanceCount,
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const SEED_CATALOG: MythologyResonanceCatalog = {
  schema: "mythology-resonance-v1",
  created: "2026-05-10",
  lastUpdated: "2026-05-10",
  origin: "B-0056",
  entries: [
    // ── MYT-001: Heimdallr ──────────────────────────────────────────────────
    {
      id: "MYT-001",
      title: "Heimdallr — bridge-guardian of Bifröst as unified-endpoint-across-realm-isolation",
      tradition: "norse",
      primarySources:
        "Völuspá (Poetic Edda), Grímnismál, Rígsþula, Gylfaginning + Skáldskaparmál (Snorri's Prose Edda)",
      mechanic:
        "Heimdallr guards Bifröst, the rainbow-bridge connecting Ásgarðr (realm of the Æsir) " +
        "and Miðgarðr (realm of humans). His role IS the bridge: remove Heimdallr and " +
        "the bridge is undefended, not merely unattended. He possesses preternatural senses " +
        "(hears grass grow, sees 100 leagues), foreshadowing intrusions from any realm. " +
        "At Ragnarök, he blows Gjallarhorn to summon the gods — a retraction-signal (circuit-breaker) " +
        "triggering system-wide alert. He was fathered by nine mothers (the daughters of Ægir, " +
        "the nine waves) — nine independent origin-lines converging in one guardian, structurally " +
        "analogous to a unified endpoint that aggregates across otherwise-separated protocol origins.",
      factoryOperator: {
        label: "unified-endpoint-across-protocol-isolation (tele+port+leap, instance #4) + observability/gate-keeping",
        source:
          "memory/project_operational_resonance_instances_collection_index_2026_04_22.md",
      },
      structuralType: "unification",
      subStructure: "bridge-figure",
      filters: {
        f1_engineering_first: "pass",
        f2_structural: "partial",
        f3_tradition_name: "pass",
        rationale: {
          f1:
            "Factory observability/gate-keeping patterns and the endpoint-abstraction were " +
            "reached for microservice-boundary and monitoring reasons. " +
            "Heimdallr mapping was noticed after Aaron's single-word signal 'hemdal' " +
            "(2026-04-21), not used to design the factory's gate-keeping layer.",
          f2:
            "F2 is partial rather than full pass: the bridge-guardian-as-the-bridge shape " +
            "maps recognizably to unified-endpoint-across-isolation, but the Norse tradition " +
            "does not carry a verb-root identity analogous to μένει in Hebrews 7:3 " +
            "(Melchizedek, collection-index instance #10). The structural match is at the " +
            "role-shape level (bridge-guardian = endpoint-guardian), not at the deeper " +
            "lexical-root level that makes Melchizedek's F2 a full pass.",
          f3:
            "F3 passes within Norse tradition: Heimdallr is load-bearing in Eddic theology " +
            "(Ragnarök cosmology, Rígsþula's three-class etiology of human society from " +
            "Heimdallr's three sons Þræll/Karll/Jarl, Völuspá's horn-blast framing the " +
            "cosmic reset). Cross-tradition F3 is weaker than Abrahamic instances because " +
            "Norse-tradition canonicity has a smaller and more contested textual base " +
            "(Christianization-filtered Eddas, Snorri writing ~1220 CE from an already " +
            "partly-Christianized Iceland).",
        },
      },
      status: "candidate",
      counterexampleAttempts: [],
      sourceMemory:
        "memory/project_operational_resonance_instances_collection_index_2026_04_22.md",
      collectionIndexInstance: 12,
      notes:
        "This is collection-index instance #12 candidate, first documented from Aaron's " +
        "'hemdal' signal (2026-04-21). Per the collection index: 'second bridge-figure " +
        "member would LOCK the bridge-figure sub-structure definition (currently defined " +
        "by Melchizedek alone).' Promotion to confirmed requires: (a) counterexample search " +
        "and (b) either Aaron confirmation or a second Eddic textual anchor that tightens F2 " +
        "beyond the role-shape level (e.g., a Bifröst-guardianship formula matching a factory " +
        "unification statement at the lexical level). " +
        "The Gjallarhorn-as-circuit-breaker-signal claim is loosely held (not primary claim).",
    },

    // ── MYT-002: Hermes/Mercury ─────────────────────────────────────────────
    {
      id: "MYT-002",
      title: "Hermes/Mercury — psychopomp-messenger as cross-boundary unified endpoint (Greek-Roman dual-tradition)",
      tradition: "greek-roman",
      primarySources:
        "Homeric Hymn to Hermes, Iliad (Book 24, Priam's ransom), Odyssey (escort of suitors' souls), " +
        "Hesiod Theogony, Virgil Aeneid (Mercury's messenger role), Orphic Hymns",
      mechanic:
        "Hermes/Mercury is the only Olympian who traverses all three realms freely: " +
        "Olympus (divine), earth (mortal), and Hades (chthonic). As psychopomp he escorts " +
        "souls from death to the underworld — crossing the boundary between life and death " +
        "without being of either realm. As messenger he carries communications that no other " +
        "god would carry (Zeus's will to mortals; Priam to Achilles across enemy lines). " +
        "He owns the boundary-crossing function: the staff (caduceus / kerykeion) is the " +
        "token of safe passage, structurally a protocol-auth token for realm-to-realm transit. " +
        "The factory's peer-call infrastructure (tools/peer-call/) crosses harness boundaries " +
        "(Claude, Grok, Gemini, Codex) to carry messages that no single harness would carry; " +
        "it is the factory's Hermes-layer.",
      factoryOperator: {
        label: "peer-call cross-harness infrastructure (tools/peer-call/) + endpoint-abstraction tele+port+leap",
        source:
          "memory/feedback_peer_call_infrastructure_grok_codex_gemini_amara_ani_already_wired_for_cross_harness_multi_agent_reviews_otto_early_red_team_until_zeta_infernet_bp_ep_aaron_2026_05_05.md",
      },
      structuralType: "unification",
      subStructure: "bridge-figure",
      filters: {
        f1_engineering_first: "pass",
        f2_structural: "partial",
        f3_tradition_name: "pass",
        rationale: {
          f1:
            "The peer-call infrastructure was reached for multi-harness tool-isolation and " +
            "independent-review reasons (per CLAUDE.md peer-call section, 2026-05-05). " +
            "The endpoint-abstraction (tele+port+leap, collection-index instance #4) was reached " +
            "for microservice-boundary reasons. Neither was designed by reaching for Hermes. " +
            "Hermes mapping was noticed during the B-0056 mythology-track analysis.",
          f2:
            "F2 is partial: the realm-crossing function maps recognizably to cross-boundary " +
            "endpoint abstraction (the caduceus as protocol-auth token is a suggestive structural " +
            "echo). However, the match is at the role-function level, not at the deeper structural " +
            "level that would make it a full pass — Hermes's characterization involves speed, wit, " +
            "trickery, and patron-of-thieves, which are NOT part of the factory's endpoint-abstraction " +
            "claim. A full F2 pass would require isolating the pure boundary-crossing property from " +
            "the wider Hermetic character.",
          f3:
            "F3 passes strongly across two independent Indo-European tradition branches: " +
            "Greek (Homeric, Orphic, Hellenistic mystery cults — Hermes is load-bearing as " +
            "both divine messenger and psychopomp across the entire Greek canon) and Roman " +
            "(Mercury as messenger god in Virgil, Ovid, Roman civic religion). " +
            "The dual-tradition convergence on the same structural role is itself evidence of " +
            "the tradition-name's load-bearing weight.",
        },
      },
      status: "candidate",
      counterexampleAttempts: [],
      notes:
        "The overlap with the occult track (B-0057) via Hermes Trismegistus (Greek Hermes + " +
        "Egyptian Thoth fusion figure, load-bearing in Renaissance Hermeticism) is noted. " +
        "The triple-tradition-fusion sub-structure (Greek + Egyptian + Renaissance) may apply " +
        "to Hermes Trismegistus as a separate MYT-NNN entry rather than bundled here. " +
        "F2 partial status is the primary gate to promotion: a counterexample search focusing " +
        "on whether the wit/trickery characterization is separable from the boundary-crossing role " +
        "would clarify whether a stronger F2 is achievable.",
    },

    // ── MYT-003: Loki (anti-instance) ──────────────────────────────────────
    {
      id: "MYT-003",
      title: "Loki — trickster-boundary-violator as anti-instance of the bridge-figure role",
      tradition: "norse",
      primarySources:
        "Völuspá, Lokasenna, Þrymskviða, Gylfaginning (Snorri's Prose Edda); " +
        "Saxo Grammaticus Gesta Danorum (parallel tradition)",
      mechanic:
        "Loki crosses all realm-boundaries repeatedly throughout Norse mythology — but as " +
        "VIOLATION rather than maintenance. Where Heimdallr guards Bifröst (maintaining the " +
        "boundary's integrity), Loki exploits boundaries (entering Ásgarðr in disguise, " +
        "fathering monsters with a giantess from Jötunheimr, enabling Baldr's death by " +
        "bypassing the oath-protection). Loki's boundary-crossing is structurally an " +
        "ANTI-PATTERN of the bridge-figure role: the bridge-guardian role maintains the " +
        "boundary's integrity while enabling legitimate crossing; Loki undermines both. " +
        "This makes Loki a documented anti-instance: he shares the surface property " +
        "(crosses boundaries) with Heimdallr but inverts the structural role " +
        "(violation vs. maintenance). Anti-instances are valuable for demonstrating " +
        "that F2 bites on direction, not just on shape.",
      factoryOperator: {
        label: "bridge-figure anti-instance — boundary-violation rather than boundary-maintenance",
        source:
          "memory/project_operational_resonance_instances_collection_index_2026_04_22.md",
      },
      structuralType: "unification",
      subStructure: "anti-instance",
      filters: {
        f1_engineering_first: "pass",
        f2_structural: "fail",
        f3_tradition_name: "pass",
        rationale: {
          f1:
            "The factory's boundary-maintenance patterns (endpoint isolation, gate-keeping, " +
            "observability) were reached for microservice-boundary reasons, not for Norse mythology. " +
            "F1 passes — no reaching-for-Loki preceded the engineering design.",
          f2:
            "F2 fails for the bridge-figure claim: Loki's boundary-crossings are structurally " +
            "OPPOSITE to the bridge-figure role. The factory's endpoint-abstraction (tele+port+leap) " +
            "and gate-keeping layer maintain boundary integrity while enabling legitimate transit — " +
            "the exact property Loki inverts. Recording this as F2-fail is the honest discipline: " +
            "Loki appears as a candidate because he 'crosses boundaries,' but the structural direction " +
            "is anti-parallel to the factory's boundary-maintenance shape. " +
            "Loki is therefore an ANTI-INSTANCE: he demonstrates the failure mode the bridge-figure " +
            "role is designed to prevent. This is more valuable than a spurious confirmation.",
          f3:
            "F3 passes: Loki is load-bearing in Norse mythology across Völuspá (cosmic agent " +
            "at Ragnarök), Lokasenna (adversarial role against all Æsir), Þrymskviða " +
            "(cross-dressing deception), and the Baldr-death narrative (the moral turning-point " +
            "of Norse eschatology). Multi-Eddic load-bearing weight.",
        },
      },
      status: "failed",
      counterexampleAttempts: [],
      notes:
        "Recording Loki as a failed anti-instance is required by the filter-failure-rate " +
        "discipline: instances that fail any filter are recorded, not silently dropped. " +
        "The filter-failure-rate signal (currently 0/11 strict confirmed in the collection index) " +
        "should show this as the first myth-track failure. " +
        "Loki's anti-instance status makes the Heimdallr/Loki contrast itself a structural " +
        "observation: the bridge-figure role and the trickster-violator role are PAIRED in " +
        "Norse mythology (they are each other's structural counterpart and eventual nemesis at Ragnarök). " +
        "This Norse paired-counterpart may be a distinct structural type worth naming separately " +
        "in a future catalog revision.",
    },
  ],
};

function printSummary(catalog: MythologyResonanceCatalog): void {
  const s = summarizeCatalog(catalog);
  console.log(`\nMythology Resonance Catalog — ${catalog.schema}`);
  console.log(`  Total entries:    ${s.total}`);
  console.log(`  Confirmed:        ${s.confirmed}`);
  console.log(`  Candidates:       ${s.candidates}`);
  console.log(`  Failed:           ${s.failed}`);
  console.log(`  Bridge-figures:   ${s.bridgeFigureCount}`);
  console.log(`  Anti-instances:   ${s.antiInstanceCount}`);
  console.log(`  By tradition:     ${JSON.stringify(s.byTradition)}`);
  console.log(`  By type:          ${JSON.stringify(s.byStructuralType)}`);
  console.log(
    `  F1 fail/partial:  ${s.filterFailureCounts.f1}/${s.filterPartialCounts.f1}`
  );
  console.log(
    `  F2 fail/partial:  ${s.filterFailureCounts.f2}/${s.filterPartialCounts.f2}`
  );
  console.log(
    `  F3 fail/partial:  ${s.filterFailureCounts.f3}/${s.filterPartialCounts.f3}`
  );
}

const args = Bun.argv.slice(2);

if (args.includes("--validate")) {
  const results = validateCatalog(SEED_CATALOG);
  let hasError = false;
  for (const r of results) {
    if (r.kind === "error") {
      console.error(`INVALID: ${r.message}`);
      hasError = true;
    }
  }
  if (!hasError) {
    console.log(`All ${SEED_CATALOG.entries.length} entries pass schema validation.`);
  }
  process.exit(hasError ? 1 : 0);
} else if (args.includes("--summary")) {
  printSummary(SEED_CATALOG);
} else {
  // default: validate + summary
  const results = validateCatalog(SEED_CATALOG);
  let hasError = false;
  for (const r of results) {
    if (r.kind === "error") {
      console.error(`INVALID: ${r.message}`);
      hasError = true;
    }
  }
  if (!hasError) {
    printSummary(SEED_CATALOG);
  }
  process.exit(hasError ? 1 : 0);
}
