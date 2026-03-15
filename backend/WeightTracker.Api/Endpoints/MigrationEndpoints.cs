using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;

namespace WeightTracker.Api.Endpoints;

public static class MigrationEndpoints
{
    public static void MapMigrationEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/migrate", async (
            HttpContext httpContext,
            MigrateRequest? request,
            IWeightEntryRepository entryRepository,
            IChartSettingsRepository settingsRepository) =>
        {
            if (request?.Entries is null)
                return Results.BadRequest(new { error = "entries field is required" });

            var userId = (Guid)httpContext.Items["CurrentUserId"]!;

            int migratedEntries = 0;
            int skippedEntries = 0;
            var skippedReasons = new List<string>();

            foreach (var entry in request.Entries)
            {
                // Validate unit
                if (entry.Unit != "kg" && entry.Unit != "lbs")
                {
                    skippedReasons.Add($"Entry {entry.Id}: invalid unit '{entry.Unit}'");
                    skippedEntries++;
                    continue;
                }

                // Validate weight range
                if (entry.Unit == "kg" && (entry.WeightValue <= 0 || entry.WeightValue > 635))
                {
                    skippedReasons.Add($"Entry {entry.Id}: weight {entry.WeightValue} kg is out of range (0–635 kg)");
                    skippedEntries++;
                    continue;
                }

                if (entry.Unit == "lbs" && (entry.WeightValue <= 0 || entry.WeightValue > 1400))
                {
                    skippedReasons.Add($"Entry {entry.Id}: weight {entry.WeightValue} lbs is out of range (0–1400 lbs)");
                    skippedEntries++;
                    continue;
                }

                // Parse timestamp
                if (!DateTime.TryParse(entry.Timestamp, null, System.Globalization.DateTimeStyles.RoundtripKind, out var parsedTimestamp))
                {
                    skippedReasons.Add($"Entry {entry.Id}: invalid timestamp '{entry.Timestamp}'");
                    skippedEntries++;
                    continue;
                }

                var weightEntry = new WeightEntry
                {
                    Id = entry.Id ?? Guid.NewGuid(),
                    UserId = userId,
                    WeightValue = entry.WeightValue,
                    Unit = entry.Unit,
                    Timestamp = parsedTimestamp,
                    CreatedAt = DateTime.UtcNow
                };

                var (_, wasInserted) = await entryRepository.AddAsync(weightEntry);
                if (wasInserted)
                    migratedEntries++;
                else
                    skippedEntries++;
            }

            bool settingsMigrated = false;
            if (request.Settings is not null)
            {
                var settings = new ChartSettings
                {
                    UserId = userId,
                    PreferredUnit = request.Settings.PreferredUnit,
                    WeightGoal = request.Settings.WeightGoal,
                    LossRate = request.Settings.LossRate,
                    CarbFatRatio = request.Settings.CarbFatRatio,
                    BufferValue = request.Settings.BufferValue,
                };
                await settingsRepository.UpsertAsync(settings);
                settingsMigrated = true;
            }

            return Results.Ok(new
            {
                migratedEntries,
                skippedEntries,
                settingsMigrated,
                skippedReasons
            });
        }).RequireAuthorization();
    }

    private record MigrateRequest(
        List<MigrateEntry>? Entries,
        MigrateSettingsPayload? Settings);

    private record MigrateEntry(Guid? Id, decimal WeightValue, string Unit, string Timestamp);

    private record MigrateSettingsPayload(
        string PreferredUnit,
        decimal? WeightGoal,
        decimal LossRate,
        decimal CarbFatRatio,
        decimal BufferValue);
}
