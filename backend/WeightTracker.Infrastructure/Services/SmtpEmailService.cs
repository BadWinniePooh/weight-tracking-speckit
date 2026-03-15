using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using MimeKit;
using WeightTracker.Domain.Interfaces.Services;

namespace WeightTracker.Infrastructure.Services;

public class SmtpEmailService(IConfiguration configuration) : IEmailService
{
    public async Task SendAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        var host = configuration["SMTP_HOST"] ?? "localhost";
        var port = int.TryParse(configuration["SMTP_PORT"], out var p) ? p : 1025;
        var user = configuration["SMTP_USER"] ?? string.Empty;
        var password = configuration["SMTP_PASSWORD"] ?? string.Empty;
        var senderEmail = configuration["SMTP_SENDER_EMAIL"] ?? "noreply@example.com";

        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(senderEmail));
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = subject;
        message.Body = new TextPart("html") { Text = htmlBody };

        using var client = new SmtpClient();
        // For MailHog and dev SMTP, use None (no TLS); for production use Auto
        await client.ConnectAsync(host, port, SecureSocketOptions.None, cancellationToken);

        if (!string.IsNullOrEmpty(user))
            await client.AuthenticateAsync(user, password, cancellationToken);

        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}
