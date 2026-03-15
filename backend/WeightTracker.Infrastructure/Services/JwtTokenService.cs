using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Domain.Interfaces.Services;

namespace WeightTracker.Infrastructure.Services;

public class JwtTokenService(IRefreshTokenRepository refreshTokenRepository, IConfiguration configuration) : ITokenService
{
    private const string Issuer = "weight-tracker";
    private const string Audience = "weight-tracker-api";
    private const int AccessTokenMinutes = 15;
    private const int RefreshTokenDays = 7;

    public async Task<(string AccessToken, string RefreshToken)> GenerateTokensAsync(User user)
    {
        var accessToken = BuildAccessToken(user.Id);
        var rawRefreshToken = GenerateRawRefreshToken();
        var tokenHash = HashToken(rawRefreshToken);

        await refreshTokenRepository.AddAsync(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenDays),
            CreatedAt = DateTime.UtcNow
        });

        return (accessToken, rawRefreshToken);
    }

    /// <summary>
    /// Validates the raw refresh token (by hash lookup). Returns a new access token if valid,
    /// null otherwise. Does NOT rotate the refresh token — the caller is responsible for rotation.
    /// </summary>
    public async Task<string?> RenewAccessTokenAsync(Guid userId, string refreshToken)
    {
        var tokenHash = HashToken(refreshToken);
        var stored = await refreshTokenRepository.GetActiveByHashAsync(tokenHash);

        if (stored is null || stored.UserId != userId)
            return null;

        return BuildAccessToken(userId);
    }

    public async Task InvalidateAllTokensAsync(Guid userId)
    {
        await refreshTokenRepository.RevokeAllForUserAsync(userId);
    }

    private string BuildAccessToken(Guid userId)
    {
        var key = GetSigningKey();
        var now = DateTime.UtcNow;
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(JwtRegisteredClaimNames.Iat,
                new DateTimeOffset(now).ToUnixTimeSeconds().ToString(),
                ClaimValueTypes.Integer64)
        };

        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: claims,
            notBefore: now,
            expires: now.AddMinutes(AccessTokenMinutes),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private SymmetricSecurityKey GetSigningKey()
    {
        var secret = configuration["JWT_SECRET"]
            ?? throw new InvalidOperationException("JWT_SECRET configuration is required.");
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
    }

    internal static string GenerateRawRefreshToken()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes);
    }

    internal static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
