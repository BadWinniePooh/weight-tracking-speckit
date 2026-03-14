namespace WeightTracker.Domain.Entities;

public class ChartSettings
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string PreferredUnit { get; set; } = "kg";
    public decimal? WeightGoal { get; set; }
    public decimal LossRate { get; set; }
    public decimal CarbFatRatio { get; set; }
    public decimal BufferValue { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
}
