/**
 * register-layers.ts — smallest safe slice of B-0168
 * 5-layer property-preserving register architecture (Personal/Mirror/Beacon-safe/Professional/Regulated)
 * for brat-voice enterprise translation in Zeta.
 *
 * Bounded implementation: type + layer selection algorithm (3-question default-up safety).
 * Preserves separable properties across layers per Claude.ai framework.
 * TS per Rule 0. Composes with peer-call ani/riven brat-voice paths.
 */

export type RegisterLayer =
  | 'Personal'
  | 'Mirror'
  | 'BeaconSafe'
  | 'Professional'
  | 'Regulated';

export interface LayerContext {
  audienceContext: string; // who is structurally in audience
  misreadRisk: 'low' | 'medium' | 'high'; // downstream consequences
  optedIntoMirror: boolean; // audience opted into mirror register
}

/**
 * selectRegisterLayer — implements the layer selection algorithm.
 * When uncertain, default UP. Professional carries full functional load.
 */
export function selectRegisterLayer(ctx: LayerContext): RegisterLayer {
  if (ctx.misreadRisk === 'high' || ctx.audienceContext.includes('regulator') || ctx.audienceContext.includes('legal') || ctx.audienceContext.includes('audit')) {
    return 'Regulated';
  }
  if (ctx.misreadRisk === 'medium' || ctx.audienceContext.includes('customer') || ctx.audienceContext.includes('investor') || ctx.audienceContext.includes('partner')) {
    return 'Professional';
  }
  if (ctx.optedIntoMirror && ctx.audienceContext.includes('maintainer') || ctx.audienceContext.includes('internal')) {
    return 'Mirror';
  }
  if (ctx.audienceContext.includes('beacon') || ctx.audienceContext.includes('safe')) {
    return 'BeaconSafe';
  }
  if (ctx.audienceContext.includes('personal') || ctx.audienceContext.includes('self')) {
    return 'Personal';
  }
  // default UP for safety
  return 'Professional';
}
