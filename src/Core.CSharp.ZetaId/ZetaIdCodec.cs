namespace Zeta.Core.CSharp.ZetaId;

public static class ZetaIdCodec
{
    private static BitLayout Layout => BitLayout.Default;

    // Timestamp is packed into a 48-bit field; valid range [0, 2^48 - 1].
    private const long MaxTimestamp = (1L << 48) - 1;

    public static UInt128 Pack(ZetaObservation obs, ISimulationEnvironment env)
    {
        // ZetaObservation is a readonly record struct; default-init has null
        // Authority/Momentum (since they're abstract records). Reject so
        // Pack fails loudly instead of NRE'ing inside Authority.ToByte.
        // Analyzer (CA2208/MA0015) requires paramName to match an actual method
        // parameter, so we use nameof(obs) + describe the offending field in
        // the message text.
        ArgumentNullException.ThrowIfNull(env);
        if (obs.Authority is null)
            throw new ArgumentException("ZetaObservation.Authority must not be null. Default-initialized ZetaObservation has null Authority/Momentum; pass an explicit value.", nameof(obs));
        if (obs.Momentum is null)
            throw new ArgumentException("ZetaObservation.Momentum must not be null. Default-initialized ZetaObservation has null Authority/Momentum; pass an explicit value.", nameof(obs));

        if (obs.Timestamp < 0 || obs.Timestamp > MaxTimestamp)
            throw new ArgumentOutOfRangeException(
                nameof(obs), obs.Timestamp,
                $"ZetaObservation.Timestamp must be 0..{MaxTimestamp} (48-bit field). Values outside this range would silently truncate and collide.");

        // Validate enum-typed narrow fields. C# allows e.g. (Category)999 to
        // compile; without bounds checks the high bits silently truncate and
        // collide. Persona/Location are byte-backed (8-bit) so they max at
        // 255 = their field width; no check needed.
        ValidateEnumField((byte)obs.Version, GeneratedBitLayout.VersionWidth, nameof(obs.Version));
        ValidateEnumField((byte)obs.Chromosome, GeneratedBitLayout.ChromosomeWidth, nameof(obs.Chromosome));
        ValidateEnumField((byte)obs.Category, GeneratedBitLayout.CategoryWidth, nameof(obs.Category));

        if ((byte)obs.Category >= 9)
            throw new ArgumentOutOfRangeException(nameof(obs), obs.Category, "ZetaObservation.Category must be < 9 (0..8). Categories >= 9 are reserved for special layouts like ContentAddress.");

        UInt128 id = 0;

        id = SetBits(id, Layout.Version, (ulong)(byte)obs.Version);
        id = SetBits(id, Layout.Timestamp, (ulong)obs.Timestamp);
        id = SetBits(id, Layout.Chromosome, (ulong)(byte)obs.Chromosome);
        id = SetBits(id, Layout.Category, (ulong)(byte)obs.Category);
        id = SetBits(id, Layout.Authority, Authority.ToByte(obs.Authority));
        id = SetBits(id, Layout.Persona, (ulong)(byte)obs.Persona);
        id = SetBits(id, Layout.Momentum, Momentum.ToByte(obs.Momentum));
        id = SetBits(id, Layout.Location, (ulong)(byte)obs.Location);

        ulong rand32 = (ulong)env.NextInt64() & 0xFFFFFFFFUL;
        id = SetBits(id, Layout.Randomness, rand32);

        return id;
    }

    public static ZetaObservation Unpack(UInt128 id)
    {
        return new ZetaObservation(
            Version: (IdVersion)GetBits(id, Layout.Version),
            Timestamp: (long)GetBits(id, Layout.Timestamp),
            Chromosome: (Chromosome)GetBits(id, Layout.Chromosome),
            Category: (Category)GetBits(id, Layout.Category),
            Authority: Authority.FromByte((byte)GetBits(id, Layout.Authority)),
            Persona: (Persona)GetBits(id, Layout.Persona),
            Momentum: Momentum.FromByte((byte)GetBits(id, Layout.Momentum)),
            Location: (Location)GetBits(id, Layout.Location)
        );
    }

