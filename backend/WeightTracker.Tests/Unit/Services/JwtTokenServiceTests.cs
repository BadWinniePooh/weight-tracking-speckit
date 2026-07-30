using Microsoft.Extensions.Configuration;
using WeightTracker.Domain.Entities;
using WeightTracker.Infrastructure.Repositories;
using WeightTracker.Infrastructure.Services;
using WeightTracker.Tests.Integration.Fixtures;
using Xunit;

namespace WeightTracker.Tests.Unit.Services;

public class JwtTokenServiceTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private static IConfiguration MakeConfig() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JWT_SECRET"] = "test-secret-key-must-be-at-least-32-characters-long!"
            })
            .Build();

    private static User MakeUser() => new()
    {
        Id = Guid.NewGuid(),
        Username = $"svctest_{Guid.NewGuid():N}",
        Email = $"{Guid.NewGuid():N}@example.com",
        Role = "user",
        IsActive = true,
        CreatedAt = DateTime.UtcNow
    };

    private async Task<(JwtTokenService svc, User user, WeightTracker.Infrastructure.Data.AppDbContext db)>
        SetupAsync()
    {
        var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WeightTracker.Infrastructure.Data.AppDbContext>();
        var user = MakeUser();
        db.Users.Add(user);
        await db.SaveChangesAsync();
        var repo = new RefreshTokenRepository(db);
        var svc = new JwtTokenService(repo, MakeConfig());
        return (svc, user, db);
    }

    [Fact]
    public async Task GenerateTokensAsync_ReturnsNonEmptyTokens()
    {
        var (svc, user, _) = await SetupAsync();

        var (accessToken, refreshToken) = await svc.GenerateTokensAsync(user);

        Assert.NotEmpty(accessToken);
        Assert.NotEmpty(refreshToken);
    }

    [Fact]
    public async Task GenerateTokensAsync_AccessToken_IsValidJwt()
    {
        var (svc, user, _) = await SetupAsync();

        var (accessToken, _) = await svc.GenerateTokensAsync(user);

        // JWT has 3 parts separated by dots
        var parts = accessToken.Split('.');
        Assert.Equal(3, parts.Length);
    }

    [Fact]
    public async Task RenewAccessTokenAsync_ValidRefreshToken_ReturnsNewJwt()
    {
        var (svc, user, _) = await SetupAsync();

        var (_, refreshToken) = await svc.GenerateTokensAsync(user);
        var newAccessToken = await svc.RenewAccessTokenAsync(user.Id, refreshToken);

        Assert.NotNull(newAccessToken);
        Assert.NotEmpty(newAccessToken!);
    }

    [Fact]
    public async Task RenewAccessTokenAsync_InvalidRefreshToken_ReturnsNull()
    {
        var (svc, user, _) = await SetupAsync();

        var result = await svc.RenewAccessTokenAsync(user.Id, "invalid-token");

        Assert.Null(result);
    }

    [Fact]
    public async Task InvalidateAllTokensAsync_MakesSubsequentRenewReturnNull()
    {
        var (svc, user, _) = await SetupAsync();

        var (_, refreshToken) = await svc.GenerateTokensAsync(user);
        await svc.InvalidateAllTokensAsync(user.Id);

        var result = await svc.RenewAccessTokenAsync(user.Id, refreshToken);
        Assert.Null(result);
    }
}
