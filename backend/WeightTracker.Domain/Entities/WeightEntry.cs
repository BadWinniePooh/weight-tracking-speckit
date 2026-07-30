namespace WeightTracker.Domain.Entities;

public class WeightEntry
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public decimal WeightValue { get; set; }
    public string Unit { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
}
