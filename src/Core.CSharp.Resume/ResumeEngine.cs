using System.Globalization;
using System.Numerics;
using System.Text;
using System.Text.Json;
using Zeta.Core.CSharp.Bonsai;

namespace Zeta.Core.CSharp.Resume;

/// <summary>
/// Resume engine — the C# oracle (#3 of TS/F#/C#/Rust) for the <b>resume-engine slice</b>
/// (B-0976). Where <see cref="BonsaiCodec"/> is the <i>serializer</i> (the deferred
/// computation's shape), this is the <i>evaluator</i> that runs it with <b>restore-not-replay</b>
/// durable execution. Ferry of the TS reference (<c>src/Core.TypeScript/bonsai/resume.ts</c>);
/// replays the shared <c>resume-golden.json</c> saga traces — same suspension sequence + final
/// value across oracles. "The compilers don't lie."
///
/// <para>Model: a small-step <b>CEK machine</b> over the Bonsai-subset <see cref="Expr"/>.
/// <c>Invoke</c> nodes are activities — the suspension points. Pure parts
/// (Constant/Param/Binary/Cond) evaluate inline; at an activity the machine <b>suspends</b>,
/// handing back a serializable <see cref="SagaState"/> = the remaining continuation (the
/// <c>Kont</c> list) + the pending activity. <see cref="Resume"/> <b>restores</b> that
/// continuation and feeds the result back as the call's value — it does NOT replay from the top,
/// so prior activities are never re-invoked.</para>
///
/// <para>Slice-1 scope: Constant/Param/Binary/Cond/Invoke. <c>Lambda</c> application is deferred
/// (slice-2) — a <c>Lambda</c> in evaluation position declines <c>UnsupportedNode</c>.</para>
/// </summary>
public static class ResumeEngine
{
    /// <summary>The resume-state serialization version (the <c>v</c> field of the wrapper).</summary>
    public const int Version = 1;

    // The shared JS-safe-integer bounds (2^53 - 1): the int wire domain (matches Bonsai).
    private const long MaxSafeInt = 9007199254740991L;
    private const long MinSafeInt = -9007199254740991L;

    // JSON tokenizer depth ceiling for restore: a persisted state embeds Bonsai-serialized Exprs
    // INLINE (up to BonsaiCodec.MaxDepth deep) wrapped in a few state levels; allow generous
    // headroom above the worst case (the default JsonDocument MaxDepth = 64 would reject a valid
    // deep program).
    private const int StateDepthCeiling = BonsaiCodec.MaxDepth * 4;

    // ---- internal typed signal (the wire contract stays Result) ----------------

    private sealed class ResumeFail : Exception
    {
        public ResumeFail(ResumeFeedback feedback) => Feedback = feedback;

        public ResumeFeedback Feedback { get; }
    }

    private static ResumeFail Bad(string message) => new(new ResumeFeedback.MalformedState(message));

    // ---- pure operators (the saga's inline semantics) --------------------------

    private static long AsInt(ConstValue v, string where) =>
        v is ConstValue.Number n ? n.Value : throw new ResumeFail(new ResumeFeedback.TypeMismatch(where, "int"));

    private static bool AsBool(ConstValue v, string where) =>
        v is ConstValue.Bool b ? b.Value : throw new ResumeFail(new ResumeFeedback.TypeMismatch(where, "bool"));

    // Build an int ConstValue from a wide (overflow-free) result, declining if it left the shared
    // JS-safe-integer domain. The arithmetic is done in BigInteger FIRST: C# `long` silently
    // WRAPS on overflow (unlike JS floats, which lose precision and are still caught by
    // Number.isSafeInteger — so the TS reference is immune), meaning a safe-int * safe-int
    // multiply (<= ~8.1e31) overflows long and could wrap to a wrong in-range value before any
    // bounds check. BigInteger never overflows; range-check then narrow.
    private static ConstValue.Number ToSafe(BigInteger p)
    {
        if (p >= MinSafeInt && p <= MaxSafeInt)
        {
            return new ConstValue.Number((long)p);
        }

        long v = p > long.MaxValue ? long.MaxValue : p < long.MinValue ? long.MinValue : (long)p;
        throw new ResumeFail(new ResumeFeedback.NonSafeInt(v));
    }

