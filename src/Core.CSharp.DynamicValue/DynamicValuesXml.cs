// DynamicValues — canonical XML codec (the C# oracle conforming byte-for-byte to the locked TS
// reference src/Core.TypeScript/dynamic-value/xml.ts; shared byte-lock seed
// src/Core.TypeScript/dynamic-value/golden-vectors-xml.json). Canonical XML is the PARTIAL form
// (6/8 shapes): Float + Bytes are DEFERRED (lock under CBOR), matching the JSON codec's coverage.
// The typed-element form makes the 6 shapes UNAMBIGUOUS and never-collapse natural: <null/>, empty
// <arr></arr>, empty <obj></obj>, and empty <str></str> are four distinct element shapes.
//
// Canonical rules (minified, one rendering per value):
//   null  -> <null/>
//   bool  -> <bool>true</bool> | <bool>false</bool>
//   int   -> <int>DECIMAL</int>           (int64-exact; no leading zeros / '+')
//   str   -> <str>TEXT</str>              (empty: <str></str>)
//   arr   -> <arr>CHILD...</arr>          (empty: <arr></arr>)
//   obj   -> <obj><e k="KEY">VALUE</e>...</obj>   (empty: <obj></obj>; keys keep insertion order)
// No insignificant whitespace. Element TEXT escapes & < > and \t \n \r as character references
// (&#9; &#10; &#13;). Attribute (key) escapes additionally encode ". Culture-invariant throughout.
//
// REPRESENTABILITY BOUNDARY: XML 1.0 forbids NUL and the C0 controls other than \t \n \r even as
// char-refs; a string/key containing one is NOT representable and the encoder declines via
// EncodeError.NotXmlRepresentable. Decode is the inverse of ToCanonicalXml with one fixed-point
// check (ToCanonicalXml(parsed) == input) rejecting every non-canonical form as NonCanonical.

using System.Collections.Immutable;
using System.Globalization;
using System.Text;

namespace Zeta.Core.CSharp;

/// <summary>Canonical XML codec for <see cref="DynamicValue"/> — encode + strict decode, conforming
/// byte-for-byte to the locked TS reference (<c>src/Core.TypeScript/dynamic-value/xml.ts</c>).</summary>
public static class DynamicValuesXml
{
    private const long I64Max = 9223372036854775807L;
    private const long I64Min = -9223372036854775808L;

    // The first deferred variant (Float/Bytes) anywhere in the tree, or null if fully encodable.
    private static EncodeError? FirstDeferred(DynamicValue value)
    {
        switch (value)
        {
            case DynamicValue.Float:
                return EncodeError.FloatDeferred;
            case DynamicValue.Bytes:
                return EncodeError.BytesDeferred;
            case DynamicValue.Array a:
                return a.Items.Select(FirstDeferred).FirstOrDefault(e => e is not null);
            case DynamicValue.Object o:
                return o.Pairs.Select(pair => FirstDeferred(pair.Value)).FirstOrDefault(e => e is not null);
            default:
                return null;
        }
    }

    /// <summary>Canonical XML encoding — the byte-lock target (shared seed
    /// <c>src/Core.TypeScript/dynamic-value/golden-vectors-xml.json</c>). Typed-element, minified
    /// form; <see cref="DynamicValue.Object"/> keys in INSERTION order. v1 locks the same six shapes
    /// as JSON; <see cref="DynamicValue.Float"/> and <see cref="DynamicValue.Bytes"/> are DEFERRED,
    /// and a string/key with an XML-1.0-forbidden control char declines — all surfaced as
    /// <see cref="Result{T, TError}.Err"/> data per the Result-over-exception rule (AGENTS.md),
    /// never thrown.</summary>
    /// <param name="value">the value to encode.</param>
    /// <returns><see cref="Result{T, TError}.Ok"/> with the canonical XML, or
    /// <see cref="Result{T, TError}.Err"/> carrying the reason.</returns>
    public static Result<string, EncodeError> ToCanonicalXml(DynamicValue value)
    {
        ArgumentNullException.ThrowIfNull(value);

        if (FirstDeferred(value) is EncodeError deferred)
        {
            return new Result<string, EncodeError>.Err(deferred);
        }

        if (FirstNotRepresentable(value) is EncodeError notRep)
        {
            return new Result<string, EncodeError>.Err(notRep);
        }

        var sb = new StringBuilder();
        WriteCanonicalXml(sb, value);
        return new Result<string, EncodeError>.Ok(sb.ToString());
    }

