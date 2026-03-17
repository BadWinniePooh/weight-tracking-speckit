using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;

namespace WeightTracker.Api.Endpoints;

public static class ImportEndpoints
{
    private const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    public static void MapImportEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/import", async (
            HttpContext httpContext,
            IWeightEntryRepository entryRepository,
            IChartSettingsRepository settingsRepository) =>
        {
            // Validate file presence
            if (!httpContext.Request.HasFormContentType)
                return Results.BadRequest(new { error = "No file uploaded" });

            IFormCollection form;
            try { form = await httpContext.Request.ReadFormAsync(); }
            catch { return Results.BadRequest(new { error = "No file uploaded" }); }

            var file = form.Files.GetFile("file");
            if (file is null)
                return Results.BadRequest(new { error = "No file uploaded" });

            // Validate extension
            if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
                return Results.BadRequest(new { error = "File must be a CSV (.csv)" });

            // Validate file size — read into a buffer with a hard limit
            byte[] fileBytes;
            using (var ms = new MemoryStream())
            {
                await file.CopyToAsync(ms);
                if (ms.Length > MaxFileSizeBytes)
                    return Results.BadRequest(new { error = "File size exceeds 5 MB limit" });
                fileBytes = ms.ToArray();
            }

            var userId = (Guid)httpContext.Items["CurrentUserId"]!;

            // Parse lines from pre-read bytes
            var content = System.Text.Encoding.UTF8.GetString(fileBytes);
            var lines = content
                .Split('\n', StringSplitOptions.RemoveEmptyEntries)
                .Select(l => l.TrimEnd('\r').Trim())
                .Where(l => l.Length > 0)
                .ToList();

            if (lines.Count == 0)
                return Results.BadRequest(new { error = "File is empty or contains no data rows" });

            // Resolve preferred unit once (for rows without explicit unit)
            var settings = await settingsRepository.GetByUserAsync(userId);
            var preferredUnit = settings?.PreferredUnit ?? "kg";

            // Parse and validate rows
            var validEntries = new List<WeightEntry>();
            var errors = new List<ImportRowError>();
            int startRow = 1;

            for (int i = 0; i < lines.Count; i++)
            {
                int rowNumber = i + 1;
                var cols = lines[i].Split(',').Select(c => c.Trim()).ToArray();

                // Header detection: first row, second column is non-numeric → skip silently
                if (i == 0 && (cols.Length < 2 || !decimal.TryParse(cols[1], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out _)))
                {
                    startRow = 2;
                    continue;
                }

                // Validate date (col 0)
                if (cols.Length < 1 || string.IsNullOrWhiteSpace(cols[0]))
                {
                    errors.Add(new ImportRowError(rowNumber, "date is missing"));
                    continue;
                }

                if (!DateOnly.TryParseExact(cols[0], "yyyy-MM-dd", out var date))
                {
                    errors.Add(new ImportRowError(rowNumber, "date format is not recognized; expected YYYY-MM-DD"));
                    continue;
                }

                // Validate weight (col 1)
                if (cols.Length < 2 || string.IsNullOrWhiteSpace(cols[1]))
                {
                    errors.Add(new ImportRowError(rowNumber, "weight value is missing"));
                    continue;
                }

                if (!decimal.TryParse(cols[1], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var weight))
                {
                    errors.Add(new ImportRowError(rowNumber, "weight value is not a valid number"));
                    continue;
                }

                if (weight <= 0)
                {
                    errors.Add(new ImportRowError(rowNumber, "weight value must be greater than zero"));
                    continue;
                }

                // Resolve unit (col 2 optional, else preferred)
                string unit = preferredUnit;
                if (cols.Length >= 3 && !string.IsNullOrWhiteSpace(cols[2]))
                {
                    var rawUnit = cols[2].Trim().ToLowerInvariant();
                    if (rawUnit != "kg" && rawUnit != "lbs")
                    {
                        errors.Add(new ImportRowError(rowNumber, "unit must be 'kg' or 'lbs'"));
                        continue;
                    }
                    unit = rawUnit;
                }

                // Validate range
                if (unit == "kg" && weight > 635)
                {
                    errors.Add(new ImportRowError(rowNumber, $"weight value out of range for kg (max 635)"));
                    continue;
                }

                if (unit == "lbs" && weight > 1400)
                {
                    errors.Add(new ImportRowError(rowNumber, $"weight value out of range for lbs (max 1400)"));
                    continue;
                }

                validEntries.Add(new WeightEntry
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    WeightValue = weight,
                    Unit = unit,
                    Timestamp = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                    CreatedAt = DateTime.UtcNow
                });
            }

            int importedCount = 0;
            if (validEntries.Count > 0)
                importedCount = await entryRepository.AddRangeAsync(validEntries);

            return Results.Ok(new
            {
                importedCount,
                failedCount = errors.Count,
                errors
            });
        }).RequireAuthorization();
    }

    private record ImportRowError(int Row, string Reason);
}
