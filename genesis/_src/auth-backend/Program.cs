using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

// ---------------------------------------------------------------------------
// Project Genesis — OAuth identity broker (GitHub + GitLab), "identity only".
//
// Why this service exists: a static GitHub Pages site cannot safely perform the
// OAuth code->token exchange because that step requires the client SECRET, and
// anything shipped to the browser is public. This tiny ASP.NET Core service
// holds the secrets, performs the exchange server-to-server, reads the user's
// public identity (id / login / name / avatar), and hands the frontend a
// short-lived signed token. The provider access token NEVER leaves this server.
//
// Flow (no CORS / no third-party cookies needed — only top-level redirects):
//   1. Browser hits  GET /auth/{provider}/login?redirect=<frontend-url>
//   2. We set a first-party, SameSite=Lax state cookie and 302 to the provider.
//   3. Provider 302s back to  GET /auth/{provider}/callback?code=...&state=...
//   4. We verify state, exchange code->token, fetch identity, mint an HS256
//      identity JWT, and 302 to <frontend-url>#token=<jwt>.
//   5. The frontend reads the token from the URL fragment for display.
//
// All configuration comes from environment variables / appsettings. See
// README.md for the full setup + deployment checklist.
// ---------------------------------------------------------------------------

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddHttpClient();
var app = builder.Build();

var cfg = app.Configuration;

string Required(string key) =>
    cfg[key] is { Length: > 0 } v
        ? v
        : throw new InvalidOperationException(
            $"Missing required configuration '{key}'. Set it via environment variable " +
            $"(e.g. {key.Replace(":", "__", StringComparison.Ordinal)}) or appsettings.json.");

string Optional(string key, string fallback) => cfg[key] is { Length: > 0 } v ? v : fallback;

// Public base URL of THIS service, e.g. https://genesis-auth.example.com
// Used to build the redirect_uri sent to the providers. No trailing slash.
var selfBaseUrl = Required("SelfBaseUrl").TrimEnd('/');

// Allowed frontend origins the broker may redirect back to (comma-separated).
// e.g. https://lucent-financial-group.github.io
var allowedRedirects = Required("AllowedFrontendOrigins")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

// HS256 signing secret for our identity token. Generate 32+ random bytes.
var jwtSecret = Encoding.UTF8.GetBytes(Required("Jwt:Secret"));
var jwtIssuer = Optional("Jwt:Issuer", "genesis-auth");
var tokenTtlMinutes = int.Parse(Optional("Jwt:TtlMinutes", "30"), CultureInfo.InvariantCulture);

var providers = new Dictionary<string, ProviderConfig>(StringComparer.Ordinal)
{
    ["github"] = new ProviderConfig(
        ClientId: Required("GitHub:ClientId"),
        ClientSecret: Required("GitHub:ClientSecret"),
        AuthorizeUrl: "https://github.com/login/oauth/authorize",
        TokenUrl: "https://github.com/login/oauth/access_token",
        UserInfoUrl: "https://api.github.com/user",
        Scope: "read:user"),

    // GitLab base defaults to gitlab.com; override GitLab:BaseUrl for self-managed.
    ["gitlab"] = new ProviderConfig(
        ClientId: Required("GitLab:ClientId"),
        ClientSecret: Required("GitLab:ClientSecret"),
        AuthorizeUrl: $"{Optional("GitLab:BaseUrl", "https://gitlab.com").TrimEnd('/')}/oauth/authorize",
        TokenUrl: $"{Optional("GitLab:BaseUrl", "https://gitlab.com").TrimEnd('/')}/oauth/token",
        UserInfoUrl: $"{Optional("GitLab:BaseUrl", "https://gitlab.com").TrimEnd('/')}/api/v4/user",
        Scope: "read_user"),
};

app.MapGet("/healthz", () => Results.Ok(new { status = "ok", providers = providers.Keys }));

