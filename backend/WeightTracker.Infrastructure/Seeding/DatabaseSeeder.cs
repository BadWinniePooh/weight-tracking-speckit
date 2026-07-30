using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Domain.Interfaces.Services;
using WeightTracker.Infrastructure.Data;

namespace WeightTracker.Infrastructure.Seeding;

public class DatabaseSeeder(
    IUserRepository userRepository,
    IPasswordHasher passwordHasher,
    IConfiguration configuration,
    ILogger<DatabaseSeeder> logger)
{
    public async Task SeedAsync()
    {
        var adminUsername = configuration["ADMIN_USERNAME"];
        var adminEmail = configuration["ADMIN_EMAIL"];
        var adminPassword = configuration["ADMIN_PASSWORD"];

        var allSet = !string.IsNullOrEmpty(adminUsername)
                  && !string.IsNullOrEmpty(adminEmail)
                  && !string.IsNullOrEmpty(adminPassword);

        var someSet = !string.IsNullOrEmpty(adminUsername)
                   || !string.IsNullOrEmpty(adminEmail)
                   || !string.IsNullOrEmpty(adminPassword);

        if (someSet && !allSet)
        {
            logger.LogWarning(
                "Partial admin env vars detected (ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD). " +
                "All three must be set for auto-seeding. Skipping — first-run interactive setup required.");
            return;
        }

        if (allSet)
        {
            if (!await userRepository.ExistsAnyAsync())
            {
                var admin = new User
                {
                    Id = Guid.NewGuid(),
                    Username = adminUsername!,
                    Email = adminEmail!,
                    PasswordHash = passwordHasher.Hash(adminPassword!),
                    Role = "admin",
                    IsActive = true,
                    EmailConfirmed = true,
                    CreatedAt = DateTime.UtcNow
                };
                await userRepository.AddAsync(admin);
                logger.LogInformation("Admin user '{Username}' created via env-var seeding.", adminUsername);
            }
        }
    }
}