    // The Generic layout gives the payload 119 bits (65 low + 54 high). A wider
    // payload used to be MASKED here rather than rejected, which aliases ids
    // instead of failing: at 2039-09-07T15:47:35.552Z a caller building
    // (ms << 78) | random78 -- the shape inventory/new-item.ts uses -- reaches
    // ms = 2^41, the top ms bit falls off, and the result is BYTE-IDENTICAL to
    // the same call with ms = 0. That is a silent collision with 1970, forever.
    // The bound lives in the primitive (not only in the PackPayload wrapper)
    // because PackGeneric is public: the exposure is a future caller reaching
    // past the wrapper, which is exactly the mistake new-item.ts made in TS.
    private const int GenericPayloadBits = 119;

    public static UInt128 PackGeneric(IdVersion version, Category category, UInt128 payload)
    {
        UInt128 maxPayload = (UInt128.One << GenericPayloadBits) - UInt128.One;
        if (payload > maxPayload)
            throw new ArgumentOutOfRangeException(
                nameof(payload), payload,
                "Generic payload exceeds 119 bits. Masking it would silently alias this id onto a different payload rather than fail.");

        UInt128 id = 0;
        id = SetBits(id, Layout.Version, (ulong)version);
        id = SetBits(id, Layout.Category, (ulong)category);

        UInt128 lowMask = (UInt128.One << 65) - UInt128.One;
        id |= payload & lowMask;

        UInt128 highPart = (payload >> 65) & ((UInt128.One << 54) - UInt128.One);
        id |= highPart << 69;

        return id;
    }

    public static (IdVersion Version, Category Category, UInt128 Payload) UnpackGeneric(UInt128 id)
    {
        var version = (IdVersion)GetBits(id, Layout.Version);
        var category = (Category)GetBits(id, Layout.Category);

        UInt128 lowMask = (UInt128.One << 65) - UInt128.One;
        UInt128 lowPart = id & lowMask;

        UInt128 highPart = (id >> 69) & ((UInt128.One << 54) - UInt128.One);
        UInt128 payload = lowPart | (highPart << 65);

        return (version, category, payload);
    }

    public static UInt128 PackPayload(ZetaIdPayload payload, ISimulationEnvironment env)
    {
        ArgumentNullException.ThrowIfNull(payload);
        return payload switch
        {
            ZetaIdPayload.Observation obs => Pack(obs.Obs, env),
            ZetaIdPayload.ContentAddress content => PackPayloadWithBounds(content.Version, Category.ContentAddress, content.Payload),
            ZetaIdPayload.Generic gen => PackGenericPayload(gen.Version, gen.Category, gen.Payload),
            _ => throw new ArgumentException($"Unknown payload type: {payload.GetType()}", nameof(payload))
        };
    }

    private static UInt128 PackGenericPayload(IdVersion version, Category category, UInt128 payload)
    {
        if ((byte)category < 9 || category == Category.ContentAddress)
            throw new ArgumentException($"Generic payload category must be >= 10 (got {category}). Categories 0..8 are reserved for observations, and 9 is reserved for ContentAddress.", nameof(category));
        return PackPayloadWithBounds(version, category, payload);
    }

    private static UInt128 PackPayloadWithBounds(IdVersion version, Category category, UInt128 payload)
    {
        UInt128 maxPayload = (UInt128.One << 119) - UInt128.One;
        if (payload > maxPayload)
            throw new ArgumentOutOfRangeException(nameof(payload), payload, "Payload exceeds 119 bits.");
        return PackGeneric(version, category, payload);
    }

