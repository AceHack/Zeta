using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace Zeta.Core.CSharp.Bonsai;

/// <summary>
/// The C# oracle (#3 of TS/F#/C#/Rust) for the <b>Bonsai-subset</b> expression-tree
/// serializer (B-0976 slice 1) — the weakly-typed / reflection-info-omitted mode of Nuqleon
/// Bonsai (kind-tagged nodes, no .NET type table; the cross-language-portable form).
///
/// <para>Canonical form (the cross-oracle byte-diff contract): <see cref="Serialize"/> emits
/// <b>compact JSON</b> (no whitespace) with a <b>fixed key order per node-kind</b> (kind first,
/// then fields in declared order) and <b>integer-only</b> literals in the shared
/// JS-safe-integer range. Two oracles agree iff their <c>Serialize</c> outputs are
/// byte-identical, and <c>Parse</c> round-trips (<c>Serialize(Parse(s))</c> is <c>Ok s</c>).
/// Document wrapper: <c>{"v":1,"expr":&lt;node&gt;}</c>. "The compilers don't lie."</para>
///
/// <para>Error channel: <c>Serialize</c>/<c>Parse</c> return <see cref="Result{T,TError}"/> over
/// <see cref="BonsaiFeedback"/> — no exception crosses the boundary (result over throw).
/// Per the contract-vs-mechanism split, the validation helpers throw an internal typed
/// signal that the two public boundaries adapt to <c>Result</c>: the wire contract stays
/// <c>Result</c>; the internal mechanism is a C# exception (idiomatic, and System.Text.Json
/// throws on malformed input anyway). <c>Serialize</c> hand-rolls the canonical bytes rather
/// than using <c>JsonSerializer</c> because the BCL serializer escapes more characters than
/// JS <c>JSON.stringify</c> (the F#/TS reference) — byte-exactness requires the hand-roll.</para>
/// </summary>
public static class BonsaiCodec
{
    /// <summary>The serialization format version (the <c>v</c> field of the document wrapper).</summary>
    public const int Version = 1;

    /// <summary>The shared v1 maximum expression nesting depth — bounds the recursive
    /// serializer/parser (a stack-overflow / DoS guard) and is the cross-oracle depth contract.</summary>
    public const int MaxDepth = 1024;

    // The shared JS-safe-integer bounds (2^53 - 1): the v1 `int` domain. An integer beyond
    // this is a value a peer oracle (JS) could not preserve, so it declines NonSafeInt.
    private const long MaxSafeInt = 9007199254740991L;
    private const long MinSafeInt = -9007199254740991L;

    // The JsonDocument tokenizer's own nesting ceiling — set generously above MaxDepth so the
    // semantic depth check (TooDeep) fires before the tokenizer's, keeping the feedback typed.
    private const int ParseDepthCeiling = MaxDepth * 2;

    /// <summary>Internal typed signal — the validation helpers throw this on a decline;
    /// <see cref="Serialize"/>/<see cref="Parse"/> catch it at the boundary and return
    /// <c>Err</c> (the contract-vs-mechanism split: wire contract is <c>Result</c>).</summary>
    private sealed class BonsaiFail(BonsaiFeedback feedback) : Exception(feedback.GetType().Name)
    {
        public BonsaiFeedback Feedback { get; } = feedback;
    }

    // ---- serialize (canonical, byte-exact) --------------------------------

    /// <summary>Serialize an expression to the canonical Bonsai-subset string. Declines on an
    /// unsafe/fractional integer literal, a null string field, or nesting past
    /// <see cref="MaxDepth"/> — no exception crosses the boundary.</summary>
    /// <param name="e">The expression to serialize.</param>
    /// <returns><c>Ok</c> with the canonical string, or <c>Err</c> with the typed feedback.</returns>
    public static Result<string, BonsaiFeedback> Serialize(Expr e)
    {
        try
        {
            string body = EmitAt(1, e);
            return new Result<string, BonsaiFeedback>.Ok(
                string.Concat("{\"v\":", Version.ToString(CultureInfo.InvariantCulture), ",\"expr\":", body, "}"));
        }
        catch (BonsaiFail f)
        {
            return new Result<string, BonsaiFeedback>.Err(f.Feedback);
        }
    }