// Step 1+2: kick off the OAuth dance.
app.MapGet("/auth/{provider}/login", (string provider, string? redirect, HttpContext ctx) =>
{
    if (!providers.TryGetValue(provider, out var p))
        return Results.NotFound(new { error = $"unknown provider '{provider}'" });

    // Validate the requested post-login frontend redirect against the allowlist.
    var finalRedirect = ResolveRedirect(redirect, allowedRedirects);
    if (finalRedirect is null)
        return Results.BadRequest(new { error = "redirect not in AllowedFrontendOrigins" });

    var state = Base64Url(RandomNumberGenerator.GetBytes(32));

    var cookieOpts = new CookieOptions
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Lax, // first-party on THIS domain; survives the provider round-trip
        MaxAge = TimeSpan.FromMinutes(10),
        Path = "/",
    };
    ctx.Response.Cookies.Append($"gx_state_{provider}", state, cookieOpts);
    ctx.Response.Cookies.Append($"gx_redir_{provider}", finalRedirect, cookieOpts);

    var authorize = QueryHelpersAppend(p.AuthorizeUrl, new()
    {
        ["client_id"] = p.ClientId,
        ["redirect_uri"] = $"{selfBaseUrl}/auth/{provider}/callback",
        ["scope"] = p.Scope,
        ["state"] = state,
        ["response_type"] = "code",
        ["allow_signup"] = "true",
    });

    return Results.Redirect(authorize);
});

// Step 3+4+5: handle the provider callback.
app.MapGet("/auth/{provider}/callback", async (
    string provider, string? code, string? state, string? error,
    HttpContext ctx, IHttpClientFactory httpFactory) =>
{
    if (!providers.TryGetValue(provider, out var p))
        return Results.NotFound(new { error = $"unknown provider '{provider}'" });

    if (!string.IsNullOrEmpty(error))
        return Results.BadRequest(new { error = $"provider returned: {error}" });

    if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
        return Results.BadRequest(new { error = "missing code/state" });

    // Verify state against the first-party cookie (CSRF protection).
    var expectedState = ctx.Request.Cookies[$"gx_state_{provider}"];
    var finalRedirect = ctx.Request.Cookies[$"gx_redir_{provider}"];
    ctx.Response.Cookies.Delete($"gx_state_{provider}");
    ctx.Response.Cookies.Delete($"gx_redir_{provider}");

    if (string.IsNullOrEmpty(expectedState) || !CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedState), Encoding.UTF8.GetBytes(state)))
        return Results.BadRequest(new { error = "invalid state" });

    if (string.IsNullOrEmpty(finalRedirect) || ResolveRedirect(finalRedirect, allowedRedirects) is null)
        return Results.BadRequest(new { error = "invalid redirect" });

    var http = httpFactory.CreateClient();
    http.DefaultRequestHeaders.UserAgent.ParseAdd("genesis-auth/1.0");

    // Exchange the authorization code for an access token (server-to-server).
    using var tokenReq = new HttpRequestMessage(HttpMethod.Post, p.TokenUrl)
    {
        Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = p.ClientId,
            ["client_secret"] = p.ClientSecret,
            ["code"] = code,
            ["grant_type"] = "authorization_code",
            ["redirect_uri"] = $"{selfBaseUrl}/auth/{provider}/callback",
        }),
    };
    tokenReq.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

    using var tokenResp = await http.SendAsync(tokenReq).ConfigureAwait(false);
    var tokenBody = await tokenResp.Content.ReadAsStringAsync().ConfigureAwait(false);
    if (!tokenResp.IsSuccessStatusCode)
        return Results.BadRequest(new { error = "token exchange failed", detail = tokenBody });

    var accessToken = JsonNode.Parse(tokenBody)?["access_token"]?.GetValue<string>();
    if (string.IsNullOrEmpty(accessToken))
        return Results.BadRequest(new { error = "no access_token in response", detail = tokenBody });

    // Fetch the user's public identity.
    using var userReq = new HttpRequestMessage(HttpMethod.Get, p.UserInfoUrl);
    userReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
    userReq.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

    using var userResp = await http.SendAsync(userReq).ConfigureAwait(false);
    if (!userResp.IsSuccessStatusCode)
        return Results.BadRequest(new { error = "userinfo failed", status = (int)userResp.StatusCode });

    var user = JsonNode.Parse(await userResp.Content.ReadAsStringAsync().ConfigureAwait(false));

    // GitHub: { id, login, name, avatar_url }. GitLab: { id, username, name, avatar_url }.
    var id = user?["id"]?.ToString() ?? "";
    var login = user?["login"]?.GetValue<string>() ?? user?["username"]?.GetValue<string>() ?? "";
    var name = user?["name"]?.GetValue<string>() ?? login;
    var avatar = user?["avatar_url"]?.GetValue<string>() ?? "";

    // Mint our own short-lived identity token. The provider token is discarded.
    var now = DateTimeOffset.UtcNow;
    var claims = new JsonObject
    {
        ["iss"] = jwtIssuer,
        ["sub"] = $"{provider}:{id}",
        ["provider"] = provider,
        ["login"] = login,
        ["name"] = name,
        ["picture"] = avatar,
        ["iat"] = now.ToUnixTimeSeconds(),
        ["exp"] = now.AddMinutes(tokenTtlMinutes).ToUnixTimeSeconds(),
    };
    var jwt = MintHs256(claims, jwtSecret);

    var sep = finalRedirect.Contains('#', StringComparison.Ordinal) ? "&" : "#";
    return Results.Redirect($"{finalRedirect}{sep}token={Uri.EscapeDataString(jwt)}");
});