    private static ConstValue ApplyBinOp(BinOp op, ConstValue left, ConstValue right) => op switch
    {
        BinOp.Add => ToSafe((BigInteger)AsInt(left, "add.left") + AsInt(right, "add.right")),
        BinOp.Sub => ToSafe((BigInteger)AsInt(left, "sub.left") - AsInt(right, "sub.right")),
        BinOp.Mul => ToSafe((BigInteger)AsInt(left, "mul.left") * AsInt(right, "mul.right")),
        // record value equality is exactly constEq: different concrete type -> false; same -> fields
        BinOp.Eq => new ConstValue.Bool(left.Equals(right)),
        BinOp.Lt => new ConstValue.Bool(AsInt(left, "lt.left") < AsInt(right, "lt.right")),
        BinOp.And => new ConstValue.Bool(AsBool(left, "and.left") && AsBool(right, "and.right")),
        BinOp.Or => new ConstValue.Bool(AsBool(left, "or.left") || AsBool(right, "or.right")),
        _ => throw new ResumeFail(new ResumeFeedback.MalformedState("unknown operator")),
    };

    // ---- the CEK machine -------------------------------------------------------

    private abstract record Control
    {
        private Control() { }

        public sealed record Eval(Expr Node, IReadOnlyDictionary<string, ConstValue> Env) : Control;

        public sealed record Ret(ConstValue Value) : Control;
    }

    private abstract record Transition
    {
        private Transition() { }

        public sealed record Continue(Control Ctrl, IReadOnlyList<Frame> Stack) : Transition;

        public sealed record Halt(SagaStep Step) : Transition;
    }

    private static Transition.Continue Cont(Control ctrl, IReadOnlyList<Frame> stack) => new(ctrl, stack);

    private static Transition.Halt Stop(SagaStep step) => new(step);

    // kont matches the TS reference: index 0 outermost, LAST element top-of-stack (push appends).
    private static List<Frame> Push(IReadOnlyList<Frame> s, Frame f) => [.. s, f];

    private static List<Frame> PopLast(IReadOnlyList<Frame> s) => s.Take(s.Count - 1).ToList();

    private static SagaStep Run(Control control, IReadOnlyList<Frame> kont)
    {
        Control ctrl = control;
        IReadOnlyList<Frame> stack = kont;

        while (true)
        {
            Transition t = ctrl switch
            {
                Control.Eval e => EvalExpr(e.Node, e.Env, stack),
                Control.Ret r => ApplyFrame(r.Value, stack),
                _ => throw Bad("unreachable control"),
            };

            if (t is Transition.Halt h)
            {
                return h.Step;
            }

            var c = (Transition.Continue)t;
            ctrl = c.Ctrl;
            stack = c.Stack;
        }
    }

    private static Transition EvalExpr(Expr e, IReadOnlyDictionary<string, ConstValue> env, IReadOnlyList<Frame> stack) => e switch
    {
        Expr.Constant c => Cont(new Control.Ret(c.Value), stack),
        Expr.Param p => env.TryGetValue(p.Name, out var v)
            ? Cont(new Control.Ret(v), stack)
            : throw new ResumeFail(new ResumeFeedback.Unbound(p.Name)),
        Expr.Binary b => Cont(new Control.Eval(b.Left, env), Push(stack, new Frame.EvalRight(b.Op, b.Right, env))),
        Expr.Cond k => Cont(new Control.Eval(k.Test, env), Push(stack, new Frame.Branch(k.Then, k.Else, env))),
        Expr.Invoke inv => EvalInvoke(inv, env, stack),
        Expr.Lambda => throw new ResumeFail(new ResumeFeedback.UnsupportedNode("lambda")),
        _ => throw Bad("unknown node"),
    };

    private static Transition EvalInvoke(Expr.Invoke inv, IReadOnlyDictionary<string, ConstValue> env, IReadOnlyList<Frame> stack)
    {
        if (inv.Args.Count == 0)
        {
            var act = new Activity(inv.Fn, []);
            return Stop(new SagaStep.Suspended(new SagaState(stack, act), act));
        }

        var frame = new Frame.EvalArgs(inv.Fn, inv.Args.Skip(1).ToList(), [], env);
        return Cont(new Control.Eval(inv.Args[0], env), Push(stack, frame));
    }

