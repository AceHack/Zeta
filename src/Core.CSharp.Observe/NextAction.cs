namespace Zeta.Core.CSharp.Observe;

/// <summary>The event / action union (the Msg). Mirrors the TS <c>NextAction</c>
/// discriminated union — nine kinds — via the abstract-record + sealed-record
/// pattern (same shape as <c>Core.CSharp.TriBoolean</c>'s <c>Tri</c> /
/// <c>DecodeResult</c>). The private constructor closes the hierarchy so only the
/// nested cases derive. <c>Reason</c> never affects the reducer's transition
/// (carried for parity with TS/F#).</summary>
public abstract record NextAction
{
    private NextAction() { }

    public sealed record PreserveFerry(string Reason) : NextAction;

    public sealed record RespondToOperator(string Reason) : NextAction;

    public sealed record DoItem(BacklogItem Item) : NextAction;

    public sealed record Decompose(BacklogItem Item) : NextAction;

    public sealed record EditGrammar(BacklogItem? Item, string Reason) : NextAction;

    public sealed record Explore(string Reason) : NextAction;

    public sealed record Play(string Reason) : NextAction;

    public sealed record SelfReflect(string Reason) : NextAction;

    public sealed record FreeTime(string Reason) : NextAction;
}