    // True iff `code` is a C0 control XML 1.0 forbids (NUL..U+001F except tab/lf/cr).
    private static bool IsForbiddenC0(int code) =>
        code < 0x20 && code != 0x09 && code != 0x0a && code != 0x0d;

    // The first string/key carrying an XML-forbidden control char, or null if all representable.
    private static EncodeError? FirstNotRepresentable(DynamicValue value)
    {
        switch (value)
        {
            case DynamicValue.String s:
                return HasForbiddenC0(s.Value) ? EncodeError.NotXmlRepresentable : null;
            case DynamicValue.Array a:
                return a.Items.Select(FirstNotRepresentable).FirstOrDefault(e => e is not null);
            case DynamicValue.Object o:
                foreach (var pair in o.Pairs)
                {
                    if (HasForbiddenC0(pair.Key))
                    {
                        return EncodeError.NotXmlRepresentable;
                    }

                    if (FirstNotRepresentable(pair.Value) is EncodeError e)
                    {
                        return e;
                    }
                }

                return null;
            default:
                return null;
        }
    }

    private static bool HasForbiddenC0(string? s)
    {
        if (s is null)
        {
            return false;
        }

        foreach (char ch in s)
        {
            if (IsForbiddenC0(ch))
            {
                return true;
            }
        }

        return false;
    }

    private static void WriteCanonicalXml(StringBuilder sb, DynamicValue value)
    {
        switch (value)
        {
            case DynamicValue.Null:
                sb.Append("<null/>");
                break;
            case DynamicValue.Bool b:
                sb.Append(b.Value ? "<bool>true</bool>" : "<bool>false</bool>");
                break;
            case DynamicValue.Int i:
                sb.Append("<int>");
                sb.Append(i.Value.ToString(CultureInfo.InvariantCulture));
                sb.Append("</int>");
                break;
            case DynamicValue.String s:
                sb.Append("<str>");
                AppendXmlText(sb, s.Value);
                sb.Append("</str>");
                break;
            case DynamicValue.Array a:
                sb.Append("<arr>");
                foreach (var item in a.Items)
                {
                    WriteCanonicalXml(sb, item);
                }

                sb.Append("</arr>");
                break;
            case DynamicValue.Object o:
                sb.Append("<obj>");
                foreach (var pair in o.Pairs)
                {
                    sb.Append("<e k=\"");
                    AppendXmlAttr(sb, pair.Key);
                    sb.Append("\">");
                    WriteCanonicalXml(sb, pair.Value);
                    sb.Append("</e>");
                }

                sb.Append("</obj>");
                break;
            default:
                // Unreachable: Float/Bytes caught by FirstDeferred, null guarded by the caller.
                throw new InvalidOperationException(
                    $"WriteCanonicalXml reached a non-locked variant ({value.Type}); should be pre-checked");
        }
    }

    // Escape element TEXT: & < > as entities; \t \n \r as char-refs. Forbidden C0 is pre-checked.
    private static void AppendXmlText(StringBuilder sb, string? rawValue)
    {
        string s = rawValue ?? string.Empty;
        foreach (char ch in s)
        {
            switch (ch)
            {
                case '&':
                    sb.Append("&amp;");
                    break;
                case '<':
                    sb.Append("&lt;");
                    break;
                case '>':
                    sb.Append("&gt;");
                    break;
                case '\t':
                    sb.Append("&#9;");
                    break;
                case '\n':
                    sb.Append("&#10;");
                    break;
                case '\r':
                    sb.Append("&#13;");
                    break;
                default:
                    sb.Append(ch);
                    break;
            }
        }
    }