    private static string EmitAt(int depth, Expr e)
    {
        if (depth > MaxDepth)
        {
            throw new BonsaiFail(new BonsaiFeedback.TooDeep(MaxDepth));
        }

        return e switch
        {
            Expr.Constant c => string.Concat("{\"kind\":\"const\",\"value\":", EmitConst(c.Value), "}"),
            Expr.Param p => string.Concat("{\"kind\":\"param\",\"name\":", JStr(p.Name, "param.name"), "}"),
            Expr.Lambda l => string.Concat(
                "{\"kind\":\"lambda\",\"params\":[",
                string.Join(",", l.Parameters.Select(p => JStr(p, "lambda.params[]"))),
                "],\"body\":", EmitAt(depth + 1, l.Body), "}"),
            Expr.Binary b => string.Concat(
                "{\"kind\":\"binary\",\"op\":", JStr(BinOpToString(b.Op), "binary.op"),
                ",\"left\":", EmitAt(depth + 1, b.Left),
                ",\"right\":", EmitAt(depth + 1, b.Right), "}"),
            Expr.Invoke ca => string.Concat(
                "{\"kind\":\"call\",\"fn\":", JStr(ca.Fn, "call.fn"),
                ",\"args\":[", string.Join(",", ca.Args.Select(a => EmitAt(depth + 1, a))), "]}"),
            Expr.Cond co => string.Concat(
                "{\"kind\":\"cond\",\"test\":", EmitAt(depth + 1, co.Test),
                ",\"then\":", EmitAt(depth + 1, co.Then),
                ",\"else\":", EmitAt(depth + 1, co.Else), "}"),
            _ => throw new BonsaiFail(new BonsaiFeedback.MalformedJson("unknown expression node")),
        };
    }

    private static string EmitConst(ConstValue c) => c switch
    {
        ConstValue.Number i => string.Concat("{\"t\":\"int\",\"v\":", CheckSafeInt(i.Value).ToString(CultureInfo.InvariantCulture), "}"),
        ConstValue.Str s => string.Concat("{\"t\":\"str\",\"v\":", JStr(s.Value, "const str value"), "}"),
        ConstValue.Bool b => string.Concat("{\"t\":\"bool\",\"v\":", b.Value ? "true" : "false", "}"),
        ConstValue.Null => "{\"t\":\"null\"}",
        _ => throw new BonsaiFail(new BonsaiFeedback.MalformedJson("unknown const value")),
    };

    private static long CheckSafeInt(long v)
    {
        if (v > MaxSafeInt || v < MinSafeInt)
        {
            throw new BonsaiFail(new BonsaiFeedback.NonSafeInt(v));
        }

        return v;
    }

