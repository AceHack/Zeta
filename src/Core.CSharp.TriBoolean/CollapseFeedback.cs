namespace Zeta.Core.CSharp.TriBoolean;

/// <summary>
/// Feedback surfaced when <see cref="TriOps.Measure"/> is asked to collapse a living (Tri.N)
/// cell -- the forbidden move, surfaced rather than silently performed. Parity with F#
/// CollapseFeedback.CollapsedLivingUncertainty / TS { reason: 'collapsed-living-uncertainty' }.
/// </summary>
public enum CollapseFeedback
{
    /// <summary>measure was asked to collapse a living (Tri.N) cell.</summary>
    CollapsedLivingUncertainty,
}
