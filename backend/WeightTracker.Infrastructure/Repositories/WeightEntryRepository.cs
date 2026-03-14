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

    public async Task<(WeightEntry Entry, bool WasInserted)> AddAsync(WeightEntry entry)
    {
        var existing = await db.WeightEntries.FindAsync(entry.Id);
        if (existing is not null)
            return (existing, false);

        db.WeightEntries.Add(entry);
        await db.SaveChangesAsync();
        return (entry, true);
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