    // Escape an attribute value (object key): like text plus " as &quot;.
    private static void AppendXmlAttr(StringBuilder sb, string? rawValue)
    {
        string s = rawValue ?? string.Empty;
        foreach (char ch in s)
        {
            switch (ch)
            {
                case '&':
                    sb.Append("&amp;");
                    break;
                case '<':
                    sb.Append("&lt;");
                    break;
                case '>':
                    sb.Append("&gt;");
                    break;
                case '"':
                    sb.Append("&quot;");
                    break;
                case '\t':
                    sb.Append("&#9;");
                    break;
                case '\n':
                    sb.Append("&#10;");
                    break;
                case '\r':
                    sb.Append("&#13;");
                    break;
                default:
                    sb.Append(ch);
                    break;
            }
        }
    }

    /// <summary>Decodes canonical XML into a <see cref="DynamicValue"/> — the inverse of
    /// <see cref="ToCanonicalXml"/> for the six locked shapes (<c>&lt;float&gt;</c>/<c>&lt;bytes&gt;</c>
    /// and unknown tags → <see cref="DecodeError.Unsupported"/>). Strictly canonical: a lenient parse,
    /// then one fixed-point check (<c>ToCanonicalXml(decoded) == input</c>) rejects every non-canonical
    /// form (self-closing empties, <c>&amp;#x9;</c> vs <c>&amp;#9;</c>, whitespace, leading zeros) as
    /// <see cref="DecodeError.NonCanonical"/>. Surfaced as data, never thrown. Mirrors the TS decoder.</summary>
    /// <param name="xml">canonical XML text.</param>
    /// <returns><see cref="Result{T, TError}.Ok"/> with the decoded value, or
    /// <see cref="Result{T, TError}.Err"/> carrying the <see cref="DecodeError"/>.</returns>
    public static Result<DynamicValue, DecodeError> FromCanonicalXml(string xml)
    {
        ArgumentNullException.ThrowIfNull(xml);

        int pos = 0;
        DecodeError? err = TryParseXmlValue(xml, ref pos, out DynamicValue value);
        if (err is DecodeError e)
        {
            return new Result<DynamicValue, DecodeError>.Err(e);
        }

        if (pos != xml.Length)
        {
            return new Result<DynamicValue, DecodeError>.Err(DecodeError.TrailingData);
        }

        // Canonical fixed-point: a canonical string re-encodes to itself. The decoder produces only
        // the six locked shapes (no forbidden C0, since those ride as char-refs back through
        // unescape and re-encode literally), so ToCanonicalXml is Ok here; anything else
        // (self-closing empties, &#x9; vs &#9;, raw whitespace) is well-formed-ish but not canonical.
        if (ToCanonicalXml(value) is not Result<string, EncodeError>.Ok reEnc
            || !string.Equals(reEnc.Value, xml, StringComparison.Ordinal))
        {
            return new Result<DynamicValue, DecodeError>.Err(DecodeError.NonCanonical);
        }

        return new Result<DynamicValue, DecodeError>.Ok(value);
    }

    private readonly struct XmlTag
    {
        public XmlTag(string name, bool close, bool selfClose, string? attrK)
        {
            Name = name;
            Close = close;
            SelfClose = selfClose;
            AttrK = attrK;
        }

        public string Name { get; }

        public bool Close { get; }

        public bool SelfClose { get; }

        public string? AttrK { get; }
    }

    // Reads the run of raw (still-escaped) text up to the next '<'.
    private static string ReadXmlTextRun(string xml, ref int pos)
    {
        int start = pos;
        while (pos < xml.Length && xml[pos] != '<')
        {
            pos++;
        }

        return xml.Substring(start, pos - start);
    }

