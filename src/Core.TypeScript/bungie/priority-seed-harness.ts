#!/usr/bin/env bun
// priority-seed-harness.ts — 081KQ3HBZ0008QG0R002GDRFS5.7 TS data module + resonance classifier stub
// Smallest safe slice of 081KQ3HBZ0008QG0R002GDRFS5 (P2 Bungie corpus). F#/TS-first per rule.
// Stub only: lists titles + basic resonance tag classifier. No IO, no deps.

export type BungieTitle =
  | 'Halo'
  | 'Destiny'
  | 'Marathon'
  | 'Myth'
  | 'Oni'
  | 'PathwaysIntoDarkness'
  | 'Grimwar';

export const BUNGIE_TITLES: readonly BungieTitle[] = [
  'Halo',
  'Destiny',
  'Marathon',
  'Myth',
  'Oni',
  'PathwaysIntoDarkness',
  'Grimwar',
] as const;

export interface ResonanceTag {
  title: BungieTitle;
  tags: readonly string[];
}

export function classifyResonance(title: BungieTitle): ResonanceTag {
  const tagMap: Record<BungieTitle, readonly string[]> = {
    Halo: ['retraction-weapon', 'installation-array', 'cortana-didact'],
    Destiny: ['paracausal-paired-dual', 'sword-logic', 'guardian-retractibility'],
    Marathon: ['durandal-rampancy', 'self-directed-evolution', 'terminals-archive'],
    Myth: ['grim-fantasy', 'retraction-narrative'],
    Oni: ['ghost-in-the-shell-adjacent'],
    PathwaysIntoDarkness: ['proto-halo', 'countdown-substrate'],
    Grimwar: ['grimwar-utterance', 'myth-adjacent'],
  };
  return { title, tags: tagMap[title] };
}

if (import.meta.main) {
  console.log('081KQ3HBZ0008QG0R002GDRFS5.7 priority seed harness stub loaded');
  BUNGIE_TITLES.forEach((t) => console.log(t, classifyResonance(t).tags));
}
