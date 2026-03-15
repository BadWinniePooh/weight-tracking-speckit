using System.Security.Claims;
using WeightTracker.Domain.Interfaces.Services;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Domain.Models;

namespace WeightTracker.Api.Endpoints;

public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var adminGroup = app.MapGroup("/api/admin").RequireAuthorization("AdminOnly");

        // GET /api/admin/users
        adminGroup.MapGet("/users", async (IUserManagementService userManagementService) =>
        {
            var users = await userManagementService.ListUsersAsync();
            return Results.Ok(new { users });
        });

        // POST /api/admin/users
        adminGroup.MapPost("/users", async (
            CreateUserRequest request,
            IUserManagementService userManagementService,
            IUserRepository userRepository) =>
        {
            if (await userRepository.ExistsByUsernameAsync(request.Username))
                return Results.Json(new { error = "Username is already taken.", field = "username" }, statusCode: 400);

            if (await userRepository.ExistsByEmailAsync(request.Email))
                return Results.Json(new { error = "Email is already in use.", field = "email" }, statusCode: 400);

            var userDto = await userManagementService.CreateUserAsync(request.Username, request.Email, request.Role);
            return Results.Json(userDto, statusCode: 201);
        });

        // POST /api/admin/users/{id}/deactivate
        adminGroup.MapPost("/users/{id:guid}/deactivate", async (
            Guid id,
            IUserManagementService userManagementService,
            HttpContext httpContext) =>
        {
            var actorId = GetActorId(httpContext);
            if (actorId == Guid.Empty)
                return Results.Unauthorized();

            try
            {
                await userManagementService.DeactivateUserAsync(id, actorId, GetIpAddress(httpContext));
                var user = (await userManagementService.ListUsersAsync()).FirstOrDefault(u => u.Id == id);
                if (user is null)
                    return Results.NotFound();
                return Results.Ok(new { id = user.Id, isActive = user.IsActive, scheduledDeletionAt = user.ScheduledDeletionAt });
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: 400);
            }
            catch (KeyNotFoundException)
            {
                return Results.NotFound();
            }
        });

        // POST /api/admin/users/{id}/reactivate
        adminGroup.MapPost("/users/{id:guid}/reactivate", async (
            Guid id,
            IUserManagementService userManagementService,
            HttpContext httpContext) =>
        {
            var actorId = GetActorId(httpContext);
            if (actorId == Guid.Empty)
                return Results.Unauthorized();

            try
            {
                await userManagementService.ReactivateUserAsync(id, actorId, GetIpAddress(httpContext));
                var user = (await userManagementService.ListUsersAsync()).FirstOrDefault(u => u.Id == id);
                if (user is null)
                    return Results.NotFound();
                return Results.Ok(new { id = user.Id, isActive = user.IsActive, scheduledDeletionAt = user.ScheduledDeletionAt });
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: 400);
            }
            catch (KeyNotFoundException)
            {
                return Results.NotFound();
            }
        });

        // DELETE /api/admin/users/{id}
        adminGroup.MapDelete("/users/{id:guid}", async (
            Guid id,
            IUserManagementService userManagementService,
            HttpContext httpContext) =>
        {
            var actorId = GetActorId(httpContext);
            if (actorId == Guid.Empty)
                return Results.Unauthorized();

            try
            {
                await userManagementService.DeleteUserAsync(id, actorId, GetIpAddress(httpContext));
                return Results.NoContent();
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: 400);
            }
            catch (KeyNotFoundException)
            {
                return Results.NotFound();
            }
        });

        // PUT /api/admin/users/{id}/role
        adminGroup.MapPut("/users/{id:guid}/role", async (
            Guid id,
            AssignRoleRequest request,
            IUserManagementService userManagementService,
            HttpContext httpContext) =>
        {
            var actorId = GetActorId(httpContext);
            if (actorId == Guid.Empty)
                return Results.Unauthorized();

            try
            {
                await userManagementService.AssignRoleAsync(id, request.Role, actorId, GetIpAddress(httpContext));
                return Results.Ok(new { id, role = request.Role });
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: 400);
            }
            catch (KeyNotFoundException)
            {
                return Results.NotFound();
            }
        });

        // POST /api/admin/users/{id}/resend-confirmation
        adminGroup.MapPost("/users/{id:guid}/resend-confirmation", async (
            Guid id,
            IUserRepository userRepository,
            IEmailConfirmationService emailConfirmationService) =>
        {
            var user = await userRepository.GetByIdAsync(id);
            if (user is null)
                return Results.NotFound();

            if (user.EmailConfirmed)
                return Results.Json(new { error = "This user's email is already confirmed." }, statusCode: 400);

            await emailConfirmationService.ResendConfirmationAsync(id);
            return Results.NoContent();
        });

        // GET /api/admin/audit-log
        adminGroup.MapGet("/audit-log", async (
            IAuditLogRepository auditLogRepository,
            int page = 1,
            int pageSize = 50,
            string? fromDate = null,
            string? toDate = null,
            string? actionType = null) =>
        {
            var effectivePageSize = Math.Min(pageSize, 200);
            var filter = new AuditLogFilter(
                page,
                effectivePageSize,
                string.IsNullOrEmpty(fromDate) ? null : DateTime.Parse(fromDate),
                string.IsNullOrEmpty(toDate) ? null : DateTime.Parse(toDate),
                actionType);

            var result = await auditLogRepository.QueryAsync(filter);
            return Results.Ok(new
            {
                entries = result.Entries,
                totalCount = result.TotalCount,
                page,
                pageSize = effectivePageSize
            });
        });
    }

    private static Guid GetActorId(HttpContext ctx)
    {
        var sub = ctx.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(sub, out var id) ? id : Guid.Empty;
    }

    private static string GetIpAddress(HttpContext ctx) =>
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    private record CreateUserRequest(string Username, string Email, string Role);
    private record AssignRoleRequest(string Role);
}
