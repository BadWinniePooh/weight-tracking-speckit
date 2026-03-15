using WeightTracker.Domain.Entities;

namespace WeightTracker.Domain.Interfaces.Repositories;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetActiveByHashAsync(string tokenHash);
    Task<RefreshToken> AddAsync(RefreshToken token);
    Task RevokeAsync(Guid tokenId);
    Task RevokeAllForUserAsync(Guid userId);
}
