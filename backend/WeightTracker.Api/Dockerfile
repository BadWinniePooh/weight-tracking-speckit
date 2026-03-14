FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src

# Copy solution and project files first for layer caching
COPY WeightTracker.sln ./
COPY WeightTracker.Domain/WeightTracker.Domain.csproj WeightTracker.Domain/
COPY WeightTracker.Infrastructure/WeightTracker.Infrastructure.csproj WeightTracker.Infrastructure/
COPY WeightTracker.Api/WeightTracker.Api.csproj WeightTracker.Api/
COPY WeightTracker.Tests/WeightTracker.Tests.csproj WeightTracker.Tests/

RUN dotnet restore WeightTracker.Api/WeightTracker.Api.csproj

COPY . .

RUN dotnet publish WeightTracker.Api/WeightTracker.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "WeightTracker.Api.dll"]
