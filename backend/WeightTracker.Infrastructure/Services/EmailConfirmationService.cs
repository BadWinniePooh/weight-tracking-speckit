using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Domain.Interfaces.Services;

namespace WeightTracker.Infrastructure.Services;

public class EmailConfirmationService(
    IUserRepository userRepository,
    IEmailConfirmationTokenRepository tokenRepository,
    IEmailService emailService,
    IConfiguration configuration) : IEmailConfirmationService
{
    private const int TokenExpiryHours = 24;

    public async Task SendConfirmationAsync(Guid userId, string targetEmail)
    {
        // Invalidate any previous pending token for this user
        await tokenRepository.InvalidatePreviousAsync(userId);

        var plaintext = GeneratePlaintext();
        var hash = HashToken(plaintext);

        await tokenRepository.CreateAsync(new EmailConfirmationToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TargetEmail = targetEmail,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddHours(TokenExpiryHours),
            CreatedAt = DateTime.UtcNow
        });

        var baseUrl = configuration["APP_BASE_URL"] ?? "http://localhost:3000";
        var confirmUrl = $"{baseUrl}/confirm-email.html?token={plaintext}";

        var htmlBody = $"""
            <p>Please confirm your email address to activate your weight tracker account.</p>
            <p><a href="{confirmUrl}">Confirm your email</a></p>
            <p>This link expires in {TokenExpiryHours} hours. If you did not create this account, ignore this email.</p>
            """;

        await emailService.SendAsync(targetEmail, "Confirm your email address", htmlBody);
    }

    public async Task<Guid?> ConfirmAsync(string token)
    {
        var hash = HashToken(token);
        var stored = await tokenRepository.GetActiveByHashAsync(hash);
        if (stored is null)
            return null;

        var user = await userRepository.GetByIdAsync(stored.UserId);
        if (user is null)
            return null;

        // Email change path vs new account confirmation path
        if (stored.TargetEmail.Equals(user.Email, StringComparison.OrdinalIgnoreCase))
        {
            // Same email: just confirm
            user.EmailConfirmed = true;
        }
        else
        {
            // Email change: update email
            user.Email = stored.TargetEmail;
            user.PendingEmail = null;
            user.EmailConfirmed = true;
        }

        await userRepository.UpdateAsync(user);
        await tokenRepository.MarkUsedAsync(stored.Id);

        return user.Id;
    }

    public async Task ResendConfirmationAsync(Guid userId)
    {
        var user = await userRepository.GetByIdAsync(userId);
        if (user is null)
            return;

        var targetEmail = user.PendingEmail ?? user.Email;
        await SendConfirmationAsync(userId, targetEmail);
    }

    private static string GeneratePlaintext()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
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
