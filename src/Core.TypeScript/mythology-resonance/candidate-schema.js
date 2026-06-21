// Mythology operational-resonance candidate schema (B-0056.1 smallest safe slice)
// Pure-TS, retractibility-native stub. Re-decomposed from broad B-0056 L research track
// (assumes initial doc-only decomposition had mistake by lacking executable check surface).
// Minimal validator stub — future slices extend with real filter checks against ALIGNMENT.md + resonance index
export function validateMythologyCandidate(candidate) {
    // Bounded slice: type-level + stub; no full impl yet (one step only)
    const errors = [];
    if (!candidate.name || candidate.name.length < 3)
        errors.push('name too vague');
    if (!candidate.threeFilter.f3Pass && candidate.state === 'confirmed')
        errors.push('confirmed requires F3 pass');
    if (candidate.textualAnchors.length === 0)
        errors.push('missing textual anchor for research-grade');
    return {
        valid: errors.length === 0,
        errors,
        retractibilityPreserved: true, // stub — real impl will verify git-tracked revision blocks
    };
}
// Seed: Heimdallr (candidate #12 from origin)
export const heimdallrSeed = {
    id: 12,
    name: 'Heimdallr',
    tradition: 'Norse',
    role: 'bridge-figure',
    threeFilter: {
        f1Pass: true,
        f2Strength: 'moderate',
        f3Pass: true,
        notes: 'F2 moderate (strong role-fit but looser than full-pass — Eddic canonicity thinner due to Christianization-filtering); F3 within Norse; additional independent textual anchor (beyond the two Eddas) pending for stronger F2',
    },
    textualAnchors: ['Poetic Edda', 'Prose Edda'],
    state: 'candidate',
    retractibilityNote: 'git-tracked; one-commit removable; no permanent harm',
};
