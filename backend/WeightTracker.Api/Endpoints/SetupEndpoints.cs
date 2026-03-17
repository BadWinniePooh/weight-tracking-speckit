using Microsoft.AspNetCore.Authorization;
using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Domain.Interfaces.Services;

namespace WeightTracker.Api.Endpoints;

public static class SetupEndpoints
{
    public static void MapSetupEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/setup/status", async (IUserRepository userRepository) =>
        {
            var firstRun = !await userRepository.ExistsAnyAsync();
            return Results.Ok(new { firstRun });
        }).AllowAnonymous();

        app.MapPost("/api/setup/initialize", async (
            SetupRequest request,
            IUserRepository userRepository,
            IPasswordHasher passwordHasher,
            IAuditLogRepository auditLogRepository,
            HttpContext httpContext) =>
        {
            if (await userRepository.ExistsAnyAsync())
                return Results.Conflict(new { error = "Setup has already been completed." });

            var errors = new Dictionary<string, List<string>>();

            if (string.IsNullOrWhiteSpace(request.Username) || request.Username.Length < 3)
                errors.GetOrAddList("username").Add("Username must be at least 3 characters.");

            if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
                errors.GetOrAddList("email").Add("A valid email address is required.");

            if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
                errors.GetOrAddList("password").Add("Password must be at least 8 characters.");

            if (errors.Count > 0)
                return Results.BadRequest(new { errors });

            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = request.Username,
                Email = request.Email,
                PasswordHash = passwordHasher.Hash(request.Password),
                Role = "admin",
                IsActive = true,
                EmailConfirmed = true,
                CreatedAt = DateTime.UtcNow
            };

            await userRepository.AddAsync(user);

            await auditLogRepository.AppendAsync(new AuditLogEntry
            {
                Id = Guid.NewGuid(),
                ActionType = "user_created",
                ActorUserId = user.Id,
                ActorUsername = user.Username,
                TargetUserId = user.Id,
                TargetUsername = user.Username,
                IpAddress = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                Timestamp = DateTime.UtcNow
            });

            return Results.Created("/api/setup/initialize", new { message = "Setup complete. Please log in." });
        }).AllowAnonymous();
    }

    private record SetupRequest(string Username, string Email, string Password);
}

internal static class DictionaryExtensions
{
    internal static List<string> GetOrAddList(this Dictionary<string, List<string>> dict, string key)
    {
        if (!dict.TryGetValue(key, out var list))
        {
            list = new List<string>();
            dict[key] = list;
        }
        return list;
    }
}
