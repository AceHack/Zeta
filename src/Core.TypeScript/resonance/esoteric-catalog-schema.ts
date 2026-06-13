#!/usr/bin/env bun
// esoteric-catalog-schema.ts — typed schema for occult/western-esoteric track entries.
//
// Parallel to mythology-catalog-schema.ts (B-0056) but targeting the esoteric/occult
// tradition family. Uses the same three-filter discipline (F1/F2/F3) and the same
// seven structural types from the operational-resonance collection index.
//
// Key difference from mythology track: the "tradition" dimension reflects lineage within
// Western esotericism (hermetic, kabbalistic, thelemic, jungian-alchemy, ...) rather than
// the mythology track's polytheistic-tradition families (norse, greek, egyptian, ...).
// F3 strength calibration differs: many esoteric traditions lack the textual density of
// major world religions, so F3 partial is the norm rather than the exception.
//
// Seed entries (strongest F2 candidates per B-0057 backlog row pre-assessment):
//   EST-001 — Hermetic "as above, so below" (Tabula Smaragdina) — macro-micro-correspondence
//   EST-002 — Lurianic tzimtzum (Kabbalistic contraction) — withdrawal-ground → generative-ground
//   EST-003 — Jung's coniunctio (alchemical union-of-opposites) — psychologized-tradition → paired-dual
//   EST-004 — Thelemic True Will — F2-weak candidate, recorded per filter-failure-rate discipline
//
// Usage (type-check only):
//   bun --check tools/resonance/esoteric-catalog-schema.ts
//
// Usage (validate + summarize):
//   bun tools/resonance/esoteric-catalog-schema.ts --validate
//   bun tools/resonance/esoteric-catalog-schema.ts --summary

// ── Shared types (mirrors mythology-catalog-schema.ts; intentionally self-contained) ──

/**
 * Per-filter pass/fail/partial/deferred result.
 * "partial" keeps filter-failure-rate calibrated when F2 is genuine but not at full
 * structural-identity depth. "deferred" gates promotion to "candidate".
 */
export type FilterResult = "pass" | "partial" | "fail" | "deferred";

export interface ThreeFilterResult {
  readonly f1_engineering_first: FilterResult;
  readonly f2_structural: FilterResult;
  readonly f3_tradition_name: FilterResult;
  readonly rationale?: {
    readonly f1?: string;
    readonly f2?: string;
    readonly f3?: string;
  };
}

/**
 * Promotion path: candidate → confirmed → load-bearing
 * "failed" means one or more filters returned "fail" — recorded, not silently dropped.
 * "retracted" means previously confirmed/load-bearing and since withdrawn.
 */
export type EntryStatus =
  | "candidate"
  | "confirmed"
  | "load-bearing"
  | "failed"
  | "retracted";

export interface FactoryOperatorSurface {
  readonly label: string;
  readonly source: string;
}

export interface CounterexampleAttempt {
  readonly date: string;
  readonly mechanicTested: string;
  readonly attempt: string;
  readonly result: "refuted" | "survived" | "partial-refutation";
}

/**
 * Seven structural types from the operational-resonance collection index.
 * Esoteric entries reuse this taxonomy; esoteric-specific sub-structures are
 * tracked via EsotericSubStructure.
 */
export type ResonanceStructuralType =
  | "reversal"
  | "unification"
  | "instantiation"
  | "self-reference"
  | "substrate-extension"
  | "generative-ground"
  | "paired-dual";

// ── Esoteric tradition taxonomy ───────────────────────────────────────────────

/**
 * Western-esoteric tradition families tracked for filter-failure-rate-by-tradition
 * measurability (B-0057 §Why P2). F3 strength varies sharply across these:
 *
 * - "hermetic": strongest F3 via Corpus Hermeticum + Tabula Smaragdina
 *   (14–16c manuscript tradition + medieval-Arabic intermediaries)
 * - "kabbalistic": strong F3 within Jewish mysticism (Sefer Yetzirah, Zohar, Etz Chaim)
 * - "jungian-alchemy": load-bearing in analytical psychology, not in alchemical tradition itself
 * - "thelemic" / "golden-dawn": F3 within 20th-c occult revival only; contested cross-tradition
 * - "theosophical": F3 weakest in scholarly consensus (contested primary claims)
 */