    // Reads an opening/closing/self-closing tag at `pos` (which must be at '<'). Returns null on
    // success (tag set), else the error.
    private static DecodeError? ReadXmlTag(string xml, ref int pos, out XmlTag tag)
    {
        tag = default;
        if (pos >= xml.Length || xml[pos] != '<')
        {
            return DecodeError.MalformedXml;
        }

        pos++;
        bool close = false;
        if (pos < xml.Length && xml[pos] == '/')
        {
            close = true;
            pos++;
        }

        int nameStart = pos;
        while (pos < xml.Length && xml[pos] >= 'a' && xml[pos] <= 'z')
        {
            pos++;
        }

        string name = xml.Substring(nameStart, pos - nameStart);
        if (name.Length == 0)
        {
            return DecodeError.MalformedXml;
        }

        string? attrK = null;
        if (pos < xml.Length && xml[pos] == ' ')
        {
            DecodeError? attrErr = ReadKAttr(xml, ref pos, out attrK);
            if (attrErr is DecodeError ae)
            {
                return ae;
            }
        }

        bool selfClose = false;
        if (pos < xml.Length && xml[pos] == '/')
        {
            selfClose = true;
            pos++;
        }

        if (pos >= xml.Length || xml[pos] != '>')
        {
            return DecodeError.MalformedXml;
        }

        pos++;
        tag = new XmlTag(name, close, selfClose, attrK);
        return null;
    }

    // Reads ` k="..."` (pos is at the leading space). Returns null on success (attrK set), else error.
    private static DecodeError? ReadKAttr(string xml, ref int pos, out string? attrK)
    {
        attrK = null;
        pos++; // the space
        if (pos + 3 > xml.Length || !string.Equals(xml.Substring(pos, 3), "k=\"", StringComparison.Ordinal))
        {
            return DecodeError.MalformedXml;
        }

        pos += 3;
        int vStart = pos;
        while (pos < xml.Length && xml[pos] != '"')
        {
            pos++;
        }

        if (pos >= xml.Length)
        {
            return DecodeError.UnexpectedEnd;
        }

        DecodeError? attrErr = Unescape(xml.Substring(vStart, pos - vStart), out attrK);
        if (attrErr is DecodeError ae)
        {
            return ae;
        }

        pos++; // closing quote
        return null;
    }

    private static DecodeError? ExpectXmlClose(string xml, ref int pos, string name)
    {
        DecodeError? err = ReadXmlTag(xml, ref pos, out XmlTag tag);
        if (err is DecodeError e)
        {
            return e;
        }

        if (!tag.Close || !string.Equals(tag.Name, name, StringComparison.Ordinal) || tag.SelfClose)
        {
            return DecodeError.MalformedXml;
        }

        return null;
    }

    private static DecodeError? TryParseXmlValue(string xml, ref int pos, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        if (pos >= xml.Length || xml[pos] != '<')
        {
            return DecodeError.MalformedXml;
        }

        DecodeError? err = ReadXmlTag(xml, ref pos, out XmlTag tag);
        if (err is DecodeError te)
        {
            return te;
        }

        if (tag.Close)
        {
            return DecodeError.MalformedXml;
        }

        switch (tag.Name)
        {
            case "null":
                if (!tag.SelfClose)
                {
                    return DecodeError.MalformedXml;
                }

                value = new DynamicValue.Null();
                return null;
            case "bool":
                return ParseBool(xml, ref pos, tag, out value);
            case "int":
                return ParseInt(xml, ref pos, tag, out value);
            case "str":
                return ParseStr(xml, ref pos, tag, out value);
            case "arr":
                return ParseArr(xml, ref pos, tag, out value);
            case "obj":
                return ParseObj(xml, ref pos, tag, out value);
            default:
                return DecodeError.Unsupported; // <float>/<bytes> deferred; unknown tags
        }
    }