    /// <summary>JSON-escape a string to match JS <c>JSON.stringify</c> / the F# oracle
    /// byte-for-byte: escape <c>"</c>, <c>\</c>, and control chars (shortforms then
    /// lowercase <c>\u00xx</c>); emit a valid surrogate pair literally; escape a lone
    /// surrogate as <c>\uXXXX</c>. Declines <c>ExpectedString</c> on a null (a CLR null
    /// slipped past the types) so serialize stays total.</summary>
    private static string JStr(string? s, string where)
    {
        if (s is null)
        {
            throw new BonsaiFail(new BonsaiFeedback.ExpectedString(where));
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
                case '\t': sb.Append("\\t"); break;
                case '\n': sb.Append("\\n"); break;
                case '\f': sb.Append("\\f"); break;
                case '\r': sb.Append("\\r"); break;
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

    private static string BinOpToString(BinOp op) => op switch
    {
        BinOp.Add => "add",
        BinOp.Sub => "sub",
        BinOp.Mul => "mul",
        BinOp.Eq => "eq",
        BinOp.Lt => "lt",
        BinOp.And => "and",
        BinOp.Or => "or",
        _ => throw new BonsaiFail(new BonsaiFeedback.UnknownOp(op.ToString())),
    };

    private static bool TryBinOpOfString(string s, out BinOp op)
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

    // ---- parse (canonical string -> Expr) ---------------------------------

    /// <summary>Parse a canonical Bonsai-subset string back to an <see cref="Expr"/> — strict
    /// and <b>canonical-only</b>: a structurally-valid but non-canonical input (extra fields,
    /// whitespace, reordered keys) declines <see cref="BonsaiFeedback.NonCanonical"/> rather
    /// than silently canonicalizing, enforcing the <c>Serialize(Parse(s)) == Ok s</c> fixed
    /// point. Returns <see cref="Result{T,TError}"/> — no exception crosses the boundary, even on
    /// null input or malformed JSON.</summary>
    /// <param name="s">The canonical string to parse.</param>
    /// <returns><c>Ok</c> with the expression, or <c>Err</c> with the typed feedback.</returns>
    public static Result<Expr, BonsaiFeedback> Parse(string s)
    {
        if (s is null)
        {
            return Err(new BonsaiFeedback.MalformedJson("input was not a string"));
        }

        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(s, new JsonDocumentOptions { MaxDepth = ParseDepthCeiling });
        }
        catch (JsonException ex)
        {
            return Err(new BonsaiFeedback.MalformedJson(ex.Message));
        }

        using (doc)
        {
            try
            {
                return ParseDocument(doc.RootElement, s);
            }
            catch (BonsaiFail f)
            {
                return Err(f.Feedback);
            }
        }
    }

    private static Result<Expr, BonsaiFeedback> ParseDocument(JsonElement root, string s)
    {
        if (root.ValueKind != JsonValueKind.Object)
        {
            return Err(new BonsaiFeedback.MalformedJson("document is not an object"));
        }

        if (!root.TryGetProperty("v", out JsonElement vEl) || vEl.ValueKind != JsonValueKind.Number)
        {
            return Err(new BonsaiFeedback.MalformedJson("document v is not a number"));
        }

        if (!vEl.TryGetInt32(out int ver))
        {
            return Err(new BonsaiFeedback.MalformedJson("document v is not an integer"));
        }

        if (ver != Version)
        {
            return Err(new BonsaiFeedback.UnsupportedVersion(ver, Version));
        }

        Expr parsed = ParseNode(1, root.TryGetProperty("expr", out JsonElement exprEl) ? exprEl : default);

        // Canonical-only guard: the round-trip must reproduce the input byte-for-byte.
        return Serialize(parsed) switch
        {
            Result<string, BonsaiFeedback>.Err re => Err(re.Error),
            Result<string, BonsaiFeedback>.Ok ro => string.Equals(ro.Value, s, StringComparison.Ordinal)
                ? new Result<Expr, BonsaiFeedback>.Ok(parsed)
                : Err(new BonsaiFeedback.NonCanonical()),
            _ => Err(new BonsaiFeedback.MalformedJson("unreachable")),
        };
    }

    private static Result<Expr, BonsaiFeedback> Err(BonsaiFeedback f) => new Result<Expr, BonsaiFeedback>.Err(f);

    private static Expr ParseNode(int depth, JsonElement n)
    {
        if (depth > MaxDepth)
        {
            throw new BonsaiFail(new BonsaiFeedback.TooDeep(MaxDepth));
        }

        if (n.ValueKind != JsonValueKind.Object)
        {
            throw new BonsaiFail(new BonsaiFeedback.MalformedJson("node expects an object"));
        }

        if (!n.TryGetProperty("kind", out JsonElement kEl) || kEl.ValueKind != JsonValueKind.String)
        {
            throw new BonsaiFail(new BonsaiFeedback.MalformedJson("node.kind is missing or not a string"));
        }

        string kind = kEl.GetString()!;
        switch (kind)
        {
            case "const":
                return new Expr.Constant(ParseConst(RequireProp(n, "value", "const node")));
            case "param":
                return new Expr.Param(RequireString(n, "name", "param.name"));
            case "lambda":
                return new Expr.Lambda(
                    RequireStringArray(n, "params", "lambda.params"),
                    ParseNode(depth + 1, RequireProp(n, "body", "lambda.body")));
            case "binary":
                return new Expr.Binary(
                    RequireBinOp(n, "op", "binary.op"),
                    ParseNode(depth + 1, RequireProp(n, "left", "binary.left")),
                    ParseNode(depth + 1, RequireProp(n, "right", "binary.right")));
            case "call":
                return new Expr.Invoke(
                    RequireString(n, "fn", "call.fn"),
                    RequireExprArray(depth + 1, n, "args", "call.args"));
            case "cond":
                return new Expr.Cond(
                    ParseNode(depth + 1, RequireProp(n, "test", "cond.test")),
                    ParseNode(depth + 1, RequireProp(n, "then", "cond.then")),
                    ParseNode(depth + 1, RequireProp(n, "else", "cond.else")));
            default:
                throw new BonsaiFail(new BonsaiFeedback.UnknownKind(kind));
        }
    }

    private static ConstValue ParseConst(JsonElement n)
    {
        if (n.ValueKind != JsonValueKind.Object)
        {
            throw new BonsaiFail(new BonsaiFeedback.MalformedJson("const value expects an object"));
        }

        string? t = n.TryGetProperty("t", out JsonElement tEl) && tEl.ValueKind == JsonValueKind.String
            ? tEl.GetString()
            : null;
        switch (t)
        {
            case "int":
                return new ConstValue.Number(RequireSafeInt(n, "v", "const int value"));
            case "str":
                return new ConstValue.Str(RequireString(n, "v", "const str value"));
            case "bool":
                if (!n.TryGetProperty("v", out JsonElement bEl) ||
                    (bEl.ValueKind != JsonValueKind.True && bEl.ValueKind != JsonValueKind.False))
                {
                    throw new BonsaiFail(new BonsaiFeedback.ExpectedBool("const bool value"));
                }

                return new ConstValue.Bool(bEl.ValueKind == JsonValueKind.True);
            case "null":
                return new ConstValue.Null();
            default:
                throw new BonsaiFail(new BonsaiFeedback.UnknownConstTag(t ?? "null"));
        }
    }

    private static JsonElement RequireProp(JsonElement o, string name, string where)
    {
        if (!o.TryGetProperty(name, out JsonElement el))
        {
            throw new BonsaiFail(new BonsaiFeedback.MalformedJson(string.Concat(where, " is missing ", name)));
        }

        return el;
    }

    private static string RequireString(JsonElement o, string name, string where)
    {
        if (!o.TryGetProperty(name, out JsonElement el) || el.ValueKind != JsonValueKind.String)
        {
            throw new BonsaiFail(new BonsaiFeedback.ExpectedString(where));
        }

        return el.GetString()!;
    }

    private static long RequireSafeInt(JsonElement o, string name, string where)
    {
        if (!o.TryGetProperty(name, out JsonElement el) || el.ValueKind != JsonValueKind.Number || !el.TryGetInt64(out long l))
        {
            throw new BonsaiFail(new BonsaiFeedback.ExpectedInt(where));
        }

        if (l > MaxSafeInt || l < MinSafeInt)
        {
            throw new BonsaiFail(new BonsaiFeedback.NonSafeInt(l));
        }

        return l;
    }

    private static List<string> RequireStringArray(JsonElement o, string name, string where)
    {
        if (!o.TryGetProperty(name, out JsonElement el) || el.ValueKind != JsonValueKind.Array)
        {
            throw new BonsaiFail(new BonsaiFeedback.MalformedJson(string.Concat(where, " expects an array")));
        }

        var list = new List<string>();
        foreach (JsonElement item in el.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.String)
            {
                throw new BonsaiFail(new BonsaiFeedback.ExpectedString(string.Concat(where, "[]")));
            }

            list.Add(item.GetString()!);
        }

        return list;
    }