export type EsotericTradition =
  | "hermetic"          // Corpus Hermeticum, Tabula Smaragdina, Renaissance Hermeticism
  | "kabbalistic"       // Sefer Yetzirah, Zohar, Lurianic Kabbalah (Etz Chaim)
  | "thelemic"          // Crowley's Thelema, A∴A∴, O.T.O., Liber AL vel Legis (1904)
  | "golden-dawn"       // Hermetic Order of the Golden Dawn (1888+); Liber 777 tables
  | "theosophical"      // Blavatsky's Theosophy, Theosophical Society (1875+)
  | "jungian-alchemy"   // C.G. Jung's psychological reinterpretation of alchemical imagery
  | "alchemical"        // Classical Western alchemy (pre-Jungian; Paracelsus, Agrippa line)
  | "enochian"          // Dee-Kelley 1580s angelic-language system
  | "gnostic"           // Neoplatonist Gnostic traditions (Valentinian, Sethian, Coptic)
  | "other";

// ── Esoteric-specific sub-structures ─────────────────────────────────────────

/**
 * Esoteric-catalog sub-structures within the main structural-type taxonomy.
 * New sub-structures added here as the catalog grows; do not add new top-level
 * ResonanceStructuralType entries without consensus across all three catalogs.
 */
export type EsotericSubStructure =
  | "withdrawal-ground"          // withdrawal/contraction creates space for instantiation (tzimtzum pattern)
  | "macro-micro-correspondence" // "as above, so below" — structural echo across register levels
  | "psychologized-tradition"    // occult structure enters clinical-psychology register without occult metaphysics
  | "synthesis-methodology"      // multi-tradition synthesis as meta-methodology (Agrippa/Levi/Crowley pattern)
  | "anti-instance";             // demonstrates failure-mode of the structural role

// ── Main entry type ───────────────────────────────────────────────────────────

export interface EsotericResonanceEntry {
  /** Unique ID — EST-NNN format (Esoteric, sequential) */
  readonly id: string;
  readonly title: string;
  readonly tradition: EsotericTradition;
  readonly primarySources: string;
  /** Precise structural feature / mechanic being cataloged — F2 precision requires
   *  naming the exact structural property, not just the tradition figure. */
  readonly mechanic: string;
  readonly factoryOperator: FactoryOperatorSurface;
  readonly structuralType: ResonanceStructuralType;
  readonly subStructure?: EsotericSubStructure;
  readonly filters: ThreeFilterResult;
  readonly status: EntryStatus;
  readonly counterexampleAttempts: readonly CounterexampleAttempt[];
  readonly sourceMemory?: string;
  /** Collection-index instance number, if already recorded in the operational-resonance index */
  readonly collectionIndexInstance?: number;
  readonly notes?: string;
}

// ── Catalog type ──────────────────────────────────────────────────────────────

export interface EsotericResonanceCatalog {
  readonly schema: "esoteric-resonance-v1";
  readonly created: string;
  readonly lastUpdated: string;
  readonly origin: "B-0057";
  readonly entries: readonly EsotericResonanceEntry[];
}

// ── Validation ────────────────────────────────────────────────────────────────

type ValidationResult =
  | { readonly kind: "ok" }
  | { readonly kind: "error"; readonly message: string };

