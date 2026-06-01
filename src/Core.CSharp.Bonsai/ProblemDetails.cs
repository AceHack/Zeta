namespace Zeta.Core.CSharp.Bonsai;

/// <summary>
/// RFC-9457 "Problem Details" — the field-keyed multi-error document (the shape .NET ships
/// as <c>ValidationProblemDetails</c>; useful well outside HTTP). The accumulate mode adapts
/// a collected <see cref="PathedFeedback"/> list into this <c>Errors</c> map (path → messages).
/// </summary>
/// <param name="Type">The problem-type URI (defaults to <c>about:blank</c>).</param>
/// <param name="Title">A short, human-readable summary of the problem.</param>
/// <param name="Errors">The field-keyed error map: each JSON-path to its messages.</param>
public sealed record ProblemDetails(
    string Type,
    string Title,
    IReadOnlyDictionary<string, IReadOnlyList<string>> Errors);
