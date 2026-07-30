using WeightTracker.Domain.Entities;

namespace WeightTracker.Domain.Interfaces.Repositories;

public interface IWeightEntryRepository
{
    Task<List<WeightEntry>> GetAllAsync(Guid userId);
    Task<(WeightEntry Entry, bool WasInserted)> AddAsync(WeightEntry entry);
    Task<int> AddRangeAsync(IEnumerable<WeightEntry> entries);
    Task<bool> DeleteAsync(Guid id, Guid userId);
    Task DeleteAllAsync(Guid userId);
}
