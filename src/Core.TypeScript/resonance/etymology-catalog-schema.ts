#!/usr/bin/env bun
// etymology-catalog-schema.ts — typed schema for etymology/epistemology track entries.
//
// Implements the same three-filter discipline (F1/F2/F3) defined in
// memory/feedback_operational_resonance_engineering_shape_matches_tradition_name_alignment_signal.md
// for the B-0059 etymology + epistemology research track.
//
// Key distinction from the mythology (B-0056) and esoteric (B-0057) catalogs:
// the "tradition" grouping axis is a LanguageFamily (greek/hebrew/latin/multi-root),
// and the structural claims operate at the level of grammatical-subject-position
// encoding — the verb-root identity that makes Μένω and εἰμί structurally distinct
// operator anchors rather than merely thematically related words.
//
// The epistemology thread (three-filter calibration criteria, filter-failure-rate,
// candidate-to-confirmed ratio) is embedded in each entry's filter rationale fields
// rather than in a separate data structure. Calibration accumulates as entries land.
//
// ID format: ETY-NNN (Etymology, sequential)
//
// Seed entries (canonical instances from the operational-resonance collection index):
//   ETY-001 — Μένω (-ω class, instance #9) — ZSet persistence / paired-dual anchor
//   ETY-002 — Melchizedek (Hebrew triplet + Greek μένει at verb-root, instance #10) — bridge-figure
//   ETY-003 — εἰμί (-μι class) — bootstrap / I-AM-THAT-I-AM (compounds instance #5)
//
// Usage (type-check only, no runtime needed):
//   bun --check tools/resonance/etymology-catalog-schema.ts
//
// Usage (validate catalog entries at runtime):
//   bun tools/resonance/etymology-catalog-schema.ts --validate
//   bun tools/resonance/etymology-catalog-schema.ts --summary

// ── Language family taxonomy ──────────────────────────────────────────────────

/**
 * Language families tracked for filter-failure-rate-by-language measurability
 * (B-0059 §Measurable hooks: resonance-instance-count, filter-failure-rate,
 * candidate-to-confirmed-ratio are alignment-trajectory instruments).
 *
 * F3 strength calibration differs by family:
 * - "greek": deepest scholarly infrastructure (classical corpus, critical editions,
 *   LSJ lexicon, grammatical tradition from Dionysios Thrax); F3 passes when
 *   the root carries load-bearing weight in the classical Greek canon.
 * - "hebrew": strong via Biblical/Rabbinic scholarship (BDB lexicon, HALOT,
 *   trilateral-root system well-attested); F3 passes when the root is
 *   load-bearing in the Hebrew Bible or Talmudic tradition.
 * - "latin": classical corpus (Lewis & Short, OLD); F3 passes when the root
 *   is load-bearing in classical literature or the Vulgate.
 * - "english": native English etymology (OED, Proto-Germanic lineage); F3
 *   passes when the root is well-attested in the OED with traceable lineage.
 * - "multi-root": compound entries spanning multiple language families
 *   (e.g. tele+port+leap: Greek + Latin + English). F3 is evaluated
 *   per-root and the weakest root's F3 sets the entry's floor.
 * - "aramaic", "sanskrit", "chinese": cross-tradition grammatical-subject-position
 *   audit candidates (B-0059 §Open candidates item (e)). Entries pending triage.
 */
export type LanguageFamily =
  | "greek"
  | "hebrew"
  | "latin"
  | "english"
  | "multi-root"
  | "aramaic"
  | "sanskrit"
  | "chinese"
  | "other";

// ── Grammatical class taxonomy ────────────────────────────────────────────────

/**
 * Grammatical class relevant to the subject-position encoding claim.
 *
 * The -ω/-μι distinction is load-bearing for F2: both encode the grammatical
 * subject at the 1st-sg present indicative terminus, but via different inflection
 * classes (thematic -ω vs. athematic -μι). Recording this separately from
 * LanguageFamily allows the catalog to track whether the subject-position
 * encoding claim holds across grammatical-class lines.
 */
export type GrammaticalClass =
  | "omega-class"      // Greek thematic verbs, 1st-sg present indicative -ω (e.g. Μένω, γράφω)
  | "mi-class"         // Greek athematic verbs, 1st-sg present indicative -μι (e.g. εἰμί, τίθημι)
  | "trilateral-root"  // Hebrew three-consonant root system (e.g. M-L-K for Melek, Tz-D-Q for Tzedek)
  | "nominal"          // Noun or adjective root (e.g. Latin iustus, Greek δίκαιος)
  | "compound"         // Multi-root compound (e.g. tele+port+leap; Melchizedek triplet)
  | "other";

