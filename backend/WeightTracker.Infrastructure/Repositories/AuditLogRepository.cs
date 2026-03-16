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
        var baseQuery =
            from entry in db.AuditLog
            join actor in db.Users on entry.ActorUserId equals actor.Id
            join target in db.Users on entry.TargetUserId equals target.Id into tg
            from target in tg.DefaultIfEmpty()
            select new { entry, actorUsername = actor.Username, targetUsername = (string?)target.Username };

        if (filter.FromDate.HasValue)
            baseQuery = baseQuery.Where(x => x.entry.Timestamp >= filter.FromDate.Value);

        if (filter.ToDate.HasValue)
            baseQuery = baseQuery.Where(x => x.entry.Timestamp <= filter.ToDate.Value);

        if (!string.IsNullOrEmpty(filter.ActionType))
            baseQuery = baseQuery.Where(x => x.entry.ActionType == filter.ActionType);

        var totalCount = await baseQuery.CountAsync();

        var rows = await baseQuery
            .OrderByDescending(x => x.entry.Timestamp)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        var entries = rows.Select(x => new AuditLogEntryView(
            x.entry.Id,
            x.entry.ActionType,
            x.entry.ActorUserId,
            x.actorUsername,
            x.entry.TargetUserId,
            x.targetUsername,
            x.entry.IpAddress,
            x.entry.Timestamp)).ToList();

        return new AuditLogPage(entries, totalCount);
    }
}
