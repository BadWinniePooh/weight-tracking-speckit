using WeightTracker.Domain.Entities;

namespace WeightTracker.Domain.Interfaces.Repositories;

public enum AddOutcome
{
    /// <summary>The entry was newly inserted.</summary>
    Inserted,

    /// <summary>An entry with this id already exists and belongs to the same user;
    /// the existing entry is returned unchanged (idempotent replay).</summary>
    AlreadyExists,

    /// <summary>An entry with this id exists but belongs to a different user.
    /// The returned entry is the caller's rejected input — never the foreign entry.</summary>
    IdConflict,
}

public interface IWeightEntryRepository
{
    Task<List<WeightEntry>> GetAllAsync(Guid userId);
    Task<(WeightEntry Entry, AddOutcome Outcome)> AddAsync(WeightEntry entry);
    Task<int> AddRangeAsync(IEnumerable<WeightEntry> entries);
    Task<bool> DeleteAsync(Guid id, Guid userId);
    Task DeleteAllAsync(Guid userId);
}