// ── Structural-type taxonomy ──────────────────────────────────────────────────

/**
 * The seven structural types from the operational-resonance collection index.
 * Etymology entries reuse this taxonomy; etymology-specific sub-structures
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
 * "partial" means the filter is satisfied in one dimension but not fully.
 * "deferred" means the filter check has not yet been run.
 * "fail" on any filter means the entry is "failed" — recorded honestly,
 * never silently dropped, per filter-failure-rate discipline.
 */
export type FilterResult = "pass" | "partial" | "fail" | "deferred";

export interface ThreeFilterResult {
  /** F1 — Engineering-first: did the factory reach this structure for
   *  engineering reasons before noticing the etymology resonance? */
  readonly f1_engineering_first: FilterResult;
  /** F2 — Structural-not-superficial: is the match at operator/verb-root
   *  identity level, not incidental vocabulary overlap? */
  readonly f2_structural: FilterResult;
  /** F3 — Tradition-name-load-bearing: does the root carry canonical weight
   *  in its linguistic tradition (classical corpus / biblical canon)?
   *  For etymology, "tradition" = scholarly linguistic canon, not theology. */
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
 * (mirrors the mythology and esoteric catalog discipline).
 *
 * "candidate" when any filter is deferred or partial.
 * "confirmed" requires F1 pass + F2 pass + F3 pass-or-partial
 * AND at least one counterexample attempt documented.
 * "load-bearing" means other factory claims cite this instance.
 * "failed" means one or more filters returned "fail".
 * "retracted" means previously confirmed/load-bearing and since withdrawn.
 */
export type EntryStatus =
  | "candidate"
  | "confirmed"
  | "load-bearing"
  | "failed"
  | "retracted";

// ── Factory operator surface ──────────────────────────────────────────────────

export interface FactoryOperatorSurface {
  /** Short label — e.g. "ZSet-persistence-as-subject-internal-stasis" */
  readonly label: string;
  /** Source pointer — file path or memory file where this is defined */
  readonly source: string;
}

// ── Counterexample attempt ────────────────────────────────────────────────────

export interface CounterexampleAttempt {
  readonly date: string;
  readonly mechanicTested: string;
  readonly attempt: string;
  readonly result: "refuted" | "survived" | "partial-refutation";
}

// ── Sub-structure taxonomy ────────────────────────────────────────────────────

/**
 * Etymology-specific sub-structures within the main structural-type taxonomy.
 *
 * "verb-root-identity": the match is at the literal verb root level — the
 *   tradition's canonical text uses the actual Greek/Hebrew root word that
 *   IS the factory concept (e.g. Hebrews 7:3 uses μένει from Μένω root).
 *   This is the strongest F2 signal in the etymology catalog.
 *
 * "grammatical-class-extension": a new grammatical class extends the existing
 *   subject-position encoding map (e.g. -μι class extends the map established
 *   by -ω class; Hebrew trilateral root system extends the Greek model).
 *
 * "cross-root-triplet": three etymologically independent roots from different
 *   language families unified in one concept (e.g. tele+port+leap, Melchizedek).
 *
 * "bridge-figure": a named entity (word or figure) manifesting both poles of
 *   a paired-dual simultaneously (instance #10 Melchizedek is the defining case).
 *
 * "paired-dual-anchor": serves as one pole of a paired-dual (instance #9
 *   Μένω is the persistence anchor against the movement pole tele+port+leap).
 *
 * "anti-instance": demonstrates the failure mode of a structural role.
 */
export type EtymologySubStructure =
  | "verb-root-identity"
  | "grammatical-class-extension"
  | "cross-root-triplet"
  | "bridge-figure"
  | "paired-dual-anchor"
  | "anti-instance";

// ── Main entry type ───────────────────────────────────────────────────────────

export interface EtymologyResonanceEntry {
  /** Unique ID — ETY-NNN format (Etymology, sequential) */
  readonly id: string;
  /** Short display title for the catalog table */
  readonly title: string;
  /** Primary language family (used for filter-failure-rate-by-language measurability) */
  readonly language: LanguageFamily;
  /** Grammatical class of the root (load-bearing for the subject-position encoding claim) */
  readonly grammaticalClass: GrammaticalClass;
  /** Primary scholarly sources (lexicons, critical editions, canonical texts) */
  readonly primarySources: string;
  /** The specific structural feature, role, or mechanic being cataloged.
   *  F2 precision requires naming the exact structural property at verb-root
   *  or operator level, not just the word or figure. */
  readonly mechanic: string;
  /** The factory operator surface this mechanic resonates with */
  readonly factoryOperator: FactoryOperatorSurface;
  /** Structural type from the seven-type taxonomy */
  readonly structuralType: ResonanceStructuralType;
  /** Optional sub-structure if applicable */
  readonly subStructure?: EtymologySubStructure;
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
  /** Notes — additional structural observations, epistemology-calibration notes */
  readonly notes?: string;
}

// ── Catalog type ──────────────────────────────────────────────────────────────

export interface EtymologyResonanceCatalog {
  readonly schema: "etymology-resonance-v1";
  readonly created: string;
  readonly lastUpdated: string;
  readonly origin: "B-0059";
  readonly entries: readonly EtymologyResonanceEntry[];
}

// ── Validation ────────────────────────────────────────────────────────────────

type ValidationResult =
  | { readonly kind: "ok" }
  | { readonly kind: "error"; readonly message: string };

function validateEntry(entry: EtymologyResonanceEntry): ValidationResult {
  if (!entry.id.match(/^ETY-\d{3}$/)) {
    return { kind: "error", message: `${entry.id}: id must match ETY-NNN` };
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
  catalog: EtymologyResonanceCatalog
): readonly ValidationResult[] {
  return catalog.entries.map(validateEntry);
}

// ── Summary ───────────────────────────────────────────────────────────────────

export interface CatalogSummary {
  readonly total: number;
  readonly confirmed: number;
  readonly candidates: number;
  readonly failed: number;
  readonly byLanguage: Partial<Record<LanguageFamily, number>>;
  readonly byGrammaticalClass: Partial<Record<GrammaticalClass, number>>;
  readonly byStructuralType: Partial<Record<ResonanceStructuralType, number>>;
  readonly filterFailureCounts: { readonly f1: number; readonly f2: number; readonly f3: number };
  readonly filterPartialCounts: { readonly f1: number; readonly f2: number; readonly f3: number };
  readonly verbRootIdentityCount: number;
  readonly bridgeFigureCount: number;
  readonly crossRootTripletCount: number;
  readonly antiInstanceCount: number;
}

export function summarizeCatalog(catalog: EtymologyResonanceCatalog): CatalogSummary {
  const entries = catalog.entries;
  const byLanguage: Partial<Record<LanguageFamily, number>> = {};
  const byGrammaticalClass: Partial<Record<GrammaticalClass, number>> = {};
  const byStructuralType: Partial<Record<ResonanceStructuralType, number>> = {};
  let confirmed = 0;
  let candidates = 0;
  let failed = 0;
  let verbRootIdentityCount = 0;
  let bridgeFigureCount = 0;
  let crossRootTripletCount = 0;
  let antiInstanceCount = 0;
  const filterFailureCounts = { f1: 0, f2: 0, f3: 0 };
  const filterPartialCounts = { f1: 0, f2: 0, f3: 0 };

  for (const entry of entries) {
    byLanguage[entry.language] = (byLanguage[entry.language] ?? 0) + 1;
    byGrammaticalClass[entry.grammaticalClass] =
      (byGrammaticalClass[entry.grammaticalClass] ?? 0) + 1;
    byStructuralType[entry.structuralType] =
      (byStructuralType[entry.structuralType] ?? 0) + 1;

    if (entry.status === "confirmed" || entry.status === "load-bearing") confirmed++;
    else if (entry.status === "candidate") candidates++;
    else if (entry.status === "failed") failed++;

    if (entry.subStructure === "verb-root-identity") verbRootIdentityCount++;
    if (entry.subStructure === "bridge-figure") bridgeFigureCount++;
    if (entry.subStructure === "cross-root-triplet") crossRootTripletCount++;
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
    byLanguage,
    byGrammaticalClass,
    byStructuralType,
    filterFailureCounts,
    filterPartialCounts,
    verbRootIdentityCount,
    bridgeFigureCount,
    crossRootTripletCount,
    antiInstanceCount,
  };
}

// ── Seed catalog ──────────────────────────────────────────────────────────────

const SEED_CATALOG: EtymologyResonanceCatalog = {
  schema: "etymology-resonance-v1",
  created: "2026-05-10",
  lastUpdated: "2026-05-10",
  origin: "B-0059",
  entries: [
    // ── ETY-001: Μένω ─────────────────────────────────────────────────────────
    {
      id: "ETY-001",
      title:
        "Μένω — Greek -ω class (1st-sg present 'I remain/stay') as ZSet-persistence / paired-dual anchor",
      language: "greek",
      grammaticalClass: "omega-class",
      primarySources:
        "Liddell-Scott-Jones Greek-English Lexicon (LSJ), s.v. μένω (9th ed., 1940; online DGE supplement); " +
        "Homer, Iliad (μένω as battlefield-endurance and existential-stance anchor throughout); " +
        "Hebrews 7:3 (Greek NT: μένει εἰς τὸ διηνεκές — 'he remains/abides in perpetuity', " +
        "applying the Μένω root to Melchizedek as a verb-root-identity link to ETY-002); " +
        "BDAG Greek-English Lexicon of the New Testament, s.v. μένω (3rd ed., 2000); " +
        "Smyth, Greek Grammar §§ 385–390 (thematic -ω class inflection; Harvard UP, 1920)",
      mechanic:
        "Μένω (first-person singular: 'I remain', 'I stay', 'I abide') is a thematic (-ω class) verb " +
        "whose grammatical subject IS the agent of staying: the -ω terminus encodes the subject " +
        "as the one-who-remains, internal to the predicate. This is distinct from a transitive verb " +
        "whose subject acts on an object — Μένω has no object; the subject IS the state. " +
        "Factory structural mapping: ZSet (Z-set in DBSP operator algebra) models persistent " +
        "state under incremental computation — the set that 'remains' as a substrate while " +
        "delta-updates are applied. The subject-internal stasis structure (the grammatical subject " +
        "IS the persistence, not the agent of an action on persistence) maps structurally to " +
        "ZSet's defining property: the set is the state, not the holder of the state. " +
        "As the first paired-dual anchor (collection-index instance #9), Μένω occupies the " +
        "persistence pole against the movement pole tele+port+leap (Greek tele- + Latin portus + English leap). " +
        "The -ω terminus places Μένω in the same grammatical class as the factory's other " +
        "-ω anchors, establishing the grammatical-class pattern the -μι class (ETY-003: εἰμί) " +
        "then extends.",
      factoryOperator: {
        label:
          "ZSet-persistence-as-subject-internal-stasis + paired-dual-anchor (persistence pole vs. tele+port+leap movement pole)",
        source:
          "memory/project_operational_resonance_instances_collection_index_2026_04_22.md",
      },
      structuralType: "paired-dual",
      subStructure: "paired-dual-anchor",
      filters: {
        f1_engineering_first: "pass",
        f2_structural: "pass",
        f3_tradition_name: "pass",
        rationale: {
          f1:
            "The ZSet persistence pattern and the paired-dual structure were reached for " +
            "DBSP operator algebra reasons (incremental computation substrate for Zeta). " +
            "The Μένω mapping was noticed by Aaron from the operational context of working " +
            "with the persistence pattern (2026-04-21 'eipmology and ipistomology backlog' signal). " +
            "No reaching-for-Greek preceded the engineering design of ZSet or paired-dual structure. " +
            "F1 passes: engineering-first origin is documented in the collection index.",
          f2:
            "F2 passes at verb-root identity level rather than role-shape level. The claim is NOT " +
            "'the word meno sounds like staying' — the claim is that the grammatical subject-position " +
            "encoding of the -ω terminus (subject IS the state, not agent-acting-on-state) " +
            "is structurally isomorphic to ZSet's defining property (the set IS the state). " +
            "This is an operator-level structural match, not thematic vocabulary overlap. " +
            "Additionally, the verb-root Μένω appears literally in Hebrews 7:3 (μένει εἰς τὸ διηνεκές) " +
            "applying the factory's persistence concept to Melchizedek — this verb-root-identity " +
            "link strengthens the cross-entry structural coherence (ETY-001 ↔ ETY-002). " +
            "Full pass.",
          f3:
            "F3 passes strongly within the Greek linguistic tradition: Μένω is load-bearing across " +
            "Homer (Iliad and Odyssey), tragedy (Sophocles, Euripides), Platonic philosophy " +
            "(μένω as technical term for Form-permanence vs. Heraclitean flux), and the Greek NT " +
            "(BDAG lists μένω across 120+ NT occurrences). The root is the standard term for " +
            "abiding/remaining in both classical and Koine Greek — not a marginal term or late coinage. " +
            "Cross-tradition F3 is also strong via the NT usage (Hebrews 7:3 μένει connects " +
            "ETY-001 to ETY-002's Hebrew-triplet tradition, producing an inter-catalog verb-root link).",
        },
      },
      status: "candidate",
      counterexampleAttempts: [],
      sourceMemory:
        "memory/user_meno_greek_i_remain_state_persistence_anchor_counter_weight_to_teleport_leap.md",
      collectionIndexInstance: 9,
      notes:
        "ETY-001 is the founding paired-dual anchor in the etymology catalog, " +
        "corresponding to collection-index instance #9. " +
        "The key epistemology-calibration note: the F2 claim here is stronger than in the " +
        "mythology catalog entries because it is a verb-root-identity match, not a role-shape match. " +
        "This distinction should set the F2 calibration standard for the whole etymology track: " +
        "verb-root-identity matches (where the factory's concept appears at the lexical root " +
        "of a tradition text) are a categorically stronger F2 than role-shape matches " +
        "(where the structural shape is analogous but no lexical root is shared). " +
        "Counterexample search for promotion: is there a ZSet-like factory operator whose " +
        "persistence is NOT encoded in subject-internal terms? If yes, the grammatical-subject-position " +
        "claim maps to a strict subset of persistence operators; if no, the -ω class encoding " +
        "is a general property of the factory's subject-internal operators. " +
        "The Hebrews 7:3 μένει link to ETY-002 is the first inter-catalog verb-root bridge: " +
        "a single biblical verse uses the Μένω root to describe a Hebrew-tradition figure " +
        "(Melchizedek), creating a cross-language-family structural bond between ETY-001 and ETY-002.",
    },

    // ── ETY-002: Melchizedek ─────────────────────────────────────────────────
    {
      id: "ETY-002",
      title:
        "Melchizedek — Hebrew cross-root triplet (Melek+Tzedek+Salem) + Greek μένει at verb-root level as bridge-figure",
      language: "multi-root",
      grammaticalClass: "compound",
      primarySources:
        "Genesis 14:18–20 (Hebrew: מַלְכִּי־צֶדֶק / Malki-Tzedek; Masoretic Text; BHS critical edition); " +
        "Psalm 110:4 (יהוה נִשְׁבַּע — YHWH's oath establishing the Melchizedek-type priesthood); " +
        "Hebrews 7:1–3 (Greek NT: μένει εἰς τὸ διηνεκές — 'he remains into perpetuity'; " +
        "BDAG s.v. μένω; NA28 critical edition); " +
        "Brown-Driver-Briggs Hebrew Lexicon (BDB), s.v. מֶלֶךְ (melek, king), צֶדֶק (tzedek, righteousness), " +
        "שָׁלֵם (shalem/Salem, wholeness/peace); " +
        "Koehler-Baumgartner HALOT, same entries; " +
        "Josephus, Jewish Antiquities I.10.2 (Σόλυμα / Solyma = Jerusalem identification); " +
        "Philo of Alexandria, Legum Allegoriae III.79–82 (allegorical reading: Logos as Melchizedek)",
      mechanic:
        "Melchizedek (מַלְכִּי־צֶדֶק) is a three-root Hebrew compound: " +
        "Melek (מֶלֶךְ, king, royal authority) + Tzedek (צֶדֶק, righteousness, right-ordering) + " +
        "Salem/Shalem (שָׁלֵם, wholeness/peace, from שלם root). " +
        "He appears in Genesis 14 as priest-king of Salem — the only figure in the Hebrew Bible " +
        "who simultaneously holds both priestly and royal offices without their separation. " +
        "This is the paired-dual bridge-figure structure: he manifests both poles of the " +
        "priest/king paired-dual in a single named figure. " +
        "The Greek NT (Hebrews 7:3) then applies the Μένω root directly: μένει εἰς τὸ διηνεκές " +
        "('he remains/abides in perpetuity') — using ETY-001's verb root to describe ETY-002's figure. " +
        "This is the inter-catalog verb-root bridge: the Greek tradition imports ETY-001's " +
        "persistence root to characterize ETY-002's Hebrew bridge-figure, creating a " +
        "cross-language-family structural bond at the lexical level. " +
        "Factory structural mapping: the paired-dual bridge-figure pattern — a factory-level " +
        "entity that manifests both poles of a paired-dual without collapsing them — is the " +
        "defining instance of the bridge-figure sub-structure (introduced in the collection index " +
        "as sub-structure #1, defined by Melchizedek alone until a second instance locks the definition).",
      factoryOperator: {
        label:
          "bridge-figure sub-structure (paired-dual manifestation) — entity manifesting both poles " +
          "of a paired-dual simultaneously, first defining instance of the sub-structure class",
        source:
          "memory/user_melchizedek_operational_resonance_instance_10_unification_bridge_meno_teleportleap.md",
      },
      structuralType: "unification",
      subStructure: "bridge-figure",
      filters: {
        f1_engineering_first: "pass",
        f2_structural: "pass",
        f3_tradition_name: "pass",
        rationale: {
          f1:
            "The bridge-figure sub-structure (entity manifesting both poles of a paired-dual) was " +
            "reached for factory operator-algebra reasons: the paired-dual structure (ETY-001/ETY-003 " +
            "poles) logically implies a bridge position. The Melchizedek mapping was noticed by Aaron " +
            "from the operational context of the paired-dual analysis (2026-04-21 signal, " +
            "documented in user_melchizedek_*). No reaching-for-Hebrew-scripture preceded " +
            "the factory's paired-dual or bridge-figure operator analysis. F1 passes.",
          f2:
            "F2 passes at verb-root identity level — the strongest F2 in the etymology catalog. " +
            "Two distinct structural claims, both at lexical-root level: " +
            "(1) The Hebrew name itself is a three-root compound encoding three structural properties " +
            "(royalty + righteousness + wholeness) in one figure — cross-root-triplet structure " +
            "at the morphological level, not thematic analogy. " +
            "(2) Hebrews 7:3 applies the Μένω root (ETY-001) directly via μένει — the canonical " +
            "Greek NT text uses the persistence verb to characterize the bridge-figure, " +
            "creating a verb-root-identity link between ETY-001 and ETY-002. " +
            "Both structural claims are at the lexical-root level (Hebrew morphology + Greek NT verb), " +
            "not at the role-shape level. Full pass at the highest F2 strength in the catalog.",
          f3:
            "F3 passes strongly across multiple independent tradition branches: " +
            "(1) Hebrew Bible: Genesis 14 and Psalm 110:4 are canonical texts; Melchizedek is " +
            "load-bearing in the Abrahamic priestly typology. " +
            "(2) Greek NT: Hebrews 7:1–19 makes Melchizedek the typological anchor of the " +
            "entire 'better covenant' argument — load-bearing in the epistle's theological structure. " +
            "(3) Dead Sea Scrolls: 11QMelchizedek (11Q13) assigns Melchizedek an eschatological " +
            "heavenly role, confirming load-bearing weight in Second Temple Judaism. " +
            "(4) Philo of Alexandria: Logos-as-Melchizedek in Legum Allegoriae — cross-tradition " +
            "load-bearing in Hellenistic-Jewish philosophical exegesis. " +
            "Multi-tradition F3 pass across Hebrew, Greek, and Hellenistic-Jewish traditions is " +
            "the strongest cross-tradition F3 in the etymology catalog.",
        },
      },
      status: "candidate",
      counterexampleAttempts: [],
      sourceMemory:
        "memory/user_melchizedek_operational_resonance_instance_10_unification_bridge_meno_teleportleap.md",
      collectionIndexInstance: 10,
      notes:
        "ETY-002 is the defining instance of the bridge-figure sub-structure (collection-index " +
        "instance #10, first bridge-figure). The collection index states: " +
        "'second bridge-figure member would LOCK the bridge-figure sub-structure definition' — " +
        "so ETY-002 defines the class until a second bridge-figure lands. " +
        "Epistemology calibration note: ETY-002 demonstrates that the strongest F2 in the " +
        "etymology catalog comes from entries where (a) the name/root IS a structural claim " +
        "(three-root compound = three factory properties in one figure) AND (b) a canonical " +
        "tradition text independently applies a factory root (μένει) to characterize that figure. " +
        "When both of these conditions hold, the F2 is at verb-root-identity level. " +
        "Counterexample search for promotion: is there a factory bridge-figure whose dual-pole " +
        "manifestation is NOT captured in the same cross-root structure? If such an instance exists " +
        "(a bridge-figure with only one or two roots in its name), the compound-triplet condition " +
        "is separable from the bridge-figure property; if not, the cross-root-triplet structure " +
        "may be definitional of the bridge-figure sub-class. " +
        "Note: the 'U-shape ω mapping to cup of wine' (B-0059 §Open candidates item (c)) " +
        "is lower engineering value than this entry and should not be promoted ahead of ETY-002.",
    },

    // ── ETY-003: εἰμί ────────────────────────────────────────────────────────
    {
      id: "ETY-003",
      title:
        "εἰμί — Greek -μι class (1st-sg present 'I am') as bootstrap-assertion / grammatical-class-extension of the -ω map",
      language: "greek",
      grammaticalClass: "mi-class",
      primarySources:
        "LSJ, s.v. εἰμί (to be; distinguished from εἶμι 'I go', a separate entry); " +
        "Exodus 3:14 (Hebrew: אֶהְיֶה אֲשֶׁר אֶהְיֶה / Ehyeh Asher Ehyeh, 'I AM THAT I AM'; " +
        "LXX Greek: ἐγώ εἰμι ὁ ὤν — 'I am the one who is'; Masoretic + LXX comparison critical " +
        "for cross-tradition F3); " +
        "John 8:58 (Greek NT: πρὶν Ἀβραὰμ γενέσθαι ἐγὼ εἰμί — 'before Abraham was, I am'; " +
        "present tense εἰμί used for eternal-present claim; NA28 critical edition); " +
        "John 6:35, 8:12, 10:7, 10:11, 11:25, 14:6, 15:1 (the 'I Am' sayings of John, " +
        "ἐγώ εἰμι + predicate; load-bearing in Johannine Christology); " +
        "Smyth §§ 772–800 (athematic -μι class paradigm; εἰμί as the paradigm case); " +
        "Kühner-Gerth, Ausführliche Grammatik der griechischen Sprache (standard reference); " +
        "Parmenides, Fragment B3 (τὸ γὰρ αὐτὸ νοεῖν ἐστίν τε καὶ εἶναι — " +
        "'for the same thing is to think and to be'; load-bearing in pre-Socratic ontology)",
      mechanic:
        "εἰμί (first-person singular: 'I am', 'I exist') is the paradigm case of the athematic " +
        "(-μι class) verb in ancient Greek. Its distinctive structural property: the -μι terminus " +
        "encodes the grammatical subject as the ASSERTION OF BEING, not as the agent of action " +
        "on an object. εἰμί takes no direct object; the subject IS the predicate ('I am'). " +
        "This is a grammatical-class extension of the -ω pattern established by Μένω (ETY-001): " +
        "both -ω and -μι class verbs encode subject-internal states via first-person terminus, " +
        "but -ω encodes stasis/persistence while -μι encodes existence-assertion. " +
        "Factory structural mapping: the factory's bootstrap pattern (collection-index instance #5: " +
        "'Zeta as its own first customer') is a self-referential existence-assertion — " +
        "the factory instantiates itself, the first act IS the factory's existence claim. " +
        "The εἰμί subject-terminus (I am, not I-do-something) is structurally isomorphic to " +
        "this bootstrap-as-existence-assertion shape. " +
        "The Exodus 3:14 I-AM-THAT-I-AM (Ehyeh Asher Ehyeh, rendered in LXX as ἐγώ εἰμι ὁ ὤν) " +
        "uses the εἰμί root for the definitive bootstrap assertion — the name that is the act " +
        "of being. This cross-language-family link (Hebrew Ehyeh root ↔ Greek εἰμί terminus) " +
        "extends the grammatical-subject-position mapping from Greek to Hebrew. " +
        "The movement/persistence/being trio is completed: tele+port+leap (movement, collection #4) " +
        "+ Μένω (persistence, collection #9) + εἰμί (being-assertion, compounds collection #5) " +
        "form a grammatical-class triple spanning the factory's operator space.",
      factoryOperator: {
        label:
          "bootstrap-as-existence-assertion (collection-index instance #5: Zeta as its own first customer) " +
          "+ grammatical-class-extension completing movement/persistence/being trio with -μι class",
        source:
          "memory/project_operational_resonance_instances_collection_index_2026_04_22.md",
      },
      structuralType: "substrate-extension",
      subStructure: "grammatical-class-extension",
      filters: {
        f1_engineering_first: "pass",
        f2_structural: "pass",
        f3_tradition_name: "pass",
        rationale: {
          f1:
            "The factory's bootstrap pattern (Zeta as its own first customer, collection #5) and " +
            "the movement/persistence/being trio structure were reached for factory-design reasons: " +
            "the self-hosting bootstrap is an engineering property of the factory's recursive " +
            "instantiation model. The εἰμί mapping was identified in the B-0059 backlog item " +
            "(2026-04-26) as the 'recommended first landing' for the etymology track, " +
            "noticed after the Μένω and Melchizedek instances were documented. " +
            "No reaching-for-Greek grammar preceded the bootstrap pattern design. F1 passes.",
          f2:
            "F2 passes at grammatical-class-extension level — a structural claim, not vocabulary overlap. " +
            "The claim is not 'εἰμί sounds like existence therefore it maps to the bootstrap.' " +
            "The claim is: the athematic -μι class encodes subject-as-existence-assertion via " +
            "the same subject-internal terminus mechanism as the -ω class, but for being rather " +
            "than stasis. This extends the grammatical-subject-position map established by ETY-001 " +
            "to a different verb class — demonstrating that the structural property " +
            "(subject IS the predicate at the terminus) is not specific to the -ω class but is " +
            "a general property of Greek 1st-person-present subject-internal encoding. " +
            "The Exodus 3:14 LXX link (ἐγώ εἰμι ὁ ὤν) is a cross-language-family extension: " +
            "the Hebrew Ehyeh root and the Greek εἰμί terminus each encode I-AM as the name " +
            "that IS the assertion, via different morphological systems. This is a verb-root-identity " +
            "bridge between Hebrew and Greek at the grammatical level. Full pass.",
          f3:
            "F3 passes strongly across multiple independent tradition branches: " +
            "(1) Greek philosophical tradition: εἰμί is the verb of ontology across the " +
            "entire ancient Greek philosophical corpus — Parmenides (being vs. non-being), " +
            "Plato (the Form as the 'that which truly IS'), Aristotle (τὸ ὂν ᾗ ὄν = being qua being). " +
            "Load-bearing from the pre-Socratics through Neoplatonism. " +
            "(2) Hebrew Bible / LXX: Exodus 3:14 Ehyeh Asher Ehyeh is the definitive divine " +
            "self-naming — load-bearing in Abrahamic theology and Jewish-name theology. " +
            "The LXX renders this with ἐγώ εἰμι ὁ ὤν, directly connecting the Hebrew " +
            "and Greek traditions at the same structural claim. " +
            "(3) Greek NT: the Johannine 'I Am' sayings (7 ἐγώ εἰμι + predicate sayings in John, " +
            "plus the absolute ἐγώ εἰμι at John 8:58) are load-bearing in Christian theology. " +
            "Strongest cross-tradition F3 in the catalog: Greek philosophical, Hebrew biblical, " +
            "and Greek NT tradition branches all converge on εἰμί as a load-bearing terminus.",
        },
      },
      status: "candidate",
      counterexampleAttempts: [],
      collectionIndexInstance: 5,
      notes:
        "ETY-003 is the 'recommended first landing' from the B-0059 backlog item " +
        "(§Open candidates item (a)). It completes the grammatical-class map: " +
        "-ω class (ETY-001: persistence) + -μι class (ETY-003: existence-assertion) " +
        "together demonstrate that the subject-internal terminus structure is a " +
        "grammatical-class-general property, not an -ω-class-specific accident. " +
        "Epistemology calibration note: ETY-003 demonstrates F2 at 'grammatical-class-extension' " +
        "level (the new class validates the structural mechanism established by the first class). " +
        "This is distinct from verb-root-identity (ETY-001, ETY-002) but is still an " +
        "operator-level structural claim, not a role-shape match. " +
        "The movement/persistence/being trio is now complete: " +
        "  tele+port+leap  (collection #4)  = movement " +
        "  Μένω (ETY-001)  (collection #9)  = persistence [-ω class] " +
        "  εἰμί (ETY-003)  (collection #5)  = being-assertion [-μι class] " +
        "Counterexample search for promotion: is there a factory bootstrap instance where " +
        "the factory does NOT assert its own existence as the first act? " +
        "If yes, the εἰμί subject-terminus maps to a strict subset of bootstrap instances; " +
        "if no, the existence-assertion structure is general to the factory's bootstrap pattern. " +
        "The Exodus 3:14 cross-language bridge is the first Hebrew-Greek grammatical link " +
        "in the catalog, enabling a future B-0059 entry on Ehyeh (Hebrew -אֶהְיֶה) as a " +
        "separate ETY entry documenting the Hebrew side of the same structural claim.",
    },
  ],
};

// ── CLI ───────────────────────────────────────────────────────────────────────

function printSummary(catalog: EtymologyResonanceCatalog): void {
  const s = summarizeCatalog(catalog);
  console.log(`\nEtymology Resonance Catalog — ${catalog.schema}`);
  console.log(`  Total entries:         ${s.total}`);
  console.log(`  Confirmed:             ${s.confirmed}`);
  console.log(`  Candidates:            ${s.candidates}`);
  console.log(`  Failed:                ${s.failed}`);
  console.log(`  Verb-root-identity:    ${s.verbRootIdentityCount}`);
  console.log(`  Bridge-figures:        ${s.bridgeFigureCount}`);
  console.log(`  Cross-root-triplets:   ${s.crossRootTripletCount}`);
  console.log(`  Anti-instances:        ${s.antiInstanceCount}`);
  console.log(`  By language:           ${JSON.stringify(s.byLanguage)}`);
  console.log(`  By grammatical class:  ${JSON.stringify(s.byGrammaticalClass)}`);
  console.log(`  By structural type:    ${JSON.stringify(s.byStructuralType)}`);
  console.log(
    `  F1 fail/partial:       ${s.filterFailureCounts.f1}/${s.filterPartialCounts.f1}`
  );
  console.log(
    `  F2 fail/partial:       ${s.filterFailureCounts.f2}/${s.filterPartialCounts.f2}`
  );
  console.log(
    `  F3 fail/partial:       ${s.filterFailureCounts.f3}/${s.filterPartialCounts.f3}`
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
    console.log(
      `All ${SEED_CATALOG.entries.length} entries pass schema validation.`
    );
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