    private static List<Expr> RequireExprArray(int depth, JsonElement o, string name, string where)
    {
        if (!o.TryGetProperty(name, out JsonElement el) || el.ValueKind != JsonValueKind.Array)
        {
            throw new BonsaiFail(new BonsaiFeedback.MalformedJson(string.Concat(where, " expects an array")));
        }

        var list = new List<Expr>();
        foreach (JsonElement item in el.EnumerateArray())
        {
            list.Add(ParseNode(depth, item));
        }

        return list;
    }

    private static BinOp RequireBinOp(JsonElement o, string name, string where)
    {
        string s = RequireString(o, name, where);
        if (!TryBinOpOfString(s, out BinOp op))
        {
            throw new BonsaiFail(new BonsaiFeedback.UnknownOp(s));
        }

        return op;
    }

    // ---- structural equality (the canonical-form equality) ----------------

    /// <summary>Structural equality of two expressions (record <c>==</c> is reference-equal for
    /// the list members, so the oracle provides this element-wise comparison; parity with the
    /// TS <c>equals</c> and the F# structural DU equality).</summary>
    /// <param name="a">The first expression.</param>
    /// <param name="b">The second expression.</param>
    /// <returns><c>true</c> when the two trees are structurally identical.</returns>
    public static bool ExprEquals(Expr a, Expr b) => (a, b) switch
    {
        (Expr.Constant x, Expr.Constant y) => ConstEquals(x.Value, y.Value),
        (Expr.Param x, Expr.Param y) => string.Equals(x.Name, y.Name, StringComparison.Ordinal),
        (Expr.Lambda x, Expr.Lambda y) => x.Parameters.SequenceEqual(y.Parameters, StringComparer.Ordinal) && ExprEquals(x.Body, y.Body),
        (Expr.Binary x, Expr.Binary y) => x.Op == y.Op && ExprEquals(x.Left, y.Left) && ExprEquals(x.Right, y.Right),
        (Expr.Invoke x, Expr.Invoke y) => string.Equals(x.Fn, y.Fn, StringComparison.Ordinal) && x.Args.Count == y.Args.Count && x.Args.Zip(y.Args, ExprEquals).All(t => t),
        (Expr.Cond x, Expr.Cond y) => ExprEquals(x.Test, y.Test) && ExprEquals(x.Then, y.Then) && ExprEquals(x.Else, y.Else),
        _ => false,
    };