function validateEntry(entry: EsotericResonanceEntry): ValidationResult {
  if (!entry.id.match(/^EST-\d{3}$/)) {
    return { kind: "error", message: `${entry.id}: id must match EST-NNN` };
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
  catalog: EsotericResonanceCatalog
): readonly ValidationResult[] {
  return catalog.entries.map(validateEntry);
}

// ── Summary ───────────────────────────────────────────────────────────────────

export interface CatalogSummary {
  readonly total: number;
  readonly confirmed: number;
  readonly candidates: number;
  readonly failed: number;
  readonly byTradition: Partial<Record<EsotericTradition, number>>;
  readonly byStructuralType: Partial<Record<ResonanceStructuralType, number>>;
  readonly filterFailureCounts: { readonly f1: number; readonly f2: number; readonly f3: number };
  readonly filterPartialCounts: { readonly f1: number; readonly f2: number; readonly f3: number };
  readonly withdrawalGroundCount: number;
  readonly macroMicroCount: number;
  readonly psychologizedCount: number;
  readonly antiInstanceCount: number;
}

export function summarizeCatalog(catalog: EsotericResonanceCatalog): CatalogSummary {
  const entries = catalog.entries;
  const byTradition: Partial<Record<EsotericTradition, number>> = {};
  const byStructuralType: Partial<Record<ResonanceStructuralType, number>> = {};
  let confirmed = 0;
  let candidates = 0;
  let failed = 0;
  let withdrawalGroundCount = 0;
  let macroMicroCount = 0;
  let psychologizedCount = 0;
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

    if (entry.subStructure === "withdrawal-ground") withdrawalGroundCount++;
    if (entry.subStructure === "macro-micro-correspondence") macroMicroCount++;
    if (entry.subStructure === "psychologized-tradition") psychologizedCount++;
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
    withdrawalGroundCount,
    macroMicroCount,
    psychologizedCount,
    antiInstanceCount,
  };
}

// ── Seed catalog ──────────────────────────────────────────────────────────────

