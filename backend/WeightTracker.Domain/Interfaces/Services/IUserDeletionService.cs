namespace WeightTracker.Domain.Interfaces.Services;

public interface IUserDeletionService
{
    Task DeleteExpiredUsersAsync(CancellationToken cancellationToken = default);
}
