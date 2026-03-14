using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;

namespace WeightTracker.Api.Endpoints;

public static class SettingsEndpoints
{
    public static void MapSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/settings", async (HttpContext httpContext, IChartSettingsRepository settingsRepo) =>
        {
            var userId = (Guid)httpContext.Items["CurrentUserId"]!;
            var settings = await settingsRepo.GetByUserAsync(userId);
            if (settings is null)
                return Results.NotFound(new { error = "Settings not found" });

            return Results.Ok(new
            {
                preferredUnit = settings.PreferredUnit,
                weightGoal = settings.WeightGoal,
                lossRate = settings.LossRate,
                carbFatRatio = settings.CarbFatRatio,
                bufferValue = settings.BufferValue,
                updatedAt = settings.UpdatedAt.ToString("o"),
            });
        });

        app.MapPut("/api/settings", async (HttpContext httpContext, SettingsRequest request, IChartSettingsRepository settingsRepo) =>
        {
            if (request.PreferredUnit != "kg" && request.PreferredUnit != "lbs")
                return Results.BadRequest(new { error = "PreferredUnit must be 'kg' or 'lbs'", field = "preferredUnit" });

            if (request.LossRate <= 0)
                return Results.BadRequest(new { error = "LossRate must be greater than 0", field = "lossRate" });

            if (request.CarbFatRatio <= 0)
                return Results.BadRequest(new { error = "CarbFatRatio must be greater than 0", field = "carbFatRatio" });

            if (request.BufferValue <= 0)
                return Results.BadRequest(new { error = "BufferValue must be greater than 0", field = "bufferValue" });

            if (request.WeightGoal.HasValue && request.WeightGoal.Value <= 0)
                return Results.BadRequest(new { error = "WeightGoal must be greater than 0 when provided", field = "weightGoal" });

            var userId = (Guid)httpContext.Items["CurrentUserId"]!;
            var settings = new ChartSettings
            {
                UserId = userId,
                PreferredUnit = request.PreferredUnit,
                WeightGoal = request.WeightGoal,
                LossRate = request.LossRate,
                CarbFatRatio = request.CarbFatRatio,
                BufferValue = request.BufferValue,
                UpdatedAt = DateTime.UtcNow,
            };

            var saved = await settingsRepo.UpsertAsync(settings);

            return Results.Ok(new
            {
                preferredUnit = saved.PreferredUnit,
                weightGoal = saved.WeightGoal,
                lossRate = saved.LossRate,
                carbFatRatio = saved.CarbFatRatio,
                bufferValue = saved.BufferValue,
                updatedAt = saved.UpdatedAt.ToString("o"),
            });
        });
    }

    private record SettingsRequest(
        string PreferredUnit,
        decimal? WeightGoal,
        decimal LossRate,
        decimal CarbFatRatio,
        decimal BufferValue);
}
