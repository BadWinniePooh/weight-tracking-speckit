using WeightTracker.Domain.Entities;

namespace WeightTracker.Domain.Interfaces.Repositories;

public interface IEmailConfirmationTokenRepository
{
    Task<EmailConfirmationToken?> GetActiveByHashAsync(string tokenHash);
    Task CreateAsync(EmailConfirmationToken token);
    Task MarkUsedAsync(Guid tokenId);
    Task InvalidatePreviousAsync(Guid userId);
}
