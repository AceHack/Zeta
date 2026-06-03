namespace Zeta.Core.CSharp.AceCanonical;

/// <summary>
/// Thrown when a <see cref="System.Text.Json.JsonElement"/> is not valid Ace canonical
/// content (float / unsafe-int / lone-surrogate / unsupported shape).
/// </summary>
public sealed class AceCanonicalException(string message) : System.Exception(message) { }
