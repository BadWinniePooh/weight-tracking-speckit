using WeightTracker.Domain.Interfaces.Services;

namespace WeightTracker.Infrastructure.Services;

public class StubCurrentUserResolver : ICurrentUserResolver
{
    public Guid GetCurrentUserId() =>
        Guid.Parse("00000000-0000-0000-0000-000000000001");
}
