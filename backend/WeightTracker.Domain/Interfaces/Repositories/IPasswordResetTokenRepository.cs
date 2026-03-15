using WeightTracker.Domain.Entities;

namespace WeightTracker.Domain.Interfaces.Repositories;

public interface IPasswordResetTokenRepository
{
    Task<PasswordResetToken?> GetActiveByHashAsync(string tokenHash);
    Task CreateAsync(PasswordResetToken token);
    Task MarkUsedAsync(Guid tokenId);
}
