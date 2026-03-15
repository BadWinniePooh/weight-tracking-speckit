using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Testcontainers.PostgreSql;
using WeightTracker.Domain.Entities;
using WeightTracker.Infrastructure.Data;
using WeightTracker.Infrastructure.Repositories;

namespace WeightTracker.Tests.Integration.Fixtures;

public class ApiFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    private const string TestJwtSecret = "test-secret-key-must-be-at-least-32-characters-long!";
    public static readonly Guid TestUserId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("weighttracker_test")
        .WithUsername("test")
        .WithPassword("test")
        .Build();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
    }

    public new async Task DisposeAsync()
    {
        await _postgres.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Parse the Testcontainers connection string to extract individual components
        var connStr = _postgres.GetConnectionString();
        // Testcontainers returns: Host=localhost;Port=XXXXX;Database=weighttracker_test;Username=test;Password=test
        var parts = connStr.Split(';', StringSplitOptions.RemoveEmptyEntries)
            .Select(p => p.Split('=', 2))
            .Where(p => p.Length == 2)
            .ToDictionary(p => p[0].Trim(), p => p[1].Trim(), StringComparer.OrdinalIgnoreCase);

        builder.UseSetting("DB_HOST", parts.GetValueOrDefault("Host", "localhost"));
        builder.UseSetting("DB_PORT", parts.GetValueOrDefault("Port", "5432"));
        builder.UseSetting("DB_NAME", parts.GetValueOrDefault("Database", "weighttracker_test"));
        builder.UseSetting("DB_USER", parts.GetValueOrDefault("Username", "test"));
        builder.UseSetting("DB_PASSWORD", parts.GetValueOrDefault("Password", "test"));
        builder.UseSetting("AllowedOrigin", "http://localhost:3000");
        builder.UseSetting("JWT_SECRET", TestJwtSecret);
    }

    /// <summary>
    /// Creates an HttpClient with a valid Bearer token for the test user.
    /// The test user is seeded into the DB during app startup via the test DB context.
    /// </summary>
    public HttpClient CreateAuthenticatedClient()
    {
        EnsureTestUserExists();
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", GenerateTestJwt(TestUserId));
        return client;
    }

    /// <summary>Generates a signed JWT for the given userId using the test secret.</summary>
    public static string GenerateTestJwt(Guid userId)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestJwtSecret));
        var now = DateTime.UtcNow;
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };
        var token = new JwtSecurityToken(
            issuer: "weight-tracker",
            audience: "weight-tracker-api",
            claims: claims,
            notBefore: now,
            expires: now.AddHours(1),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private void EnsureTestUserExists()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        if (!db.Users.Any(u => u.Id == TestUserId))
        {
            db.Users.Add(new User
            {
                Id = TestUserId,
                Username = "testuser",
                Email = "testuser@example.com",
                PasswordHash = "testhash",
                Role = "user",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            db.SaveChanges();
        }

        if (!db.ChartSettings.Any(c => c.UserId == TestUserId))
        {
            db.ChartSettings.Add(new ChartSettings
            {
                Id = Guid.NewGuid(),
                UserId = TestUserId,
                PreferredUnit = "kg",
                WeightGoal = null,
                LossRate = 0.005500m,
                CarbFatRatio = 0.600000m,
                BufferValue = 0.007500m,
                UpdatedAt = DateTime.UtcNow
            });
            db.SaveChanges();
        }
    }
}
