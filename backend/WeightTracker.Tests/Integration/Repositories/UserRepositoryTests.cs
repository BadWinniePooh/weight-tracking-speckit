using WeightTracker.Domain.Entities;
using WeightTracker.Infrastructure.Data;
using WeightTracker.Infrastructure.Repositories;
using WeightTracker.Tests.Integration.Fixtures;
using Xunit;

namespace WeightTracker.Tests.Integration.Repositories;

public class UserRepositoryTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    [Fact]
    public async Task GetByUsernameAsync_KnownUsername_ReturnsUser()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var repo = new UserRepository(db);

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = "testuser_known",
            Email = "known@example.com",
            PasswordHash = "hash",
            Role = "user",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var found = await repo.GetByUsernameAsync("testuser_known");

        Assert.NotNull(found);
        Assert.Equal(user.Id, found.Id);
    }

    [Fact]
    public async Task GetByUsernameAsync_UnknownUsername_ReturnsNull()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var repo = new UserRepository(db);

        var result = await repo.GetByUsernameAsync("nonexistent_xyz_12345");

        Assert.Null(result);
    }

    [Fact]
    public async Task GetByUsernameAsync_CaseInsensitive_ReturnsUser()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var repo = new UserRepository(db);

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = "CaseSensUser",
            Email = "case@example.com",
            PasswordHash = "hash",
            Role = "user",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var found = await repo.GetByUsernameAsync("casesensuser");

        Assert.NotNull(found);
        Assert.Equal(user.Id, found.Id);
    }

    [Fact]
    public async Task ExistsAnyAsync_EmptyDb_ReturnsFalse()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        // Clear all users
        db.Users.RemoveRange(db.Users);
        await db.SaveChangesAsync();
        var repo = new UserRepository(db);

        var result = await repo.ExistsAnyAsync();

        Assert.False(result);
    }

    [Fact]
    public async Task ExistsAnyAsync_AfterInsert_ReturnsTrue()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Users.RemoveRange(db.Users);
        await db.SaveChangesAsync();

        var repo = new UserRepository(db);
        db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Username = "existsuser",
            Email = "exists@example.com",
            PasswordHash = "hash",
            Role = "user",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var result = await repo.ExistsAnyAsync();

        Assert.True(result);
    }
}
