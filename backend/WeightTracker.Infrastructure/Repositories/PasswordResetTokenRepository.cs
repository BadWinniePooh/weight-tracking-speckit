using Microsoft.EntityFrameworkCore;
using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Infrastructure.Data;

namespace WeightTracker.Infrastructure.Repositories;

public class PasswordResetTokenRepository(AppDbContext db) : IPasswordResetTokenRepository
{
    public async Task<PasswordResetToken?> GetActiveByHashAsync(string tokenHash) =>
        await db.PasswordResetTokens
            .FirstOrDefaultAsync(t =>
                t.TokenHash == tokenHash &&
                t.UsedAt == null &&
                t.ExpiresAt > DateTime.UtcNow);

    public async Task CreateAsync(PasswordResetToken token)
    {
        db.PasswordResetTokens.Add(token);
        await db.SaveChangesAsync();
    }

    public async Task MarkUsedAsync(Guid tokenId)
    {
        var token = await db.PasswordResetTokens.FindAsync(tokenId);
        if (token is not null)
        {
            token.UsedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
    }
}
