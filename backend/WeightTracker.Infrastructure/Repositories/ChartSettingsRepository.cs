using Microsoft.EntityFrameworkCore;
using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Infrastructure.Data;

namespace WeightTracker.Infrastructure.Repositories;

public class ChartSettingsRepository(AppDbContext db) : IChartSettingsRepository
{
    public async Task<ChartSettings?> GetByUserAsync(Guid userId) =>
        await db.ChartSettings
            .FirstOrDefaultAsync(s => s.UserId == userId);

    public async Task<ChartSettings> UpsertAsync(ChartSettings settings)
    {
        var existing = await db.ChartSettings
            .FirstOrDefaultAsync(s => s.UserId == settings.UserId);

        if (existing is null)
        {
            settings.Id = Guid.NewGuid();
            settings.UpdatedAt = DateTime.UtcNow;
            db.ChartSettings.Add(settings);
            await db.SaveChangesAsync();
            return settings;
        }

        existing.PreferredUnit = settings.PreferredUnit;
        existing.WeightGoal = settings.WeightGoal;
        existing.LossRate = settings.LossRate;
        existing.CarbFatRatio = settings.CarbFatRatio;
        existing.BufferValue = settings.BufferValue;
        existing.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return existing;
    }
}
