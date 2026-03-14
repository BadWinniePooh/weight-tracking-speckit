using WeightTracker.Domain.Entities;

namespace WeightTracker.Domain.Interfaces.Repositories;

public interface IChartSettingsRepository
{
    Task<ChartSettings?> GetByUserAsync(Guid userId);
    Task<ChartSettings> UpsertAsync(ChartSettings settings);
}
