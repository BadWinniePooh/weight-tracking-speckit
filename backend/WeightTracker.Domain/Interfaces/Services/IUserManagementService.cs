using WeightTracker.Domain.Models;

namespace WeightTracker.Domain.Interfaces.Services;

public interface IUserManagementService
{
    Task<UserDto> CreateUserAsync(string username, string email, string role);
    Task DeactivateUserAsync(Guid targetUserId, Guid actorUserId, string actorIp);
    Task ReactivateUserAsync(Guid targetUserId, Guid actorUserId, string actorIp);
    Task DeleteUserAsync(Guid targetUserId, Guid actorUserId, string actorIp);
    Task AssignRoleAsync(Guid targetUserId, string role, Guid actorUserId, string actorIp);
    Task<IReadOnlyList<UserDto>> ListUsersAsync();
}
