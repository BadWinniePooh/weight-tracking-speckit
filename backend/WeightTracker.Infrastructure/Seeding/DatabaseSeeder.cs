using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Infrastructure.Data;

namespace WeightTracker.Infrastructure.Seeding;

public class DatabaseSeeder(AppDbContext db)
{
    public static readonly Guid DefaultUserId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    public async Task SeedAsync()
    {
        var user = await db.Users.FindAsync(DefaultUserId);
        if (user is null)
        {
            db.Users.Add(new User
            {
                Id = DefaultUserId,
                DisplayName = "Default User",
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var hasSettings = db.ChartSettings.Any(c => c.UserId == DefaultUserId);
        if (!hasSettings)
        {
            db.ChartSettings.Add(new ChartSettings
            {
                Id = Guid.NewGuid(),
                UserId = DefaultUserId,
                PreferredUnit = "kg",
                WeightGoal = null,
                LossRate = 0.005500m,
                CarbFatRatio = 0.600000m,
                BufferValue = 0.007500m,
                UpdatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }
    }
}