    public static ZetaIdPayload UnpackPayload(UInt128 id)
    {
        var (version, category, payload) = UnpackGeneric(id);
        if ((byte)category < 9)
        {
            return new ZetaIdPayload.Observation(Unpack(id));
        }
        else if (category == Category.ContentAddress)
        {
            return new ZetaIdPayload.ContentAddress(version, payload);
        }
        else
        {
            return new ZetaIdPayload.Generic(version, category, payload);
        }
    }

    private static void ValidateEnumField(byte value, Bits widthBits, string fieldName)
    {
        int maxValid = (1 << widthBits.Value) - 1;
        if (value > maxValid)
            throw new ArgumentOutOfRangeException(
                fieldName, value,
                $"ZetaObservation.{fieldName} must be 0..{maxValid} ({widthBits}-bit field). Out-of-range enum values would silently truncate and collide.");
    }

    private static UInt128 SetBits(UInt128 value, (Bits Offset, Bits Width) field, ulong fieldValue)
    {
        int offset = field.Offset.Value;
        int width = field.Width.Value;

        UInt128 mask = (UInt128.One << width) - UInt128.One;
        return value | (((UInt128)fieldValue & mask) << offset);
    }

    private static ulong GetBits(UInt128 value, (Bits Offset, Bits Width) field)
    {
        int offset = field.Offset.Value;
        int width = field.Width.Value;

        UInt128 mask = (UInt128.One << width) - UInt128.One;
        return (ulong)((value >> offset) & mask);
    }

    private const string CrockfordAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    private const int Base32Length = 26;

    private static readonly sbyte[] DecodeMap = CreateDecodeMap();

    private static sbyte[] CreateDecodeMap()
    {
        var map = new sbyte[128];
        System.Array.Fill(map, (sbyte)-1);
        for (int i = 0; i < CrockfordAlphabet.Length; i++)
        {
            char c = CrockfordAlphabet[i];
            map[c] = (sbyte)i;
            map[System.Char.ToLowerInvariant(c)] = (sbyte)i;
        }
        // Lenient aliases:
        map['I'] = 1; map['i'] = 1;
        map['L'] = 1; map['l'] = 1;
        map['O'] = 0; map['o'] = 0;
        return map;
    }

    public static string Format(UInt128 id)
    {
        UInt128 v = id;
        char[] chars = new char[Base32Length];
        for (int i = Base32Length - 1; i >= 0; i--)
        {
            chars[i] = CrockfordAlphabet[(int)(v & 31)];
            v >>= 5;
        }
        return new string(chars);
    }

    public static UInt128 Parse(string s)
    {
        System.ArgumentNullException.ThrowIfNull(s);
        if (s.Length != Base32Length)
            throw new System.ArgumentException($"Expected exactly {Base32Length} characters, got {s.Length}", nameof(s));

        char firstChar = s[0];
        if (firstChar >= 128 || DecodeMap[firstChar] >= 8)
            throw new System.ArgumentException("Value exceeds 128 bits (leading pad bits must be zero)", nameof(s));

        UInt128 result = 0;
        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            if (c >= 128)
                throw new System.ArgumentException($"Invalid Crockford base32 character '{c}' at index {i}", nameof(s));
            sbyte val = DecodeMap[c];
            if (val < 0)
                throw new System.ArgumentException($"Invalid Crockford base32 character '{c}' at index {i}", nameof(s));

            result = (result << 5) | (byte)val;
        }

        return result;
    }

    public static bool IsCanonical(string s)
    {
        if (s == null || s.Length != Base32Length)
            return false;

        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            if (CrockfordAlphabet.IndexOf(c, System.StringComparison.Ordinal) < 0)
                return false;
        }

        char firstChar = s[0];
        sbyte firstVal = DecodeMap[firstChar];
        if (firstVal < 0 || firstVal >= 8)
            return false;

        try
        {
            return string.Equals(Format(Parse(s)), s, System.StringComparison.Ordinal);
        }
        catch (System.ArgumentException)
        {
            return false;
        }
    }
}

