/**
 * Mystery Schools Catalog — pure-TS schema for Stage 1 bibliographic scaffold
 * CATALOG-ONLY, gentle register, no claim-staking, no operational resonance.
 * B-0049 re-decomposed slice .3: Orphic/Dionysian family scaffold foundation.
 *
 * This is the code substrate for the research track. Bibliographic entries
 * are data, not assertions. Filters intentionally disabled.
 */

export interface BibliographicEntry {
  readonly tradition: string;
  readonly period: string;
  readonly primarySources: readonly string[];
  readonly secondarySources: readonly string[];
  readonly modernReception: readonly string[];
  readonly scholarlyConsensusNotes: string;
  // catalog-only: no resonance, no edge flags
}

export interface MysterySchoolCatalog {
  readonly family: string;
  readonly entries: readonly BibliographicEntry[];
}

// Smallest safe slice: Orphic/Dionysian scaffold (next after Eleusinian .1, Mithraic .2)
export const orphicDionysianScaffold: MysterySchoolCatalog = {
  family: "Orphic / Dionysian",
  entries: [
    {
      tradition: "Orphic / Dionysian mysteries",
      period: "Thrace → archaic Greece → Hellenistic → Roman (c. 6th c BCE – 4th c CE)",
      primarySources: [
        "Orphic gold tablets (lamellae)",
        "Derveni Papyrus",
        "Euripides Bacchae",
        "Orphic Hymns (late antique collection)"
      ],
      secondarySources: [
        "W.K.C. Guthrie, Orpheus and Greek Religion",
        "Mircea Eliade, History of Religious Ideas vol 1",
        "Fritz Graf & Sarah Iles Johnston, Ritual Texts for the Afterlife"
      ],
      modernReception: [
        "Renaissance Neoplatonism",
        "Romantic Orphism (Nerval, etc.)",
        "20th c scholarship on mystery cults"
      ],
      scholarlyConsensusNotes: "Consensus: distinct but overlapping with Eleusinian and Dionysian civic cults; gold tablets attest afterlife doctrines; no single 'Orphic church' but loose textual and initiatory tradition."
    }
  ]
};

// Utility: catalog-only validator (no claims)
export function validateCatalog(catalog: MysterySchoolCatalog): boolean {
  return catalog.family.length > 0 && catalog.entries.length > 0;
}

// Re-decomposition note (per instruction): original B-0049 decomposition assumed two families sufficient for Stage 1 start; re-decomposed here to include Orphic as .3 to avoid under-sampling the Dionysian thread. Further families (Pythagorean, Isiac, Hermetic) remain for subsequent bounded slices.