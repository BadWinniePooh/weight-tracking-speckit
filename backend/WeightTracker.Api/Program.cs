using Microsoft.EntityFrameworkCore;
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
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
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
