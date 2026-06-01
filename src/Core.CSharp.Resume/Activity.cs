using Zeta.Core.CSharp.Bonsai;

namespace Zeta.Core.CSharp.Resume;

/// <summary>
/// The activity a suspended saga is awaiting — its result feeds back as the awaited
/// <c>call</c>'s value. Mirrors the TS <c>{ fn, args }</c> shape and the F# <c>Activity</c>
/// record.
/// </summary>
/// <param name="Fn">The activity (named function) being invoked.</param>
/// <param name="Args">The fully-evaluated arguments to the activity.</param>
public sealed record Activity(string Fn, IReadOnlyList<ConstValue> Args);