    private static DecodeError? ParseBool(string xml, ref int pos, XmlTag tag, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        if (tag.SelfClose)
        {
            return DecodeError.MalformedXml;
        }

        string text = ReadXmlTextRun(xml, ref pos);
        DecodeError? ce = ExpectXmlClose(xml, ref pos, "bool");
        if (ce is DecodeError be)
        {
            return be;
        }

        if (string.Equals(text, "true", StringComparison.Ordinal))
        {
            value = new DynamicValue.Bool(true);
            return null;
        }

        if (string.Equals(text, "false", StringComparison.Ordinal))
        {
            value = new DynamicValue.Bool(false);
            return null;
        }

        return DecodeError.MalformedXml;
    }

    private static DecodeError? ParseInt(string xml, ref int pos, XmlTag tag, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        if (tag.SelfClose)
        {
            return DecodeError.MalformedXml;
        }

        string text = ReadXmlTextRun(xml, ref pos);
        DecodeError? ce = ExpectXmlClose(xml, ref pos, "int");
        if (ce is DecodeError ie)
        {
            return ie;
        }

        if (!IsXmlIntToken(text))
        {
            return DecodeError.MalformedXml;
        }

        if (!long.TryParse(text, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out long n))
        {
            return DecodeError.IntegerOverflow;
        }

        if (n > I64Max || n < I64Min)
        {
            return DecodeError.IntegerOverflow;
        }

        value = new DynamicValue.Int(n);
        return null;
    }

    private static DecodeError? ParseStr(string xml, ref int pos, XmlTag tag, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        if (tag.SelfClose)
        {
            value = new DynamicValue.String(string.Empty); // tolerated; fixed-point rejects
            return null;
        }

        string raw = ReadXmlTextRun(xml, ref pos);
        DecodeError? ue = Unescape(raw, out string text);
        if (ue is DecodeError se)
        {
            return se;
        }

        DecodeError? ce = ExpectXmlClose(xml, ref pos, "str");
        if (ce is DecodeError sce)
        {
            return sce;
        }

        value = new DynamicValue.String(text);
        return null;
    }

    private static DecodeError? ParseArr(string xml, ref int pos, XmlTag tag, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        if (tag.SelfClose)
        {
            value = new DynamicValue.Array(ImmutableArray<DynamicValue>.Empty); // tolerated
            return null;
        }

        var items = ImmutableArray.CreateBuilder<DynamicValue>();
        while (!AtCloseTag(xml, pos))
        {
            DecodeError? ive = TryParseXmlValue(xml, ref pos, out DynamicValue item);
            if (ive is DecodeError iae)
            {
                return iae;
            }

            items.Add(item);
        }

        DecodeError? ce = ExpectXmlClose(xml, ref pos, "arr");
        if (ce is DecodeError ace)
        {
            return ace;
        }

        value = new DynamicValue.Array(items.ToImmutable());
        return null;
    }

    private static DecodeError? ParseObj(string xml, ref int pos, XmlTag tag, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        if (tag.SelfClose)
        {
            value = new DynamicValue.Object(ImmutableArray<KeyValuePair<string, DynamicValue>>.Empty);
            return null;
        }

        var pairs = ImmutableArray.CreateBuilder<KeyValuePair<string, DynamicValue>>();
        while (!AtCloseTag(xml, pos))
        {
            DecodeError? ee = ParseObjEntry(xml, ref pos, pairs);
            if (ee is DecodeError eee)
            {
                return eee;
            }
        }

        DecodeError? oce = ExpectXmlClose(xml, ref pos, "obj");
        if (oce is DecodeError ocee)
        {
            return ocee;
        }

        value = new DynamicValue.Object(pairs.ToImmutable());
        return null;
    }

