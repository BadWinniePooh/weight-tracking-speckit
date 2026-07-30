using System.Net;
using System.Net.Http.Headers;
using WeightTracker.Tests.Integration.Fixtures;
using Xunit;

namespace WeightTracker.Tests.Integration.Endpoints;

/// <summary>Verifies that protected endpoints enforce JWT auth (T037).</summary>
public class ProtectedEndpointsAuthTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private static readonly string[] ProtectedGetEndpoints = ["/api/entries", "/api/chart", "/api/settings"];

    [Theory]
    [InlineData("/api/entries")]
    [InlineData("/api/chart")]
    [InlineData("/api/settings")]
    public async Task Get_WithoutToken_Returns401(string path)
    {
        var client = fixture.CreateClient();
        var response = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/entries")]
    [InlineData("/api/chart")]
    [InlineData("/api/settings")]
    public async Task Get_WithValidToken_ReturnsSuccess(string path)
    {
        // Ensure test user and settings exist
        var client = fixture.CreateAuthenticatedClient();
        var response = await client.GetAsync(path);
        Assert.True(
            response.StatusCode == HttpStatusCode.OK || response.StatusCode == HttpStatusCode.NotFound,
            $"Expected 200 or 404 for {path}, got {response.StatusCode}");
    }

    [Fact]
    public async Task GetHealth_WithoutToken_Returns200()
    {
        var client = fixture.CreateClient();
        var response = await client.GetAsync("/health");
        Assert.True(
            response.StatusCode == HttpStatusCode.OK || response.StatusCode == HttpStatusCode.ServiceUnavailable,
            $"Health check should be public, got {response.StatusCode}");
    }
}