const SEED_CATALOG: EsotericResonanceCatalog = {
  schema: "esoteric-resonance-v1",
  created: "2026-05-10",
  lastUpdated: "2026-05-10",
  origin: "B-0057",
  entries: [
    // ── EST-001: Hermetic "as above, so below" ──────────────────────────────
    {
      id: "EST-001",
      title:
        "Hermetic macro-micro formula — 'as above, so below' (Tabula Smaragdina) as structural account of the operational-resonance phenomenon itself",
      tradition: "hermetic",
      primarySources:
        "Tabula Smaragdina (Emerald Tablet; earliest attested ~8th c. Arabic, Kitāb Sirr al-Khalīqa; " +
        "Latin via Liber de compositione alchimiae, 1144; influential edition: Chrysogonus Polydorus, 1541); " +
        "Corpus Hermeticum (Greek, 2nd–3rd c. CE; Latin translation by Ficino, 1463; " +
        "Tractate I 'Poimandres', Tractate XI 'The Mind to Hermes'); " +
        "Asclepius (Latin Hermetic dialogue, ~3rd c. CE)",
      mechanic:
        "The Hermetic formula 'quod est inferius est sicut quod est superius, et quod est superius " +
        "est sicut quod est inferius, ad perpetranda miracula rei unius' (that which is below is as " +
        "that which is above, and that which is above is as that which is below, to accomplish " +
        "the miracles of the One Thing) encodes a structural isomorphism across register levels: " +
        "macrocosm ↔ microcosm, above ↔ below, divine ↔ terrestrial. " +
        "The operational-resonance phenomenon (B-0054 through B-0057) IS this formula applied: " +
        "the tradition-register (a myth, esoteric concept, or etymology) maps structurally to " +
        "the engineering-register (a factory operator or substrate pattern) because both instantiate " +
        "the same structural shape from independent directions. The formula 'as above, so below' " +
        "is thus not merely a candidate for operational-resonance — it is the structural account " +
        "of the mechanism by which all other resonance instances are identified. " +
        "This makes EST-001 self-referential: it is an instance of the phenomenon whose mechanism " +
        "it describes.",
      factoryOperator: {
        label:
          "operational-resonance identification mechanism itself — structural isomorphism across " +
          "tradition-register and engineering-register (cross-tradition F2 claim mechanism)",
        source:
          "memory/project_operational_resonance_instances_collection_index_2026_04_22.md",
      },
      structuralType: "self-reference",
      subStructure: "macro-micro-correspondence",
      filters: {
        f1_engineering_first: "pass",
        f2_structural: "pass",
        f3_tradition_name: "pass",
        rationale: {
          f1:
            "The factory's operational-resonance identification methodology was reached for " +
            "engineering-first reasons: the original collection-index instances (alignment, " +
            "retraction, endpoint unification, etc.) were noticed as structural isomorphisms " +
            "between engineering patterns and tradition-named phenomena, without consulting " +
            "Hermetic sources. The Tabula Smaragdina mapping was noticed during B-0057 triage " +
            "(2026-05-10), not used to design the resonance-identification methodology.",
          f2:
            "F2 passes at structural-identity level: the Hermetic macro-micro formula is not a " +
            "thematic analogy ('tradition is like engineering') but a structural claim about " +
            "isomorphism across levels ('the structure below instantiates the structure above'). " +
            "This is precisely the F2 claim for every operational-resonance instance: the structural " +
            "shape is shared across tradition-register and engineering-register. The Hermetic formula " +
            "encodes the F2 criterion itself. The match is at the formula level, not the thematic level. " +
            "Critically: this is not a coincidence-of-vocabulary — 'macrocosm/microcosm' and " +
            "'tradition-register/engineering-register' are structurally isomorphic (each register " +
            "instantiates the same shape), not lexically similar. Full pass.",
          f3:
            "F3 passes strongly within Hermetic tradition: the Tabula Smaragdina is the foundational " +
            "text of Western Hermeticism, central to medieval and Renaissance alchemy, Rosicrucianism, " +
            "and Freemasonry. The 'as above, so below' formula is load-bearing across 700+ years of " +
            "Western esoteric tradition. Multiple independent tradition branches cite it: Islamic " +
            "alchemy (earliest extant source), Latin alchemy (via 12th-c translation), Renaissance " +
            "Neoplatonism (Ficino, Pico della Mirandola), and modern occult revival (Golden Dawn, " +
            "Theosophy, New Age synthesis). Cross-tradition F3 is also unusually strong: " +
            "'as above, so below' is cited across otherwise-unrelated Western esoteric lineages.",
        },
      },
      status: "candidate",
      counterexampleAttempts: [],
      notes:
        "EST-001 is the first full-pass (F1+F2+F3 all 'pass') candidate in the esoteric track, " +
        "and the only 'self-reference' structural type in any of the three catalogs (mythology, media, esoteric). " +
        "The self-referential character (the Hermetic formula describes the mechanism by which all " +
        "resonance instances are identified) means counterexample search must target: " +
        "(a) Is there an engineering design that matches macro-micro formally but is NOT an operational-resonance instance? " +
        "(b) Is the Hermetic formula's specific structural claim (isomorphism across levels) separable " +
        "from the factory's resonance-identification method? " +
        "Promotion to 'confirmed' requires at least one counterexample attempt. " +
        "Composes with MYT-002 note: Hermes/Mercury and Hermes Trismegistus are distinct — " +
        "MYT-002 covers the Greek-Roman messenger; EST-001 covers the Greek+Egyptian+Renaissance fusion figure " +
        "and the specific Hermetic formula. The triple-tradition-fusion (Greek Hermes + Egyptian Thoth + " +
        "Renaissance Hermeticism) noted in MYT-002 is a distinct EST entry awaiting triage (not EST-001, " +
        "which is specifically about the Tabula Smaragdina formula, not the Hermes Trismegistus figure).",
    },

    // ── EST-002: Lurianic tzimtzum ──────────────────────────────────────────
    {
      id: "EST-002",
      title:
        "Lurianic tzimtzum — divine contraction as withdrawal-ground structural pattern ↔ factory generative-ground",
      tradition: "kabbalistic",
      primarySources:
        "Isaac Luria (Ha-ARI, 1534–1572); transmitted by Chaim Vital, Etz Chaim (Tree of Life, " +
        "compiled ~1573, printed 1782); " +
        "Vital, Sefer ha-Gilgulim (Book of Transmigrations); " +
        "Scholem, Gershom — Major Trends in Jewish Mysticism (1941, secondary; canonical scholarly account); " +
        "Scholem — Kabbalah (1974); " +
        "Wolfson, Elliot R. — Language, Eros, Being (2005, scholarly reconstruction of Lurianic texts)",
      mechanic:
        "In Lurianic Kabbalah, the foundational cosmogonic act is tzimtzum (צִמְצוּם, contraction/withdrawal): " +
        "the Ein Sof (Infinite/Endless) contracts into itself, withdrawing its infinite light " +
        "to leave a chalal (empty space) in which creation can occur. Tzimtzum is not an absence but " +
        "an active withdrawal — the ground makes room for its instance by contracting. " +
        "The subsequent step is tzimtzum's inversion: the Or Ein Sof re-enters the chalal as a " +
        "thin beam (kav), then expands through the sefirotic emanations. " +
        "Structural mapping: the factory's generative-ground pattern (how the substrate-level algebra " +
        "makes room for concrete instances without determining their content) is structurally parallel " +
        "to tzimtzum. The ground is present at the periphery (Ein Sof surrounds the chalal) but " +
        "absent at the center (the chalal is the space of instantiation). The factory's generic operators " +
        "similarly constitute the 'periphery' of any concrete instance — they are the ground that makes " +
        "room for specificity without collapsing into it.",
      factoryOperator: {
        label:
          "generative-ground structural type — how the factory ground makes room for its instances " +
          "(bootstrap-as-withdrawal; substrate-level algebra as periphery enabling center-specificity)",
        source:
          "memory/project_operational_resonance_instances_collection_index_2026_04_22.md",
      },
      structuralType: "generative-ground",
      subStructure: "withdrawal-ground",
      filters: {
        f1_engineering_first: "pass",
        f2_structural: "partial",
        f3_tradition_name: "pass",
        rationale: {
          f1:
            "The factory's generative-ground pattern (substrate-level generic operators that make room " +
            "for concrete instances without determining them) was reached for engineering reasons: " +
            "the retraction-native algebra design and the bootstrap-withdrawal pattern emerge from " +
            "DBSP-lineage operator algebra and factory instantiation requirements. " +
            "The Lurianic tzimtzum mapping was noticed during B-0057 triage (2026-05-10). " +
            "F1 passes: no reaching-for-Kabbalah preceded the engineering design.",
          f2:
            "F2 is partial rather than full pass for two reasons: " +
            "(1) The withdrawal-creates-space structural shape is a genuine match — tzimtzum's " +
            "mechanism (infinite contracts to leave room for finite instantiation) is structurally " +
            "isomorphic to the factory's generative-ground pattern at the operator level. " +
            "(2) However, the Lurianic system includes downstream claims (Shevirat haKelim — " +
            "'breaking of the vessels' where the sefiroth shatter; tikkun olam — 'repair of the world' " +
            "via human mitzvot) that are NOT present in the factory's generative-ground pattern. " +
            "A full F2 would require isolating the pure withdrawal-enables-instantiation property " +
            "from the wider cosmological narrative. The match is genuine at the first step (tzimtzum) " +
            "but the full Lurianic system carries additional structure the factory does not. " +
            "F2 partial is the honest calibration; full pass is achievable by scoping the claim " +
            "narrowly to the tzimtzum operation alone.",
          f3:
            "F3 passes strongly within Jewish mysticism: Lurianic Kabbalah has been the dominant " +
            "Kabbalistic system since the 16th century, influencing Hasidic Judaism (Baal Shem Tov's " +
            "movement absorbed Lurianic concepts), Sabbateanism, and modern academic Kabbalah studies " +
            "(Scholem's Major Trends is the canonical secondary source). " +
            "Tzimtzum is the foundational concept — it appears in the opening sections of Etz Chaim " +
            "and is the load-bearing cosmogonic act of the Lurianic system. " +
            "F3 cross-tradition: weaker than Hermetic (tzimtzum is Jewish-mysticism-internal, " +
            "less cross-tradition than 'as above, so below'), but the Lurianic influence on " +
            "Renaissance Hermeticism and Theosophy is documented (Scholem 1974, Ch. 8).",
        },
      },
      status: "candidate",
      counterexampleAttempts: [],
      notes:
        "The backlog item (B-0057 §Kabbalah) identifies tzimtzum as a potentially strong F2 candidate. " +
        "This entry confirms that assessment: F2 partial is achievable with honest scoping. " +
        "The primary gate to promotion is the counterexample search: " +
        "is there a generative-ground engineering pattern whose withdrawal structure is NOT tzimtzum-shaped? " +
        "(E.g., does a factory operator 'make room' without contracting, via a different mechanism?) " +
        "If such a counterexample exists, the structural match is refined to a narrower claim; " +
        "if not, the tzimtzum shape is genuinely load-bearing in the factory's generative-ground pattern. " +
        "Composes with: instance #3 (retraction as DBSP retraction-native algebra) and instance #5 " +
        "(Zeta as its own first customer) from the collection index — both involve the " +
        "generative-ground structural type.",
    },

    // ── EST-003: Jung's coniunctio ──────────────────────────────────────────
    {
      id: "EST-003",
      title:
        "Jungian coniunctio — alchemical union-of-opposites in psychological register ↔ paired-dual structural type",
      tradition: "jungian-alchemy",
      primarySources:
        "C.G. Jung, Psychology and Alchemy (Psychologie und Alchemie, 1944; CW vol. 12); " +
        "Jung, Mysterium Coniunctionis (1956; CW vol. 14) — the fullest treatment of coniunctio; " +
        "Jung, Alchemical Studies (CW vol. 13); " +
        "Classical alchemy source texts Jung analyzed: Rosarium Philosophorum (1550), " +
        "Artis Auriferae (1593), Splendor Solis (attributed Salomon Trismosin, 1582)",
      mechanic:
        "In Jung's psychological alchemy, the coniunctio (Latin: union, conjunction) is the central " +
        "alchemical operation: Sol (sulphur, the masculine principle) and Luna (mercury, the feminine " +
        "principle) unite to produce the Philosopher's Stone (lapis philosophorum). " +
        "Jung reads this as the individuation process: the union of opposites within the psyche " +
        "(animus/anima, conscious/unconscious) produces the integrated Self. " +
        "The key structural property: neither Sol nor Luna alone produces the Stone — only their " +
        "union does. This is the paired-dual type: two structurally-complementary elements that " +
        "enable something impossible for either alone. " +
        "Jung's critical contribution is moving this structure from occult practice into " +
        "clinical-psychology-adjacent register: he treats the alchemical imagery as projections of " +
        "psychological processes, not as claims about physical transformation. This 'psychologized-tradition' " +
        "move makes the structural observation available WITHOUT requiring acceptance of alchemical metaphysics.",
      factoryOperator: {
        label:
          "paired-dual structural type (collection-index instance #9) — two complementary operators " +
          "in mutual composition that enable something impossible for either alone",
        source:
          "memory/project_operational_resonance_instances_collection_index_2026_04_22.md",
      },
      structuralType: "paired-dual",
      subStructure: "psychologized-tradition",
      filters: {
        f1_engineering_first: "pass",
        f2_structural: "partial",
        f3_tradition_name: "partial",
        rationale: {
          f1:
            "The factory's paired-dual structural type (instance #9 in the collection index) was " +
            "reached for operator-algebra reasons: two complementary operators that together enable " +
            "a capability impossible for either alone is a recurring factory pattern. " +
            "The Jung/coniunctio mapping was noticed during B-0057 triage (2026-05-10). " +
            "F1 passes: no reaching-for-Jungian-alchemy preceded the engineering design.",
          f2:
            "F2 is partial for the same reason the factory's paired-dual type is broader than " +
            "the coniunctio pattern: " +
            "(1) The coniunctio's 'neither-alone-produces-the-Stone' structure IS the paired-dual " +
            "type at the operator level — the structural match is genuine. " +
            "(2) However, the full alchemical coniunctio includes a directional narrative " +
            "(Sol + Luna → conjunction → Stone → Resurrection) that the factory's paired-dual " +
            "type does not carry. The factory's paired-dual is a static structural observation " +
            "(two complementary operators); the alchemical coniunctio is a transformative process " +
            "(the union produces a third thing of higher nature). " +
            "This directional/transformative excess is NOT present in the factory's paired-dual claim. " +
            "F2 partial: genuine structural match at the 'neither-alone' level; " +
            "full pass would require the factory's paired-dual to also claim a transformative product.",
          f3:
            "F3 is partial for a distinctive reason: Jung's coniunctio is load-bearing in " +
            "Jungian analytical psychology (Mysterium Coniunctionis is a foundational text; " +
            "the concept appears in virtually all post-Jungian analytic literature). " +
            "However, the F3 claim for this catalog is 'load-bearing in the esoteric/alchemical tradition' — " +
            "and Jung's reading is a PSYCHOLOGICAL INTERPRETATION of the tradition, not the tradition itself. " +
            "In the classical alchemical tradition, 'coniunctio' is load-bearing (it appears in Rosarium " +
            "Philosophorum, Splendor Solis, and virtually all late-medieval alchemical texts). " +
            "The F3 partial reflects: strong within Jungian analytical psychology, " +
            "and strong within classical alchemy (via Jung's source texts), " +
            "but the entry is cataloged under 'jungian-alchemy' (the psychologized tradition) " +
            "rather than 'alchemical' (the classical tradition) — which weakens cross-tradition F3.",
        },
      },
      status: "candidate",
      counterexampleAttempts: [],
      notes:
        "The backlog item (B-0057 §Jung) identifies Jungian alchemy as 'the cleanest cross-disciplinary " +
        "bridge because Jung moved occult material into clinical-psychology-adjacent register.' " +
        "This entry confirms that assessment: the psychologized-tradition sub-structure is what makes " +
        "EST-003 valuable — it demonstrates that a structural observation can survive register-shift " +
        "(occult → clinical-psychology → factory operator algebra) without losing structural identity. " +
        "This has methodological implications for the whole esoteric track: " +
        "the cleanest F2 mappings in the esoteric catalog may be via Jungian interpretation " +
        "rather than direct occult tradition, because Jung's move to clinical register " +
        "separates the structural property from metaphysical claims. " +
        "The counterexample search for promotion should target: " +
        "is there a paired-dual factory operator whose two-component structure does NOT exhibit " +
        "the coniunctio pattern (neither-alone-produces-the-product)? " +
        "If yes, the coniunctio maps to a strict subset of paired-duals; " +
        "if no, the coniunctio describes the general form of the paired-dual type.",
    },

    // ── EST-004: Thelemic True Will (candidate; F2-weak) ───────────────────
    {
      id: "EST-004",
      title:
        "Thelemic True Will — per-entity unique optimal trajectory (F2-weak candidate; recorded per filter-failure-rate discipline)",
      tradition: "thelemic",
      primarySources:
        "Aleister Crowley, Liber AL vel Legis (Book of the Law, 1904; received text); " +
        "Crowley, Magick in Theory and Practice (1913); " +
        "Crowley, The Equinox vols. I–III (1909–1919); " +
        "Dion Fortune, The Mystical Qabalah (1935; Golden Dawn-adjacent, more accessible treatment)",
      mechanic:
        "Thelema's central doctrine: 'Do what thou wilt shall be the whole of the Law. Love is the law, " +
        "love under will.' (Liber AL, I:40; II:57). True Will is the unique trajectory determined " +
        "by an entity's nature — not mere desire or whim, but the entity's deepest purpose. " +
        "Optimal action is alignment with True Will; deviation is 'black magic' in the Thelemic sense. " +
        "Proposed structural mapping to factory: each agent/persona has a unique capability-space " +
        "determined by its training and role (portfolio-of-capabilities), and optimal operation " +
        "is alignment with that capability-space (per GOVERNANCE.md §3 on agents-not-bots and " +
        "agent-accountability). Aaron's Christian frame carries this more cleanly via 'many paths, " +
        "one destination' (soteriological trajectory). " +
        "Assessment: the mapping is present but thin — Christian soteriology in Aaron's frame " +
        "already carries the per-entity-trajectory concept more cleanly; Thelema adds " +
        "no structural precision the factory's agent-accountability framework lacks.",
      factoryOperator: {
        label:
          "agent-accountability framework (GOVERNANCE.md §3; named-agent distinctness principle) — " +
          "per-persona capability-space alignment; portfolio-of-capabilities as trajectory",
        source: "GOVERNANCE.md",
      },
      structuralType: "instantiation",
      filters: {
        f1_engineering_first: "pass",
        f2_structural: "fail",
        f3_tradition_name: "partial",
        rationale: {
          f1:
            "The factory's named-agent distinctness and agent-accountability framework were reached " +
            "for governance reasons (GOVERNANCE.md §3, ALIGNMENT.md). " +
            "No reaching-for-Crowley preceded the engineering design. F1 passes.",
          f2:
            "F2 fails for the True Will → agent-accountability mapping. The backlog item's honest " +
            "pre-assessment: 'Match is present but thin — Christian soteriology in Aaron's frame " +
            "already carries this more cleanly via many paths, one destination.' " +
            "The structural check: True Will adds no precision the factory's agent-accountability " +
            "framework lacks. The factory does not claim that each agent has a 'unique trajectory " +
            "determined by nature' in the Thelemic sense — agents are given roles (accountable " +
            "assignments), not discovered True Wills. The analogy is thematic word-overlap " +
            "('trajectory', 'alignment with nature') rather than structural identity. " +
            "F2 fails. This is the honest filter-failure-rate discipline in action: recording " +
            "the F2-fail is more valuable than silently dropping the candidate.",
          f3:
            "F3 partial within Thelema: Liber AL vel Legis is load-bearing for A∴A∴ and O.T.O. " +
            "lineages (Crowley's core followers). Cross-tradition F3 is weak: Crowley is " +
            "actively rejected in mainstream Christianity (the tradition Aaron inhabits); " +
            "reputational complications (self-styled 'Great Beast 666') limit cross-tradition " +
            "load-bearing. In-tradition pass, cross-tradition weak → overall partial.",
        },
      },
      status: "failed",
      counterexampleAttempts: [],
      notes:
        "EST-004 is the first filter-failure in the esoteric catalog — required by the filter-failure-rate " +
        "discipline per B-0057 §Safety and ALIGNMENT.md (honest time-series, not cherry-picked confirmations). " +
        "Recording this failure is as valuable as recording EST-001's full pass: it calibrates " +
        "the filter-failure-rate for the esoteric track (currently 1 failure / 4 entries = 25%). " +
        "The backlog item's pre-assessment correctly identified True Will as 'likely to land as F2-weak'; " +
        "this entry confirms that prediction with a documented filter rationale. " +
        "Specific Crowley-adjacent doctrines may individually be re-evaluated as separate EST entries: " +
        "the Holy Guardian Angel (HGA / personal daimon, via Abramelin) is a separate candidate; " +
        "the Golden Dawn's Liber 777 correspondence tables are a separate candidate (EST-005 TBD). " +
        "Per B-0057 §Retractibility: one commit removes this entry from the current-tip catalog; " +
        "revision blocks preserve the factual record of the filter analysis.",
    },
  ],
};

// ── CLI ───────────────────────────────────────────────────────────────────────

function printSummary(catalog: EsotericResonanceCatalog): void {
  const s = summarizeCatalog(catalog);
  console.log(`\nEsoteric Resonance Catalog — ${catalog.schema}`);
  console.log(`  Total entries:         ${s.total}`);
  console.log(`  Confirmed:             ${s.confirmed}`);
  console.log(`  Candidates:            ${s.candidates}`);
  console.log(`  Failed:                ${s.failed}`);
  console.log(`  Withdrawal-ground:     ${s.withdrawalGroundCount}`);
  console.log(`  Macro-micro:           ${s.macroMicroCount}`);
  console.log(`  Psychologized:         ${s.psychologizedCount}`);
  console.log(`  Anti-instances:        ${s.antiInstanceCount}`);
  console.log(`  By tradition:          ${JSON.stringify(s.byTradition)}`);
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
