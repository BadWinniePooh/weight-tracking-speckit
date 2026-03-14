using Microsoft.EntityFrameworkCore;
using WeightTracker.Api;
using WeightTracker.Api.Endpoints;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Domain.Interfaces.Services;
using WeightTracker.Infrastructure.Data;
using WeightTracker.Api.Middleware;
using WeightTracker.Infrastructure.Repositories;
using WeightTracker.Infrastructure.Seeding;
using WeightTracker.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// Configuration
var dbHost = builder.Configuration["DB_HOST"]
    ?? throw new InvalidOperationException("Environment variable 'DB_HOST' not found.");
var dbPort = builder.Configuration["DB_PORT"]
    ?? throw new InvalidOperationException("Environment variable 'DB_PORT' not found.");
var dbName = builder.Configuration["DB_NAME"]
    ?? throw new InvalidOperationException("Environment variable 'DB_NAME' not found.");
var dbUser = builder.Configuration["DB_USER"]
    ?? throw new InvalidOperationException("Environment variable 'DB_USER' not found.");
var dbPassword = builder.Configuration["DB_PASSWORD"]
    ?? throw new InvalidOperationException("Environment variable 'DB_PASSWORD' not found.");
var connectionString = ConnectionStringBuilder.Build(dbHost, dbPort, dbName, dbUser, dbPassword);
var allowedOrigin = builder.Configuration["AllowedOrigin"]
    ?? throw new InvalidOperationException("AllowedOrigin configuration not found.");

// EF Core
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// Health checks
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>(name: "npgsql");

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigin)
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// Application services
builder.Services.AddScoped<ICurrentUserResolver, StubCurrentUserResolver>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IWeightEntryRepository, WeightEntryRepository>();
builder.Services.AddScoped<IChartSettingsRepository, ChartSettingsRepository>();
builder.Services.AddScoped<IChartCalculationService, ChartCalculationService>();
builder.Services.AddScoped<DatabaseSeeder>();

var app = builder.Build();

// Startup: migrate + seed with retry
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    for (int attempt = 1; attempt <= 30; attempt++)
    {
        try
        {
            await db.Database.MigrateAsync();
            var seeder = scope.ServiceProvider.GetRequiredService<DatabaseSeeder>();
            await seeder.SeedAsync();
            logger.LogInformation("Database migration and seeding completed.");
            break;
        }
        catch (Exception ex) when (attempt < 30)
        {
            logger.LogWarning("Database not ready (attempt {Attempt}/30): {Message}", attempt, ex.Message);
            await Task.Delay(1000);
        }
    }
}

app.UseCors();
app.UseMiddleware<CurrentUserMiddleware>();

app.MapHealthEndpoints();
app.MapEntryEndpoints();
app.MapSettingsEndpoints();
app.MapChartEndpoints();
app.MapMigrationEndpoints();

app.Run();

public partial class Program { }