    private static Transition ApplyFrame(ConstValue value, IReadOnlyList<Frame> stack)
    {
        if (stack.Count == 0)
        {
            return Stop(new SagaStep.Done(value));
        }

        Frame top = stack[stack.Count - 1];
        IReadOnlyList<Frame> rest = PopLast(stack);

        return top switch
        {
            Frame.EvalRight er => Cont(new Control.Eval(er.Right, er.Env), Push(rest, new Frame.ApplyOp(er.Op, value))),
            Frame.ApplyOp ao => Cont(new Control.Ret(ApplyBinOp(ao.Op, ao.Left, value)), rest),
            Frame.Branch br => Cont(new Control.Eval(AsBool(value, "cond.test") ? br.Then : br.Else, br.Env), rest),
            Frame.EvalArgs ea => ApplyEvalArgs(ea, value, rest),
            _ => throw Bad("unknown frame"),
        };
    }

    private static Transition ApplyEvalArgs(Frame.EvalArgs ea, ConstValue value, IReadOnlyList<Frame> rest)
    {
        var done = new List<ConstValue>(ea.Done) { value };

        if (ea.Pending.Count == 0)
        {
            var act = new Activity(ea.Fn, done);
            return Stop(new SagaStep.Suspended(new SagaState(rest, act), act));
        }

        var frame = new Frame.EvalArgs(ea.Fn, ea.Pending.Skip(1).ToList(), done, ea.Env);
        return Cont(new Control.Eval(ea.Pending[0], ea.Env), Push(rest, frame));
    }

    private static Result<SagaStep, ResumeFeedback> Trap(Func<SagaStep> thunk)
    {
        try
        {
            return new Result<SagaStep, ResumeFeedback>.Ok(thunk());
        }
        catch (ResumeFail ex)
        {
            return new Result<SagaStep, ResumeFeedback>.Err(ex.Feedback);
        }
    }

    /// <summary>Start a saga with no initial bindings.</summary>
    /// <param name="program">The Bonsai-subset program to run.</param>
    public static Result<SagaStep, ResumeFeedback> Start(Expr program) =>
        Start(program, new Dictionary<string, ConstValue>(StringComparer.Ordinal));

    /// <summary>Start a saga: evaluate <paramref name="program"/> (with initial
    /// <paramref name="bindings"/>) until it finishes or suspends at its first activity.</summary>
    /// <param name="program">The Bonsai-subset program to run.</param>
    /// <param name="bindings">The initial environment (parameter name → value).</param>
    public static Result<SagaStep, ResumeFeedback> Start(Expr program, IReadOnlyDictionary<string, ConstValue> bindings) =>
        Trap(() => Run(new Control.Eval(program, bindings), []));

    /// <summary>Resume a suspended saga: feed <paramref name="activityResult"/> back as the
    /// awaited call's value and continue the restored continuation (no replay).</summary>
    /// <param name="state">The persisted (or in-memory) suspended state.</param>
    /// <param name="activityResult">The result of the awaited activity.</param>
    public static Result<SagaStep, ResumeFeedback> Resume(SagaState state, ConstValue activityResult) =>
        Trap(() => Run(new Control.Ret(activityResult), state.Kont));

    // ---- state serialization (persist a suspension; round-trips) ---------------

