using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp.Bonsai;
using Zeta.Core.CSharp.Resume;

namespace Zeta.Tests.CSharp.ResumeEngineTests;

/// <summary>
/// Resume engine — the C# oracle (#3 of TS/F#/C#/Rust) for the B-0976 resume slice. The TS
/// reference (<c>src/Core.TypeScript/bonsai/resume.ts</c>) authors the shared saga traces
/// (<c>resume-golden.json</c>); this proves the C# impl replays them: same ordered suspension
/// sequence + same final value (the cross-language behavioral lock), and restore-not-replay
/// (persist + re-parse the state at every suspension; prior activities are never re-invoked).
/// "The compilers don't lie."
/// </summary>
public class ResumeTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(ResumeTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName
            ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    // ---- golden JSON -> C# DU converters (the golden stores programs as expr-node objects) ----

    private static BinOp BinOpOfJson(string s) => s switch
    {
        "add" => BinOp.Add,
        "sub" => BinOp.Sub,
        "mul" => BinOp.Mul,
        "eq" => BinOp.Eq,
        "lt" => BinOp.Lt,
        "and" => BinOp.And,
        "or" => BinOp.Or,
        var o => throw new InvalidOperationException($"unknown op {o}"),
    };

    private static ConstValue ConstOfJson(JsonElement el) => el.GetProperty("t").GetString() switch
    {
        "int" => new ConstValue.Number(el.GetProperty("v").GetInt64()),
        "str" => new ConstValue.Str(el.GetProperty("v").GetString()!),
        "bool" => new ConstValue.Bool(el.GetProperty("v").GetBoolean()),
        "null" => new ConstValue.Null(),
        var o => throw new InvalidOperationException($"unknown const tag {o}"),
    };

    private static Expr ExprOfJson(JsonElement el) => el.GetProperty("kind").GetString() switch
    {
        "const" => new Expr.Constant(ConstOfJson(el.GetProperty("value"))),
        "param" => new Expr.Param(el.GetProperty("name").GetString()!),
        "lambda" => new Expr.Lambda(
            [.. el.GetProperty("params").EnumerateArray().Select(p => p.GetString()!)],
            ExprOfJson(el.GetProperty("body"))),
        "binary" => new Expr.Binary(
            BinOpOfJson(el.GetProperty("op").GetString()!),
            ExprOfJson(el.GetProperty("left")),
            ExprOfJson(el.GetProperty("right"))),
        "call" => new Expr.Invoke(
            el.GetProperty("fn").GetString()!,
            [.. el.GetProperty("args").EnumerateArray().Select(ExprOfJson)]),
        "cond" => new Expr.Cond(
            ExprOfJson(el.GetProperty("test")),
            ExprOfJson(el.GetProperty("then")),
            ExprOfJson(el.GetProperty("else"))),
        var o => throw new InvalidOperationException($"unknown kind {o}"),
    };

    private static Activity ActivityOfJson(JsonElement el) => new(
        el.GetProperty("fn").GetString()!,
        [.. el.GetProperty("args").EnumerateArray().Select(ConstOfJson)]);

    // ---- Result unwrap helpers ----

    private static SagaStep StepOk(Result<SagaStep, ResumeFeedback> r) =>
        Assert.IsType<Result<SagaStep, ResumeFeedback>.Ok>(r).Value;

    private static SagaState StateOk(Result<SagaState, ResumeFeedback> r) =>
        Assert.IsType<Result<SagaState, ResumeFeedback>.Ok>(r).Value;

    private static string StrOk(Result<string, ResumeFeedback> r) =>
        Assert.IsType<Result<string, ResumeFeedback>.Ok>(r).Value;

    private static void AssertStepErr<TFeedback>(Result<SagaStep, ResumeFeedback> r)
        where TFeedback : ResumeFeedback =>
        Assert.IsType<TFeedback>(Assert.IsType<Result<SagaStep, ResumeFeedback>.Err>(r).Error);

    private static void AssertStateErr<TFeedback>(Result<SagaState, ResumeFeedback> r)
        where TFeedback : ResumeFeedback =>
        Assert.IsType<TFeedback>(Assert.IsType<Result<SagaState, ResumeFeedback>.Err>(r).Error);

    // record equality on Activity compares Args by reference (IReadOnlyList), so compare fieldwise
    private static void AssertActivityEqual(Activity expected, Activity actual)
    {
        Assert.Equal(expected.Fn, actual.Fn);
        Assert.Equal(expected.Args.Count, actual.Args.Count);
        for (int i = 0; i < expected.Args.Count; i++)
        {
            Assert.Equal(expected.Args[i], actual.Args[i]);
        }
    }

    // ---- the cross-language conformance test ----

    [Fact]
    public void ReplaysEverySharedGoldenTraceRestoreNotReplay()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "bonsai", "resume-golden.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var traces = doc.RootElement.GetProperty("traces").EnumerateArray().ToList();
        Assert.NotEmpty(traces);

        foreach (var tr in traces)
        {
            var name = tr.GetProperty("name").GetString()!;
            var program = ExprOfJson(tr.GetProperty("program"));
            var bindings = new Dictionary<string, ConstValue>(StringComparer.Ordinal);
            foreach (var p in tr.GetProperty("bindings").EnumerateObject())
            {
                bindings[p.Name] = ConstOfJson(p.Value);
            }

            var activityResults = tr.GetProperty("activityResults").EnumerateArray().Select(ConstOfJson).ToList();
            var expectedSuspensions = tr.GetProperty("expectedSuspensions").EnumerateArray().Select(ActivityOfJson).ToList();
            // the canonical serializeState bytes the TS reference emits at each suspension, in order —
            // the cross-oracle STATE-BYTE lock this C# oracle must reproduce verbatim (kont top-last)
            var expectedStateAtSuspension = tr.GetProperty("expectedStateAtSuspension").EnumerateArray().Select(e => e.GetString()!).ToList();
            var expectedFinal = ConstOfJson(tr.GetProperty("expectedFinal"));

            var step = StepOk(ResumeEngine.Start(program, bindings));

            for (int i = 0; i < expectedSuspensions.Count; i++)
            {
                var suspended = Assert.IsType<SagaStep.Suspended>(step);
                AssertActivityEqual(expectedSuspensions[i], suspended.Activity);

                // persist -> re-parse -> resume from the RESTORED state (not a replay)
                var ser = StrOk(ResumeEngine.SerializeState(suspended.State));
                // STATE-BYTE LOCK: the persisted continuation must equal the TS reference bytes
                // (the kont serializes top-last — innermost frame last in the array)
                Assert.Equal(expectedStateAtSuspension[i], ser);
                var restored = StateOk(ResumeEngine.ParseState(ser));
                Assert.Equal(ser, StrOk(ResumeEngine.SerializeState(restored))); // round-trip byte-stable
                step = StepOk(ResumeEngine.Resume(restored, activityResults[i]));
            }

            var done = Assert.IsType<SagaStep.Done>(step);
            Assert.True(expectedFinal.Equals(done.Value), $"{name}: expected final {expectedFinal}, got {done.Value}");
        }
    }

    [Fact]
    public void UnboundParamDeclinesUnboundIncludingNonDictionaryKeys()
    {
        foreach (var n in new[] { "missing", "ToString", "GetType" })
        {
            AssertStepErr<ResumeFeedback.Unbound>(ResumeEngine.Start(new Expr.Param(n)));
        }
    }

    [Fact]
    public void TypeMismatchDeclinesTypeMismatch() =>
        AssertStepErr<ResumeFeedback.TypeMismatch>(
            ResumeEngine.Start(new Expr.Binary(BinOp.Add, new Expr.Constant(new ConstValue.Number(1)), new Expr.Constant(new ConstValue.Bool(true)))));

    [Fact]
    public void LambdaInEvalPositionDeclinesUnsupportedNode() =>
        AssertStepErr<ResumeFeedback.UnsupportedNode>(
            ResumeEngine.Start(new Expr.Lambda(["x"], new Expr.Constant(new ConstValue.Number(1)))));

    [Fact]
    public void ArithmeticPastSafeIntDeclinesNonSafeInt() =>
        AssertStepErr<ResumeFeedback.NonSafeInt>(
            ResumeEngine.Start(new Expr.Binary(BinOp.Add, new Expr.Constant(new ConstValue.Number(9007199254740991L)), new Expr.Constant(new ConstValue.Number(1)))));

    [Fact]
    public void MultiplyOverflowingLongButWrappingIntoSafeRangeDeclinesNonSafeInt()
    {
        // 4294967296 (= 2^32) is a valid safe int; its square is 2^64, which wraps to *exactly 0*
        // in signed long. A naive `long a * long b` then `0 in-range -> Number 0` returns a
        // silently-wrong result. The BigInteger-first path catches the true product.
        var program = new Expr.Binary(BinOp.Mul, new Expr.Constant(new ConstValue.Number(4294967296L)), new Expr.Constant(new ConstValue.Number(4294967296L)));
        AssertStepErr<ResumeFeedback.NonSafeInt>(ResumeEngine.Start(program));
    }

    [Fact]
    public void DeepButValidEmbeddedProgramRestoresPastDefaultDepth64()
    {
        static Expr DeepNest(int n) => n <= 0
            ? new Expr.Constant(new ConstValue.Number(0))
            : new Expr.Binary(BinOp.Add, new Expr.Constant(new ConstValue.Number(1)), DeepNest(n - 1));

        // left is a no-arg activity -> suspends immediately, leaving the deep right operand in the
        // EvalRight frame (~200 JSON levels serialized — past 64, under MaxDepth=1024).
        var program = new Expr.Binary(BinOp.Add, new Expr.Invoke("a", []), DeepNest(100));
        var suspended = Assert.IsType<SagaStep.Suspended>(StepOk(ResumeEngine.Start(program)));

        var ser = StrOk(ResumeEngine.SerializeState(suspended.State));
        var restored = StateOk(ResumeEngine.ParseState(ser)); // MalformedState under default depth
        Assert.Equal(ser, StrOk(ResumeEngine.SerializeState(restored)));
    }

    [Fact]
    public void StateStringsEscapeLikeJsonStringifyLiteralAngleBracket()
    {
        // Cross-machine durability: C# state bytes must match the TS reference. JsonSerializer
        // escapes '<' as <; JSON.stringify emits '<' literally.
        var program = new Expr.Invoke("act", [new Expr.Constant(new ConstValue.Str("x<y\"z\n"))]);
        var suspended = Assert.IsType<SagaStep.Suspended>(StepOk(ResumeEngine.Start(program)));

        var ser = StrOk(ResumeEngine.SerializeState(suspended.State));
        Assert.Contains("<", ser, StringComparison.Ordinal); // literal '<'
        Assert.DoesNotContain("\\u003", ser, StringComparison.Ordinal); // no < / > escaping
        Assert.Contains("\\n", ser, StringComparison.Ordinal); // newline as the short escape
        Assert.Equal(ser, StrOk(ResumeEngine.SerializeState(StateOk(ResumeEngine.ParseState(ser)))));
    }

    [Fact]
    public void ParseStateDeclinesMalformedStateOnJunkBadVersionTamperedOpUnsafeInt()
    {
        AssertStateErr<ResumeFeedback.MalformedState>(ResumeEngine.ParseState("not json"));
        AssertStateErr<ResumeFeedback.MalformedState>(
            ResumeEngine.ParseState("{\"v\":2,\"kont\":[],\"awaiting\":{\"fn\":\"a\",\"args\":[]}}"));

        // a real suspension's persisted state with a tampered op / unsafe int must be rejected
        var program = new Expr.Binary(BinOp.Add, new Expr.Invoke("a", [new Expr.Constant(new ConstValue.Number(7))]), new Expr.Invoke("b", []));
        var suspended = Assert.IsType<SagaStep.Suspended>(StepOk(ResumeEngine.Start(program)));
        var ser = StrOk(ResumeEngine.SerializeState(suspended.State));

        var tamperedOp = ser.Replace("\"op\":\"add\"", "\"op\":\"xor\"", StringComparison.Ordinal);
        Assert.NotEqual(ser, tamperedOp, StringComparer.Ordinal);
        AssertStateErr<ResumeFeedback.MalformedState>(ResumeEngine.ParseState(tamperedOp));

        var tamperedInt = ser.Replace("\"v\":7", "\"v\":9007199254740993", StringComparison.Ordinal);
        Assert.NotEqual(ser, tamperedInt, StringComparer.Ordinal);
        AssertStateErr<ResumeFeedback.MalformedState>(ResumeEngine.ParseState(tamperedInt));
    }
}
