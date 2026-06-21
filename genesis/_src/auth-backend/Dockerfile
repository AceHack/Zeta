# Project Genesis OAuth broker — multi-stage build.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY GenesisAuth.csproj Directory.Build.props ./
RUN dotnet restore GenesisAuth.csproj
COPY . .
RUN dotnet publish GenesisAuth.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app ./
# Kestrel listens on 8080 inside the container; map it at your ingress.
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "GenesisAuth.dll"]