    private static DecodeError? ParseObjEntry(
        string xml, ref int pos, ImmutableArray<KeyValuePair<string, DynamicValue>>.Builder pairs)
    {
        DecodeError? ete = ReadXmlTag(xml, ref pos, out XmlTag eTag);
        if (ete is DecodeError etee)
        {
            return etee;
        }

        if (eTag.Close || !string.Equals(eTag.Name, "e", StringComparison.Ordinal)
            || eTag.AttrK is null || eTag.SelfClose)
        {
            return DecodeError.MalformedXml;
        }

        DecodeError? eve = TryParseXmlValue(xml, ref pos, out DynamicValue val);
        if (eve is DecodeError evee)
        {
            return evee;
        }

        DecodeError? ce = ExpectXmlClose(xml, ref pos, "e");
        if (ce is DecodeError ece)
        {
            return ece;
        }

        pairs.Add(new KeyValuePair<string, DynamicValue>(eTag.AttrK, val));
        return null;
    }

    // True iff `pos` is at the start of a closing tag "</".
    private static bool AtCloseTag(string xml, int pos) =>
        pos < xml.Length && xml[pos] == '<' && pos + 1 < xml.Length && xml[pos + 1] == '/';

    // A canonical-int token: optional leading '-' then one or more decimal digits.
    private static bool IsXmlIntToken(string text)
    {
        if (text.Length == 0)
        {
            return false;
        }

        int start = text[0] == '-' ? 1 : 0;
        if (start == text.Length)
        {
            return false;
        }

        for (int i = start; i < text.Length; i++)
        {
            if (text[i] < '0' || text[i] > '9')
            {
                return false;
            }
        }

        return true;
    }

    // Unescape XML content/attribute: inverse of AppendXmlText/AppendXmlAttr. Lenient (accepts named
    // + decimal + hex char-refs); the fixed-point check re-canonicalizes so any non-canonical
    // spelling re-encodes differently and is rejected. Returns null on success (out set), else error.
    private static DecodeError? Unescape(string s, out string result)
    {
        result = string.Empty;
        var sb = new StringBuilder();
        int i = 0;
        while (i < s.Length)
        {
            char ch = s[i];
            if (ch != '&')
            {
                sb.Append(ch);
                i++;
                continue;
            }

            int semi = s.IndexOf(';', i);
            if (semi < 0)
            {
                return DecodeError.MalformedXml;
            }

            string ent = s.Substring(i + 1, semi - (i + 1));
            DecodeError? ee = AppendEntity(sb, ent);
            if (ee is DecodeError eee)
            {
                return eee;
            }

            i = semi + 1;
        }

        result = sb.ToString();
        return null;
    }

    // Decodes one entity body (between '&' and ';') into `sb`. Returns null on success, else error.
    private static DecodeError? AppendEntity(StringBuilder sb, string ent)
    {
        if (string.Equals(ent, "amp", StringComparison.Ordinal))
        {
            sb.Append('&');
        }
        else if (string.Equals(ent, "lt", StringComparison.Ordinal))
        {
            sb.Append('<');
        }
        else if (string.Equals(ent, "gt", StringComparison.Ordinal))
        {
            sb.Append('>');
        }
        else if (string.Equals(ent, "quot", StringComparison.Ordinal))
        {
            sb.Append('"');
        }
        else if (string.Equals(ent, "apos", StringComparison.Ordinal))
        {
            sb.Append('\'');
        }
        else if (ent.Length > 0 && ent[0] == '#')
        {
            bool isHex = ent.Length > 1 && (ent[1] == 'x' || ent[1] == 'X');
            string digits = isHex ? ent.Substring(2) : ent.Substring(1);
            if (digits.Length == 0 || !AllDigits(digits, isHex))
            {
                return DecodeError.MalformedXml;
            }

            int code = int.Parse(digits, isHex ? NumberStyles.HexNumber : NumberStyles.Integer, CultureInfo.InvariantCulture);
            sb.Append(char.ConvertFromUtf32(code));
        }
        else
        {
            return DecodeError.MalformedXml;
        }

        return null;
    }

    private static bool AllDigits(string s, bool isHex)
    {
        foreach (char c in s)
        {
            bool ok = isHex
                ? (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
                : c >= '0' && c <= '9';
            if (!ok)
            {
                return false;
            }
        }

        return true;
    }
}
