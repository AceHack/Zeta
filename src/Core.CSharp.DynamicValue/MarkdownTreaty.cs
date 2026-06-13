namespace Zeta.Core.CSharp;

using System;
using System.Collections.Generic;
using System.Collections.Immutable;

/// <summary>
/// Markdown + Frontmatter Treaty (Priority 1) for C#.
/// Parses and serializes markdown files with frontmatter.
/// </summary>
public static class MarkdownTreaty
{
    public static Result<(DynamicValue Metadata, string Body), string> Parse(string text)
    {
        text ??= "";
        if (text.StartsWith("---", StringComparison.Ordinal) && (text.Length == 3 || text[3] == '\n' || (text[3] == '\r' && text.Length > 4 && text[4] == '\n')))
        {
            int headerLen = text[3] == '\r' ? 5 : 4;

            if (!TryFindClosingDelimiter(text, headerLen, out int closeStart, out int newlineLen, out int closeEnd))
            {
                return new Result<(DynamicValue, string), string>.Err("Unclosed frontmatter delimiter");
            }

            string yamlPart = text.Substring(headerLen, closeStart + newlineLen - headerLen);
            string bodyPart = text.Substring(closeEnd);

            var fromYamlRes = DynamicValues.FromYaml(yamlPart);
            if (fromYamlRes is not Result<DynamicValue, DecodeError>.Ok okYaml)
            {
                var errRes = (Result<DynamicValue, DecodeError>.Err)fromYamlRes;
                return new Result<(DynamicValue, string), string>.Err($"Failed to parse frontmatter YAML: {errRes.Error}");
            }

            if (okYaml.Value is not DynamicValue.Object metadata)
            {
                return new Result<(DynamicValue, string), string>.Err("Frontmatter must be a YAML map (Object)");
            }

            return new Result<(DynamicValue, string), string>.Ok((metadata, bodyPart));
        }
        else
        {
            var emptyObj = new DynamicValue.Object(ImmutableArray<KeyValuePair<string, DynamicValue>>.Empty);
            return new Result<(DynamicValue, string), string>.Ok((emptyObj, text));
        }
    }

    private static bool TryFindClosingDelimiter(
        string text, int startIdx, out int closeStart, out int newlineLen, out int closeEnd)
    {
        closeStart = -1; newlineLen = -1; closeEnd = -1;
        int index = startIdx;
        while (index < text.Length)
        {
            bool isNewline = false; int curNewlineLen = 0; int nextIdx = index;
            if (text[index] == '\n')
            {
                isNewline = true; curNewlineLen = 1; nextIdx = index + 1;
            }
            else if (text[index] == '\r' && index + 1 < text.Length && text[index + 1] == '\n')
            {
                isNewline = true; curNewlineLen = 2; nextIdx = index + 2;
            }

            if (isNewline)
            {
                if (nextIdx + 3 <= text.Length && string.Equals(text.Substring(nextIdx, 3), "---", StringComparison.Ordinal))
                {
                    int tailIdx = nextIdx + 3;
                    if (tailIdx == text.Length || text[tailIdx] == '\n' || (text[tailIdx] == '\r' && tailIdx + 1 < text.Length && text[tailIdx + 1] == '\n'))
                    {
                        closeStart = index;
                        newlineLen = curNewlineLen;
                        closeEnd = tailIdx == text.Length ? tailIdx : (text[tailIdx] == '\n' ? tailIdx + 1 : tailIdx + 2);
                        return true;
                    }
                }
                index = nextIdx;
            }
            else index++;
        }
        return false;
    }

    public static Result<string, EncodeError> Serialize(DynamicValue metadata, string body)
    {
        if (metadata is not DynamicValue.Object obj)
        {
            return new Result<string, EncodeError>.Err(EncodeError.NotXmlRepresentable);
        }

        if (obj.Pairs.Length == 0)
        {
            return new Result<string, EncodeError>.Ok(body ?? "");
        }

        var toYamlRes = DynamicValues.ToYaml(obj);
        if (toYamlRes is not Result<string, EncodeError>.Ok okYaml)
        {
            var errRes = (Result<string, EncodeError>.Err)toYamlRes;
            return new Result<string, EncodeError>.Err(errRes.Error);
        }

        string result = $"---\n{okYaml.Value}---\n{body ?? ""}";
        return new Result<string, EncodeError>.Ok(result);
    }
}
