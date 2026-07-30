using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using WeightTracker.Infrastructure.Data;
using WeightTracker.Infrastructure.Repositories;
using WeightTracker.Infrastructure.Seeding;
using WeightTracker.Infrastructure.Services;
using WeightTracker.Tests.Integration.Fixtures;
using Xunit;

namespace WeightTracker.Tests.Integration.Seeding;

public class DatabaseSeederTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private static DatabaseSeeder CreateSeeder(
        AppDbContext db,
        string? adminUsername = null,
        string? adminEmail = null,
        string? adminPassword = null)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ADMIN_USERNAME"] = adminUsername,
                ["ADMIN_EMAIL"] = adminEmail,
                ["ADMIN_PASSWORD"] = adminPassword
            })
            .Build();

        var userRepo = new UserRepository(db);
        var hasher = new BcryptPasswordHasher();
        var logger = Microsoft.Extensions.Logging.Abstractions.NullLogger<DatabaseSeeder>.Instance;
        return new DatabaseSeeder(userRepo, hasher, config, logger);
    }

    [Fact]
    public async Task Seed_AllEnvVarsSet_EmptyDb_CreatesAdminUser()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.RefreshTokens.RemoveRange(db.RefreshTokens);
        db.ChartSettings.RemoveRange(db.ChartSettings);
        db.WeightEntries.RemoveRange(db.WeightEntries);
        db.Users.RemoveRange(db.Users);
        await db.SaveChangesAsync();

        var seeder = CreateSeeder(db, "seedadmin", "seedadmin@example.com", "password123");
        await seeder.SeedAsync();

        Assert.True(await db.Users.AnyAsync());
        var user = db.Users.First();
        Assert.Equal("seedadmin", user.Username);
        Assert.Equal("admin", user.Role);
    }

    [Fact]
    public async Task Seed_NoEnvVarsSet_CreatesNoUser()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.RefreshTokens.RemoveRange(db.RefreshTokens);
        db.ChartSettings.RemoveRange(db.ChartSettings);
        db.WeightEntries.RemoveRange(db.WeightEntries);
        db.Users.RemoveRange(db.Users);
        await db.SaveChangesAsync();

        var seeder = CreateSeeder(db);
        await seeder.SeedAsync();

        Assert.False(await db.Users.AnyAsync());
    }

    [Fact]
    public async Task Seed_AllEnvVarsSet_UserAlreadyExists_NoDuplicate()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.RefreshTokens.RemoveRange(db.RefreshTokens);
        db.ChartSettings.RemoveRange(db.ChartSettings);
        db.WeightEntries.RemoveRange(db.WeightEntries);
        db.Users.RemoveRange(db.Users);
        await db.SaveChangesAsync();

        var seeder = CreateSeeder(db, "existing", "existing@example.com", "password123");
        await seeder.SeedAsync(); // first seed

        var countBefore = db.Users.Count();
        await seeder.SeedAsync(); // second seed should be no-op

        Assert.Equal(countBefore, db.Users.Count());
    }

    [Fact]
    public async Task Seed_PartialEnvVars_SkipsSeedingWithoutCrash()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.RefreshTokens.RemoveRange(db.RefreshTokens);
        db.ChartSettings.RemoveRange(db.ChartSettings);
        db.WeightEntries.RemoveRange(db.WeightEntries);
        db.Users.RemoveRange(db.Users);
        await db.SaveChangesAsync();

        // Only username set, not password or email
        var seeder = CreateSeeder(db, adminUsername: "partialuser");
        await seeder.SeedAsync(); // should not throw and should not create user

        Assert.False(await db.Users.AnyAsync());
    }

    [Fact]
    public async Task Seed_AllEnvVarsSet_AdminHasEmailConfirmedTrue()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.RefreshTokens.RemoveRange(db.RefreshTokens);
        db.ChartSettings.RemoveRange(db.ChartSettings);
        db.WeightEntries.RemoveRange(db.WeightEntries);
        db.Users.RemoveRange(db.Users);
        await db.SaveChangesAsync();

        var seeder = CreateSeeder(db, "seedadmin2", "seedadmin2@example.com", "password123");
        await seeder.SeedAsync();

        var user = db.Users.Single(u => u.Username == "seedadmin2");
        Assert.True(user.EmailConfirmed, "Env-var seeded admin must have EmailConfirmed = true");
    }
}
