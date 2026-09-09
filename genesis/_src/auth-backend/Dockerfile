# Project Genesis OAuth broker — multi-stage build.
FROM mcr.microsoft.com/dotnet/sdk:8.0@sha256:5ef85cc12cb25be6ec319a7392d1e9efd53c3bc8abb971c53d8058a473f09053 AS build
WORKDIR /src
COPY GenesisAuth.csproj Directory.Build.props ./
RUN dotnet restore GenesisAuth.csproj
COPY . .
RUN dotnet publish GenesisAuth.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0@sha256:9a464e9a7e8c6144631020975f703c89034fe386417cb740620df69c2c6cfe24 AS runtime
WORKDIR /app
COPY --from=build /app ./
# Kestrel listens on 8080 inside the container; map it at your ingress.
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "GenesisAuth.dll"]
