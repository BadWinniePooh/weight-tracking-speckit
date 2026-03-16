using Microsoft.Extensions.Configuration;
using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Domain.Interfaces.Services;
using WeightTracker.Domain.Models;
using WeightTracker.Infrastructure.Data;

namespace WeightTracker.Infrastructure.Services;

public class UserManagementService(
    IUserRepository userRepository,
    IAuditLogRepository auditLogRepository,
    IEmailConfirmationService emailConfirmationService,
    IConfiguration configuration,
    AppDbContext db) : IUserManagementService
{
    public async Task<UserDto> CreateUserAsync(string username, string email, string role)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = email,
            PasswordHash = string.Empty, // admin-created users have no password initially
            Role = role,
            IsActive = true,
            EmailConfirmed = false,
            CreatedAt = DateTime.UtcNow
        };

        await using var tx = await db.Database.BeginTransactionAsync();
        try
        {
            await userRepository.AddAsync(user);
            await emailConfirmationService.SendConfirmationAsync(user.Id, user.Email);
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        return MapToDto(user);
    }

    public async Task DeactivateUserAsync(Guid targetUserId, Guid actorUserId, string actorIp)
    {
        if (targetUserId == actorUserId)
            throw new InvalidOperationException("You cannot deactivate your own account.");

        var user = await userRepository.GetByIdAsync(targetUserId)
            ?? throw new KeyNotFoundException($"User {targetUserId} not found.");
        var actor = await userRepository.GetByIdAsync(actorUserId);

        var graceDays = int.TryParse(configuration["USER_DELETION_GRACE_DAYS"], out var gd) ? gd : 30;
        user.IsActive = false;
        user.ScheduledDeletionAt = DateTime.UtcNow.AddDays(graceDays);
        await userRepository.UpdateAsync(user);

        await auditLogRepository.AppendAsync(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            ActionType = "user_deactivated",
            ActorUserId = actorUserId,
            ActorUsername = actor?.Username ?? actorUserId.ToString(),
            TargetUserId = targetUserId,
            TargetUsername = user.Username,
            IpAddress = actorIp,
            Timestamp = DateTime.UtcNow
        });
    }

    public async Task ReactivateUserAsync(Guid targetUserId, Guid actorUserId, string actorIp)
    {
        if (targetUserId == actorUserId)
            throw new InvalidOperationException("You cannot reactivate your own account.");

        var user = await userRepository.GetByIdAsync(targetUserId)
            ?? throw new KeyNotFoundException($"User {targetUserId} not found.");
        var actor = await userRepository.GetByIdAsync(actorUserId);

        user.IsActive = true;
        user.ScheduledDeletionAt = null;
        await userRepository.UpdateAsync(user);

        await auditLogRepository.AppendAsync(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            ActionType = "user_reactivated",
            ActorUserId = actorUserId,
            ActorUsername = actor?.Username ?? actorUserId.ToString(),
            TargetUserId = targetUserId,
            TargetUsername = user.Username,
            IpAddress = actorIp,
            Timestamp = DateTime.UtcNow
        });
    }

    public async Task DeleteUserAsync(Guid targetUserId, Guid actorUserId, string actorIp)
    {
        if (targetUserId == actorUserId)
            throw new InvalidOperationException("You cannot delete your own account.");

        var user = await userRepository.GetByIdAsync(targetUserId)
            ?? throw new KeyNotFoundException($"User {targetUserId} not found.");
        var actor = await userRepository.GetByIdAsync(actorUserId);

        // Write audit log BEFORE deletion so username is still available
        await auditLogRepository.AppendAsync(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            ActionType = "user_deleted",
            ActorUserId = actorUserId,
            ActorUsername = actor?.Username ?? actorUserId.ToString(),
            TargetUserId = targetUserId,
            TargetUsername = user.Username,
            IpAddress = actorIp,
            Timestamp = DateTime.UtcNow
        });

        await userRepository.DeleteAsync(targetUserId);
    }

    public async Task AssignRoleAsync(Guid targetUserId, string role, Guid actorUserId, string actorIp)
    {
        if (targetUserId == actorUserId)
            throw new InvalidOperationException("You cannot change your own role.");

        var user = await userRepository.GetByIdAsync(targetUserId)
            ?? throw new KeyNotFoundException($"User {targetUserId} not found.");
        var actor = await userRepository.GetByIdAsync(actorUserId);

        user.Role = role;
        await userRepository.UpdateAsync(user);

        await auditLogRepository.AppendAsync(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            ActionType = "role_changed",
            ActorUserId = actorUserId,
            ActorUsername = actor?.Username ?? actorUserId.ToString(),
            TargetUserId = targetUserId,
            TargetUsername = user.Username,
            IpAddress = actorIp,
            Timestamp = DateTime.UtcNow
        });
    }

    public async Task<IReadOnlyList<UserDto>> ListUsersAsync()
    {
        var users = await userRepository.GetAllAsync();
        return users.Select(MapToDto).ToList();
    }

    private static UserDto MapToDto(User user) => new()
    {
        Id = user.Id,
        Username = user.Username,
        Email = user.Email,
        Role = user.Role,
        IsActive = user.IsActive,
        EmailConfirmed = user.EmailConfirmed,
        CreatedAt = user.CreatedAt,
        LastLoginAt = user.LastLoginAt,
        ScheduledDeletionAt = user.ScheduledDeletionAt
    };
}
