using WeightTracker.Domain.Entities;
using WeightTracker.Infrastructure.Data;
using WeightTracker.Infrastructure.Repositories;
using WeightTracker.Tests.Integration.Fixtures;
using Xunit;

namespace WeightTracker.Tests.Integration.Repositories;

public class RefreshTokenRepositoryTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private static User MakeUser() => new()
    {
        Id = Guid.NewGuid(),
        Username = $"user_{Guid.NewGuid():N}",
        Email = $"{Guid.NewGuid():N}@example.com",
        PasswordHash = "hash",
        Role = "user",
        IsActive = true,
        CreatedAt = DateTime.UtcNow
    };

    [Fact]
    public async Task GetActiveByHashAsync_ActiveToken_ReturnsToken()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = MakeUser();
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var repo = new RefreshTokenRepository(db);
        var token = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = $"activehash_{Guid.NewGuid():N}",
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow
        };
        db.RefreshTokens.Add(token);
        await db.SaveChangesAsync();

        var found = await repo.GetActiveByHashAsync(token.TokenHash);

        Assert.NotNull(found);
        Assert.Equal(token.Id, found.Id);
    }

    [Fact]
    public async Task GetActiveByHashAsync_RevokedToken_ReturnsNull()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = MakeUser();
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var repo = new RefreshTokenRepository(db);
        var token = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = $"revokedhash_{Guid.NewGuid():N}",
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            RevokedAt = DateTime.UtcNow.AddHours(-1),
            CreatedAt = DateTime.UtcNow
        };
        db.RefreshTokens.Add(token);
        await db.SaveChangesAsync();

        var found = await repo.GetActiveByHashAsync(token.TokenHash);

        Assert.Null(found);
    }

    [Fact]
    public async Task GetActiveByHashAsync_ExpiredToken_ReturnsNull()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = MakeUser();
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var repo = new RefreshTokenRepository(db);
        var token = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = $"expiredhash_{Guid.NewGuid():N}",
            ExpiresAt = DateTime.UtcNow.AddDays(-1),
            CreatedAt = DateTime.UtcNow
        };
        db.RefreshTokens.Add(token);
        await db.SaveChangesAsync();

        var found = await repo.GetActiveByHashAsync(token.TokenHash);

        Assert.Null(found);
    }

    [Fact]
    public async Task GetActiveByHashAsync_UnknownHash_ReturnsNull()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var repo = new RefreshTokenRepository(db);

        var found = await repo.GetActiveByHashAsync("nonexistent_hash_xyz");

        Assert.Null(found);
    }

    [Fact]
    public async Task RevokeAsync_SetsRevokedAt()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = MakeUser();
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var repo = new RefreshTokenRepository(db);
        var token = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = $"revokehash_{Guid.NewGuid():N}",
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow
        };
        db.RefreshTokens.Add(token);
        await db.SaveChangesAsync();

        await repo.RevokeAsync(token.Id);

        var revoked = await db.RefreshTokens.FindAsync(token.Id);
        Assert.NotNull(revoked?.RevokedAt);
    }

    [Fact]
    public async Task RevokeAllForUserAsync_RevokesAllUserTokens()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = MakeUser();
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var repo = new RefreshTokenRepository(db);
        var token1 = new RefreshToken
        {
            Id = Guid.NewGuid(), UserId = user.Id,
            TokenHash = $"h1_{Guid.NewGuid():N}",
            ExpiresAt = DateTime.UtcNow.AddDays(7), CreatedAt = DateTime.UtcNow
        };
        var token2 = new RefreshToken
        {
            Id = Guid.NewGuid(), UserId = user.Id,
            TokenHash = $"h2_{Guid.NewGuid():N}",
            ExpiresAt = DateTime.UtcNow.AddDays(7), CreatedAt = DateTime.UtcNow
        };
        db.RefreshTokens.AddRange(token1, token2);
        await db.SaveChangesAsync();

        await repo.RevokeAllForUserAsync(user.Id);

        var tokens = db.RefreshTokens.Where(t => t.UserId == user.Id).ToList();
        Assert.All(tokens, t => Assert.NotNull(t.RevokedAt));
    }
}