    /// <summary>Escape a string to canonical JSON — byte-identical to JS <c>JSON.stringify</c>
    /// (and to Bonsai's embedded-expr escaper), NOT <c>JsonSerializer.Serialize</c> (which
    /// escapes more chars). State strings must match the reference so a TS-persisted state
    /// restores byte-for-byte across the oracles.</summary>
    private static string JStr(string? s)
    {
        if (s is null)
        {
            throw Bad("null string field");
        }

        var sb = new StringBuilder(s.Length + 2);
        sb.Append('"');
        for (int i = 0; i < s.Length; i++)
        {
            char ch = s[i];
            switch (ch)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\b': sb.Append("\\b"); break;
                case '\f': sb.Append("\\f"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (ch < 0x20)
                    {
                        sb.Append("\\u").Append(((int)ch).ToString("x4", CultureInfo.InvariantCulture));
                    }
                    else if (char.IsHighSurrogate(ch) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1]))
                    {
                        sb.Append(ch).Append(s[i + 1]);
                        i++;
                    }
                    else if (char.IsHighSurrogate(ch) || char.IsLowSurrogate(ch))
                    {
                        sb.Append("\\u").Append(((int)ch).ToString("x4", CultureInfo.InvariantCulture));
                    }
                    else
                    {
                        sb.Append(ch);
                    }

                    break;
            }
        }

        sb.Append('"');
        return sb.ToString();
    }

    private static string EmitInt(long v)
    {
        // symmetric with parse (and Bonsai): never emit an int parse would reject
        if (v > MaxSafeInt || v < MinSafeInt)
        {
            throw new ResumeFail(new ResumeFeedback.NonSafeInt(v));
        }

        return $"{{\"t\":\"int\",\"v\":{v.ToString(CultureInfo.InvariantCulture)}}}";
    }

    private static string EmitConstValue(ConstValue c) => c switch
    {
        ConstValue.Number n => EmitInt(n.Value),
        ConstValue.Str s => $"{{\"t\":\"str\",\"v\":{JStr(s.Value)}}}",
        ConstValue.Bool b => $"{{\"t\":\"bool\",\"v\":{(b.Value ? "true" : "false")}}}",
        ConstValue.Null => "{\"t\":\"null\"}",
        _ => throw Bad("unknown const"),
    };

    private static string OpToString(BinOp op) => op switch
    {
        BinOp.Add => "add",
        BinOp.Sub => "sub",
        BinOp.Mul => "mul",
        BinOp.Eq => "eq",
        BinOp.Lt => "lt",
        BinOp.And => "and",
        BinOp.Or => "or",
        _ => throw Bad("unknown operator"),
    };

    private static string EmitExpr(Expr e, string where) => BonsaiCodec.Serialize(e) switch
    {
        Result<string, BonsaiFeedback>.Ok ok => ok.Value,
        Result<string, BonsaiFeedback>.Err err => throw new ResumeFail(
            new ResumeFeedback.MalformedState($"{where}: {err.Error.GetType().Name}")),
        _ => throw Bad(where),
    };

    private static string EmitEnv(IReadOnlyDictionary<string, ConstValue> env)
    {
        // canonical: keys sorted (ordinal, matching JS Array.sort + F# ordinal string compare)
        var parts = env.Keys
            .OrderBy(k => k, StringComparer.Ordinal)
            .Select(k => $"{JStr(k)}:{EmitConstValue(env[k])}");
        return "{" + string.Join(",", parts) + "}";
    }

    private static string EmitEvalArgs(Frame.EvalArgs ea)
    {
        var pend = string.Join(",", ea.Pending.Select(p => EmitExpr(p, "evalArgs.pending")));
        var done = string.Join(",", ea.Done.Select(EmitConstValue));
        return $"{{\"k\":\"evalArgs\",\"fn\":{JStr(ea.Fn)},\"pending\":[{pend}],\"done\":[{done}],\"env\":{EmitEnv(ea.Env)}}}";
    }

    private static string EmitFrame(Frame f) => f switch
    {
        Frame.EvalRight er =>
            $"{{\"k\":\"evalRight\",\"op\":{JStr(OpToString(er.Op))},\"right\":{EmitExpr(er.Right, "evalRight.right")},\"env\":{EmitEnv(er.Env)}}}",
        Frame.ApplyOp ao =>
            $"{{\"k\":\"applyOp\",\"op\":{JStr(OpToString(ao.Op))},\"left\":{EmitConstValue(ao.Left)}}}",
        Frame.Branch br =>
            $"{{\"k\":\"branch\",\"then\":{EmitExpr(br.Then, "branch.then")},\"els\":{EmitExpr(br.Else, "branch.els")},\"env\":{EmitEnv(br.Env)}}}",
        Frame.EvalArgs ea => EmitEvalArgs(ea),
        _ => throw Bad("unknown frame"),
    };

    /// <summary>Serialize a suspended <see cref="SagaState"/> to a canonical string for
    /// persistence (round-trips through <see cref="ParseState"/>).</summary>
    /// <param name="state">The suspended state to persist.</param>
    public static Result<string, ResumeFeedback> SerializeState(SagaState state)
    {
        try
        {
            var kont = string.Join(",", state.Kont.Select(EmitFrame));
            var args = string.Join(",", state.Awaiting.Args.Select(EmitConstValue));
            var s = $"{{\"v\":{Version.ToString(CultureInfo.InvariantCulture)},\"kont\":[{kont}],"
                + $"\"awaiting\":{{\"fn\":{JStr(state.Awaiting.Fn)},\"args\":[{args}]}}}}";
            return new Result<string, ResumeFeedback>.Ok(s);
        }
        catch (ResumeFail ex)
        {
            return new Result<string, ResumeFeedback>.Err(ex.Feedback);
        }
    }

    // ---- state parsing (restore a persisted suspension) ------------------------

    private static JsonElement Prop(JsonElement o, string name, string where) =>
        o.TryGetProperty(name, out var v) ? v : throw Bad($"{where} missing");

    private static bool TryParseBinOp(string s, out BinOp op)
    {
        switch (s)
        {
            case "add": op = BinOp.Add; return true;
            case "sub": op = BinOp.Sub; return true;
            case "mul": op = BinOp.Mul; return true;
            case "eq": op = BinOp.Eq; return true;
            case "lt": op = BinOp.Lt; return true;
            case "and": op = BinOp.And; return true;
            case "or": op = BinOp.Or; return true;
            default: op = default; return false;
        }
    }

    private static BinOp ReadBinOp(JsonElement el, string where)
    {
        if (el.ValueKind != JsonValueKind.String || !TryParseBinOp(el.GetString()!, out var op))
        {
            throw Bad($"{where} unknown operator");
        }

        return op;
    }

    private static ConstValue ReadConstValue(JsonElement el, string where)
    {
        if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty("t", out var t) || t.ValueKind != JsonValueKind.String)
        {
            throw Bad($"{where} is not a const");
        }

        switch (t.GetString())
        {
            case "int":
                if (!el.TryGetProperty("v", out var iv) || iv.ValueKind != JsonValueKind.Number
                    || !iv.TryGetInt64(out var n) || n > MaxSafeInt || n < MinSafeInt)
                {
                    throw Bad($"{where} int value");
                }

                return new ConstValue.Number(n);
            case "str":
                if (!el.TryGetProperty("v", out var sv) || sv.ValueKind != JsonValueKind.String)
                {
                    throw Bad($"{where} str value");
                }

                return new ConstValue.Str(sv.GetString()!);
            case "bool":
                if (!el.TryGetProperty("v", out var bv) || (bv.ValueKind != JsonValueKind.True && bv.ValueKind != JsonValueKind.False))
                {
                    throw Bad($"{where} bool value");
                }

                return new ConstValue.Bool(bv.GetBoolean());
            case "null":
                return new ConstValue.Null();
            default:
                throw Bad($"{where} unknown const tag");
        }
    }

    private static Dictionary<string, ConstValue> ReadEnv(JsonElement el, string where)
    {
        if (el.ValueKind != JsonValueKind.Object)
        {
            throw Bad($"{where} is not an object");
        }

        var d = new Dictionary<string, ConstValue>(StringComparer.Ordinal);
        foreach (var p in el.EnumerateObject())
        {
            d[p.Name] = ReadConstValue(p.Value, $"{where}.{p.Name}");
        }

        return d;
    }

    private static Expr ReadExpr(JsonElement el, string where) => BonsaiCodec.Parse(el.GetRawText()) switch
    {
        Result<Expr, BonsaiFeedback>.Ok ok => ok.Value,
        Result<Expr, BonsaiFeedback>.Err err => throw Bad($"{where} expr: {err.Error.GetType().Name}"),
        _ => throw Bad($"{where} expr"),
    };

    private static Frame.EvalArgs ReadEvalArgs(JsonElement el)
    {
        var fnEl = Prop(el, "fn", "evalArgs.fn");
        if (fnEl.ValueKind != JsonValueKind.String)
        {
            throw Bad("evalArgs.fn");
        }

        var pendingEl = Prop(el, "pending", "evalArgs.pending");
        var doneEl = Prop(el, "done", "evalArgs.done");
        if (pendingEl.ValueKind != JsonValueKind.Array)
        {
            throw Bad("evalArgs.pending is not an array");
        }

        if (doneEl.ValueKind != JsonValueKind.Array)
        {
            throw Bad("evalArgs.done is not an array");
        }

        var pending = new List<Expr>();
        int pi = 0;
        foreach (var p in pendingEl.EnumerateArray())
        {
            pending.Add(ReadExpr(p, $"evalArgs.pending[{pi++}]"));
        }

        var done = new List<ConstValue>();
        int di = 0;
        foreach (var d in doneEl.EnumerateArray())
        {
            done.Add(ReadConstValue(d, $"evalArgs.done[{di++}]"));
        }

        return new Frame.EvalArgs(fnEl.GetString()!, pending, done, ReadEnv(Prop(el, "env", "evalArgs.env"), "evalArgs.env"));
    }

    private static Frame ReadFrame(JsonElement el)
    {
        if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty("k", out var k) || k.ValueKind != JsonValueKind.String)
        {
            throw Bad("frame is not an object");
        }

        switch (k.GetString())
        {
            case "evalRight":
                return new Frame.EvalRight(
                    ReadBinOp(Prop(el, "op", "evalRight.op"), "evalRight.op"),
                    ReadExpr(Prop(el, "right", "evalRight.right"), "evalRight.right"),
                    ReadEnv(Prop(el, "env", "evalRight.env"), "evalRight.env"));
            case "applyOp":
                return new Frame.ApplyOp(
                    ReadBinOp(Prop(el, "op", "applyOp.op"), "applyOp.op"),
                    ReadConstValue(Prop(el, "left", "applyOp.left"), "applyOp.left"));
            case "branch":
                return new Frame.Branch(
                    ReadExpr(Prop(el, "then", "branch.then"), "branch.then"),
                    ReadExpr(Prop(el, "els", "branch.els"), "branch.els"),
                    ReadEnv(Prop(el, "env", "branch.env"), "branch.env"));
            case "evalArgs":
                return ReadEvalArgs(el);
            default:
                throw Bad("unknown frame kind");
        }
    }

    private static SagaState ReadState(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object)
        {
            throw Bad("state is not an object");
        }

        if (!root.TryGetProperty("v", out var v) || v.ValueKind != JsonValueKind.Number
            || !v.TryGetInt32(out var ver) || ver != Version)
        {
            throw Bad("unsupported state version");
        }

        var kontEl = Prop(root, "kont", "kont");
        if (kontEl.ValueKind != JsonValueKind.Array)
        {
            throw Bad("kont is not an array");
        }

        var kont = new List<Frame>();
        foreach (var f in kontEl.EnumerateArray())
        {
            kont.Add(ReadFrame(f));
        }

        var awEl = Prop(root, "awaiting", "awaiting");
        if (awEl.ValueKind != JsonValueKind.Object)
        {
            throw Bad("awaiting is not an object");
        }

        var fnEl = Prop(awEl, "fn", "awaiting.fn");
        if (fnEl.ValueKind != JsonValueKind.String)
        {
            throw Bad("awaiting.fn");
        }

        var argsEl = Prop(awEl, "args", "awaiting.args");
        if (argsEl.ValueKind != JsonValueKind.Array)
        {
            throw Bad("awaiting.args is not an array");
        }

        var args = new List<ConstValue>();
        int i = 0;
        foreach (var a in argsEl.EnumerateArray())
        {
            args.Add(ReadConstValue(a, $"awaiting.args[{i++}]"));
        }

        return new SagaState(kont, new Activity(fnEl.GetString()!, args));
    }

    /// <summary>Parse a persisted state string back to a <see cref="SagaState"/> (the inverse of
    /// <see cref="SerializeState"/>).</summary>
    /// <param name="s">The persisted state JSON.</param>
    public static Result<SagaState, ResumeFeedback> ParseState(string s)
    {
        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(s, new JsonDocumentOptions { MaxDepth = StateDepthCeiling });
        }
        catch (JsonException ex)
        {
            return new Result<SagaState, ResumeFeedback>.Err(new ResumeFeedback.MalformedState(ex.Message));
        }

        using (doc)
        {
            try
            {
                return new Result<SagaState, ResumeFeedback>.Ok(ReadState(doc.RootElement));
            }
            catch (ResumeFail ex)
            {
                return new Result<SagaState, ResumeFeedback>.Err(ex.Feedback);
            }
        }
    }
}
