using WeightTracker.Domain.Interfaces.Services;

namespace WeightTracker.Tests.Integration.Fixtures;

/// <summary>
/// In-memory email service for integration tests. Captures all sent messages
/// so tests can assert on email delivery without requiring a real SMTP server.
/// </summary>
public class FakeEmailService : IEmailService
{
    private readonly List<FakeEmail> _messages = new();
    private bool _shouldThrow;

    public IReadOnlyList<FakeEmail> Messages => _messages.AsReadOnly();

    /// <summary>Causes the next SendAsync call to throw, simulating SMTP failure.</summary>
    public void SimulateFailure(bool shouldThrow = true) => _shouldThrow = shouldThrow;

    public Task SendAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        if (_shouldThrow)
        {
            _shouldThrow = false;
            throw new InvalidOperationException("Simulated email send failure.");
        }
        _messages.Add(new FakeEmail(to, subject, htmlBody));
        return Task.CompletedTask;
    }

    public void Clear()
    {
        _messages.Clear();
        _shouldThrow = false;
    }
}

public record FakeEmail(string To, string Subject, string Body);
