namespace WeightTracker.Domain.Models;

public class DailyAverage
{
    public string Date { get; set; } = string.Empty;
    public int DayIndex { get; set; }
    public decimal AvgWeight { get; set; }
    public DailyAverageOrigin Origin { get; set; }
}

public enum DailyAverageOrigin
{
    Measured,
    Interpolated
}
