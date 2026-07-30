using System.Net;
using System.Net.Http.Json;
using WeightTracker.Domain.Entities;
using WeightTracker.Infrastructure.Data;
using WeightTracker.Tests.Integration.Fixtures;
using Xunit;

namespace WeightTracker.Tests.Integration.Endpoints;

public class SettingsEndpointsTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private readonly HttpClient _client = fixture.CreateAuthenticatedClient();

    // ── Bug #1: GET /api/settings returns 404 for user with no settings record ─

    [Fact]
    public async Task GetSettings_UserWithNoSettingsRecord_Returns200WithDefaults()
    {
        // Create a fresh user with no ChartSettings record
        var freshUserId = Guid.NewGuid();
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Users.Add(new User
        {
            Id = freshUserId,
            Username = $"fresh_{freshUserId:N}",
            Email = $"fresh_{freshUserId:N}@example.com",
            PasswordHash = "testhash",
            Role = "user",
            IsActive = true,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var client = fixture.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Bearer", ApiFixture.GenerateTestJwt(freshUserId));

        var response = await client.GetAsync("/api/settings");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<GetSettingsResponse>();
        Assert.NotNull(body);
        Assert.Equal("kg", body.PreferredUnit);
        Assert.Null(body.WeightGoal);
        Assert.True(body.LossRate > 0, "lossRate default should be positive");
        Assert.True(body.CarbFatRatio > 0, "carbFatRatio default should be positive");
        Assert.True(body.BufferValue > 0, "bufferValue default should be positive");
    }

    // ── GET /api/settings ───────────────────────────────────────────────────────

    [Fact]
    public async Task GetSettings_FreshDb_ReturnsSeededDefaults()
    {
        var response = await _client.GetAsync("/api/settings");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<GetSettingsResponse>();
        Assert.NotNull(body);
        Assert.Equal("kg", body.PreferredUnit);
        Assert.Null(body.WeightGoal);
        Assert.True(body.LossRate > 0, "lossRate should be a positive decimal");
        Assert.True(body.CarbFatRatio > 0, "carbFatRatio should be a positive decimal");
        Assert.True(body.BufferValue > 0, "bufferValue should be a positive decimal");
    }

    [Fact]
    public async Task GetSettings_AfterPut_ReturnsUpdatedValues()
    {
        var put = new PutSettingsRequest("lbs", 80m, 0.5m, 1.2m, 0.3m);
        var putResponse = await _client.PutAsJsonAsync("/api/settings", put);
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        var response = await _client.GetAsync("/api/settings");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<GetSettingsResponse>();
        Assert.NotNull(body);
        Assert.Equal("lbs", body.PreferredUnit);
        Assert.Equal(80m, body.WeightGoal);
        Assert.Equal(0.5m, body.LossRate);
        Assert.Equal(1.2m, body.CarbFatRatio);
        Assert.Equal(0.3m, body.BufferValue);
    }

    // ── PUT /api/settings ───────────────────────────────────────────────────────

    [Fact]
    public async Task PutSettings_ValidValues_Returns200WithUpdatedSettings()
    {
        var request = new PutSettingsRequest("kg", null, 0.25m, 2.0m, 0.1m);

        var response = await _client.PutAsJsonAsync("/api/settings", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<GetSettingsResponse>();
        Assert.NotNull(body);
        Assert.Equal("kg", body.PreferredUnit);
        Assert.Null(body.WeightGoal);
        Assert.Equal(0.25m, body.LossRate);
        Assert.Equal(2.0m, body.CarbFatRatio);
        Assert.Equal(0.1m, body.BufferValue);
    }

    [Fact]
    public async Task PutSettings_InvalidPreferredUnit_Returns400WithField()
    {
        var request = new PutSettingsRequest("stone", null, 0.25m, 2.0m, 0.1m);

        var response = await _client.PutAsJsonAsync("/api/settings", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(body?.Error);
        Assert.Equal("preferredUnit", body.Field);
    }

    [Fact]
    public async Task PutSettings_NegativeLossRate_Returns400WithField()
    {
        var request = new PutSettingsRequest("kg", null, -0.1m, 2.0m, 0.1m);

        var response = await _client.PutAsJsonAsync("/api/settings", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(body?.Error);
        Assert.Equal("lossRate", body.Field);
    }

    [Fact]
    public async Task PutSettings_NegativeCarbFatRatio_Returns400WithField()
    {
        var request = new PutSettingsRequest("kg", null, 0.25m, -1m, 0.1m);

        var response = await _client.PutAsJsonAsync("/api/settings", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(body?.Error);
        Assert.Equal("carbFatRatio", body.Field);
    }

    [Fact]
    public async Task PutSettings_NegativeBufferValue_Returns400WithField()
    {
        var request = new PutSettingsRequest("kg", null, 0.25m, 2.0m, -0.5m);

        var response = await _client.PutAsJsonAsync("/api/settings", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(body?.Error);
        Assert.Equal("bufferValue", body.Field);
    }

    [Fact]
    public async Task PutSettings_NegativeWeightGoal_Returns400WithField()
    {
        var request = new PutSettingsRequest("kg", -10m, 0.25m, 2.0m, 0.1m);

        var response = await _client.PutAsJsonAsync("/api/settings", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(body?.Error);
        Assert.Equal("weightGoal", body.Field);
    }

    [Fact]
    public async Task PutSettings_NullWeightGoal_Returns200()
    {
        var request = new PutSettingsRequest("kg", null, 0.25m, 2.0m, 0.1m);

        var response = await _client.PutAsJsonAsync("/api/settings", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<GetSettingsResponse>();
        Assert.NotNull(body);
        Assert.Null(body.WeightGoal);
    }
}

// ── Request / Response DTOs (test-local) ────────────────────────────────────

record GetSettingsResponse(string PreferredUnit, decimal? WeightGoal, decimal LossRate, decimal CarbFatRatio, decimal BufferValue);
record PutSettingsRequest(string PreferredUnit, decimal? WeightGoal, decimal LossRate, decimal CarbFatRatio, decimal BufferValue);
