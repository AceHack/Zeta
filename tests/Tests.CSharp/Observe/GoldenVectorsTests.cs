namespace Zeta.Tests.CSharp.Observe;

using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp.Observe;

// Cross-language-parity = non-Byzantine-BFT (B-0944): the C# observe-algebra
// (oracle #3) replays the SHARED golden-vector fixture and must produce the SAME
// states the TS reference (oracle #1) emitted — and that the F# oracle (#2) already
// reproduced. "The compilers don't lie." Fixture: tools/observe/golden-vectors.json.
public sealed class GoldenVectorsTests
{
    /// Walk up from the test assembly to the repo root (Zeta.sln sentinel) — same
    /// pattern as tests/Tests.CSharp/ZetaId/CrossVerifyTests.cs.
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(
            Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)
            ?? throw new InvalidOperationException("test assembly has no directory."));
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName
            ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    private static string ReqString(JsonElement e, string name) =>
        e.GetProperty(name).GetString()
        ?? throw new InvalidOperationException($"fixture field '{name}' is not a string.");

    /// `needsNewAction` is OPTIONAL in the wire form (decompose children omit it;
    /// absent ≡ false — the value the reducer sets, so parity holds).
    private static bool BoolOr(JsonElement e, string name, bool fallback) =>
        e.TryGetProperty(name, out var v) ? v.GetBoolean() : fallback;

    private static BacklogItem ParseItem(JsonElement e) => new(
        Id: ReqString(e, "id"),
        Title: ReqString(e, "title"),
        Ready: e.GetProperty("ready").GetBoolean(),
        Ambiguous: e.GetProperty("ambiguous").GetBoolean(),
        NeedsNewAction: BoolOr(e, "needsNewAction", false));

    private static Mode ParseMode(string s) => s switch
    {
        "work" => Mode.Work,
        "explore" => Mode.Explore,
        "play" => Mode.Play,
        "self_reflect" => Mode.SelfReflect,
        "free_time" => Mode.FreeTime,
        _ => throw new InvalidOperationException($"unknown mode in fixture: {s}"),
    };

    private static World ParseWorld(JsonElement e)
    {
        var backlog = e.GetProperty("backlog").EnumerateArray().Select(ParseItem).ToList();
        OperatorChannel? op = e.TryGetProperty("operator", out var opE)
            ? new OperatorChannel(opE.GetProperty("pendingMessage").GetBoolean(), opE.GetProperty("pendingFerry").GetBoolean())
            : null;
        // Absent "mode" key → null (matches the TS optional field).
        Mode? mode = e.TryGetProperty("mode", out var mE)
            ? ParseMode(mE.GetString() ?? throw new InvalidOperationException("mode is not a string."))
            : null;
        return new World(backlog, op, mode);
    }

    private static NextAction ParseEvent(JsonElement e)
    {
        string Reason() => e.TryGetProperty("reason", out var r) ? (r.GetString() ?? string.Empty) : string.Empty;
        BacklogItem Item() => ParseItem(e.GetProperty("item"));
        BacklogItem? ItemOpt() => e.TryGetProperty("item", out var it) ? ParseItem(it) : null;

        var kind = ReqString(e, "kind");
        return kind switch
        {
            "preserve_ferry" => new NextAction.PreserveFerry(Reason()),
            "respond_to_operator" => new NextAction.RespondToOperator(Reason()),
            "do_item" => new NextAction.DoItem(Item()),
            "decompose" => new NextAction.Decompose(Item()),
            "edit_grammar" => new NextAction.EditGrammar(ItemOpt(), Reason()),
            "explore" => new NextAction.Explore(Reason()),
            "play" => new NextAction.Play(Reason()),
            "self_reflect" => new NextAction.SelfReflect(Reason()),
            "free_time" => new NextAction.FreeTime(Reason()),
            _ => throw new InvalidOperationException($"unknown action kind in fixture: {kind}"),
        };
    }

    private static (World Initial, List<NextAction> Events, World Final, List<World> Replay) Load()
    {
        var path = Path.Join(RepoRoot(), "tools", "observe", "golden-vectors.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var root = doc.RootElement;
        var initial = ParseWorld(root.GetProperty("initialWorld"));
        var events = root.GetProperty("events").EnumerateArray().Select(ParseEvent).ToList();
        var final = ParseWorld(root.GetProperty("expectedFinalState"));
        var replay = root.GetProperty("expectedReplayStates").EnumerateArray().Select(ParseWorld).ToList();
        return (initial, events, final, replay);
    }

    /// Structural world equality: C# records compare the <c>Backlog</c> list by
    /// reference, so compare it element-wise (<c>BacklogItem</c> is a record →
    /// SequenceEqual is structural). Operator + Mode use record/enum value equality.
    private static void AssertWorldEqual(World expected, World actual)
    {
        Assert.Equal(expected.Operator, actual.Operator);
        Assert.Equal(expected.Mode, actual.Mode);
        Assert.True(
            expected.Backlog.SequenceEqual(actual.Backlog),
            $"backlog mismatch: expected [{string.Join(", ", expected.Backlog.Select(b => b.Id))}] " +
            $"vs actual [{string.Join(", ", actual.Backlog.Select(b => b.Id))}]");
    }

    [Fact]
    public void FoldReproducesExpectedFinalState()
    {
        var (initial, events, final, _) = Load();
        AssertWorldEqual(final, Algebra.Fold(initial, events));
    }

    [Fact]
    public void ReplayReproducesExpectedReplayStates()
    {
        var (initial, events, _, expected) = Load();
        var actual = Algebra.Replay(initial, events);
        Assert.Equal(expected.Count, actual.Count);
        for (var i = 0; i < expected.Count; i++)
        {
            AssertWorldEqual(expected[i], actual[i]);
        }
    }

    [Fact]
    public void GoldenVectorsExerciseAllNineKinds()
    {
        var (_, events, _, _) = Load();
        var kinds = events.Select(e => e.GetType().Name).Distinct(StringComparer.Ordinal).Count();
        Assert.Equal(9, kinds);
    }
}
