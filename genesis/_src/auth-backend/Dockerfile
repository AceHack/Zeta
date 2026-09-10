# Project Genesis OAuth broker — multi-stage build.
FROM mcr.microsoft.com/dotnet/sdk:10.0-noble@sha256:4ea6fe75dd36706bb6d8c3c293d4c4315840f5d76ea28ac97def77e3ec487fa5 AS build
WORKDIR /src
COPY GenesisAuth.csproj Directory.Build.props ./
RUN dotnet restore GenesisAuth.csproj
COPY . .
RUN dotnet publish GenesisAuth.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble@sha256:1fe86375600b62e6566b465da9553eef0621f13c67f40fe764cd8dbb1dee1497 AS runtime
WORKDIR /app
COPY --from=build /app ./
# Kestrel listens on 8080 inside the container; map it at your ingress.
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "GenesisAuth.dll"]
