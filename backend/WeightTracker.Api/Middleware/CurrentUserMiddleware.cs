using System.Security.Claims;
using WeightTracker.Domain.Interfaces.Services;

namespace WeightTracker.Api.Middleware;

public class CurrentUserMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ICurrentUserResolver resolver)
    {
        // Only resolve user ID for authenticated requests; skip for anonymous endpoints
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var sub = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (Guid.TryParse(sub, out var userId))
                context.Items["CurrentUserId"] = userId;
        }
        await next(context);
    }
}
