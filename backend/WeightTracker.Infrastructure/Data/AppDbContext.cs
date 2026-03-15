using Microsoft.EntityFrameworkCore;
using WeightTracker.Domain.Entities;

namespace WeightTracker.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<WeightEntry> WeightEntries => Set<WeightEntry>();
    public DbSet<ChartSettings> ChartSettings => Set<ChartSettings>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<EmailConfirmationToken> EmailConfirmationTokens => Set<EmailConfirmationToken>();
    public DbSet<AuditLogEntry> AuditLog => Set<AuditLogEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("Users");
            e.HasKey(u => u.Id);
            e.Property(u => u.Username).HasMaxLength(100).IsRequired();
            e.Property(u => u.Email).HasMaxLength(255).IsRequired();
            e.Property(u => u.PasswordHash).IsRequired();
            e.Property(u => u.Role).HasMaxLength(20).IsRequired();
            e.Property(u => u.IsActive).IsRequired();
            e.Property(u => u.CreatedAt).IsRequired();
            e.Property(u => u.ScheduledDeletionAt);
            e.Property(u => u.EmailConfirmed).IsRequired().HasDefaultValue(false);
            e.Property(u => u.PendingEmail).HasMaxLength(255);
            e.Property(u => u.LastLoginAt);
            e.HasIndex(u => u.Username).IsUnique();
            e.HasIndex(u => u.Email).IsUnique();
        });

        modelBuilder.Entity<PasswordResetToken>(e =>
        {
            e.ToTable("PasswordResetTokens");
            e.HasKey(p => p.Id);
            e.Property(p => p.TokenHash).HasMaxLength(64).IsRequired();
            e.Property(p => p.ExpiresAt).IsRequired();
            e.Property(p => p.UsedAt);
            e.Property(p => p.CreatedAt).IsRequired();
            e.HasIndex(p => p.TokenHash).IsUnique().HasDatabaseName("IX_PasswordResetTokens_TokenHash");
            e.HasIndex(p => p.UserId).HasDatabaseName("IX_PasswordResetTokens_UserId");
            e.HasOne(p => p.User)
             .WithMany()
             .HasForeignKey(p => p.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EmailConfirmationToken>(e =>
        {
            e.ToTable("EmailConfirmationTokens");
            e.HasKey(ec => ec.Id);
            e.Property(ec => ec.TargetEmail).HasMaxLength(255).IsRequired();
            e.Property(ec => ec.TokenHash).HasMaxLength(64).IsRequired();
            e.Property(ec => ec.ExpiresAt).IsRequired();
            e.Property(ec => ec.UsedAt);
            e.Property(ec => ec.CreatedAt).IsRequired();
            e.HasIndex(ec => ec.TokenHash).IsUnique().HasDatabaseName("IX_EmailConfirmationTokens_TokenHash");
            e.HasIndex(ec => ec.UserId).HasDatabaseName("IX_EmailConfirmationTokens_UserId");
            e.HasOne(ec => ec.User)
             .WithMany()
             .HasForeignKey(ec => ec.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AuditLogEntry>(e =>
        {
            e.ToTable("AuditLog");
            e.HasKey(a => a.Id);
            e.Property(a => a.ActionType).HasMaxLength(50).IsRequired();
            e.Property(a => a.ActorUserId).IsRequired();
            e.Property(a => a.TargetUserId);
            e.Property(a => a.IpAddress).HasMaxLength(45).IsRequired();
            e.Property(a => a.Timestamp).IsRequired();
            e.HasIndex(a => a.Timestamp).HasDatabaseName("IX_AuditLog_Timestamp");
            e.HasIndex(a => a.ActionType).HasDatabaseName("IX_AuditLog_ActionType");
            e.HasIndex(a => a.ActorUserId).HasDatabaseName("IX_AuditLog_ActorUserId");
            // No FK on ActorUserId/TargetUserId — preserves log after user deletion
        });

        modelBuilder.Entity<RefreshToken>(e =>
        {
            e.ToTable("RefreshTokens");
            e.HasKey(r => r.Id);
            e.Property(r => r.TokenHash).HasMaxLength(64).IsRequired();
            e.Property(r => r.ExpiresAt).IsRequired();
            e.Property(r => r.RevokedAt);
            e.Property(r => r.CreatedAt).IsRequired();
            e.HasIndex(r => r.TokenHash).IsUnique();
            e.HasIndex(r => r.UserId);
            e.HasIndex(r => new { r.UserId, r.ExpiresAt });
            e.HasOne(r => r.User)
             .WithMany(u => u.RefreshTokens)
             .HasForeignKey(r => r.UserId)
             .OnDelete(DeleteBehavior.Cascade);
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
