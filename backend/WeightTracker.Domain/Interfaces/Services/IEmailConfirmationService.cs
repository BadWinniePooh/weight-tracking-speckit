namespace WeightTracker.Domain.Interfaces.Services;

public interface IEmailConfirmationService
{
    Task SendConfirmationAsync(Guid userId, string targetEmail);
    Task<bool> ConfirmAsync(string token);
    Task ResendConfirmationAsync(Guid userId);
}
