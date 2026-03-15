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
            if (!user.IsActive)
                return Results.Json(new { error = "Your account has been deactivated." }, statusCode: 401);
            if (!user.EmailConfirmed)
                return Results.Json(new { error = "Please confirm your email address before logging in." }, statusCode: 401);

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

        // GET /api/auth/confirm-email?token={token}
        app.MapGet("/api/auth/confirm-email", async (
            string token,
            IEmailConfirmationService emailConfirmationService) =>
        {
            var success = await emailConfirmationService.ConfirmAsync(token);
            if (!success)
                return Results.Json(new { error = "This confirmation link is invalid or has expired." }, statusCode: 400);
            return Results.Ok(new { message = "Email confirmed. You may now log in." });
        }).AllowAnonymous();

        // POST /api/auth/forgot-password
        app.MapPost("/api/auth/forgot-password", async (
            ForgotPasswordRequest request,
            IPasswordResetService passwordResetService) =>
        {
            await passwordResetService.RequestResetAsync(request.Email);
            return Results.Ok(new { message = "If an account with that email exists, a reset link has been sent." });
        }).AllowAnonymous();

        // POST /api/auth/reset-password
        app.MapPost("/api/auth/reset-password", async (
            ResetPasswordRequest request,
            IPasswordResetService passwordResetService) =>
        {
            var success = await passwordResetService.ResetPasswordAsync(request.Token, request.NewPassword);
            if (!success)
                return Results.Json(new { error = "This reset link is invalid or has expired. Please request a new one." }, statusCode: 400);
            return Results.Ok(new { message = "Password has been reset. You may now log in." });
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
    private record ForgotPasswordRequest(string Email);
    private record ResetPasswordRequest(string Token, string NewPassword);
}
