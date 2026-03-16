namespace WeightTracker.Domain.Models;

public record AuditLogFilter(int Page, int PageSize, DateTime? FromDate, DateTime? ToDate, string? ActionType);

public record AuditLogEntryView(
    Guid Id,
    string ActionType,
    Guid ActorUserId,
    string ActorUsername,
    Guid? TargetUserId,
    string? TargetUsername,
    string IpAddress,
    DateTime Timestamp);

public record AuditLogPage(IReadOnlyList<AuditLogEntryView> Entries, int TotalCount);
