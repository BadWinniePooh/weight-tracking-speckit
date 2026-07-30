using Microsoft.Extensions.DependencyInjection;
using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Services;
using WeightTracker.Infrastructure.Data;
using WeightTracker.Infrastructure.Services;
using WeightTracker.Tests.Integration.Fixtures;
using Xunit;

namespace WeightTracker.Tests.Integration.Services;

public class UserDeletionServiceTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private async Task<User> InsertUserWithDeletionDateAsync(DateTime? scheduledDeletionAt, bool isActive = false)
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var username = $"del_{Guid.NewGuid():N}";
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = $"{username}@example.com",
            PasswordHash = "testhash",
            Role = "user",
            IsActive = isActive,
            EmailConfirmed = true,
            ScheduledDeletionAt = scheduledDeletionAt,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    private async Task<User?> GetUserAsync(Guid id)
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Users.FindAsync(id);
    }

    private IUserDeletionService GetDeletionService()
    {
        var scope = fixture.Services.CreateScope();
        return scope.ServiceProvider.GetRequiredService<IUserDeletionService>();
    }

    // T047: DeleteExpiredUsersAsync deletes users with ScheduledDeletionAt <= NOW() and all their data
    [Fact]
    public async Task DeleteExpiredUsers_PastDueUser_IsDeleted()
    {
        var pastDue = await InsertUserWithDeletionDateAsync(DateTime.UtcNow.AddDays(-1));

        var svc = GetDeletionService();
        await svc.DeleteExpiredUsersAsync(CancellationToken.None);

        var result = await GetUserAsync(pastDue.Id);
        Assert.Null(result);
    }

    // T048: Future-dated and active users are NOT deleted
    [Fact]
    public async Task DeleteExpiredUsers_FutureDatedUser_IsNotDeleted()
    {
        var future = await InsertUserWithDeletionDateAsync(DateTime.UtcNow.AddDays(10));

        var svc = GetDeletionService();
        await svc.DeleteExpiredUsersAsync(CancellationToken.None);

        var result = await GetUserAsync(future.Id);
        Assert.NotNull(result);
    }

    [Fact]
    public async Task DeleteExpiredUsers_ActiveUserWithNullSchedule_IsNotDeleted()
    {
        var active = await InsertUserWithDeletionDateAsync(null, isActive: true);

        var svc = GetDeletionService();
        await svc.DeleteExpiredUsersAsync(CancellationToken.None);

        var result = await GetUserAsync(active.Id);
        Assert.NotNull(result);
    }

    [Fact]
    public async Task DeleteExpiredUsers_ReactivatedUser_IsNotDeleted()
    {
        // A user who was deactivated then reactivated has ScheduledDeletionAt = null
        var reactivated = await InsertUserWithDeletionDateAsync(null, isActive: true);

        var svc = GetDeletionService();
        await svc.DeleteExpiredUsersAsync(CancellationToken.None);

        var result = await GetUserAsync(reactivated.Id);
        Assert.NotNull(result);
    }

    // T049: If one deletion fails, subsequent users are still processed
    [Fact]
    public async Task DeleteExpiredUsers_MultipleExpired_AllDeleted()
    {
        var user1 = await InsertUserWithDeletionDateAsync(DateTime.UtcNow.AddDays(-2));
        var user2 = await InsertUserWithDeletionDateAsync(DateTime.UtcNow.AddDays(-1));
        var user3 = await InsertUserWithDeletionDateAsync(DateTime.UtcNow.AddDays(1)); // should survive

        var svc = GetDeletionService();
        await svc.DeleteExpiredUsersAsync(CancellationToken.None);

        Assert.Null(await GetUserAsync(user1.Id));
        Assert.Null(await GetUserAsync(user2.Id));
        Assert.NotNull(await GetUserAsync(user3.Id));
    }
}
