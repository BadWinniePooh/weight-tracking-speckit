using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;

namespace WeightTracker.Api.Endpoints;

public static class EntryEndpoints
{
    public static void MapEntryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/entries").RequireAuthorization();

        group.MapGet("", async (HttpContext httpContext, IWeightEntryRepository repository) =>
        {
            var userId = (Guid)httpContext.Items["CurrentUserId"]!;
            var entries = await repository.GetAllAsync(userId);
            return Results.Ok(new
            {
                entries = entries.Select(e => new
                {
                    id = e.Id,
                    weightValue = e.WeightValue,
                    unit = e.Unit,
                    timestamp = e.Timestamp.ToString("o")
                })
            });
        });

        group.MapPost("", async (HttpContext httpContext, EntryRequest request, IWeightEntryRepository repository) =>
        {
            if (request.Unit != "kg" && request.Unit != "lbs")
                return Results.BadRequest(new { error = "Unit must be 'kg' or 'lbs'", field = "unit" });

            if (request.Unit == "kg" && (request.WeightValue <= 0 || request.WeightValue > 635))
                return Results.BadRequest(new { error = "Weight must be between 0 and 635 kg", field = "weightValue" });

            if (request.Unit == "lbs" && (request.WeightValue <= 0 || request.WeightValue > 1400))
                return Results.BadRequest(new { error = "Weight must be between 0 and 1400 lbs", field = "weightValue" });

            var userId = (Guid)httpContext.Items["CurrentUserId"]!;
            var entry = new WeightEntry
            {
                Id = request.Id ?? Guid.NewGuid(),
                UserId = userId,
                WeightValue = request.WeightValue,
                Unit = request.Unit,
                Timestamp = request.Timestamp,
                CreatedAt = DateTime.UtcNow
            };

            var (saved, _) = await repository.AddAsync(entry);

            return Results.Created($"/api/entries/{saved.Id}", new
            {
                id = saved.Id,
                weightValue = saved.WeightValue,
                unit = saved.Unit,
                timestamp = saved.Timestamp.ToString("o")
            });
        });

        group.MapDelete("{id:guid}", async (Guid id, HttpContext httpContext, IWeightEntryRepository repository) =>
        {
            var userId = (Guid)httpContext.Items["CurrentUserId"]!;
            var deleted = await repository.DeleteAsync(id, userId);
            return deleted
                ? Results.NoContent()
                : Results.NotFound(new { error = "Entry not found" });
        });

        group.MapDelete("", async (HttpContext httpContext, IWeightEntryRepository repository) =>
        {
            var userId = (Guid)httpContext.Items["CurrentUserId"]!;
            await repository.DeleteAllAsync(userId);
            return Results.NoContent();
        });
    }

    private record EntryRequest(Guid? Id, decimal WeightValue, string Unit, DateTime Timestamp);
}
