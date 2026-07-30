namespace WeightTracker.Domain.Entities;

public class EmailConfirmationToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string TargetEmail { get; set; } = string.Empty;
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public User User { get; set; } = null!;
}
