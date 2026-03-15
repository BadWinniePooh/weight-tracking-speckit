using System.Net;
using System.Net.Http.Json;
using WeightTracker.Infrastructure.Data;
using WeightTracker.Tests.Integration.Fixtures;
using Xunit;

namespace WeightTracker.Tests.Integration.Endpoints;

public class SetupEndpointsTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private readonly HttpClient _client = fixture.CreateClient();

    [Fact]
    public async Task GetSetupStatus_EmptyDb_ReturnsFirstRunTrue()
    {
        // Clear all users
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.RefreshTokens.RemoveRange(db.RefreshTokens);
        db.ChartSettings.RemoveRange(db.ChartSettings);
        db.WeightEntries.RemoveRange(db.WeightEntries);
        db.Users.RemoveRange(db.Users);
        await db.SaveChangesAsync();

        var response = await _client.GetAsync("/api/setup/status");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<SetupStatusResponse>();
        Assert.NotNull(body);
        Assert.True(body.FirstRun);
    }

    [Fact]
    public async Task GetSetupStatus_AfterUserExists_ReturnsFirstRunFalse()
    {
        // Ensure test user exists
        fixture.CreateAuthenticatedClient(); // side-effect: creates test user

        var response = await _client.GetAsync("/api/setup/status");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<SetupStatusResponse>();
        Assert.NotNull(body);
        Assert.False(body.FirstRun);
    }

    [Fact]
    public async Task PostSetupInitialize_FirstCall_Returns201()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.RefreshTokens.RemoveRange(db.RefreshTokens);
        db.ChartSettings.RemoveRange(db.ChartSettings);
        db.WeightEntries.RemoveRange(db.WeightEntries);
        db.Users.RemoveRange(db.Users);
        await db.SaveChangesAsync();

        var request = new SetupInitRequest("admin", "admin@example.com", "secretpass123");
        var response = await _client.PostAsJsonAsync("/api/setup/initialize", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task PostSetupInitialize_SecondCall_Returns409()
    {
        // Ensure test user exists (first call already done above or via fixture)
        fixture.CreateAuthenticatedClient();

        var request = new SetupInitRequest("admin2", "admin2@example.com", "secretpass456");
        var response = await _client.PostAsJsonAsync("/api/setup/initialize", request);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(body?.Error);
    }

    [Fact]
    public async Task PostSetupInitialize_MissingUsername_Returns400()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.RefreshTokens.RemoveRange(db.RefreshTokens);
        db.ChartSettings.RemoveRange(db.ChartSettings);
        db.WeightEntries.RemoveRange(db.WeightEntries);
        db.Users.RemoveRange(db.Users);
        await db.SaveChangesAsync();

        var request = new SetupInitRequest("ab", "admin@example.com", "secretpass123");
        var response = await _client.PostAsJsonAsync("/api/setup/initialize", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostSetupInitialize_ShortPassword_Returns400()
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.RefreshTokens.RemoveRange(db.RefreshTokens);
        db.ChartSettings.RemoveRange(db.ChartSettings);
        db.WeightEntries.RemoveRange(db.WeightEntries);
        db.Users.RemoveRange(db.Users);
        await db.SaveChangesAsync();

        var request = new SetupInitRequest("admin", "admin@example.com", "short");
        var response = await _client.PostAsJsonAsync("/api/setup/initialize", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}

record SetupStatusResponse(bool FirstRun);
record SetupInitRequest(string Username, string Email, string Password);
