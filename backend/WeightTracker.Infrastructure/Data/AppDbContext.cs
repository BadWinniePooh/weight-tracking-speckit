using Microsoft.EntityFrameworkCore;
using WeightTracker.Domain.Entities;

namespace WeightTracker.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<WeightEntry> WeightEntries => Set<WeightEntry>();
    public DbSet<ChartSettings> ChartSettings => Set<ChartSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("Users");
            e.HasKey(u => u.Id);
            e.Property(u => u.DisplayName).HasMaxLength(100).IsRequired();
            e.Property(u => u.CreatedAt).IsRequired();
        });

        modelBuilder.Entity<WeightEntry>(e =>
        {
            e.ToTable("WeightEntries", t => t.HasCheckConstraint("CK_WeightEntries_Unit", "\"Unit\" IN ('kg','lbs')"));
            e.HasKey(w => w.Id);
            e.Property(w => w.WeightValue).HasColumnType("decimal(10,4)").IsRequired();
            e.Property(w => w.Unit).HasMaxLength(3).IsRequired();
            e.Property(w => w.Timestamp).IsRequired();
            e.Property(w => w.CreatedAt).IsRequired();
            e.HasOne(w => w.User).WithMany().HasForeignKey(w => w.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(w => new { w.UserId, w.Timestamp }).IsDescending(false, true);
        });

        modelBuilder.Entity<ChartSettings>(e =>
        {
            e.ToTable("ChartSettings", t => t.HasCheckConstraint("CK_ChartSettings_PreferredUnit", "\"PreferredUnit\" IN ('kg','lbs')"));
            e.HasKey(c => c.Id);
            e.Property(c => c.PreferredUnit).HasMaxLength(3).IsRequired();
            e.Property(c => c.WeightGoal).HasColumnType("decimal(10,4)");
            e.Property(c => c.LossRate).HasColumnType("decimal(10,6)").IsRequired();
            e.Property(c => c.CarbFatRatio).HasColumnType("decimal(10,6)").IsRequired();
            e.Property(c => c.BufferValue).HasColumnType("decimal(10,6)").IsRequired();
            e.Property(c => c.UpdatedAt).IsRequired();
            e.HasOne(c => c.User).WithOne().HasForeignKey<ChartSettings>(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(c => c.UserId).IsUnique();
        });
    }
}
