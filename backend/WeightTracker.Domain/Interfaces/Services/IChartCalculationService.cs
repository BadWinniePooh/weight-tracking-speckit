using WeightTracker.Domain.Models;

namespace WeightTracker.Domain.Interfaces.Services;

public interface IChartCalculationService
{
    Task<ChartDataSet> ComputeChartDataAsync(Guid userId, string unit);
}
