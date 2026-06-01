using Zeta.Core.CSharp.Bonsai;

namespace Zeta.Core.CSharp.Resume;

/// <summary>
/// The outcome of a step: either the saga finished, or it suspended awaiting an activity.
/// Sealed-record hierarchy mirrors the F# <c>SagaStep</c> DU and the TS <c>SagaStep</c> union.
/// </summary>
public abstract record SagaStep
{
    private SagaStep() { }

    /// <summary>The saga finished with <paramref name="Value"/>.</summary>
    public sealed record Done(ConstValue Value) : SagaStep;

    /// <summary>The saga suspended; resume with the activity's result.</summary>
    public sealed record Suspended(SagaState State, Activity Activity) : SagaStep;
}
