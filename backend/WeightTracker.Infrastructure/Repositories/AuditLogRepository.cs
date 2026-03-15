using Microsoft.EntityFrameworkCore;
using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Domain.Models;
using WeightTracker.Infrastructure.Data;

namespace WeightTracker.Infrastructure.Repositories;

public class AuditLogRepository(AppDbContext db) : IAuditLogRepository
{
    public async Task AppendAsync(AuditLogEntry entry)
    {
        db.AuditLog.Add(entry);
        await db.SaveChangesAsync();
    }

    public async Task<AuditLogPage> QueryAsync(AuditLogFilter filter)
    {
        var query = db.AuditLog.AsQueryable();

        if (filter.FromDate.HasValue)
            query = query.Where(e => e.Timestamp >= filter.FromDate.Value);

        if (filter.ToDate.HasValue)
            query = query.Where(e => e.Timestamp <= filter.ToDate.Value);

        if (!string.IsNullOrEmpty(filter.ActionType))
            query = query.Where(e => e.ActionType == filter.ActionType);

        var totalCount = await query.CountAsync();

        var entries = await query
            .OrderByDescending(e => e.Timestamp)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        return new AuditLogPage(entries, totalCount);
    }
}
