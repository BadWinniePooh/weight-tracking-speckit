using System.Reflection.Metadata.Ecma335;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Domain.Interfaces.Services;

namespace WeightTracker.Infrastructure.Services;

public class PasswordResetService(
    IUserRepository userRepository,
    IPasswordResetTokenRepository tokenRepository,
    IEmailService emailService,
    IPasswordHasher passwordHasher,
    IConfiguration configuration) : IPasswordResetService
{
    private const int TokenExpiryHours = 1;

    public async Task RequestResetAsync(string email)
    {
        // Always return same response regardless of whether user exists (anti-enumeration)
        var user = await userRepository.GetByEmailAsync(email);
        if (user is null || !user.IsActive)
            return;

        // Generate cryptographically secure token
        var bytes = RandomNumberGenerator.GetBytes(32);
        var plaintext = Base64UrlEncode(bytes);
        var hash = HashToken(plaintext);

        await tokenRepository.CreateAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddHours(TokenExpiryHours),
            CreatedAt = DateTime.UtcNow
        });

        var baseUrl = configuration["APP_BASE_URL"] ?? "http://localhost:3000";
        var resetUrl = $"{baseUrl}/reset-complete.html?token={plaintext}";

        var htmlBody = $"""
            <p>You requested a password reset for your weight tracker account.</p>
            <p><a href="{resetUrl}">Reset your password</a></p>
            <p>This link expires in {TokenExpiryHours} hour{(TokenExpiryHours > 1 ? "s" : "")}. If you did not request this, ignore this email.</p>
            """;

        await emailService.SendAsync(user.Email, "Reset your password", htmlBody);
    }

    public async Task<string> CreateResetTokenAsync(Guid userId)
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var plaintext = Base64UrlEncode(bytes);
        var hash = HashToken(plaintext);

        await tokenRepository.CreateAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddHours(TokenExpiryHours),
            CreatedAt = DateTime.UtcNow
        });

        return plaintext;
    }

    public async Task<bool> ResetPasswordAsync(string token, string newPassword)
    {
        var hash = HashToken(token);
        var stored = await tokenRepository.GetActiveByHashAsync(hash);
        if (stored is null)
            return false;

        var user = await userRepository.GetByIdAsync(stored.UserId);
        if (user is null)
            return false;

        user.PasswordHash = passwordHasher.Hash(newPassword);
        await userRepository.UpdateAsync(user);
        await tokenRepository.MarkUsedAsync(stored.Id);

        return true;
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    private static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
