using WeightTracker.Domain.Interfaces.Services;

namespace WeightTracker.Tests.Integration.Fixtures;

/// <summary>
/// In-memory email service for integration tests. Captures all sent messages
/// so tests can assert on email delivery without requiring a real SMTP server.
/// </summary>
public class FakeEmailService : IEmailService
{
    private readonly List<FakeEmail> _messages = new();

    public IReadOnlyList<FakeEmail> Messages => _messages.AsReadOnly();

    public Task SendAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        _messages.Add(new FakeEmail(to, subject, htmlBody));
        return Task.CompletedTask;
    }

    public void Clear() => _messages.Clear();
}

public record FakeEmail(string To, string Subject, string Body);
