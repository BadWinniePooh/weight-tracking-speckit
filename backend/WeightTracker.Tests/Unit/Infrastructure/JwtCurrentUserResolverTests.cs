using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using WeightTracker.Infrastructure.Services;
using Xunit;

namespace WeightTracker.Tests.Unit.Infrastructure;

public class JwtCurrentUserResolverTests
{
    [Fact]
    public void GetCurrentUserId_ValidSubClaim_ReturnsGuid()
    {
        var userId = Guid.NewGuid();
        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) };
        var identity = new ClaimsIdentity(claims, "Bearer");
        var principal = new ClaimsPrincipal(identity);

        var httpContext = new DefaultHttpContext { User = principal };
        var accessor = new HttpContextAccessor { HttpContext = httpContext };

        var resolver = new JwtCurrentUserResolver(accessor);
        var result = resolver.GetCurrentUserId();

        Assert.Equal(userId, result);
    }

    [Fact]
    public void GetCurrentUserId_NoSubClaim_ThrowsUnauthorizedAccessException()
    {
        var identity = new ClaimsIdentity(Array.Empty<Claim>(), "Bearer");
        var principal = new ClaimsPrincipal(identity);

        var httpContext = new DefaultHttpContext { User = principal };
        var accessor = new HttpContextAccessor { HttpContext = httpContext };

        var resolver = new JwtCurrentUserResolver(accessor);

        Assert.Throws<UnauthorizedAccessException>(() => resolver.GetCurrentUserId());
    }

    [Fact]
    public void GetCurrentUserId_NullHttpContext_ThrowsUnauthorizedAccessException()
    {
        var accessor = new HttpContextAccessor { HttpContext = null };

        var resolver = new JwtCurrentUserResolver(accessor);

        Assert.Throws<UnauthorizedAccessException>(() => resolver.GetCurrentUserId());
    }
}
