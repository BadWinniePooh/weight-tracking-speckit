using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;
using WeightTracker.Infrastructure.Data;

namespace WeightTracker.Tests.Integration.Fixtures;

public class ApiFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
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
    }
}
