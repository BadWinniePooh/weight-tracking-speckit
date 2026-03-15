using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace WeightTracker.Infrastructure.Data;

/// <summary>Design-time factory used only by EF Core tooling (dotnet ef migrations).</summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Port=5432;Database=weighttracker_design;Username=postgres;Password=postgres")
            .Options;
        return new AppDbContext(options);
    }
}
