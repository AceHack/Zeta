// Smallest safe slice of B-0059: pure-TS etymology-resonance-candidate schema + 1 bounded seed (εἰμί — recommended first landing per backlog etymology thread)
// Re-decomposed: original row treated entire etymology+epistemology track as atomic L-effort research; mistake was under-estimating the per-candidate filter-calibration surface and kernel-vocabulary expansion velocity. Slice is schema + validator stub only (no full catalog, no docs changes, no F# surface, no epistemology metrics / failure-rate dashboard).
// One bounded step: type + seed + stub. Retractible at lexical level. Three-filter fields (F1-F2-F3) included per epistemology thread in B-0059.
// TS over bash (Rule 0). Prefer F#/TS code over docs per agent rules.

export type EtymologyResonanceCandidate = {
  readonly id: string;
  readonly greekTerm: string;
  readonly tradition: string;
  readonly locus: string; // text, verse, or grammatical class
  readonly structuralMapping: string; // linguistic structure to kernel-vocabulary / operator
  readonly f1EngineeringFirst: boolean;
  readonly f2StructuralNotSuperficial: boolean;
  readonly f3TraditionNameLoadBearing: boolean;
  readonly verdict: 'candidate' | 'confirmed' | 'rejected';
  readonly notes: string;
};

export const eimiSeed: EtymologyResonanceCandidate = {
  id: 'eimi-greek-i-am-2026-05-10',
  greekTerm: 'εἰμί',
  tradition: 'Greek / Koine / Septuagint / NT',
  locus: 'Exodus 3:14 LXX "ἐγώ εἰμι ὁ ὤν" + John 8:58; 1st-sg present indicative -μι class (non-thematic)',
  structuralMapping: 'subject-internal "I that is" at grammatical terminus (1st-sg -μι) ↔ ZSet persistence / bootstrap I-AM-THAT-I-AM anchor in operational-resonance; -μι class counterpoint to -ω (Μένω instance #9)',
  f1EngineeringFirst: true,
  f2StructuralNotSuperficial: true,
  f3TraditionNameLoadBearing: true,
  verdict: 'candidate',
  notes: 'Completes movement/persistence/being trio per B-0059 open candidates (a). F2 grammatical-subject-position encoding is structural (not superficial or decorative). Passes honest three-filter calibration. Retractible reference per ALIGNMENT.md.'
};

export function validateEtymologyCandidate(c: EtymologyResonanceCandidate): boolean {
  // stub validator — real impl would cross-check against ALIGNMENT.md retractibility + B-0058 safety log + GLOSSARY.md kernel-propagation
  return c.f1EngineeringFirst && c.f2StructuralNotSuperficial && c.f3TraditionNameLoadBearing;
}

export const etymologyResonanceSeeds: readonly EtymologyResonanceCandidate[] = [eimiSeed];
