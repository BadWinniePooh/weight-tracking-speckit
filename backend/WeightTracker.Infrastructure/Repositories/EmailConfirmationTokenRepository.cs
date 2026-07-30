using Microsoft.EntityFrameworkCore;
using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Infrastructure.Data;

namespace WeightTracker.Infrastructure.Repositories;

public class EmailConfirmationTokenRepository(AppDbContext db) : IEmailConfirmationTokenRepository
{
    public async Task<EmailConfirmationToken?> GetActiveByHashAsync(string tokenHash) =>
        await db.EmailConfirmationTokens
            .FirstOrDefaultAsync(t =>
                t.TokenHash == tokenHash &&
                t.UsedAt == null &&
                t.ExpiresAt > DateTime.UtcNow);

    public async Task CreateAsync(EmailConfirmationToken token)
    {
        db.EmailConfirmationTokens.Add(token);
        await db.SaveChangesAsync();
    }

    public async Task MarkUsedAsync(Guid tokenId)
    {
        var token = await db.EmailConfirmationTokens.FindAsync(tokenId);
        if (token is not null)
        {
            token.UsedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
    }

    public async Task InvalidatePreviousAsync(Guid userId)
    {
        var tokens = await db.EmailConfirmationTokens
            .Where(t => t.UserId == userId && t.UsedAt == null && t.ExpiresAt > DateTime.UtcNow)
            .ToListAsync();

        foreach (var token in tokens)
            token.UsedAt = DateTime.UtcNow; // mark as used (invalidated)

        if (tokens.Any())
            await db.SaveChangesAsync();
    }
}
