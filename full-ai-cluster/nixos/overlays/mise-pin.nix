# Pin system mise to the same release as tools/setup/linux.sh (v2026.4.24).
# nixos-25.11 ships mise 2025.11.7, which cannot parse newer .mise.toml keys.
final: prev:
let
  version = "2026.4.24";
  sha256 = {
    x86_64-linux = "sha256-3i+SSUDCm4mDA1gz4vs6UAksV5RWLKDc0M+HtAyuLFg=";
    aarch64-linux = "sha256-z19ImcPxtWI50u7fFzxoxHt9uVQAxPobYelD3uSWVyc=";
  };
  arch = {
    x86_64-linux = "x64";
    aarch64-linux = "arm64";
  };
  system = prev.stdenv.hostPlatform.system;
in
{
  mise =
    if !(sha256 ? ${system}) then prev.mise else
    prev.stdenv.mkDerivation {
      pname = "mise";
      inherit version;
      src = prev.fetchurl {
        url = "https://github.com/jdx/mise/releases/download/v${version}/mise-v${version}-linux-${arch.${system}}.tar.gz";
        hash = sha256.${system};
      };
      sourceRoot = "mise";
      nativeBuildInputs = [ prev.autoPatchelfHook ];
      buildInputs = [ prev.stdenv.cc.cc.lib ];
      dontBuild = true;
      installPhase = ''
        runHook preInstall
        mkdir -p "$out/bin"
        install -m755 bin/mise "$out/bin/mise"
        runHook postInstall
      '';
      meta = (prev.mise.meta or { }) // {
        description = "mise pinned to tools/setup/linux.sh v${version}";
      };
    };
}
