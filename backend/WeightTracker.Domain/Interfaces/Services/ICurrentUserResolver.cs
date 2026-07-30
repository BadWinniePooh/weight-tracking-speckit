namespace WeightTracker.Domain.Interfaces.Services;

public interface ICurrentUserResolver
{
    Guid GetCurrentUserId();
}
