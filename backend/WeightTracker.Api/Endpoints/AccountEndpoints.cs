using System.Security.Claims;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Domain.Interfaces.Services;

namespace WeightTracker.Api.Endpoints;

public static class AccountEndpoints
{
    public static void MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var accountGroup = app.MapGroup("/api/account").RequireAuthorization();

        // PUT /api/account/username
        accountGroup.MapPut("/username", async (
            ChangeUsernameRequest request,
            IUserRepository userRepository,
            HttpContext httpContext) =>
        {
            var userId = GetUserId(httpContext);
            if (userId == Guid.Empty)
                return Results.Unauthorized();

            if (await userRepository.ExistsByUsernameAsync(request.NewUsername))
                return Results.Json(new { error = "Username is already taken.", field = "newUsername" }, statusCode: 400);

            var user = await userRepository.GetByIdAsync(userId);
            if (user is null)
                return Results.NotFound();

            user.Username = request.NewUsername;
            await userRepository.UpdateAsync(user);

            return Results.Ok(new { username = user.Username });
        });

        // PUT /api/account/password
        accountGroup.MapPut("/password", async (
            ChangePasswordRequest request,
            IUserRepository userRepository,
            IPasswordHasher passwordHasher,
            HttpContext httpContext) =>
        {
            var userId = GetUserId(httpContext);
            if (userId == Guid.Empty)
                return Results.Unauthorized();

            var user = await userRepository.GetByIdAsync(userId);
            if (user is null)
                return Results.NotFound();

            if (!passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
                return Results.Json(new { error = "Current password is incorrect.", field = "currentPassword" }, statusCode: 400);

            user.PasswordHash = passwordHasher.Hash(request.NewPassword);
            await userRepository.UpdateAsync(user);

            return Results.NoContent();
        });

        // PUT /api/account/email
        accountGroup.MapPut("/email", async (
            ChangeEmailRequest request,
            IUserRepository userRepository,
            IEmailConfirmationService emailConfirmationService,
            HttpContext httpContext) =>
        {
            var userId = GetUserId(httpContext);
            if (userId == Guid.Empty)
                return Results.Unauthorized();

            // Check if new email is already in use
            if (await userRepository.ExistsByEmailAsync(request.NewEmail))
                return Results.Json(new { error = "That email address is already in use.", field = "newEmail" }, statusCode: 400);

            var user = await userRepository.GetByIdAsync(userId);
            if (user is null)
                return Results.NotFound();

            // Store the pending email and send confirmation
            user.PendingEmail = request.NewEmail;
            await userRepository.UpdateAsync(user);
            await emailConfirmationService.SendConfirmationAsync(userId, request.NewEmail);

            return Results.Ok(new
            {
                message = $"A confirmation email has been sent to {request.NewEmail}. Your current email remains active until confirmed."
            });
        });
    }

    private static Guid GetUserId(HttpContext ctx)
    {
        var sub = ctx.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(sub, out var id) ? id : Guid.Empty;
    }

    private record ChangeUsernameRequest(string NewUsername);
    private record ChangePasswordRequest(string CurrentPassword, string NewPassword);
    private record ChangeEmailRequest(string NewEmail);
}
