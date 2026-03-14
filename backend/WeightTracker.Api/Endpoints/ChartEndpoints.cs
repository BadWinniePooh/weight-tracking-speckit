using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Domain.Interfaces.Services;

namespace WeightTracker.Api.Endpoints;

public static class ChartEndpoints
{
    public static void MapChartEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/chart", async (HttpContext httpContext,
            IChartSettingsRepository settingsRepo,
            IChartCalculationService chartService) =>
        {
            var userId = (Guid)httpContext.Items["CurrentUserId"]!;
            var settings = await settingsRepo.GetByUserAsync(userId);
            var unit = settings?.PreferredUnit ?? "kg";
            var chartData = await chartService.ComputeChartDataAsync(userId, unit);
            return Results.Ok(chartData);
        });
    }
}
