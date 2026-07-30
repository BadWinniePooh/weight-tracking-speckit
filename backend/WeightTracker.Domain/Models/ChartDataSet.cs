namespace WeightTracker.Domain.Models;

public class ChartDataSet
{
    public string CorridorState { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public List<ChartPoint> DataPoints { get; set; } = new();
    public List<ChartPoint>? Trendline { get; set; }
    public List<ChartPoint>? Floor { get; set; }
    public List<ChartPoint>? Ceiling { get; set; }
    public List<ChartPoint>? Ideal { get; set; }
}
