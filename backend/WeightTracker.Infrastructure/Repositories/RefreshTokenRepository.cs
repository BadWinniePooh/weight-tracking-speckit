using Microsoft.EntityFrameworkCore;
using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Infrastructure.Data;

namespace WeightTracker.Infrastructure.Repositories;

public class RefreshTokenRepository(AppDbContext db) : IRefreshTokenRepository
{
    public async Task<RefreshToken?> GetActiveByHashAsync(string tokenHash) =>
        await db.RefreshTokens.FirstOrDefaultAsync(t =>
            t.TokenHash == tokenHash &&
            t.RevokedAt == null &&
            t.ExpiresAt > DateTime.UtcNow);

    public async Task<RefreshToken> AddAsync(RefreshToken token)
    {
        db.RefreshTokens.Add(token);
        await db.SaveChangesAsync();
        return token;
    }

    public async Task RevokeAsync(Guid tokenId)
    {
        var token = await db.RefreshTokens.FindAsync(tokenId);
        if (token is not null)
        {
            token.RevokedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
    }

    public async Task RevokeAllForUserAsync(Guid userId)
    {
        var tokens = await db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ToListAsync();

        var now = DateTime.UtcNow;
        foreach (var token in tokens)
            token.RevokedAt = now;

        await db.SaveChangesAsync();
    }
}