    private static bool ConstEquals(ConstValue a, ConstValue b) => (a, b) switch
    {
        (ConstValue.Number x, ConstValue.Number y) => x.Value == y.Value,
        (ConstValue.Str x, ConstValue.Str y) => string.Equals(x.Value, y.Value, StringComparison.Ordinal),
        (ConstValue.Bool x, ConstValue.Bool y) => x.Value == y.Value,
        (ConstValue.Null, ConstValue.Null) => true,
        _ => false,
    };

    // ---- accumulate-mode (RFC-9457 ProblemDetails) ------------------------
    //
    // The applicative complement to the fail-fast Parse: instead of declining at the first
    // error, ParseAll collects EVERY per-node decline keyed by its JSON-path. Independent
    // sub-trees accumulate; a fatal-structural node (not-object / missing-or-unknown kind /
    // too deep) is single for that node but siblings still accumulate. ToProblemDetails adapts
    // the list to the RFC-9457 shape (.NET ValidationProblemDetails' field -> messages map).

    /// <summary>Accumulate-mode parse: like <see cref="Parse"/>, but on failure returns
    /// <b>every</b> per-node decline (each with its JSON-path) instead of just the first — the
    /// applicative complement for batch / model-validation / debugging a malformed tree. On
    /// success returns the same <see cref="Expr"/> as <c>Parse</c> (the canonical-only contract
    /// still applies).</summary>
    /// <param name="s">The string to parse.</param>
    /// <returns><c>Ok</c> with the expression, or <c>Err</c> with all collected declines.</returns>
    public static Result<Expr, IReadOnlyList<PathedFeedback>> ParseAll(string s)
    {
        if (s is null)
        {
            return ErrList(new PathedFeedback("$", new BonsaiFeedback.MalformedJson("input was not a string")));
        }

        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(s, new JsonDocumentOptions { MaxDepth = ParseDepthCeiling });
        }
        catch (JsonException ex)
        {
            return ErrList(new PathedFeedback("$", new BonsaiFeedback.MalformedJson(ex.Message)));
        }

