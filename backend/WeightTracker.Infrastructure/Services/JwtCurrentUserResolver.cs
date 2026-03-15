using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using WeightTracker.Domain.Interfaces.Services;

namespace WeightTracker.Infrastructure.Services;

public class JwtCurrentUserResolver(IHttpContextAccessor httpContextAccessor) : ICurrentUserResolver
{
    public Guid GetCurrentUserId()
    {
        var user = httpContextAccessor.HttpContext?.User
            ?? throw new UnauthorizedAccessException("No HTTP context available.");

        var sub = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? throw new UnauthorizedAccessException("No sub claim found in token.");

        if (!Guid.TryParse(sub, out var userId))
            throw new UnauthorizedAccessException("Invalid sub claim format.");

        return userId;
    }
}
