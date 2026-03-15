using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Domain.Interfaces.Services;

namespace WeightTracker.Api.Endpoints;

public static class AuthEndpoints
{
    private const string RefreshTokenCookieName = "refreshToken";
    private const int RefreshTokenDays = 7;

    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        // POST /api/auth/login
        app.MapPost("/api/auth/login", async (
            LoginRequest request,
            IUserRepository userRepository,
            IPasswordHasher passwordHasher,
            ITokenService tokenService,
            HttpContext httpContext) =>
        {
            var user = await userRepository.GetByUsernameAsync(request.Username);
            if (user is null || !passwordHasher.Verify(request.Password, user.PasswordHash))
                return Results.Json(new { error = "Invalid username or password." }, statusCode: 401);

            var (accessToken, refreshToken) = await tokenService.GenerateTokensAsync(user);
            SetRefreshCookie(httpContext, refreshToken);

            return Results.Ok(new
            {
                accessToken,
                expiresIn = 900,
                tokenType = "Bearer"
            });
        }).AllowAnonymous();

        // POST /api/auth/refresh
        app.MapPost("/api/auth/refresh", async (
            IRefreshTokenRepository refreshTokenRepository,
            IUserRepository userRepository,
            ITokenService tokenService,
            HttpContext httpContext) =>
        {
            var rawToken = httpContext.Request.Cookies[RefreshTokenCookieName];
            if (string.IsNullOrEmpty(rawToken))
            {
                ClearRefreshCookie(httpContext);
                return Results.Json(new { error = "Session expired. Please log in again." }, statusCode: 401);
            }

            var tokenHash = HashToken(rawToken);
            var stored = await refreshTokenRepository.GetActiveByHashAsync(tokenHash);
            if (stored is null)
            {
                ClearRefreshCookie(httpContext);
                return Results.Json(new { error = "Session expired. Please log in again." }, statusCode: 401);
            }

            var user = await userRepository.GetByIdAsync(stored.UserId);
            if (user is null)
            {
                ClearRefreshCookie(httpContext);
                return Results.Json(new { error = "Session expired. Please log in again." }, statusCode: 401);
            }

            // Rotate: revoke old token, issue new pair
            await refreshTokenRepository.RevokeAsync(stored.Id);
            var (newAccessToken, newRawRefresh) = await tokenService.GenerateTokensAsync(user);
            SetRefreshCookie(httpContext, newRawRefresh);

            return Results.Ok(new
            {
                accessToken = newAccessToken,
                expiresIn = 900,
                tokenType = "Bearer"
            });
        }).AllowAnonymous();

        // POST /api/auth/logout
        app.MapPost("/api/auth/logout", async (
            ITokenService tokenService,
            HttpContext httpContext) =>
        {
            var sub = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (Guid.TryParse(sub, out var userId))
                await tokenService.InvalidateAllTokensAsync(userId);

            ClearRefreshCookie(httpContext);
            return Results.NoContent();
        }).RequireAuthorization();
    }

    private static void SetRefreshCookie(HttpContext ctx, string token)
    {
        var env = ctx.RequestServices.GetRequiredService<IWebHostEnvironment>();
        ctx.Response.Cookies.Append(RefreshTokenCookieName, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = env.IsProduction(),
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(RefreshTokenDays)
        });
    }

    private static void ClearRefreshCookie(HttpContext ctx)
    {
        ctx.Response.Cookies.Append(RefreshTokenCookieName, "", new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = DateTimeOffset.UnixEpoch
        });
    }

    private static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private record LoginRequest(string Username, string Password);
}
