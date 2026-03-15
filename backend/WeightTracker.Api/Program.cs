using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
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
    ?? builder.Configuration["ALLOWED_ORIGIN"]
    ?? throw new InvalidOperationException("AllowedOrigin / ALLOWED_ORIGIN configuration not found.");

var jwtSecret = builder.Configuration["JWT_SECRET"]
    ?? throw new InvalidOperationException("Environment variable 'JWT_SECRET' not found.");

// EF Core
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// Health checks
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>(name: "npgsql");

// JWT Authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = "weight-tracker",
            ValidateAudience = true,
            ValidAudience = "weight-tracker-api",
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization(options =>
{
    // "role" claim is the JWT claim name; after inbound mapping, ASP.NET uses ClaimTypes.Role
    options.AddPolicy("AdminOnly", p => p.RequireClaim(System.Security.Claims.ClaimTypes.Role, "admin"));
});

// CORS — must use explicit origin when AllowCredentials is required
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigin)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// Application services
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();
builder.Services.AddScoped<IPasswordHasher, BcryptPasswordHasher>();
builder.Services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddScoped<ICurrentUserResolver, JwtCurrentUserResolver>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IPasswordResetTokenRepository, PasswordResetTokenRepository>();
builder.Services.AddScoped<IPasswordResetService, PasswordResetService>();
builder.Services.AddScoped<IEmailConfirmationTokenRepository, EmailConfirmationTokenRepository>();
builder.Services.AddScoped<IEmailConfirmationService, EmailConfirmationService>();
builder.Services.AddScoped<IAuditLogRepository, AuditLogRepository>();
builder.Services.AddScoped<IUserManagementService, UserManagementService>();
builder.Services.AddScoped<IUserDeletionService, UserDeletionService>();
builder.Services.AddHostedService<UserDeletionHostedService>();
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
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<CurrentUserMiddleware>();

app.MapHealthEndpoints();
app.MapSetupEndpoints();
app.MapAuthEndpoints();
app.MapEntryEndpoints();
app.MapSettingsEndpoints();
app.MapChartEndpoints();
app.MapMigrationEndpoints();
app.MapAdminEndpoints();
app.MapAccountEndpoints();

app.Run();

public partial class Program { }
