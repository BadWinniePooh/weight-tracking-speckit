namespace WeightTracker.Domain.Interfaces.Services;

public interface IPasswordResetService
{
    Task RequestResetAsync(string email);
    Task<bool> ResetPasswordAsync(string token, string newPassword);
    Task<string> CreateResetTokenAsync(Guid userId);
}
