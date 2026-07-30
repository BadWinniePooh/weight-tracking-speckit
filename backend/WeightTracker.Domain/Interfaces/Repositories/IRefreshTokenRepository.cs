using WeightTracker.Domain.Entities;

namespace WeightTracker.Domain.Interfaces.Repositories;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetActiveByHashAsync(string tokenHash);
    Task<RefreshToken> AddAsync(RefreshToken token);
    Task RevokeAsync(Guid tokenId);
    Task RevokeAllForUserAsync(Guid userId);

    /// <summary>
    /// Caps the token's expiry at <paramref name="maxExpiresAt"/> without revoking
    /// it. Used on rotation: the old token stays valid for a short grace window so a
    /// client that lost the rotation response can retry. Never extends a lifetime —
    /// replays cannot push the deadline out.
    /// </summary>
    Task ShortenExpiryAsync(Guid tokenId, DateTime maxExpiresAt);
}
