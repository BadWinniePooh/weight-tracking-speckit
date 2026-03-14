using WeightTracker.Domain.Interfaces.Services;

namespace WeightTracker.Api.Middleware;

public class CurrentUserMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ICurrentUserResolver resolver)
    {
        context.Items["CurrentUserId"] = resolver.GetCurrentUserId();
        await next(context);
    }
}