// Optional: lets the frontend (or any client) VERIFY a token instead of trusting
// the decoded payload. Send  Authorization: Bearer <token>.  CORS-enabled GET.
app.MapGet("/auth/me", (HttpContext ctx) =>
{
    ctx.Response.Headers.AccessControlAllowOrigin = "*";
    var auth = ctx.Request.Headers.Authorization.ToString();
    var token = auth.StartsWith("Bearer ", StringComparison.Ordinal) ? auth["Bearer ".Length..] : null;
    if (token is null || VerifyHs256(token, jwtSecret) is not { } payload)
        return Results.Unauthorized();
    return Results.Content(payload.ToJsonString(), "application/json");
});

// Allow the /auth/me preflight from browsers.
app.MapMethods("/auth/me", new[] { "OPTIONS" }, (HttpContext ctx) =>
{
    ctx.Response.Headers.AccessControlAllowOrigin = "*";
    ctx.Response.Headers.AccessControlAllowHeaders = "Authorization";
    ctx.Response.Headers.AccessControlAllowMethods = "GET, OPTIONS";
    return Results.NoContent();
});

app.Run();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

static string? ResolveRedirect(string? requested, string[] allowedOrigins)
{
    if (string.IsNullOrWhiteSpace(requested))
        return allowedOrigins.Length > 0 ? allowedOrigins[0] : null;
    if (!Uri.TryCreate(requested, UriKind.Absolute, out var uri))
        return null;
    var origin = $"{uri.Scheme}://{uri.Authority}";
    return allowedOrigins.Any(a => string.Equals(a.TrimEnd('/'), origin, StringComparison.OrdinalIgnoreCase))
        ? requested
        : null;
}

static string QueryHelpersAppend(string url, Dictionary<string, string> q)
{
    var sb = new StringBuilder(url);
    sb.Append(url.Contains('?', StringComparison.Ordinal) ? '&' : '?');
    var first = true;
    foreach (var (k, v) in q)
    {
        if (!first) sb.Append('&');
        sb.Append(Uri.EscapeDataString(k)).Append('=').Append(Uri.EscapeDataString(v));
        first = false;
    }
    return sb.ToString();
}

static string Base64Url(byte[] bytes) =>
    Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

static byte[] Base64UrlDecode(string s)
{
    s = s.Replace('-', '+').Replace('_', '/');
    return Convert.FromBase64String(s.PadRight(s.Length + (4 - s.Length % 4) % 4, '='));
}

static string MintHs256(JsonObject claims, byte[] secret)
{
    var header = Base64Url(Encoding.UTF8.GetBytes("""{"alg":"HS256","typ":"JWT"}"""));
    var payload = Base64Url(Encoding.UTF8.GetBytes(claims.ToJsonString()));
    var signingInput = $"{header}.{payload}";
    using var hmac = new HMACSHA256(secret);
    var sig = Base64Url(hmac.ComputeHash(Encoding.UTF8.GetBytes(signingInput)));
    return $"{signingInput}.{sig}";
}

static JsonObject? VerifyHs256(string token, byte[] secret)
{
    var parts = token.Split('.');
    if (parts.Length != 3) return null;
    using var hmac = new HMACSHA256(secret);
    var expected = Base64Url(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{parts[0]}.{parts[1]}")));
    if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(parts[2])))
        return null;
    if (JsonNode.Parse(Base64UrlDecode(parts[1])) is not JsonObject claims) return null;
    var exp = claims["exp"]?.GetValue<long>() ?? 0;
    if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() >= exp) return null;
    return claims;
}

internal sealed record ProviderConfig(
    string ClientId, string ClientSecret,
    string AuthorizeUrl, string TokenUrl, string UserInfoUrl, string Scope);