        using (doc)
        {
            JsonElement root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return ErrList(new PathedFeedback("$", new BonsaiFeedback.MalformedJson("document is not an object")));
            }

            if (!root.TryGetProperty("v", out JsonElement vEl) || vEl.ValueKind != JsonValueKind.Number)
            {
                return ErrList(new PathedFeedback("$.v", new BonsaiFeedback.MalformedJson("document v is not a number")));
            }

            if (!vEl.TryGetInt32(out int ver))
            {
                return ErrList(new PathedFeedback("$.v", new BonsaiFeedback.MalformedJson("document v is not an integer")));
            }

            if (ver != Version)
            {
                return ErrList(new PathedFeedback("$.v", new BonsaiFeedback.UnsupportedVersion(ver, Version)));
            }

            var errs = new List<PathedFeedback>();
            PushNode("$.expr", 1, root.TryGetProperty("expr", out JsonElement exprEl) ? exprEl : default, errs);
            if (errs.Count > 0)
            {
                return new Result<Expr, IReadOnlyList<PathedFeedback>>.Err(errs);
            }
        }

        // Structurally valid → reuse the fail-fast Parse for the Expr + canonical guard.
        // The only decline reachable here is NonCanonical (structure already validated).
        return Parse(s) switch
        {
            Result<Expr, BonsaiFeedback>.Ok okv => new Result<Expr, IReadOnlyList<PathedFeedback>>.Ok(okv.Value),
            Result<Expr, BonsaiFeedback>.Err e => ErrList(new PathedFeedback("$", e.Error)),
            _ => ErrList(new PathedFeedback("$", new BonsaiFeedback.MalformedJson("unreachable"))),
        };
    }

    /// <summary>Adapt the collected declines to an RFC-9457 ProblemDetails document: group by
    /// JSON-path into the <c>errors</c> map (each path → its messages).</summary>
    /// <param name="feedbacks">The collected pathed declines.</param>
    /// <returns>The grouped ProblemDetails document.</returns>
    public static ProblemDetails ToProblemDetails(IReadOnlyList<PathedFeedback> feedbacks)
    {
        ArgumentNullException.ThrowIfNull(feedbacks);
        var errors = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        foreach (PathedFeedback pf in feedbacks)
        {
            if (!errors.TryGetValue(pf.Path, out List<string>? list))
            {
                list = new List<string>();
                errors[pf.Path] = list;
            }

            list.Add(FeedbackMessage(pf.Feedback));
        }

        var ro = errors.ToDictionary(kv => kv.Key, kv => (IReadOnlyList<string>)kv.Value, StringComparer.Ordinal);
        return new ProblemDetails("about:blank", "Bonsai validation failed", ro);
    }

    private static string FeedbackMessage(BonsaiFeedback f) => f switch
    {
        BonsaiFeedback.UnsupportedVersion v => $"unsupported version {v.Found} (expected {v.Expected})",
        BonsaiFeedback.MalformedJson m => m.Message,
        BonsaiFeedback.UnknownKind k => $"unknown node kind \"{k.NodeKind}\"",
        BonsaiFeedback.UnknownConstTag t => $"unknown const tag \"{t.Tag}\"",
        BonsaiFeedback.UnknownOp o => $"unknown binary operator \"{o.Op}\"",
        BonsaiFeedback.ExpectedString => "expected a string",
        BonsaiFeedback.ExpectedBool => "expected a boolean",
        BonsaiFeedback.ExpectedInt => "expected a safe integer",
        BonsaiFeedback.NonSafeInt n => $"integer {n.Value} is outside the safe-integer range",
        BonsaiFeedback.TooDeep d => $"nesting exceeds the maximum depth of {d.Limit}",
        BonsaiFeedback.NonCanonical => "input is not in canonical form",
        _ => "unknown feedback",
    };

    private static void PushConst(string path, JsonElement n, List<PathedFeedback> outv)
    {
        if (n.ValueKind != JsonValueKind.Object)
        {
            outv.Add(new PathedFeedback(path, new BonsaiFeedback.MalformedJson(string.Concat(path, " is not an object"))));
            return;
        }

        string? t = n.TryGetProperty("t", out JsonElement tEl) && tEl.ValueKind == JsonValueKind.String ? tEl.GetString() : null;
        switch (t)
        {
            case "int":
                if (!n.TryGetProperty("v", out JsonElement iv) || iv.ValueKind != JsonValueKind.Number || !iv.TryGetInt64(out long l))
                {
                    outv.Add(new PathedFeedback(path, new BonsaiFeedback.ExpectedInt(path)));
                }
                else if (l > MaxSafeInt || l < MinSafeInt)
                {
                    outv.Add(new PathedFeedback(path, new BonsaiFeedback.NonSafeInt(l)));
                }

                return;
            case "str":
                if (!n.TryGetProperty("v", out JsonElement sv) || sv.ValueKind != JsonValueKind.String)
                {
                    outv.Add(new PathedFeedback(path, new BonsaiFeedback.ExpectedString(path)));
                }

                return;
            case "bool":
                if (!n.TryGetProperty("v", out JsonElement bv) || (bv.ValueKind != JsonValueKind.True && bv.ValueKind != JsonValueKind.False))
                {
                    outv.Add(new PathedFeedback(path, new BonsaiFeedback.ExpectedBool(path)));
                }

                return;
            case "null":
                return;
            default:
                outv.Add(new PathedFeedback(path, new BonsaiFeedback.UnknownConstTag(t ?? "null")));
                return;
        }
    }

    private static void PushNode(string path, int depth, JsonElement n, List<PathedFeedback> outv)
    {
        if (depth > MaxDepth)
        {
            outv.Add(new PathedFeedback(path, new BonsaiFeedback.TooDeep(MaxDepth)));
            return;
        }

        if (n.ValueKind != JsonValueKind.Object)
        {
            outv.Add(new PathedFeedback(path, new BonsaiFeedback.MalformedJson(string.Concat(path, " is not an object"))));
            return;
        }

        if (!n.TryGetProperty("kind", out JsonElement kEl) || kEl.ValueKind != JsonValueKind.String)
        {
            outv.Add(new PathedFeedback(path, new BonsaiFeedback.MalformedJson(string.Concat(path, ".kind is missing or not a string"))));
            return;
        }

        switch (kEl.GetString())
        {
            case "const":
                PushConst(string.Concat(path, ".value"), n.TryGetProperty("value", out JsonElement cv) ? cv : default, outv);
                return;
            case "param":
                if (!n.TryGetProperty("name", out JsonElement nm) || nm.ValueKind != JsonValueKind.String)
                {
                    outv.Add(new PathedFeedback(string.Concat(path, ".name"), new BonsaiFeedback.ExpectedString(string.Concat(path, ".name"))));
                }

                return;
            case "lambda":
                PushLambda(path, depth, n, outv);
                return;
            case "binary":
                PushBinary(path, depth, n, outv);
                return;
            case "call":
                PushInvoke(path, depth, n, outv);
                return;
            case "cond":
                PushNode(string.Concat(path, ".test"), depth + 1, n.TryGetProperty("test", out JsonElement ts) ? ts : default, outv);
                PushNode(string.Concat(path, ".then"), depth + 1, n.TryGetProperty("then", out JsonElement th) ? th : default, outv);
                PushNode(string.Concat(path, ".else"), depth + 1, n.TryGetProperty("else", out JsonElement el) ? el : default, outv);
                return;
            default:
                outv.Add(new PathedFeedback(path, new BonsaiFeedback.UnknownKind(kEl.GetString()!)));
                return;
        }
    }

    private static void PushLambda(string path, int depth, JsonElement n, List<PathedFeedback> outv)
    {
        if (n.TryGetProperty("params", out JsonElement pl) && pl.ValueKind == JsonValueKind.Array)
        {
            int i = 0;
            foreach (JsonElement p in pl.EnumerateArray())
            {
                if (p.ValueKind != JsonValueKind.String)
                {
                    string lpath = string.Concat(path, ".params[", i.ToString(CultureInfo.InvariantCulture), "]");
                    outv.Add(new PathedFeedback(lpath, new BonsaiFeedback.ExpectedString(lpath)));
                }

                i++;
            }
        }
        else
        {
            outv.Add(new PathedFeedback(string.Concat(path, ".params"), new BonsaiFeedback.MalformedJson(string.Concat(path, ".params is not an array"))));
        }

        PushNode(string.Concat(path, ".body"), depth + 1, n.TryGetProperty("body", out JsonElement bd) ? bd : default, outv);
    }

    private static void PushBinary(string path, int depth, JsonElement n, List<PathedFeedback> outv)
    {
        if (!n.TryGetProperty("op", out JsonElement opEl) || opEl.ValueKind != JsonValueKind.String || !TryBinOpOfString(opEl.GetString()!, out _))
        {
            string opStr = opEl.ValueKind == JsonValueKind.String ? opEl.GetString()! : "null";
            outv.Add(new PathedFeedback(string.Concat(path, ".op"), new BonsaiFeedback.UnknownOp(opStr)));
        }

        PushNode(string.Concat(path, ".left"), depth + 1, n.TryGetProperty("left", out JsonElement lf) ? lf : default, outv);
        PushNode(string.Concat(path, ".right"), depth + 1, n.TryGetProperty("right", out JsonElement rt) ? rt : default, outv);
    }

    private static void PushInvoke(string path, int depth, JsonElement n, List<PathedFeedback> outv)
    {
        if (!n.TryGetProperty("fn", out JsonElement fn) || fn.ValueKind != JsonValueKind.String)
        {
            outv.Add(new PathedFeedback(string.Concat(path, ".fn"), new BonsaiFeedback.ExpectedString(string.Concat(path, ".fn"))));
        }

        if (n.TryGetProperty("args", out JsonElement ar) && ar.ValueKind == JsonValueKind.Array)
        {
            int i = 0;
            foreach (JsonElement a in ar.EnumerateArray())
            {
                PushNode(string.Concat(path, ".args[", i.ToString(CultureInfo.InvariantCulture), "]"), depth + 1, a, outv);
                i++;
            }
        }
        else
        {
            outv.Add(new PathedFeedback(string.Concat(path, ".args"), new BonsaiFeedback.MalformedJson(string.Concat(path, ".args is not an array"))));
        }
    }

    private static Result<Expr, IReadOnlyList<PathedFeedback>> ErrList(params PathedFeedback[] fs) =>
        new Result<Expr, IReadOnlyList<PathedFeedback>>.Err(fs);
}
