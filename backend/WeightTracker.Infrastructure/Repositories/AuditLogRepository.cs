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
        var baseQuery = db.AuditLog.AsQueryable();

        if (filter.FromDate.HasValue)
            baseQuery = baseQuery.Where(e => e.Timestamp >= filter.FromDate.Value);

        if (filter.ToDate.HasValue)
        {
            // When only a date is provided (time = midnight), extend to end of day so the
            // entire calendar day is included (exclusive midnight → inclusive 23:59:59.999…)
            var toDate = filter.ToDate.Value;
            if (toDate.TimeOfDay == TimeSpan.Zero)
                toDate = toDate.Date.AddDays(1).AddTicks(-1);
            baseQuery = baseQuery.Where(e => e.Timestamp <= toDate);
        }

        if (!string.IsNullOrEmpty(filter.ActionType))
            baseQuery = baseQuery.Where(e => e.ActionType == filter.ActionType);

        var totalCount = await baseQuery.CountAsync();

        var rows = await baseQuery
            .OrderByDescending(e => e.Timestamp)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        var entries = rows.Select(e => new AuditLogEntryView(
            e.Id,
            e.ActionType,
            e.ActorUserId,
            e.ActorUsername,
            e.TargetUserId,
            e.TargetUsername,
            e.IpAddress,
            e.Timestamp)).ToList();

        return new AuditLogPage(entries, totalCount);
    }
}
