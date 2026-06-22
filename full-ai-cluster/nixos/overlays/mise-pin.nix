# Pin system mise to the same release as tools/setup/linux.sh (v2026.6.12).
# nixos-25.11 ships mise 2025.11.7, which cannot parse newer .mise.toml keys.
final: prev:
let
  version = "2026.6.12";
  sha256 = {
    x86_64-linux = "sha256-zJtbyWumFtiNDuUVGWvsaHGjPWTOx3SST7+qJxepIf0=";
    aarch64-linux = "sha256-bO90Ag+YsGpi1vklwRYjW2KbS62xl7IKMyF7/5bWDw8=";
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
