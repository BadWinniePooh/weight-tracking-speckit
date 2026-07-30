namespace WeightTracker.Domain.Entities;

public class AuditLogEntry
{
    public Guid Id { get; set; }
    public string ActionType { get; set; } = string.Empty;
    public Guid ActorUserId { get; set; }
    public string ActorUsername { get; set; } = string.Empty;
    public Guid? TargetUserId { get; set; }
    public string? TargetUsername { get; set; }
    public string IpAddress { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}
