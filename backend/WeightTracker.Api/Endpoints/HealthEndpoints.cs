using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace WeightTracker.Api.Endpoints;

public static class HealthEndpoints
{
    public static void MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health", async (HealthCheckService healthCheckService) =>
        {
            var report = await healthCheckService.CheckHealthAsync();
            var dbStatus = report.Entries.TryGetValue("npgsql", out var entry)
                ? entry.Status.ToString()
                : report.Status.ToString();

            var result = new
            {
                status = report.Status.ToString(),
                checks = new { database = dbStatus }
            };

            return report.Status == HealthStatus.Healthy
                ? Results.Ok(result)
                : Results.Json(result, statusCode: 503);
        });
    }
}
