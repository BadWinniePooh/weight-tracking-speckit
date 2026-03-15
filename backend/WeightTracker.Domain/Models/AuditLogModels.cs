using WeightTracker.Domain.Entities;

namespace WeightTracker.Domain.Models;

public record AuditLogFilter(int Page, int PageSize, DateTime? FromDate, DateTime? ToDate, string? ActionType);

public record AuditLogPage(IReadOnlyList<AuditLogEntry> Entries, int TotalCount);
