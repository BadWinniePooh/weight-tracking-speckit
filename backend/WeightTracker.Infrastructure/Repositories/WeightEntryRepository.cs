using Microsoft.EntityFrameworkCore;
using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Infrastructure.Data;

namespace WeightTracker.Infrastructure.Repositories;

public class WeightEntryRepository(AppDbContext db) : IWeightEntryRepository
{
    public async Task<List<WeightEntry>> GetAllAsync(Guid userId) =>
        await db.WeightEntries
            .Where(e => e.UserId == userId)
            .OrderByDescending(e => e.Timestamp)
            .ToListAsync();

    public async Task<(WeightEntry Entry, AddOutcome Outcome)> AddAsync(WeightEntry entry)
    {
        var existing = await db.WeightEntries.FindAsync(entry.Id);
        if (existing is not null)
        {
            // A foreign user's entry must never be echoed back to the caller.
            return existing.UserId == entry.UserId
                ? (existing, AddOutcome.AlreadyExists)
                : (entry, AddOutcome.IdConflict);
        }

        db.WeightEntries.Add(entry);
        await db.SaveChangesAsync();
        return (entry, AddOutcome.Inserted);
    }

    public async Task<int> AddRangeAsync(IEnumerable<WeightEntry> entries)
    {
        var list = entries.ToList();
        db.WeightEntries.AddRange(list);
        await db.SaveChangesAsync();
        return list.Count;
    }

    public async Task<bool> DeleteAsync(Guid id, Guid userId)
    {
        var entry = await db.WeightEntries
            .FirstOrDefaultAsync(e => e.Id == id && e.UserId == userId);

        if (entry is null)
            return false;

        db.WeightEntries.Remove(entry);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task DeleteAllAsync(Guid userId)
    {
        await db.WeightEntries
            .Where(e => e.UserId == userId)
            .ExecuteDeleteAsync();
    }
}
