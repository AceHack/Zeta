# Zeta Orleans silo. Multi-stage: SDK builds, runtime ships.
#
# The build context is THIS directory only -- the repo root's Directory.Build.props
# is deliberately not in scope, and full-ai-cluster/orleans-silo/Directory.Build.props
# stops inheritance so the local build and the image build are the same build.
FROM mcr.microsoft.com/dotnet/sdk:10.0-noble@sha256:4ea6fe75dd36706bb6d8c3c293d4c4315840f5d76ea28ac97def77e3ec487fa5 AS build
WORKDIR /src

# Restore first so the layer caches on the project file alone.
COPY Directory.Build.props Directory.Packages.props Zeta.Orleans.Silo.csproj ./
RUN dotnet restore Zeta.Orleans.Silo.csproj

COPY . .
RUN dotnet publish Zeta.Orleans.Silo.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/runtime:10.0-noble@sha256:399e54a8a7e35c3aba78398b2840455d45185cba20b831b8a2b46f849f4f5001 AS runtime
WORKDIR /app
COPY --from=build /app .

# Non-root. The runtime image ships the `app` user (uid 1654).
USER app

#  11111 silo-to-silo   30000 client gateway   8080 dashboard
EXPOSE 11111 30000 8080

ENTRYPOINT ["dotnet", "Zeta.Orleans.Silo.dll"]
