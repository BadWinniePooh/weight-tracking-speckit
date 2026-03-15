using WeightTracker.Domain.Entities;

namespace WeightTracker.Domain.Interfaces.Services;

public interface ITokenService
{
    Task<(string AccessToken, string RefreshToken)> GenerateTokensAsync(User user);
    Task<string?> RenewAccessTokenAsync(Guid userId, string refreshToken);
    Task InvalidateAllTokensAsync(Guid userId);
}
