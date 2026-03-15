using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WeightTracker.Domain.Interfaces.Services;
using WeightTracker.Infrastructure.Data;

namespace WeightTracker.Infrastructure.Services;

public class UserDeletionService(AppDbContext db, ILogger<UserDeletionService> logger) : IUserDeletionService
{
    public async Task DeleteExpiredUsersAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var expiredUsers = await db.Users
            .Where(u => u.ScheduledDeletionAt != null && u.ScheduledDeletionAt <= now)
            .ToListAsync(cancellationToken);

        foreach (var user in expiredUsers)
        {
            // Process each user in a separate try/catch so failures don't block other deletions
            try
            {
                db.Users.Remove(user);
                await db.SaveChangesAsync(cancellationToken);
                logger.LogInformation("Deleted expired user {UserId} (scheduled: {ScheduledAt})",
                    user.Id, user.ScheduledDeletionAt);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to delete expired user {UserId}", user.Id);
                // Detach the failed entity to allow processing of subsequent users
                db.Entry(user).State = EntityState.Detached;
            }
        }
    }
}
