namespace Zeta.Core.CSharp.Resume;

/// <summary>
/// The persisted, resumable state of a suspended saga: the continuation + the pending activity.
/// Mirrors the TS <c>SagaState</c> interface and the F# <c>SagaState</c> record.
/// <para><b>Kont order</b> matches the TS reference exactly: index 0 is the outermost frame and
/// the LAST element is the top of stack (TS pushes by appending). This is the byte-locked wire
/// order for cross-oracle / cross-machine state portability.</para>
/// </summary>
/// <param name="Kont">The continuation (work stack), outermost-first; resume restores this.</param>
/// <param name="Awaiting">The activity the saga is awaiting.</param>
public sealed record SagaState(IReadOnlyList<Frame> Kont, Activity Awaiting);
